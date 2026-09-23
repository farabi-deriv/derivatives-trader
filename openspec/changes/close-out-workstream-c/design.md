## Context

See `proposal.md` — Why. What shapes the approach here is that three of this change's four "delete X" instructions turned out to be already-done or differently-shaped once re-verified at HEAD, and the honest handling of each differs.

Measured at HEAD on branch `refactor/close-out-workstream-c`:

| Issue #1269 instruction                                                    | State at HEAD                                                                                                                                                  | Consequence                                                      |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| C3(a) delete `account-verification-required-modal`                         | Present: component, spec, `services-error-modal.tsx:62` switch arm + spec case, `common-store.js:194` gate clause, `trading.scss:124` block                    | Ordinary deletion, five call sites                               |
| C3(b) rename `dt_traders_hub_*`, `traders-hub-header__*`, `--pre-appstore` | **Zero** occurrences of all three in `packages/` and `playwright/`; one residue: `page-overlay.scss:97` `&-tradershub`, no consumer                            | Re-verify + delete one dead SCSS modifier; **no selector edits** |
| C3(c) delete `min_withdrawal` / `pa_*`                                     | Present in 15 `CryptoConfig` entries; **zero** readers repo-wide                                                                                               | Grep gate passes, delete                                         |
| C4 knip + baseline gates                                                   | Both wired in `.github/workflows/test.yml` (`knip:check` L58, `baseline:check` L29/L67); `scripts/__tests__/safety-net-wiring.spec.js` already asserts CSN-006 | Verify only — plus one real defect (below)                       |
| C9 "5 skipped tests"                                                       | **Zero** `it.skip`/`describe.skip`/`xit`/`it.todo` in `packages/`                                                                                              | Already discharged; pin it                                       |
| C9 "16 misnamed spec files"                                                | 10 provable at HEAD by subject-import comparison                                                                                                               | Rename the 10; the audit's count is not reproducible at HEAD     |
| C9 removal-confirmation specs                                              | 11 files, ~1,700 LOC                                                                                                                                           | The bulk of the change                                           |

Two constraints frame the work:

- **`scripts/knip-check.js:149` spawns a bare `npx knip`.** With the pinned `knip@5.88.1` absent from `node_modules`, `npx` fetches and runs `knip@latest` (6.x), which reports a materially different finding set — a knip-6 run diffed against a knip-5 baseline produced 86 stale / 14 new spurious drift during the C5 run (recorded in `docs/spec-to-pr/findings/knip-check-npx-version-resolution.md`). This change deletes 11 spec files, so it _must_ regenerate the baseline; regenerating it under the wrong major would bank false positives that CI immediately rejects.
- **Deleting a spec file is not free of gate consequences.** `dead-helpers.spec.ts`'s three `require.resolve(...).toThrow()` deletion-assertions are banked in the current `docs/baselines/knip-baseline.json`. The baseline must be regenerated after the deletions, under the pinned tool, in the same commit.

## Goals / Non-Goals

**Goals:**

- Close #1269 with every checkbox genuinely ticked, distinguishing _done_ from _already true_ from _not reproducible at HEAD_ rather than silently conflating them.
- Leave the test layer smaller and honest: every surviving test exercises code that exists.
- Make the knip gate version-safe before it is used to certify this change's own deletions.

**Non-Goals:**

- Turning the CI `Check TypeScript` step into a real gate. The bare `wait` discards every child's exit status, and the four largest packages are not targeted; enabling it surfaces a large pre-existing error baseline (`packages/shared` alone reports ~1,705 lines of `tsc` output). Already deferred in `docs/spec-to-pr/deferrals/ci-typescript-gate-is-a-no-op.md`; this change fixes only the stale `packages/api-v2` reference inside it.
- Any change to `playwright/`. QA owns that tree; see Decision 5.
- Re-litigating C3(d). The filtered trade types' icons are a permanent KEEP; DCR-056 records it so it stops being re-raised.
- Chasing the audit's "16 misnamed spec files" to exactly 16. Ten are provable at HEAD by a reproducible rule; inventing six more to match a count would be worse than reporting the number.

## Decisions

### D1 — Delete the sweep specs whole, rescue the one behaviour test by moving it

