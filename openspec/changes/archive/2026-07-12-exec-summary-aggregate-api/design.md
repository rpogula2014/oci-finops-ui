# Design — exec-summary-aggregate-api

## Context

`SummaryComponent` (`UI/oci-finops-ui/src/app/views/summary/summary.component.ts`) uses `forkJoin` over 6 endpoints, then a second `forkJoin` of up to 7 per-name `timeseries` calls derived from the top-N breakdown — a two-stage client waterfall, up to 13 requests per filter/dimension change. Backend is Go stdlib mux (`UI/cost-api/internal/httpapi/handler.go`) over ClickHouse; all needed queries already exist in `internal/cost/`.

## Goals / Non-Goals

**Goals**
- One HTTP round trip per summary-page load / filter change.
- Server-side concurrency; latency ≈ slowest single query.
- Zero behavior change to existing endpoints and other pages.

**Non-Goals**
- No caching layer, no new ClickHouse SQL beyond reusing existing query functions.
- No GraphQL / generic batching endpoint — one purpose-built endpoint only (Rule 14: simplest thing that solves it).
- Other pages (resources, deep-dive) keep their existing calls.

## Decisions

1. **Purpose-built endpoint over generic batch API.** A `/v1/costs/batch` that proxies arbitrary sub-requests is more flexible but adds parsing/validation complexity and invites misuse. The summary page shape is stable; a dedicated `GET /v1/costs/exec-summary` is ~1 handler + 1 response struct.
2. **Reuse existing `internal/cost` query functions.** Handler composes them; no new SQL. Per-top-N series = same timeseries query with the dimension filter set, exactly mirroring what the UI does today — results stay byte-identical to current behavior.
3. **Concurrency via `errgroup`.** Base queries (summary, monthly, cost_centers, environments, top_breakdown) run in one errgroup wave; top-N names come from `top_breakdown`, then per-name series fan out in a second wave. Freshness runs alongside wave 1 but its error is swallowed (`freshness: null`) — matches current UI `catchError(() => of(null))`.
4. **Response shape mirrors UI needs, not envelope-of-envelopes.** Single envelope with `data: { summary: [...], monthly: [...], cost_centers: [...], environments: [...], top_breakdown: [...], top_series: [{name, rows}], freshness: {...}|null }`. UI unwraps once.
5. **Top-N selection server-side.** `top` param (default 7 = UI `TOP_N`, max 20). Currency filtering of top names stays client-side as today (UI picks display currency after receiving summary rows) — moving currency resolution server-side would change behavior and isn't needed for the round-trip win.

## Risks / Trade-offs

- [Response size grows with `top`] → cap `top` at 20; payload is small aggregates, not line items.
- [Duplicated shape knowledge between endpoint and page] → acceptable; endpoint is explicitly page-scoped and documented as such in openapi.yaml.
- [One slow section blocks whole response] → same worst-case as today's slowest client call, minus 12 round trips; freshness (the flakiest) is already best-effort.
- [UI regression risk when replacing forkJoin flow] → keep `summary-metrics.ts` builders untouched; component maps aggregate response into the exact same builder inputs.

## Migration Plan

1. Ship backend endpoint (additive, no risk).
2. Switch `SummaryComponent` to `execSummary()`; old endpoints untouched so instant rollback = revert UI commit.

## Open Questions

- None blocking. (If deep-dive page later wants the same, generalize then — not now.)
