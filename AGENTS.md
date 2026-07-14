# oci-finops-ui

Angular frontend for the OCI FinOps cost dashboard. Visualizes Oracle Cloud
spend (summary, explorer, trends, resources views) served by the Go
`oci-finops-api` backend over ClickHouse.

Development is spec-driven via `openspec/` — read `openspec/config.yaml` and
the relevant `openspec/specs/<capability>/` before changing a feature.

## Spec-driven workflow (openspec)

All requirements, design, and feature documentation live in `openspec/`. Any
non-trivial feature or behavior change flows through it — do not hand-edit
specs directly.

- **Before changing a feature**: read `openspec/config.yaml` and the relevant
  `openspec/specs/<capability>/` to understand the current contract.
- **To change behavior**: create a change proposal under `openspec/changes/`
  (proposal + design + tasks), get it approved, then implement.
- **When done**: archive the change (moves it to `openspec/changes/archive/`)
  and sync the affected `openspec/specs/`.
- `specs/` = current source of truth; `changes/` = in-flight proposals.
- Follow the `rules:` in `config.yaml` — proposals under 2 pages, simplest
  design, every endpoint task includes tests + `openapi.yaml` + README, UI
  changes include a live-verification task.

Skills: `openspec-propose`, `openspec-apply-change`, `openspec-archive-change`,
`openspec-update-change`, `openspec-sync-specs`, `openspec-explore`.

## Tech stack

- Angular 22 — standalone components, signals, OnPush change detection,
  `toObservable`/rxjs interop
- TypeScript 6, rxjs 7.8
- Charts: echarts 6 via ngx-echarts 22 (theme in `src/app/shared/chart-theme.ts`)
- Icons: lucide-angular
- Backend: sibling repo `../oci-finops-api` (Go 1.25, stdlib mux, clickhouse-go v2)

## Folder structure

```
src/app/
  core/              # data layer — no UI
    api.types.ts       # envelope + response types
    cost-api.service.ts# ALL HTTP goes through here
    filters-store.ts   # shared filter state (signals)
    currency.ts        # decimal-string money helpers
  shared/            # cross-view UI: chart-theme, money.pipe, panel-state
  views/
    summary/           # executive summary (landing page)
    explorer/          # cost explorer (group-by / filter drill-down)
    trends/            # time-series trends
    resources/         # per-resource costs
openspec/
  specs/             # current capability specs (app-shell, cost-data-layer,
                     #   cost-explorer, executive-summary, trends-view, ...)
  changes/           # in-flight change proposals (archive/ = done)
```

## API contract

- Envelope: `{data, meta, error}`; costs are **decimal strings**, parsed only
  at display (see `currency.ts` / `money.pipe.ts`).
- Dev proxy (`proxy.conf.json`): `/v1` and `/healthz` → `http://localhost:8080`.
- Data source: ClickHouse view `oci_cost_report_attributed`; tag dimensions are
  map lookups (`ATD-Billing.*`, `ATD-Ops.*`). Filter value `""` = unfiltered;
  `"__untagged__"` sentinel selects empty-tag rows.
- Endpoints are shared across views — prefer additive API changes over breaking.

## Commands

```
npm start        # ng serve (uses proxy.conf.json; needs cost-api on :8080)
npm run build
npm test
```

## Conventions

- Surgical changes; match existing style; comments only for non-obvious "why".
- All HTTP via `core/cost-api.service.ts`; shared state via `core/filters-store.ts`.
- Never kill/restart the developer's running cost-api or `ng serve` processes;
  verify backend changes with a build on a spare port instead.
- API changes must update `../oci-finops-api/openapi.yaml` and its README in
  the same change.
