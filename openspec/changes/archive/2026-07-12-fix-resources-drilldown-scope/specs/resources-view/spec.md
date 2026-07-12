## ADDED Requirements

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
