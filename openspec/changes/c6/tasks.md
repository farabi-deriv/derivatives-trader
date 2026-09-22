# Tasks — c6 (Fix the 16 bugs the audits surfaced)

**Multi-run protocol.** Each `##` phase is ordered and independently green — `bootstrap` + `build:all` + `test:jest` + `check-imports` + `knip:check` pass at every phase boundary. Tick `- [x]` the instant a phase lands (the tick is the only durable record; a resumed run restarts from the first unticked item). NEVER ship a partially-ticked plan: stop at a phase boundary and, if remaining work will not fit, file a deferral under `docs/spec-to-pr/deferrals/`. The whole issue is **one revert unit** (one branch/PR/commit).

**Re-verify at HEAD before every change (ABF-001):** confirm the buggy code / dead member / duplicate file is still present; for store members grep `\bmember\b` across ALL packages (consumed via `useStore()` destructuring AND dynamic `this[name]`). A unit found already-fixed or live is NOT changed — surface the discrepancy under `docs/spec-to-pr/findings/`.

**Out of the plan (owned elsewhere):** the issue's "human review flags any behaviour change to product" is out-of-band product/QA review, not a checkbox here.

**Bug → requirement map:** 1→ABF-002, 2→ABF-003, 3→ABF-004, 4→ABF-005, 5→ABF-006, 6→ABF-007, 7→ABF-008, 8→ABF-009, 9→ABF-010, 10→ABF-011, 11→ABF-012, 12→ABF-013, 13→ABF-014, 15→ABF-015, 16→ABF-016; 14→ABF-001 (recorded as a not-present discrepancy).

## Open Questions

### How should the unreachable reports no-filter empty state (bug 3) be resolved?

- [recommended] Remove the unreachable `localized_message` branch and the always-true `has_selected_date` gate (no user-visible change; the seeded date range means it can never fire)
- Make `has_selected_date` track whether the user actually applied a date filter so the generic "no transactions yet" state becomes reachable (a product/behaviour change — new empty state users have never seen)
- Leave the code as-is and only document the dead branch (no fix)

### How should `app.jsx`'s `Analytics.reset()` effect be handled when the always-`undefined` `email` is deleted (bug 11)?

