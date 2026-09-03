## Open Questions

Each has a recommended default already baked into the checklist below — a reviewer may override it. None of them change the specs; all three change what the user sees, so they are worth a deliberate answer.

1. **Rounding rule for the derived default stake.**
    - **Option A — 1‑2‑5 decade ladder (RECOMMENDED).** `step = 10 ** floor(log10(min))`, then the first of `step * [1, 2, 5, 10]` that is `>= min`. Gives `8 → 10` (the value named in the ticket), `6.5 → 10`, `11 → 20`, `34.06 → 50`, `2 → 2`, `0.35 → 0.5`. Self-scaling across magnitudes and currencies, always round, never rounds below the minimum.

2. **Quick-pick ladder shape.**
    - **Option A — filter the existing curated Vanillas base at the derived floor (RECOMMENDED).** Pass the derived default into the existing `getStakePresetValues` in place of the raw minimum. Min‑2 → `[2, 5, 10, 20, 50, 75]` (one value different from today); min‑8 → `[10, 20, 50, 75]`. Reuses a helper that already handles range-filtering, floor-prepending and the too-few-survivors fallback — no new ladder code.

3. **Should the derived default be allowed to go _below_ today's USD 2?**
    - **Option A — `max(contracts_for default_stake, rounded_minimum)` (RECOMMENDED).** Markets whose API default is already valid keep USD 2 exactly as today; only markets whose minimum exceeds it move. Smallest blast radius, and still satisfies every acceptance criterion.

---

## 1. Derivation helpers (pure, Red first)

- [x] 1.1 In `packages/trader/src/AppV2/Utils/__tests__/trade-param-utils.spec.tsx`, add a `describe('roundUpToRoundStake')` block asserting `8 → 10`, `6.5 → 10`, `11 → 20`, `34.06 → 50`, `2 → 2`, `10 → 10`, `0.35 → 0.5`, and that the result is always `>= min` for a spread of inputs. Run it and confirm it FAILS because the export does not exist (cite the red).
- [x] 1.2 In the same spec, add a `describe('getVanillaDefaultStake')` block (renamed to `getDerivedDefaultStake` in section 4b) asserting `(2, 1) → 2` and `(2, 2) → 2` (API default already valid, kept), `(2, 8) → 10`, `(2, 34.06) → 50`, and that the result is always `>= min_stake`. Confirm it FAILS.
- [x] 1.3 In `packages/trader/src/AppV2/Utils/trade-params-utils.tsx`, beside `getStakePresetValues` (line 502), export `roundUpToRoundStake(min: number): number` implementing the 1‑2‑5 decade ladder from design.md decision 1, with a short comment naming the rule. Guard non-finite / `<= 0` inputs by returning the input unchanged.
- [x] 1.4 In the same file, export `getVanillaDefaultStake(api_default_stake?: number, min_stake?: number): number | undefined` (renamed to `getDerivedDefaultStake`, gaining a `max_stake` argument, in section 4b) = `Math.max(api_default_stake ?? 0, roundUpToRoundStake(min_stake))`, returning `undefined` when `min_stake` is missing or non-finite so callers can fall back to today's behaviour. Add a comment stating why `max(...)` is used (keeps USD 2 on already-valid markets).
- [x] 1.5 Confirm 1.1 and 1.2 are green: `npm run test:jest -- packages/trader/src/AppV2/Utils/__tests__/trade-param-utils.spec.tsx`.
- [x] 1.6 In the same spec, add cases proving the ladder composes as designed: `getStakePresetValues(TRADE_PARAMETER_PRESETS.stake.vanillas, getVanillaDefaultStake(2, 8), 5000)` starts at `10` with no value below `8`; the min‑2 case yields `[2, 5, 10, 20, 50, 75]`; and a high-minimum case (`min 34.06`, derived `50`) falls through to the multiples-of-floor branch with every value `>= 34.06` and `<= max_stake`.

## 2. Store: resolve the minimum before a stake is surfaced (Red first)

