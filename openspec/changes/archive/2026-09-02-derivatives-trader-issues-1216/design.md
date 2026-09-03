## Context

See `proposal.md` — Why. The TP/SL amount inputs are built on two quill-ui controls:

- `TextFieldWithSteppers` — the base `Input` plus `unitLeft`/`unitRight` currency slots and `minusDisabled`/`plusDisabled`; it renders the +/- stepper buttons. Still used by the responsive trade-form input (`take-profit-and-stop-loss-input.tsx:308`) and the contract-details editor (`risk-management-item.tsx:216`).
- `TextField` — the base `Input` with no steppers and no `unitLeft`; it supports `label`, `textAlignment` (`left`/`center`), `variant`, `message`, `status`, `allowDecimals`, `customType`, `decimals`, `regex`, `maxLength`, `noStatusIcon`. Already used by the desktop TP/SL variants and by the Stake field.

The desktop variants (`take-profit-stop-loss-desktop.tsx`, `take-profit-input-desktop.tsx`) were already migrated to `TextField`, so this change is about bringing the remaining two responsive/contract-details inputs in line — a like-for-like control swap, not a rewrite.

## Goals / Non-Goals

**Goals:**

- Remove the +/- steppers from both TP and SL amount inputs by swapping `TextFieldWithSteppers` → `TextField`.
- Keep the currency and range affordances that `unitLeft` previously provided (currency now in the label; range already in the `message` helper text).
- Preserve every behaviour hanging off the field: toggle, proposal validation, dirty/save gate, decimals + comma-removal, `maxLength` growth, focus/keyboard handling, disabled overlay, accumulator note.

**Non-Goals:**

- No visual or structural change to the desktop TP/SL variants (already compliant).
- No quick-select amount chips for TP/SL, no Stake-field change, no deal-cancellation change.
- No store, API, or validation-rule changes — the `onChange`/`onChangeMultiple`/`contract.onChange` contracts stay identical.

## Decisions

### Decision 1: Swap `TextFieldWithSteppers` → `TextField` in place

Replace the component and drop the stepper-only props (`unitLeft`, `minusDisabled`). Keep all shared `Input` props unchanged. This is the smallest change that satisfies the design and reuses the exact control the desktop variants and Stake field already use (DRY, KISS).

- **Alternative — pass a "hide steppers" flag to `TextFieldWithSteppers`:** rejected; quill-ui exposes no such flag, and keeping the steppers component while hiding its buttons is more code for a worse result. CSS `pointer-events`/hiding was rejected in a related change as fragile.
- **Alternative — a new shared TP/SL input wrapper:** rejected as premature abstraction (YAGNI); the two call sites already differ enough (trade store vs contract store) that a shared wrapper adds coupling for little gain.

### Decision 2: Move currency from `unitLeft` into the field `label`

`TextField` has no `unitLeft`. The account currency will be shown in the label as `Amount ($)`, matching `take-profit-input-desktop.tsx` and the Stake field, which both compose the label from the currency symbol (`getCurrencySymbol`) after the currency-display standardisation (#1235). The range helper text already includes the symbol (`Range: $1 to $5,000`), so no currency information is lost.

- **Alternative — keep `placeholder='Amount'` with no label:** rejected; the filled "stake-style" field in Figma uses a persistent label, and dropping `unitLeft` without a label would remove the only always-visible currency cue when the field is empty/disabled.

### Decision 3: Left-align the text and keep `variant='fill'`

Set `textAlignment='left'` (the Stake/desktop convention) instead of the steppered field's `textAlignment='center'`, so the responsive field matches the referenced stake-style field. Retain `variant='fill'`.

- **Alternative — keep `textAlignment='center'`:** rejected; centered text paired with a leading label reads inconsistently versus the Stake and desktop fields the design is aligning to.

### Decision 4: Test strategy differs per file because of mocking

- `take-profit-and-stop-loss-input.spec.tsx` renders the **real** quill-ui components, so after the swap the DOM no longer contains stepper buttons naturally. Add an assertion that the +/- controls are absent (e.g. the extra stepper buttons no longer appear alongside the toggle) and confirm typing + validation + save still work via the existing `HeaderActionsHarness`.
- `risk-management-item.spec.tsx` **mocks** `@deriv-com/quill-ui`. The mock defines separate `TextField` (handles `onClick`/`onFocus` for the read-only display) and `TextFieldWithSteppers` (handles `onChange`) stubs. After the swap, both usages are `TextField`, so unify the `TextField` stub to pass through `onClick`, `onFocus`, `onChange`, `value`, `message`, and `status`, and remove the now-unused `TextFieldWithSteppers` stub.

## Risks / Trade-offs

- **[Currency cue changes from an inline unit to a label]** → Acceptable and intended: it matches the Stake/desktop fields the design references; the range helper text still carries the currency.
- **[`risk-management-item.spec.tsx` mock has two stubs that collapse into one]** → Mitigation: unify the `TextField` mock stub to cover both the display (`onClick`/`onFocus`) and editable (`onChange`/`value`/`message`/`status`) call shapes; run the suite to confirm.
- **[Behavioural regression hidden by the control swap]** → Mitigation: the co-located suites already cover toggle, empty-field error, valid save, proposal errors, and the accumulator note; keep those green and add the "no steppers" assertion. TDD per `.buildwright/steering/philosophy.md`: adjust/extend the tests first, then make them pass.
- **[`maxLength` growth logic referenced `new_input_value`]** → Unaffected: the `onBeforeInput`/`maxLength` handling lives on the base `Input` props, which `TextField` shares, so it carries over unchanged.

## Migration Plan

Pure front-end control swap; no data migration. Rollout is a standard deploy. Rollback = revert the component swap (git revert of the touched files). No feature flag needed — the change is visual/behaviour-preserving and covered by unit tests.
