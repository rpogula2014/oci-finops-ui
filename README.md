# CostScope — OCI FinOps Dashboard

Read-only Angular dashboard over the CostScope Cost API (ClickHouse view of attributed OCI cost).

## Quickstart

```bash
npm install
npm start          # ng serve with /v1 + /healthz proxied to http://localhost:8080
npm test           # vitest unit tests
npm run build      # production build to dist/
```

Requires the cost-api running locally: `go run -tags clickhouse ./cmd/cost-api` from `../cost-api` with ClickHouse env loaded (see that repo's `.env.example`).

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
    explorer/            # Cost Explorer: filter rail, breadcrumb drilldown, node detail, CSV
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

Explorer state (filters, group-by, drill crumbs) is fully URL-encoded — deep-linkable, e.g.
`/explorer?service=COMPUTE&groupBy=compartment&drill=service~COMPUTE&grain=day`.

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
