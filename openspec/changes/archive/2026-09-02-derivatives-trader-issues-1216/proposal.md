## Why

The Take Profit and Stop Loss **amount** inputs on web still render the legacy `TextFieldWithSteppers` control with positive/negative (+/-) increment/decrement buttons ([issue #1216](https://github.com/deriv-com/derivatives-trader/issues/1216)). The current Figma design and the mobile app use a stepper-less, filled "Stake"-style field with a range helper — and the desktop trade-form TP/SL variants were already migrated to a plain `TextField`. The responsive/mobile action-sheet inputs (and the contract-details TP/SL editor for open positions) still show the +/- buttons, so web and mobile are inconsistent and off-design.

## What Changes

- Replace `@deriv-com/quill-ui`'s `TextFieldWithSteppers` with the plain `TextField` (base `Input`, `variant='fill'`) for the TP/SL amount inputs, so **no +/- increment/decrement buttons render**. Apply the same treatment to **both Take profit and Stop loss**.
- **Trade-form responsive input** (`take-profit-and-stop-loss-input.tsx`): the shared input rendered inside the combined _Risk management_ action sheet (TP & SL) and the standalone _Take profit_ action sheet on mobile/responsive web.
- **Contract-details editor** (`risk-management-item.tsx`): the same +/- control used to edit TP/SL on an open position, reached via the _Take profit_ / _Stop loss_ action sheets on the contract details page. (Scoped in by default for a consistent web experience; see Open Questions in `tasks.md` if a reviewer prefers trade-form-only.)
- Because the plain `TextField` has no `unitLeft` currency slot, surface the currency in the field **label** — `Amount ({{currency}})` — matching the Stake field and the already-migrated desktop TP input; drop the stepper-only props (`unitLeft`, `minusDisabled`). Keep the existing **"Range: {{min}} to {{max}} {{currency}}"** helper text, error messages, and the accumulator note **"Cannot be adjusted for ongoing accumulator contracts."**
- Preserve all existing behaviour: the enable/disable toggle switch, proposal-driven validation and save/dirty gate, decimals + comma-removal handling, `maxLength` growth, focus/keyboard behaviour, and the disabled-state overlay.
- Update co-located Jest tests to reflect the plain `TextField` (and assert the +/- stepper controls are gone).

Explicitly **out of scope** (per the issue): quick-select amount chips (1/5/10/20/50/100 USD) for TP/SL, and any change to the Stake field or the deal-cancellation tab. The desktop trade-form TP/SL variants already use `TextField` and need no change. No breaking changes; no API, store, dependency, or WebSocket changes.

## Capabilities

### New Capabilities

- `take-profit-stop-loss-input`: The presentation and interaction contract for the Take Profit / Stop Loss **amount** input field on web (trade form and contract-details editors) — the control style (filled text field with no increment/decrement steppers), the currency and range affordances, and the behaviour that must be preserved (toggle, validation gating, save).

### Modified Capabilities

<!-- None. openspec/specs/ has no existing spec covering the TP/SL amount input. The existing specs (allow-equals-toggle, barrier-input, barrier-range-errors, duration-end-time-fields, market-info-sync, positions-drawer, themed-scrollbars, contract-details-chart, market-descriptions) cover unrelated trade parameters and surfaces. -->

## Impact

**Affected code (`inferred from code`):**

- `packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/take-profit-and-stop-loss-input.tsx` — `:6` imports `TextFieldWithSteppers`; `:308-342` renders it with `unitLeft={currency_display_code}`, `minusDisabled={Number(new_input_value) - 1 <= 0}`, `textAlignment='center'`. This is the primary swap site. Consumed by:
    - `packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/take-profit-and-stop-loss-container.tsx:209-227` (combined TP & SL sheet, via `risk-management-picker.tsx`).
    - `packages/trader/src/AppV2/Components/TradeParameters/TakeProfit/take-profit.tsx:68` (standalone Take profit sheet on mobile; desktop path returns `TakeProfitDesktop` at `:35-37`).
- `packages/trader/src/AppV2/Components/RiskManagementItem/risk-management-item.tsx` — `:13` imports `TextFieldWithSteppers`; `:216-235` renders it with `unitLeft`, `minusDisabled`, `allowSign={false}`, `textAlignment='center'`. Rendered by `AppV2/Components/TakeProfit/take-profit.tsx` and `AppV2/Components/StopLoss/stop-loss.tsx` (contract-details, open positions). The file already imports the plain `TextField` (used at `:177` for the read-only display field).

**Already compliant (no change):**

- `packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/take-profit-stop-loss-desktop.tsx:375,420` and `packages/trader/src/AppV2/Components/TradeParameters/TakeProfit/take-profit-input-desktop.tsx:244` already use plain `TextField` (`variant='fill'`, no steppers).

**Target pattern (`inferred from code`):**

- `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx:548-570` — plain `TextField` with `variant='fill'`, `textAlignment='left'`, `label={localize('Stake ({{currency}})', ...)}`, range in `message`. This is the "stake-style" field the issue references.
- quill-ui API: `TextFieldWithSteppers` (`node_modules/@deriv-com/quill-ui/dist/components/Input/text-field-with-steppers/index.d.ts`) extends base `Input` adding `unitLeft`/`unitRight`/`minusDisabled`/`plusDisabled`; plain `TextField` = base `Input` (`.../text-field/index.d.ts` → `.../base/index.d.ts`) which supports `label`, `textAlignment` (`left`/`center`), `variant`, `message`, `status`, `allowDecimals`, `customType`, `decimals`, `regex`, `maxLength`, `noStatusIcon` — everything the TP/SL fields need except `unitLeft`.

**Tests:**

- `packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/__tests__/take-profit-and-stop-loss-input.spec.tsx` — uses the **real** quill-ui components (no mock); extend to assert the +/- steppers are absent and typing/validation still works.
- `packages/trader/src/AppV2/Components/RiskManagementItem/__tests__/risk-management-item.spec.tsx` — **mocks** `@deriv-com/quill-ui` (`:18`) with separate `TextField` and `TextFieldWithSteppers` stubs; unify the stub so the editable field's `onChange`/`value`/`message`/`status` still work after the swap.
- `packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/__tests__/take-profit-and-stop-loss-container.spec.tsx` and `.../TakeProfit/__tests__/take-profit.spec.tsx` — smoke-check they still pass.

**Docs:** No user-facing docs reference the +/- control; none require updates (per `.buildwright/steering/philosophy.md` "Documentation Is Part of Done", this is stated explicitly here).
