## MODIFIED Requirements

### Requirement: Paginated resources table
`/resources` SHALL choose its rendering by inherited scope. When the user lands with a
resource scope in the query params (`resource_name` or `ocid`, i.e. drilled from the
Cost Explorer), it SHALL render the server-side paginated and sorted flat table from
`/v1/costs/resources` (page/limit/sort/direction params; `total` drives the pager;
columns include resource name, service, compartment, region, tags, currency, cost).
When the user lands directly with no resource scope, it SHALL render the grouped
resources table (see the `grouped-resource-table` capability) instead. Both renderings
SHALL be keyboard-navigable with visible focus.

#### Scenario: Server-side sort
- **WHEN** the user is on the flat (drilled-from-Explorer) table and sorts by cost descending
- **THEN** the endpoint is called with `sort=cost&direction=desc` and page resets to 1

#### Scenario: Pagination
- **WHEN** the user is on the flat table and moves to page 2
- **THEN** `page=2` is requested and the pager reflects `total`

#### Scenario: Direct landing renders grouped table
- **WHEN** the user navigates to `/resources` with no `resource_name` or `ocid` scope
- **THEN** the grouped resources table is rendered with group selectors and a search box

#### Scenario: Drilldown preserves the flat table
- **WHEN** the user arrives at `/resources` from an Explorer drilldown carrying `resource_name`
- **THEN** the existing flat paginated table is rendered, unchanged
