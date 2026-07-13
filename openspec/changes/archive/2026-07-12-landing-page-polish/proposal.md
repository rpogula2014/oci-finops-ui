# landing-page-polish

## Why

Three usability problems on the Cost Summary landing page: (1) dimension filters set in Cost Explorer silently carry over to the Summary via the shared `FiltersStore`, so the landing page shows a filtered subset with no indication — users can't tell why totals shrank; (2) the fixed `--container-max: 1240px` shell leaves large dead space on wide viewports / lower zoom levels (~40% of a 2000px-wide window is empty); (3) the landing page is data-sparse — one time-series chart and one breakdown list, while existing endpoints already return data for more.

## What Changes

- **Scope dimension filters to Explorer.** Date range, granularity, and currency remain global; the 8 dimension filters (`env`, `cost_center`, `service`, …) apply only in Explorer (and its Resources drilldown). Cost Summary always shows full spend for the selected time range.
- **Fluid shell width.** Raise the shell container cap so content grows with the viewport (fluid up to a sane readable max), removing dead space at 90% zoom / wide monitors.
- **Two new Summary charts from existing data:**
  - "By service" breakdown bars (second breakdown next to the group-by list, reusing the exec-summary/breakdown endpoint with `dimension=service`).
  - Current-month vs prior-month daily run-rate line (reuses the timeseries endpoint at day granularity).
- No API changes — all data comes from endpoints already consumed by the UI.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `cost-data-layer`: shared query state splits into global context (date range, granularity, currency) vs Explorer-scoped dimension filters; Summary consumes only the global context.
- `executive-summary`: Summary is always unfiltered by dimensions; adds by-service breakdown and daily run-rate comparison charts.
- `app-shell`: content container becomes fluid (wider max), instead of fixed 1240px.

## Impact

- `src/app/core/filters-store.ts` — split `query` into global vs dimension-filtered variants; Summary switches to the global one. Explorer/Resources behavior unchanged.
- `src/app/views/summary/summary.component.ts` (+ `summary-metrics.ts`) — drop dimension-filter coupling, add two chart panels.
- `src/app/app.ts` / `src/styles.scss` — `--container-max` widened.
- Deep links: Explorer URLs keep dimension params; Summary URLs stop carrying them.
- No backend / `openapi.yaml` changes.
