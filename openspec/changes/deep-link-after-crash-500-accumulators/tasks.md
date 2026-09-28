## Open Questions

### When the deep-linked symbol's contracts_for never settles within the wait, what should the resolver do?

- [recommended] Keep the deep-linked symbol, skip the URL trade type, show no modal (a list that never arrived is a loading failure, not an unsupported trade type; `resolveContractTypeAvailability` settles the type if the response lands later)
- Show the URL-unavailable modal with reason `trade_type` (consistent with the other dead-end deep-link paths, but blames the market for a network failure)
- Fall back to today's behaviour and evaluate whatever list is present (reproduces the reported bug on the error path)

### Should the reconcile's post-switch wait compare the stamp against `compatible_symbol` or against `this.symbol`?

- [recommended] `compatible_symbol` — it names the market the reconcile just asked for, so the condition holds regardless of when `onChange`'s cascade lands, and it keeps the two reconcile branches collapsible into one wait-then-check
- `this.symbol` — reads more naturally but re-introduces a second moving part in the predicate and makes the already-current branch behave differently from the switched branch

Both proceed on the recommended option; the checklist below is written against them.

## 1. Give the contract-type list an identity

- [x] 1.1 In `packages/trader/src/Stores/Modules/Trading/trade-store.ts`, add `contract_types_list_v2_symbol = ''` next to `contract_types_list_v2` (~line 405) with a one-line comment naming the invariant ("the market this list describes; a list stamped with another market answers for nothing"), and register it as `observable` in the `makeObservable` block next to `contract_types_list_v2` (~line 647).
- [x] 1.2 In the same file, change `setContractTypesListV2(contract_types_list)` (~line 3584) to `setContractTypesListV2(contract_types_list: TContractTypesList, response_symbol: string)` and assign both fields — this setter is the only writer of the stamp.
- [x] 1.3 In `packages/trader/src/AppV2/Hooks/useContractsFor.ts`, pass the same `symbol` already handed to `resolveContractTypeAvailability` as the second argument at the `setContractTypesListV2(available_categories)` call site (~line 174).
- [x] 1.4 In `packages/stores/src/mockStore.ts`, add `contract_types_list_v2_symbol: ''` next to the existing `contract_types_list_v2: {}` entry (~line 259).
- [x] 1.5 In `packages/trader/src/AppV2/Hooks/__tests__/useContractsFor.spec.tsx`, update the `setContractTypesListV2` assertion (~line 103) to expect the processed list **and** the response symbol, so the hook cannot silently stop reporting it. Run `npm run test:jest -- packages/trader/src/AppV2/Hooks/__tests__/useContractsFor.spec.tsx`.

## 2. Prove the bug red at the store level

- [x] 2.1 In `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts`, inside the `resolveInitialMarket` describe, replace the nine direct `store.contract_types_list_v2 = <list>` assignments (lines ~1085, 1124, 1141, 1157, 1175, 1191, 1259, 1284, 1331) with `store.setContractTypesListV2(<list>, '<the symbol that list belongs to>')`, using each test's own market (`1HZ100V`, `BOOM1000`, `1HZ25V`, `RDBULL`). In the compatible-symbol test (~line 1157) the second list belongs to `1HZ100V`, the symbol the reconcile switched to.
- [x] 2.2 Add a failing test `honours a deep link to a NON-default symbol when the inherited session left another market's contract list in the store`: session `trade_store` = `{ symbol: 'CRASH500', contract_type: 'accumulator' }`, URL `?symbol=1HZ25V&trade_type=rise_fall`, actives `['CRASH500', '1HZ25V', '1HZ100V']`, `setContractTypesListV2(accumulator_only_list, 'CRASH500')` before the flush, then `setContractTypesListV2(rise_fall_list, '1HZ25V')` after the first flush and flush again. Assert `onChange` was never called with `{ symbol: '1HZ100V' }`, that `contract_type` was committed as `rise_fall`, and that `toggleUrlUnavailableModal` was not called. Add an `accumulator_only_list` fixture next to `multipliers_only_list` (~line 1062).
      Red: `[DLM-003] honours a deep link to a NON-default symbol when the inherited session left another market’s contract list in the store` — `expect(onChangeSpy).not.toHaveBeenCalledWith({ target: { name: 'symbol', value: '1HZ100V' } })` expected no such call, got call 2 = `{"target": {"name": "symbol", "value": "1HZ100V"}}` (3 calls total) — the reconcile fires off the `CRASH500` list and silently substitutes the default market.
- [x] 2.3 Add a failing test `honours a deep link to the DEFAULT symbol without the URL-unavailable modal` with the same inherited-session setup but URL `?symbol=1HZ100V&trade_type=rise_fall` and `setContractTypesListV2(rise_fall_list, '1HZ100V')` delivered after the first flush. Assert `toggleUrlUnavailableModal` was not called and `rise_fall` was committed.
      Red: `[DLM-002] honours a deep link to the DEFAULT symbol without the URL-unavailable modal` — `expect(mockRootStore.ui.toggleUrlUnavailableModal).not.toHaveBeenCalled()` expected 0 calls, got 1: `true, "trade_type"` — the reconcile's fail-fast branch judged `1HZ100V` against the `CRASH500` list.
