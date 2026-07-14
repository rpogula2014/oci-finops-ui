# Proposal: trends-anomalies-view

## Why

The Trends tab is a placeholder: one timeseries chart with grain toggle and stack-by. It answers "what did spend look like" but not the questions FinOps users actually bring: **what changed, what's anomalous, and what's driving it**.

The backend now ships two analysis endpoints that answer those questions server-side in ClickHouse:

- `GET /v1/costs/anomalies` — per-day MAD z-score outliers per dimension value (`baseline`, `deviation`, `z_score`, `severity`, `direction`), tunable via `window` (7–90d), `min_z`, `min_impact` ($ noise floor).
- `GET /v1/costs/trends` — current-vs-prior-period movers per dimension value (`current_cost`, `previous_cost`, `change_pct`, `slope`, `direction`).

Both accept `dimension` (service, compartment, environment, cost_center, component_type, resource_type, resource_name), the same shared filters the UI already models in `FiltersStore` (1:1 key match), `start`/`end`, and return the standard envelope. Without a UI, this analysis is invisible.

## What Changes

Rebuild `/trends` as a two-tier view:

1. **Highlights tier (automatic, no configuration)** — fan out anomalies+trends calls across a fixed dimension set (service, compartment, environment; anomalies-only for resource_name), cluster same-day/direction anomalies across dimensions into single events with cross-dimension attribution ("COMPUTE spike, driven by compartment X › resource Y"), collapse consecutive days into one event. Render: stat cards (critical anomaly count + excess $, top riser, top faller), ranked anomaly event cards, top-movers diverging bars. Each panel loads independently (progressive skeletons — measured API contention makes fan-out wall ~2.5s worst case pre-backend-fix).
2. **Drilldown tier** — dimension picker + a visible, local focus path; movers table and anomaly list for the picked dimension; the existing timeseries chart with anomaly `markPoint` overlays. Clicking a row extends focus and steps to the next dimension. "Investigate" seeds focus and jumps here. The shared filters remain the stable baseline for both tiers; only an explicit "Open in Cost Explorer" action exports the focus path. Sensitivity presets (default/strict/loose) replace raw `window`/`min_z`/`min_impact` knobs.

Existing grain toggle and stack-by are retained inside the drilldown tier's chart.
The Trends header also offers a local Reset view action that returns this view's controls and focus to their defaults without altering shared range or filters.

Numeric note: analysis endpoints return float costs (statistical outputs), unlike ledger endpoints' decimal strings — accepted deliberately; floats are formatted directly, not routed through `parseCost`.

## Impact

- **Specs**: `trends-view` (extended — placeholder requirements kept, highlights + drilldown + anomaly-overlay requirements added); `cost-data-layer` (delta — two new API methods + types).
- **Code**: `core/api.types.ts`, `core/cost-api.service.ts` (new methods), `views/trends/` (rebuilt component, likely split into highlights + drilldown child components), no changes to other views.
- **API**: none required by this change; two backend prerequisites tracked separately in `oci-finops-api`: (1) request-concurrency fix (8 parallel calls inflate 375ms→2.2s each), (2) `trends?dimension=resource_name` returns 200 with empty body.
