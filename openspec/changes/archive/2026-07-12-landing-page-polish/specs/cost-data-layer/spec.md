## MODIFIED Requirements

### Requirement: Shared filter state with URL sync
A `FiltersStore` (signals) SHALL hold the global query context — start/end, granularity, and foreground currency — shared by all views. The 8 dimension filters (env, cost_center, component_type, compartment, service, resource_type, resource_name, ocid) SHALL be view-scoped: Explorer (and its Resources drilldown) share one filter scope; the Executive Summary has its own independent scope. Changing dimension filters in one scope MUST NOT affect the other. Filter changes SHALL debounce 200ms and cancel in-flight requests via switchMap. Explorer state (filters + groupBy + drill crumbs) SHALL be reflected in the URL and hydrated from it on load; Summary URLs SHALL NOT carry dimension filter params. The store SHALL expose both a dimension-filtered query and a global (context-only) query so views select the correct scope.

#### Scenario: Rapid filter changes
- **WHEN** the user changes filters twice within 200ms
- **THEN** only one request is issued and any in-flight request is cancelled

#### Scenario: Deep link
- **WHEN** a user opens a URL containing filter and groupBy params
- **THEN** the store hydrates from the URL and the view renders that exact state

#### Scenario: Explorer filters do not leak to Summary
- **WHEN** the user sets `cost_center=AI` in Explorer and navigates to Summary
- **THEN** Summary shows full spend for the selected date range, unaffected by the Explorer filter

#### Scenario: Global context stays shared
- **WHEN** the user changes the date range or currency in the top bar
- **THEN** both Summary and Explorer refetch with the new range/currency
