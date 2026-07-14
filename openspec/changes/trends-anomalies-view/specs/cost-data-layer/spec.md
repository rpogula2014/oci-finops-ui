# cost-data-layer (delta)

## ADDED Requirements

### Requirement: Anomalies and trend-movers API methods
`CostApiService` SHALL expose `anomalies(query, dimension, opts)` and `trendMovers(query, dimension, opts)` wrapping `GET /v1/costs/anomalies` and `GET /v1/costs/trends`, carrying the shared range and dimension filters as query params, with `opts` covering `window`/`min_z`/`min_impact` (anomalies) and `granularity` (trends). Response row types (`AnomalyRow`, `TrendMoverRow`) SHALL be declared in `api.types.ts` with numeric cost fields, and errors SHALL surface through the existing envelope `ApiError` path.

#### Scenario: Filters forwarded
- **WHEN** the caller passes a query with service=COMPUTE and env=prod
- **THEN** the request URL carries service and env params alongside dimension and range

#### Scenario: Empty body treated as error
- **WHEN** the API returns 200 with an empty or non-envelope body
- **THEN** the observable errors with an `ApiError` instead of emitting undefined rows
