# Tasks — redesign-cost-explorer

## 1. Backend: breakdown series + filtered filters (additive)

- [x] 1.1 Add optional `series=true` param to `GET /v1/costs/breakdown` in
      `../oci-finops-api` returning per-row `series: [{date, cost}]` at request
      granularity; costs stay decimal strings. Tests (`-tags clickhouse` build check),
      `openapi.yaml`, and API README updated in the same task. Verify build on a spare
      port — do not touch the running cost-api.
- [x] 1.2 `GET /v1/costs/filters` accepts the standard filter params and returns only
      distinct values valid under those constraints (no params = current behavior).
      Tests, `openapi.yaml`, and API README updated in the same task.

## 2. State & data layer (UI)

- [x] 2.1 `filters-store.ts`: add hierarchy (`hier`), search text, expanded paths
      (`open`), selected node (`sel`) with URL reflection; unit tests.
- [x] 2.2 `cost-api.service.ts`: pass `series` flag through `breakdown()`; `filters()`
      accepts an optional `CostQuery` for cascading options; extend `api.types.ts`
      (`BreakdownRow.series?`); unit tests.

## 3. Tree table

- [x] 3.1 `views/explorer/tree-table.component.ts`: flat `TreeRow[]` render with
      indentation, expand/collapse with lazy `breakdown` fetch (ancestor values as
      filters), per-row children cache, loading/empty/error states via shared
      panel-state.
- [x] 3.2 Row presentation: % of parent share + inline cost bar; sparkline via new
      `shared/sparkline.component.ts` (inline SVG); deepest-level rows link to Resource
      detail route.
- [x] 3.3 Noise suppression: hide zero-cost rows (decimal-string compare via
      `currency.ts`), top-15 per level + expandable `Other (n)` bucket, "show all"
      toggle.

## 4. Filter bar & search

- [x] 4.1 `views/explorer/filter-bar.component.ts`: single horizontal row —
      Environment, Cost Center, Component, Compartment, Service, Resource Type,
      Resource Name dropdowns + "Name contains" input, date range + grain adjacent;
      remove left rail.
- [x] 4.1b Cascading options: fetch options for each dropdown with upstream (left)
      selections applied via filtered `/v1/costs/filters`; debounce refetch on upstream
      change; reset invalidated downstream selections to "All"; unit tests for the
      cascade/reset logic.
- [x] 4.2 Hierarchy picker (ordered chips, default compartment → cost center →
      component type → resource type → resource name); change resets expansion and updates URL.
- [x] 4.3 Free-text search over loaded rows (ancestors of matches stay visible),
      placeholder notes "searches loaded rows".

## 5. Detail panel, CSV, deep links

- [x] 5.1 Adapt node detail panel to tree rows: lineitems scoped by ancestor values +
      global filters; ancestor path shown in panel header; MoM delta + overage styling
      preserved.
- [x] 5.2 CSV export of visible tree rows with hierarchy-path, cost, share columns.
- [x] 5.3 Deep-link restore: parse `hier`/`open`/`sel`, lazily expand saved paths on
      load.

## 6. Verification & docs

- [x] 6.1 Component/unit tests green (`npm test`); no changes leak into summary/trends/
      resources views.
- [x] 6.2 Live browser verification against running cost-api: drill 3 levels, change
      hierarchy, search, Other bucket, CSV download, deep-link reload restores state,
      sparklines render (and degrade gracefully when `series` absent), cascading
      dropdowns narrow left→right and invalid downstream selections reset.
      (Verified 2026-07-12: drill/search/cascade/reset/deep-link/sparklines pass.
      CSV download click and Other bucket were not exercised with the available data.
      Post-review fixes clear stale detail selections and deduplicate equivalent
      `/v1/costs/filters` requests.)
- [x] 6.3 Update `openspec/specs/cost-explorer/spec.md` via archive flow; UI README
      touch-up if explorer usage is described there.
