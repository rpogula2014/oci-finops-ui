# cost-explorer delta — redesign-cost-explorer

## MODIFIED Requirements

### Requirement: Filter rail
The Explorer SHALL show a compact top filter bar (replacing the left rail): one
horizontal row of dropdowns in fixed order — Environment, Cost Center, Component,
Compartment, Service, Resource Type, Resource Name — followed by a "Name contains"
free-text input, with date range and grain controls adjacent. Filters apply globally
via FiltersStore and are URL-reflected. "Name contains" filters the visible tree rows
client-side by substring match on the row label (case-insensitive) and keeps matching
rows' ancestors visible.

Dropdown options SHALL cascade left to right: each dropdown offers only values valid
under the selections of the dropdowns to its left (from `/v1/costs/filters` with those
selections applied). When an upstream selection changes, downstream selections that are
no longer valid SHALL be cleared to "All".

#### Scenario: Filter applied
- **WHEN** the user selects environment "dev" in the top bar
- **THEN** the tree refetches with `env=dev` and the URL contains the param

#### Scenario: Cascading options
- **WHEN** the user selects environment "prod"
- **THEN** the Cost Center, Component, Compartment, Service, Resource Type, and Resource Name dropdowns only list values that occur under environment "prod"

#### Scenario: Invalid downstream selection cleared
- **WHEN** service "COMPUTE" is selected and the user changes environment to one with no COMPUTE costs
- **THEN** the Service selection resets to "All" and the tree refetches accordingly

#### Scenario: Free-text search
- **WHEN** the user types "prod" in the "Name contains" box
- **THEN** only tree rows whose label contains "prod" (and their ancestors) remain visible, without refetching

### Requirement: Breadcrumb group-by drilldown
The main panel SHALL show a hierarchical tree table driven by a user-selected ordered
hierarchy of dimensions (default: Compartment → Cost Center → Component Type → Resource Type → Resource Name). Each row can
expand in place to show its children grouped by the next dimension in the hierarchy,
fetched lazily from `breakdown` with the parent values applied as filters. Expanded
state does not discard sibling or ancestor rows. The hierarchy selection and expanded
path are deep-linkable via URL.

#### Scenario: Expand a row
- **WHEN** the hierarchy is Service → Compartment and the user expands the COMPUTE row
- **THEN** child rows grouped by compartment with `service=COMPUTE` applied appear indented under COMPUTE, and other service rows remain visible

#### Scenario: Change hierarchy
- **WHEN** the user reorders the hierarchy to Compartment → Service
- **THEN** the tree resets to top-level rows grouped by compartment and the URL reflects the new hierarchy

#### Scenario: Deepest drill
- **WHEN** a row is at the last hierarchy level and carries an OCID or Resource Name
- **THEN** the row links to the Resource detail route

### Requirement: Node detail panel
Selecting any tree row SHALL populate a right panel with that node's cost,
month-over-month delta, and lineitems stats (`my_cost`, `overage_items`, `line_items`)
from `/v1/costs/lineitems`, scoped by the row's ancestor values plus global filters.
Overage counts use the warning/red treatment.

#### Scenario: Node selected
- **WHEN** the user selects a nested resource-name row under COMPUTE
- **THEN** the panel fetches lineitems scoped to that resource with `service=COMPUTE` applied and shows my_cost vs cost and overage item count

### Requirement: CSV export
A "CSV" action SHALL export the currently visible tree (current filters, expanded rows,
search applied) as a client-generated CSV file including a depth/path column.

#### Scenario: Export
- **WHEN** the user clicks CSV with COMPUTE expanded
- **THEN** a file downloads containing exactly the visible rows, each with its hierarchy path, cost, and share columns

## ADDED Requirements

### Requirement: Row proportion and trend presentation
Every tree row SHALL show its share of the parent (top-level rows: share of total) as a
percentage with an inline cost bar, and a sparkline of its cost over the selected date
range at the current grain.

#### Scenario: Share rendering
- **WHEN** COMPUTE is 39,957.95 USD of a 88,266 USD total
- **THEN** its row shows ~45% with a proportionally filled bar

#### Scenario: Sparkline
- **WHEN** a row is visible and grain is "day"
- **THEN** the row shows a small line of its daily cost across the selected range

### Requirement: Noise suppression
Zero-cost rows SHALL be hidden by default, and rows beyond the top N per level (or below
a small share threshold) SHALL be collapsed into a single expandable "Other" bucket
whose cost is the sum of its members. A visible toggle SHALL reveal all rows.

#### Scenario: Zero rows hidden
- **WHEN** a level contains rows with 0.00 cost
- **THEN** those rows are not shown unless "show all" is enabled

#### Scenario: Other bucket
- **WHEN** a level has 30 rows and the tail beyond the top 15 sums to 12.40 USD
- **THEN** a single "Other (15)" row showing 12.40 USD appears and expands to the hidden rows
