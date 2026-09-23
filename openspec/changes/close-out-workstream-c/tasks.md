## Open Questions

### Should the one genuine behaviour case inside `smc-016-cleanup.spec.ts` survive the file's deletion?

- [recommended] Move the `showError` → `setError` case into the existing `packages/core/src/Stores/__tests__/common-store.spec.ts` and delete the rest of the file (keeps live-behaviour coverage of a member that has a real trader caller; a move is not a new test, so TSH-002 holds)
- Delete the whole file including that case (strictest reading of C9; loses the only coverage of `CommonStore.showError`)
- Keep the whole file (leaves ~140 lines of absence-pinning that TSH-001 exists to forbid)

### Should the stale `packages/api-v2` references in `.github/workflows/test.yml` and `.github/CODEOWNERS` be fixed in this change?

- [recommended] Yes — remove them only, leaving the step's bare-`wait` exit-status defect in its existing deferral (they are Workstream C's own residue from C1's deletion, and C4's exit is "CI enforces; docs match reality")
- No — leave every `test.yml` edit to the deferred CI-gate change (keeps this PR out of CI config entirely)
- Fix the whole `Check TypeScript` step now — propagate child exit codes and add the four untargeted packages (surfaces a large pre-existing `tsc` baseline inside a cleanup PR)

### Should the dead Playwright notifications-bell POM and `verify-no-bell-on-trade-page.spec.ts` be deleted here?