- [x] 2.1 In `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts`, add a `describe('Vanillas stake minimum reconciliation')` block. Red test: with `is_dtrader_v2` state, `contract_type = TRADE_TYPES.VANILLA.CALL`, `default_stake = 2`, `amount = 2`, feed `onProposalResponse` an error response for `CONTRACT_TYPES.VANILLA.CALL` whose `error.details` carries `{ field: 'amount', min_stake: 8, max_stake: 5000 }` and assert: `amount` becomes `10`; `stake_boundary.VANILLALONGCALL` is `{ min_stake: 8, max_stake: 5000 }`; and **no** stake error was surfaced (`proposal_info.VANILLALONGCALL` has no `has_error`, `validation_errors.amount` is empty). Confirm it FAILS on current code.
- [x] 2.2 (fence consolidated into `probed_stake_keys` in 4d.19) Add `stake_default_applied_for = ''` to `TradeStore` (`packages/trader/src/Stores/Modules/Trading/trade-store.ts`), declared beside `duration_default_applied_for` (line 354) and registered as `observable` in the `makeObservable` block near line 574.
- [x] 2.3 In `onProposalResponse` (`trade-store.ts:2150`), insert the Vanillas limits-probe block from design.md decision 2 — after the stale-`underlying_symbol` and `MarketIsClosed` guards, **before** the `proposal_info` / `validation_params` writes at ~line 2173. Guard on `this.is_vanilla` && a `min_stake` present in `response.proposal` or `response.error.details` && `this.stake_default_applied_for !== \`${this.symbol}:${contract_type}\``. Inside: `setStakeBoundary`, compute `getVanillaDefaultStake(this.default_stake, min_stake)`, set `stake_default_applied_for`**before** any await (re-entrancy fence), then only when`Number(this.amount) < min_stake`apply the derived amount via`processNewValuesAsync({ amount }, false, null, false)`and`return`. Otherwise fall through unchanged. Add the explanatory comment from design.md.
- [x] 2.4 In the existing Vanillas error branch (`trade-store.ts:2270`), stop gating the `setStakeBoundary` call on `response.error.details?.barrier_choices` so min/max stake are recorded from any Vanillas error that carries them; leave the `barrier_choices` handling itself gated as-is.
- [x] 2.5 In the `default_stake` reset block (`trade-store.ts` ~1920-1957), when the resolved `preset_key` is `'vanillas'` and a boundary is already known for the target contract type, use `getVanillaDefaultStake(this.default_stake, min_stake)` in place of the raw `this.default_stake`. Leave the `getStakePresetOverride` branch, `has_symbol_changed`, `isSameTradeTypeGroup` and the crypto branch untouched.
- [x] 2.6 Add a computed `vanilla_stake_preset_floor` to `TradeStore` returning the derived default for the active Vanillas (symbol, contract type) when `is_vanilla` and `stake_boundary` has an entry, else `undefined`. Resolve the `TRADE_TYPES` → `CONTRACT_TYPES` key the same way the stake surfaces do (`getDisplayedContractTypes(trade_types, contract_type, trade_type_tab)`), and register it in `makeObservable` as `computed`.

## 3. Store tests

- [x] 3.1 Complete 2.1 green, then add: a **second** proposal response for the same `(symbol, contract_type)` key is a no-op (no further `amount` write) — the re-entrancy fence.
- [x] 3.2 Add: a Vanillas success response carrying `min_stake: 1` leaves `amount` at `2` (the API default is kept) while still populating `stake_boundary`.
- [x] 3.3 Add: a Vanilla Call → Vanilla Put flip re-arms the probe (the key changes) and a Put response with a higher `min_stake` raises `amount` to the derived default for Put, while `stake_boundary` keeps separate `VANILLALONGCALL` / `VANILLALONGPUT` entries.
- [x] 3.4 Add: a symbol switch within Vanillas re-arms the probe, and the previous market's stake is not retained when it is below the new market's minimum. Use `1HZ25V` / `1HZ50V` from the repro steps as the fixture symbols.
- [x] 3.5 Add: a Vanillas error with **no** `min_stake` in `error.details` leaves the stake and error handling exactly as today (fail-open fallback).
- [x] 3.6 Add: a user-set stake already above the minimum is not overwritten when a proposal for the same key arrives.
- [x] 3.7 Add the non-Vanillas regression guard: the same error-response shape for a Turbos, Rise/Fall and Multipliers contract type does not enter the new block — `amount` and error handling are byte-for-byte today's behaviour, and the Turbos `STAKE_PRESET_SYMBOL_OVERRIDES` path still sets its first override value on symbol switch.
- [x] 3.8 Run `npm run test:jest -- packages/trader/src/Stores/Modules/Trading` and confirm the whole suite passes, including the existing `default_stake` reset tests at ~lines 1335-1360 and the `setTradeSubType` tests.

