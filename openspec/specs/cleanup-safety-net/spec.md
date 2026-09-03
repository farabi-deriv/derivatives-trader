# cleanup-safety-net Specification

## Purpose

TBD - created by archiving change c0-safety-net-knip-bundle-structural. Update Purpose after archive.

## Requirements

### Requirement: [CSN-001] Committed knip baseline of unused code

The repository SHALL contain a committed knip baseline at `docs/baselines/knip-baseline.json` capturing knip's normalised findings (unused files, unused exports, unused dependencies) across the monorepo, produced by knip configured with per-workspace `entry`/`project` globs and alias resolution consistent with the webpack `ALIASES` and each package's `tsconfig.json` `paths`.

The baseline SHALL be regenerated only deliberately via an explicit command (`npm run knip:baseline`), never implicitly by the verification check, so the set of known-unused entries changes only under human control.

#### Scenario: Baseline exists and is deterministic

- **WHEN** `npm run knip:baseline` is run twice on the same source tree
- **THEN** `docs/baselines/knip-baseline.json` is written and both runs produce byte-identical content (findings are sorted deterministically, with no timestamps or absolute paths)

#### Scenario: knip resolves the monorepo alias graph

- **WHEN** knip analyses a package that imports through an alias root (e.g. `AppV2/`, `Modules/`, `Stores/`)
- **THEN** knip resolves those imports to the same files webpack resolves them to, so an aliased-but-used export is NOT reported as unused

### Requirement: [CSN-002] knip:check fails on any divergence from the baseline

The repository SHALL provide a `knip:check` npm script (`node scripts/knip-check.js`) that runs knip, diffs its normalised findings against `docs/baselines/knip-baseline.json`, and exits non-zero when the two sets diverge in **either** direction:

- a finding that is **not present** in the baseline (the change orphaned code), or
- a baseline entry that knip **no longer reports** (the change cleaned code up and the shrink has not been banked).

Findings present in both sets SHALL NOT cause a failure. The check SHALL NOT modify the baseline.

Blocking on shrinkage is deliberate: an unbanked shrink leaves the committed allowlist permitting more than it needs to, so the next change inherits a weaker gate. The remedy for both directions is the same — `npm run knip:baseline`, with the regenerated baseline committed in the PR that caused the change, so the diff records what that change removed.

#### Scenario: No new findings passes

- **WHEN** `knip:check` runs and every current knip finding is present in the committed baseline
- **THEN** the script prints a pass summary and exits 0

#### Scenario: A new finding fails

- **WHEN** a change introduces an unused export, file, or dependency that is not in the committed baseline
- **THEN** `knip:check` prints the new finding(s) and exits non-zero, and the baseline file is left unchanged

#### Scenario: An unbanked shrink fails

- **WHEN** a cleanup PR deletes code that was listed in the baseline but does not regenerate the baseline
- **THEN** `knip:check` prints the no-longer-reported entries, states that this is the expected direction for a cleanup, instructs the author to run `npm run knip:baseline`, and exits non-zero

#### Scenario: Deletions shrink the baseline once regenerated

- **WHEN** a cleanup PR deletes code that was listed in the baseline and the author runs `npm run knip:baseline`
- **THEN** the removed entries drop out of `docs/baselines/knip-baseline.json`, the committed baseline reflects the smaller known-unused set, and `knip:check` exits 0

### Requirement: [CSN-003] Committed bundle-size baseline

The repository SHALL contain a committed bundle-size baseline at `docs/baselines/bundle-baseline.json`, derived by `scripts/bundle-baseline.js` from the per-package `bundle-stats.json` files that `analyze:bundle` emits for `@deriv/core`, `@deriv/trader`, `@deriv/reports` and `@deriv/components`. The baseline SHALL record, per package, total JavaScript size, total CSS size (including the core CSS bundle), asset/chunk counts and the largest assets.

#### Scenario: Baseline generated from analyze output

- **WHEN** `npm run analyze:bundle` has produced `bundle-stats.json` for the four packages and `npm run baseline:bundle` is run
- **THEN** `docs/baselines/bundle-baseline.json` is written containing per-package JS total, CSS total, asset count, chunk count and largest-asset list, and a project total

#### Scenario: Missing stats reported, not fabricated

- **WHEN** `baseline:bundle` runs and one package's `bundle-stats.json` is absent
- **THEN** the script reports the missing package and instructs the user to run `analyze:bundle` first, rather than emitting fabricated sizes for it

### Requirement: [CSN-004] Committed structural snapshots

The repository SHALL contain committed structural snapshots that later cleanup runs are verified against:

- `docs/baselines/route-map.json` — the set of route `path` literals declared in `packages/core/src/App/Constants/routes-config.js`, `packages/reports/src/Constants/routes-config.tsx` and `packages/trader/src/AppV2/Routes/routes.tsx`.
- `docs/baselines/chunk-names.json` — the set of emitted logical chunk names per package (`trader.*` / `reports.*` / `core.*`), with the `[contenthash]` segment stripped, so the identity is the stable logical name.
- `docs/baselines/alias-usage.json` — the alias-root set per package (from `build/constants.js` `ALIASES`) plus the per-package count of source files importing through those alias roots.

