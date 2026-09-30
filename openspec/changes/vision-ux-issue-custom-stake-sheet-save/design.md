## Context

See `proposal.md` — Why. The design-relevant facts, all from the two editors as they stand:

- **No API error describes "empty".** Both editors gate their `useProposal` calls on a non-empty amount (`stake-input-desktop.tsx:209`, `:219`), and `handleProposalResponse` returns early clearing `stake_error` when the amount is `''` (`:232-235`). So the disable/message path that carries the below-minimum case structurally cannot carry this one.
- **The two editors hold their live value in different places.** Desktop's `TextField` is controlled directly by `proposal_request_values.amount`, which `onInputChange` writes on every keystroke. Mobile keeps a separate `displayAmount` state (`stake-input.tsx:402`) precisely so keystrokes render immediately while `proposal_request_values.amount` lags behind a 300 ms debounce (`:430-441`). Reading the wrong one on mobile would flag a just-typed value as missing for 300 ms.
- **Desktop writes its Save gate three times.** The `disabled` prop (`:509-514`), `handleKeyDown`'s local `isSaveDisabled` (`:457-458`), and `onSave`'s guard (`:427-434`) each restate the same four conditions. They already differ in shape (`onSave` spells out `is_fetching_1 || (should_send_multiple_proposals && is_fetching_2)` where the others use `is_loading_proposal`), which is the drift that let the empty case slip through one of them.
- **Two Playwright page objects assert the current behaviour as correct** — `TradeValidationPage.verifyStakeInputSanitization` (`:869-880`) asserts desktop Save is _enabled_ on empty and then clicks it, and `TradeAutomatePage.verifyInitialStakeRejectsInvalidAmount` (`:2144-2156`) does the same. They will fail against the fix and must move with it.

## Goals / Non-Goals

**Goals:**

- One derived value per editor that answers "is the amount missing?", consumed by the message slot, the input status, and the Save gate — so the three can never disagree again.
- Collapse the desktop Save gate to a single expression used by the button, Enter, and `onSave`.
- Leave the pricing path untouched: no proposal is sent for an empty amount before or after this change.

**Non-Goals:**

- No change to the collapsed stake trade parameter or to **Buy**. `stake-error-confinement` [SEC-001]/[SEC-002] keep the collapsed control neutral and Buy pressable/server-authoritative; an empty draft never reaches either, since it cannot be committed.
- No change to the mobile Save _gate's_ effect — it already blocks empty. Only its expression is routed through the shared value, and its Enter handler gains the term it is missing.
- No new validation for `0`, negative, or out-of-range amounts. Those are already the proposal's job and stay there.

## Decisions

### D1 — Derive the required-field error at render time; do not store it in the reducer

The required message is a pure function of the live input value, so it is computed on each render:

```ts
const required_stake_error = is_amount_empty ? localize('Amount is a required field.') : '';
```

**Alternative considered:** dispatch `SET_FE_STAKE_ERROR` from `onInputChange` when the new value is `''`. Rejected — it makes the message a second copy of state that has to be cleared on every path that can refill the field. On mobile that is four paths (`onInputChange`, `onPresetSelect`, the external-sync effect at `:424-426`, and the stale-seed heal at `:459-476`); missing one leaves a stale "required" message sitting under a filled field. The repo's own rule for this shape is in `CLAUDE.md` — _"a new derived value is a `computed`, never an observable kept in step by a reaction"_. The same reasoning holds for reducer state kept in step by a handler.

A derived value is also what makes [SRA-001] true by construction: there is no moment at which the field is empty and the message is absent, because the two are the same expression.

### D2 — Each editor reads its own live value

- Desktop: `String(proposal_request_values.amount ?? '') === ''`.
- Mobile: `displayAmount === ''`.

This is [SRA-003]. Using `proposal_request_values.amount` on mobile would show "required" for 300 ms after the user types the first digit into an empty field — the exact "mid-edit value wrongly flagged" trap. Mobile's existing `is_save_disabled` already reads `displayAmount` for the same reason, so this follows the file rather than introducing a rule.