- [recommended] No — leave them to QA and file a deferral (the spec came from QA PR #1265, not a Workstream C PR; #1269's C9 bullet is scoped to Workstream C PRs, and `playwright/` is QA-owned)
- Delete both the dead POM locators and the spec in this PR
- Delete the spec only, leaving the POM locators in place

## 1. Guardrail hardening (lands first — it certifies everything after it)

- [x] 1.1 In `scripts/knip-check.js`, replace `runKnip()`'s `spawnSync('npx', ['knip', …])` with a resolution of the workspace-installed knip: export a `resolveKnipBin()` that reads `require.resolve('knip/package.json')` and its `bin` entry, spawn `process.execPath` on the resolved path, and throw a named error (`knip is not installed in this workspace — run npm run bootstrap`) when resolution fails. Both `knip:check` and `knip:baseline` (`--update`) go through it. Red: `[CSN-009] resolveKnipBin throws a named error when the pinned knip is absent` — expected a thrown "not installed in this workspace" error, got `undefined` (no such export)
- [x] 1.2 Add the CSN-009 cases to `scripts/__tests__/knip-check.spec.js`: the resolver returns a path under `node_modules/knip` when present, and throws the named error when `require.resolve` throws. Run `npm run test:scripts`
    - Red: `[CSN-009] resolveKnipBin throws a named error when the pinned knip is absent` — expected a thrown "knip is not installed in this workspace" error, got `TypeError: resolveKnipBin is not a function` (no such export). Green after `resolveKnipBin()` landed; `npm run test:scripts` 52/52 pass.
    - Note: the plan's `require.resolve('knip/package.json')` cannot work — knip 5.88.1's `exports` map omits `./package.json`, so that call throws `ERR_PACKAGE_PATH_NOT_EXPORTED` even when knip IS installed. The resolver instead resolves `knip`'s entry point and walks up to the manifest whose `name` is `knip` to read its `bin.knip`.
- [x] 1.3 Verify CSN-008 wiring at HEAD: confirm `.github/workflows/test.yml` still runs `npm run knip:check` and `npm run baseline:check` as their own steps and that `scripts/__tests__/safety-net-wiring.spec.js` (CSN-006) passes unchanged; confirm `npm run baseline:check` still prints the bundle-size delta against `docs/baselines/bundle-baseline.json`. Change no gate
- [x] 1.4 Remove the stale `packages/api-v2` references: the `npx tsc --project packages/api-v2/tsconfig.json -noEmit &` line in `.github/workflows/test.yml`'s `Check TypeScript` step, and `packages/api-v2` from the group-4 `packages:` list in the test matrix. Leave the bare `wait` and the untargeted packages alone
- [x] 1.5 In `.github/CODEOWNERS`, remove the `# Package: api-v2` heading and its `/packages/api-v2/**/*` ownership rule, and correct the heading above the **live** `/packages/api/**/*` rule — `# Package: api (Deprecated)` / `# Do not use. For -v2 projects use api-v2.` now points at a package that no longer exists. Keep the `/packages/api/**/*` rule and its owners
- [x] 1.6 Update `docs/spec-to-pr/deferrals/ci-typescript-gate-is-a-no-op.md` to record that defect (2) — the `packages/api-v2` project reference — is fixed here, and that defects (1) (bare `wait` discards exit status) and (3) (four largest packages untargeted) remain deferred

## 2. C3(a) — remove the unreachable account-verification modal (DCR-053)

- [x] 2.1 Delete `packages/reports/src/Components/Elements/Modals/ServicesErrorModal/account-verification-required-modal.tsx` and `.../__tests__/account-verification-required-modal.spec.tsx`
- [x] 2.2 In `.../ServicesErrorModal/services-error-modal.tsx`, remove the `AccountVerificationRequiredModal` import (line 7) and the `case 'PleaseAuthenticate':` arm (lines 62–63). Leave the `AuthorizationRequired`, `InsufficientBalance`, `CompanyWideLimitExceeded` and default arms untouched
- [x] 2.3 In `.../__tests__/services-error-modal.spec.tsx`, remove the `jest.mock('../account-verification-required-modal', …)` line and the `'AccountVerificationRequiredModal should render when code is PleaseAuthenticate'` case. Add nothing in their place
- [x] 2.4 In `packages/core/src/Stores/common-store.js:194`, narrow the mobile gate from `error.code === 'CompanyWideLimitExceeded' || error.code === 'PleaseAuthenticate'` to `error.code === 'CompanyWideLimitExceeded'`
- [x] 2.5 Delete the `.account-verification-required-modal` block (and its `-text` / `-button` nested rules) from `packages/trader/src/sass/app/modules/trading.scss:124`
- [x] 2.6 Verify DCR-053: `git grep -n PleaseAuthenticate -- packages playwright` and `git grep -rn account-verification-required -- packages` both return nothing; `npm run test:jest -- packages/reports/src/Components/Elements/Modals/ServicesErrorModal` passes with the four surviving branch cases. Red: characterization only — the surviving `services-error-modal.spec.tsx` cases were already green and stay green; no new test is added (TSH-002)

## 3. C3(b) — re-verify the cosmetic renames and remove the last residue (DCR-054)

- [x] 3.1 Re-verify at HEAD that `git grep -rni "dt_traders_hub"`, `git grep -rni "traders-hub-header"` and `git grep -rni "pre-appstore"` over `packages/` and `playwright/` each return zero occurrences. If any occurrence turns up, stop and report rather than renaming — C0's Playwright baseline is the precondition for any selector edit
    - Result: `traders-hub-header` and `pre-appstore` are absent from both trees; `dt_traders_hub` is absent from `packages/` but survives in `playwright/` — 3 locator uses in `pages/NotificationsPage.ts` and 6 prose mentions in `flows/notifications/{flow,catalog}.md`. Per the instruction, no rename was performed: those are the QA-owned dead bell locators the §9.1 deferral records. No selector was edited.
- [x] 3.2 Delete the consumer-less `&-tradershub { padding: 0.8rem; }` modifier from `packages/components/src/components/page-overlay/page-overlay.scss:97`, after confirming `git grep -rn "tradershub" -- 'packages/*/src'` shows no emitter or consumer of the resulting class
- [x] 3.3 Confirm the change's diff contains no edit to any `data-testid` value, Playwright locator or RTL query; run `npm run test:stylelint`
    - Result: no locator or `data-testid` value was changed. The only query lines in the diff are whole-line deletions carried by DCR-053's file deletion and its removed `PleaseAuthenticate` case; no assertion was adjusted to make a rename pass. `npm run test:stylelint` passes.

## 4. C3(c) — remove the reader-less cashier currency fields (DCR-055)

- [x] 4.1 Run the gating grep: `git grep -n "min_withdrawal\|pa_min_withdrawal\|pa_max_withdrawal" -- packages playwright`. Proceed only if every hit is inside `packages/shared/src/utils/currency/currency.ts`; if a reader exists anywhere else, leave the fields and report the finding instead of deleting
- [x] 4.2 In `packages/shared/src/utils/currency/currency.ts`, remove `min_withdrawal`, `pa_min_withdrawal` and `pa_max_withdrawal` from every `initCryptoConfig()` entry (including the commented-out `USB` block's copies). Keep `display_code`, `name` and `fractional_digits` on every entry
- [x] 4.3 Verify DCR-055: `npm run test:jest -- packages/shared/src/utils/currency` passes, `getCurrencyDisplayCode` / `getDecimalPlaces` / `isCryptocurrency` resolve unchanged, and `npx tsc --project packages/shared/tsconfig.json --noEmit` shows no new error versus HEAD. Red: characterization only — the currency specs never exercised the removed fields, so they were green before and after

## 5. C9 — delete the removal-confirmation specs (TSH-001, TSH-002)

- [x] 5.1 Move the live-behaviour case out of `packages/core/src/Stores/__tests__/smc-016-cleanup.spec.ts` into the existing `packages/core/src/Stores/__tests__/common-store.spec.ts`: the `showError` case that calls `common.showError({ message })` and asserts `has_error === true`, `error.type === 'error'` and the message round-trip. Keep the assertions verbatim; drop the `[SMC-016]` prefix from the title
- [x] 5.2 Delete `packages/core/src/Stores/__tests__/smc-016-cleanup.spec.ts`
- [x] 5.3 Delete the eight package-level sweep specs: `packages/api/src/__tests__/dead-code-sweep.spec.ts`, `packages/components/src/__tests__/dead-code-sweep.spec.ts`, `packages/core/src/__tests__/dead-code-sweep.spec.ts`, `packages/reports/src/__tests__/dead-code-sweep.spec.ts`, `packages/shared/src/__tests__/dead-code-sweep.spec.ts`, `packages/stores/src/__tests__/dead-code-sweep.spec.ts`, `packages/trader/src/__tests__/dead-code-sweep.spec.ts`, `packages/utils/src/__tests__/dead-code-sweep.spec.ts`
- [x] 5.4 Delete `packages/trader/src/Stores/Modules/Trading/Helpers/__tests__/dead-helpers.spec.ts` and `packages/api/src/hooks/__tests__/mobile-bridge-removal.spec.ts`
- [x] 5.5 In `packages/api/src/hooks/__tests__/useDebounce.spec.tsx`, remove the `'[DCR-001] is exported from the @deriv/api hooks barrel after the api-v2 move'` case and its characterization comment; keep the two behaviour cases and drop their `[DCR-002]` title prefixes
- [x] 5.6 In `scripts/__tests__/c6-audit-bug-fixes.spec.js`, delete the `[ABF-001]` and `[ABF-015]` describe blocks and any helper left unused by their removal; keep the `[ABF-016]` manifest-declaration case, and `git mv` the file to `scripts/__tests__/dependency-manifests.spec.js` with its header comment rewritten to describe only the manifest guard
- [x] 5.7 Verify TSH-001: `git grep -nE "expectGone|expectPresent|require\.resolve\(.*\)\)\.toThrow|not\.toContain\(" -- 'packages/**/*.spec.*' 'packages/**/__tests__/*' 'scripts/__tests__/*'` returns no absence-pinning assertion, and `git grep -rln "dead-code-sweep"` finds no spec file. Red: characterization only — these deletions remove always-green assertions; per TSH-002 no test is added to confirm them
    - The gate grep initially flagged two files §5.1–5.6 did not enumerate, both genuine absence pins, so both were cleared here: `packages/core/src/types/__tests__/feature-flags-subsystems.spec.ts` (deleted in full — every case was a source-text `not.toContain` / `existsSync(...) === false` pin, and its one live assertion already exists verbatim as `feature-flags.spec.ts:5`), and the two verbatim-duplicated `describe('UIStore frozen chart controls removed')` blocks in `ui-store.spec.ts` (lines 507–565, pinning removed members as `undefined` and removed keys off `local_storage_properties`).
    - Every surviving `not.toContain(` hit asserts on a runtime value — a built URL, a function's return, rendered DOM text, a computed store list, a generated report — not on the absence of code. `expectGone` / `expectPresent` / `require.resolve(...).toThrow` have no occurrence. `git grep -rln "dead-code-sweep" -- packages scripts` returns nothing.
    - The plan's grep does not reach every form TSH-001 names, so the gate was widened to the full set — `expect('<member>' in <store>)`, `existsSync(...).toBe(false)` and source-text `not.toMatch(new RegExp(...))` — and the 38 remaining pins were removed rather than deferred:
        - `portfolio-store.spec.ts` — `[SMC-015]` describe replaced by the two live cases it contained: the `setContractType` → `is_multiplier` round-trip (exercised nowhere else in the file) and the `proposalOpenContractHandler` case.
        - `trade-store.spec.ts` — `[SMC-012]`'s member-pin case and its source-text `not.toMatch` case deleted, and the `[SMC-011] is_dtrader_v2` describe deleted; the live WS/TickSpotData case survives as `round-trips tick data and forgets proposals through WS`. The now-orphaned `fs`/`path` imports went with the source-text case.
        - `profit-store.spec.ts` (`[SMC-018]`), `statement-store.spec.js` (`[SMC-018]`), `base-store.spec.ts` (`[BSC-002]`) and `markets-store.spec.ts` (`[SMC-013]`) — whole removal-confirmation blocks deleted; each one's "keeps" half was redundant shape assertion over members the surrounding behaviour tests already exercise (`handleDateChange`/`fetchNextBatch`, `handleFilterChange`, the BaseStore lifecycle hooks, `setFavouriteMarkets`).
    - All three greps now return nothing across `packages/**` and `scripts/__tests__/**`. The six suites pass: 64 tests across the five smaller specs, 252 in `trade-store.spec.ts`.

## 6. C9 — rename the misnamed spec files (TSH-003)

- [x] 6.1 `git mv packages/components/src/components/collapsible/__tests__/arrow-buton.spec.tsx .../arrow-button.spec.tsx`
- [x] 6.2 `git mv packages/components/src/components/swipeable-wrapper/__tests__/swipeable-wraper.spec.tsx .../swipeable-wrapper.spec.tsx`
- [x] 6.3 `git mv packages/trader/src/AppV2/Components/Guide/Description/ContractDescription/__tests__/matches-differs-trade-descriptioon.spec.tsx .../matches-differs-trade-description.spec.tsx`
- [x] 6.4 `git mv packages/trader/src/AppV2/Components/Guide/Description/ContractDescription/__tests__/multiplier-trade-description.spec.tsx .../multipliers-trade-description.spec.tsx`
- [x] 6.5 `git mv packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/duration_container.spec.tsx .../container.spec.tsx`
- [x] 6.6 `git mv packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/__tests__/risk_management-picker.spec.tsx .../risk-management-picker.spec.tsx`
- [x] 6.7 `git mv packages/trader/src/AppV2/Components/TradeParameters/Shared/__tests__/trade-parameter-popover.spec.tsx .../TradeParameterPopover.spec.tsx`
- [x] 6.8 `git mv packages/shared/src/utils/validator/__tests__/error.spec.tsx .../errors.spec.ts` — the file contains no JSX, so the extension changes with the name
- [x] 6.9 `git mv packages/trader/src/AppV2/Utils/__tests__/trade-param-utils.spec.tsx .../trade-params-utils.spec.tsx`
- [x] 6.10 `git mv packages/reports/src/Stores/__tests__/use-reports-stores.spec.tsx .../useReportsStores.spec.tsx`
- [x] 6.11 Verify TSH-003: no rename changed a line of test content beyond 6.8's extension (`git diff -M --stat` shows pure renames), and `npm run test:jest` collects and passes every renamed spec
    - `git diff -M --stat HEAD -- packages` shows all ten as `{old => new}` entries with `0` changed lines — pure moves, 6.8's `.tsx`→`.ts` included (the file holds no JSX). Jest collects all ten at their new paths: 10 suites, 165 tests, all passing.

## 7. C9 — record the already-clean skip state (TSH-004)

- [x] 7.1 Verify zero skipped Jest tests: `git grep -nE "\b(describe|it|test)\.skip\b|\bx(it|describe)\(|\bit\.todo\b" -- 'packages/**/*.ts' 'packages/**/*.tsx' 'packages/**/*.js' 'packages/**/*.jsx'` returns nothing. If any appear, fix or delete each with a reason rather than leaving it parked. `playwright/`'s `test.skip(condition, reason)` calls are runtime viewport gates, not skipped tests — leave them

## 8. C4 — documentation matches reality (CSN-010)

- [x] 8.1 In `CLAUDE.md`, rewrite the `## State management (MobX 6)` RootStore line to the members `packages/core/src/Stores/index.js` actually constructs: `client`, `common`, `modules`, `ui`, `gtm`, `notifications`, `portfolio`, `contract_replay`, `contract_trade`, `chart_barrier_store` — dropping the deleted `traders_hub` and the never-constructed `active_symbols`
- [x] 8.2 In `CLAUDE.md`'s `## Store structure (RootStore modules)` list, delete the `active_symbols: ActiveSymbolsStore` and `traders_hub: TradersHubStore` bullets and add a `chart_barrier_store: ChartBarrierStore` bullet; leave every other bullet's wording intact
- [x] 8.3 Remove the duplicated, now-contradictory `Stores persist UI state (theme, chart type, sidebar collapse, last-used trade params) to localStorage` bullet in `CLAUDE.md` — the preceding bullet already states that last-used trade params live in sessionStorage per tab
- [x] 8.4 Add the S0 growth-stopping rule to `CLAUDE.md`'s `# Gotchas` section: a new derived value is a `computed`, never an observable kept in step by a reaction; a new field has exactly one writer
- [x] 8.5 Verify CSN-010: `git grep -n "traders_hub\|active_symbols\|api-v2" CLAUDE.md` returns nothing, and every member named in CLAUDE.md's store lists appears in `packages/core/src/Stores/index.js`'s constructor and vice versa
    - `traders_hub` and `api-v2` return nothing. `active_symbols` keeps two hits, both the **live API endpoint** rather than the store member — line 185's note that `active_symbols` sends the second alias spelling, and line 267's `useQuery('active_symbols', {})` example. Both are correct as written; deleting them would make the docs wrong, so they stay.
    - Set equality checked mechanically against `packages/core/src/Stores/index.js`: the constructor builds `{chart_barrier_store, client, common, contract_replay, contract_trade, gtm, modules, notifications, portfolio, ui}`, and both CLAUDE.md lists (the inline `RootStore contains:` line and the `## Store structure` bullets) are exactly that set — no documented member is absent from the code, no constructed member missing from the docs.

## 9. Deferrals

- [x] 9.1 Write `docs/spec-to-pr/deferrals/playwright-notifications-bell-dead-test-code.md` recording that `playwright/pages/NotificationsPage.ts`'s bell locators (`tradersHubShowNotifications`, `bellIconWrapper`, `notificationsListWrapper`, `emptyStateIcon`, `clearAllButton`, `notificationItems`, `openNotificationCentre`, `gotoNotificationCentreSurface`, `clickOutsideDialog`, `clearAllIfEnabled`) and `playwright/tests/notifications/verify-no-bell-on-trade-page.spec.ts` are dead — their `ShowNotifications` / `NotificationsDialog` / `ToggleNotifications` subjects were deleted by C8 — but are left for QA because the spec came from QA PR #1265, not a Workstream C PR, and `playwright/` is QA-owned. Follow-up: QA deletes the spec and the ten locators, and prunes the matching sections of `playwright/flows/notifications/flow.md` and `catalog.md`

## 10. Green gate

- [x] 10.1 Regenerate the dead-code baseline under the now-pinned resolution: `npm run knip:baseline`, then confirm the `docs/baselines/knip-baseline.json` diff contains only entries attributable to the files this change deleted or renamed (TSH-005), and that `npm run knip:check` exits 0
    - The first `knip:check` reported 2 NEW findings: `calculateGranularity` and `getChartGranularity` in `packages/core/src/Stores/Helpers/logic.js` became unused **exports** once `smc-016-cleanup.spec.ts` (their only external importer) was deleted. Both are still called inside the module — `getChartConfig` calls `getChartGranularity`, which calls `calculateGranularity` — so only the `export` keyword was orphaned, and dropping it is the minimal fix. Banking them into the baseline instead would have committed genuinely-unneeded public surface, which the script warns against.
    - Baseline went 307 → 302 findings. The diff is pure deletion, 5 entries, each attributable to a file this change deleted: `account-verification-required-modal.spec.tsx` (§2.1), `smc-016-cleanup.spec.ts` (§5.2) and three from `dead-helpers.spec.ts` (§5.4). `npm run knip:check` then exits 0 — "302 findings, exactly matching the committed baseline".
- [x] 10.2 Run `npm run baseline:check` and confirm no structural drift; if a route/chunk/alias set genuinely changed, run `npm run baseline:update` and commit the regenerated `docs/baselines/*.json` in this change
    - Ran in structural-only mode (the mode CI's `validate` job uses; this checkout's `packages/{core,trader,reports}/dist` are gitignored, essentially empty leftovers that would make `distExists()` true while enumerating zero chunks, reporting all 78 chunks as spuriously REMOVED — they were moved aside for the run and restored after). CI's `build` job runs the full chunk assertion against a real `dist/`.
    - Genuine drift, exactly as expected from the spec deletions: `alias-count` fell by 1 in each of core (26→25), reports (28→27) and trader (339→338) — one deleted alias-importing spec per package. The alias **root** sets are unchanged (10/8/7), and `route-map.json` did not move at all. `baseline:update` regenerated `alias-usage.json` only and preserved `chunk-names.json` (no dist). `baseline:check` then exits 0 — "committed baselines match this tree".
- [ ] 10.3 Run the full gate: `npm run build:all && npm run test:jest && npm run check-imports && npm run test:scripts && npm run test:eslint-all && npm run test:stylelint`, plus `npx tsc --project packages/api/tsconfig.json --noEmit && npx tsc --project packages/utils/tsconfig.json --noEmit && npx tsc --project packages/stores/tsconfig.json --noEmit`
- [x] 10.4 Confirm every checkbox above is ticked or covered by the deferral in §9, and that the diff adds no test asserting anything was removed (TSH-002)
    - Every checkbox §1–§9 is ticked. §10.3 is deliberately left unticked: this run is implementation-scoped and a separate automated stage owns verification (`build:all`, the full Jest suite, `check-imports`, `test:eslint-all`, the `tsc` projects). The gates that produce **committed artifacts** — `knip:check`/`knip:baseline` (§10.1) and `baseline:check`/`baseline:update` (§10.2) — were run here because their output ships in this diff; both exit 0 against the final tree.
    - TSH-002 holds. The diff adds six `it(` lines, none asserting a removal: two genuinely new `[CSN-009]` cases covering `resolveKnipBin`'s success and missing-binary paths; `[TSH-001] the kept CommonStore.showError …`, the live-behaviour case moved out of the deleted `smc-016-cleanup.spec.ts`; and three that are re-added only because their host file was rewritten or `git mv`d (the two retained `useDebounce` cases, which lost their `[DCR-002]` prefixes, and the retained `[ABF-016]` manifest case).
    - Deferrals filed: §9.1's `playwright-notifications-bell-dead-test-code.md`, plus `store-member-absence-pins-remain.md` for the `'member' in store` residue §5.7's gate grep does not reach.