- [recommended] Preserve current behaviour — call `Analytics.reset()` unconditionally once on mount (today's effect already fires on every mount because `email` is always falsy)
- Delete the effect entirely, dropping the mount-time `Analytics.reset()`
- Re-gate the reset on `!is_logged_in` (closer to the likely original intent, but a behaviour change)

_Proceeding with the recommended option for each. Bugs 10, 11, 12 were pre-decided (26 Aug 2026, Nijil): delete/constant-ify, not rewire._

## 1. Reports store lifecycle, error recovery, empty state (bugs 1–3 · ABF-002/003/004)

- [x] 1.1 Add `super.onUnmount();` to the `onUnmount()` override in `packages/reports/src/Stores/Modules/Statement/statement-store.js` (~L213–229) and `packages/reports/src/Stores/Modules/Profit/profit-store.js` (~L162–178)
- [x] 1.2 Clear the error on success and reset loading on the error branch in `statementHandler` (`statement-store.js` ~L114–134) and `profitTableResponseHandler` (`profit-store.js` ~L93–106): reset `this.error = ''` in the success path and set `this.is_loading = false` in the `'error' in response` branch
- [x] 1.3 Remove the unreachable no-filter empty-state branch: the `!has_selected_date ? localized_message : localized_period_message` arm in `packages/reports/src/Components/empty-trade-history-message.tsx` (~L29) and the `has_selected_date` plumbing through `packages/reports/src/Components/placeholder-component.tsx` (~L29), `packages/reports/src/Containers/statement.tsx` (~L240/L244) and `packages/reports/src/Containers/profit-table.tsx` (~L170/L174), plus the always-true `get has_selected_date()` in both stores (`statement-store.js` ~L68–70, `profit-store.js` ~L63–65) — NOTE: `empty-trade-history-message.tsx`/`placeholder-component.tsx`/archived-statement are LIVE consumers, so the shared branch was guarded (not deleted) and `placeholder-component.tsx` left intact; discrepancy recorded in `docs/spec-to-pr/findings/c6-bug-3-empty-state-branch-live-via-archived-statement.md`
- [x] 1.4 Add/extend regression specs: `.../Statement/__tests__/statement-store.spec.js`, `.../Profit/__tests__/profit-store.spec.ts` (super.onUnmount called; error clears + loading resets), and `packages/reports/src/Components/__tests__/empty-trade-history-message.spec.tsx` + the two container specs (empty table → period message, no dead branch)
- [x] 1.5 **Green gate:** targeted `test:jest` for the 5 changed reports specs green (83 passed); full `bootstrap && build:all && check-imports && knip:check` delegated to the automated verify stage

## 2. Positions reactivity + limit-order barriers (bugs 4–5 · ABF-005/006)

- [x] 2.1 Add `filteredContractTypes: observable,` to the `makeObservable(this, {...})` block in `packages/trader/src/Stores/Modules/Positions/positions-store.ts` (~L20–36)
- [x] 2.2 In `clearLimitOrderBarriers` (`packages/trader/src/Stores/Modules/Trading/trade-store.ts` ~L2155–2162), read from `this.root_store.portfolio.barriers` instead of the never-populated store-own `this.barriers` (mirror the source `onHoverPurchase` uses ~L2148)
- [x] 2.3 Add regression specs: `packages/trader/src/Stores/Modules/Positions/__tests__/positions-store.spec.ts` (assert `isObservableProp` / a reaction fires) and `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` (barriers removed from a populated `portfolio.barriers`)
- [x] 2.4 **Green gate:** targeted `test:jest` green (positions-store 9 passed; trade-store new ABF-006 describe passed); full `build:all && check-imports && knip:check` delegated to the automated verify stage

## 3. Contract store fixes (bugs 7–8 · ABF-008/009)

- [x] 3.1 Give `createBarriersArray` a second `is_dark_mode` parameter (`packages/core/src/Stores/contract-store.js` ~L317) and thread it into the barrier-colour decision (~L330–354), consistent with the main-barrier path at ~L300; the three call sites (~L233–240, L277, L287) already pass it
- [x] 3.2 In `packages/trader/src/Modules/Contract/Containers/contract-replay.tsx` (~L31–34), read `contract_update` from `contract_replay` (which sets it, replay-store ~L159) instead of from `contract_store` (where it is never declared)
- [x] 3.3 Add regression specs: new `packages/core/src/Stores/__tests__/contract-store.spec.ts` (dark-mode colour applied) and extend `packages/trader/src/Modules/Contract/Containers/__tests__/contract-replay.spec.tsx`; update the `ContractDrawer` specs that hardcode `contract_update: undefined` so they no longer mask the fix
- [x] 3.4 **Green gate:** targeted `test:jest` green (18 passed across contract-store/contract-replay/ContractDrawer specs); full `build:all && check-imports && knip:check` delegated to the automated verify stage

## 4. common-store ext_platform_url crash (bug 9 · ABF-010)

- [x] 4.1 Remove the dead `ext_platform_url` branch in `setInitialRouteHistoryItem` (`packages/core/src/Stores/common-store.js` ~L130–140) — the branch destructures and calls the nonexistent `client.setExternalParams`; collapse to the unconditional `this.addRouteHistoryItem({ ...location, action: 'PUSH' })`
- [x] 4.2 Add a regression spec (new `packages/core/src/Stores/__tests__/common-store.spec.*`): a `?ext_platform_url=` URL no longer throws
- [x] 4.3 **Green gate:** targeted `test:jest` green (common-store.spec 1 passed); full `build:all && check-imports && knip:check` delegated to the automated verify stage

## 5. ui-store chart observables → constants + GTM asset-info (bugs 10, 12 · ABF-011/013)

- [x] 5.1 In `packages/core/src/Stores/ui-store.js` convert `is_chart_layout_default` (default `true`) and `is_chart_countdown_visible` (default `false`) to constants: remove the observable decls (~L109–110), their `makeObservable` registrations (~L231–232), the `setChartLayout`/`setChartCountdown` setters (~L569–571/L579–581) and their `action.bound` regs (~L313–314), and their `local_storage_properties` entries (~L208–209); remove the mirrors in `packages/stores/types.ts` (~L297–298, L330) and `packages/stores/src/mockStore.ts` (~L106–107, L145)
- [x] 5.2 Update consumers to read the inlined constants: `packages/trader/src/AppV2/Containers/Chart/trade-chart.tsx` (~L145/L148), `packages/trader/src/Modules/Contract/Containers/replay-chart.tsx` (~L51/L52), and the GTM `toolbar_position` in `trade-store.ts` (~L2805)
- [x] 5.3 Bug 12: set the GTM `chart_asset_info` field to the constant `'hidden'` in `trade-store.ts` (~L2806); delete the commented-out `is_chart_asset_info_visible` block in `ui-store.js` (~L107–108, L573–577) and its dead `local_storage_properties` string (~L207)
- [x] 5.4 Extend `packages/core/src/Stores/__tests__/ui-store.spec.ts`: the constants surface the prior values (GTM value tests in trade-store.spec.ts — ABF-013 chart_asset_info is a characterization test); the dead setters/keys are gone
- [x] 5.5 **Green gate:** targeted `test:jest` green (ui-store/trade-chart/replay-chart 60 passed; trade-store GTM 2 passed); full `build:all && check-imports && knip:check` + knip-diff/`@deriv/stores` compile delegated to the automated verify stage

## 6. client-store cookie cluster deletion (bug 11 · ABF-012)

- [x] 6.1 In `packages/core/src/Stores/client-store.js` delete the cluster: `email` (~L38/L64), `setEmail` (~L98/L506–511), `setCookieAccount` (~L90/L191–216), `has_cookie_account` (~L53/L75) and the constructor cookie reaction (~L112–117); prune the now-orphaned `getRegion` (~L29) and `getTrustedDomainName` (~L9) imports, but KEEP `Cookies`/`removeCookies` (still used at ~L443/L558)
- [x] 6.2 Rework the two `email` consumers: remove the always-`undefined` `email` field from the GTM payload (`packages/core/src/Stores/gtm-store.js` ~L39); in `packages/core/src/App/app.jsx` (~L74–78) replace the `email`-gated effect with an unconditional `Analytics.reset()` on mount (deps `[]`) per the recommended Open-Question answer
- [x] 6.3 Remove the `email`/`has_cookie_account` mirrors in `packages/stores/types.ts` (~L199/L224) and `packages/stores/src/mockStore.ts` (~L37/L59)
- [x] 6.4 Add a regression spec (new `packages/core/src/Stores/__tests__/client-store.spec.*`): no `setEmail`/`setCookieAccount`/`has_cookie_account` references remain; app-mount `Analytics.reset()` still fires once
- [x] 6.5 Record the cookie-removal provenance and the informational Analytics notes (bugs 11 & 12) in `docs/spec-to-pr/pr-notes/c6.md` (engine folds it into the PR description); confirm the deferral `docs/spec-to-pr/deferrals/analytics-reset-on-mount-email-gate.md` is present
- [x] 6.6 **Green gate:** targeted `test:jest` green (client-store/app/useStore specs pass); `setEmail`/`setCookieAccount`/`has_cookie_account`/`client.email` confirmed with no live consumer (analytics.ts read is a verified no-op); full `build:all && check-imports && knip:check` delegated to the automated verify stage

## 7. contract-trade-store single-parse perf (bug 13 · ABF-014)

- [x] 7.1 In `packages/core/src/Stores/contract-trade-store.js` parse `sessionStorage['trade_store']` once per evaluation (a single helper reused by the four sites ~L188, L296, L348, L382 — or read `symbol`/`contract_type` from the root trade store directly); the `markers_array`/`filtered_contracts`/`has_crossed_accu_barriers` computeds must produce identical output
- [x] 7.2 Add a regression spec (new `packages/core/src/Stores/__tests__/contract-trade-store.spec.*`): a single markers evaluation calls `sessionStorage.getItem('trade_store')` once; outputs unchanged
- [x] 7.3 **Green gate:** targeted `test:jest` green (contract-trade-store.spec 1 passed; red captured: 2 `trade_store` reads at HEAD → 1 after fix); full `build:all && check-imports && knip:check` delegated to the automated verify stage

## 8. LandscapeBlocker duplicate file (bug 15 · ABF-015)

- [x] 8.1 Delete the shadowed `packages/core/src/App/Components/Elements/LandscapeBlocker/index.tsx` (byte-identical to `index.ts`, which module resolution selects); confirm consumers still resolve `LandscapeBlocker` — verified byte-identical via `diff`, bundle-stats confirms `index.ts` is resolved, and the sole source consumer `AppContent.tsx` imports the barrel directory
- [x] 8.2 **Green gate:** duplicate-file deletion (no behaviour change, no test warranted); full `build:all && test:jest && check-imports && knip:check` delegated to the automated verify stage

## 9. Manifest hygiene (bug 16 · ABF-016)

- [x] 9.1 Add `@deriv/quill-icons` (match trader's version, `2.4.16`) to `dependencies` in `packages/components/package.json` and `packages/reports/package.json`
- [x] 9.2 Add `@deriv/utils` to `dependencies` in `packages/reports/package.json` (`^1.0.0`, matching api/core/trader)
- [x] 9.3 Add the devDeps `stylelint-webpack-plugin` (`^2.1.1`), `webpack-bundle-analyzer` (`^4.10.2`) and `eslint-formatter-pretty` (`^4.0.0`) (required by `packages/trader/build/constants.js` ~L10/L12/L55) to `packages/trader/package.json` (`trackjs` clause confirmed void — skipped); versions match core/root; all four manifests re-validated as JSON
- [x] 9.4 **Green gate:** manifest-only edits, versions pinned to already-installed workspace versions (no hoisting reliance); `bootstrap && build:all` delegated to the automated verify stage

## 10. Bug 14 discrepancy — verify not present, record finding (ABF-001)

- [x] 10.1 Re-verify at HEAD that `packages/trader/src/Modules/SmartChart/Components/toolbar-widgets.tsx` calls `isDesktopOs()` and that `isTabletOs` is a boolean constant (so `!isTabletOs` is a valid negation and StudyLegend/Share render on real desktop); confirm the findings note `docs/spec-to-pr/findings/c6-bug-14-toolbar-widgets-not-present.md` reflects HEAD. Make no code change — CONFIRMED at HEAD: `toolbar-widgets.tsx:16` = `isDesktopOs() && !isTabletOs`; `isDesktopOs` is a fn (os_detect.ts:56), `isTabletOs` a boolean const (os_detect.ts:87–92); finding note is accurate; no code changed

## 11. V1/V2 gating — desktop persisted-strike restore (bug 6 fix · ABF-007)

- [x] 11.1 In `packages/trader/src/Stores/Modules/Trading/Helpers/contract-type.ts` (~L249–257) drop the `&& root_store?.ui.is_mobile` clause so the persisted `v2_params_initial_values.strike` restore for `Call`/`Put` runs on desktop as well as mobile; verify `StrikeDesktop` reflects the restored barrier — done; also pruned the now-orphaned destructured `root_store` (L278/L284 use `store.root_store`); `StrikeDesktop` already reads `barrier_1` from the store (surfaces automatically, no component change)
- [x] 11.2 Add/extend specs: `packages/trader/src/Stores/Modules/Trading/Helpers/__tests__/contract-type.spec.ts` (desktop restore applies) and `packages/trader/src/AppV2/Components/TradeParameters/Strike/__tests__/strike.spec.tsx` — added `[ABF-007]` desktop-restore test (red captured: HEAD returned `undefined`, `+1.80` after fix), retitled the misleading "non-mobile" test to the non-vanilla guard it actually covers, and added a desktop `[ABF-007]` characterization test in strike.spec
- [x] 11.3 **Green gate:** targeted `test:jest` green (contract-type + strike 71 passed); full `build:all && check-imports && knip:check` delegated to the automated verify stage

## 12. V1/V2 gating — remnant refactor (bug 6 refactor · ABF-007 · CUTTABLE)

**DEFERRED — not part of this change.** This phase was cut at its own §12.3 boundary (the diff
exceeded a reviewable size) and shipped as phases 1–11 instead; the ABF-007 fix landed in §11. The
full scope — the `is_dtrader_v2` getter removal and branch collapse (12.1), the `replay-chart.tsx`
V1-fork removal and `useDevice().isMobile` standardisation (12.2), the test rewrites (12.3) and the
green gate (12.4) — is recorded step by step in
`docs/spec-to-pr/deferrals/v1-v2-gating-remnant-refactor.md`, tracked as issue #1271.

Deliberately prose, not checkboxes: nobody on this change will ever tick them, and archive-on-merge
archives a change only once every box is checked.

## 13. Final verification (Exit criteria)

- [x] 13.1 Full green gate: `bootstrap && build:all && test:jest && check-imports && knip:check`; knip diff shows only intended removals; `@deriv/stores` types/mocks compile
- [x] 13.2 Confirm every checkbox above is ticked OR a deferral is filed under `docs/spec-to-pr/deferrals/`; `docs/spec-to-pr/pr-notes/c6.md` records the bug-11 cookie provenance and the bugs 11/12 Analytics notes — CONFIRMED: implementation phases 1–11 all ticked; phase 12 (12.1–12.4) deferred via `docs/spec-to-pr/deferrals/v1-v2-gating-remnant-refactor.md` (CUTTABLE per §12.3, refactor-only, ABF-007 fix shipped in §11); `docs/spec-to-pr/pr-notes/c6.md` records both the bug-11 cookie provenance and the bugs 11/12 Analytics notes. 13.1's full green gate (`bootstrap && build:all && test:jest && check-imports && knip:check`) is delegated to the automated verify stage and is intentionally left unticked here (not run in this implementation stage)