Each snapshot SHALL be regenerated only deliberately via `npm run baseline:update`.

#### Scenario: Snapshots capture the current structure

- **WHEN** `npm run baseline:update` is run on the current tree
- **THEN** all three snapshot files are written with sorted, deterministic content reflecting the current route paths, emitted chunk names and alias inventory

#### Scenario: Alias usage counts recorded per package

- **WHEN** `alias-usage.json` is generated
- **THEN** it records, for each of `trader`, `core` and `reports`, the set of alias roots and the number of source files that import through them (342 for trader, 32 for core, 30 for reports at baseline)

### Requirement: [CSN-005] baseline:check blocks on any stale tree-derived baseline, reports bundle bytes informationally

The repository SHALL provide a `baseline:check` npm script (`node scripts/baseline-check.js`) that regenerates the route map, emitted chunk names and alias inventory and diffs them against the committed snapshots. The script SHALL exit non-zero when a **tree-derived** baseline no longer matches what its generator produces for the current tree, specifically:

- a structural **set** change — a route `path`, an emitted chunk name, or an alias root added or removed;
- a per-package alias usage **count** change;
- any **byte-level** difference between a committed tree-derived snapshot and exactly what `--update` would write for the current tree (a backstop that covers snapshot fields with no dedicated diff).

Bundle **byte counts** are the sole exemption: they SHALL be printed as an informational report and SHALL NOT cause a non-zero exit, because they require a full `analyze:bundle` run and vary with the build environment, so gating them would produce failures unrelated to the change. The ">5% growth → escalate" judgement on those is left to the verifying agent or human reading the report.

The chunk assertion SHALL be applied only when the build produced `dist/` for every snapshotted package, so that a partial or absent build cannot report an un-rebuilt package's committed chunks as stale.

As with CSN-002, the remedy for every blocking case is `npm run baseline:update` with the regenerated snapshots committed in the same PR.

#### Scenario: A tree matching its committed baselines passes

- **WHEN** `baseline:check` runs on a tree whose route-path set, chunk-name set, alias-root set and alias usage counts all match the committed snapshots byte for byte
- **THEN** the script prints the report and exits 0

#### Scenario: A stale alias usage count blocks

- **WHEN** the alias usage counts a change produces differ from the committed `alias-usage.json` — because the change added or removed aliased imports, or because the counting logic itself changed without a regeneration
- **THEN** `baseline:check` prints each count as `<current> (baseline <committed>, <signed delta>)`, names the stale file, and exits non-zero

#### Scenario: A dropped chunk or route blocks

- **WHEN** a change removes an emitted chunk name or a route `path` that is present in the committed snapshot
- **THEN** `baseline:check` prints the missing entry as structural drift and exits non-zero

#### Scenario: Bundle byte growth does not block

- **WHEN** a change grows a package's bundle size beyond the baseline but every tree-derived snapshot still matches
- **THEN** `baseline:check` reports the size informationally and still exits 0

### Requirement: [CSN-006] Verification checks wired into CI and runnable by agents

`knip:check` and `baseline:check` SHALL be invocable as root npm scripts and SHALL be wired into `.github/workflows/test.yml` so that continuous integration runs them on every pull request. Together with the existing `build:all`, `test:jest` and lint steps, they SHALL constitute the per-commit VERIFY gate that every later Workstream C and package-merge issue is checked against. e2e and manual regression remain PR-level and QA-owned via the existing release process and are NOT added to this gate.

#### Scenario: CI runs both checks

- **WHEN** a pull request opens against `master`
- **THEN** the `Test & Validate` workflow runs `knip:check` and `baseline:check`, and the workflow fails if either exits non-zero

#### Scenario: Agent can run the same gate locally

- **WHEN** an agent or developer runs `npm run knip:check` and `npm run baseline:check` locally
- **THEN** the same pass/fail result is produced as in CI, with no additional setup beyond `bootstrap` and (for byte-count reporting) a prior `analyze:bundle`

### Requirement: [CSN-007] Baselines documented and branch status recorded

The repository SHALL contain `docs/baselines/README.md` documenting what each baseline captures, which are blocking versus informational, and the exact commands to regenerate each one deliberately. It SHALL also record the M0 pre-flight branch-status confirmation, dated and confirmed with the human: that the committed baselines were generated from a tree level with `master`, that C0 itself has no merge dependency, and that merge-dependent M1 work is gated on regenerating the baselines from the then-current `master` first.

#### Scenario: README explains regeneration

- **WHEN** a developer needs to update a baseline after a deletion PR
- **THEN** `docs/baselines/README.md` names the exact command for each baseline (`knip:baseline`, `baseline:bundle`, `baseline:update`) and states which drift blocks CI versus which is informational

#### Scenario: Branch status confirmed with the human

- **WHEN** the M0 pre-flight is recorded
- **THEN** `docs/baselines/README.md` records that in-flight branches were confirmed merged or rebase-ready with the human, dated, so merge-dependent work (M1) can rely on it
