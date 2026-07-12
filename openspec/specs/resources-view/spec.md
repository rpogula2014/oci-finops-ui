## Requirements

### Requirement: Paginated resources table
`/resources` SHALL render a server-side paginated and sorted table from `/v1/costs/resources` (page/limit/sort/direction params; `total` drives the pager). Columns include resource name, service, compartment, region, tags, currency, cost. Table SHALL be keyboard-navigable with visible focus.

#### Scenario: Server-side sort
- **WHEN** the user sorts by cost descending
- **THEN** the endpoint is called with `sort=cost&direction=desc` and page resets to 1

#### Scenario: Pagination
- **WHEN** the user moves to page 2
- **THEN** `page=2` is requested and the pager reflects `total`

### Requirement: Resource detail
`/resources/:ocid` SHALL show the full field set from `/v1/costs/resources/{ocid}` (including description, compartment_id, availability_domain, first_seen, last_seen) plus a lineitems trend chart for that OCID with grain toggle.

#### Scenario: Detail load
- **WHEN** the user opens a resource row
- **THEN** the detail route loads the OCID's fields and its lineitems timeseries

#### Scenario: Unknown OCID
- **WHEN** the endpoint returns empty data or an error for the OCID
- **THEN** the page shows an explicit not-found/error state
