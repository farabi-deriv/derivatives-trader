## Why

On the automation surfaces — the mobile `/automate` route and the desktop **Automated trading** panel — the manual trade parameters already go non-interactive when the active market is closed, and the **Run** control is hidden. But the automation configuration fields ("Strategy parameters" and "Risk management") stay fully editable, so a user can keep changing a strategy they cannot run. This is inconsistent with the manual parameters and lets a closed-market session look actionable when it is not.

## What Changes

- The automation configuration fields — the **Strategy** selector, the **Stake multiplier / increment**, the **Max. stake**, and the **Profit / Loss threshold** (take-profit / stop-loss) inputs — become non-interactive whenever the active market is closed, on both the mobile automation screen and the desktop Automated-trading panel. This mirrors how the manual trade parameters (`Stake`, `Duration`, …) already disable on a closed market.
- When a field is disabled **only** because the market is closed (no run active, symbol is automatable), interacting with it does **not** surface the automation-lock overlay/snackbar ("Parameters are locked until automation is stopped."). Closure is already communicated by the existing closed-market messaging and the hidden Run control; a lock message there would be misleading.
- The existing automation lock is unchanged: while a run is active or the active symbol is not automatable, the fields stay disabled and still show the automation-lock overlay/snackbar exactly as today, independent of market state. The Run/Pause/Stop controls remain hidden while the market is closed, as today.

No change to the manual trade parameters, the `is_automation_params_locked` lock itself, the stake/threshold validation, or the run controls.

## Capabilities

### New Capabilities

- `automation-strategy-params`: Interactivity contract for the automation panel's strategy and risk-management configuration fields — specifically, that they disable when the active market is closed without surfacing the automation-lock message, while preserving the existing run/non-automatable lock.

### Modified Capabilities

<!-- none: no existing capability spec covers the automation configuration fields' interactivity. -->

## Impact

- Presentational components under `packages/trader/src/AppV2/Components/AutomationPanel/` gain an optional `is_market_closed` prop threaded through their wrapper + mobile + desktop variants: `StrategySelector`, `StakeMultiplier`, `MaxTradeStake`, `ThresholdInput`.
- The two automation containers pass the store's existing `is_market_closed` to those fields: `packages/trader/src/AppV2/Containers/Automate/automate-mobile.tsx` and `packages/trader/src/AppV2/Components/AutomationPanel/automation-panel.tsx`.
- No store, API, or dependency changes. `is_market_closed` and `is_automation_params_locked` already exist on `TradeStore`.
