## Requirements

### Requirement: Group-by selector
The landing page SHALL offer a group-by dimension selector (Resource Name default, Compartment, Cost Center, Component Type, Service, Environment). Changing it re-drives the "Top …" stat card, the stacked chart series, and the "By …" bars in one refresh; bar clicks toggle the filter for the selected dimension.

#### Scenario: Switch dimension
- **WHEN** the user selects Compartment
- **THEN** the chart stacks by top compartments, the card reads "Top compartment", and the bars list compartments

### Requirement: Stat band
The Executive Summary SHALL show a single row of stat cards, all computed client-side from live endpoints for the filtered range and foreground currency: Total (filtered range, with day count), Latest month (flagged "may be partial" when the freshness `data_through` falls inside it), MoM % across the last two complete months, Forecast for the partial month (run-rate extrapolation, with % vs previous actual), Untagged cost-center spend ($ and % of spend), Non-prod share of tagged spend (env ≠ "" split prod vs non-prod), and Top resource name (share % + name). Cards whose inputs are unavailable (e.g. fewer than two complete months) are omitted rather than shown empty.

#### Scenario: Landing view
- **WHEN** the user opens /summary with the default 6-month range
- **THEN** all seven cards render from summary, monthly timeseries, and breakdown calls

#### Scenario: Partial month flagged
- **WHEN** freshness data_through is mid-month
- **THEN** the Latest month card notes "may be partial" and the Forecast card extrapolates run-rate

### Requirement: Spend over time
The view SHALL render monthly buckets as a stacked bar chart: top-7 values of the selected dimension **ranked by full-range total** (deliberate: stable segments across months; a value that spikes only in the latest month may land in "Other") plus a grey "Other" remainder (monthly total minus top-7). Axis and tooltip values are money-formatted; tooltip lists per-series values for the hovered month. X-axis labels are month + year only (e.g. "Jun ’26").

#### Scenario: Stacked chart renders
- **WHEN** monthly data loads
- **THEN** each month shows a stacked bar with one segment per top resource name and an Other segment, colors stable via legend

### Requirement: By resource name
The view SHALL list resource names as horizontal share bars with money values. Clicking a bar toggles that value as the `resource_name` filter, refreshing all panels; clicking the active bar clears it.

#### Scenario: Bar click filters
- **WHEN** the user clicks "develop-datasvc"
- **THEN** resource_name=develop-datasvc is applied globally and the bar shows the active state
