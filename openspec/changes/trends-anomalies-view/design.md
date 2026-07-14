# Design: trends-anomalies-view

## Context

`views/trends/trends.component.ts` renders a single timeseries chart (grain toggle, stack-by via top-N breakdown + per-series timeseries). Backend added `/v1/costs/anomalies` and `/v1/costs/trends` (see proposal for shapes). `FiltersStore` already exposes signals for every shared filter key the new endpoints accept, plus `query()` (range + filters) and `granularity()`. Live measurements (2026-07-13): single call 350–550ms; 8 parallel calls serialize server-side to ~2.2s each, ~2.5s wall; `trends?dimension=resource_name` returns 200/empty body. Both backend issues are prerequisites owned in `oci-finops-api`.

## Goals / Non-Goals

**Goals:**
- Surface anomalies + movers with zero configuration (highlights), then let users drill by dimension.
- Reuse shared range/filters from `FiltersStore` so Trends stays consistent with Explorer/Resources.
- Degrade gracefully: any single panel failing or slow never blanks the page.

**Non-Goals:**
- No backend changes in this repo (prerequisites tracked in `oci-finops-api`).
- No client-side anomaly detection (superseded by server MAD z-score; old spec requirement removed).
- No persistence of sensitivity settings or anomaly acknowledgement/dismissal workflow.
- No summary-view anomaly banner (possible follow-up).

## Decisions

**D1 — Two-tier layout, one route.** Highlights and drilldown live on `/trends` as sibling sections, not separate routes. Rationale: highlights exist to *frame* the drilldown; a route split would lose the "investigate → preset drilldown" handoff. Alternative (tabs within Trends) rejected — hides highlights context while drilling.

**D2 — Highlights fan-out set is fixed**: anomalies+trends for `service`, `compartment`, `environment`; anomalies-only for `resource_name` (leaf attribution; its trends endpoint is broken and per-resource movers are noise at top level). 7 calls via `forkJoin`-per-panel, not one global join — each panel owns its `PanelState`. Alternative (backend `/highlights` endpoint) deferred: more API work, and clustering logic is cheap client-side over ≤100 rows.

**D3 — Event clustering is pure client code.** Group anomaly rows by `(currency, direction, day-adjacency)` on the primary dimension (service; compartment when service row absent), attach same-day rows from other dimensions as attribution context, collapse consecutive days into one event with day-span. Deterministic transform — no model/judgment (rows are pre-scored by the server).

**D4 — Sensitivity presets, not raw knobs.** `default` = API defaults (window 28, min_z 3, min_impact 50), `strict` = 28/5/200, `loose` = 14/2/10. Applied to both tiers. Raw params stay reachable only by URL editing — YAGNI on a knob UI.

**D5 — Drilldown focus is local, layered on the shared baseline.** The Trends shell owns a local ordered focus path of dimension/value pairs. Drilldown requests merge `filters.query()` with that path, with focus values winning on key collision; highlight requests use only `filters.query()`. Clicking a row extends focus and advances the picker to the next dimension in `DEFAULT_HIERARCHY` (skipping focused dimensions). The drilldown visibly renders the path with back-one-level and clear-focus actions. An explicit "Open in Cost Explorer" action alone copies the focus path into the Explorer's shared filter state. This preserves highlights as the stable reference that framed the investigation and prevents hidden cross-view mutations.

**D6 — Float costs bypass `parseCost`.** New types declare `cost: number` etc.; formatting via a small shared helper (or `Intl.NumberFormat` directly). `parseCost`/decimal-string pipeline untouched for ledger endpoints. Per-currency partitioning still applies: rows carry `currency`; panels render the foregrounded currency only.

**D7 — Anomaly chart overlay via `markPoint`.** Drilldown chart reuses the existing day-grain timeseries series and pins anomaly days with severity-colored markPoints (tooltip: cost vs baseline, z-score). Alternative (separate scatter series) rejected — markPoint keeps legend/tooltip wiring simple.

**D8 — Component split.** `trends.component.ts` becomes a thin shell; new `trends-highlights.component.ts` and `trends-drilldown.component.ts` children plus `core` additions (`anomalies()`, `trendMovers()` in `CostApiService`; row types in `api.types.ts`; clustering in a pure `views/trends/anomaly-events.ts` with unit tests).

**D9 — Reset is local to Trends.** A header action restores the local focus path, sensitivity, drill dimension, chart grain, and stack-by choice to their defaults. It intentionally preserves `FiltersStore` range and filters, the stable baseline shared with other views.

## Risks / Trade-offs

- [Backend contention not fixed before ship] → panels already load independently with skeletons; worst case highlights settle in ~2.5s while chart renders at ~400ms. UI works either way.
- [`resource_name` empty-body bug] → drilldown treats empty/invalid envelope as panel error, not crash; resource_name trends panel hidden until fixed.
- [Cross-dimension clustering mis-attributes when multiple independent events share a day+direction] → attribution shown as "seen at" context, phrased as correlation not causation; primary event keyed to the dimension row itself.
- [Focus differs from Explorer's shared filters] → scope is visibly labelled in Trends, and "Open in Cost Explorer" makes the cross-view handoff intentional.

## Open Questions

- None blocking. Follow-ups noted as non-goals (summary banner, sensitivity persistence).
