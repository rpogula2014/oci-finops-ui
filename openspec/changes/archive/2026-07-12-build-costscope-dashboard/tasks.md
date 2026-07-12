## 1. Phase 1 — Scaffold, shell, data layer

- [x] 1.1 Scaffold Angular 17+ workspace (standalone, routing, SCSS) in this directory; add ngx-echarts/echarts, lucide-angular
- [x] 1.2 Add ATD visual system: CSS custom properties from CLAUDE-CODE-PROMPT.md §5, Poppins, type roles, money-format pipe (currency code + thousands separators)
- [x] 1.3 Configure dev proxy `/v1 → localhost:8080` and injectable API base URL token
- [x] 1.4 Define envelope/row types (cost as string; freshness/healthz data as object) and `CostApiService` with one typed method per endpoint + `unwrap()` error mapping
- [x] 1.5 Build `FiltersStore` (signals: start/end, grain, 8 dimension filters) with 200ms debounce + switchMap cancellation and URL sync
- [x] 1.6 Build shared `panel-state` component (loading skeleton / empty / envelope-error banner)
- [x] 1.7 Build app shell: top bar (wordmark, date-range, currency selector, freshness stamp), left nav with active state, routes /summary /explorer /resources /resources/:ocid /trends (lazy)
- [x] 1.8 Unit tests: envelope unwrap (success/error codes), per-currency partitioning helper, untagged "" → "(untagged)" mapping, URL hydration

## 2. Phase 2 — Executive Summary

- [x] 2.1 Derived-metrics service: Daily (with prev-day delta), MTD, YTD from parallel summary calls, per-currency
- [x] 2.2 KPI band: Daily/MTD/YTD cards, YTD red-accent hero, CurrencyAmount[] input shape
- [x] 2.3 Timeseries area chart with grain toggle (blue palette, aria label + data-table fallback)
- [x] 2.4 Service donut + compartment horizontal bars from breakdown endpoint
- [x] 2.5 5-cell custom-tag small multiples (breakdown limit 5 per tag); cell click routes to /explorer?groupBy=<dim> preserving filters
- [x] 2.6 Verify /summary against wireframe 2a and live API; all panels handle loading/empty/error

## 3. Phase 3 — Cost Explorer

- [x] 3.1 Filter rail: date range, grain, per-dimension controls populated from /filters (with "(untagged)" mapping)
- [x] 3.2 Drill state model: crumb list + groupBy in FiltersStore, serialized to query params, hydrated on load (deep-linkable)
- [x] 3.3 Group-by table from breakdown; row click pushes crumb + filter + next-dimension picker; crumb pop restores level
- [x] 3.4 Node detail right panel: cost, MoM delta, lineitems stats (my_cost, overage_items, line_items) with red overage treatment
- [x] 3.5 Deepest-drill linking to /resources/:ocid; CSV export of current table
- [x] 3.6 Verify against wireframe 2b: drill 3 levels deep, refresh reproduces state, back button works

## 4. Phase 4 — Resources + Trends

- [x] 4.1 Resources table: server-side paginate/sort via endpoint params, pager from `total`, keyboard navigation + focus-visible
- [x] 4.2 Resource detail route: full field set + lineitems trend with grain toggle; not-found state
- [x] 4.3 Trends view: timeseries + grain toggle + shared filters; stacked-by-dimension option
- [x] 4.4 Acceptance sweep: no hardcoded numbers, currencies never summed, a11y pass on tables/charts, README with quickstart + route map

## 5. Post-spec follow-ups (stakeholder-driven, 2026-07-12)

- [x] 5.1 Landing redesign: stat band (Total/Latest/MoM/Forecast/Untagged/Non-prod/Top), monthly stacked chart, by-dimension bars
- [x] 5.2 Group-by LOV on landing (resource name/compartment/cost center/component type/service/environment)
- [x] 5.3 Top-bar date presets (last 6 months default, current/last month, quarter, year, custom)
- [x] 5.4 Date-only x-axis labels (hour grain keeps time)
- [x] 5.5 cost-api fix: compartment filter name-vs-OCID column
- [x] 5.6 cost-api + client: __untagged__ sentinel so untagged is filterable
