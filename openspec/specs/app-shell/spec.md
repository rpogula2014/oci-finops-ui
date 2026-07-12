## Purpose
Global application shell: top bar, left navigation, date-range and currency selectors, and page layout.

## Requirements

### Requirement: Application chrome
The app SHALL render a 64px Distribution-Blue (#142848) top bar with the "CostScope / OCI FINOPS" wordmark, global date-range selector, currency selector, and data-freshness stamp, plus a ~256px white left nav where the active item has Logistics-Blue background and Distribution-Blue bold text. Content max width SHALL be 1240px. Poppins font, 4px spacing grid, solid fills only (no gradients), ATD color tokens per CLAUDE-CODE-PROMPT.md §5.

#### Scenario: Freshness stamp
- **WHEN** the app loads
- **THEN** `/v1/costs/freshness` is fetched and `data_through`/`loaded_at` are shown in the top bar

#### Scenario: Active nav state
- **WHEN** the user navigates to `/explorer`
- **THEN** the Explorer nav item shows the active style and other items do not

### Requirement: Routing
The app SHALL define routes `/summary` (default redirect), `/explorer`, `/resources`, `/resources/:ocid`, and `/trends`, all lazy-loaded standalone components.

#### Scenario: Default route
- **WHEN** the user opens `/`
- **THEN** they are redirected to `/summary`

### Requirement: Global date range
The top bar SHALL offer quick range presets — Last 6 months (default), Current month, Last month (closed 1st→1st), This quarter, This year — plus a Custom option that reveals from/to date inputs. Preset boundaries are UTC month/quarter/year starts. The selected range applies to all views via the shared FiltersStore and is clamped to the API's 400-day maximum; non-custom presets show a compact "start → end" echo.

#### Scenario: Preset selection
- **WHEN** the user picks "Last month"
- **THEN** the range becomes the 1st of the previous month to the 1st of the current month and all views refetch

#### Scenario: Custom range
- **WHEN** the user picks "Custom range"
- **THEN** from/to date inputs appear, pre-filled with the current range

#### Scenario: Range exceeds limit
- **WHEN** the user attempts to select a range longer than 400 days
- **THEN** the picker prevents it or the envelope VALIDATION_ERROR is surfaced in a banner
