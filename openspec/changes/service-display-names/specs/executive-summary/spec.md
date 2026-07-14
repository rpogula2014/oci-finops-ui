## ADDED Requirements

### Requirement: Service labels use display names
All Summary surfaces that show service values — the "By service" panel bars, the group-by breakdown bars and stacked-chart legend/tooltips when Service is the selected dimension, and the Top stat card — SHALL render Oracle display names via the shared service-name mapping, with raw-code fallback. Bar-click filtering SHALL keep sending the raw code.

#### Scenario: By-service panel shows friendly names
- **WHEN** the By service panel lists `RAWFKA` spend
- **THEN** the bar label reads "OCI Streaming with Apache Kafka" and clicking it applies the Summary-local filter `service=RAWFKA`
