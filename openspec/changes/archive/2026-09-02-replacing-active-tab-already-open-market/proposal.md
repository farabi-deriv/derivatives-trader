## Why

Tapping the **active** market tab opens the market selector in "replace this tab" mode. When the market picked there is **already open as another tab**, the replace path de-duplicates the strip: the tapped tab is deleted, the tab count drops by one, and the pre-existing tab simply becomes active (issue [#1240](https://github.com/deriv-com/derivatives-trader/issues/1240)). The user loses a tab they never asked to close. The fix must instead treat that pick as a no-op on the strip: close the selector and activate the already-open tab, leaving both tabs in place.

## What Changes

- `selectMarketAndTradeType` (the single writer of "replace this tab" commits): when a replace commit's target `(symbol, contract_type)` pair is **already open as a different tab** than the one being replaced, drop the replace intent entirely — no tab is added, removed, or reordered — and let the normal symbol/contract_type commit activate the existing tab in its current position.
- The commit's failure-path rollback only reverses a replace that actually happened. Today it unconditionally assumes "a replace was attempted" whenever `replacing_market` was set; once a replace can be skipped (per the point above), the rollback must track that explicitly so a failed commit doesn't restore a replace that never took place.
- No change to: the `+` "add a tab" flow (already clears replace intent and is not on this code path), an in-place replace with a target that is **not** already open elsewhere (existing swap-in-place behavior), the remove control, or the disabled/automation-locked strip.

## Capabilities

### New Capabilities

- `market-tabs`: The Trade page market strip's tab-identity and selection behavior — which `(symbol, contract_type)` pairs are open as tabs, how a pair is added/removed/replaced, and which tab is activated by a market-selector commit. (Not yet present under `openspec/specs/`; the only capability spec proposed so far for this component, in the unmerged change `trade-type-and-market-switching-lacks-clear-visual-cues`, covers tab _presentation_ only, not this selection behavior.)

### Modified Capabilities

<!-- None. No existing spec under openspec/specs/ covers market-tab selection/replace behavior. -->

## Impact

- **Code**
    - `packages/trader/src/Stores/Modules/Trading/trade-store.ts` — `selectMarketAndTradeType` (~L1097-L1149): add the "target already open elsewhere" check before calling `replaceOpenMarket`, and track whether a replace actually happened for the failure-path rollback.
    - No change needed to `packages/trader/src/AppV2/Utils/open-markets-utils.ts` (`replaceInOpenMarkets`'s dedupe behavior is correct for genuine replaces; the fix is to stop calling it for this case) or to `packages/trader/src/AppV2/Components/MarketTabs/market-tabs.tsx` (the tap-to-replace entry point at L252-L266 is unaffected — it still sets `replacing_market` and opens the selector; the fix lives entirely in how the store resolves that intent on commit).
- **Tests**: `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` gains coverage for the "replace target already open as another tab" case (both the happy commit and the failed-commit rollback).
- **Dependencies / APIs**: none. Pure client-side tab-strip state fix; no server/API contract involved.
- **Surfaces**: mobile and desktop AppV2 Trade page (the tab strip and its underlying store are shared between both).
- **Out of scope**: the `+`-flow, in-place replace with a not-already-open target, and any change to which tab a replace selector shows as selectable (already-open markets stay selectable per the issue's decided behavior, not disabled).
