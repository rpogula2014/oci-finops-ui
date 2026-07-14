## ADDED Requirements

### Requirement: Service labels use display names
The Explorer service filter dropdown options and any tree/table rows whose dimension is Service SHALL render Oracle display names via the shared service-name mapping (raw-code fallback). Selected filter values, URL params, and API requests SHALL keep the raw code; the active-filter chip SHALL show the display name.

#### Scenario: Dropdown shows friendly names, sends codes
- **WHEN** the user opens the Service filter and picks "Container Engine for Kubernetes"
- **THEN** the request and URL carry `service=OKE_CONTROL_PLANE` and the chip reads "Container Engine for Kubernetes"
