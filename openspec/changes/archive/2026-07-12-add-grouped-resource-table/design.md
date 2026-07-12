## Context

The Resources view (`views/resources/resources.component.ts`) is a server-paged flat
table (`GET /v1/costs/resources`, 50/page). It carries all resource columns but no PERIOD —
each resource is a single aggregated row. The Cost Explorer's
`explorer/tree-table.component.ts` already implements recursive grouping, client-side
search, and CSV export, but over **dimension aggregates** (`BreakdownRow`), not
resource leaves with OCID columns.

Two paths reach Resources: (a) direct landing (unscoped) — the target of this change;
(b) drilled from Explorer with `resource_name`/OCID scope in query params — must keep
the existing flat table. Data lives in ClickHouse view `oci_cost_report_attributed`;
tag dimensions are map lookups (`ATD-Billing.*`, `ATD-Ops.*`); `""` = unfiltered,
`"__untagged__"` = empty-tag rows. Costs are decimal strings parsed only at display.

## Goals / Non-Goals

**Goals:**
- Group the full resource dataset by up to two dimensions (incl. `period`) with
  subtotals + row counts, server-side free-text search, month-grain leaves, CSV export.
- Reuse tree-table's UX patterns (expand/collapse, search, CSV) without coupling the
  two components.
- Additive backend endpoint; no breaking changes.

**Non-Goals:**
- Changing the drilled-from-Explorer flat table.
- More than two grouping levels.
- Replacing the resource-detail view or its trend chart.
- Client-side aggregation of the full dataset in the browser (server does grouping).

## Decisions

**D1 — Month-grain leaves.** Leaves are resource-month rows (a resource repeats per
month in range), so PERIOD is a first-class column and group key. Rationale: the goal
is "search all the data across the dataset"; per-resource aggregation discards PERIOD.
Backend change is already required, so grain is a free choice.
*Alternative:* per-resource aggregation — rejected; loses PERIOD, weaker for the stated goal.
*Trade-off:* row count scales with months in the date range (bounded by top-N + date filter).

**D2 — Server-grouped endpoint, lazy leaf expansion.** `GET /v1/costs/resources/grouped`
(matches the authoritative `/v1/costs/...` route prefix in `handler.go`) returns group-1
rows with subtotals + counts; expanding fetches group-2 (or leaves) for that
group, mirroring tree-table's lazy `loadChildren`. Rationale: keeps browser payload small;
server owns grouping/sorting/top-N. `group2` optional (single-level allowed).
Expansion scope is passed via explicit **`group1_value` / `group2_value`** params (not
`CostQuery` filters) so that `period` — which has no `CostQuery` filter key — can also be
a group dimension and be scoped on expand. Untagged values use the `"__untagged__"`
sentinel in those params. For `resource_name`, grouping uses a dedicated expression
(`rnameGroupExpr`) that collapses all untagged resources into a single empty-valued
`(untagged)` bucket rather than the per-OCID display fallback — otherwise untagged
resources fragment into hundreds of one-off groups. The grouped scope therefore treats
`resource_name` like the other tag dimensions for untagged (`= ''`), unlike the flat
`where()` filter which never sees an empty display name.

**Single currency (USD).** All spend is USD. Rather than diverge from the global
`Per-currency partitioning` requirement, the endpoint stays *compliant* with it by
being single-currency: the ClickHouse query constrains the physical column
`cost_currencycode = 'USD'` (aliased `currency`, as in the other `query.go` queries), so every
aggregation contains exactly one currency and renders plainly (the rule's own
single-currency case). No per-currency scoping, no `currency` expansion param; rows
still expose a `currency` field (USD) for display/CSV parity. The change adds a
per-endpoint carve-out to `Per-currency partitioning` (MODIFIED delta) documenting this;
it is NOT a global currency-model change — the currency selector (app-shell), trends
per-currency series, and the Explorer tree-table are all left unchanged. Enforcing
`currency = 'USD'` server-side is what prevents an unexpected non-USD row from ever being
summed into a subtotal.
*Alternative:* fetch top-N flat rows once and group in-browser — rejected; "search all data"
requires the server to see the full set, and subtotals must reflect untruncated groups.
*Alternative:* scope expansion via `CostQuery` filters — rejected; `period` is a time
bucket with no filter key, and OCID/leaf scoping would be ambiguous.

**D3 — Server-side `q` search.** `q` filters the full dataset server-side before
grouping so subtotals/counts reflect matches; empty `q` = unfiltered. Rationale: a
client filter over lazily-loaded rows would only search what's expanded — misleading.
Debounced (~200ms) like the current resources query.

**D4 — New `grouped-resource-table` component, not extending tree-table.** Purpose-built
for resource-leaf columns; borrows the expand/search/CSV logic shape. Rationale:
tree-table is dimension-aggregation shaped (cost/share/trend, `BreakdownRow`); forcing
resource columns into it couples two views. *Alternative:* generalize tree-table —
rejected as risky coupling.

**D5 — Route by scope in `resources.component.ts`.** If arriving with `resource_name`
or `ocid` scope (Explorer drilldown) → existing flat table. Otherwise → grouped table.
Dimension selectors are limited to a new **`GroupedResourceDimension`** type =
`Dimension | 'period'` — i.e. the existing `Dimension` union (`environment`, not `env`;
excludes `ocid`) plus `period`. This deliberately differs from `DIMENSION_FILTER_KEYS`
(which uses `env` and includes `ocid`); a small `GROUPED_DIMENSION_LABELS` map provides
display labels. `group1` and `group2` must differ.

**D6 — Response shape.** New `GroupedResourceRow` in `api.types.ts`, a **discriminated
union on `kind`** (`'group' | 'leaf' | 'other'`): `group` rows carry `kind`, `depth`,
`group_value`, `currency`, `subtotal_cost`, `row_count`; `other` rows share that shape
with `kind: 'other'` (terminal, `row_count` = hidden-child count) so the UI never confuses
a synthetic remainder row with a real group whose value is literally "Other"; `leaf` rows
carry `kind`, the full resource columns, `period`, `currency`, `cost`. `currency` is a
USD passthrough (single-currency, see D2), not a partition key. Costs remain decimal
strings. Envelope `{data, meta, error}` unchanged.

## Risks / Trade-offs

- Row explosion at month-grain over long ranges → mitigate: server orders children by
  cost descending and caps at a fixed top-N per group (200 — high enough that real
  dimensions, e.g. ~51 resource-name groups after untagged collapse, are never truncated;
  "Other" only fires on genuine long tails); the
  server returns a synthetic "Other" row per truncated group carrying the aggregated cost
  and hidden count (`row_count`). "Other" is terminal (not expandable). The global date
  filter further bounds the set.
- Server search latency on the full view → mitigate: debounce + ClickHouse index on
  searched columns; cap result rows.
- Two Resources rendering paths (flat vs grouped) risk drift → mitigate: share
  `ResourceRow` columns and `labelForFilterValue`; keep the split in one place (D5).
- `period` as a dimension differs from tag/dimension filters (it's a time bucket, not a
  `CostQuery` filter key) → handle explicitly in the group-by mapping, not via `DIMENSION_TO_FILTER`.

## Migration Plan

1. Ship backend endpoint additively (existing `/v1/costs/resources` untouched); deploy API first.
2. Ship frontend grouped table behind the scope check (D5) — Explorer drilldown path
   unchanged, so no regression there.
3. Rollback = revert frontend; endpoint is additive and harmless if unused.
