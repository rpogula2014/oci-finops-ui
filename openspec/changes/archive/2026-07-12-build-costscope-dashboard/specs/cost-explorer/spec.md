## ADDED Requirements

### Requirement: Filter rail
The Explorer SHALL show a left rail with date range, grain toggle, and one filter control per dimension, populated from `/v1/costs/filters`. Filters apply globally via FiltersStore and are URL-reflected.

#### Scenario: Filter applied
- **WHEN** the user selects environment "dev"
- **THEN** the table refetches with `env=dev` and the URL contains the param

### Requirement: Breadcrumb group-by drilldown
The main panel SHALL show a breadcrumb trail plus a group-by table from `breakdown` for the selected dimension. Clicking a row pushes a crumb, adds that value as a filter, and prompts selection of the next group-by dimension. Crumbs can be popped to return to any prior level. The full drill state is deep-linkable.

#### Scenario: Drill down
- **WHEN** grouped by service and the user clicks the COMPUTE row
- **THEN** a "service: COMPUTE" crumb is pushed, `service=COMPUTE` is applied, and the user picks the next group-by dimension

#### Scenario: Crumb pop
- **WHEN** the user clicks an earlier crumb
- **THEN** later crumbs and their filters are removed and the table returns to that level

#### Scenario: Deepest drill
- **WHEN** group-by is Resource Name (or a row carries an OCID)
- **THEN** the row links to the Resource detail route

### Requirement: Node detail panel
Selecting a row SHALL populate a right panel with that node's cost, month-over-month delta, and lineitems stats (`my_cost`, `overage_items`, `line_items`) from `/v1/costs/lineitems`. Overage counts use the warning/red treatment.

#### Scenario: Node selected
- **WHEN** the user selects a resource-name row
- **THEN** the panel fetches lineitems for it and shows my_cost vs cost and overage item count

### Requirement: CSV export
A "CSV" action SHALL export the current group-by table (current filters, current level) as a client-generated CSV file.

#### Scenario: Export
- **WHEN** the user clicks CSV
- **THEN** a file downloads containing exactly the rows and columns currently displayed
