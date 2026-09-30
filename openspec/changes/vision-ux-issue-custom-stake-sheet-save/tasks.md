## Open Questions

### Should the inline required-field message be added to the mobile stake sheet too, or is this desktop-only?

- [recommended] Both breakpoints — mobile already disables Save on empty but states no reason (a disabled Save over a dashed payout), and it is the same one-line derivation, so fixing one and not the other just moves the inconsistency (proceeding on this option)
- Desktop only — smallest diff and matches the issue's "likely code path"; leaves the mobile sheet with a silent disabled Save
- Desktop only now, with a deferral filed for the mobile message

## Closing gates (not tasks — the engine runs these)

The whole-change type-check, lint, Jest run and `openspec validate` are run by the automated verify/ship stages, not from this checklist. The Playwright E2E suite runs against a live environment with credentials and is **not** run here either; the page-object edits in section 5 are assertion realignments whose correctness is established by the Jest cases in sections 2–4. Manual QA on a real device — other contract types beyond Rise/Fall, and locale/keyboard behaviour when typing letters, per the issue's "What would confirm" — is QA's own checklist, not this one.

## 1. Desktop — red

- [x] 1.1 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake.spec.tsx`, inside the existing `describe('StakeInputDesktop')`, add a `describe('[SRA] empty stake amount')` block and a case asserting that after `await user.clear(screen.getByDisplayValue('10'))` the text `Amount is a required field.` is in the document and `screen.getByRole('button', { name: 'Save' })` is disabled. Run only this file (`npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake.spec.tsx`) against the unfixed component and record the failure inline here as `Red: <test name> — expected <x>, got <y>`.
    - Red: `[SRA-001] [SRA-002] shows the required-field message and disables Save the moment the field is cleared` — expected `Amount is a required field.` in the document after clearing the input, got no such text (unable to find it) and a footer Save button rendered without `disabled`.
- [x] 1.2 Add a case asserting Enter does not commit an empty amount: clear the input, `await user.keyboard('{Enter}')`, then expect `default_mock_store.modules.trade.onChange` not to have been called with an `amount` target. Run it against the unfixed component and record the `Red:` line inline. (This one may pass already — `onSave`'s own empty branch returns early — in which case record it as a characterization/regression guard rather than a red, in one line.)
    - Characterization (never red): `[SRA-002] does not commit an empty amount when Enter is pressed in the input` passed against the unfixed component — `onSave`'s empty branch already returned early. It guards the branch's removal in 2.3.
    - Characterization (never red): `[SRA-003] clears the required-field message and restores the range helper once a value is typed back` passed against the unfixed component (no message existed to clear); it pins [SRA-003] against a regression that leaves the message up after the field refills.

## 2. Desktop — green

- [x] 2.1 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input-desktop.tsx`, derive `required_stake_error` at render time from `String(proposal_request_values.amount ?? '') === ''`, using `localize('Amount is a required field.')` (design D1/D2). Comment it with why no API error can carry this state — the proposal is withheld at `:209`/`:219` and `handleProposalResponse` clears `stake_error` on empty at `:232-235`.
- [x] 2.2 In the same file, add a single `is_save_disabled` const combining `required_stake_error`, `is_loading_proposal`, `fe_stake_error`, `should_show_stake_error && stake_error`, and `balance_hint` (design D3). Point the Save `Button`'s `disabled` prop, `handleKeyDown`'s Enter branch, and `onSave`'s opening guard at it, deleting the three duplicated expressions and the now-redundant `is_fetching_1 || (should_send_multiple_proposals && is_fetching_2)` spelling in `onSave`.
- [x] 2.3 In the same file, lead the `TextField`'s `message` and `status` expressions with `required_stake_error` (design D4), and remove `onSave`'s `SET_FE_STAKE_ERROR` empty branch now that the guard covers it (design D5).
    - Design D4's premise ("nothing else can be present when the field is empty") does not hold on desktop: `onInputChange` returns before writing `amount` for a separator-terminated value (`:358-364`), so a one-shot `1.` into a cleared field — paste, or Playwright's `fill` — sets `fe_stake_error` while `amount` is still `''`. `required_stake_error` is therefore derived behind `fe_stake_error`, which keeps the slot because it describes what is in the field. Save is disabled in that state either way. Mobile needs no such guard: it writes `displayAmount` before the same early return.
    - Red: `[SRA-001] keeps the format error for a separator-terminated value set in one shot` — expected `Should be a valid number.` after `clear` then `paste('1.')`, got `Amount is a required field.` displacing it (message absent from the document).
