# service-display-names — tasks

## 1. Mapping + generator

- [ ] 1.1 Create `src/app/shared/service-names.ts`: `SERVICE_DISPLAY_NAMES` constant seeded from the verified Usage-API join (21 codes) + `serviceDisplayName(code)` helper with raw-code fallback; unit test covering mapped, unmapped, and empty-string values
- [ ] 1.2 Add `scripts/gen-service-names.mjs`: Usage API (`group-by ["service","resourceId"]`) × ClickHouse OCID join, majority-vote per code, emits the TypeScript constant; document usage (prereqs: OCI CLI profile, CH access) in README

## 2. Display call-sites

- [ ] 2.1 Summary: By-service panel labels, group-by bars/legend/tooltips when dimension=service, Top stat card — render via `serviceDisplayName`; assert bar clicks still send raw codes (extend summary.component.spec)
- [ ] 2.2 Explorer: service filter dropdown option labels + active chip + service-dimension tree rows show display names; values/URL/API stay raw codes (test in filter-bar spec)
- [ ] 2.3 Trends: service series legend/tooltip labels mapped
- [ ] 2.4 Resources: service column values mapped (display only)

## 3. Verification & docs

- [ ] 3.1 `npm run build` + `npm test` pass
- [ ] 3.2 Live-verify: By-service panel shows "OCI Streaming with Apache Kafka" etc.; picking a friendly name in Explorer dropdown puts `service=<CODE>` in URL and returns filtered data; unmapped-code fallback sanity-checked
- [ ] 3.3 Sync spec deltas on archive (cost-data-layer, executive-summary, cost-explorer, trends-view)
