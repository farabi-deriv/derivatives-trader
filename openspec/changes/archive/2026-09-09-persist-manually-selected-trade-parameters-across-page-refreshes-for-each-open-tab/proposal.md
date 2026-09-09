## Why

Manually chosen trade parameters (Duration, Stake, TP/SL, barriers…) are lost on a page refresh and bleed between market tabs ([#1186](https://github.com/deriv-com/derivatives-trader/issues/1186)). Two causes, both in `packages/trader/src/Stores/Modules/Trading/trade-store.ts`:

1. **Duration is overwritten on every cold load.** `duration_default_applied_for` (`:354`) is deliberately neither observable nor in `local_storage_properties`/`session_storage_properties` (`:483-510`), so it resets to `''` on every load. In `processContractsForV2` (`:1002-1009`) it is the _left_ operand of an `||`, so on a cold load `should_apply_default` is unconditionally `true` and the correct, stateless right operand — `isValidPersistedDuration(this.duration, this.duration_unit, this.duration_min_max, this.duration_units_list)` — is never reached. The restored duration is replaced by the configured default.
2. **Params are stored globally, not per tab.** Everything in `local_storage_properties` is one flat blob under `localStorage['trade_store']` (`BaseStore.saveToStorage`, `packages/trader/src/Stores/base-store.ts:186-197`). Tabs on the AppV2 strip are `(symbol, contract_type)` pairs in `open_markets` (`AppV2/Utils/open-markets-utils.ts:3-7`) and have no storage of their own — so every tab reads back whichever tab wrote last.

## What Changes

- **Add a per-tab trade-parameter store.** New util `packages/trader/src/AppV2/Utils/tab-trade-params-utils.ts`, mirroring the shape and conventions of `open-markets-utils.ts`: a map keyed on the tab's `(symbol, contract_type)` pair (`` `${symbol}|${contract_type}` ``, never an array index — indices shift under `removeFromOpenMarkets`/`replaceInOpenMarkets`), one map per `TOpenMarketsMode` (`manual` / `automation`), held in **sessionStorage**. Reads are validated and filtered like `readOpenMarkets` (`:35-38`), not blind-assigned like `BaseStore.retrieveFromStorage` (`base-store.ts:203-210`).
- **Save the outgoing tab's params and restore the incoming tab's** in `selectMarketAndTradeType` (`trade-store.ts:1097-1149`) — the single path every internal-tab switch goes through — under the existing `selection_seq` epoch guard (`:317`) so overlapping cascades cannot interleave one tab's restore with another's commit.
- **Scope the tab strip to the browser tab too.** `OPEN_MARKETS_STORAGE_KEYS` moves from localStorage to sessionStorage, with a one-time eviction of the abandoned localStorage entries, so a new browser tab opens a single default market tab instead of reopening another browser tab's markets. Consequence: the strip no longer survives closing the browser. See `design.md` D8 (Open Question 1, resolved as option (a)).
- **Distinguish "existing tab" from "new tab" explicitly.** A pair already on the strip restores its saved params; a pair that is not restores nothing and gets that trade type + market's defaults, even when another tab has customised values.
- **BREAKING (internal state): remove `duration_default_applied_for`** (`:354`, written at `:1028` and `:1304`, read at `:1003`) and drop it from the `should_apply_default` condition. The flag encodes session history, which is exactly what a refresh destroys. "Apply the default" becomes an explicit new-tab intent plus the stateless `isValidPersistedDuration` check. The existing stake heuristic `this.amount === this.default_stake` (`:1934`) is deliberately **not** copied — it infers "did the user change this?" from equality with the default, which silently fails whenever a user deliberately picks the default (rare for stake, common for duration, which comes from a short preset list).
- **BREAKING (persistence): move the tab-scoped params out of `local_storage_properties`** into the new sessionStorage map, with a one-time cleanup of the stale keys already sitting in `localStorage['trade_store']` (`retrieveFromStorage` blind-assigns every key present in the stored snapshot, so a reduced property list alone does not evict them). `currency` and `is_trade_params_expanded` stay in localStorage — they are account/UI-scoped, not tab-scoped. Consequence: params survive a refresh and a tab switch, but no longer survive closing the browser. See Open Questions in `tasks.md`.
- **Prune the map** inside `setActiveOpenMarkets` (`:1244-1258`) — the single writer for every add/remove/replace — so entries for closed or replaced tabs cannot accumulate.
- **Make the sites that currently fight a restore restore-aware** rather than disabling them: the stake/TP/SL reset (`:1920-1955`), the per-trade-type `applyDefaultDuration()` on a real trade-type switch (`:1381-1383`), the symbol-change cleanup `handleTradeParamsResetOnSymbolChange` (`:3273-3318`, called from `:1906`), and the availability fallback `resolveContractTypeAvailability` (`:1193-1239`). The restore is sequenced _after_ them; the fallback path declares a new-tab (defaults) intent because it replaces the tab's pair.
- **Restore the active tab on cold load** from `resolveInitialMarket` (`:2926-3028`), respecting the existing `setTimeout(0)` ordering it already awaits at `:2946` for `BaseStore`'s rehydrate (`base-store.ts:118-124`). A new browser tab has empty sessionStorage → no entries → defaults.
- No API, routing, or URL-param changes. Only `symbol`, `trade_type`, `chart_type`, `interval` are URL-synced (`packages/shared/src/utils/contract/trade-url-params-config.ts:22-28`); no parameter values live in the URL. `symbol`/`contract_type` stay in `session_storage_properties`, so the deep-link discrimination in `resolveInitialMarket` (`:2935-2941`), which compares URL params against `sessionStorage['trade_store']`, is untouched.

## Capabilities

### New Capabilities

- `tab-trade-params-persistence`: The contract for per-market-tab trade-parameter state — which parameters are tab-scoped, how they are keyed and stored, when a tab restores its saved values versus loads defaults, how the state survives a page refresh but not a new browser tab, and how entries are pruned when tabs close.

### Modified Capabilities

<!-- None. No spec under openspec/specs/ describes trade-parameter persistence or the duration default-application rule; the existing duration/allow-equals specs cover field chrome and toggle layout only. -->

## Impact

- **New code:**
    - `packages/trader/src/AppV2/Utils/tab-trade-params-utils.ts` — key builder, per-mode storage keys, validated read/write, whitelist picker, prune helper.
    - `packages/trader/src/AppV2/Utils/__tests__/tab-trade-params-utils.spec.ts`.
- **Modified code — `packages/trader/src/Stores/Modules/Trading/trade-store.ts`:**
    - `:354` remove `duration_default_applied_for`; `:1002-1009` rewrite `should_apply_default`; `:1028` and `:1304` drop its writes.
    - `:483-510` constructor storage lists — move the tab-scoped keys out of `local_storage_properties`; add the per-mode params maps and the one-time localStorage cleanup.
    - `:1097-1149` `selectMarketAndTradeType` — save outgoing, queue restore/defaults intent for incoming, apply at the tail when no `contracts_for` round trip is pending.
    - `:980-1049` `processContractsForV2` — consume the pending intent once the new pair's `duration_min_max`/`duration_units_list`/`default_stake` have landed.
    - `:1244-1275` `setActiveOpenMarkets` / `addOpenMarket` / `removeOpenMarket` / `replaceOpenMarket` — prune.
    - `:1193-1239` `resolveContractTypeAvailability` — declare a defaults intent when it swaps to `available_types[0]`.
    - `:2926-3028` `resolveInitialMarket` — queue the resolved pair's intent before `recordActiveMarketTab()`.
    - `:620-721` `makeObservable` registration for the new actions.
- **Tests extended:** `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` (notably the existing `processContractsForV2 duration reconciliation` block at `:1335`, whose "applies the configured default on first activation even when the retained duration is valid" case encodes the behaviour being fixed), `packages/trader/src/AppV2/Utils/__tests__/open-markets-utils.spec.ts`, `packages/trader/src/AppV2/Components/MarketTabs/__tests__/market-tabs.spec.tsx`.
- **Unchanged by design:** `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration.tsx:119-141` (its `isValidPersistedDuration` safety net stays as-is), `packages/shared/src/utils/contract/trade-url-params-config.ts`, `packages/trader/src/AppV2/Hooks/useContractsFor.ts`, `packages/trader/src/Stores/base-store.ts`.
- **No** new dependencies, feature flags, translations, or API surface.
