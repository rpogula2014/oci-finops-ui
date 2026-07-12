# CostScope — OCI FinOps Dashboard

Read-only Angular dashboard over the CostScope Cost API (ClickHouse view of attributed OCI cost).

## Quickstart

Via [mise](https://mise.jdx.dev) (pins Node 22, wires up the sibling API):

```bash
mise install       # Node 22 for this repo, Go 1.25 for ../oci-finops-api
mise run dev       # ng serve + cost-api together, output interleaved
```

Or run each piece on its own:

```bash
mise run start     # ng serve with /v1 + /healthz proxied to http://localhost:8080
mise run api       # cost-api from ../oci-finops-api (needs its .env, see that repo's README)
mise run test      # vitest unit tests
mise run build     # production build to dist/
```

Without mise:

```bash
npm install
npm start          # ng serve with /v1 + /healthz proxied to http://localhost:8080
npm test           # vitest unit tests
npm run build      # production build to dist/
```

Requires the cost-api running locally: `go run -tags clickhouse ./cmd/cost-api` from `../oci-finops-api` with ClickHouse env loaded (see that repo's `.env.example`).

## Folder structure

```
src/app/
  core/                  # data layer
    api.types.ts         # envelope + row types (cost = decimal string), ApiError
    cost-api.service.ts  # typed method per endpoint, envelope unwrap at one seam
    filters-store.ts     # signal store: date range, grain, 8 dimension filters, URL sync
    currency.ts          # parseCost, partitionByCurrency (never sums across currencies)
    derived-metrics.service.ts  # client-side Daily/MTD/YTD (API has no such fields)
  shared/
    money.pipe.ts        # "39,873.68 USD" formatting
    panel-state.component.ts    # loading / empty / envelope-error wrapper for every panel
    chart-theme.ts       # ATD blue ramp; red reserved for overage + hero KPI
  views/
    summary/             # Executive Summary: KPI band, trend, breakdowns, tag small multiples
    explorer/            # Cost Explorer: cascading top filters, hierarchy tree, node detail, CSV
    resources/           # paginated table + /resources/:ocid detail with lineitems trend
    trends/              # timeseries with grain toggle + stack-by-dimension
  app.ts                 # shell: top bar (freshness, date range, currency), left nav
```

## Routes

| Route | View | Data |
|---|---|---|
| `/summary` (default) | Executive Summary | summary ×4 (derived KPIs), timeseries, breakdown ×7 |
| `/explorer` | Cost Explorer | filters, breakdown, summary (MoM), lineitems |
| `/resources` | Resources table | resources (server-side page/sort) |
| `/resources/:ocid` | Resource detail | resources/{ocid}, lineitems |
| `/trends` | Trends | timeseries (+ breakdown for top-N stacking) |

Explorer state (filters, hierarchy, expanded paths, selected node, and search text) is fully URL-encoded — deep-linkable, e.g.
`/explorer?service=COMPUTE&hier=service,compartment,resource_name&open=COMPUTE&grain=day`.

## API contract notes (verified live)

- Envelope `{data, meta, error}`; `error.code` ∈ `VALIDATION_ERROR | UPSTREAM_ERROR | UNHEALTHY`.
- `cost` / `my_cost` are **decimal strings** — parsed only at display/chart boundary.
- Zero-row list responses return `data: null` — the client unwraps to `[]`.
- `/filters` arrays contain `""` (untagged) — shown as "(untagged)", sent verbatim.
- One row **per currency**; amounts are never summed or converted across currencies.
- Stray rows with blank currency and zero cost are dropped by `partitionByCurrency`.
- Max date range 400 days (client clamps).

## Environment

No UI env vars. API base URL defaults to same-origin (dev proxy in `proxy.conf.json`); override by providing `API_BASE_URL` (see `cost-api.service.ts`) at bootstrap for non-proxied deployments.