Every one of the eight `dead-code-sweep.spec.ts` files imports no testing library and calls `render()` zero times: all 196 assertions are `fs.existsSync` / `readFileSync().toContain()` against source text. So are `dead-helpers.spec.ts` and `mobile-bridge-removal.spec.ts`. These die whole.

The "should keep …" cases inside them die too, and that is deliberate: pinning that a live symbol is still _mentioned in a source file_ is the same construct as pinning that a dead one is not — it proves nothing a compile or a behaviour test does not prove better, and it freezes file layout against future refactors.

`smc-016-cleanup.spec.ts` is the exception. It instantiates real stores, and one of its cases is a genuine behaviour test: `common.showError({message})` → asserts `has_error`, `error.type`, `error.message`. `showError` is live (`AppV2/Hooks/useActiveSymbols.ts:22` destructures it; see `docs/spec-to-pr/findings/smc-016-common-store-showerror-not-dead.md`), so that coverage is worth keeping. `packages/core/src/Stores/__tests__/common-store.spec.ts` already exists, so the case moves there — a move, not a new test, so TSH-002 is not violated.

_Alternative considered:_ gut each file to its "keep" assertions. Rejected — it preserves the worst property of these specs (source-text coupling) while losing the only thing that made them legible (their DCR/SMC provenance).

### D2 — Rename by a reproducible rule, and state the rule

The rename set is derived, not hand-picked: for each spec under a `__tests__/` directory, take its single local subject import (`from '../<module>'`, excluding `../index`); if the spec's basename differs from that module's, it is misnamed. That rule yields exactly ten, each a typo, a separator slip, a wrong module name, a case mismatch or a wrong extension:

| Current                                                                     | →                                            | Subject import                         |
| --------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------- |
| `collapsible/__tests__/arrow-buton.spec.tsx`                                | `arrow-button.spec.tsx`                      | `../arrow-button`                      |
| `swipeable-wrapper/__tests__/swipeable-wraper.spec.tsx`                     | `swipeable-wrapper.spec.tsx`                 | `../swipeable-wrapper`                 |
| `ContractDescription/__tests__/matches-differs-trade-descriptioon.spec.tsx` | `matches-differs-trade-description.spec.tsx` | `../matches-differs-trade-description` |
| `ContractDescription/__tests__/multiplier-trade-description.spec.tsx`       | `multipliers-trade-description.spec.tsx`     | `../multipliers-trade-description`     |
| `Duration/__tests__/duration_container.spec.tsx`                            | `container.spec.tsx`                         | `../container`                         |
| `RiskManagement/__tests__/risk_management-picker.spec.tsx`                  | `risk-management-picker.spec.tsx`            | `../risk-management-picker`            |
| `Shared/__tests__/trade-parameter-popover.spec.tsx`                         | `TradeParameterPopover.spec.tsx`             | `../TradeParameterPopover`             |
| `validator/__tests__/error.spec.tsx`                                        | `errors.spec.ts`                             | `../errors` (no JSX in file)           |
| `AppV2/Utils/__tests__/trade-param-utils.spec.tsx`                          | `trade-params-utils.spec.tsx`                | `../trade-params-utils`                |
| `reports/Stores/__tests__/use-reports-stores.spec.tsx`                      | `useReportsStores.spec.tsx`                  | `Stores/useReportsStores`              |

The rule deliberately spares topic-scoped specs — `barrier-support.spec.ts`, `trade-store-daily-expiry.spec.ts`, `market-tabs-layout.spec.ts` and friends name an aspect of a larger module, which TSH-003 permits. `duration.spec.tsx` imports both `../index` and `../duration-desktop` and is correctly named. All ten targets are collision-free.

### D3 — Fix knip resolution before regenerating the baseline

`runKnip()` changes from `spawnSync('npx', ['knip', …])` to resolving the workspace binary — `require.resolve('knip/package.json')`, read its `bin`, spawn `process.execPath` on it — and throwing a named error when resolution fails. `npx --no-install knip` is the cheaper alternative and also fails fast, but it still routes through `npx`'s own resolution order; resolving through Node's module resolution is the thing that cannot silently pick a different major.