- [x] 2.4 Add a failing test `keeps the deep-linked symbol and shows no modal when its contract list never arrives`: the same inherited-session setup, URL `?symbol=1HZ25V&trade_type=rise_fall`, and **no** `1HZ25V` list ever delivered. Assert no `onChange` to `1HZ100V`, no `toggleUrlUnavailableModal` call, and that the tab strip still gets recorded (phase 3 ran). Drive the bounded wait with jest fake timers rather than waiting 30s in real time.
      Red: `[DLM-005] keeps the deep-linked symbol and shows no modal when its contract list never arrives` — `expect(onChangeSpy).not.toHaveBeenCalledWith({ target: { name: 'symbol', value: '1HZ100V' } })` expected no such call, got call 2 = `{"target": {"name": "symbol", "value": "1HZ100V"}}` (2 calls total) — the stale-list path substituted the market before the wait timed out.
- [x] 2.5 Run `npm run test:jest -- packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts -t "resolveInitialMarket"` and record the three red results inline above before writing any resolver code.
      Run result: `Tests: 3 failed, 237 skipped, 15 passed` — only the three new tests failed; the 15 pre-existing `resolveInitialMarket` tests already pass against the stamped setter.

## 3. Make the resolver decide against the right list

- [x] 3.1 In `packages/trader/src/Stores/Modules/Trading/trade-store.ts`, hoist the local `const WAIT_TIMEOUT = 30000` from `reconcileUrlTradeTypeWithSymbol` (~line 3973) to a module-level `SELECTION_WAIT_TIMEOUT` and use it for that function's `active_symbols` wait too.
- [x] 3.2 Add the private helper `hasContractTypesFor(symbol: string, timeout = SELECTION_WAIT_TIMEOUT): Promise<boolean>` that resolves `true` once `contract_types_list_v2_symbol === symbol && !isEmptyObject(this.contract_types_list_v2)` and `false` on timeout (swallowing `when`'s rejection), with a one-line doc comment. Place it next to `isTradeTypeOfferedInV2List` (~line 4026).
- [x] 3.3 Rewrite `resolveInitialMarket` phase 2's deep-link branch (~lines 3848-3869): replace `await when(() => !isEmptyObject(this.contract_types_list_v2))` with `const has_own_list = await this.hasContractTypesFor(this.symbol);`, keep the `selection_seq !== epoch` guard immediately after the await, and add the leading `if (!has_own_list)` branch that does nothing (comment: the deep-linked symbol stands; `resolveContractTypeAvailability` owns the type when the response lands). The offered / unknown-type / reconcile branches keep their existing bodies and comments.
- [x] 3.4 Replace the asymmetric branch in `reconcileUrlTradeTypeWithSymbol` (~lines 3991-4004) with the single wait-then-check from design D3: switch the symbol when it differs, `await this.hasContractTypesFor(compatible_symbol)`, re-check the epoch, `return` on timeout (no modal), then show the modal only when the market's own list lacks the type. Update the surrounding comments so they describe the new single path rather than the removed `else if`.
- [x] 3.5 Run `npm run test:jest -- packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` and confirm the three new tests are green and the pre-existing `resolveInitialMarket`, `atomic trade URL sync` and `proposal hold until contracts_for is applied` blocks still pass.
- [x] 3.6 Run `npm run test:jest -- packages/trader/src/AppV2/Components/MarketTabs/__tests__/market-tabs.spec.tsx packages/trader/src/AppV2/Hooks/__tests__/useContractsFor.spec.tsx packages/trader/src/AppV2/Hooks/__tests__/useGuideContractTypes.spec.tsx` — the other direct consumers of the resolver and the list.
- [x] 3.7 (PR review) At both decision sites, re-read `contract_types_list_v2_symbol` against the symbol under evaluation after `hasContractTypesFor` resolves and degrade on a mismatch, so a later stamp landing between the `when` firing and the caller resuming is never judged. Two red tests first (`[DLM-002] ignores a later list stamped for another market that lands before the resolver reads`, `[DLM-004] ignores a later list stamped for another market that lands after the switched-to symbol answers`): each stamps the awaited list, then synchronously restamps for the outgoing market, and failed on the symptom the guard removes (a silent switch to `1HZ100V`; the modal off the wrong list).

## 4. Record the invariant

- [x] 4.1 Add a `# Gotchas` entry to `CLAUDE.md` (next to the "Store growth" and "Daily-only expiry seed" entries): the processed V2 contract-type list carries the symbol it was built for (`contract_types_list_v2_symbol`, written only by `setContractTypesListV2`); every trade-type availability decision — `resolveInitialMarket` phase 2 and `reconcileUrlTradeTypeWithSymbol` — waits for the list stamped with the symbol under evaluation, because a new browser tab inherits the previous tab's `sessionStorage` and can hold the outgoing market's list; a wait that times out degrades (keep the symbol, no modal, no market substitution) rather than deciding on an unstamped list.

## Closing gates

Not tasks — a separate automated VERIFY stage runs the repo's own commands (`npm run test`, ESLint, Stylelint, TypeScript) and SHIP runs `openspec validate deep-link-after-crash-500-accumulators`. Do not run the full suite as a closing gate here; the targeted runs named in tasks 1.5, 2.5, 3.5 and 3.6 are the ones the implementing agent owns.

Manual verification of the reported reproduction (home-app Options → Top Markets cards after leaving Accumulators on Crash 500 active) is QA's, on QA's own checklist.
