## Open Questions

1. **Where and in what format are baselines committed?**
    - **(A) Recommended:** Under the existing (empty) `docs/baselines/` dir, one JSON per baseline (`knip-baseline.json`, `bundle-baseline.json`, `route-map.json`, `chunk-names.json`, `alias-usage.json`) + a `README.md`. Small, diff-friendly, deterministic; keeps raw gitignored stats out of git.
    - (B) A single combined `docs/baselines/baselines.json`. Fewer files but noisier diffs and couples independent regeneration cycles.
    - (C) Commit the raw `bundle-stats.json` too. Rejected — large/noisy and already gitignored.
    - _Proceeding on (A)._

2. **What is knip's initial gating stance?**
    - **(A) Recommended:** Commit a full baseline of today's findings and gate only on NEW findings (`knip:check`), shrinking the baseline deliberately per deletion PR. Matches the issue's "fails only on findings NEW vs. that baseline".
    - (B) Fail on ANY finding. Rejected — CI would be red from day one given the existing known-unused set.
    - (C) Advisory only (no exit code). Rejected — not machine-verifiable in CI.
    - _Proceeded on (A), then **widened during review** to also fail on baseline entries knip no longer reports — an unbanked shrink leaves the allowlist permitting more than it needs to, so the next PR inherits a weaker gate. Still not (B): the committed baseline is what keeps CI green on day one. See section 8._

## 1. knip: dependency and monorepo config

- [x] 1.1 Add `knip` (5.x) to root `devDependencies` in `/Users/nijilnirmal/Desktop/derivatives-trader/package.json` (e.g. `npm install -D knip`) and record the resolved version for the README; commit the updated `package-lock.json`.
- [x] 1.2 Create `/Users/nijilnirmal/Desktop/derivatives-trader/knip.json` with a `workspaces` map for each `packages/*`: `entry` = the package's source entry (`src/index.tsx` for trader/reports; core's webpack `entry`; `packages/components` lib entry) plus `build/webpack.config.js` and `jest.config.js`; `project` = `src/**/*.{ts,tsx,js,jsx}`. Add root `scripts/*.js` as a top-level `entry`.
- [x] 1.3 Ensure alias resolution matches webpack: confirm each package's `tsconfig.json` `paths` covers its `build/constants.js` `ALIASES` (trader: `AppV2 Modules Stores _common Assets Constants Fonts Images Sass Services Translations Types Utils`; core; reports: `Components Containers` etc.). For any alias root present in `ALIASES` but missing from a tsconfig `paths`, add it to knip's `paths` in `knip.json`.
- [x] 1.4 Run `npx knip --reporter json` once and eyeball that aliased-but-used exports (e.g. something imported via `AppV2/...`, `Modules/...`) are NOT reported unused — proves D3/CSN-001 alias resolution before the baseline is trusted. Fix `knip.json` until clean of alias false-positives.

## 2. knip baseline + knip:check script

- [x] 2.1 Create `/Users/nijilnirmal/Desktop/derivatives-trader/scripts/knip-check.js`: run knip with the JSON reporter (spawn `npx knip --reporter json`), parse stdout, normalise findings (repo-relative paths, stable sort, drop timestamps), and expose two modes — default: set-diff current findings vs `docs/baselines/knip-baseline.json` and exit non-zero on divergence in either direction (findings not in the baseline, and baseline entries no longer reported — see section 8); `--update`: write the normalised findings to the baseline and exit 0.
- [x] 2.2 Generate the initial baseline: run `node scripts/knip-check.js --update` and commit `/Users/nijilnirmal/Desktop/derivatives-trader/docs/baselines/knip-baseline.json`. Re-run `--update` a second time and confirm byte-identical output (CSN-001 determinism).
- [x] 2.3 Add root npm scripts to `package.json`: `"knip:check": "node scripts/knip-check.js"` and `"knip:baseline": "node scripts/knip-check.js --update"`.
- [x] 2.4 Verify CSN-002: with the baseline committed, `npm run knip:check` exits 0; then temporarily add an unused export in a scratch file, confirm `knip:check` exits non-zero and names it, and that `docs/baselines/knip-baseline.json` is unchanged; remove the scratch file.

## 3. Bundle-size baseline

- [x] 3.1 Create `/Users/nijilnirmal/Desktop/derivatives-trader/scripts/bundle-baseline.js`: read `packages/{core,trader,reports,components}/bundle-stats.json` (reuse the JS/CSS/asset aggregation logic shape from `scripts/bundle-summary.js`), and write `docs/baselines/bundle-baseline.json` with per-package `{ js_total, css_total, asset_count, chunk_count, largest_assets[] }` and a project total. If a stats file is missing, report the package and instruct to run `analyze:bundle` first (CSN-003) — do not fabricate sizes.
- [x] 3.2 Add root npm script `"baseline:bundle": "node scripts/bundle-baseline.js"` to `package.json`.
- [x] 3.3 Run `npm run analyze:bundle` then `npm run baseline:bundle`; commit `/Users/nijilnirmal/Desktop/derivatives-trader/docs/baselines/bundle-baseline.json`. Confirm the core CSS bundle size is captured in `core.css_total`.

## 4. Structural snapshots + baseline:check script

