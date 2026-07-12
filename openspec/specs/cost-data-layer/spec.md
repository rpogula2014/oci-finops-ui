## Purpose
Client data layer for the cost API: typed service, shared filter state, currency and untagged-value handling.
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

The grouped resources endpoint (`/v1/costs/resources/grouped`) is single-currency by construction: it SHALL validate/filter `currency = 'USD'` so its aggregations contain exactly one currency and render plainly. It therefore does not carry a `currency` scoping parameter on expansion. This is a per-endpoint constraint, not a global change — other endpoints continue to partition by `currency`.

#### Scenario: Multiple currencies in response
- **WHEN** a summary returns rows for USD and EUR
- **THEN** the KPI shows both amounts separately, never a combined total

#### Scenario: Grouped resources endpoint constrained to USD
- **WHEN** the grouped resources endpoint aggregates
- **THEN** only `currency = 'USD'` rows are included, so every group has a single currency and no cross-currency sum can occur

### Requirement: Derived Daily/MTD/YTD metrics
Daily (start=today 00:00 with delta vs previous day), MTD (start=1st of month), and YTD (start=Jan 1) SHALL be computed client-side from `/v1/costs/summary` calls; the API has no MTD/YTD field.

#### Scenario: Daily delta
- **WHEN** today's and yesterday's summaries are loaded
- **THEN** the Daily card shows today's cost and the signed delta vs yesterday

### Requirement: Untagged value handling
Empty-string values returned by `/v1/costs/filters` SHALL be presented as "(untagged)" in dropdowns. Because the API ignores empty query params, the client SHALL translate a UI-side `""` filter value to the API sentinel `__untagged__` (which the API matches as dimension = '') on every request. Composite untagged labels returned by the API SHALL be rendered verbatim.

The `resource_name` dimension is an exception: the API SHALL resolve it as
`untagged · <product_service> · …<OCID tail>` whenever the resource-name tag is
empty — consistently across breakdown values, filter options, filter matching,
and the resources/detail queries — so `resource_name` never surfaces as `""`.
The composite label is a first-class filterable value: sending it back verbatim
as `resource_name` selects exactly the rows it aggregated. The `__untagged__`
sentinel therefore no longer applies to `resource_name` (the client has no `""`
value to translate).

`product_service` is used (not `product_description`, which is a SKU/charge
description with several values per OCID) because it is 1:1 per resource; the
OCID tail disambiguates resources sharing a service. A resource billed under
multiple services (observed only for tenancy-level charges on the tenancy OCID)
MAY appear as one bucket per service.

#### Scenario: Blank environment filter option
- **WHEN** the filters endpoint returns `""` in `environments`
- **THEN** the Environment dropdown shows "(untagged)" and selecting it sends `env=__untagged__`

#### Scenario: Untagged series is not the total
- **WHEN** a per-value timeseries is requested for the untagged bucket of a dimension
- **THEN** it returns only rows where that dimension is empty, never the unfiltered total

#### Scenario: Untagged resource name in breakdown
- **WHEN** breakdown by `resource_name` includes rows whose resource-name tag is empty
- **THEN** those rows return `untagged · <product_service> · …<OCID tail>` as the dimension value (one row per resource), not `""`

#### Scenario: Composite resource name round-trips as a filter
- **WHEN** the client sends a composite untagged `resource_name` value verbatim
- **THEN** the API matches exactly the rows aggregated under that breakdown value

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

### Requirement: Grouped resource dimension vocabulary
A `GroupedResourceDimension` type SHALL define the dimensions valid for grouping:
`service`, `compartment`, `environment`, `cost_center`, `component_type`,
`resource_type`, `resource_name`, and `period`. It SHALL match the existing
`Dimension` union plus `period` and MUST exclude `ocid` (OCID is a leaf-only column,
never a group key). `group1` SHALL be one of these; `group2` SHALL be one of these or
absent; `group1` and `group2` MUST NOT be equal.

