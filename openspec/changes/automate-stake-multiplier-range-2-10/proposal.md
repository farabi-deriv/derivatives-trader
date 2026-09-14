## Why

In Automate Trading → Strategy parameters, the mobile Stake multiplier editor shows a helper hint (a range sentence for Martingale, **"Minimum 1"** for D'Alembert) under the input so traders know the valid bounds before saving. The desktop/web editor renders the same field but no range hint, so web users edit blind and the two breakpoints are inconsistent (issue [#1369](https://github.com/deriv-com/derivatives-trader/issues/1369)). While aligning the hint, the desktop input's Martingale validation floor is also inconsistent with mobile — desktop accepts values as low as `1` while mobile enforces `MULTIPLIER_MIN` (2), which would contradict a newly shown range hint.

## What Changes

- Show the range hint under the Stake multiplier input on **desktop/web**, matching mobile: **"The value must be greater than 1 and no more than 10."** for the `multiplier` parameter and **"Minimum 1"** for `unit`, rendered via the `TextField` `message` prop when there is no active error.
- Align the desktop validation with mobile so the shown range is enforceable. Bounds are now resolved from the `auto_list_strategies` schema (`exclusiveMinimum: 1`, `maximum: 10`), making the enforced rule `> 1 and <= 10` (inclusive max). Both breakpoints branch on `param_key` and show the same "The value must be greater than {{min}} and no more than {{max}}." message.
- Add desktop unit-test coverage for the range hint and the Martingale minimum (the desktop component currently has no co-located test).

## Capabilities

### New Capabilities

- `automate-stake-multiplier-range`: The Stake multiplier / Stake increment editor in Automate Trading strategy parameters shows the allowed value range as a helper hint and enforces the strategy's minimum, consistently across desktop and mobile breakpoints.

### Modified Capabilities

<!-- None: no existing spec capability covers the Automate stake multiplier editor. -->

## Impact

- **Code**: both `StakeMultiplier` editors take a `param_key` and a resolved `bounds` prop, build `range_message` from them, wire it into the input `message` prop, and validate through the shared `getStakeMultiplierError`.
- **Tests**: new `packages/trader/src/AppV2/Components/AutomationPanel/StakeMultiplier/__tests__/stake-multiplier-desktop.spec.tsx`.
- **Copy**: the multiplier uses `getStakeMultiplierRangeText(bounds, localize)` — currently "The value must be greater than 1 and no more than 10." The increment keeps "Minimum 1".
- **Bounds**: resolved from the `auto_list_strategies` schema via `useAutomationConfig.getParamBounds(key)` rather than hardcoded. `multiplier` arrives as `exclusiveMinimum: 1` / `maximum: 10`, i.e. `> 1 and <= 10`. `MULTIPLIER_MIN`/`MULTIPLIER_MAX` remain in `automation-config.ts` as a private fallback only (no longer exported).
- **Payload**: `buildStrategyParameters` emits each value in the JSON type the schema declares — `multiplier` as a number rather than a string — instead of stringifying everything.
- `buildStrategyParameters` emits numeric params in their schema-declared type (`multiplier` as a number). `TAutoStrategyParameterProperty` gains `exclusiveMinimum`. No routing changes.
