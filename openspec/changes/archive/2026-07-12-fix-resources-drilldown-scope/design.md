# Design

## D1 — Filter-only navigation params helper

`FiltersStore.toQueryParams()` serializes full Explorer state including
`hier`, `open`, `sel`, `search`. Those keys are meaningless on `/resources`
and would pollute its URL. Add an additive method:

```ts
/** Nav params for cross-view drilldown: range + grain + dimension filters only. */
toFilterParams(): Params
```

Returns `start`, `end`, `grain`, and every non-null `DIMENSION_FILTER_KEYS`
entry. `toQueryParams()` stays as-is for Explorer deep links (it can be
refactored to spread `toFilterParams()` internally — implementation detail).

Both drilldown call sites build nav params as:

```ts
{ ...filters.toFilterParams(), ...row.ancestorFilters, resource_name: row.value }
```

`ancestorFilters` keys are already `DimensionFilterKey` names, so spread order
gives ancestor path precedence over any same-key global filter, and the leaf
`resource_name` wins last — mirrors the merge in `explorer.component.ts:85`.

Explorer detail-panel `openResources` changes signature from `(value: string)`
to `(row: TreeRow)` so it has `ancestorFilters`.

## D2 — URL-sync ownership on Resources

Today Resources only *reads* the URL (`hydrateFromParams` in constructor) and
never writes. Chip dismissal changes filter state, so the URL would go stale
and the "visible scope" spec would break deep-linking.

Ownership rule: **ResourcesComponent owns its URL**, same pattern as
ExplorerComponent's `effect` (explorer.component.ts:72) but serializing
`toFilterParams()` only — never `hier`/`open`/`sel`/`search`. One `effect` in
the constructor:

```ts
effect(() => {
  void this.router.navigate([], { relativeTo: this.route,
    queryParams: this.filters.toFilterParams(), replaceUrl: true });
});
```

`replaceUrl: true` matches Explorer — filter tweaks don't spam history.
Because params not in the emitted object are dropped by `navigate([], ...)`
(no `queryParamsHandling: 'merge'`), a dismissed chip's param disappears
automatically.

Note: `FiltersStore` is a singleton, so a dismissed filter is also cleared for
Explorer on back-nav. This is existing shared-store behavior (accepted in the
current design), not new to this change.

Detail round-trip: `open(row)` (resources.component.ts:147) navigates with
`queryParams: this.filters.toFilterParams()`; the detail page's
"‹ All resources" link gets `queryParamsHandling="preserve"` so params ride
back. `ResourceDetailComponent` also hydrates `FiltersStore` from its route
params and passes a scoped query into both data calls — `filters.query()`
minus `resource_name` and `ocid`: the path OCID already identifies the
resource uniquely, and a stale `resource_name` filter disagreeing with the
OCID must not blank a valid detail URL. Date and all other dimension filters
are retained; the URL keeps `resource_name` for back-navigation scope.

```ts
api.resourceDetail(ocid, scopedQuery())
api.lineItems({ ocid }, granularity, scopedQuery())
```

`CostApiService.resourceDetail()` gains an optional `CostQuery` and serializes
it with the existing `toParams()` helper. The backend resource handler already
parses all shared filters before forcing the path OCID, so this is client and
OpenAPI alignment rather than new backend behavior. Store singleton preserves
in-memory state; route hydration makes refresh/deep-link detail loads scoped too.

## D3 — Chip eligibility and labels

- Chip keys: `DIMENSION_FILTER_KEYS` minus `ocid`. `ocid` has no
  `DIMENSION_LABELS` entry and identifies a single resource (detail-route
  concern); rendering it as a chip adds noise without meaning.
- Label: `DIMENSION_LABELS[dim]` + `labelForFilterValue(value)` — `""` renders
  "(untagged)". No `__untagged__` handling in the UI layer;
  `cost-api.service.ts:33` translates at HTTP time.
- Dismiss handler: `filters.setFilter(key, null); page.set(1);` — the existing
  `key` computed re-fires the fetch; the D2 effect updates the URL.

## D4 — Clear filters button

Filter bar already renders "Reset hierarchy" (`filter-bar.component.ts:45`).
Add "Clear filters" beside it:

