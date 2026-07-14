# trends-view (delta)

## ADDED Requirements

### Requirement: Highlights tier
`/trends` SHALL render, above the drilldown tier, an automatic highlights section built from parallel `/v1/costs/anomalies` and `/v1/costs/trends` calls over a fixed dimension set — anomalies+trends for `service`, `compartment`, `environment` and anomalies-only for `resource_name` — using the shared range and filters. It SHALL show (1) stat cards: count of critical anomalies with total excess $, top rising mover, top falling mover; (2) ranked anomaly event cards; (3) top movers as diverging bars. Each panel SHALL load independently with its own loading/empty/error state so no single slow or failed call blanks the view.

#### Scenario: Panels load progressively
- **WHEN** the anomalies calls are slow but the trends calls resolve
- **THEN** mover panels render while anomaly panels still show skeletons, and a failed panel shows its error state without affecting others

#### Scenario: Highlights respect shared filters
- **WHEN** the user has cost_center "Treadsy" filtered
- **THEN** all highlight calls carry that filter and cards reflect only Treadsy spend

#### Scenario: Highlights remain stable during focus changes
- **WHEN** the user investigates COMPUTE and then focuses App-Dev-DATASVCS
- **THEN** highlight requests and results remain scoped only by the shared baseline filters, not by either focus value

### Requirement: Anomaly event clustering
Highlight anomaly cards SHALL be events, not raw rows: rows SHALL be clustered per currency by direction and consecutive-day adjacency on a primary dimension (service; compartment when no service row shares the day), with same-day rows from other dimensions attached as attribution context ("seen at"), phrased as correlation. Consecutive flagged days SHALL collapse into one event showing the day span, peak cost vs baseline, and peak z-score. Events SHALL be ranked by total absolute deviation for the foregrounded currency, showing at most 5 cards.

#### Scenario: Multi-day spike collapses
- **WHEN** COMPUTE is flagged as a spike on Jul 7, 8, and 9
- **THEN** one card renders spanning Jul 7–9 with the peak day's cost, baseline, and z-score

#### Scenario: Cross-dimension attribution
- **WHEN** a service-level spike day also has anomaly rows at compartment and resource_name
- **THEN** the card lists those values as "seen at" context under the service headline

### Requirement: Drilldown tier
`/trends` SHALL render a drilldown section with a dimension picker (service, compartment, environment, cost_center, component_type, resource_type, resource_name) showing, for the picked dimension: a movers table from `/v1/costs/trends` (current, previous, change %, direction), an anomaly list from `/v1/costs/anomalies` (day, cost vs baseline, z-score, severity), and the timeseries chart. The section SHALL own a visible local focus path, initially empty. Drilldown requests SHALL merge the shared baseline filters with the focus path, with focus winning on key collision; highlights SHALL never consume focus values. The path SHALL offer back-one-level and clear-focus actions. An explicit "Open in Cost Explorer" action SHALL copy the focus path to the shared Explorer filters; no other Trends action SHALL mutate those filters.

#### Scenario: Click-to-drill extends focus
- **WHEN** the user clicks the COMPUTE row in the movers table at dimension service
- **THEN** the focus path becomes `Service = COMPUTE` and the drilldown re-queries at the next un-focused dimension without changing the shared service filter

#### Scenario: Focus breadcrumb navigation
- **WHEN** the focus path is `Service = COMPUTE › Compartment = App-Dev-DATASVCS`
- **THEN** the breadcrumb is visible, back-one-level removes only the compartment, and clear-focus removes both values

#### Scenario: Investigate from highlight
- **WHEN** the user clicks "investigate" on a COMPUTE spike event card
- **THEN** the drilldown focus becomes `Service = COMPUTE`, scrolls into view, and the highlights remain unchanged

#### Scenario: Investigate seeds the event's primary dimension
- **WHEN** the user clicks "investigate" on an event whose primary dimension is compartment (no service row shared the day)
- **THEN** the focus path becomes `Compartment = <value>`, not a service entry

#### Scenario: Explicit Explorer handoff
- **WHEN** the user selects "Open in Cost Explorer" with `Service = COMPUTE` focused
- **THEN** Explorer opens with its shared service filter set to COMPUTE

### Requirement: Anomaly markers on timeseries
The drilldown timeseries chart SHALL overlay anomaly days as severity-colored markPoints at day grain, with tooltips showing cost, baseline, and z-score. Markers SHALL derive from the same anomalies response as the list, filtered to the foregrounded currency.

#### Scenario: Marker on flagged day
- **WHEN** Jul 9 is flagged critical for the current filter scope
- **THEN** the day-grain chart pins a critical-colored marker on Jul 9 whose tooltip shows $1,286 vs $318 baseline, z=22.8

#### Scenario: Non-day grain hides markers
- **WHEN** the user switches the chart to week or month grain
- **THEN** anomaly markers are not rendered

### Requirement: Sensitivity presets
Both tiers SHALL share a sensitivity control with three presets mapping to anomaly parameters — default (window 28, min_z 3, min_impact 50), strict (28, 5, 200), loose (14, 2, 10) — defaulting to default. Raw parameter inputs SHALL NOT be rendered.

#### Scenario: Strict preset narrows results
- **WHEN** the user selects strict
- **THEN** all anomaly calls re-fire with min_z=5 and min_impact=200 and both tiers update

### Requirement: Local Trends reset
`/trends` SHALL offer a Reset view action in its header. It SHALL restore the local focus path, sensitivity, drill dimension, chart grain, and stack-by choice to their defaults without mutating the shared date range or dimension filters.

#### Scenario: Reset preserves shared baseline
- **WHEN** a user has focused `Service = COMPUTE`, selected strict sensitivity, changed the chart controls, and invokes Reset view
- **THEN** Trends returns to its default local view while the shared range and filters remain unchanged

### Requirement: Float cost handling
Values from the analysis endpoints (costs, baselines, deviations) SHALL be treated as numbers and formatted directly for display, bypassing the decimal-string `parseCost` pipeline; rows SHALL still be partitioned by `currency` with only the foregrounded currency rendered per panel.

#### Scenario: Mixed currencies partitioned
- **WHEN** anomaly rows contain USD and EUR entries
- **THEN** panels render USD (foregrounded) values only, never summing across currencies