This lands **before** the deletions, so the baseline regenerated at the end of the change is produced by the pinned 5.88.1 and diffs only against like. `scripts/__tests__/knip-check.spec.js` already exercises `parseKnipResult` in isolation, so the resolver is exported the same way and tested the same way.

### D4 — `test.yml` loses its `api-v2` references; its exit-status defect stays deferred

Two edits, both pure stale-reference removal for a package C1 deleted: drop the `packages/api-v2/tsconfig.json` line from the `Check TypeScript` step, and drop `packages/api-v2` from the group-4 test matrix. Same for the `/packages/api-v2/` block in `.github/CODEOWNERS` — which also carries a `# Package: api (Deprecated) / Do not use. For -v2 projects use api-v2.` heading over the _live_ `/packages/api/` rule, now advice to use a package that does not exist. The rule stays; the heading is corrected. The step's real defect — a bare `wait` that discards child exit codes, plus four large packages not covered — is a different change with a different blast radius and stays in its existing deferral, which this change updates to record that the `api-v2` half is now fixed.

`scripts/check-imports.js` keeps its `@deriv/api-v2` forbidden-import entries: those are a guard against reintroduction, not a stale reference, and it is a C0 safety-net script.

### D5 — `playwright/` is not touched

`playwright/pages/NotificationsPage.ts`'s bell locators and `playwright/tests/notifications/verify-no-bell-on-trade-page.spec.ts` are dead test code by the same definition TSH-001 uses — the `ShowNotifications` / `NotificationsDialog` components they target were deleted by C8, and the spec's whole subject is the bell's absence. They are nonetheless out of scope: the spec was added by QA PR #1265, not by a Workstream C PR, and #1269's C9 bullet is scoped to "every merged and open Workstream C PR". Deleting QA-owned E2E coverage from an app-team cleanup PR is the wrong call even when the coverage is vacuous. Recorded as a deferral.

### D6 — CLAUDE.md is corrected against the constructor, not against memory

`packages/core/src/Stores/index.js` constructs: `client`, `common`, `modules`, `ui`, `gtm`, `notifications`, `portfolio`, `contract_replay`, `contract_trade`, `chart_barrier_store`. CLAUDE.md's two store lists name `traders_hub` (deleted with `traders-hub-store.js`) and `active_symbols` (never a root member) and omit `chart_barrier_store`. Both lists are rewritten to the constructor. The `api-v2` half of C4's bullet is already satisfied — CLAUDE.md has no `api-v2` mention at HEAD.

The S0 rule joins the existing `# Gotchas` section, phrased as the issue states it.

## Risks / Trade-offs

- **Deleting ~1,700 test LOC could hide a real regression that only those specs caught.** → They catch nothing a compile does not: every assertion is a source-text or filesystem predicate, none renders or calls anything (verified: zero `render(` and zero `@testing-library` imports across all eight sweep files). The one exception is rescued by D1.
- **Regenerating `knip-baseline.json` could bank a false positive.** → D3 lands first, so the regeneration runs under the pinned 5.88.1; the regenerated diff is reviewed for entries attributable only to deleted/renamed files (TSH-005).
- **Removing the `PleaseAuthenticate` arm changes behaviour if the backend contract is wrong.** → It degrades to the generic error modal, which shows the mapped error message and an OK button. The deleted modal's only button had an empty handler with a `// TODO: Either redirect to POI or remove this modal completely` — so the fallback is strictly better than the modal it replaces even in the impossible case.
- **The renames churn ten spec paths and may collide with in-flight branches.** → Pure `git mv` with no content change (except the one extension fix), so a conflict resolves trivially; all ten destinations are verified free.
- **`stylelint` may flag the page-overlay edit.** → `npm run test:stylelint` runs in the gate; the modifier is a leaf rule with no nested content beyond one declaration.

## Migration Plan

No runtime migration. The ordering that matters is: knip resolution fix → C3/C4 source deletions → C9 spec deletions and renames → regenerate `knip-baseline.json` → full gate (`build:all`, `test:jest`, `check-imports`, `knip:check`, `baseline:check`, `test:scripts`, `test:eslint-all`, `test:stylelint`). Rollback is `git revert` of the single commit; nothing here is stateful.