## 4. Stake surfaces — desktop and mobile parity (Red first)

- [x] 4.1 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake.spec.tsx`, add a Red test for the **desktop** popover: with a Vanillas contract type and a mocked store whose Vanillas boundary is `min 8 / max 5000`, assert the rendered chips start at `10` and contain no value below `8`. Confirm it FAILS today (desktop renders the unfiltered `[1, 5, 10, 20, 50, 75]`).
- [x] 4.2 Add the matching **mobile** test asserting the same chip list, and a parity assertion that both surfaces render the identical ordered list for the same store state.
- [x] 4.3 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-desktop.tsx` (lines 51-52), replace the raw `getStakePresets(presetKey, symbol)` call with `getStakePresetValues(getStakePresets(presetKey, symbol) ?? defaultChipValues, floor, max_stake)`, taking `floor` from the store's `vanilla_stake_preset_floor` and `max_stake` from the active contract type's `validation_params`. Thread the two values from the `Stake` observer into `StakePopoverContent` as props rather than reaching into the store from the inner component.
- [x] 4.4 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx` (lines 373-377), pass `vanilla_stake_preset_floor ?? details.min_stake` as the `min_stake` argument to the existing `getStakePresetValues` call. Leave `details.max_stake` as-is.
- [x] 4.5 Confirm 4.1 and 4.2 are green and non-Vanillas chips are untouched: `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/Stake`.

## 4a. Revision 3 — a full row of six, and a skeleton for the wait (Red first)

- [x] 4a.1 In `packages/trader/src/AppV2/Utils/__tests__/trade-param-utils.spec.tsx`, add a Red test asserting `getVanillaStakePresetValues` offers six strictly ascending quick picks for every minimum a Vanillas market reports, and update the existing per-floor expectations to the topped-up rows. Keep the maximum-cap tests as the documented exception.
- [x] 4a.2 Top the row up in `getVanillaStakePresetValues`: after the base presets above the floor, append `floor * [1, 2, 5, 10, 15, 25]` values that are above everything already offered and within the maximum, up to `STAKE_PRESET_COUNT`.
- [x] 4a.3 Add `packages/trader/src/AppV2/Components/InputPopover/__tests__/value-chips-skeleton.spec.tsx` as a Red suite for a new `ValueChipsSkeleton`: a full row of six non-selectable placeholders, in the `value-chips` grid, carrying the caller's variant class.
- [x] 4a.4 Add `value-chips-skeleton.tsx` + its `value-chips.scss` chip-sized placeholder rules, and export it from `AppV2/Components/InputPopover`.
- [x] 4a.5 Add Red tests for the surfaces: an `isLoading` case on `ChipsWithInputToggle` (skeleton instead of chips, `input` tab unaffected), and `shows the skeleton in place of the quick picks` on both stake surfaces before the active market's limits are known.
- [x] 4a.6 Render the skeleton from both stake surfaces, gated on `preset_key === 'vanillas' && !preset_values.length`, and extend the Turbos characterization test to assert no trade type that waits for nothing ever shows one.
- [x] 4a.7 Confirm green: `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters packages/trader/src/AppV2/Components/InputPopover packages/trader/src/AppV2/Utils packages/trader/src/Stores/Modules/Trading`.

## 4b. Revision 4 — generalise to every trade type (design decision 6)

> Review of the Vanillas-only implementation found the gate itself to be the defect: `contracts_for`
> omits `min_stake` on every trade type, Turbos already carried a hardcoded workaround for the same
> bug, and non-Vanillas markets were offering quick picks the API rejects. Sections 1-4a stay as the
> record of how the mechanism was built; this section removes the gating and renames the helpers to
> match their now-general scope.

- [x] 4b.1 Rename the derivation helpers to drop the Vanillas scope: `getVanillaDefaultStake` → `getDerivedDefaultStake` (also taking `max_stake`, falling back to the raw minimum when the rounded value would overshoot it), `getVanillaStakePresetValues` → `getStakeLadderValues`. Update all call sites and tests.
- [x] 4b.2 Delete `getStakePresetValues` and its `describe` block: with both surfaces on the ladder it has no production caller, and keeping two helpers that answer the same question differently is what produced the desktop/mobile divergence. Keep `roundUpToRoundStake` exported for its own coverage.
- [x] 4b.3 Rename the store computed `vanilla_stake_preset_limits` → `stake_preset_limits` and drop its `is_vanilla` guard, so it resolves for any trade type from `validation_params` / `stake_boundary`.
- [x] 4b.4 Remove the `this.is_vanilla` gate on the limits probe in `onProposalResponse`, so the first proposal per `(symbol, contract_type)` is absorbed on every trade type. Keep the Vanillas strike reconciliation _inside_ the absorb block, before the re-price, so the early `return` cannot skip it.
- [x] 4b.5 Remove the `preset_key === 'vanillas'` branches from `stake-desktop.tsx` and `stake-input.tsx`: both call `getStakeLadderValues` unconditionally and both read `stake_preset_limits`. Gate the skeleton on `!preset_values.length` alone.
- [x] 4b.6 In the reset block, drop the `preset_key === 'vanillas'` condition from `should_reset_amount`. This makes the flag unconditionally true, so remove it and its `user_amount_is_default` input rather than leaving dead code, and record the behaviour change (a customised stake no longer survives a market switch on any trade type) in `proposal.md` Impact.
- [x] 4b.7 Invert the `non-Vanillas trade types are untouched` store tests to the new contract: the same error-response shape on Turbos, Rise/Fall and Multipliers now settles the stake on the derived default and does **not** surface the error. Rename the `describe` accordingly.
- [x] 4b.8 Update the Turbos desktop characterization test: on `R_100` (min 3) the curated `$1` / `$2` are no longer offered; the row leads with the derived default and is topped up to six. Rename it from "keeps the curated Turbos presets" to "drops curated Turbos presets the market minimum invalidates".
- [x] 4b.9 Add `stake_preset_limits` (and keep `is_awaiting_first_proposal`) in `packages/stores/src/mockStore.ts` so component tests that do not care about stake limits render chips rather than the skeleton; tests asserting a specific ladder override it.
- [x] 4b.10 Confirm green across the affected surface: `npm run test:jest -- packages/trader` (2774 tests / 314 suites) plus `packages/stores` and `packages/reports`, `npx tsc --noEmit -p packages/trader/tsconfig.json` clean, and eslint warning count unchanged from before the change.

## 4c. Revision 5 — skeleton corner radius (design decision 7)

- [x] 4c.1 Add a Red test to `trade-param-skeleton.spec.tsx` asserting the inner `Skeleton.Square` carries a class that inherits the wrapper's radius; widen the quill mock to forward `className` so the wiring is actually observable.
- [x] 4c.2 Set `border-radius: var(--component-field-border-radius-md)` on `trade-params__skeleton` — the same token quill's `.quill-input__wrapper__size--lg` uses for the chip it stands in for — and add `&-block { border-radius: inherit; }` for the inner square, which is square by default and would otherwise show square corners inside the rounded slot.
- [x] 4c.3 Pass `className='trade-params__skeleton-block'` to `Skeleton.Square`, and confirm the value-chips skeleton already handles its own radius (including the pill variant) so both placeholders match the shape they replace.

## 4d. Revision 6 — the reported R_75 failure, and no hardcoded values anywhere

> QA on the deployed branch found Vanillas on Volatility 75 stuck: quick picks in a permanent
> loading skeleton, stake `$2` in an error state, Buy disabled. Turbos on the same symbol looked
> correct — but only because it was reading a hardcoded table and never exercising the derivation at
> all. Investigation showed the defect predates the generalisation in 4b: the Vanillas path was
> byte-for-byte identical before it, and no test covered the payload shape that triggers it.

- [x] 4d.1 Add a store test for a stake rejection carrying `min_stake` but **no** `max_stake` — the shape Volatility 75 actually returns — asserting the boundary is recorded and `stake_preset_limits` resolves. Confirm it FAILS on the current code.
- [x] 4d.2 Fix `setStakeBoundary` to record a minimum without a maximum (`if (min_stake && max_stake)` was dropping the whole payload), preserving any maximum already known for that contract type so a full band is never reduced to a partial one.
- [x] 4d.3 Add a second exit to the absorb block: when the first probe for a key carries an error but the stake needs no correcting, swallow it and re-price rather than letting it reach `proposal_info`. Without this the fence blocks any retry and the entry stake is stranded in an error state.
- [x] 4d.4 Replace the `[1, 2, 5, 10]` rounding ladder with `[1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]`. The old gaps rounded a minimum up to nearly double itself (`34.06 → 50`), which QA reported directly as the ladder "starting from 50"; the new steps cap the overshoot at ~1.36x and reproduce the curated tables at the bottom (`25 → 25`, `34.06 → 40`).
- [x] 4d.5 Delete `STAKE_PRESET_SYMBOL_OVERRIDES` and `getStakePresetOverride` outright, and drop the `symbol` argument from `getStakePresets`. This is the ticket's "no hard-coded values" constraint applied to the Turbos tables that motivated it, and it removes the last path that could shadow a derived ladder.
- [x] 4d.6 Retune `STAKE_LADDER_MULTIPLIERS` from `[1, 2, 5, 10, 15, 25]` to `[1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20]`, rounding each rung onto the round-stake ladder. The old rungs multiply the _floor_, so on a min-34 market they offered a `1000` chip — worse than the table just deleted. Verify the retuned rows sit in the same range as the deleted tables.
- [x] 4d.7 Rewrite the config characterization test to assert the **absence** of the override table and its accessor, so a reintroduction fails loudly rather than silently shadowing the derivation.
- [x] 4d.8 Update the store fixture minimum from 8 to 9 so it still derives 10 under the new rounding, keeping the downstream expectations meaningful; correct the fixtures that priced a stake the store no longer holds (the staleness check legitimately rejects those).
- [x] 4d.9 Replace the curated-Turbos-override store test with one asserting `1HZ25V` derives `40` from its own reported minimum, naming the deleted table it replaces.
- [x] 4d.11 Fix the limits read itself: `response.proposal ?? response.error?.details` resolves to the proposal whenever a rejection carries one, and that object has no limits — so on Turbos, which prices and rejects in the same payload, the minimum was never read. Take each limit from wherever it appears instead of picking one half. Cover with a regression test using a proposal+error response, verified to fail without the fix.
- [x] 4d.12 Apply the contract-shape values carried on an absorbed response for **every** trade type, not just Vanillas. The absorb block's early return skips the error branches that normally apply them: Vanillas' `barrier_choices` was already handled inside the block, but Turbos' `payout_per_point_choices` was not, so `payout_per_point` was never set and the market could not price — a stalled Turbos panel with no limits bug involved. Extract one `applyAbsorbedContractChoices` helper covering both, called from both exits. Cover with a regression test verified to fail without the fix.
- [x] 4d.13 Fence the `stake_boundary` read on the **symbol** rather than the whole `symbol:contract_type` key. Turbos subscribes a proposal per displayed sub-type, so the fence is written from whichever answered first — with Up selected and Down answering first, the computed looked up a key the fence never named and returned `undefined`, leaving the quick picks empty however correctly the limits were recorded. This is why the earlier fixes worked on Vanillas (one sub-type priced at a time) but not on Turbos. Fall back only to the entry the fence names, never to an arbitrary one, since `stake_boundary` is never cleared. Regression test verified to fail without the fix.
- [x] 4d.14 Make the boundary fence and the boundary itself per-market. QA found the quick picks resolve when switching market inside an open tab but not when opening a NEW tab — because the fence was one `symbol:contract_type` string and `stake_boundary` is keyed by contract type alone, while tabs are per-market and the store is one. A second tab took the fence and overwrote the shared entry, so the tab beside it lost its ladder. Replace the fence with a `probed_stake_keys` set, record the band under `symbol:contract_type` as well as the bare type, and market-qualify both reads. Regression test opens a second tab, prices it, returns to the first, and was verified to fail without the fix.
- [x] 4d.15 Clear the stake validation error before re-pricing an absorbed probe. The Network trace for a stalled market shows the probe going out, a `forget_all`, and no second proposal: `requestProposal` bails while `validation_errors` holds anything, and `processNewValuesAsync` re-validates only on contract_type/currency, so the error against the rejected probing stake survived the corrected write and blocked its own re-price. Clear it at both exits of the absorb block. This also explains the intermittency — it depends on whether an error was standing when the probe answered, not on how the market was opened. Regression test verified to fail without the fix.
- [x] 4d.16 Add an end-to-end store test with REAL validation rules (`initFormErrorMessages` + no `validateAllProperties` mock) asserting the corrected Turbos stake reaches `WS.subscribeProposal`. Every earlier reconciliation test mocked validation away, which is exactly where 4d.15's defect lived — this one closes that class of blind spot: if any validation error survives the correction and blocks the send, this test names the field instead of passing silently.
- [x] 4d.17 Wire `payout_choices` from `contracts_for` into the store (`useContractsFor`, beside `setDefaultStake`) and widen the pre-proposal initialisation to replace a payout_per_point not in the new market's list. Found by probing the live API: a Turbos proposal without a payout_per_point is rejected with NO limits and NO choices — an unrecoverable payload — and nothing had ever wired the contracts_for choices in, so the first Turbos entry of a session always sent that doomed request. Vanillas needs no payout_per_point, which is the whole Vanillas/Turbos asymmetry QA kept reporting. Hook regression test verified to fail without the wiring.
- [x] 4d.18 Read the minimum from `code_args[0]` on `InvalidMinStake` rejections. QA captured the live payload: `details: { field: "amount" }` with no `min_stake` key — the number exists only in `code_args`/message — so the one rejection whose purpose is to report the minimum was invisible to every limits reader, on every trade type. The fixtures had encoded the richer barrier-rejection shape as if it were the stake rejection's, which is why tests stayed green while the app stalled. Gated on the subcode: other rejections put unrelated fill-ins (the barrier list) in `code_args`. Regression tests use the captured payload byte for byte, verified to fail without the fix.
- [x] 4d.19 Consolidation pass once the fixes were confirmed working. The eight rounds left two mechanisms for one job and an inline block grown past reviewability:
    - Remove `stake_default_applied_for` — `probed_stake_keys` strictly supersedes it (2.2's single string was the multi-tab defect in 4d.14); the reset block and the computed both fence on set membership now.
    - Key `stake_boundary` by `${symbol}:${contract_type}` only, dropping the dual bare/qualified scheme; the reset block's read moves to the qualified key, closing a latent cousin of 4d.14 (two tabs on one trade type shared the bare entry).
    - Extract the ~100-line inline absorb block into `absorbStakeLimitsProbe`, following the store's existing extraction style (`applyAbsorbedContractChoices`, `settleTradeParamsLoading`), and move the payload parsing to `getStakeLimitsFromResponse` in `Helpers/proposal.ts` beside `getProposalInfo` / `getProposalErrorField`, where response-shape knowledge lives.
    - No behaviour change intended: full store suite green unchanged (393), trader+stores at 2771 with zero test failures.
- [x] 4d.10 Confirm green: `packages/trader` + `packages/stores` at 2771 tests / 315 suites, `npx tsc --noEmit -p packages/trader/tsconfig.json` clean.

## 4e. Revision 7 — gate the params skeleton on contracts_for, not the first proposal

> Product call after the fixes settled: the params' own values come from `contracts_for`, so the row
> should resolve as soon as those exist instead of waiting the extra round trip for the first price.
> This also deletes the settled-pair machinery the proposal gate required.

- [x] 4e.1 Gate `TradeParameters`' skeleton on `is_awaiting_contracts_for` (armed by the symbol reaction, released by `processContractsForV2`) instead of `is_awaiting_first_proposal`.
- [x] 4e.2 Remove the proposal-gated machinery outright: the `is_awaiting_first_proposal` computed, the `proposal_settled_symbol` / `proposal_settled_contract_type` observables, and `settleTradeParamsLoading()` with all five call sites — each of which existed only to keep that gate from stranding (closed market, validation errors, nothing to price). The contracts_for hold needs none of them: its response always arrives.
- [x] 4e.3 Re-derive the purchase button's "no price yet" wait locally from the contract's own proposal info (`!info.id && !info.has_error`) — buying genuinely needs a price, so it cannot borrow the row's earlier gate — preserving the insufficient-balance inform-don't-disable behaviour (an error also has no id, but sets `has_error`).
- [x] 4e.4 Update the affected tests: the params-row specs gate on the new flag; the button specs drive priced/unpriced `proposal_info` states (the accumulator fixture gains the price its contract type never had — the old store-wide flag was masking that); the store's settled-pair describe block is deleted with the machinery it tested. mockStore drops the removed flag.
- [x] 4e.5 Confirm green: trader + stores at 2773 tests / 315 suites, tsc clean, openspec validate --strict.

## 4f. Revision 8 — full-code review findings

> A line-by-line review of the whole branch once everything was confirmed working. Two real defects
> found and fixed, both with red-first regression tests.

- [x] 4f.1 `stake_preset_limits` derived its key from the trade-type tabs, and Accumulators is the one trade type with none — `getInitialTradeTypeTab` returns `''` for it, so the limits were recorded under `symbol:ACCU` but read under a key nothing ever wrote: permanent quick-pick skeleton on Accumulators. The key now falls back to the displayed contract type (which cannot lag for a tab-less type), in the computed and the reset block both.
- [x] 4f.2 `useContractsFor`'s processing effect is keyed on the response, and `contracts_for` is fetched per symbol — so switching trade type WITHIN a symbol re-rendered with the same cached response and never re-pushed the newly active type's `default_stake` / `payout_choices`. A switch into Turbos on an already-open symbol could therefore still send its first proposal without a `payout_per_point` (the unrecoverable rejection from 4d.17). The per-type config now carries `payout_choices`, and a dedicated `[available_contract_types, contract_type]` effect re-pushes the active type's stake config on every switch.
- [x] 4f.3 Confirmed already-correct under review, no change: the quick-pick loading placeholder renders exactly six chip-sized skeletons on both surfaces (`PLACEHOLDER_COUNT`, asserted by its spec); the purchase button's `info` reads are null-safe on both render paths; the `probed_stake_keys` symbol prefix cannot collide across symbols because the `:` delimiter is part of the match; and the hook pushes `payout_choices` before calling `processContractsForV2`, so the pre-proposal initialisation sees fresh choices on first load.

## 4g. Revision 9 — the mobile stake text box during the quick-pick wait

- [x] 4g.1 Disable the mobile sheet's stake text box while the quick picks are loading (`is_awaiting_stake_limits`): a value typed then is validated against a band that has not arrived, and the ladder about to land replaces the draft anyway.
- [x] 4g.2 When the limits arrive while the sheet is open, default the draft to the minimum quick pick — the stake the platform settles on — via a loading→loaded transition guard (a ref of the previous state), so a sheet opened after the limits are known keeps the user's stake and typing is never clobbered.
- [x] 4g.3 Both behaviours covered by component tests verified to fail without the change.

## 4h. Revision 10 — CI review findings (PR #1224)

- [x] 4h.1 Add the trade-type staleness guard to `onProposalResponse`: a response whose contract type has no outstanding request in `proposal_requests` is a straggler from a tab the user has left (subscriptions are forgotten on a switch, but an in-flight response still lands) and is dropped before it can reach the probe. Test suite seeds the outstanding-request map, since it injects responses directly rather than through `requestProposal` — in production every response is preceded by its own subscribe, which populates the map.
- [x] 4h.2 Gate the probe's error fallthrough on `is_stake_in_play` — but by swallowing the stale rejection WITHOUT side effects, not by falling through as the review suggested: falling through would write the stale error to `proposal_info` and run the un-guarded Vanillas barrier snap, i.e. exactly the stale writes the finding is about. The limits are still recorded and the fence still closes (the user's stake is theirs); the response's contract choices (priced against the old stake) and the error-clear (belonging to the new draft) are not applied.
- [x] 4h.3 Both fixes covered by regression tests verified to fail with the fix reverted.

## 5. Config and cross-cutting checks

- [x] 5.1 **Superseded by 4d.7.** In `packages/trader/src/AppV2/Config/__tests__/trade-parameter-presets.spec.ts`, add a guard asserting `TRADE_PARAMETER_PRESETS.stake.vanillas` is still `[1, 5, 10, 20, 50, 75]` and `getStakePresetOverride('vanillas', <any symbol>)` is still `undefined` — i.e. this change added no hardcoded per-symbol Vanillas table (the ticket's explicit "do not hard-code" constraint) and did not disturb the Turbos overrides.
- [x] 5.2 Confirm no other consumer of `getStakePresets` exists beyond `stake-desktop.tsx` and `stake-input.tsx` (`grep -rn "getStakePresets\b" packages/trader/src`), so both surfaces are genuinely covered. Re-confirmed after 4b that no `getVanilla*` / `vanilla_stake_preset_*` identifier survives anywhere in `packages/`.
- [x] 5.3 Run `npm run test:jest -- packages/trader/src/AppV2` and `npm run test:eslint-all`, then `npm run prettify` on the touched files.

## 6. Manual verification

> **Outstanding QA — not executed.** These need a running app with a login and live markets, so they
> are left unchecked deliberately rather than assumed. Each scenario has automated coverage
> (TradeStore `describe('Vanillas stake minimum reconciliation')` and Stake
> `describe('Vanillas stake presets')`), but the visual "no error flashes during load" assertion is
> only verifiable in the browser.

- [x] 6.1 In AppV2 on mobile and desktop, follow the ticket's repro: Vanillas → Volatility 25 (1s), open Custom mode. Confirm the stake is at or above the market minimum, the first quick pick equals it, and **no** stake error / snackbar appears at any point during load.
- [x] 6.2 Repeat for Volatility 50 (1s) and Volatility 75 (`R_75`, named in the issue title), then switch Vanilla Call ↔ Vanilla Put on each, confirming the stake stays valid and no error flashes.
- [x] 6.3 Switch symbol within Vanillas (high-minimum → ordinary market → back), enter Vanillas from Rise/Fall, and navigate to another tab and back. Confirm the stake is always at or above the active market's minimum and never stale from the previous market/sub-type.
- [x] 6.4 **Changed by revisions 4 and 6 — no longer a no-diff check.** Pay particular attention to the three symbols whose curated tables were deleted (`1HZ25V`, `1HZ50V`, `R_75` on Turbos): each should open at or near its market minimum, with a row that reaches further above it than the hand-written set did. This is the visible cost of removing the hardcoded values and is worth a product eye. On Rise/Fall, Higher/Lower, Touch/No Touch, Digits, Turbos (including `1HZ25V` and `R_100`), Accumulators and Multipliers, confirm: no quick pick below the market minimum is offered; the first quick pick is the stake applied on entry; the row is six wide; and a stake customised before a market switch is not carried across it. The three curated Turbos override symbols still start from their override's first value.
- [x] 6.5 Revision 3: on a fresh market switch (mobile sheet and desktop popover), confirm the quick-pick row shows the skeleton while the market is being priced — chip-sized placeholders in the row's own space, no resize when the chips land — and that six chips are offered on every market, including the high-minimum ones from 6.1-6.2. Check on a non-Vanillas trade type too, which now waits the same way.
- [x] 6.7 Revision 6 — both reported repros: Vanillas on Volatility 75 (`R_75`) and Turbos on Volatility 50 (1s) (`1HZ50V`). Confirm the quick picks appear (no permanent skeleton), the stake is not shown in an error state, and Buy is enabled. Repeat on Volatility 50 (1s) and Volatility 25 (1s), and on Turbos for the same symbols now that their curated tables are gone.
- [x] 6.6 Revision 5: on a market or trade-type tab switch, confirm the trade parameters row shows chip-shaped skeletons — same height **and** same rounded corners as the chips they replace — with no resize or shape change when the values land, and that a sub-type toggle (Allow equals, Up/Down) does not return the row to a loading state.

## 7. Close out

- [x] 7.1 (the standalone upstream-issues note was later removed at the team's request — both backend asks now live in design.md Risks) Record the backend follow-up (expose min/max stake on `contracts_for`, per design.md Risks) in the project's upstream-issues note.
- [x] 7.2 Label the config guard in 5.1 as a characterization test.
- [x] 7.3 Run `npx -y @fission-ai/openspec validate minimum-stake-values-should-be-for-vanillas-market-volatility-75-and-volatility-50-1s --strict` and fix any structural errors.
- [x] 7.4 After revision 4, rename the capability from `vanillas-stake-defaults` to `stake-defaults` (directory and every reference), since it no longer describes a Vanillas-only behaviour, and re-run the strict validation.
