# Executive Summary Aggregate API

## Why

The executive summary (landing) page currently fires 6 base API calls (`/v1/costs/summary`, `/v1/costs/timeseries`, 3× `/v1/costs/breakdown`, `/v1/costs/freshness`) plus up to 7 follow-up per-series `/v1/costs/timeseries` calls for the stacked chart — up to 13 HTTP round trips per filter change. This causes waterfall latency (the per-series calls can only start after breakdown returns), redundant ClickHouse query overhead, and chatty client code. A single aggregate endpoint returns everything the page needs in one round trip.

## What Changes

- New `GET /v1/costs/exec-summary` endpoint in the Go `cost-api` service that returns all landing-page data in one response: summary totals, monthly timeseries, cost-center breakdown, environment breakdown, top-N breakdown for the selected group dimension, per-top-N monthly series (for the stacked chart), and freshness.
- Endpoint accepts the same `CostQuery` filter params as existing endpoints plus `dimension` (group-by choice) and `top` (top-N size, default 7).
- Backend fans out the underlying ClickHouse queries concurrently server-side, eliminating the client-side waterfall.
- Angular `CostApiService` gains an `execSummary()` method; `SummaryComponent` replaces its `forkJoin` + nested per-name calls with the single call.
- Existing endpoints stay unchanged — no breaking changes; other pages keep using them.

## Capabilities

### New Capabilities
- `exec-summary-api`: Single aggregate endpoint returning all executive-summary page data (summary, timeseries, breakdowns, per-series timeseries, freshness) in one response.

### Modified Capabilities

<!-- none — existing endpoint requirements unchanged -->

## Impact

- `UI/cost-api/internal/httpapi/handler.go` (new route + handler), `internal/httpapi/routes.go`, `internal/cost/` (aggregate query orchestration), `openapi.yaml`.
- `UI/oci-finops-ui/src/app/core/cost-api.service.ts` (new method + response types), `src/app/core/api.types.ts`, `src/app/views/summary/summary.component.ts` (single-call data flow).
- No schema/DB changes; reuses existing ClickHouse queries.
- README API docs must document the new endpoint (per repo docs contract).
