## ADDED Requirements

### Requirement: Independence from Explorer filters
The Executive Summary SHALL always reflect full spend for the global date range and currency. Dimension filters set in Cost Explorer MUST NOT affect any Summary panel. Filters applied inside Summary (bar clicks) are Summary-local and MUST NOT leak into Explorer.

#### Scenario: Filtered Explorer, clean Summary
- **WHEN** Explorer has `service=Compute` applied and the user navigates to Summary
- **THEN** all Summary cards and charts show unfiltered totals for the selected range

### Requirement: By service breakdown
The view SHALL render a second breakdown panel listing services as horizontal share bars with money values, using the breakdown endpoint with `dimension=service`, independent of the group-by selector. Clicking a service bar toggles a Summary-local `service` filter on the other panels, same interaction as the group-by bars.

#### Scenario: Service bars render
- **WHEN** the summary loads
- **THEN** a "By service" panel lists top services with share bars and money values alongside the group-by breakdown

### Requirement: Daily run-rate comparison
The view SHALL render a line chart comparing cumulative day-granularity spend for the current calendar month against the previous calendar month, aligned by day-of-month, using the timeseries endpoint. Values are money-formatted; the previous month renders as a muted reference line. The panel is omitted when no current-month data exists.

#### Scenario: Run-rate renders
- **WHEN** daily data exists for the current month
- **THEN** the chart shows the current month's cumulative spend line against the prior month's, aligned by day-of-month

## MODIFIED Requirements

### Requirement: By resource name
The view SHALL list resource names as horizontal share bars with money values. Clicking a bar toggles that value as a Summary-local `resource_name` filter, refreshing all Summary panels; clicking the active bar clears it. This filter SHALL NOT affect Explorer or other views.

#### Scenario: Bar click filters
- **WHEN** the user clicks "develop-datasvc"
- **THEN** resource_name=develop-datasvc is applied to Summary panels only and the bar shows the active state
