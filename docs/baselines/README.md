# Cleanup safety-net baselines

These committed baselines are the oracle that later Workstream C (dead-code deletion) and M1
(package-merge) changes are verified against. Each one is a small, deterministic, derived JSON —
regenerated only deliberately, never implicitly by a check — so the known-good state changes only
under human control.

Resolved tool version: **knip `5.88.1`** (declared as `^5.88.1` in the root `devDependencies`;
pinned via `package-lock.json` for reproducibility).

## The baselines

| File                   | Captures                                                                                                                                 | Regenerate with                                               | Drift is                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `knip-baseline.json`   | knip's normalised findings across the monorepo (unused files, exports, dependencies) — the known-unused set.                             | `npm run knip:baseline`                                       | **Blocking in both directions** — a finding **new** versus the baseline, or a baseline entry knip no longer reports. |
| `route-map.json`       | The set of route `path` values in the three route-config files, keyed per file.                                                          | `npm run baseline:update`                                     | **Blocking** — a route path added or removed.                                                                        |
| `chunk-names.json`     | The set of emitted logical chunk names per package (`trader` / `reports` / `core`), contenthash and volatile chunk-id suffixes stripped. | `npm run baseline:update` (needs a prior `npm run build:all`) | **Blocking** — a logical chunk name added or removed.                                                                |
| `alias-usage.json`     | The alias-root set per package (from each `build/constants.js` `ALIASES`) plus the count of source files importing through those roots.  | `npm run baseline:update`                                     | **Blocking** — an alias root added or removed, **and** any change to the per-package counts.                         |
| `bundle-baseline.json` | Per-package JS total, CSS total (incl. the core CSS bundle), asset/chunk counts and largest assets, plus a project total.                | `npm run analyze:bundle` then `npm run baseline:bundle`       | **Informational** — byte counts are reported, never gated.                                                           |

### Blocking vs informational

`knip:check` and `baseline:check` are the two checks that can fail CI:

- **Blocking** — any difference between a tree-derived baseline and what its generator produces for
  the current tree. That means a structural **set** change (route path, emitted chunk name, alias
  root), an alias usage **count** change, a knip finding **new** to the baseline, **and** a knip
  baseline entry that is no longer reported. All exit non-zero.
- **Informational** — bundle byte counts only. `baseline:check` prints them as a report and never
  fails on them: they require a full `analyze:bundle` run and vary with the build environment, so
  gating them would flake. The ">5% growth → escalate" judgement on those is left to the human or
  agent reading the report.

Bundle measurements are production builds only: each package's `build:analyze` script pins
`NODE_ENV=production` (webpack's minify/devtool switch keys on it via `IS_RELEASE`, not on
`--mode`), because a dev-mode eval-source-map build inflates byte counts ~4–8× and is not
comparable to a committed baseline.

The blocking direction includes **shrinkage**, which is not a bug — it is the expected result of a
deletion PR. The failure is not "you removed something", it is "you removed something and did not
bank it". Regenerate, commit, and the check passes with a baseline diff that shows a reviewer exactly
what the change removed.

### Every change regenerates what it moved

`knip:check` and `baseline:check` compare the committed baselines against what their generators
produce for the tree in front of them, and fail on **any** difference in a tree-derived baseline —
including a byte-level difference in a field with no dedicated diff, so a snapshot field added later
is covered automatically.

So the workflow for every Workstream C / M1 change is:

```
npm run knip:baseline          # if the change moved knip's findings
npm run build:all              # chunk names need a real dist/
npm run baseline:update        # route map, alias usage, chunk names
npm run analyze:bundle && npm run baseline:bundle   # informational, refresh when convenient
```

then commit the regenerated `docs/baselines/*.json` **in the same PR as the code change**. The
baseline diff is part of the deliverable, not cleanup afterwards: it is the reviewable record of what
the change removed, and it keeps the gate tightening as the cleanup proceeds rather than leaving an
allowlist that permits more than it needs to.

A generator change counts too: if the counting or normalisation logic is edited, regenerate in the
same commit. The byte-level backstop is what catches that case — it is what would have caught the
stale alias counts that shipped in `5d1ab14968`.

Never regenerate as a reflex to make CI green. Read the diff first: if the baseline shrank because
the change deleted code, bank it; if it moved in a way the change does not explain, the check just
caught a bug.

### How the checks read the baselines

- `npm run knip:check` — runs knip, normalises its findings, and set-diffs them against
  `knip-baseline.json`. Read-only; it never writes the baseline. Fails only on new findings.
- `npm run baseline:check` — regenerates the route map, alias inventory and (if `dist/` exists) the
  emitted chunk names, and diffs the sets against the committed snapshots. Read-only. Without
  `dist/` it runs in structural-only mode (route map + alias roots) and skips the chunk assertion
  with a logged notice; the full chunk assertion runs in CI's build job, which has `dist/`.

When a deletion PR legitimately removes code, regenerate the affected baseline with the command
above and commit the smaller baseline alongside the deletion.

## VERIFY gate (CSN-006)

Every later Workstream C and package-merge change is checked against this per-commit VERIFY gate:

```
npm run build:all && npm run test:jest && <lint> && npm run knip:check && npm run baseline:check
```

where `<lint>` is the repo's existing `npm run test:stylelint` + `npm run test:eslint-all`. Both new
checks are wired into `.github/workflows/test.yml`: `knip:check` and `baseline:check` in the
`validate` job, and the full chunk assertion (`baseline:check` after `Build`) in the `build` job.
end-to-end and manual regression stay PR-level and QA-owned via the existing release process and are
not part of this gate.

The unit tests for the safety-net scripts run via `npm run test:scripts`.

Because both checks now fail on unbanked drift in either direction, a change that touches shipped
code is only VERIFY-clean once its regenerated baselines are committed alongside it.

## M0 pre-flight — branch status

**Confirmed on 2026-08-27** by the change author (nijil@regentmarkets.com). The C0 safety net is
established against `master`; it has no merge dependency of its own. The verified facts below are the
recorded M0 branch-status confirmation, and the M1 re-baseline gate is the standing pre-condition
that merge-dependent work relies on.

- **Baselines reflect `master` (git-evidenced).** The safety net was implemented on branch
  `refactor/c0-safety-net-knip-bundle-structural`, which is level with `master` — 0 commits ahead,
  0 behind (`git rev-list --left-right --count master...HEAD` → `0  0`). Every baseline in this
  directory was generated from that tree, so it is a faithful snapshot of `master` at this date.
- **C0 does not wait on in-flight branches.** This is an active monorepo with many feature branches
  ahead of `master` at any time; requiring them all to be merged first is neither achievable nor
  necessary for C0. C0's job is to fix the reference point (the committed baselines against
  `master`), which is done.
- **M1 re-baseline gate (the confirmation M1 relies on).** Before merge-dependent M1 (package-merge)
  work begins, regenerate all baselines from the then-current `master` — `npm run knip:baseline`,
  `npm run analyze:bundle` + `npm run baseline:bundle`, and `npm run build:all` +
  `npm run baseline:update` — and record the regeneration date here. Because regeneration is
  deliberate (D7) and `baseline:check` blocks on structural drift, any staleness introduced by
  branches landing after this date surfaces as a **visible, correctable CI failure**, never a silent
  regression. This makes the branch-status risk a gated, self-announcing step rather than an
  unverifiable prerequisite.
