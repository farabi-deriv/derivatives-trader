## Why

Workstream C (dead-code cleanup, tracking issue [#1019](https://github.com/deriv-com/derivatives-trader/issues/1019)) and the package-merge work (M1) will delete ~25k LOC and consolidate packages across ~369 files that import through webpack/tsconfig alias roots. Those deletions are only safe if there is an **oracle** every later run is verified against: a way to tell "this deletion removed genuinely dead code and nothing structural drifted" from "this deletion broke a route, dropped a chunk, or orphaned an alias". Today no such oracle exists — there is no `knip`, no committed bundle snapshot, and no structural baseline. This change ([#1267](https://github.com/deriv-com/derivatives-trader/issues/1267)) builds that safety net. **Nothing in Workstream C may start before it lands** — it is the deletion oracle the rest of the workstream relies on, and it also absorbs M1's read-only pre-flight (M0: alias audit + route/chunk snapshots + branch status), because the route-map snapshot was duplicated across C0 and M1 and alias counts + chunk names are the same class of baseline artifact.

This issue is unusual for the workstream: its deliverable is **artifacts and checks**, not deletions. It changes no product code.

## What Changes

- **Add `knip` as the deletion oracle.** Introduce `knip` (5.x) as a root dev dependency with a monorepo-tuned config (`knip.json`): per-workspace `entry`/`project` globs for the four buildable packages (`core`, `trader`, `reports`, `components`) and the shared/util/api/stores packages, plus the build tooling (`build/webpack.config.js`, `jest.config.js`) and root `scripts/*.js` as entry points. Alias resolution rides each workspace's existing `tsconfig.json` `paths` (which mirror the webpack `ALIASES` and jest `moduleNameMapper`); any alias root not already in a tsconfig is declared explicitly in the knip config so knip resolves the same graph webpack does.
- **Commit a knip baseline and a `knip:check` script that fails only on NEW findings.** `knip` has no native baseline, so `scripts/knip-check.js` runs knip with the JSON reporter, normalises the result, and diffs it against the committed `docs/baselines/knip-baseline.json`, exiting non-zero **only** on findings that are new relative to that baseline. The baseline is regenerated **deliberately** (`npm run knip:baseline`) as each deletion PR lands — never implicitly by the check — so the set of known-unused entries shrinks under human control and a deletion run cannot mask a regression.
- **Commit a bundle-size baseline snapshot.** `analyze:bundle` already emits gitignored `bundle-stats.json` per package; `scripts/bundle-baseline.js` reads those four stats files (incl. the core CSS bundle) and writes a committed `docs/baselines/bundle-baseline.json` (per-package JS/CSS totals, chunk counts, largest assets). This is the byte-count comparison point for later runs — **reported informationally**, never a hard gate (the ">5% growth → escalate" judgement is made by the verifying agent/human reading the report, not by CI).
- **Commit structural snapshots and a `baseline:check` script that blocks on structural drift.** `scripts/baseline-check.js` regenerates and diffs three structural snapshots against their committed form: the **route map** (route `path` literals from the three route-config files), the **emitted chunk names** (`trader.*.js` / `reports.*.js` / `core.*.js` logical names, contenthash stripped, read from each package's `dist/` after `build:all`), and the **alias inventory** (the alias-root set per package plus per-package usage file counts). A change to any structural _set_ (a route path, a chunk name, or an alias root added/removed) **blocks** (exit non-zero); byte counts and per-package usage counts are **reported informationally**. Snapshots are regenerated deliberately via `npm run baseline:update`.
- **Wire both checks into CI and make them runnable by agents.** Add `knip:check` and `baseline:check` steps to `.github/workflows/test.yml` so per-commit VERIFY for every later Workstream C / M issue is `build:all` + `test:jest` + lint + `knip:check` + `baseline:check`. e2e/manual regression stays PR-level and QA-owned via the existing release process (unchanged).
- **Record M0 pre-flight artifacts and confirm branch status.** The alias-usage counts, route map and chunk-name snapshots above satisfy M0's snapshot requirements; branch status (in-flight branches merged or rebase-ready) is confirmed with the human and recorded in the baselines README.
- No product-code, API, routing, store-shape, persistence, translation, or dependency-graph changes. The only runtime-adjacent edit is CI config; everything else is new tooling under `scripts/` and new committed artifacts under `docs/baselines/`.

## Capabilities

### New Capabilities

- `cleanup-safety-net`: The contract for the dead-code-cleanup safety net — the committed baselines (knip findings, bundle sizes, route map, emitted chunk names, alias inventory) and the two verification scripts (`knip:check`, `baseline:check`) that gate later cleanup runs. Defines what each baseline captures, what blocks vs. what is informational, how baselines are regenerated deliberately, and how the checks are wired into CI and made runnable by agents.

### Modified Capabilities

<!-- None: openspec/specs/ contains no existing spec covering cleanup tooling, bundle baselines, or structural drift checks. -->

## Impact

- **New tooling (scripts):**
    - `scripts/knip-check.js` — run knip (JSON reporter), diff vs `docs/baselines/knip-baseline.json`, fail on new findings; `--update` regenerates the baseline.
    - `scripts/bundle-baseline.js` — read the four `packages/{core,trader,reports,components}/bundle-stats.json` produced by `analyze:bundle` and write `docs/baselines/bundle-baseline.json`.
    - `scripts/baseline-check.js` — regenerate + diff route map, chunk names and alias inventory vs their committed snapshots; block on structural set drift, report byte/count drift informationally; `--update` regenerates snapshots.
- **New committed artifacts (`docs/baselines/`, currently an empty dir):**
    - `docs/baselines/knip-baseline.json`, `docs/baselines/bundle-baseline.json`, `docs/baselines/route-map.json`, `docs/baselines/chunk-names.json`, `docs/baselines/alias-usage.json`, and `docs/baselines/README.md` (what each baseline is, how/when to regenerate, and the recorded branch-status confirmation).
- **Config:**
    - `knip.json` (new, repo root) — monorepo workspace config.
    - `package.json` (root) — add `knip` (5.x) to `devDependencies`; add scripts `knip:check`, `knip:baseline`, `baseline:check`, `baseline:update`, `baseline:bundle`.
    - `.github/workflows/test.yml` — add `knip:check` and `baseline:check` steps to the `validate` job.
- **Inputs relied on (unchanged, read-only):** webpack `ALIASES` in `packages/{trader,core,reports}/build/constants.js`; output/chunk templates `trader/js/trader.[name].[contenthash].js`, `reports/js/reports.[name].[contenthash].js`, `js/core.[name].[contenthash].js`; route configs `packages/core/src/App/Constants/routes-config.js`, `packages/reports/src/Constants/routes-config.tsx`, `packages/trader/src/AppV2/Routes/routes.tsx`; per-package `tsconfig.json` `paths`.
- **No changes** to product code, MobX stores, the WebSocket/API layer, translations, or the dependency graph between packages. `.gitignore` already excludes the raw `bundle-report.html`/`bundle-stats.json`; the committed baseline is a derived artifact and is not gitignored.