#### Scenario: Duplicate grouping dimensions rejected
- **WHEN** `groupedResources` is called with `group1=environment` and `group2=environment`
- **THEN** the call is rejected as invalid before any request is made

#### Scenario: OCID is not a group dimension
- **WHEN** grouping options are offered
- **THEN** `ocid` is absent from the selectable dimensions, while `period` is present

### Requirement: Grouped resources endpoint
The API client SHALL expose a `groupedResources` call backed by
`GET /v1/costs/resources/grouped`, accepting the standard `CostQuery` filter/date scope
plus `group1` (required `GroupedResourceDimension`), `group2` (optional
`GroupedResourceDimension`), `group1_value` / `group2_value` (optional parent scoping
for lazy expansion — see below), `q` (optional free-text search), `hide_zero` (optional
boolean; when true drops $0 groups/leaves), and `grain=month`.
The endpoint SHALL be additive and MUST NOT alter `/v1/costs/resources`.

The endpoint SHALL validate/filter to a single currency (USD): the ClickHouse query
SHALL constrain the physical column `cost_currencycode = 'USD'` so non-USD rows can
never enter an aggregation. This keeps it compliant with `Per-currency partitioning`
(a single-currency dataset renders
plainly) while avoiding per-currency scoping. Every row still carries a `currency` field
(USD) for display/CSV parity with other endpoints; there is exactly one currency per
group and no `currency` param on expansion.

Responses use the envelope `{data, meta, error}` with rows typed as
`GroupedResourceRow`, a discriminated union on a `kind` field with values `group`,
`leaf`, and `other`. A `group` row exposes `kind`, `depth`, `group_value`, `currency`,
`subtotal_cost` (decimal string), and `row_count`. An `other` row has the same shape as
a `group` row but `kind: 'other'`, is terminal (not expandable), and its `row_count` is
the count of hidden children. A `leaf` row exposes `kind`, the full resource columns
(service, compartment, environment, cost_center, component_type, resource_type,
resource_name, ocid), `period`, `currency`, and `cost` (decimal string). Costs SHALL
remain decimal strings, parsed only at display.

#### Scenario: Group-1 request
- **WHEN** `groupedResources` is called with `group1=environment` and no `group2`
- **THEN** `GET /v1/costs/resources/grouped?group1=environment&grain=month` is requested and top-level group rows — each with `currency`, `subtotal_cost`, and `row_count` — are returned

#### Scenario: Second-level expansion scopes to the parent group value
- **WHEN** the `environment=dev` group is expanded with `group2=cost_center`
- **THEN** the request carries `group1=environment&group1_value=dev&group2=cost_center` and cost-center sub-group rows for `dev` are returned

#### Scenario: Leaf expansion scopes to both parent group values
- **WHEN** a `cost_center` sub-group under `environment=dev` is expanded to leaves
- **THEN** the request carries `group1_value=dev&group2_value=<cost_center>` and month-grain leaf rows for that scope are returned

#### Scenario: Period expansion scopes by period value
- **WHEN** `group1=period` and a month row (e.g. `2026-07`) is expanded
- **THEN** the request carries `group1=period&group1_value=2026-07` and children scoped to that month are returned (period is scoped via `group1_value`/`group2_value`, not a `CostQuery` filter)

#### Scenario: Search parameter
- **WHEN** `groupedResources` is called with a non-empty `q`
- **THEN** `q` is sent to the backend and only matching resource-month rows contribute to the grouped result

#### Scenario: Untagged and unfiltered semantics preserved
- **WHEN** a group's value is empty-tag
- **THEN** the `"__untagged__"` sentinel is used for that value in `group1_value`/`group2_value` and `""` remains unfiltered, consistent with other endpoints

#### Scenario: Untagged resources collapse into one group
- **WHEN** grouping by `resource_name` and some resources have no `ResourceName` tag
- **THEN** they form a single empty-valued `(untagged)` group (not one group per resource/OCID), and expanding it (via the `"__untagged__"` sentinel) returns those resources' leaves

