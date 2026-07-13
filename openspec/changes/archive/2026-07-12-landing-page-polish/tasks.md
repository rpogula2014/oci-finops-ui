# landing-page-polish — tasks

## 1. Filter scoping

- [x] 1.1 Add `globalQuery` computed to `core/filters-store.ts` ({start, end} only) with unit test asserting dimension filters are excluded
- [x] 1.2 Move Summary to local dimension-filter signals: replace `filters.query()`/`filters.filter()`/`filters.setFilter()` usage in `views/summary/summary.component.ts` with `globalQuery` + component-local filter signals; stop hydrating dimension keys on the Summary route
- [x] 1.3 Update/extend `filters-store.spec.ts` and summary tests: Explorer filter set → Summary query unaffected; Summary bar click → FiltersStore untouched

## 2. Fluid layout

- [x] 2.1 Change `--container-max` from 1240px to 1800px in `src/styles.scss`; verify KPI card row and panels flow correctly at wide widths (adjust grid/flex wrap if needed)

## 3. New Summary panels

- [x] 3.1 Add "By service" breakdown panel to Summary (breakdown endpoint, `dimension=service`, fixed top-N share bars, Summary-local `service` filter on click), reusing the existing bars building block
- [x] 3.2 Add daily run-rate panel: `timeseries` day-grain call for prev-month-start → now; compute cumulative per month aligned by day-of-month in `summary-metrics.ts` (with unit test); render current vs muted previous line; omit panel when current month empty
- [x] 3.3 Loading/empty/error states for both new panels per panel-state convention

## 4. Verification & docs

- [x] 4.1 `npm run build` + `npm test` pass
- [x] 4.2 Live-verify against running cost-api: filter in Explorer → Summary unaffected; Summary bar click filters Summary only; 90% zoom shows no dead space; both new charts render with real data
- [x] 4.3 Update `openspec/specs/` deltas on archive (cost-data-layer, executive-summary, app-shell)
