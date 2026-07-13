## Purpose
Executive summary landing view: headline KPIs and a group-by cost breakdown.

## Requirements

### Requirement: Group-by selector
The landing page SHALL offer a group-by dimension selector (Resource Name default, Compartment, Cost Center, Component Type, Service, Environment). Changing it re-drives the "Top …" stat card, the stacked chart series, and the "By …" bars in one refresh; bar clicks toggle the filter for the selected dimension.

#### Scenario: Switch dimension
- **WHEN** the user selects Compartment
- **THEN** the chart stacks by top compartments, the card reads "Top compartment", and the bars list compartments

### Requirement: Stat band
The Executive Summary SHALL show a single row of stat cards, all computed client-side from live endpoints for the filtered range and foreground currency: Total (filtered range, with day count), Current month when the newest bucket is in the current calendar month (otherwise Latest month), MoM % across the last two complete months, Forecast for the partial month (run-rate extrapolation, with % vs previous actual), Non-prod share of tagged spend (env ≠ "" split prod vs non-prod), and Top resource name (share % + name). The current-month card SHALL show its month only; partiality is inherent in its label. Cards whose inputs are unavailable (e.g. fewer than two complete months) are omitted rather than shown empty.

#### Scenario: Landing view
- **WHEN** the user opens /summary with the default 6-month range
- **THEN** all seven cards render from summary, monthly timeseries, and breakdown calls

#### Scenario: Current month label
- **WHEN** the newest monthly bucket is in the current calendar month
- **THEN** the card reads "Current month" and shows the month without a partiality suffix; the Forecast card still extrapolates its run-rate when freshness data is mid-month

### Requirement: Spend over time
The view SHALL render monthly buckets as a stacked bar chart: top-7 values of the selected dimension **ranked by full-range total** (deliberate: stable segments across months; a value that spikes only in the latest month may land in "Other") plus a grey "Other" remainder (monthly total minus top-7). Axis and tooltip values are money-formatted; tooltip lists per-series values for the hovered month. X-axis labels are month + year only (e.g. "Jun ’26").

#### Scenario: Stacked chart renders
- **WHEN** monthly data loads
- **THEN** each month shows a stacked bar with one segment per top resource name and an Other segment, colors stable via legend

### Requirement: By resource name
The view SHALL list resource names as horizontal share bars with money values. Clicking a bar toggles that value as a Summary-local `resource_name` filter, refreshing all Summary panels; clicking the active bar clears it. This filter SHALL NOT affect Explorer or other views.

#### Scenario: Bar click filters
- **WHEN** the user clicks "develop-datasvc"
- **THEN** resource_name=develop-datasvc is applied to Summary panels only and the bar shows the active state

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
