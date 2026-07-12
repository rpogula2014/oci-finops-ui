## Purpose
Per-resource cost list and detail views.
## Requirements
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

### Requirement: Resource detail
`/resources/:ocid` SHALL show the full field set from `/v1/costs/resources/{ocid}` (including description, compartment_id, availability_domain, first_seen, last_seen) plus a lineitems trend chart for that OCID with grain toggle.

#### Scenario: Detail load
- **WHEN** the user opens a resource row
- **THEN** the detail route loads the OCID's fields and its lineitems timeseries

#### Scenario: Unknown OCID
- **WHEN** the endpoint returns empty data or an error for the OCID
- **THEN** the page shows an explicit not-found/error state

### Requirement: Visible inherited scope
`/resources` SHALL render each active dimension filter (from URL params / shared
filter state, including scope inherited from an Explorer drilldown) as a dismissible
chip above the table, labelled `Dimension: value` via `DIMENSION_LABELS` and
`labelForFilterValue` (UI value `""` renders as "(untagged)"; the `__untagged__`
sentinel exists only at the HTTP layer). The `ocid` filter key SHALL NOT render a
chip. Dismissing a chip SHALL clear that filter, reset to page 1, re-query the
table, and remove the corresponding query param from the URL so the visible scope
stays deep-linkable. When no chip-eligible dimension filters are active, no chip
row is shown.

#### Scenario: Chips shown after drilldown
- **WHEN** the user arrives via Explorer drilldown with `compartment=prod&resource_name=boot volume`
- **THEN** chips "Compartment: prod" and "Resource Name: boot volume" appear above the table and the table lists only matching resources

#### Scenario: Untagged chip label
- **WHEN** the active `cost_center` filter value is `""`
- **THEN** the chip renders "Cost Center: (untagged)" and the query still sends the untagged sentinel to the API

#### Scenario: Chip dismissed
- **WHEN** the user dismisses the "Compartment: prod" chip
- **THEN** the `compartment` filter is cleared, the table re-queries at page 1, `compartment` is removed from the URL query params, and the remaining chips stay applied

### Requirement: Scope survives detail round-trip
Navigating from the resources list to `/resources/:ocid` SHALL carry the active
filter query params, and the detail page's "All resources" back link SHALL preserve
them, so the user returns to the same scoped (and deep-linkable) list. The detail
page SHALL hydrate the carried date and dimension filters and apply the resulting
query to both `/v1/costs/resources/{ocid}` and `/v1/costs/lineitems`, so displayed
cost and trend values honor the same Explorer scope.

#### Scenario: List to detail and back
- **WHEN** the user opens a resource row while `compartment=prod` is active and then clicks "‹ All resources"
- **THEN** both the detail URL and the restored list URL contain `compartment=prod` and the list shows the same scoped rows and chips

#### Scenario: Detail data honors inherited scope
- **WHEN** the detail URL carries an Explorer date range and `compartment=prod`
- **THEN** both the resource-detail request and lineitems request include that range and compartment filter

