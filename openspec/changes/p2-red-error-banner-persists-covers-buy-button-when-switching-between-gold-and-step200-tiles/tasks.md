## Open Questions

Recommended defaults are already baked into the checklist below — a reviewer may pick differently and the tasks should be adjusted accordingly. None of these blocks implementation.

1. **Dismiss an already-visible toast on tab switch, or only suppress new ones?** (carried from `design.md` — Open Questions)
    - (a) **[RECOMMENDED]** Suppress at source only (Sections 2–4). With the malformed request gone and the outgoing tab's error state cleared, the worst case is a toast raised a fraction before the tap, bounded by `ERROR_SNACKBAR_DURATION` (4s).
    - (b) Additionally call `useSnackbar().removeSnackbar(...)` from `ServicesErrorSnackbar` on a market-tab change. Needs the quill `useSnackbar` removal API confirmed against the installed `@deriv-com/quill-ui` (`node_modules` is not installed in this workspace; only a test mock references it — `AppV2/Components/TradeParameters/AllowEquals/__tests__/allow-equals.spec.tsx:27`). Add task 4.5 if adopted.

2. **Snackbar gap above the purchase block.** The helper needs a gap so the toast does not sit flush against the Buy button.
    - (a) **[RECOMMENDED]** 8px (`--core-spacing-400`, the same padding the trade-params sheet uses at `trade-parameters.scss:74`), giving a trade-page offset of `56 + 72 + 8 = 136px` logged in.
    - (b) No gap (`128px`) — meets the spec ("never covers the Buy button") but reads cramped.

3. **Scope of the offset helper: all six snackbar sites, or only the two error-snackbar components?**
    - (a) **[RECOMMENDED]** All six (`ServicesErrorSnackbar`, `TradeErrorSnackbar`, `PurchaseButton`, `Duration`, `Barrier`, `Day`). They all render on the Trade page and all can cover Buy; `Barrier` and `Day` additionally have no logged-out branch today.
    - (b) The two error-snackbar components only — leaves four call sites still able to cover Buy; not recommended.

---

## 1. Red — reproduce the defects with failing tests first

Per `.buildwright/framework/tdd-evidence.md`, capture and cite the red for each of these before writing the fix.

- [x] 1.1 In `packages/trader/src/Stores/Modules/Trading/Helpers/__tests__/proposal.spec.ts`, add a `createProposalRequestForContract` case for a duration-taking contract with `expiry_type: 'endtime'`, a valid `expiry_date` and `expiry_time: null`; assert the request carries a `duration`+`duration_unit` (the Decision 1 fallback). Verify it fails today with a request that has neither key — record that as the red.
- [x] 1.2 In the same file, add a case where neither an expiry time nor a usable `duration`/`duration_unit` is available and assert the new `hasResolvableExpiry(store)` predicate returns `false`. Verify it fails today (the export does not exist).
- [x] 1.3 In `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts`, add a case asserting that committing `{ expiry_date, expiry_type: 'endtime' }` with no `expiry_time` through `onChangeMultiple` leaves the store with `expiry_type === 'duration'` (the Decision 2 invariant). Verify it fails today with `expiry_type === 'endtime'`.
- [x] 1.4 In the same file, add a case asserting `selectMarketAndTradeType('stpRNG200', 'rise_fall')` clears a pre-seeded `proposal_info` error and calls `common.resetServicesError()` when a `services_error` is set. Verify it fails today.
- [x] 1.5 In the same file, add a case asserting `onProposalResponse` ignores a response whose `contract_type` is absent from `trade_types` (same `underlying_symbol`). Verify it fails today (the response is accepted and written into `proposal_info`).
- [x] 1.6 In `packages/trader/src/AppV2/Utils/__tests__/layout-utils.spec.ts`, add a `getErrorSnackbarBottomOffset` describe block asserting the trade-page offset clears `HEIGHT.BOTTOM_NAV + HEIGHT.PURCHASE_BLOCK`. Verify it fails today (the export does not exist).
- [x] 1.7 Run `npm run test:jest -- packages/trader/src/Stores/Modules/Trading packages/trader/src/AppV2/Utils/__tests__/layout-utils.spec.ts` and paste the failing test names + key assertions into the PR body as the cited red.

