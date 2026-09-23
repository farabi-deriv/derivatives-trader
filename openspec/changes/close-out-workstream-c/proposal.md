## Why

Workstream C (dead-code cleanup, tracking issue #1019) has shipped eight of its nine task groups: C0 built the safety net, C1–C2 and C5 did the store surgery, C6 fixed the bugs the audits surfaced, C7/C8-small/C8-core-trader swept the packages, and C10 removed the mobile bridge. Issue **#1269 (C3-C4-C9)** is the last one open, and it exists because three kinds of debt survive a deletion programme: product decisions that were gated on a human answer and are now settled, guardrails that must be proven still closing behind every deletion, and the test layer the deletions themselves distorted.

The third is the sharpest. The C PRs added ~1,700 lines of specs whose only subject is code that no longer exists — `expectGone([...])`, `expect(module).not.toContain('…')`, `expect(() => require.resolve('../start-date')).toThrow()`. Tests that pin the absence of dead code are themselves dead code: a deletion is already proven by the build (a surviving import fails to compile), by the knip ratchet (anything re-orphaned fails `knip:check`) and by the pre-existing suites staying green. Left in place they are permanent drag — every future refactor of a neighbouring file has to satisfy a source-text grep that asserts a 2026 deletion still happened.

## What Changes

**C3 — formerly-gated product decisions, all answered 26 Aug 2026, now ordinary work**

- **(a)** Delete the unreachable account-verification modal. The trading API service is unaware of POI/POA status, so `PleaseAuthenticate` cannot be returned by the four endpoints (`buy`/`sell`/`cancel`/`contract_update`) that feed `setServicesError` — the modal has no reachable path. Removes the component, its spec, the `PleaseAuthenticate` switch arm in `services-error-modal.tsx` and its spec case, the `PleaseAuthenticate` clause in `common-store.js`'s mobile gate, and the orphaned SCSS block in `trading.scss`.
- **(b)** The cosmetic renames (`dt_traders_hub_*` testids, `traders-hub-header__*` and `--pre-appstore` CSS) are **already absent** from `packages/` and `playwright/` — earlier C passes took them with the components that carried them. The bullet resolves to a recorded re-verification plus deletion of the one dead residue that survived: the consumer-less `&-tradershub` modifier in `page-overlay.scss`. **No Playwright or RTL assertion changes** — so the "requires C0's green Playwright baseline" precondition is discharged vacuously rather than tested against a rename.
- **(c)** Delete the stale cashier fields `min_withdrawal`, `pa_min_withdrawal` and `pa_max_withdrawal` from the live `CryptoConfig` in `shared/src/utils/currency/currency.ts`. The gating grep is clean: no reader exists in any package or in `playwright/`. Statement rendering — the protected transaction-history path — reads none of them.
- **(d)** No code change. The 10 filtered trade types stay settled: the `tradeTypeIcons` entries and `icon-trade-types.tsx` switch arms are KEPT permanently. Recorded in the spec so it is not re-raised.

**C4 — guardrails: make the cleanup stick**

- Re-verify (not re-implement) that `knip:check` and `baseline:check` are still wired into `.github/workflows/test.yml` and still blocking.
- Harden `scripts/knip-check.js`, which spawns a bare `npx knip`. With the pinned `knip@5.88.1` missing from `node_modules` that silently fetches and runs `knip@latest` (6.x), diffing a knip-6 run against a knip-5 baseline and producing spurious drift — a gate that can compare across majors is not reliably blocking. It SHALL resolve the workspace-installed knip and fail loudly when it is absent.
- Remove the stale `packages/api-v2` references left in `.github/workflows/test.yml` (the `tsc` project list and the test matrix) and `.github/CODEOWNERS`; the package was deleted in C1. The separate no-op-`wait` defect in that step stays deferred.
- Correct CLAUDE.md's architecture section — the RootStore list still names the deleted `traders_hub` and a non-existent `active_symbols` store and omits `chart_barrier_store` — and add Workstream S's S0 growth-stopping rule to Gotchas: _new derived value ⇒ `computed`, never observable+reaction; new field ⇒ exactly one writer_.

**C9 — test-layer hygiene**

- Delete the removal-confirmation specs the C PRs added: the eight package-level `dead-code-sweep.spec.ts` files (none of which render anything — every assertion is `fs.existsSync`/`readFileSync` source-text), `dead-helpers.spec.ts`, `mobile-bridge-removal.spec.ts`, `smc-016-cleanup.spec.ts`, the `[DCR-001]` barrel case in `useDebounce.spec.tsx`, and the `[ABF-001]`/`[ABF-015]` blocks in `scripts/__tests__/c6-audit-bug-fixes.spec.js`. The one genuine behaviour case caught up in them — `CommonStore.showError` routing through `setError` — moves into the existing `common-store.spec.ts` rather than dying with its host file.
- Rename the ten spec files whose name does not match the module they test (typos `arrow-buton`/`swipeable-wraper`/`descriptioon`, underscore separators, wrong module name, wrong case, wrong extension).
- Record zero skipped tests: `describe.skip`/`it.skip`/`xit`/`it.todo` return no hits in `packages/` at HEAD, so C9's "resolve the 5 skipped tests" is already discharged; the spec pins it so it stays that way. (`playwright/`'s `test.skip(cond, reason)` calls are runtime viewport gates, not skipped tests.)
- **No new specs confirming any removal** — including the deletions in this change. That prohibition becomes a requirement, not a note.

