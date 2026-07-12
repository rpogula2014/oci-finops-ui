## Why

Landing on the Resources tab directly (not drilled from the Cost Explorer) shows a
plain 50-per-page flat table. Users cannot organize or search across the full
resource dataset — the primary way they answer "where is this spend?" from a cold
start. There is no way to group by dimension or free-text search across all rows;
paging hides the shape of the data.

## What Changes

- Add a **server-grouped resources endpoint** `GET /v1/costs/resources/grouped` to
  `../oci-finops-api` supporting: `group1` + `group2` dimensions (incl. `period`,
  excl. `ocid`), `group1_value`/`group2_value` for lazy expansion scope, month-grain
  resource-month leaves, server-side free-text `q` search, and the existing `CostQuery`
  filter/date scope. Returns group subtotals + row counts with lazily-expandable leaves
  (single-currency USD — no currency partitioning).
- Replace the plain Resources table with a new **grouped-resource-table** view:
  two dimension selectors (Group / then), a search box, CSV export, group rows
  showing subtotal + "N rows", expand to resource-month leaves with full columns
  (period, env, cost center, component, compartment, service, resource type,
  resource name, OCID, cost).
- The existing flat/paged table is retained for the **drilled-from-Explorer** path
  (arriving with `resource_name` / OCID scope) — grouping only applies to the
  direct-landing, unscoped view.
- Update `../oci-finops-api/internal/httpapi/openapi.yaml` and its README for the new endpoint.

## Capabilities

### New Capabilities
- `grouped-resource-table`: 2-level client-driven grouping, server-side search, and
  month-grain leaf rendering for the Resources view, backed by a grouped endpoint.

### Modified Capabilities
- `resources-view`: direct-landing behavior changes from a flat paged table to the
  grouped table; drilled-from-Explorer flat table behavior preserved.
- `cost-data-layer`: adds the `resources/grouped` endpoint contract and its
  response envelope shape.

## Impact

- **Frontend**: new `views/resources/grouped-resource-table.component.ts`; changes to
  `resources.component.ts` (route by scope), `core/cost-api.service.ts` (new call),
  `core/api.types.ts` (new row type). Borrows expand/search/CSV patterns from
  `explorer/tree-table.component.ts` but renders resource-leaf columns.
- **Backend** (`../oci-finops-api`): new handler + ClickHouse query over
  `oci_cost_report_attributed` with month-grain grouping; `openapi.yaml` + README.
- No breaking changes to existing endpoints (additive).
