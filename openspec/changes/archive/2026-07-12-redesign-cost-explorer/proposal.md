# Redesign Cost Explorer

## Why

The current Explorer (left filter rail + breadcrumb drill + flat group-by table) does not
answer "where are the $s going" well: each drill replaces the table so context is lost,
the drill order is fixed by repeated group-by prompts, proportions are invisible (raw USD
only), and zero-cost/noise rows (0.00 USD, duplicate OBJECTSTORE) clutter the view.

## What Changes

- Replace the breadcrumb + flat table with a **hierarchical tree table**: rows expand in
  place (e.g. Service → Compartment → Resource Name) so the whole cost hierarchy is
  visible at once.
- Add a **hierarchy picker**: the user chooses the ordered list of drill dimensions
  (any of the existing filter dimensions), persisted in the URL.
- Move filters from the left rail to a **compact top filter bar**: one horizontal row —
  Environment, Cost Center, Component, Compartment, Service, Resource Type, Resource
  Name, plus a "Name contains" free-text box (date range + grain adjacent).
- **Cascading filter options (left → right)**: each dropdown only offers values valid
  under the selections to its left; changing an upstream filter clears downstream
  selections that become invalid. Requires `/v1/costs/filters` to accept the current
  filter params (additive backend change).
- Every row gets **% of parent/total with an inline cost bar** and a **trend sparkline**
  (cost over time at the current grain).
- **Noise control**: zero-cost rows hidden and the long tail collapsed into an "Other"
  bucket by default, with a toggle to show all.
- Node detail panel, CSV export, and deep-linking are retained, adapted to the tree model.
- **BREAKING** (UI-level): breadcrumb drill flow and left filter rail are removed from the
  Explorer view. No backend API removals.

## Capabilities

### New Capabilities

_None — this is a redesign of the existing explorer capability._

### Modified Capabilities

- `cost-explorer`: "Filter rail" requirement replaced by top filter bar + free-text
  search; "Breadcrumb group-by drilldown" replaced by tree-table drill with a
  user-selected hierarchy; row presentation requirements added (% of total bars,
  sparklines, noise hiding); node detail panel and CSV export requirements adapted to
  tree rows.

## Impact

- `src/app/views/explorer/explorer.component.ts` — main rewrite (may split into child
  components for tree table / filter bar / detail panel).
- `src/app/core/cost-api.service.ts` — likely additive: per-node children fetch reuses
  existing `breakdown`; sparklines need a per-row timeseries (batched or reuse existing
  endpoint with group-by + time grain); `filters()` gains filter params for cascading
  options. Any API addition must be additive and update
  `../oci-finops-api/openapi.yaml` + README per convention.
- `src/app/core/filters-store.ts` — hierarchy + search state, URL reflection.
- `src/app/shared/` — possible small shared pieces (sparkline, cost bar).
- Other views (summary, trends, resources) untouched; shared endpoints unchanged.
