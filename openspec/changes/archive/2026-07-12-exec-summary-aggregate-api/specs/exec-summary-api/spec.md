# exec-summary-api

## ADDED Requirements

### Requirement: Aggregate executive-summary endpoint
The cost-api service SHALL expose `GET /v1/costs/exec-summary` returning, in a single envelope response, all data required by the executive summary page: summary totals, monthly timeseries, cost-center breakdown, environment breakdown, top-N breakdown for the requested group dimension, per-top-N-value monthly timeseries, and data freshness.

#### Scenario: Single call returns full page payload
- **WHEN** a client calls `GET /v1/costs/exec-summary?dimension=cost_center&top=7` with optional filter params
- **THEN** the response `data` object contains `summary`, `monthly`, `cost_centers`, `environments`, `top_breakdown`, `top_series` (one monthly series per top-N dimension value), and `freshness` fields in one HTTP response

### Requirement: Same filter semantics as existing endpoints
The endpoint SHALL accept the same `CostQuery` filter parameters as `/v1/costs/summary` (start, end, compartment, cost_center, environment, service, etc.), including the `__untagged__` sentinel, plus `dimension` (one of the supported group dimensions, default `cost_center`) and `top` (1–20, default 7).

#### Scenario: Filters applied consistently across sections
- **WHEN** the client passes filter params
- **THEN** every section of the response reflects the same filtered data set as the equivalent individual endpoint calls would return

#### Scenario: Invalid dimension rejected
- **WHEN** `dimension` is not a supported group dimension
- **THEN** the API responds with a 400 envelope error

### Requirement: Concurrent server-side execution
The handler SHALL run the underlying data queries concurrently and MUST NOT serialize the per-top-N series queries behind a client round trip.

#### Scenario: Latency bounded by slowest query
- **WHEN** the aggregate endpoint executes
- **THEN** total response time is approximately the slowest single underlying query, not the sum of all queries

### Requirement: Partial-failure behavior
Freshness SHALL be best-effort: if the freshness query fails, the endpoint SHALL still return the rest of the payload with `freshness: null`. Failure of any other section SHALL fail the whole request with an envelope error.

#### Scenario: Freshness query fails
- **WHEN** the freshness lookup errors
- **THEN** the response is still 200 with `freshness: null` and all other sections populated

### Requirement: Executive summary page uses single call
The Angular executive summary page SHALL fetch its data via one `execSummary()` call instead of separate summary/timeseries/breakdown/freshness/per-series calls.

#### Scenario: One request per filter change
- **WHEN** the user changes filters or the group dimension on the summary page
- **THEN** exactly one request to `/v1/costs/exec-summary` is issued (after debounce) and the page renders from its response