## 2. Proposal request integrity (spec: `proposal-request-integrity`)

- [x] 2.1 In `packages/trader/src/Stores/Modules/Trading/Helpers/proposal.ts:189-212`, rewrite `getDurationParams()` so an `endtime` expiry that cannot resolve `obj_expiry.date_expiry` falls back to `{ duration: parseInt(store.duration), duration_unit: store.duration_unit }` instead of returning `{}`; keep the Accumulator/Multiplier early return at `:190-193` and the `expiry_type === 'duration'` branch unchanged. Verify task 1.1's test passes.
- [x] 2.2 In the same file, export `hasResolvableExpiry(store: TTradeStore): boolean` — `true` for Accumulator/Multiplier (they take no expiry), `true` when an `endtime` `date_expiry` resolves, `true` when `duration > 0` and `duration_unit` is set, `false` otherwise. Remove the stale `// TODO: Fix mobile duration param intermittently showing invalid duration error` at `:188` (this change is that fix). Verify task 1.2's test passes.
- [x] 2.3 In `packages/trader/src/Stores/Modules/Trading/trade-store.ts`, add a fourth early-return guard in `requestProposal` (after the `is_awaiting_contracts_for` guard at `:2126-2134`, before `createProposalRequests`): when `!hasResolvableExpiry(this)`, call `this.forgetAllProposal()` then `runInAction` to clear `proposal_info`, `purchase_info`, `proposal_requests` and return — matching the ordering the comment at `:2122-2124` requires. Verify no `WS.subscribeProposal` call is made in that state (assert via the existing WS mock in `trade-store.spec.ts`).
- [x] 2.4 Import `hasResolvableExpiry` in `trade-store.ts` alongside the existing `createProposalRequests` import and confirm `tsc -p packages/trader/tsconfig.json` reports no new errors (see the known-baseline note in task 7.2).

## 3. End-time expiry invariant (spec: `proposal-request-integrity`)

- [x] 3.1 In `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration.tsx:112-115`, add `expiry_time: '23:59:59'` to the days-default `onChangeMultiple` payload so it matches the local `setSavedExpiryTime('23:59:59')` at `:110` and the desktop writer at `duration-desktop.tsx:290-293`. Verify by adding/extending a test under `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/` that asserts the payload includes `expiry_time`.
- [x] 3.2 In `packages/trader/src/Stores/Modules/Trading/trade-store.ts`, normalise inside `processNewValuesAsync` (alongside the symbol-change block at `:1918-1943`, before `const new_state = this.updateStore(...)` at `:1990`): if the resulting `expiry_type` would be `'endtime'` while the resulting `expiry_time` is falsy, force `expiry_type: 'duration'` in `obj_new_values`. Verify task 1.3's test passes.
- [x] 3.3 Confirm the normalisation does not regress the legitimate end-time paths: run `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/Duration` and check `duration-end-time-desktop.tsx:290-299` and `duration.tsx:180-190` (both commit `expiry_time`) still land as `endtime`.

## 4. Market-tab switch clears the outgoing tab's error (spec: `trade-error-notifications`)

