# Design — redesign-cost-explorer

## Context

Explorer today is one 16K standalone component (`views/explorer/explorer.component.ts`):
left filter rail, breadcrumb drill (each drill refetches `breakdown` and replaces the
table), right node-detail panel. All HTTP goes through `core/cost-api.service.ts`
(`breakdown(query, dimension, limit)`, `lineItems`, `timeseries`, `filters`); shared
filter state in `core/filters-store.ts` (signals, URL-reflected).

## Goals / Non-Goals

**Goals:**
- In-place tree drill: whole hierarchy visible, no context loss.
- User-selected drill hierarchy, URL-persisted.
- Top filter bar + client-side free-text search.
- Per-row share bars, sparklines, noise suppression ("Other" bucket, zero-row hiding).

**Non-Goals:**
- No changes to summary/trends/resources views.
- No server-side search or new aggregation semantics.
- No virtual scrolling in v1 (levels are capped by top-N + Other).

## Decisions

1. **Tree data model in the component, not the store.** A flat array of
   `TreeRow {path: string[], depth, dim, value, cost, share, series?, expanded, children?}`
   rendered with `@for` + indentation. Angular has no native tree table; a flat
   projected list is simpler than recursive components and makes search/CSV trivial.
   FiltersStore keeps only global filters + hierarchy + search text (URL-reflected).

2. **Lazy children via existing `breakdown`.** Expanding a row calls
   `breakdown(query + ancestor filters, nextDimension, limit)`. No new endpoint needed
   for drilling. Children cached on the row; collapse keeps cache.

3. **Sparklines via additive `series` param on breakdown** —
   `GET /v1/costs/breakdown?...&series=true` returns each row with an optional
   `series: [{date, cost}]` at the request grain. One batched call per level instead of
   N `timeseries` calls per visible row. Additive change to the Go API (openapi.yaml +
   README updated in same change). Fallback if backend lands later: render tree without
   sparklines when `series` absent.
   - Rejected: N× `/v1/costs/timeseries` per row (request storm), client cache of a
     full-cube query (payload size).

4. **Cascading filters via filtered `/v1/costs/filters`.** Additive backend change:
   the filters endpoint accepts the same filter params as other endpoints and returns
   distinct values under those constraints. The UI fetches options for dropdown *i*
   with the selections of dropdowns 0..i-1 applied (left-to-right dependency, matching
   the bar order Environment → … → Resource Name). One debounced refetch per upstream
   change; downstream selections not present in the new option set reset to "All".
   - Rejected: client-side faceting from a full value-combination dump (payload grows
     with resource count) and full bidirectional faceting (harder to reason about;
     left-to-right matches the user's mental model).

5. **Hierarchy picker** = ordered multi-select chips above the tree (defaults
   `compartment → cost_center → component_type → resource_type → resource_name`), stored as
   `hier=compartment,cost_center,component_type,resource_type,resource_name`
   in URL. Changing it resets expansion.

6. **Search ("Name contains") is client-side** over already-loaded rows: substring match on `value`,
   ancestors of matches stay visible. It does not auto-expand unloaded branches (would
   require server search — non-goal).

7. **Noise suppression in the component:** drop `cost == 0` rows (decimal-string compare
   via existing `currency.ts` helpers — never parseFloat for equality); keep top-15 per
   level, remainder into synthetic `Other (n)` row whose children are the hidden rows.
   "Show all" toggle in the tree header.

8. **Component split** (new files under `views/explorer/`): `explorer.component.ts`
   (orchestration + detail panel), `filter-bar.component.ts`, `tree-table.component.ts`,
   plus `shared/sparkline.component.ts` (tiny inline SVG — echarts per row is too heavy)
   and a share-bar rendered as a CSS gradient cell. All standalone, OnPush, signals.

9. **Deep link shape:** `?hier=a,b,c&open=COMPUTE|prod-comp&sel=...` plus existing filter
   params. `open` is the expanded path list (pipe-joined values, comma-separated paths);
   restore expands lazily on load.

## Risks / Trade-offs

- **`series=true` backend dependency** — UI degrades gracefully (no sparklines) if the
  API change ships separately; tasks order backend first.
- **Breakdown fan-out on deep restore** — restoring many `open` paths issues one request
  per expanded node; acceptable at top-15/level, capped by URL length in practice.
- **Client-side search only sees loaded rows** — documented in UI placeholder
  ("search loaded rows"); acceptable for v1.
- **Removing breadcrumb changes muscle memory** — mitigated: ancestor path shown in the
  detail panel header and rows keep the Resource-detail link at the deepest level.
