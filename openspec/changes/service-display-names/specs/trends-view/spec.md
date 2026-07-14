## ADDED Requirements

### Requirement: Service labels use display names
When Service is the selected trend dimension, series names in the chart legend and tooltips SHALL render Oracle display names via the shared service-name mapping (raw-code fallback).

#### Scenario: Trend series labeled with display name
- **WHEN** the user trends by Service and `ODSP` is a top series
- **THEN** the legend and tooltip show "OCI Database Service with PostgreSQL"