```ts
(click)="filters.clearFilters(); filters.search.set(''); filters.selectedPath.set(null)"
```

`clearFilters()` exists (`filters-store.ts:94`) and nulls all
`DIMENSION_FILTER_KEYS` signals; search and `selectedPath` are separate
signals, cleared explicitly. Clearing `selectedPath` matters: `sel` is
URL-backed and `restoreExpanded` would re-select an obsolete row (whose
detail was fetched under the old filters) after the refetch. `expandedPaths`
stays — label-based paths self-heal (`restoreExpanded` skips rows that no
longer exist) and surviving expansion after a filter clear is useful.
Range/grain/hierarchy signals untouched. Disabled binding: no non-null
dimension filter and empty search. Explorer's existing URL-sync effect drops
the params automatically — no new plumbing.

## D5 — Composite untagged resource_name (backend)

`query.go:116,123` build
`if(empty(rnameExpr), concat('untagged · ', product_description), rnameExpr)`
for the resources/detail SELECTs only, but `dimensions["resource_name"]` and
the `where()` entry use raw `rnameExpr` — so breakdown returns `""` and the
tree shows "(untagged)" with no drillable value.

**Composite key choice.** `product_description` was rejected: it is a
SKU/charge description, not resource identity — measured on dev ClickHouse,
398/1144 (35%) of untagged OCIDs carry 2–5 descriptions (an ADB bills ECPU,
Exadata storage, backup storage… separately), so grouping on it splits one
resource across buckets, and the existing resources-view label picks one
arbitrarily via `any()`. `product_service` IS 1:1 per OCID (verified; sole
exception: tenancy-level charges on the tenancy OCID span 2 services —
acceptable split), and an OCID tail disambiguates resources sharing a
service:

```
if(empty(rnameExpr),
   concat('untagged · ', product_service, ' · …', right(product_resourceid, 8)),
   rnameExpr)
```

Plain per-row expression — deterministic, groupable, and usable verbatim in
WHERE, so filter round-trip needs no subquery.

Single-point fix: extract the composite as `rnameDisplayExpr` and use it in
- `dimensions["resource_name"]` (breakdown grouping → tree labels),
- the `where()` resource-name entry (composite filter value round-trips),
- the filters-endpoint `resource_names` aggregation (dropdown options),
- the two existing SELECT sites (replacing the description composite, so
  resources/detail labels change format but become deterministic).

Consequences, accepted:
- `resource_name=__untagged__` matches nothing (expr never empty); UI never
  sends it for this dimension since `""` no longer appears. Old deep links
  degrade to empty results, not errors.
- Resources-view untagged labels change from `untagged · <description>` to
  the new composite — required for round-trip consistency.
- 8-char OCID-tail collision between two untagged same-service resources
  merges them into one bucket — vanishingly rare, tolerated.

Cross-repo: `internal/httpapi/openapi.yaml` param descriptions for
`resource_name` and the API README updated in the same change (repo
convention). This is a **breaking value-semantics change** (no
endpoint/parameter additions): `resource_name=__untagged__` stops matching
and composite labels become the canonical values.

## D6 — Tests

Vitest (Angular's current runner), colocated `*.spec.ts`:
- `filters-store.spec.ts`: `toFilterParams()` includes range/grain/filters,
  excludes `hier`/`open`/`sel`/`search`.
- `tree-table.component.spec.ts`: `openResources` nav params retain
  `ancestorFilters` + leaf `resource_name`.
- `resources.component.spec.ts`: chip list excludes `ocid`; `""` labels
  "(untagged)"; dismiss resets `page` to 1, clears the filter signal, and
  router receives params without the dismissed key.
- `filter-bar.component.spec.ts`: "Clear filters" nulls all dimension filters
  and empties search; range/grain/hierarchy unchanged; disabled when nothing
  active.
- `cost-api.service.spec.ts`: scoped `resourceDetail()` serializes the inherited
  date and dimension filters.
- `resource-detail.component.spec.ts`: route params hydrate the store; both
  detail and lineitems requests receive the same scoped query; back-link query
  params are preserved.
- Go `query_test.go`: breakdown by `resource_name` groups on the composite
  expr; `where()` matches composite values; filters query lists composites.
