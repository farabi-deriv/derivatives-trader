## Why

The Multipliers trade type shows a fixed `x500` badge next to its label in the trade-type selector (both the desktop sidebar and the mobile market-selection tabs). Multipliers actually offers several leverage/multiplier values, so a hard-coded `x500` badge misrepresents the choices and implies x500 is the only or default option. Issue [#1067](https://github.com/deriv-com/derivatives-trader/issues/1067) asks that this badge be temporarily hidden.

## What Changes

- Remove the hard-coded `badge: 'x500'` value from the Multipliers entry in `AVAILABLE_CONTRACTS` (`packages/trader/src/AppV2/Utils/trade-types-utils.tsx`), so no leverage badge renders for Multipliers in the trade-type selector.
- Keep the generic `badge` infrastructure intact — the optional `badge?` field on `TAvailableContract`, the guarded render sites (`market-selection-sidebar.tsx`, `trade-type-tabs.tsx`), and the associated SCSS — so the badge can be re-enabled with a one-line change once a correct, dynamic value is available.
- No behavior change for any other trade type (none currently sets a `badge`).

## Capabilities

### New Capabilities

- `trade-type-selection`: Defines what badges/indicators the trade-type selector (desktop sidebar + mobile market-selection tabs) renders next to each trade type, including the rule that Multipliers shows no fixed leverage badge.

### Modified Capabilities

<!-- None. No existing spec under openspec/specs/ covers the trade-type selector badges. -->

## Impact

- Affected code:
    - `packages/trader/src/AppV2/Utils/trade-types-utils.tsx` — remove `badge: 'x500'` from the Multipliers entry.
- Affected UI (no code change, behavior follows from the guarded renders):
    - `packages/trader/src/AppV2/Components/MarketSelection/market-selection-sidebar.tsx` — desktop sidebar badge no longer renders for Multipliers.
    - `packages/trader/src/AppV2/Components/MarketSelection/trade-type-tabs.tsx` — mobile tab badge no longer renders for Multipliers.
- No API, dependency, store, or data-model changes. No other trade type is affected.
