## Why

The custom stake editor treats two invalid amounts inconsistently. A below-minimum stake is reported the moment it is drafted — the input turns red, the minimum message shows, and Save greys out. An **empty** stake is not: on desktop Save stays enabled, the payout shows a dash, and "Amount is a required field." only appears _after_ the user presses Save ([#1512](https://github.com/deriv-com/derivatives-trader/issues/1512)).

The cause is structural, not cosmetic. A below-minimum stake produces an API error that lands in `stake_error`, which the desktop Save button's `disabled` expression already covers (`packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input-desktop.tsx:509-514`). An empty stake produces no API error at all — the proposal is deliberately withheld while the amount is `''` (`:209`, `:219`) and `handleProposalResponse` clears `stake_error` on empty (`:232-235`) — so none of the four disable conditions fire. The empty case is handled only inside `onSave` (`:435-441`), which is exactly why the user finds out after the click. Typing letters lands in the same state: the input's `regex={/[^0-9.,]/g}` (`:481`) strips them to an empty string.

The mobile sheet has half the fix already: `is_save_disabled` leads with `!displayAmount` (`stake-input.tsx:624-630`), so its Save is correctly disabled — but it too keeps the required message inside `onSave` (`:564-570`), so an emptied mobile field shows a disabled Save, a dashed payout, and no stated reason.

## What Changes

- Derive the empty-amount state at render time in both stake editors, from the **live input value**, and render `Amount is a required field.` in the input's message slot with the input in its error state — the same treatment the below-minimum message already gets, without waiting for a click.
- Add the empty-amount term to the desktop footer Save's `disabled` expression, so an empty stake disables Save exactly as a below-minimum stake does.
- Extract the desktop Save gate into one `is_save_disabled` value consumed by the button's `disabled`, the Enter-key handler (`handleKeyDown`, `:455-463`), and `onSave`'s own guard, so Enter cannot commit an amount the button refuses. Today those three conditions are written out three times and have already drifted.
- Keep the mobile Save gate as-is in effect (it already blocks empty) but route it through the same derived value, and add the missing empty term to the mobile Enter handler.
- Realign the two Playwright page objects that currently assert the buggy desktop behaviour (`verifyStakeInputSanitization` asserts desktop Save is _enabled_ on empty; `verifyInitialStakeRejectsInvalidAmount` clicks Save to make the required error appear), and the flow-doc row that documents it.

Not changing: the collapsed stake trade parameter stays neutral for every stake-field error, and **Buy** stays pressable and server-authoritative. Both are existing capabilities (`stake-error-confinement`) and this change touches neither.

## Capabilities

### New Capabilities

- `stake-required-amount`: An empty amount in the stake editor is a first-class inline validation state on both breakpoints — the required-field message shows while the field is empty and Save is blocked — rather than a message deferred to the Save press.

### Modified Capabilities

None. `stake-error-confinement` [SEC-003] and `balance-aware-stake-warning` [SEC-004] state that the desktop footer Save stays disabled while a front-end format error, an applicable proposal stake error, or a balance hint shows; those statements are not exhaustive and remain true. This change adds a further disable condition without altering any existing one, so it is an addition, not a modification.

## Impact

- `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input-desktop.tsx` — derived required-amount error; single `is_save_disabled` consumed by the button, `handleKeyDown`, and `onSave`; message/status slots.
- `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx` — same derived error keyed off `displayAmount` (the debounce means `proposal_request_values.amount` lags the field); message/status slots; `is_save_disabled` and `handleKeyDown` route through it.
- `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake.spec.tsx` — new cases in the existing `StakeInputDesktop` and `StakeInput` describes.
- `playwright/pages/TradeValidationPage.ts` (`verifyStakeInputSanitization`), `playwright/pages/TradeAutomatePage.ts` (`verifyInitialStakeRejectsInvalidAmount`), `playwright/flows/trade-automate/flow.md` (Flow 15.1 row 3) — these encode the current desktop behaviour and will fail against the fix.
- `CLAUDE.md` — the "Stake editor balance hint" gotcha enumerates the editor's Save gating; the empty-amount term belongs in it.

No API, dependency, store, or persistence change. The stake proposal request is untouched: it is still withheld while the amount is empty.
