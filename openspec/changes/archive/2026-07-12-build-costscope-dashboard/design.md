# Design: build-costscope-dashboard

## Context

Greenfield Angular app in `UI/oci-finops-ui/`. Backend is the live CostScope Cost API (`http://localhost:8080`) over a ClickHouse view of attributed OCI cost. Layout source of truth: `OCI Cost Dashboard Wireframes.dc.html` (sections 2a/2b). Full endpoint/param/column contract and ATD visual tokens: `CLAUDE-CODE-PROMPT.md`. Contract live-verified 2026-07-11.

## Goals / Non-Goals

**Goals:**
- Read-only dashboard: Executive Summary, Cost Explorer, Resources, Trends.
- Every number traces to a real endpoint; deep-linkable Explorer state; per-currency correctness.
- ATD visual system bound exactly (tokens in CLAUDE-CODE-PROMPT.md §5).

**Non-Goals:**
- No auth, no writes, no budgeting/forecasting, no anomaly detection.
- No SSR, no i18n, no currency conversion (currencies displayed separately, never converted or summed).
- No API changes — client adapts to the contract as-is.

## Decisions

### D1 — Currency is a segment, not a filter
API has no currency param; every endpoint returns one row per currency. Client partitions every response by `currency`. Top-bar currency selector only chooses which segment charts/KPIs foreground **when >1 currency exists**; with one currency (current live state: USD only) it renders as a static label. KPI components accept `CurrencyAmount[]`, never a bare number. Alternative rejected: global client-side filter that drops other currencies — hides real spend.

### D2 — Cost stays a string until the display boundary
Live API returns `cost`/`my_cost` as decimal strings. Types model `string`; a single `parseCost()` (Number()) is applied only in chart adapters and money-format pipe. Precision loss at float64 is acceptable for display (~11 significant digits observed). Alternative rejected: decimal lib (big.js) — overkill for read-only display.

### D3 — State: one FiltersStore signal, URL as source of truth for Explorer
- `FiltersStore`: signals for `start/end`, grain, and the 8 dimension filters. Components derive queries via `computed`.
- Explorer drill state = ordered crumb list `[{dimension, value}...]` + active `groupBy`, serialized to query params (`/explorer?groupBy=compartment&service=COMPUTE&...`). Route params hydrate the store on load → deep links work by construction.
- Requests: `toObservable(filters) → debounceTime(200) → switchMap(http)` per panel; switchMap gives in-flight cancellation.
Alternative rejected: NgRx — signal store is sufficient for a read-only app (Rule 14).

### D4 — One CostApiService, envelope unwrapped at one seam
Typed methods per endpoint returning `Observable<Enveloped<T>>`; a shared `unwrap()` maps `error.code` (`VALIDATION_ERROR`, `UPSTREAM_ERROR`, `UNHEALTHY`) into a typed `ApiError` consumed by a reusable `panel-state` component (loading skeleton / empty / error banner). Note envelope `data` is object (not array) for `/freshness` and `/healthz`.

### D5 — Landing stat cards derived client-side (revised 2026-07-12)
Original Daily/MTD/YTD KPIs were replaced by a stakeholder-requested stat band: Total, Latest month (partial-aware via freshness `data_through`), MoM across complete months, run-rate Forecast, Untagged cost-center spend, Non-prod share of tagged, Top <dimension>. All pure functions in `summary-metrics.ts`; cards omit themselves when inputs are insufficient. Default global range widened to 6 months so MoM/Forecast have history.

### D6 — Untagged rendering and filtering (revised 2026-07-12)
Filter arrays contain `""`; UI shows "(untagged)" as option label. The API ignores empty params, so the client translates `""` → `__untagged__` (sentinel added to cost-api `where()`, matching dimension = ''). Without this, an "untagged" series/filter silently returned the unfiltered total. API-returned `untagged · <product_description>` renders verbatim per prompt.

### D7 — Charts via ngx-echarts, palette locked
Donut/stacked bar/area from ECharts; series palette = blue ramp `#142848→#3a5680→#6f89ad→#a9bcd6→#d9dada`; red reserved for overage/anomaly + single hero KPI. Every chart gets aria-label + data-table fallback. Alternative rejected: hand-rolled SVG (prompt forbids).

### D8 — Dev proxy for API base
Angular dev-server proxy `/v1 → http://localhost:8080` + injectable base URL token, so prod deployment can point elsewhere without rebuild logic in components.

## Risks / Trade-offs

- [API down / stale] → freshness stamp in top bar from `/freshness`; envelope-error banners per panel; app remains navigable.
- [Single-currency assumption creep] → D1 forces `CurrencyAmount[]` shape everywhere; add one multi-currency mock test to keep the path honest.
- [Explorer state complexity] → crumbs serialize to plain query params only; no in-memory-only state, so refresh/back/share always reproduce the view.
- [400-day max range] → clamp date picker; surface validation errors from envelope instead of pre-guessing all limits.
- [Hourly grain over long ranges = heavy payloads] → grain toggle defaults sensibly (day); no auto-hour on wide ranges.

## Migration Plan

Greenfield — no migration. Phased delivery order: Phase 1 scaffold/shell/data-layer → Phase 2 summary → Phase 3 explorer → Phase 4 resources+trends. Each phase leaves the app shippable.

## Open Questions

- None blocking. Wireframe fidelity questions resolved against `OCI Cost Dashboard Wireframes.dc.html` at implementation time.
