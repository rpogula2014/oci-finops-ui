## MODIFIED Requirements

### Requirement: Application chrome
The app SHALL render a 64px Distribution-Blue (#142848) top bar with the "CostScope / OCI FINOPS" wordmark, global date-range selector, currency selector, and data-freshness stamp, plus a ~256px white left nav where the active item has Logistics-Blue background and Distribution-Blue bold text. Content SHALL be fluid-width — filling the available viewport up to a 1800px cap — so wide windows and reduced zoom levels do not leave dead space. Poppins font, 4px spacing grid, solid fills only (no gradients), ATD color tokens per CLAUDE-CODE-PROMPT.md §5.

#### Scenario: Freshness stamp
- **WHEN** the app loads
- **THEN** `/v1/costs/freshness` is fetched and `data_through`/`loaded_at` are shown in the top bar

#### Scenario: Active nav state
- **WHEN** the user navigates to `/explorer`
- **THEN** the Explorer nav item shows the active style and other items do not

#### Scenario: Wide viewport uses available space
- **WHEN** the content area (viewport minus nav) is wider than 1240px, e.g. a 2000px window or 90% zoom
- **THEN** panels and charts expand to fill the content area up to the 1800px cap, without horizontal dead space
