# Tasks — exec-summary-aggregate-api

## 1. Backend (UI/cost-api)

- [x] 1.1 Add exec-summary response types + orchestration in `internal/cost` (compose existing summary/timeseries/breakdown/freshness query funcs with errgroup; wave 1 = base queries + best-effort freshness, wave 2 = per-top-N series)
- [x] 1.2 Add `GET /v1/costs/exec-summary` handler in `internal/httpapi` (parse CostQuery params + `dimension` + `top`, validate dimension against allowed set, 400 on invalid, envelope response)
- [x] 1.3 Register route in `routes.go`
- [x] 1.4 Handler tests: happy path, invalid dimension → 400, freshness failure → 200 with `freshness: null` (build with `-tags clickhouse` per local-dev setup)
- [x] 1.5 Document endpoint in `openapi.yaml`

## 2. Frontend (UI/oci-finops-ui)

- [x] 2.1 Add `ExecSummary` response types to `src/app/core/api.types.ts`
- [x] 2.2 Add `execSummary(query, dimension, top)` to `CostApiService`
- [x] 2.3 Rewrite `SummaryComponent` data flow: replace forkJoin + nested per-name calls with single `execSummary()` call; map response into existing `buildStatCards` / `buildSpendOverTime` inputs unchanged
- [x] 2.4 Verify page in browser: stat cards, stacked chart, breakdown bars identical to before; one network request per filter/dimension change

## 3. Docs

- [x] 3.1 Update repo README API section: new endpoint (method, path, params, request/response sample, mermaid flow)
