## Open Questions

### Should the Strategy selector itself be disabled on a closed market, or only the numeric strategy/risk inputs?

- [recommended] Disable the Strategy selector too, alongside the numeric inputs (consistent with the manual params fully disabling on closure, and the Run control is hidden anyway — nothing to configure toward)
- Disable only the numeric inputs (Stake multiplier / Max. stake / thresholds) and leave the Strategy selector editable so users can pre-pick a strategy while closed

Proceeding with the recommended option: all four field types — including the Strategy selector — disable on a closed market.

## 1. Red — failing tests that reproduce the defect

- [x] 1.1 In `packages/trader/src/AppV2/Components/AutomationPanel/StrategySelector/__tests__/strategy-selector-mobile.spec.tsx`, add a test: rendering `StrategySelectorMobile` with `is_market_closed` and no lock (`disabled` false/omitted) disables the readonly trigger field (`toBeDisabled()`) and renders no automation-lock overlay (`container.querySelector('.trade-params__lock-overlay')` is null). Red today — the leaf ignores `is_market_closed`.
    - Red: `StrategySelectorMobile › [ASP-001][ASP-002] disables the trigger field on a closed market with no lock overlay` — expected the trigger disabled, got "Received element is not disabled". (The no-overlay assertion is characterization — an unlocked field never renders the overlay today.)
- [x] 1.2 In `packages/trader/src/AppV2/Components/AutomationPanel/StakeMultiplier/__tests__/stake-multiplier-mobile.spec.tsx`, add the same test for `StakeMultiplierMobile` (`strategy='martingale'`). Red.
    - Red: `StakeMultiplierMobile header actions › [ASP-001][ASP-002] disables the trigger field on a closed market with no lock overlay` — expected disabled, got "Received element is not disabled".
- [x] 1.3 In `packages/trader/src/AppV2/Components/AutomationPanel/MaxTradeStake/__tests__/max-trade-stake-mobile.spec.tsx`, add the same test for `MaxTradeStakeMobile`. Red.
    - Red: `MaxTradeStakeMobile › [ASP-001][ASP-002] disables the trigger field on a closed market with no lock overlay` — expected disabled, got "Received element is not disabled".
- [x] 1.4 In `packages/trader/src/AppV2/Components/AutomationPanel/ThresholdInput/__tests__/threshold-input-mobile.spec.tsx`, add the same test for `ThresholdInputMobile` (`threshold_type='take_profit'`). Red.
    - Red: `ThresholdInputMobile › [ASP-001][ASP-002] disables the trigger field on a closed market with no lock overlay` — expected disabled, got "Received element is not disabled".
- [x] 1.5 Add `packages/trader/src/AppV2/Components/AutomationPanel/__tests__/automation-panel.spec.tsx` (new): mock `useTraderStore` → `{ is_market_closed: true, is_automation_params_locked: false, amount, currency, contract_type }`, `useAutomationConfig` → a config whose `schema_keys` includes `MULTIPLIER`, `MAX_STAKE`, `TAKE_PROFIT`, `STOP_LOSS`, `useAutomationStore` → `{ config }`, `useDevice` → desktop, and the `@deriv/shared` track fns as no-ops. Assert every rendered readonly trigger field is disabled — the end-to-end proof that the desktop container wires `is_market_closed`. Red today.
    - Red: `AutomationPanel (desktop) market-closed disabling › [ASP-001] disables every strategy and risk-management field on a closed market with no lock overlay` — expected all 5 trigger fields disabled, got "Received element is not disabled". A second `[ASP-003]` test pins the run-active lock overlay (characterization — pre-existing, green from birth).

## 2. Green — thread `is_market_closed` through the field components

- [x] 2.1 Add `is_market_closed?: boolean` to the prop type of each wrapper (props already forward via `{...props}`): `StrategySelector/strategy-selector.tsx`, `StakeMultiplier/stake-multiplier.tsx`, `MaxTradeStake/max-trade-stake.tsx`, `ThresholdInput/threshold-input.tsx`.
- [x] 2.2 In each mobile leaf, add `is_market_closed?: boolean` and set the trigger `TextField` `disabled={disabled || is_market_closed}`; leave the overlay gated on `{disabled && <AutomationLockOverlay />}` unchanged: `StrategySelector/strategy-selector-mobile.tsx`, `StakeMultiplier/stake-multiplier-mobile.tsx`, `MaxTradeStake/max-trade-stake-mobile.tsx`, `ThresholdInput/threshold-input-mobile.tsx`.
- [x] 2.3 In each desktop leaf, add `is_market_closed?: boolean` and pass `disabled={is_market_closed}` to `TradeParameterPopover` alongside the existing `is_locked={disabled}`: `StrategySelector/strategy-selector-desktop.tsx`, `StakeMultiplier/stake-multiplier-desktop.tsx`, `MaxTradeStake/max-trade-stake-desktop.tsx`, `ThresholdInput/threshold-input-desktop.tsx`.
- [x] 2.4 In `packages/trader/src/AppV2/Components/AutomationPanel/automation-panel.tsx`, add `is_market_closed` to the `trade_store` destructure and pass `is_market_closed={is_market_closed}` to `StrategySelector`, both `StakeMultiplier`, `MaxTradeStake`, and both `ThresholdInput`.
- [x] 2.5 In `packages/trader/src/AppV2/Containers/Automate/automate-mobile.tsx` (already destructures `is_market_closed`), pass `is_market_closed={is_market_closed}` to `StrategySelector`, both `StakeMultiplier`, `MaxTradeStake`, and both `ThresholdInput`.

## 3. Verify

- [x] 3.1 Run the affected specs green: `npm run test:jest -- packages/trader/src/AppV2/Components/AutomationPanel` (covers the four mobile leaf specs and the new `automation-panel.spec.tsx`).
    - Ran `jest packages/trader/src/AppV2/Components/AutomationPanel --runInBand --watchAll=false`: 9 suites / 55 tests passed (includes the four mobile leaf specs and the new `automation-panel.spec.tsx`).
- [x] 3.2 Typecheck/lint the trader package for the touched files: `npm run test:eslint --workspace=@deriv/trader` (or the repo's ESLint task) and confirm no TS errors from the new prop.
    - Targeted ESLint on all 14 touched source files + the 5 spec files: 0 errors (remaining warnings — unused `React`/`getSheetInput`, `no-nested-ternary` — are all pre-existing, not introduced here). ts-jest type-checked the exercised source (desktop leaves + `automation-panel` via the new container spec, mobile leaves via their specs) with no TS errors from the new `is_market_closed` prop. The full-package eslint/typecheck gate is owned by the separate automated verification stage.
