## ADDED Requirements

### Requirement: Service display names
A shared `SERVICE_DISPLAY_NAMES` mapping SHALL translate raw cost-report service codes (e.g. `RAWFKA`, `ODSP`, `OKE_CONTROL_PLANE`) to Oracle display names ("OCI Streaming with Apache Kafka", "OCI Database Service with PostgreSQL", "Container Engine for Kubernetes") at display time only. Codes absent from the map SHALL render as the raw code. Filter values, query params, and URLs MUST continue to carry the raw code — the mapping MUST NOT affect API traffic. The map SHALL be generated from Oracle sources (Usage API service names joined to cost-report codes on resource OCID) via a checked-in script, not hand-authored.

#### Scenario: Mapped code renders display name
- **WHEN** a breakdown row has `dimension_value = "RAWFKA"`
- **THEN** the UI renders "OCI Streaming with Apache Kafka" while any click/filter action sends `service=RAWFKA`

#### Scenario: Unmapped code falls back
- **WHEN** a new service code appears that is not in the map
- **THEN** the raw code is rendered unchanged and filtering by it works normally