There is deliberately **no shared helper** across the two files: the useful part is one string comparison, and the thing that actually differs (which value is live) is precisely what a shared helper would have to take as an argument. A helper would add indirection without removing a decision.

### D3 — One `is_save_disabled` per editor, consumed by button, Enter, and `onSave`

Desktop gains what mobile already has:

```ts
const is_save_disabled =
    !!required_stake_error ||
    is_loading_proposal ||
    !!fe_stake_error ||
    !!(should_show_stake_error && stake_error) ||
    !!balance_hint;
```

`disabled={is_save_disabled}`, `handleKeyDown`'s Enter branch, and `onSave`'s opening guard all read it. `onSave`'s current first guard is term-for-term equivalent (`is_fetching_1 || (should_send_multiple_proposals && is_fetching_2)` _is_ `is_loading_proposal`), so substituting it changes nothing except the drift risk. `onSave` keeps a guard rather than relying on the button — it is also invoked from Enter, and on mobile it is handed to the sheet header as a callback.

Mobile's `is_save_disabled` swaps its leading `!displayAmount` for `!!required_stake_error` (same condition, now named), and its `handleKeyDown` gains the term, closing the one path by which Enter could still reach `onSave` with an empty field.

### D4 — The required message leads the message/status precedence

```
required_stake_error || fe_stake_error || (should_show_stake_error && stake_error) || balance_hint || getInputMessage()
```

In practice nothing else can be present when the field is empty — `onInputChange` resets the front-end error, `handleProposalResponse` clears `stake_error`, and `getInsufficientBalanceMessage` returns its `null` fallback for a non-finite stake. Ordering it first states the intent rather than relying on that coincidence holding.

### D5 — `onSave`'s empty branch becomes a plain guard

Both editors currently dispatch `SET_FE_STAKE_ERROR: 'Amount is a required field.'` from inside `onSave`. With the message derived, that dispatch would write a second copy of a message already on screen. The branch is folded into the `is_save_disabled` guard, and the literal survives in exactly one place per file — the derivation. (`onSave` is still reachable with an empty field only if a future caller ignores the published gate, and the guard handles that.)

### D6 — The Playwright page objects move with the behaviour, in the same change

`verifyStakeInputSanitization` and `verifyInitialStakeRejectsInvalidAmount` become breakpoint-symmetric: assert the required message is present and Save is disabled, on both viewports, with no Save click. The `TradeParametersPage.STAKE_REQUIRED_ERROR` constant is unchanged — the copy is the same, only when it appears changes. `playwright/flows/trade-automate/flow.md` Flow 15.1 row 3 states the old split expectation in prose and is corrected alongside.

These are behaviour-alignment edits to assertions, not new tests, and the E2E suite runs against a live environment — see **Closing gates** in `tasks.md`.

## Risks / Trade-offs

- **[A test or page object still expects the old desktop flow and is missed]** → The full set is known and small: `grep -rn "STAKE_REQUIRED_ERROR" playwright/` returns exactly the three sites (the constant plus its two callers), and `grep -rn "required field" packages/trader/src` returns only the two component literals. Both greps are re-run as part of the tasks.
- **[The required message appears on mount, before the user has touched anything]** → Only reachable if the trade store's committed `amount` is empty, which it never is: `createInitialState` seeds from `trade_store.amount`, a number that `stake-defaults` guarantees is populated before the editor is openable. A test pins the mount state so a future regression here is caught.
- **[Mobile's stale-seed heal or preset tap transiently empties `displayAmount`]** → Neither writes `''`: `onPresetSelect` writes `String(value)` and the heal writes the minimum quick pick. The derived value is read-only over `displayAmount`, so it cannot itself introduce a flicker.
- **[Losing a distinct signal for "you typed letters"]** → The input strips non-numeric characters before any handler sees them, so "typed letters" and "cleared the field" were already indistinguishable downstream. Reporting both as a missing amount is the existing behaviour's message, shown earlier — not a new conflation.
