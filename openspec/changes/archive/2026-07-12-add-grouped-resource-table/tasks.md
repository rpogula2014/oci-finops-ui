## 1. Backend endpoint (`../oci-finops-api`)

- [x] 1.1 Add `GET /v1/costs/resources/grouped` handler accepting `CostQuery` scope + `group1`, `group2?`, `group1_value?`, `group2_value?`, `q?`, `grain=month`; validate `group1`/`group2` are `GroupedResourceDimension` (dimensions + `period`, excl. `ocid`) and `group1 != group2`
- [x] 1.2 Build ClickHouse query over `oci_cost_report_attributed`: constrain physical column `cost_currencycode = 'USD'` (aliased `currency`, matching existing queries in `query.go` — single-currency guard so no non-USD row is ever summed), month-grain grouping, per-group subtotal + row_count, parent scoping via `group1_value`/`group2_value` (incl. `period` and `__untagged__`), `q` case-insensitive substring filter (`ILIKE ?` with `%term%` bound as the parameter) OR'd across resource-name/ocid/service/compartment/region/resource-type/environment/cost-center/component-type applied before grouping, order children by cost desc (numeric, not stringified) with top-N cap (200) + synthetic "Other" row (aggregated cost + hidden count), collapse untagged `resource_name` into one `(untagged)` bucket via `rnameGroupExpr`, `""` = unfiltered
- [x] 1.3 Shape response as `{data, meta, error}`, rows discriminated on `kind`: `group`/`other` rows (`kind`, `depth`, `group_value`, `currency`, `subtotal_cost`, `row_count`) and `leaf` rows (`kind`, full resource cols incl. `ocid`, plus `period`, `currency`, `cost`); `currency` is USD passthrough; costs as decimal strings
- [x] 1.4 Add handler tests: single-level, two-level expansion via `group1_value`, leaf expansion via `group2_value`, `period` grouping, `q` filter, untagged group, top-N `other` row, USD-only guard (non-USD rows excluded), empty result
- [x] 1.5 Update `../oci-finops-api/internal/httpapi/openapi.yaml` with the new endpoint (params, response schema) and update the API README (endpoint doc + mermaid flow)

## 2. Frontend data layer

- [x] 2.1 Add `GroupedResourceDimension` type (`Dimension | 'period'`) + `GROUPED_DIMENSION_LABELS`; add `GroupedResourceRow` discriminated union on `kind` (`group`/`other`/`leaf`, all with `currency`) to `core/api.types.ts`
- [x] 2.2 Add `groupedResources(query, group1, group2?, opts?: { group1Value?, group2Value?, q? })` to `core/cost-api.service.ts` (grain fixed to `month`)
- [x] 2.3 Add spec test for the new client call (URL/params incl. parent-value + `q` + envelope unwrap)

## 3. Grouped-resource-table component

- [x] 3.1 Create `views/resources/grouped-resource-table.component.ts` (standalone, OnPush, signals)
- [x] 3.2 Render Group / then selectors (`GroupedResourceDimension`, second selector excludes the first's value), search box (debounced → `q`), CSV export button
- [x] 3.3 Render group rows (label, subtotal via MoneyPipe, "N rows"), expand/collapse passing `group1_value`/`group2_value`, lazy child fetch mirroring tree-table `loadChildren`/`restoreExpanded`; render `kind: 'other'` rows as terminal (non-expandable)
- [x] 3.4 Render month-grain leaf rows with full columns (period, env, cost center, component, compartment, service, resource type, resource name, OCID, cost); leaf click opens resource detail
- [x] 3.5 Implement CSV export of visible rows (group path + currency + leaf columns), matching tree-table pattern
- [x] 3.6 Component spec tests: grouping levels, same-dimension prevention, search wiring, expand fetch with parent values, "Other" truncation, CSV
- [x] 3.7 "Show all / Hide noise" toggle (default hides $0 rows) → `hide_zero` param on root + expansion fetches; backend `HAVING round(sum(cost),2) != 0`; test asserts filter present/absent

## 4. Wire into Resources view

- [x] 4.1 In `resources.component.ts`, route by scope: `resource_name`/`ocid` present → existing flat table; else → grouped-resource-table
- [x] 4.2 Ensure filter chips + URL sync still apply on the grouped path
- [x] 4.3 Update `resources.component.spec.ts` for the scope-based rendering split

## 5. Verify

- [x] 5.1 `npm run build` and `npm test` pass
- [x] 5.2 Live-verify against cost-api on :8080: direct-landing shows grouped table with working 2-level grouping, search, expand, and CSV; Explorer drilldown still shows the flat table (verified live via UI screenshots: grouping, untagged bucket, ordering, hide-noise, resource detail)
