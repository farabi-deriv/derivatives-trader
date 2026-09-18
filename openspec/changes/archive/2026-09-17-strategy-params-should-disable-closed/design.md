## Context

See `proposal.md — Why`. Two existing `TradeStore` computeds are the inputs:

- `is_market_closed` — the active symbol's trading-hours state.
- `is_automation_params_locked` — `is_automation_market_locked || (is_automation_mode && !is_symbol_automatable)`; true during a live run in the automation view, or when the active symbol is not automatable. Documented in `trade-store.ts` (~L1057).

The manual trade parameters already encode the target behaviour. `stake-mobile.tsx` disables its field on `has_open_accu_contract || is_market_closed || is_automation_params_locked` but renders `AutomationLockOverlay` only when `is_automation_params_locked`. `stake-desktop.tsx` uses the shared `TradeParameterPopover` with **two** props: `disabled={... || is_market_closed}` (disable, no overlay) and `is_locked={is_automation_params_locked}` (disable **and** overlay). `TradeParameterPopover` already implements this split: `disabled={disabled || is_locked}` on the field, `{is_locked && <AutomationLockOverlay />}`.

The automation configuration fields do not follow this. `StrategySelector`, `StakeMultiplier`, `MaxTradeStake`, `ThresholdInput` each take a single `disabled` prop that both disables the field and drives the overlay. Both containers pass `disabled={is_automation_params_locked}` and never pass anything for market closure — so the fields stay editable on a closed market. `AutomationLockOverlay` only speaks to lock reasons (run active / non-automatable), so naively folding `is_market_closed` into that single `disabled` prop would fire the wrong "Parameters are locked until automation is stopped." snackbar on a closed market.

## Goals / Non-Goals

**Goals:**

- Disable the four automation configuration field types when the active market is closed, on both breakpoints.
- Keep the automation-lock overlay/snackbar gated on the lock only, so a closed market never surfaces a lock message.
- Reuse the existing `disabled` (lock → overlay) vs. market-closed (disable only) split already established by `TradeParameterPopover` and the manual params.

**Non-Goals:**

- No change to `is_automation_params_locked`, the manual trade parameters, validation, or the run controls.
- Not adding a `ClosedMarketMessage` banner to the mobile `/automate` view (it has none today; the manual params there already disable without one). Out of scope — a separate concern, not a defect this change introduces.

## Decisions

**Decision: Add an optional `is_market_closed?: boolean` prop to the four field components; keep the existing `disabled` prop meaning "automation lock".**

- Mobile leaves (`*-mobile.tsx`): disable the trigger field on `disabled || is_market_closed`; leave the overlay gated on `{disabled && <AutomationLockOverlay />}` unchanged. So market-closure disables without an overlay; the lock keeps its overlay.
- Desktop leaves (`*-desktop.tsx`): pass `disabled={is_market_closed}` to `TradeParameterPopover` alongside the existing `is_locked={disabled}`. The popover already disables on either and overlays only on `is_locked`.
- Wrappers (`strategy-selector.tsx`, `stake-multiplier.tsx`, `max-trade-stake.tsx`, `threshold-input.tsx`): they forward props via `{...props}`, so only the prop type needs the new field.
- Containers: `automate-mobile.tsx` (already destructures `is_market_closed`) and `automation-panel.tsx` (add it to the destructure) pass `is_market_closed={is_market_closed}` at every field call site.

_Why:_ This mirrors the manual params and `TradeParameterPopover` vocabulary exactly (`disabled` = disable, no overlay; the lock = disable + overlay), with the smallest surface change. The two field components are consumed by only these two containers.

**Alternatives considered:**

- _Fold `is_market_closed` into the `is_automation_params_locked` computed._ Rejected: it conflates two distinct causes and would fire the automation-lock snackbar on a closed market (ASP-002 violation).
- _Rename the field components' `disabled` prop to `is_locked` and add a fresh `disabled` for market-closure._ Rejected: identical behaviour for more churn across ~12 files and their tests; the existing `disabled`-means-lock naming is pre-existing and not worth expanding scope to rename.

## Risks / Trade-offs

- [A container forgets to pass `is_market_closed`, since the prop is optional] → An end-to-end test on the desktop `automation-panel` renders a closed market and asserts the fields are disabled, proving the container wiring; the mobile container mirrors it and is covered by the leaf tests plus diff review.
- [The field components' `disabled` prop keeps its "lock" meaning while a new `is_market_closed` sits beside it — mildly confusing naming] → `is_market_closed` is unambiguous and matches the store field; the split matches `TradeParameterPopover`, which is the established pattern.