- [x] 2.4 Re-run the file's tests; confirm 1.1 and 1.2 pass and the existing `[SEC-003]`, `[SEC-004]` and decimal-guard cases in the same describes still pass. (`-t "StakeInputDesktop"`: 15 passed, 0 failed.)

## 3. Mobile — red

- [x] 3.1 In the same spec file, inside the existing `describe('StakeInput')`, add a case asserting that after clearing the input the text `Amount is a required field.` is in the document. Run it against the unfixed component and record the `Red:` line inline.
    - Red: `[SRA-001] shows the required-field message the moment the field is cleared` — expected `Amount is a required field.` after clearing the mobile input, got no such text (unable to find it); the `Range $0.35 - $50,000.00` helper was still the only message.
- [x] 3.2 Add a case asserting the message is gone the moment a value is typed back in and does not reappear while the 300 ms debounce is pending (type `4` after clearing, then assert `queryByText('Amount is a required field.')` is null and `Range $0.35 - $50,000.00` is shown again) — this pins [SRA-003] against a future rewrite that reads `proposal_request_values.amount` instead of `displayAmount`. Record the `Red:`/characterization line inline.
    - Characterization (never red): `[SRA-003] clears the required-field message as soon as a value is typed back, before the debounce settles` passed against the unfixed component (no message existed to clear). It goes red if the derivation is later keyed off the debounced `proposal_request_values.amount`.

## 4. Mobile — green

- [x] 4.1 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx`, derive the same `required_stake_error` from `displayAmount === ''` (design D2 — `displayAmount`, not `proposal_request_values.amount`, because of the debounce at `:430-441`), and lead the `TextField`'s `message` and `status` expressions with it.
- [x] 4.2 In the same file, replace the leading `!displayAmount` term of `is_save_disabled` with `!!required_stake_error`, add the same term to `handleKeyDown`'s local `isSaveDisabled` (it is missing there today, so Enter can currently reach `onSave` with an empty field), and reduce `onSave`'s `displayAmount === ''` branch to a plain early return (design D5).
- [x] 4.3 Re-run the spec file; confirm 3.1, 3.2 and the existing `reports the save action disabled while the input is empty`, `[SEC-003]` and `[SEC-004]` cases pass. (Whole file: 83 passed, 0 failed.)

## 5. Playwright assertions that encode the old behaviour

- [x] 5.1 In `playwright/pages/TradeValidationPage.ts`, rewrite the desktop branch of `verifyStakeInputSanitization` (around `:869-887`) so both viewports assert the same thing: `stakeValidationMessage` has `TradeParametersPage.STAKE_REQUIRED_ERROR` and `stakeSaveButton` is disabled — with no `stakeSaveButton.click()`. Update the assertion messages, which currently read "Desktop allows Save to surface required validation for an empty stake".
- [x] 5.2 In `playwright/pages/TradeAutomatePage.ts`, apply the same collapse to the empty-draft block of `verifyInitialStakeRejectsInvalidAmount` (around `:2144-2156`): drop the `isMobile` split and the Save click, and assert the required message plus a disabled Save on both. Leave the surrounding below-min, trailing-decimal, max-payout and balance blocks untouched.
- [x] 5.3 Re-run `grep -rn "STAKE_REQUIRED_ERROR" playwright/` and `grep -rn "required field" packages/trader/src` and confirm the only remaining sites are the `TradeParametersPage` constant, the two page objects edited above, and the one literal per stake editor (design — Risks, first item). (Confirmed: constant at `TradeParametersPage.ts:673` + the two edited call sites; `Amount is a required field.` at `stake-input-desktop.tsx:428` and `stake-input.tsx:597` only. The store's `validation-rules.ts` copy is a separate, untouched validator; the other hits are Barrier/Duration messages.)

## 6. Documentation that states the old behaviour

- [x] 6.1 In `playwright/flows/trade-automate/flow.md`, correct Flow 15.1 row 3 (`| 3 | Initial stake empty | ... |`, line ~479): the action is now "clear field" with no Save press, and the expected result is `"Amount is a required field."` plus **Save** disabled on **both** platforms. Leave the neighbouring rows alone.
- [x] 6.2 In `CLAUDE.md`, extend the "Stake editor balance hint" gotcha to record that an empty amount is derived at render time from the live input value (desktop: `proposal_request_values.amount`; mobile: `displayAmount`), shows `Amount is a required field.` inline without a Save press, and disables Save on both breakpoints through the editor's single `is_save_disabled` — and that Buy remains exempt, unchanged.