- [x] 4.1 Create `/Users/nijilnirmal/Desktop/derivatives-trader/scripts/baseline-check.js` with default (check) and `--update` modes covering three snapshots.
- [x] 4.2 Route map: extract route `path` string literals from `packages/core/src/App/Constants/routes-config.js`, `packages/reports/src/Constants/routes-config.tsx`, `packages/trader/src/AppV2/Routes/routes.tsx` (scoped regex per D5); write/compare `docs/baselines/route-map.json` as a sorted set.
- [x] 4.3 Chunk names: after `build:all`, list `packages/{trader,reports,core}/dist/**/*.js`, strip the `[contenthash]` segment, take the sorted logical-name set (must include entry chunks + cache-group names `vendor`, `quill-ui-vendor`, `vendors`); write/compare `docs/baselines/chunk-names.json`. If `dist/` is absent, skip the chunk assertion with a logged notice (D4/D8 structural-only mode).
- [x] 4.4 Alias inventory: read `ALIASES` keys from `packages/{trader,core,reports}/build/constants.js` for the alias-root set, and count source files importing through those roots per package (trader 342, core 32, reports 30 at baseline); write/compare `docs/baselines/alias-usage.json` (roots set + per-package counts).
- [x] 4.5 Gating semantics (CSN-005/D6): exit non-zero when a tree-derived baseline no longer matches the tree — a structural SET change (route path / chunk name / alias root), an alias usage COUNT change, or a byte-level snapshot difference (see section 8). Print bundle byte counts (from `bundle-baseline.json`) as an informational report; never fail on those.
- [x] 4.6 Add root npm scripts `"baseline:check": "node scripts/baseline-check.js"` and `"baseline:update": "node scripts/baseline-check.js --update"` to `package.json`.
- [x] 4.7 Generate snapshots: run `npm run build:all` then `node scripts/baseline-check.js --update`; commit `docs/baselines/route-map.json`, `docs/baselines/chunk-names.json`, `docs/baselines/alias-usage.json`. Re-run to confirm deterministic (byte-identical) output.
- [x] 4.8 Verify CSN-005: `npm run baseline:check` exits 0 on the committed tree; temporarily delete a route `path` and a chunk source to confirm it exits non-zero naming the missing entry; revert.

## 5. CI wiring

- [x] 5.1 In `/Users/nijilnirmal/Desktop/derivatives-trader/.github/workflows/test.yml`, add a `Run knip check` step (`npm run knip:check`) to the `validate` job (alongside `check-imports`/lint).
- [x] 5.2 Add `baseline:check` to CI: run the structural-only route-map + alias assertions in the `validate` job (`npm run baseline:check`, chunk assertion auto-skipped without `dist/`), and add a `Run baseline check (chunks)` step to the `build` job after `Build` so the emitted-chunk assertion runs against `dist/` (D8).
- [x] 5.3 Confirm the intended per-commit VERIFY gate for later Workstream C issues is documented as `build:all` + `test:jest` + lint + `knip:check` + `baseline:check` (CSN-006) — record it in the baselines README (task 6.1), not just here.

## 6. Documentation + M0 pre-flight

- [x] 6.1 Create `/Users/nijilnirmal/Desktop/derivatives-trader/docs/baselines/README.md`: describe each baseline file, mark blocking (knip divergence in either direction, structural set drift, alias count drift, byte-level snapshot staleness) vs informational (bundle bytes only), give the exact regeneration command per baseline (`knip:baseline`, `baseline:bundle`, `baseline:update`), state the VERIFY gate composition (CSN-006), and record the resolved `knip` version (task 1.1).
- [x] 6.2 Record M0 branch status in `docs/baselines/README.md`: confirm with the human that in-flight branches are merged or rebase-ready, and note the date and confirmation (CSN-007). If not confirmable, flag it as a blocker rather than assuming.

## 7. Verification

- [x] 7.1 Run `npm run knip:check` and `npm run baseline:check` locally — both exit 0 on the committed tree (CSN-006 agent-runnable).
- [x] 7.2 Run `npm run test:jest` and lint to confirm the new `scripts/*.js` and `knip.json` do not break existing gates (no product code changed).
- [x] 7.3 Confirm no product code, store, API, route, translation, or dependency-graph change is present in the diff — only `scripts/`, `knip.json`, `package.json`/`package-lock.json`, `.github/workflows/test.yml`, and `docs/baselines/**`.
- [x] 7.4 Run `openspec validate c0-safety-net-knip-bundle-structural` and fix any structural errors.

## 8. Post-review amendments

Applied after the PR review on #1307, all verified by tampering with each baseline in turn and by re-running `test:scripts` (38 tests), ESLint and Prettier.

- [x] 8.1 Regenerate the stale committed alias-usage counts — the counting regex was tightened in `5d1ab14968` without a regeneration, leaving `384/41/32` committed against a generator producing `342/32/30` (commit `ce836ac198`).
- [x] 8.2 Report baseline staleness instead of hiding it: `baseline:check` prints each alias count against its committed reference, and `knip:check` reports baseline entries knip no longer finds (commit `a29688adbc`).
- [x] 8.3 Widen the gate so unbanked drift blocks in either direction, adding a byte-level freshness backstop over every tree-derived snapshot; bundle bytes stay informational (commit `1affb41dd9`). Updates CSN-002 and CSN-005.
- [x] 8.4 Review finding (MEDIUM): correct the stale alias figures quoted in `design.md`, `tasks.md` 4.4 and `spec.md` CSN-004 — they still showed the pre-implementation estimates `≈322/27/20`, which were never the committed values.
- [x] 8.5 Review finding (LOW): restore the trailing newline on `spec-to-pr.config.json`.
- [x] 8.6 Not raised by the review: CSN-002, CSN-005 and CSN-007 normative text contradicted the shipped behaviour after 8.3 and the branch-status record. Rewritten to match, since a spec that describes behaviour the code does not have is worse than no spec.
