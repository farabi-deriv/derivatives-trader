## Open Questions

Resolve before/while implementing. Each has a recommended default already baked into the tasks below — a reviewer may override it.

1. **Guard scope: same trade-type group (recommended) vs Rise/Fall-only.**
    - **Option A — same-group guard (RECOMMENDED).** Gate the stake reset on `this.isSameTradeTypeGroup(old, new)` in `trade-store.ts`. Fixes the reported Allow equals bug at the root and also preserves stake for other same-group sub-toggles (Turbos Long↔Short, Vanilla Call↔Put, Multipliers Up↔Down). Mirrors the existing duration-group guard.
    - **Option B — Rise/Fall-only guard.** Gate on the existing `isRiseFallEqual` helper (`Helpers/allow-equals.ts`) for both old and new contract types. Fixes only Allow equals; leaves every other trade type exactly as today. Choose this if zero collateral behaviour change is required.
    - **Option C — do nothing / UI workaround.** Rejected: leaves the data-loss bug in the store.
    - _Tasks below implement Option A. To switch to Option B, replace the `isSameTradeTypeGroup` clause in task 2.1 with `!(isRiseFallEqual(obj_old_values.contract_type) && isRiseFallEqual(obj_new_values.contract_type))` and import `isRiseFallEqual`._

## 1. Reproduce (Red)

- [x] 1.1 In `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts`, add a test under the existing `setTradeSubType (fenced same-category sub-toggle writer)` describe block that sets `tradeStore.is_dtrader_v2`-eligible state (`mockRootStore.ui.is_mobile`/AppV2), `default_stake`, `contract_type = TRADE_TYPES.RISE_FALL`, and a custom `amount` different from `default_stake`, then calls `await tradeStore.onChange({ target: { name: 'is_equal', value: 1 } })` and asserts `tradeStore.amount` is unchanged (still the custom value) while `contract_type === TRADE_TYPES.RISE_FALL_EQUAL`. Confirm it FAILS against current code (stake reset to `default_stake`).

## 2. Fix (Green)

- [x] 2.1 In `packages/trader/src/Stores/Modules/Trading/trade-store.ts`, in the `default_stake` reset block inside `processNewValuesAsync` (currently ~lines 1922–1956), extend the `has_contract_type_changed` computation with `&& !this.isSameTradeTypeGroup(obj_old_values.contract_type, obj_new_values.contract_type)` so a within-group sub-type flip (`rise_fall` ↔ `rise_fall_equal`) is not treated as a trade-type switch. Keep `has_symbol_changed` and all other logic unchanged.
- [x] 2.2 Add a terse one-line comment at the guard explaining why (same-group sub-type flip — e.g. Allow equals — must not reset the stake), consistent with the nearby duration-group guard rationale.

## 3. Verify (Tests)

- [x] 3.1 Complete the test from 1.1 and add its mirror: enabling then disabling Allow equals (`value: 1` → `value: 0`) preserves the custom stake and returns `contract_type` to `TRADE_TYPES.RISE_FALL`.
- [x] 3.2 Add a regression guard test: a genuine trade-type switch (different group, e.g. `RISE_FALL` → `MATCH_DIFF` or a symbol switch) still resets `amount` to `default_stake` — proving the fix did not disable the intended reset.
- [x] 3.3 Run `npm run test:jest -- packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` and confirm all pass (new tests + existing `setTradeSubType`/`is_equal` tests).
- [x] 3.4 Run the broader trade-store-adjacent suites to catch any test that relied on the old reset: `npm run test:jest -- packages/trader/src/Stores/Modules/Trading` and `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/AllowEquals`.

## 4. Manual + docs

- [x] 4.1 Manually verify in AppV2 (desktop and mobile): on Rise/Fall enter a custom stake, toggle Allow equals on — stake and duration are retained, sub-type shows Rise/Fall Equal; toggle off — stake/duration still retained. Then switch to a different trade type and confirm the stake resets to default as before.
- [x] 4.2 Run `npx -y @fission-ai/openspec validate enabling-allow-equals-resets-the-stake --strict` and fix any structural errors.
