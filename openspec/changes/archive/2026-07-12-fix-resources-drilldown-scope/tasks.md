# Tasks

## 1. Filter-only nav params (design D1)

- [x] 1.1 `filters-store.ts`: add `toFilterParams(): Params` — `start`, `end`, `grain`, non-null dimension filters; no `hier`/`open`/`sel`/`search`
- [x] 1.2 `tree-table.component.ts` `openResources()`: navigate with `{ ...filters.toFilterParams(), ...row.ancestorFilters, resource_name: row.value }`
- [x] 1.3 `explorer.component.ts` detail-panel `openResources()`: take full `TreeRow`, same merged params; update template call site

## 2. Resources scope chips + URL sync (design D2, D3)

- [x] 2.1 `resources.component.ts`: chip row above table — one dismissible chip per active `DIMENSION_FILTER_KEYS` filter except `ocid`; label `DIMENSION_LABELS[dim]: labelForFilterValue(value)` ("" → "(untagged)")
- [x] 2.2 Chip dismiss → `filters.setFilter(key, null)` + `page.set(1)`; existing `key` computed re-fetches
- [x] 2.3 URL-sync `effect` in Resources constructor: `navigate([], { queryParams: filters.toFilterParams(), replaceUrl: true })` — dismissed params drop from URL
- [x] 2.4 Hide chip row when no chip-eligible filters active
- [x] 2.5 `resources.component.ts` `open(row)`: navigate to detail with `queryParams: filters.toFilterParams()`; `resource-detail.component.ts` "‹ All resources" link gets `queryParamsHandling="preserve"`
- [x] 2.6 `cost-api.service.ts`: let `resourceDetail(ocid, query?)` serialize an optional `CostQuery`; `resource-detail.component.ts` hydrates route params and passes `filters.query()` to both `resourceDetail()` and `lineItems()`

## 3. Clear filters button (design D4)

- [x] 3.1 `filter-bar.component.ts`: "Clear filters" button next to "Reset hierarchy" — `filters.clearFilters()` + `filters.search.set('')` + `filters.selectedPath.set(null)`; `expandedPaths` untouched; disabled when no dimension filter and no search text

## 4. Composite untagged resource_name — backend (design D5)

- [x] 4.1 `../oci-finops-api/internal/cost/query.go`: extract `rnameDisplayExpr` composite; use in `dimensions["resource_name"]`, `where()` resource-name entry, filters-endpoint `resource_names`, and dedupe the two existing SELECT sites
- [x] 4.2 `query_test.go`: breakdown groups on composite; composite filter value round-trips; filters lists composites
- [x] 4.3 `../oci-finops-api/internal/httpapi/openapi.yaml` + README: document composite `resource_name` + `__untagged__` exception (breaking value semantics), and document shared filters on `/v1/costs/resources/{ocid}`
- [x] 4.4 Verify backend with `go build -tags clickhouse` / `go test -tags clickhouse ./...` — do not touch the running cost-api
- [x] 4.5 Composite-key data check (done during planning, dev ClickHouse): `product_description` rejected — 398/1144 untagged OCIDs have 2–5 values; `product_service` 1:1 per OCID except tenancy-level charges (1/1144, accepted split)

## 5. Tests (design D6)

- [x] 5.1 `filters-store.spec.ts`: `toFilterParams()` includes range/grain/filters, excludes Explorer-only keys
- [x] 5.2 `tree-table.component.spec.ts`: drilldown nav params retain ancestor scope + leaf `resource_name`
- [x] 5.3 `resources.component.spec.ts`: `ocid` excluded from chips; `""` labels "(untagged)"; dismiss resets page 1, clears filter, URL params lose dismissed key
- [x] 5.4 `filter-bar.component.spec.ts`: clear-filters nulls dimension filters + search + `selectedPath`; `expandedPaths`/range/grain/hierarchy unchanged; disabled when nothing active
- [x] 5.5 `resources.component.spec.ts`: `open(row)` nav includes filter params; detail back-link preserves them
- [x] 5.6 `cost-api.service.spec.ts` + `resource-detail.component.spec.ts`: scoped detail and lineitems requests both include inherited range/dimension filters; deep-link route hydration works

## 6. Verify

- [x] 6.1 `npm run build` clean; `npm test` green
- [x] 6.2 Manual: expand Compartment → "Resources ›" on shared name → list scoped; URL has `compartment` + `resource_name`, no `hier`/`open`/`sel`; dismissing compartment chip widens list and updates URL
- [x] 6.3 Manual: set env + service + search, click "Clear filters" → dropdowns "All", search empty, range/grain/hierarchy intact, URL params dropped
- [x] 6.4 Manual: tree resource-name level shows `untagged · <service> · …<ocid tail>` rows; "Resources ›" on one lists exactly that resource
- [x] 6.5 Manual: scoped list → open resource → detail cost/trend honor inherited range and filters → "‹ All resources" → same scoped list, params intact
- [x] 6.6 Manual: Resources view untagged rows show the new `untagged · <service> · …<ocid tail>` label (replaces description composite)
- [x] 6.7 `openspec validate fix-resources-drilldown-scope` passes
