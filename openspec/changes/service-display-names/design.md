# service-display-names — design

## Context

Cost-report CSVs carry only raw service codes (`product_service`); Oracle's friendly names live in the Usage API / console mapping and are not in ClickHouse. 21 distinct codes exist in the tenancy. The `service` dimension surfaces in Summary (By-service panel, group-by), Explorer (filter dropdown `filter-bar.component.ts:23`, hierarchy rows), Trends (`trends.component.ts:15`), and Resources columns.

## Goals / Non-Goals

**Goals:**
- Friendly names everywhere service values are displayed; raw codes everywhere they are transmitted.
- Oracle-sourced, regenerable mapping — no hand-guessing.

**Non-Goals:**
- No runtime Usage API calls, no backend/API changes, no CH dim table.
- No renaming of other dimensions.

## Decisions

1. **Static checked-in map, generated offline** (`src/app/shared/service-names.ts`, `SERVICE_DISPLAY_NAMES: Record<string, string>` + `serviceDisplayName(code): string` returning fallback code). Alternative — CH dim table refreshed by the ingestion CronJob with API join: rejected; adds Usage API dependency + IAM policy to the pipeline for near-static data (Rule 14). Fallback makes staleness harmless.
2. **Generator script** `scripts/gen-service-names.mjs` (node, run manually by an operator with OCI CLI + CH access):
   - `oci usage-api usage-summary request-summarized-usages --group-by '["service","resourceId"]'` over a recent window → OCID → display name.
   - ClickHouse query `SELECT DISTINCT product_service, product_resourceid` over same window → OCID → code.
   - Join on OCID, majority-vote display name per code (tenancy-level charges like Logging Analytics bill on the tenancy OCID and can collide).
   - Emits the TypeScript constant; codes with no join (zero-cost tail) are left out and fall back to raw code. SKU join was considered and rejected: managed services (ODSP, RAWFKA) bill shared compute/storage SKUs, so SKU→service is many-to-many.
3. **Apply at display boundaries** — a pipe or helper call in templates/chart-option builders. Do NOT rewrite `dimension_value` in data rows: click handlers compare raw values (e.g. `filterValue('service') === row.dimension_value`), so mutating rows would break active-state checks.
4. **Only the `service` dimension** is mapped; other dimensions pass through untouched. Mapping is applied where the dimension is known to be `service` (fixed panels) or via the dimension key at generic call-sites.

## Risks / Trade-offs

- [Map goes stale when Oracle adds a service] → fallback shows raw code; rerun script. Note in README.
- [Long display names widen bars/legends] → existing truncation/ellipsis styles apply; visual check in live-verify task.
- [Generic breakdown components display raw `dimension_value` for all dimensions] → thread the dimension key to the label formatter; only map when `service`.

## Migration Plan

Frontend-only; single commit. Rollback = revert.

## Open Questions

None.
