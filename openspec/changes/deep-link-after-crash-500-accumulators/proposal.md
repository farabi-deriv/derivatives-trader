# Deep link after Crash 500 Accumulators: default market or invalid trade type

## Why

A deep link from the home-app Options page (`?trade_type=rise_fall&symbol=1HZ25V&...`) opens in a **new browser tab**, and Chrome copies the originating tab's `sessionStorage` into it. When the originating tab last traded **Accumulators on Crash 500**, the new tab boots with the restored pair `CRASH500 + accumulator`, and `contracts_for(CRASH500)` can settle before the resolver has switched to the URL symbol. `resolveInitialMarket`'s phase 2 then evaluates the URL trade type against a `contract_types_list_v2` that still belongs to the **outgoing** market (`trade-store.ts:3849-3851`), so a perfectly valid link is judged "not offered" and falls through to `reconcileUrlTradeTypeWithSymbol` (`trade-store.ts:3867`):

- URL symbol = the account default `1HZ100V` → the compatible symbol equals the current one, the fail-fast branch fires `toggleUrlUnavailableModal(true, 'trade_type')` (`trade-store.ts:3997-4003`) → the **"Invalid trade type" popup**; the market never loads.
- URL symbol = anything else (e.g. `1HZ25V`) → the reconcile **silently switches the market to `1HZ100V`** (`trade-store.ts:3991-3992`) → the user trades a different index than the card they clicked, with no dialog and no error.

Both are branches of one defect: `contract_types_list_v2` carries no record of which market it was built for, so nothing can tell a fresh list from a leftover one. High severity — the user either cannot open their own default market card, or is silently landed on the wrong index. ([#1524](https://github.com/deriv-com/derivatives-trader/issues/1524))

## What Changes

- **Stamp the processed contract-type list with the market it describes.** `setContractTypesListV2` takes the response symbol as a required second argument and records it in a new `contract_types_list_v2_symbol` field, written by that setter and nowhere else. `useContractsFor` already passes the same symbol to `resolveContractTypeAvailability`, which has carried the identical `response_symbol !== this.symbol` staleness guard since it was written (`trade-store.ts:1586`) — this change gives the list the same identity.
- **Phase 2 of `resolveInitialMarket` waits for the resolved symbol's OWN list** before evaluating `isTradeTypeOfferedInV2List(url_trade_type)`, instead of waiting only for the list to be non-empty. A leftover list can no longer answer for a market it does not describe, so a valid deep link is honoured on the clicked symbol — no popup, no substitution.
- **`reconcileUrlTradeTypeWithSymbol` decides against the compatible market's own list** in both of its branches, collapsing today's asymmetric `if (compatible_symbol !== this.symbol) { wait } else if (!offered) { modal }` into one wait-then-check. The genuine reconcile case (e.g. a `trade_type=rise_fall` link landing on a Multipliers-only market) is unchanged.
- **Degrade, never substitute.** When the resolved symbol's `contracts_for` does not settle within the existing 30s selection timeout, the resolver keeps the URL symbol and leaves the trade type to `resolveContractTypeAvailability` — it does not switch markets and does not show the URL-unavailable modal, because a loading failure is not an unsupported trade type.
- Documents the new invariant as a `# Gotchas` entry in `CLAUDE.md`.

No UI, copy, routing, or API change. Not breaking: `setContractTypesListV2` has exactly one production caller.

## Capabilities

### New Capabilities

- `deep-link-market-resolution`: how a boot-time deep link (`?symbol=`/`?trade_type=`) resolves to a market and trade type, and the rule that every trade-type availability decision is made against the contract list belonging to the symbol under evaluation.

### Modified Capabilities

None. `market-tabs` (tab-strip ownership), `trade-type-availability` (which trade types the selector offers) and `trade-type-selection` (selector presentation) are untouched — this change only alters which contract list the boot resolver is allowed to read.

## Impact

- `packages/trader/src/Stores/Modules/Trading/trade-store.ts` — new `contract_types_list_v2_symbol` field + observable registration, `setContractTypesListV2` signature, a private `hasContractTypesFor()` wait helper, `resolveInitialMarket` phase 2, `reconcileUrlTradeTypeWithSymbol`.
- `packages/trader/src/AppV2/Hooks/useContractsFor.ts` — one call site passes the response symbol.
- `packages/stores/src/mockStore.ts` — the trade-store mock gains the new field.
- Tests: `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` (9 direct `store.contract_types_list_v2 = …` assignments move to the setter so each test names the market its list belongs to), `packages/trader/src/AppV2/Hooks/__tests__/useContractsFor.spec.tsx` (one assertion gains the second argument).
- No change to the WebSocket payloads, the number of `contracts_for` requests, or React Query caching.
