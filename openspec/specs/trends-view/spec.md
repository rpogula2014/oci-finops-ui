## Requirements

### Requirement: Timeseries with grain and filters
`/trends` SHALL render the `/v1/costs/timeseries` chart with hour/day/week/month grain toggle and the shared dimension filters applied.

#### Scenario: Filtered trend
- **WHEN** the user filters to cost_center "Treadsy" with grain week
- **THEN** the chart shows weekly buckets for that filter only

### Requirement: Stacked-by-dimension option
The view SHALL offer stacking the trend by a chosen dimension, built from repeated `breakdown` calls or per-series timeseries requests, using the blue chart ramp for series colors.

#### Scenario: Stack by service
- **WHEN** the user picks "stack by service"
- **THEN** the chart renders one stacked series per top service, per-currency separated
