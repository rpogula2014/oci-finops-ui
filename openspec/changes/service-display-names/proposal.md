# service-display-names

## Why

The UI shows raw OCI cost-report service codes (`COMPUTE`, `RAWFKA`, `ODSP`, `OKE_CONTROL_PLANE`, `ORALB`, …) everywhere the `service` dimension appears, while the OCI console shows friendly names ("OCI Streaming with Apache Kafka", "Container Engine for Kubernetes"). Codes are cryptic to anyone who hasn't memorized Oracle's internals and make the dashboard look worse than the console it replaces. The tenancy currently has only 21 distinct codes.

## What Changes

- **Display mapping in the UI**: a shared `SERVICE_DISPLAY_NAMES` constant (code → Oracle display name) applied at display time wherever service values render — Summary "By service" bars, group-by breakdowns/stacked-chart legend + tooltips, Explorer service filter dropdown and hierarchy rows, Trends series labels, Resources columns. Unmapped codes render as the raw code (safe fallback for new services).
- **Filters and API traffic unchanged**: the raw code remains the filter value sent to the API and used in URLs; mapping is presentation-only.
- **Oracle-sourced generator script** (`scripts/gen-service-names.mjs` or similar): derives the map by joining OCI Usage API (`request-summarized-usages` grouped by `["service","resourceId"]` — returns Oracle's display names) with ClickHouse `product_resourceid` → `product_service` on resource OCID, majority-vote per code. Verified live: RAWFKA → "OCI Streaming with Apache Kafka", ODSP → "OCI Database Service with PostgreSQL", OKE_CONTROL_PLANE → "Container Engine for Kubernetes", ORALB → "Load Balancer". Rerun manually when a new unmapped code appears; output is the checked-in constant.
- No backend / `openapi.yaml` changes; no runtime Usage API dependency.

## Capabilities

### New Capabilities

(none — presentation concern folded into existing capabilities)

### Modified Capabilities

- `cost-data-layer`: shared service display-name mapping (code → friendly label, raw-code fallback); filter values remain raw codes.
- `executive-summary`: service labels in By-service panel, group-by bars, chart legend/tooltips render display names.
- `cost-explorer`: service filter dropdown options and service-dimension rows render display names (values stay codes).
- `trends-view`: service series labels render display names.

## Impact

- New: `src/app/shared/service-names.ts` (map + `serviceDisplayName()` helper or pipe), generator script under `scripts/`.
- Touched at display call-sites only: summary, explorer filter-bar/tree, trends, resources table.
- Risk: label shown ≠ value filtered — mitigated by keeping tooltips/active-filter chips consistent (always display-name) and mapping being total over current data.
