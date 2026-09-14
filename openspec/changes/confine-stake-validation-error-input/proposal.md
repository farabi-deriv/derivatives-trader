## Why

A stake-field error (an unaffordable stake, an out-of-range amount) currently leaks out of the stake editor: it turns the collapsed stake trade-parameter red and disables **Buy** via the client-provable balance gate. The result is a dead **Buy** button whose real reason lives elsewhere, and a user who cannot even attempt the trade to reach the authoritative server response. We want the stake error confined to where the stake is edited, and **Buy** left live so the backend's own insufficient-balance message is what the user meets.

## What Changes

- The collapsed stake trade parameter on the trade page (the chip/field that opens the editor) no longer renders in its error state because of a stake-field error — not for a front-end amount validation error, a proposal error tagged to the stake/amount field, nor a stake that exceeds the balance. It stays neutral on both breakpoints.
- **BREAKING** (behaviour): the client-provable balance gate that disabled **Buy** when the quoted charge exceeded the readable balance is removed. **Buy** stays pressable; pressing it surfaces the server-reported insufficient-balance sheet, which becomes the sole authority for affordability. This reverses the `balance-aware-buy-gate` capability.
- **Buy** quotes its payout normally in this state — the client-side payout withholding tied to the removed gate is dropped.
- The stake editor keeps its inline message and the input's error status. Save gating is aligned across breakpoints: both mobile and desktop Save are blocked while the balance hint or a validation error shows. Only **Buy** is exempt from the balance gate. This updates `balance-aware-stake-warning` (desktop Save now also gates on the balance hint) alongside the amount validation rules.

## Capabilities

### New Capabilities

- `stake-error-confinement`: a stake-field error is surfaced only inside the stake editor; it does not mark the collapsed stake trade parameter in error, and it does not disable **Buy**.

### Modified Capabilities

- `balance-aware-buy-gate`: the client-provable gate that made **Buy** unavailable, stated an inline reason next to it, withheld its payout, and defined its inert states is removed; the server-driven insufficient-balance path becomes the sole affordability authority. `The stake is never silently capped` is retained unchanged.

## Impact

- `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-mobile.tsx` — drop the `useTradeError`-driven error `status` on the collapsed field.
- `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-desktop.tsx` — drop the `useTradeError` + `isStakeAboveBalance` error state on the popover trigger.
- `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button.tsx` — remove `is_stake_above_balance` from the disable logic (and its now-unused `isStakeAboveBalance`/`balance` reads).
- `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button-content.tsx` — remove the `is_stake_above_balance` payout-withholding branch so the payout renders normally.
- Co-located tests: `.../Stake/__tests__/stake.spec.tsx`, `.../PurchaseButton/__tests__/purchase-button.spec.tsx`, `.../PurchaseButton/__tests__/purchase-button-content.spec.tsx`.
- `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input-desktop.tsx` — gate the footer **Save** button, `onSave`, and `handleKeyDown` on the balance hint so an unaffordable stake cannot be committed from the desktop modal.
- Specs: new `stake-error-confinement`, modified `balance-aware-buy-gate` and `balance-aware-stake-warning` (both breakpoints now block Save while the balance hint shows; only **Buy** is exempt).
- No API, dependency, or store changes; the server insufficient-balance path (`services_error` / `ServiceErrorSheet`) is untouched.
