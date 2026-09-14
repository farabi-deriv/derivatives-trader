## Context

Three surfaces react to a stake-field error today:

- **Collapsed stake trade parameter.** `stake-mobile.tsx` sets `status={has_error && should_show_snackbar ? 'error' : 'neutral'}` and `stake-desktop.tsx` sets `has_error={(has_error && should_show_snackbar) || is_stake_above_balance}`, both driven by `useTradeError({ error_fields: ['stake', 'amount'] })` (proposal field error or `validation_errors`), plus the desktop's client-side `isStakeAboveBalance`.
- **Buy control.** `purchase-button.tsx` disables **Buy** when `is_stake_above_balance` (client-provable charge > readable balance) is true, and `purchase-button-content.tsx` withholds the payout (renders `-`) in the same state.
- **Stake editor** (`stake-input.tsx` / `stake-input-desktop.tsx`). Shows the inline message + error status and gates Save. This is the surface we want to keep as the single home for the error.

The client-provable gate and the desktop chip's `is_stake_above_balance` were introduced by the `balance-aware-buy-gate` capability. The server-driven insufficient-balance path (`services_error` → `ServiceErrorSheet`, and the `is_insufficient_balance` branch in `purchase-button.tsx`) is separate and remains the authority we lean on after this change.

## Goals / Non-Goals

**Goals:**

- Confine every stake-field error to the stake editor (mobile action sheet / desktop popover).
- Keep the collapsed stake trade parameter neutral for stake-field errors on both breakpoints.
- Keep **Buy** pressable for a client-provable stake shortfall and let the server insufficient-balance sheet report it on press.
- Restore normal payout quoting on **Buy** in that state.
- Align the desktop stake editor's Save gating with mobile: both breakpoints block **Save** while the balance hint shows, leaving **Buy** as the only balance-exempt control.

**Non-Goals:**

- Changing the stake editor's inline message or error status (owned by `balance-aware-stake-warning` and the amount validation rules).
- Changing **Buy**'s handling of non-affordability proposal errors, trade-disabled, account-switch, or logged-out states.
- Changing the server insufficient-balance path, its sheet, copy, or actions.
- Capping or rewriting the stake.

## Decisions

- **Remove `is_stake_above_balance` from `purchase-button.tsx`'s `is_disabled`** and stop passing it to `purchase-button-content.tsx`; delete the now-unused `isStakeAboveBalance` import and `balance` read there. Keep `is_insufficient_balance` and the existing click handler untouched so a press still opens the server sheet.
- **Drop the error state on both collapsed controls.** `stake-mobile.tsx` renders `status='neutral'`; `stake-desktop.tsx` renders `has_error={false}`. Remove the `useTradeError` / `isStakeAboveBalance` reads and any locals (`should_show_snackbar`, `is_stake_above_balance`) that become unused there. Errors continue to surface inside the editor unchanged.
- **Keep `(info.has_error && !is_insufficient_balance)` in the Buy disable.** In normal flow an out-of-range stake cannot be committed (the editor's Save is gated on the proposal stake error), so this condition does not fire for stake min/max; it correctly keeps disabling **Buy** for non-stake proposal errors (barrier, duration). This keeps the change scoped to the affordability case the request describes.
- **Gate the desktop stake **Save** on the balance hint.** In `stake-input-desktop.tsx` the `balance_hint` computation moves above `onSave` so the footer **Save** button's `disabled`, `onSave` (as a no-op guard), and `handleKeyDown` all read it — matching the mobile action sheet. Committing an unaffordable stake from the desktop modal is no longer possible; **Buy** remains the only balance-exempt control.
- **Spec modelling.** New capability `stake-error-confinement` states the positive behaviour (chip neutral, Buy enabled, editor unchanged). `balance-aware-buy-gate` is modified: its client-gate requirements are REMOVED and its server-path requirement is MODIFIED to be the sole authority. `balance-aware-stake-warning` is modified: its "mobile blocks Save, desktop does not" requirement is REMOVED and replaced by an ADDED requirement in which both breakpoints block **Save** while the hint shows. The `balance-aware-buy-gate` deltas keep the existing headingless requirement titles verbatim (that spec predates the requirement-ID convention) so the delta matches at archive time; only the new capability's requirements carry `[SEC-NNN]` IDs.

## Risks / Trade-offs

- **Reverses a deliberate P2 fix.** `balance-aware-buy-gate` was the fix for "Buy stays enabled when stake is 5x balance". Reverting it is an explicit product decision (see Open Questions in tasks.md); the mitigation is that the server insufficient-balance sheet already exists and remains the authority, so an unaffordable buy is still stopped — just on press rather than before it.
- **Extra round-trip on an unaffordable press.** The user now sends a buy that the server rejects for insufficient balance, versus being blocked client-side. Accepted: the editor's own balance hint still warns before commit, so this is an edge the user has already been warned about.
- **Unused-symbol cleanup.** Removing the reads can leave dangling imports/destructures; ESLint will catch them and they must be cleaned in the same edit.
