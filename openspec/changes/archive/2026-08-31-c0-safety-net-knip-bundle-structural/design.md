## Context

Workstream C deletes dead code and M1 merges packages. Both need an oracle that distinguishes a safe deletion from a structural regression. The repo already has the raw ingredients but no oracle:

- `analyze:bundle` (root) fans out to per-package `build:analyze` (webpack with `ANALYZE_BUNDLE=true`), emitting **gitignored** `bundle-report.html` + `bundle-stats.json` per package, then `scripts/bundle-summary.js` prints a console summary. Nothing is committed.
- Alias roots are defined in `packages/{trader,core,reports}/build/constants.js` `ALIASES` and mirrored in each package's `tsconfig.json` `paths` and jest `moduleNameMapper`. ~404 source files import through them (trader 342, core 32, reports 30 — `docs/baselines/alias-usage.json` is the source of truth; these counts shrink as cleanup proceeds).
- Chunk names come from `webpackChunkName` magic comments plus output templates: `trader/js/trader.[name].[contenthash].js`, `reports/js/reports.[name].[contenthash].js`, `js/core.[name].[contenthash].js`. Builds land in each package's `dist/`.
- Routes are config-based: `packages/core/src/App/Constants/routes-config.js`, `packages/reports/src/Constants/routes-config.tsx`, `packages/trader/src/AppV2/Routes/routes.tsx`.
- CI is `.github/workflows/test.yml` (`build` / `validate` / `test` jobs). `docs/baselines/` exists but is empty.
- `knip` is not installed.

## Goals / Non-Goals

**Goals:**

- Commit a knip baseline + `knip:check` that fails only on findings NEW vs. baseline.
- Commit a bundle-size snapshot as the informational byte-count comparison point.
- Commit structural snapshots (route map, chunk names, alias inventory) + `baseline:check` that blocks on structural set drift.
- Wire both checks into CI and make them runnable by agents.
- Record M0 pre-flight (alias counts, route/chunk snapshots, branch status).

**Non-Goals:**

- No deletions or product-code changes (that is the rest of Workstream C).
- No hard byte-size gate — growth is reported, escalation is a human/agent judgement.
- No new e2e/manual regression in the gate — that stays QA-owned via the release process.

## Decisions

**D1 — Store baselines under `docs/baselines/` as committed derived artifacts.** The raw `bundle-stats.json`/`bundle-report.html` stay gitignored; the committed baseline is a small derived JSON. Alternative (commit raw stats) rejected: large, noisy, and `.gitignore` already excludes them.

**D2 — knip via a diff wrapper, not knip's own output as the gate.** knip 5.x has no native "fail only on new findings" baseline. `scripts/knip-check.js` runs `knip --reporter json`, normalises (sort entries, strip absolute paths/timestamps to repo-relative), and set-diffs against `docs/baselines/knip-baseline.json`; non-empty "new" set → exit 1. `--update` writes the baseline. Alternative (fail on ANY finding) rejected: the repo starts with a large known-unused set the workstream will delete incrementally; a plain gate would be red from day one. Alternative (knip `--no-exit-code` + manual review) rejected: not machine-verifiable in CI.

**D3 — knip resolves aliases through per-workspace `tsconfig.json`.** The webpack `ALIASES` are mirrored in each package's tsconfig `paths`; knip reads tsconfig per workspace automatically. `knip.json` declares each `packages/*` workspace with `entry` (package `src` entry + `build/webpack.config.js` + `jest.config.js`) and `project` globs, plus root `scripts/*.js` as entry. Any alias root NOT present in a tsconfig `paths` is added to knip's `paths` explicitly so the resolved graph matches webpack's. This is verified by the CSN-001 "resolves the alias graph" scenario before the baseline is trusted.

**D4 — Chunk-name snapshot = logical names read from `dist/`, contenthash stripped.** After `build:all`, `baseline-check.js` lists `packages/{trader,reports,core}/dist/**/*.js`, strips the `[contenthash]` segment, and takes the sorted set of logical names. This reflects _emitted_ chunks (what M1 must preserve), not just source magic-comments. Alternative (grep `webpackChunkName` comments) rejected: misses split-chunk cache-group names (`vendor`, `quill-ui-vendor`, `vendors`) and entry chunks. Because it reads `dist/`, `baseline:check`'s chunk assertion requires a prior `build:all` — which per-commit VERIFY already runs.

**D5 — Route map = `path` literals extracted from the three route-config files.** The configs import aliases/React and cannot be `require()`d in a bare node script, so `baseline-check.js` extracts route `path:` string literals by a scoped regex over those three files and diffs the sorted set. This is a structural drift detector, not a router; that is sufficient for "a route disappeared" detection.

**D6 — Structural SET drift blocks; magnitudes are informational.** `baseline:check` exits non-zero only when a _set_ changes (route path / chunk name / alias root added or removed). Bundle byte counts and per-package alias usage counts are printed but never fail the process, matching the issue's ">5% growth → escalate is a reader judgement" rule.

**D7 — Baselines regenerate only via explicit `--update` commands.** `knip:check`/`baseline:check` are read-only; `knip:baseline`, `baseline:bundle`, `baseline:update` are the deliberate regeneration commands, documented in `docs/baselines/README.md`. This prevents a deletion run from implicitly masking a regression.

**D8 — Wire into the `validate` job in `test.yml`.** `knip:check` and `baseline:check` are added to the existing `validate` job (alongside `check-imports` and lint). `baseline:check`'s chunk assertion depends on build output; where the `validate` job has no `dist/`, `baseline:check` runs in structural-only mode for route map + alias inventory and skips the chunk assertion with a logged notice, while the full chunk assertion runs in the `build` job (which produces `dist/`). The exact job placement is an implementation detail captured in tasks.

## Risks / Trade-offs

- **[knip false positives inflate the baseline]** → The baseline is explicitly a "known-unused" set, not an assertion of correctness; D2's diff only gates _new_ findings, and the workstream shrinks the baseline deliberately as it deletes. The CSN-001 alias-resolution scenario guards against the worst false-positive class (aliased-but-used flagged unused).
- **[Regex route/alias extraction is approximate]** → Acceptable: it is a drift _detector_, not a parser. A false "drift" is a cheap, visible CI failure a human resolves by `baseline:update`; a missed drift is caught later by `build:all`/tests. Kept simple per KISS.
- **[Chunk snapshot needs a build]** → `baseline:check` degrades gracefully (structural-only) without `dist/` and asserts chunks fully in the build job; per-commit VERIFY runs `build:all` regardless.
- **[Contenthash churn]** → Stripped before diffing, so content-only changes never read as chunk-name drift.
- **[knip version drift]** → `knip` pinned via `package-lock.json`; the resolved 5.x version is recorded in the README so baseline reproducibility is traceable.

## Migration Plan

Additive only. Land the scripts, config, committed baselines and CI steps together. Rollback = revert the PR; no product code or data is touched. First CI run after merge is green by construction (baselines are generated from the same tree). No feature flag (tooling, not runtime behaviour).

## Open Questions

See `tasks.md` "Open Questions" — the two decision-changing ones (baseline storage format/location and knip's initial gating stance) are resolved there with recommended defaults and the plan proceeds on them.
