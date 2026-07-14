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

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any Bash command containing `curl` or `wget` is intercepted and replaced with an error message. Do NOT retry.
Instead use:
- `ctx_fetch_and_index(url, source)` to fetch and index web pages
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any Bash command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` is intercepted and replaced with an error message. Do NOT retry with Bash.
Instead use:
- `ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### WebFetch — BLOCKED
WebFetch calls are denied entirely. The URL is extracted and you are told to use `ctx_fetch_and_index` instead.
Instead use:
- `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Bash (>20 lines output)
Bash is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### Read (for analysis)
If you are reading a file to **Edit** it → Read is correct (Edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `ctx_execute_file(path, language, code)` instead. Only your printed summary enters context. The raw file content stays in the sandbox.

### Grep (large results)
Grep results can flood context. Use `ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Subagent routing

When spawning subagents (Agent/Task tool), the routing block is automatically injected into their prompt. Bash-type subagents are upgraded to general-purpose so they have access to MCP tools. You do NOT need to manually instruct subagents about context-mode.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `ctx_search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `ctx_stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `ctx_doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `ctx_upgrade` MCP tool, run the returned shell command, display as checklist |