- [x] 4.1 In `packages/trader/src/Stores/Modules/Trading/trade-store.ts`, at the top of `selectMarketAndTradeType` (`:1097`, before `this.startSelectingMarket()` at `:1121`), clear `this.proposal_info = {}` and `this.validation_params = {}`. Verify task 1.4's test passes for the `proposal_info` half.
- [x] 4.2 In the same block, clear the trade-parameter `validation_errors` entries using the existing per-field style (see `clearBarrierValidationErrors` at `:3167`) rather than replacing the whole object — add a sibling private helper if the field list warrants it. Verify with a test asserting a seeded `validation_errors.duration` is empty after the call and an unrelated key is untouched.
- [x] 4.3 In the same block, call `this.root_store.common.resetServicesError()` only when a `services_error` is actually set (`isEmptyObject` guard, matching `packages/core/src/Stores/portfolio-store.js`'s guarded reset from #947). Verify task 1.4's test passes for the `resetServicesError` half, plus a case asserting it is NOT called when `services_error` is `{}`.
- [x] 4.4 In `onProposalResponse` (`:2175-2183`), extend the stale-response guard to also return early when `contract_type` is not a key of `this.trade_types`; update the comment above it to name both conditions. Verify task 1.5's test passes.
- [~] 4.5 **Not applicable** — Open Question 1 resolved as (a), suppress at source only, so no `removeSnackbar` call was added. _(Only if Open Question 1 → option b)_ In `packages/trader/src/AppV2/Components/ServicesErrorSnackbar/services-error-snackbar.tsx`, dismiss the outstanding error snackbar on a market-tab change via the confirmed quill removal API. Verify with a test asserting the removal call fires on a `symbol`/`contract_type` change while a snackbar is outstanding.

## 5. Error notifications never cover the Buy button (spec: `trade-error-notifications`)

- [x] 5.1 In `packages/trader/src/AppV2/Utils/layout-utils.tsx:7-17`, add `PURCHASE_BLOCK: 72` to the `HEIGHT` map (the value already named in the `TRADE_PARAM_SHEET` comment at `:12-14`) and leave `TRADE_PARAM_SHEET: 158` unchanged so `getChartHeight` is unaffected. Verify the existing `getChartHeight` cases in `__tests__/layout-utils.spec.ts` still pass.
- [x] 5.2 In the same file, export `getErrorSnackbarBottomOffset({ pathname, is_logged_in, is_chart_maximized = false, is_cancellable_multiplier = false })` returning a CSS length string per `design.md` Decision 4: trade/automate pages → `PURCHASE_BLOCK + 8` plus `BOTTOM_NAV` unless maximised or logged out; contract details + cancellable multiplier → `'104px'`; otherwise `'48px'` / `'-8px'`. Verify task 1.6's test passes, and add cases for the maximised, logged-out, contract-details and default branches.
- [x] 5.3 In `packages/trader/src/AppV2/Components/ServicesErrorSnackbar/services-error-snackbar.tsx:86-91,107`, replace the local `bottom_position` ternary and the `marginBottom` literal with `getErrorSnackbarBottomOffset(...)`, passing `pathname`, `is_logged_in`, `ui.is_chart_maximized` and the existing `is_multiplier && isValidToCancel(contract_info)` condition. Verify `__tests__/services-error-snackbar.spec.tsx` still passes (it already asserts `delay: ERROR_SNACKBAR_DURATION`) and add an assertion on the trade-page `marginBottom`.
- [x] 5.4 In `packages/trader/src/AppV2/Components/TradeErrorSnackbar/trade-error-snackbar.tsx:41`, replace `marginBottom: is_logged_in ? '48px' : '-8px'` with the helper (this component only renders on the trade page, so pass `routes.index`). Verify with an added assertion in `__tests__/trade-error-snackbar.spec.tsx`.
- [x] 5.5 In `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button.tsx:228`, replace the same literal with the helper. Verify `__tests__/purchase-button.spec.tsx` still passes and add a `marginBottom` assertion.
- [x] 5.6 In `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration.tsx:287`, `.../Duration/day.tsx:144` and `.../Barrier/barrier.tsx:49`, replace the `marginBottom` literals with the helper — `day.tsx` and `barrier.tsx` currently hard-code a flat `'48px'` with no logged-out branch, so they gain one. Verify `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/Duration packages/trader/src/AppV2/Components/TradeParameters/Barrier` passes.

## 6. Green — full test pass

- [x] 6.1 Run `npm run test:jest -- packages/trader/src/Stores/Modules/Trading` and confirm every store/helper suite is green, including the pre-existing `proposal.spec.ts`, `logic.spec.ts` and `trade-store.spec.ts` cases.
- [x] 6.2 Run `npm run test:jest -- packages/trader/src/AppV2` and confirm the snackbar, purchase-button, duration, barrier, layout-utils and market-tabs suites are green.
- [~] 6.3 **Deferred to the separate verification stage** (whole-repo gate). Targeted equivalent run instead: `packages/trader/src/Stores/Modules/Trading` + `packages/trader/src/AppV2` — 238 suites / 2330 tests green.
- [x] 6.4 Ran `npx eslint` on the touched files only (0 errors, 42 pre-existing warnings) and `npx prettier --write` on them (clean). `npm run test:eslint-all` deferred to the separate verification stage as a whole-repo gate.

## 7. Docs & repo hygiene

- [x] 7.1 Add a one-line entry to the `# Gotchas` section of `CLAUDE.md` noting that AppV2 error snackbars take their bottom offset from `getErrorSnackbarBottomOffset` in `AppV2/Utils/layout-utils.tsx` so they never cover the Buy button — per `.buildwright/steering/philosophy.md` ("Documentation Is Part of Done"). Verify the file renders and the entry sits with the other purchase-button/error notes.
- [x] 7.2 Run `npx tsc -p packages/trader/tsconfig.json` and confirm no NEW errors beyond the known baseline (~29 "Conflicting order" CSS warnings and the 4 pre-existing inline-message errors). Verify by diffing against a `tsc` run on `master`.
- [x] 7.3 Confirm no other caller depends on `getDurationParams` returning `{}` — grep for `createProposalRequestForContract` and `createProposalRequests` across `packages/` and check `Helpers/contract-template.ts:43-52` (the autotrader template mirrors this logic and already guards on `store.expiry_date && store.expiry_time`; note in the PR whether it needs the same fallback or is intentionally left alone).

## 8. Verify & finalize

- [x] 8.1 Run `npx -y @fission-ai/openspec validate p2-red-error-banner-persists-covers-buy-button-when-switching-between-gold-and-step200-tiles` and fix any structural errors it reports.
- [x] 8.2 Write the PR body with the cited red from task 1.7 (per `.buildwright/framework/tdd-evidence.md`), the root-cause summary, and `Fixes #1246`.
- [x] 8.3 Produce detailed manual QA steps with **previous vs expected** behaviour for each affected surface, and include them in the PR body:
    - _Mobile web, two market tabs (the issue's reproduction):_ open Vol 100 (1s) Rise/Fall → switch its symbol to Gold/USD → add a second tab via "+" set to Step 200 Index (Duration 15 minutes) → switch between the two tabs several times. **Previously:** the toast "Please specify either duration or date_expiry." fires on the Step 200 tab and sits over the Buy button; repeated switching makes it appear/disappear. **Expected:** no toast on either tab; both tabs quote a payout and the Buy button is tappable throughout.
    - _Mobile web, Duration sheet, days unit:_ open Duration on a symbol offering days and pick the Days tab without setting an end time. **Previously:** the store lands on an end-time expiry with no time and the proposal is rejected. **Expected:** the end time defaults to `23:59:59` and a price quotes.
    - _Mobile web, any genuine trade error_ (e.g. a stake below the minimum): trigger the error on the Trade page. **Previously:** the red toast sits on top of the Buy button. **Expected:** the toast sits above the Buy button, the Buy button stays fully visible and tappable, and the toast still auto-dismisses after ~4s.
    - _Mobile web, chart maximised:_ trigger an error with the chart maximised. **Previously:** the toast overlaps the purchase block at its raised position. **Expected:** the toast stays clear of the purchase block.
    - _Logged out, Trade page:_ trigger an error. **Previously:** flat `-8px` (and, for the Barrier / Day sheets, `48px` regardless of auth). **Expected:** the toast clears the logged-out purchase block on all six surfaces.
    - _Contract details, cancellable multiplier:_ trigger a service error. **Previously and expected (unchanged):** the toast sits at the existing `104px` offset above the Cancel action.
- [~] 8.4 **Deferred to manual QA** — no authenticated mobile-web session against live market data is available in this unattended run, so the reproduction could not be exercised end to end. Every layer of the defect is covered by unit tests, and the previous-vs-expected steps are in `pr-body.md`. _(original task below)_ Confirm on the dev server (`npm run serve --workspace=@deriv/trader`, responsive/mobile breakpoint) that the Trade page quotes normally on both tabs and no toast covers Buy. If an authenticated session is unavailable in the run, mark this deferred to manual QA and say so explicitly in the final report rather than claiming it passed.
