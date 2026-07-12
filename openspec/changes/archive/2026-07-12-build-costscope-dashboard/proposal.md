# Proposal: build-costscope-dashboard

## Why

OCI cost data is attributed and served by the CostScope Cost API (`http://localhost:8080`, verified live 2026-07-11 — all 9 endpoints respond), but there is no UI. Executives need board-ready headline numbers; analysts need drilldown by service/compartment/tag. Build the read-only Angular dashboard specified in `CLAUDE-CODE-PROMPT.md` with wireframes in `OCI Cost Dashboard Wireframes.dc.html`.

## What Changes

- New Angular 17+ workspace (standalone components, signals) in this directory.
- App shell: 64px Distribution-Blue top bar (wordmark, global date-range + currency selectors, freshness stamp), 256px left nav, ATD visual system tokens.
- Data layer: typed `CostApiService` over the envelope contract + `FiltersStore` signal store; filters URL-synced, debounced 200ms, in-flight cancellation.
- **Executive Summary** (`/summary`, default): Daily/MTD/YTD KPI band, timeseries area chart with grain toggle, service donut, compartment bars, 5-cell custom-tag small multiples linking into Explorer.
- **Cost Explorer** (`/explorer`): filter rail, breadcrumb group-by drilldown table, node-detail side panel with lineitems stats, CSV export, deep-linkable URL state.
- **Resources** (`/resources`, `/resources/:ocid`): server-paginated/sorted table → full-detail page with lineitems trend.
- **Trends** (`/trends`): timeseries with grain toggle + dimension filters + stacked-by-dimension option.
- Charts via `ngx-echarts`; icons via `lucide-angular`.

Verified API contract deltas the implementation MUST honor (live-tested, not in the original prompt):
- `cost`/`my_cost` are **decimal strings**, not numbers — types model `string`, parse at display/chart boundary.
- Filter arrays contain `""` entries (environment, cost_center, component_type, resource_names) — render as "(untagged)" and pass through as empty param value.
- Envelope `data` is an array for list endpoints but an object for `/freshness` and `/healthz`.
- Error envelope confirmed: HTTP 400 + `{code:"VALIDATION_ERROR", message}`.

## Capabilities

### New Capabilities
- `app-shell`: chrome (top bar, nav, freshness), routing, ATD visual system, global date-range/currency controls.
- `cost-data-layer`: typed API client, envelope/error handling, FiltersStore, URL state sync, derived Daily/MTD/YTD metrics, per-currency partitioning.
- `executive-summary`: KPI band, trend chart, service/compartment breakdowns, tag small-multiples.
- `cost-explorer`: filter rail, breadcrumb drilldown, node detail panel, CSV export.
- `resources-view`: paginated resource table + OCID detail route.
- `trends-view`: timeseries view with grain toggle and stacking.

### Modified Capabilities

None (greenfield — no existing specs).

## Impact

Implementation surfaced two **cost-api (Go) fixes** shipped alongside this change (uncommitted in `UI/cost-api` as of 2026-07-12):
- `query.go`: compartment filter matched `product_compartmentid` (OCID) while breakdown/filters return names — name filters silently returned nothing; now `product_compartmentname`.
- `query.go`: new `__untagged__` sentinel so clients can filter dimension = '' (the API ignores empty params, making untagged unfilterable before).

- New code only; nothing existing to break. All under `UI/oci-finops-ui/`.
- Runtime dependency on CostScope Cost API at `http://localhost:8080` (dev proxy or environment-config base URL).
- New npm deps: `ngx-echarts`/`echarts`, `lucide-angular`.
- Read-only — no writes to any backend.
- Phased delivery: Phase 1 (scaffold + shell + data layer) unblocks Phases 2–4 (summary, explorer, resources+trends), which are then independent.
