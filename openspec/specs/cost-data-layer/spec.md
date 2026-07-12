## Requirements

### Requirement: Typed API client
A single `CostApiService` SHALL expose one typed method per endpoint (summary, timeseries, breakdown, resources, resource detail, lineitems, filters, freshness, healthz) against the envelope contract `{data, meta, error}`. `cost` and `my_cost` fields SHALL be typed as strings (decimal strings from the API) and parsed to number only at display/chart boundaries. Envelope `data` SHALL be typed as an object (not array) for `/freshness` and `/healthz`.

#### Scenario: Successful response
- **WHEN** an endpoint returns `{data: [...], error: null}`
- **THEN** the client emits the typed rows and pagination/freshness meta

#### Scenario: Zero-row list response
- **WHEN** a list endpoint returns `data: null` (how the API encodes zero rows)
- **THEN** the client unwraps it to an empty array, not an error; for object endpoints (/freshness) null remains an error

#### Scenario: Error envelope
- **WHEN** an endpoint returns `error.code` of VALIDATION_ERROR, UPSTREAM_ERROR, or UNHEALTHY
- **THEN** the client emits a typed ApiError carrying code and message, which panels render as an error banner

### Requirement: Shared filter state with URL sync
A `FiltersStore` (signals) SHALL hold start/end, granularity, and the 8 dimension filters (env, cost_center, component_type, compartment, service, resource_type, resource_name, ocid). Filter changes SHALL debounce 200ms and cancel in-flight requests via switchMap. Explorer state (filters + groupBy + drill crumbs) SHALL be reflected in the URL and hydrated from it on load.

#### Scenario: Rapid filter changes
- **WHEN** the user changes filters twice within 200ms
- **THEN** only one request is issued and any in-flight request is cancelled

#### Scenario: Deep link
- **WHEN** a user opens a URL containing filter and groupBy params
- **THEN** the store hydrates from the URL and the view renders that exact state

### Requirement: Per-currency partitioning
All aggregations SHALL be partitioned by `currency`. Amounts from different currencies SHALL never be summed or converted. KPI/chart components SHALL accept per-currency collections; when a single currency is present it renders plainly, otherwise a per-currency breakdown is shown.

#### Scenario: Multiple currencies in response
- **WHEN** a summary returns rows for USD and EUR
- **THEN** the KPI shows both amounts separately, never a combined total

### Requirement: Derived Daily/MTD/YTD metrics
Daily (start=today 00:00 with delta vs previous day), MTD (start=1st of month), and YTD (start=Jan 1) SHALL be computed client-side from `/v1/costs/summary` calls; the API has no MTD/YTD field.

#### Scenario: Daily delta
- **WHEN** today's and yesterday's summaries are loaded
- **THEN** the Daily card shows today's cost and the signed delta vs yesterday

### Requirement: Untagged value handling
Empty-string values returned by `/v1/costs/filters` SHALL be presented as "(untagged)" in dropdowns. Because the API ignores empty query params, the client SHALL translate a UI-side `""` filter value to the API sentinel `__untagged__` (which the API matches as dimension = '') on every request. Rows where the API returns `untagged · <product_description>` SHALL be rendered verbatim.

#### Scenario: Blank environment filter option
- **WHEN** the filters endpoint returns `""` in `environments`
- **THEN** the Environment dropdown shows "(untagged)" and selecting it sends `env=__untagged__`

#### Scenario: Untagged series is not the total
- **WHEN** a per-value timeseries is requested for the untagged bucket of a dimension
- **THEN** it returns only rows where that dimension is empty, never the unfiltered total

### Requirement: Currency row hygiene
Aggregation SHALL drop stray API rows having blank currency and zero cost; a blank-currency row with non-zero cost is kept and surfaced.

#### Scenario: Stray zero row
- **WHEN** a summary returns `[{currency:"USD",...}, {currency:"", cost:"0",...}]`
- **THEN** only the USD amount is shown

### Requirement: Panel states
Every data panel SHALL implement loading (skeleton), empty, and error (envelope banner) states via a shared mechanism.

#### Scenario: Empty result
- **WHEN** an endpoint returns `data: []`
- **THEN** the panel shows an explicit empty state, not a blank chart