## Capabilities

### New Capabilities

- `test-suite-hygiene`: what the repository's Jest suite may and may not assert — no test may exist whose only subject is absent code, spec file names track the module under test, and no test is left skipped without a recorded reason.

### Modified Capabilities

- `dead-code-removal`: adds the three settled C3 product decisions (unreachable verification modal, the re-verified-absent cosmetic renames plus the dead `tradershub` SCSS modifier, the reader-less cashier currency fields) and pins the permanent KEEP of the filtered trade types' icons.
- `cleanup-safety-net`: adds the guardrail re-verification pass, requires `knip:check` to run the workspace-pinned knip rather than whatever `npx` resolves, and requires the architecture documentation to match the shipped store graph and to carry the S0 growth-stopping rule.

## Impact

- **Deleted:** `packages/reports/.../ServicesErrorModal/account-verification-required-modal.tsx` (+ spec); 11 removal-confirmation spec files across `packages/api`, `components`, `core`, `reports`, `shared`, `stores`, `trader`, `utils`; ~1,700 test LOC.
- **Edited:** `services-error-modal.tsx` (+ spec), `packages/core/src/Stores/common-store.js`, `packages/core/src/Stores/__tests__/common-store.spec.ts`, `packages/trader/src/sass/app/modules/trading.scss`, `packages/components/src/components/page-overlay/page-overlay.scss`, `packages/shared/src/utils/currency/currency.ts`, `packages/api/src/hooks/__tests__/useDebounce.spec.tsx`, `scripts/knip-check.js` (+ its spec), `scripts/__tests__/c6-audit-bug-fixes.spec.js`, `.github/workflows/test.yml`, `.github/CODEOWNERS`, `CLAUDE.md`.
- **Renamed:** 10 spec files (git mv; no content change beyond the extension fix).
- **Regenerated:** `docs/baselines/knip-baseline.json` — deleting spec files moves knip's finding set, and `dead-helpers.spec.ts`'s deletion-assertions are banked in the current baseline.
- **No runtime behaviour change** for any reachable path. The one product-visible switch arm removed (`PleaseAuthenticate`) is unreachable by backend contract; if the code ever did arrive, `ServicesErrorModal` now falls through to its generic error modal rather than a modal whose only button does nothing.
- **Closes** Workstream C: with #1269 done, tracking issue #1019 has no open task-group issues.
