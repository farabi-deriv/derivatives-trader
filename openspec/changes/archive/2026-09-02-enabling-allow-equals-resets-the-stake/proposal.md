## Why

On AppV2 (DTrader v2), toggling the **Allow equals** switch under Stake silently resets the user's stake back to the account default. Allow equals is a sub-type toggle within the Rise/Fall trade type — flipping it swaps `contract_type` between `rise_fall` and `rise_fall_equal` — but the store's "reset stake on trade-type switch" logic cannot tell a within-family sub-type flip from a real trade-type change, so it wipes a stake the user just entered. This is a data-loss bug in a core trade parameter and it fires on every Allow equals toggle.

## What Changes

- Fix `TradeStore.processNewValuesAsync` (`packages/trader/src/Stores/Modules/Trading/trade-store.ts`) so a `contract_type` change **within the same trade-type group** (e.g. `rise_fall` ↔ `rise_fall_equal`) is no longer treated as a trade-type switch for the purpose of resetting the stake. The stake the user set is preserved across an Allow equals toggle (on → off and off → on).
- Reuse the store's existing `isSameTradeTypeGroup` predicate to gate the reset, mirroring the precedent already set for duration: `applyDefaultDuration` only re-applies a default when `current_duration_group` actually changes, which is why duration already survives the toggle. Stake is brought in line with that behaviour.
- No change to the Allow equals UI, the `is_equal` flip itself, or the trade-type identity fence (`setTradeSubType`). Genuine trade-type switches (a different duration/trade-type group, or a symbol switch) still reset the stake to the default exactly as they do today.

## Capabilities

### New Capabilities

<!-- None. The behaviour lives under the existing allow-equals-toggle capability. -->

### Modified Capabilities

- `allow-equals-toggle`: Add a requirement that toggling Allow equals preserves the current stake (and the other trade parameters carried by a Rise/Fall contract). Today the capability only spec's the toggle's visibility and that it updates `is_equal`; it is silent on stake, which is where the bug hides.

## Impact

- Affected code:
    - `packages/trader/src/Stores/Modules/Trading/trade-store.ts` — the `default_stake` reset block inside `processNewValuesAsync` (currently ~lines 1922–1956): make the "contract type changed" determination group-aware via `isSameTradeTypeGroup` (defined at ~line 1172) so a same-group sub-type flip does not trigger the stake (and co-located take-profit / stop-loss) reset.
- Affected tests:
    - `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` — add coverage that an Allow equals toggle preserves a user-set stake, alongside the existing `setTradeSubType` tests that already assert the `rise_fall` ↔ `rise_fall_equal` flip.
- Affected UI (behaviour only, no code change):
    - `packages/trader/src/AppV2/Components/TradeParameters/AllowEquals/allow-equals.tsx` — desktop toggle switch and mobile minimized field both drive the fix through the same `onChange({ name: 'is_equal' })` path.
- No API, dependency, data-model, or store-shape changes. Genuine trade-type and symbol switches are unaffected.
