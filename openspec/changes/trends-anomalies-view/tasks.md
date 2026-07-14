# Tasks: trends-anomalies-view

## 1. Backend prerequisites (oci-finops-api — verify before UI work)

- [x] 1.1 Confirm request-concurrency fix landed: 8 parallel calls stay near single-call latency (re-run the timing probe)
- [x] 1.2 Confirm `trends?dimension=resource_name` returns a valid envelope (bug fix), and `openapi.yaml` + README in oci-finops-api document both endpoints

## 2. Data layer

- [x] 2.1 Add `AnomalyRow`, `TrendMoverRow`, and option types to `core/api.types.ts` (numeric cost fields)
- [x] 2.2 Add `anomalies()` and `trendMovers()` to `core/cost-api.service.ts`, forwarding shared filters/range; treat empty/non-envelope body as `ApiError`
- [x] 2.3 Unit tests: param forwarding, empty-body error path

## 3. Anomaly event clustering

- [x] 3.1 Implement pure clustering in `views/trends/anomaly-events.ts` (currency partition, direction + consecutive-day grouping, primary-dimension selection, cross-dimension "seen at" attachment, deviation ranking, top 5)
- [x] 3.2 Unit tests: multi-day collapse, cross-dimension attribution, drop vs spike separation, currency partition

## 4. Highlights tier

- [x] 4.1 Keep `trends-highlights.component.ts` pinned to the shared baseline while drill focus changes; retain fan-out, per-panel states, stat cards, event cards, and movers bars
- [x] 4.2 Rewire "investigate" to seed local focus and scroll to drilldown without mutating shared filters

## 5. Drilldown tier

- [x] 5.1 Rework `trends-drilldown.component.ts` around a visible local focus path: merged baseline/focus requests, focus-wins precedence, click-to-drill, back-one-level, clear-focus, and explicit "Open in Cost Explorer"
- [x] 5.2 Add anomaly markPoints to the timeseries chart at day grain (severity colors, cost/baseline/z tooltip); hide at other grains
- [x] 5.3 Sensitivity preset control shared across tiers (default/strict/loose)

## 6. Shell + polish

- [x] 6.1 Recompose `trends.component.ts` as the local focus owner hosting both tiers; keep grain toggle + stack-by in drilldown chart
- [x] 6.2 `npm run build` and `npm test` clean after the focus-path redesign
- [x] 6.3 Add and live-verify the header Reset view action, restoring Trends-local defaults without changing shared filters or range

## 7. Live verification

- [ ] 7.1 Against running cost-api: verify highlights populate with real anomalies (COMPUTE Jul 7–9 event clusters to one card), highlights stay stable while focus changes, investigate→focus flow, breadcrumb back/clear, explicit Explorer handoff, markers on day grain, strict preset narrows results, and one panel erroring doesn't blank page
