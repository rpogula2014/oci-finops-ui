# landing-page-polish — design

## Context

`FiltersStore` is a root-provided signal store; `summary.component.ts` reads `filters.query()` and `filters.filter(key)()` directly, so Explorer's dimension filters silently reshape the landing page. The shell caps content at `--container-max: 1240px` (`styles.scss:21`, `app.ts:130`). Summary currently has one stacked chart + one breakdown list, while `execSummary`/`breakdown`/`timeseries` endpoints already return everything needed for two more panels.

## Goals / Non-Goals

**Goals:**
- Summary always shows full spend for the global range/currency; Explorer filters never leak in, Summary bar-click filters never leak out.
- Fluid content width up to 1800px.
- Two new Summary panels (by-service bars, daily run-rate line) with zero API changes.

**Non-Goals:**
- No backend/openapi changes.
- No change to Explorer or Resources filter behavior, URL sync, or drilldown.
- No per-view FiltersStore refactor beyond what Summary needs.

## Decisions

1. **Keep root `FiltersStore` as Explorer's store; give Summary local dimension filters.**
   - `FiltersStore` gains a `globalQuery` computed (`{start, end}` only, no dimension keys). Summary uses it as the base query.
   - Summary holds its own local dimension-filter signals (component-level) for bar-click filtering; merged into its requests locally.
   - Alternative considered: route-scoped `FiltersStore` instances (provide per view). Rejected — bigger blast radius; Explorer/Resources already share the root store and URL sync correctly.
2. **Summary stops writing to `FiltersStore.setFilter`** — bar clicks mutate the local signals; nothing appears in the URL, matching the delta spec.
3. **Layout: `--container-max: 1240px` → `1800px`** in `styles.scss`. Panels are already fluid inside the container; charts (ngx-echarts) resize on container resize. Verify KPI card row wraps gracefully (existing flex/grid).
4. **By-service panel** reuses the existing breakdown-bars building block with `dimension=service`, fixed (not tied to the group-by selector), same top-N + money formatting.
5. **Run-rate panel**: one `timeseries` call, day grain, range = 1st of previous month → now; client computes per-month cumulative sums aligned by day-of-month; previous month styled muted. Omit panel when current month has no rows (per spec).

## Risks / Trade-offs

- [Summary previously honored deep-linked dimension params] → Summary route stops hydrating dimension keys; acceptable, spec'd. Explorer deep links unaffected.
- [Wider container makes top-7 stacked bars look sparse] → charts are percentage-width; visual check in live-verification task.
- [Two extra HTTP calls on landing] → both hit existing cached-fast endpoints; acceptable.

## Migration Plan

Pure frontend; ship in one change. Rollback = revert commit.

## Open Questions

None.
