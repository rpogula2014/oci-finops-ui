# Fix Resources Drilldown Scope

## Why

Drilling from the Cost Explorer tree to the Resources view drops the tree's
hierarchy context. Both drilldown entry points (`tree-table.component.ts:167`
row button, `explorer.component.ts` detail-panel "View resources") navigate
with only `filters.toQueryParams() + resource_name`, discarding
`row.ancestorFilters` — the compartment / cost-center / component-type /
resource-type constraints accumulated by expanding the tree. The Resources
page then lists every resource matching the leaf `resource_name` across the
whole tenancy (generic names like "boot volume" and `__untagged__` collide
heavily), so users see rows outside the path they drilled into.

The explorer's own detail panel already merges the three layers correctly
(`{...query, ...ancestorFilters, [dim]: value}` — explorer.component.ts:85,
tree-table.component.ts:220); the bug is that the navigation boundary does not.

## What Changes

- `FiltersStore` gains a filter-only nav-params helper (date range + grain +
  dimension filters), because `toQueryParams()` also serializes Explorer-only
  state (`hier`, `open`, `sel`, `search`) that must not leak into the
  Resources URL.
- Tree-table "Resources ›" button navigates with that helper's params merged
  with `row.ancestorFilters` and the leaf `resource_name`.
- Explorer detail-panel "View resources" does the same — it must receive the
  full `TreeRow` (or the already-computed node query), not just the value.
- Resources view shows active dimension filters as dismissible chips.
  Dismissing a chip clears the filter, resets to page 1, re-queries, and
  removes the param from the URL so the visible scope stays deep-linkable
  (Resources currently never writes filters back to the URL).
- Chips label the UI value `""` as "(untagged)" via `labelForFilterValue`;
  `__untagged__` remains an HTTP-layer sentinel only. `ocid` is excluded from
  chips (no `DIMENSION_LABELS` entry; it is a detail-route concern).
- Inherited scope survives list → detail → back: the Resources row click
  carries the filter params to `/resources/:ocid`, and the detail page's
  "All resources" link preserves them on the way back. The detail page also
  hydrates those params and applies them to both resource-detail cost and
  lineitems trend requests, so its displayed values honor the Explorer scope.
- Explorer filter bar gains a "Clear filters" button next to "Reset
  hierarchy": one click resets all dimension filters, the "Name contains"
  search, and the tree selection (`sel`); expansion state, date range,
  grain, and hierarchy untouched. Disabled when nothing to clear.
- **BREAKING** Backend: `resource_name` dimension resolves as
  `untagged · <product_service> · …<OCID tail>` when the tag is empty — in
  breakdown values, filter options, filter matching, and the resources/detail
  queries (which today compose `untagged · <product_description>`; rejected
  because `product_description` is a SKU/charge description, not resource
  identity — 35% of untagged OCIDs carry 2–5 descriptions, so it either
  splits one resource across buckets or picks one arbitrarily via `any()`).
  `product_service` is 1:1 per OCID (verified; sole exception: the tenancy
  OCID's tenancy-level charges span 2 services — acceptable split), and the
  OCID tail makes the value unique and deterministic, one bucket per
  resource, round-tripping verbatim as a filter so tree drilldown on
  untagged rows works. `__untagged__` sentinel no longer applies to
  `resource_name`.
- Unit tests: merged drilldown params retain ancestor scope; chip dismissal
  resets page + URL; untagged chip label; `ocid` excluded; clear-filters
  resets filters + search + selection; detail API calls receive inherited
  scope.
- No endpoint or parameter additions: all ancestor dimensions already exist
  as `DIMENSION_FILTER_KEYS` query params and the `/v1` resources endpoint
  already accepts them. However, `resource_name` **value semantics change**
  (composite label replaces `""`/`__untagged__` — see BREAKING above).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `cost-explorer`: drilldown to Resources SHALL carry the full node scope
  (global filters + ancestor path + node dimension), not just the leaf value;
  filter bar SHALL offer one-click "Clear filters" beside "Reset hierarchy".
- `resources-view`: view SHALL display active dimension filters as
  dismissible chips so inherited drilldown scope is visible and clearable.
- `cost-data-layer`: untagged `resource_name` SHALL resolve to
  `untagged · <product_service> · …<OCID tail>` API-wide (breakdown, filters,
  matching, resources/detail); no more `""` / `__untagged__` for that
  dimension.

## Impact

- `src/app/core/filters-store.ts` — new filter-only nav-params helper
  (additive; `toQueryParams()` unchanged for Explorer deep links).
- `src/app/views/explorer/filter-bar.component.ts` — "Clear filters" button.
- `src/app/views/explorer/tree-table.component.ts` — `openResources()`.
- `src/app/views/explorer/explorer.component.ts` — detail-panel
  `openResources()` signature/call site.
- `src/app/views/resources/resources.component.ts` — filter chips row +
  URL sync on dismiss + row-click nav carries filter params.
- `src/app/views/resources/resource-detail.component.ts` — "All resources"
  back link preserves query params; URL scope is hydrated and applied to cost
  and lineitems requests.
- `src/app/core/cost-api.service.ts` — `resourceDetail()` accepts an optional
  `CostQuery`, matching the filters already accepted by the backend handler.
- New/updated specs under `src/app/**/*.spec.ts` for the above.
- `../oci-finops-api/internal/cost/query.go` — `resource_name` dimension
  expr becomes the composite label in the dims map, `where()`, and the
  filters query; `query_test.go` updated.
- `../oci-finops-api/internal/httpapi/openapi.yaml` + README — document composite
  `resource_name` semantics, the sentinel exception, and the existing shared
  filters accepted by `/v1/costs/resources/{ocid}`.
- Behavior note: existing deep links with `resource_name=__untagged__`
  return empty results after this change (value no longer occurs).
