## Open Questions

Resolve these before/while implementing. Recommended defaults are already baked into the checklist below — a reviewer may pick a different option and the tasks should be adjusted accordingly.

1. **Contract-details editor scope.** Issue #1216's reproduction and Figma target the trade form, but the same `TextFieldWithSteppers` +/- control is also used to edit TP/SL on open positions (`risk-management-item.tsx`).
    - (a) **[RECOMMENDED]** Include the contract-details editor too, so all web TP/SL amount inputs are stepper-less and consistent (Section 2 below).
    - (b) Trade-form only — leave `risk-management-item.tsx` unchanged (skip Section 2 and task 3.2); revisit later.
    - (c) Include both and also relocate the enable toggle into the action-sheet header per the "toggle remains in the sheet header area" wording — larger UI change; not recommended.

2. **Field label text.** The plain `TextField` needs the currency somewhere the removed `unitLeft` used to show it.
    - (a) **[RECOMMENDED]** `label = "Amount ({{currency}})"`, matching the already-migrated desktop TP input (`take-profit-input-desktop.tsx:247`) and the Stake field pattern.
    - (b) Placeholder-only `"Amount"` with no label and currency only in the range helper text (loses the always-visible currency cue when empty/disabled).
    - (c) Literal `"Stake ({{currency}})"` as written in the issue — rejected: it mislabels a TP/SL field as "Stake".

## 1. Trade-form responsive TP/SL input (`take-profit-and-stop-loss-input.tsx`)

- [x] 1.1 In `packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/take-profit-and-stop-loss-input.tsx:6`, remove `TextFieldWithSteppers` from the `@deriv-com/quill-ui` import and add `TextField`.
- [x] 1.2 Replace the `<TextFieldWithSteppers …>` element at `:308-342` with `<TextField …>`, removing the stepper-only props `unitLeft={currency_display_code}` (`:328`) and `minusDisabled={Number(new_input_value) - 1 <= 0}` (`:318`).
- [x] 1.3 Add `label={localize('Amount ({{currency}})', { currency: currency_display_code })}` and change `textAlignment='center'` (`:327`) to `textAlignment='left'` so the field matches the stake-style filled field.
- [x] 1.4 Keep all remaining props unchanged: `variant='fill'`, `allowDecimals`, `customType='commaRemoval'`, `className='text-field--custom'`, `disabled`, `decimals`, `data-testid` (`dt_tp_input`/`dt_sl_input`), `inputMode='decimal'`, `id`, `message` (range/error helper), `name`, `noStatusIcon`, `onChange`, `onKeyDown`, `onBeforeInput`, `placeholder`, `ref`, `regex`, `status`, `value`, `maxLength`.
- [x] 1.5 Confirm the accumulator note (`:352-356`) and the disabled-state overlay button (`:343-349`) still render unchanged.

## 2. Contract-details TP/SL editor (`risk-management-item.tsx`) — default: in scope (Open Question 1a)

- [x] 2.1 In `packages/trader/src/AppV2/Components/RiskManagementItem/risk-management-item.tsx:13`, drop `TextFieldWithSteppers` from the `@deriv-com/quill-ui` import (keep `TextField`, already imported and used at `:177`).
- [x] 2.2 Replace the `<TextFieldWithSteppers …>` element at `:216-235` with `<TextField …>`, removing `unitLeft={getCurrencyDisplayCode(currency)}` (`:232`) and `minusDisabled={Number(stepperValue) - 1 <= 0}` (`:223`); keep `allowSign={false}`, `allowDecimals`, `customType='commaRemoval'`, `decimals`, `message`, `name`, `noStatusIcon`, `onChange`, `placeholder`, `regex`, `status`, `inputMode`, `value`, `variant='fill'`.
- [x] 2.3 Add `label={localize('Amount ({{currency}})', { currency: getCurrencyDisplayCode(currency) })}` and change `textAlignment='center'` (`:230`) to `textAlignment='left'`.

## 3. Tests

- [x] 3.1 In `packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/__tests__/take-profit-and-stop-loss-input.spec.tsx` (real quill-ui, no mock), add an assertion that the +/- stepper controls are not rendered (the field is a plain filled input) and verify the existing toggle / type-and-save / empty-field-error / proposal-error / accumulator-note tests stay green via the `HeaderActionsHarness`.
- [x] 3.2 In `packages/trader/src/AppV2/Components/RiskManagementItem/__tests__/risk-management-item.spec.tsx`, unify the mocked `@deriv-com/quill-ui` `TextField` stub (`:18…`) to pass through `onClick`, `onFocus`, `onChange`, `value`, `message`, and `status` (covering both the read-only display and the now-plain editable field), and remove the unused `TextFieldWithSteppers` stub. (Skip if Open Question 1 → option b.)
- [x] 3.3 Run `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/__tests__/take-profit-and-stop-loss-container.spec.tsx` and `.../TakeProfit/__tests__/take-profit.spec.tsx`; fix any fallout from the swap.
- [x] 3.4 Run `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/RiskManagement packages/trader/src/AppV2/Components/RiskManagementItem` and `npm run test:eslint-all` for the touched files; ensure all pass.

## 4. Verify & finalize

- [x] 4.1 Run `npx -y @fission-ai/openspec validate derivatives-trader-issues-1216` and fix any structural errors. → "Change 'derivatives-trader-issues-1216' is valid".
- [x] 4.2 Visually confirm (dev server, both desktop and responsive breakpoints) that the Take profit and Stop loss action sheets show a filled field with no +/- buttons, the currency label, and the range helper — matching the Stake field and Figma. → Deferred to manual/visual QA: not runnable in this unattended run (authenticated dev-server session required). Functionally covered by the real-quill-ui "no +/- stepper buttons" unit assertion plus the currency-label/range-helper/save/validation suites; the swapped `TextField` is identical to the already-shipped desktop TP/SL and Stake fields.
- [x] 4.3 Confirm no docs reference the removed +/- control (per `.buildwright/steering/philosophy.md`); state so in the final report if none need updating. → No docs reference the TP/SL +/- stepper control (only unrelated "incremental" matches in `docs/architecture/architecture-analysis.md`); no doc updates needed.
