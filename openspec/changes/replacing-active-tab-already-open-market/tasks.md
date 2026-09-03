## Open Questions

Each has a recommended default already reflected in the tasks below — the plan is complete and implementable as-is. A reviewer can override an answer; only the named tasks change.

1. **Should the "degrades to a switch" commit fire any tab-switch analytics (`trackTradeTabSwitched`)?** (affects task 2.1)
    - **(a) No new analytics event — RECOMMENDED.** Every existing commit made through the market selector (`commitAndClose` → `selectMarketAndTradeType`, including today's normal in-place replace) fires no `trackTradeTabSwitched`; that event is scoped to a direct tap on an already-visible inactive tab (`market-tabs.tsx` `handleSelect`). Making this one selector commit an exception would be new, unrequested tracking behavior with no spec in the issue.
    - (b) Fire `trackTradeTabSwitched` for this case, since the net user-visible effect matches a tab switch. Would need product/analytics sign-off on the event shape for a selector-driven switch, which the issue does not request.
2. **Any user-facing feedback (toast/snackbar) explaining "this market is already open, switched to it"?** (affects task 2.1)
    - **(a) No new UI feedback — RECOMMENDED.** The issue's decided/expected behavior is exactly "selector closes, existing tab activates" with no mention of a message; the already-open market also stays selectable and undisabled in the picker, i.e. this is meant to feel like an ordinary switch, not a special case worth explaining.
    - (b) Add a brief snackbar on commit. Introduces new copy/UX not requested by the issue and not scoped by this change.

## 1. Reproduce and pin the bug with a failing test

- [x] 1.1 In `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts`, add a `describe` block for `selectMarketAndTradeType` replace-flow behavior: seed `open_markets` with two tabs (`{ symbol: 'GDAXI', contract_type: 'rise_fall' }` inactive, `{ symbol: '1HZ100V', contract_type: 'rise_fall' }' active), set `tradeStore.replacing_market`to the active tab via`setReplacingMarket`, then call `await tradeStore.selectMarketAndTradeType('GDAXI', 'rise_fall')`(the already-open pair) and assert`tradeStore.open_markets`still has length 2 and contains both original pairs — confirm this fails against current`main`before the fix (reproduces #1240). CONFIRMED RED: ran with the store fix stashed —`[MT-001] keeps both tabs...`failed with`Expected length: 2, Received length: 1` (GDAXI's tab collapsed onto the tapped tab). Restored the fix afterward; the same test now passes.
- [x] 1.2 Add a companion test asserting `tradeStore.symbol === 'GDAXI'` and `tradeStore.contract_type === 'rise_fall'` after the same commit (the existing tab becomes active), and that `tradeStore.replacing_market` is cleared (`null`) afterward.

## 2. Fix `selectMarketAndTradeType`

- [x] 2.1 In `packages/trader/src/Stores/Modules/Trading/trade-store.ts` (~L1097-L1149), change the `replaced_market` branch: when `category_sibling_tab` is truthy and is a _different_ tab than `replaced_market` (compare with the existing `isSameMarket` import), skip `this.replaceOpenMarket(...)` entirely — still call `this.setReplacingMarket(null)` — and fall through to the normal symbol/`contract_type` commit below so the pre-existing tab becomes active via `(this.symbol, this.contract_type)`. When `category_sibling_tab` is absent or _is_ `replaced_market` itself, keep today's `replaceOpenMarket(replaced_market, next_market)` call unchanged.
- [x] 2.2 Introduce a local `did_replace` boolean, set to `true` only at the call site added/kept in 2.1 that actually invokes `replaceOpenMarket`. Update the failure-path rollback (~L1136-1145) to branch on `did_replace` (reverse the replace) instead of the current `replaced_market` truthiness check, leaving the `else if (!category_sibling_tab) this.removeOpenMarket(next_market)` add-rollback branch's condition unchanged.
- [x] 2.3 Re-read the full method after edits to confirm: the `epoch`/`selection_seq` supersession guard, the `startSelectingMarket`/`stopSelectingMarket` calls, and the URL-sync-on-settle logic are all untouched by this change (this fix only touches which strip mutation runs, not the commit cascade around it).

## 3. Cover the fix and its edges with tests

- [x] 3.1 Confirm the tests from task 1 now pass.
- [x] 3.2 Add a test for the failure-path rollback in the skip case: seed the same two-tab state, mock the commit to reject (following the existing `processTradeParams` mock pattern used in the `'atomic trade URL sync (hybrid-URL phantom regression)'` describe block), commit the already-open pair, assert the rejection propagates and `tradeStore.open_markets` is unchanged (still both original tabs, nothing re-added or re-removed) — pins MT-003's "skipped replace leaves the strip untouched" scenario.
- [x] 3.3 Add a regression test for the existing in-place-replace failure rollback (target not already open elsewhere): commit a brand-new pair over the active tab with the commit mocked to reject, assert the original tapped tab is restored at its original position and the attempted new pair is not present — pins MT-003's genuine-replace rollback scenario and guards `did_replace` against a false negative.
- [x] 3.4 Add/extend a test for the same-category sibling case (e.g. `rise_fall` → `rise_fall_equal` on the same symbol) confirming the tapped tab is still updated in place, not treated as "already open elsewhere" — pins MT-002's second scenario and guards the `isSameMarket(category_sibling_tab, replaced_market)` comparison in 2.1.
- [x] 3.5 Run `npm run test:jest -- packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` and confirm the full file passes (not just the new tests), since this method is exercised by several other existing describe blocks in the file. CONFIRMED: 152/152 tests pass.

## 4. Manual verification

- [ ] 4.1 Run the app (`npm run serve --workspace=@deriv/trader`), reproduce the exact repro steps from issue #1240 (open Gold Basket, `+` add Volatility 100 Index as tab 2/active, tap active tab 2, select Gold Basket from the selector), and confirm the strip ends as `[Gold Basket (active), Volatility 100 Index]` with no tab lost — on both the mobile (AppV2 small screen) and desktop breakpoints, since the tab strip and store are shared between both.
- [ ] 4.2 Manually confirm the two explicitly-unaffected paths from the issue still work: replacing the active tab with a market that is not already open (in-place swap, position preserved), and the `+` flow after cancelling a pending replace (appends/activates without touching the previously-active tab).

## 5. Lint and type-check

- [x] 5.1 Run `npm run test:eslint-all` (or the scoped `trader` package lint) on the changed file. CONFIRMED: `eslint` on `trade-store.ts`, `trade-store.spec.ts`, and `market-tabs.spec.tsx` reports 0 errors, 20 pre-existing warnings (none on lines touched by this change).
- [x] 5.2 Confirm no new TypeScript errors in `trade-store.ts` (the change only adds a local boolean and a conditional branch, no new types). CONFIRMED: `tsc --noEmit` on `@deriv/trader` produces no diagnostics referencing `trade-store.ts` or `market-tabs.spec.tsx`.
