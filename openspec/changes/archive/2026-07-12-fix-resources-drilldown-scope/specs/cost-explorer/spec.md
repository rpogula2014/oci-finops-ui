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

The bar SHALL include a "Clear filters" button next to "Reset hierarchy" that resets
every dimension filter to "All", empties the "Name contains" input, and clears the
tree selection (`sel` URL param and detail panel) in one click. Expansion state
(`open`), date range, grain, and hierarchy are unaffected. The button SHALL be
disabled when no dimension filter or search text is active.

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

#### Scenario: Clear all filters
- **WHEN** environment "prod" and service "COMPUTE" are selected with search text "vm" and the user clicks "Clear filters"
- **THEN** all dropdowns reset to "All", the search box empties, the tree refetches unfiltered, the selection and detail panel clear (`sel` dropped from the URL), filter params drop from the URL, and date range, grain, hierarchy, and expanded paths stay unchanged

### Requirement: Breadcrumb group-by drilldown
The main panel SHALL show a hierarchical tree table driven by a user-selected ordered
hierarchy of dimensions (default: Compartment → Cost Center → Component Type → Resource Type → Resource Name). Each row can
expand in place to show its children grouped by the next dimension in the hierarchy,
fetched lazily from `breakdown` with the parent values applied as filters. Expanded
state does not discard sibling or ancestor rows. The hierarchy selection and expanded
path are deep-linkable via URL. Any navigation from a tree row to the Resources view
(row-level "Resources ›" button or detail-panel link) SHALL carry the row's full
scope as query params: date range and granularity, global dimension filters, every
ancestor dimension value, and the row's own dimension value — the same merged query
the node detail panel uses. Explorer-only URL state (`hier`, `open`, `sel`,
`search`) SHALL NOT be included in the Resources navigation.

#### Scenario: Expand a row
- **WHEN** the hierarchy is Service → Compartment and the user expands the COMPUTE row
- **THEN** child rows grouped by compartment with `service=COMPUTE` applied appear indented under COMPUTE, and other service rows remain visible

#### Scenario: Change hierarchy
- **WHEN** the user reorders the hierarchy to Compartment → Service
- **THEN** the tree resets to top-level rows grouped by compartment and the URL reflects the new hierarchy

#### Scenario: Deepest drill
- **WHEN** a row is at the last hierarchy level and carries an OCID or Resource Name
- **THEN** the row links to the Resource detail route

#### Scenario: Untagged resource name shows service and OCID tail
- **WHEN** a resource-name level row aggregates line items whose resource-name tag is empty
- **THEN** the row label reads `untagged · <product_service> · …<OCID tail>` (one row per resource), not "(untagged)", and expanding or drilling that row filters by the composite value

#### Scenario: Drilldown carries ancestor scope
- **WHEN** the hierarchy is Compartment → Resource Name, the user expands `compartment=prod`, and clicks "Resources ›" on the `boot volume` row
- **THEN** the Resources route query params include `compartment=prod` and `resource_name=boot volume` (plus date range, grain, and any global dimension filters) and exclude `hier`/`open`/`sel`/`search`, so resources named `boot volume` in other compartments are excluded
