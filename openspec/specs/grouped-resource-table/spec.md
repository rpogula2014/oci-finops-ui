# grouped-resource-table Specification

## Purpose
TBD - created by archiving change add-grouped-resource-table. Update Purpose after archive.
## Requirements
### Requirement: Two-level grouping selectors
The grouped resources table SHALL provide two dimension selectors (Group, then) whose
options are the `GroupedResourceDimension` values (the resource dimensions plus
`period`, excluding `ocid`). Selecting a Group-1 dimension SHALL render top-level group
rows; selecting a Group-2 dimension SHALL make each group row expandable into sub-group
rows. Group-2 MAY be empty (single-level grouping). The two selectors MUST NOT hold the
same dimension; picking a value already selected in the other SHALL be prevented.

#### Scenario: Same dimension in both selectors prevented
- **WHEN** Group is `environment` and the user opens the "then" selector
- **THEN** `environment` is not offered (or is rejected) so `group1` and `group2` differ

#### Scenario: Single-level grouping
- **WHEN** the user picks Group `environment` and leaves the second selector empty
- **THEN** one row per environment is shown with its subtotal and row count, expandable directly to resource-month leaves

#### Scenario: Two-level grouping
- **WHEN** the user picks Group `environment` then `cost_center`
- **THEN** each environment row expands into cost-center sub-rows, each expandable to resource-month leaves

#### Scenario: Period as a group dimension
- **WHEN** the user picks Group `period`
- **THEN** rows are grouped by month bucket and each row's subtotal reflects that month's spend

### Requirement: Group subtotals and row counts
Every group and sub-group row SHALL display its cost subtotal and the count of
underlying resource-month rows. All spend is USD, so subtotals sum directly.
Subtotals SHALL reflect the full matching dataset for that group, not only the rows
currently expanded in the browser.

#### Scenario: Subtotal reflects untruncated group
- **WHEN** a group contains more rows than are rendered under it
- **THEN** the group subtotal and row count still reflect all matching rows in that group

### Requirement: Ordered top-N with truncation notice
Group and leaf rows SHALL be ordered by cost descending. When a group has more children
than the display cap, the table SHALL render the top-N and a synthetic remainder row
(`kind: 'other'`) carrying the aggregated cost and hidden count of the remainder,
mirroring the Cost Explorer tree-table. The remainder row's count SHALL equal the number
of hidden children, and the UI SHALL distinguish it by `kind` — never by matching the
literal value "Other".

#### Scenario: Truncated group shows Other row
- **WHEN** a group has more children than the display cap
- **THEN** the top-N children by cost are shown followed by an "Other (N)" row whose cost is the sum of the hidden children and whose N equals the hidden count

#### Scenario: Untruncated group has no Other row
- **WHEN** a group's child count is at or below the cap
- **THEN** all children are shown and no "Other" row appears

### Requirement: Server-side free-text search
The table SHALL provide a search box whose value is sent to the backend as `q`,
filtering the full dataset before grouping so subtotals and counts reflect matches.
`q` SHALL be a **case-insensitive substring** match (ClickHouse `ILIKE '%q%'`, or
`positionCaseInsensitive`) evaluated as an OR across these resource text columns:
resource name, OCID, service, compartment, region, resource type, environment,
cost center, and component type. A row matches if `q` is contained in any of them.
An empty or whitespace-only `q` SHALL return the unfiltered dataset. Input SHALL be
debounced. `q` SHALL be safely parameterized (no string interpolation into SQL).

#### Scenario: Search narrows the whole dataset
- **WHEN** the user types a term in the search box
- **THEN** `q=<term>` is requested and only resource-month rows whose resource name, OCID, service, compartment, region, resource type, environment, cost center, or component type contains the term (case-insensitively) contribute to groups, subtotals, and counts

#### Scenario: Case-insensitive match
- **WHEN** the user searches `TREADSY` and a resource name is `treadsy-app`
- **THEN** that row matches regardless of case

#### Scenario: Clearing search
- **WHEN** the user clears the search box
- **THEN** the request omits `q` and the full grouped dataset is shown again

### Requirement: Month-grain resource leaves
Leaf rows SHALL be resource-month rows showing period, environment, cost center,
component, compartment, service, resource type, resource name, OCID, and cost. A
resource active across multiple months in range SHALL appear once per month.

#### Scenario: Resource spanning months
- **WHEN** a resource has cost in two months within the active date range
- **THEN** two leaf rows appear for it, one per month, each with that month's cost

### Requirement: Lazy leaf expansion
Sub-groups and leaves SHALL be fetched on demand when a row is expanded, mirroring the
Cost Explorer tree-table, rather than loaded all at once.

#### Scenario: Expand fetches children
- **WHEN** the user expands a collapsed group row for the first time
- **THEN** its children are fetched from the backend scoped to that group's value(s)

### Requirement: Hide noise (zero-cost filter)
The table SHALL provide a toggle that hides rows whose cost is $0, mirroring the Cost
Explorer's "Show all / Hide noise" control. Filtering SHALL happen server-side (via the
`hide_zero` param) so subtotals, row counts, and the top-N selection reflect only
non-zero spend. The default state SHALL hide zero-cost rows.

#### Scenario: Noise hidden by default
- **WHEN** the grouped table first loads
- **THEN** `hide_zero=true` is requested and $0 groups/leaves are excluded

#### Scenario: Show all reveals zero-cost rows
- **WHEN** the user toggles to "Show all"
- **THEN** the request omits `hide_zero` and zero-cost rows reappear in groups, subtotals, and counts

### Requirement: CSV export
The table SHALL export the currently visible rows to CSV, including group path,
currency (USD), cost, and the leaf columns.

#### Scenario: Export visible rows
- **WHEN** the user clicks CSV export
- **THEN** a CSV of the currently visible group and leaf rows is downloaded

