## Open Questions

### Should Buy stay enabled for ALL client-provable stake shortfalls, fully retiring the balance-aware-buy-gate, or only stop reddening the chip while keeping Buy disabled?

- [recommended] Fully retire the client gate: Buy stays enabled and the server insufficient-balance sheet reports affordability on press (matches the request's "user should still be able to click purchase button which prompts a backend insufficient balance error")
- Keep Buy disabled but stop reddening the chip only (leaves a dead Buy button with the reason only in the editor — contradicts the request)
- Retire the gate only on desktop, keep it on mobile (splits behaviour across breakpoints for no stated reason)

## Tasks

### 1. Red tests — Buy button

- [x] In `packages/trader/src/AppV2/Components/PurchaseButton/__tests__/purchase-button.spec.tsx`, add/adjust a test: balance `0.77`, proposal `stake`/`ask_price` `4.00` (no server insufficient-balance error) → **Buy** is enabled. Red: `[SEC-002] keeps Buy enabled and quotes its payout when the charge exceeds the balance` — expected Buy enabled, got disabled (current `is_stake_above_balance` gate).
- [x] In the same spec, keep a test asserting a non-affordability proposal error still disables **Buy** (guards the retained `(info.has_error && !is_insufficient_balance)` condition). Characterization: `[SEC-002] still disables Buy for a non-affordability proposal error` — behaviour unchanged, never went red.
- [x] In `packages/trader/src/AppV2/Components/PurchaseButton/__tests__/purchase-button-content.spec.tsx`, add/adjust a test: with balance below charge, the payout amount is rendered (not the `-` placeholder). The unit `PurchaseButtonContent` no longer knows about balance, so the removed-branch payout-withholding red is carried by the integration test above (`$7.69` shown while the gate would render `-`); the unit test `[SEC-002] quotes the priced payout with no client-side balance withholding` is a characterization guard.

### 2. Red tests — collapsed stake trade parameter

- [x] In `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake.spec.tsx`, add a test for the desktop popover trigger: unaffordable committed stake (balance `0.77`, stake `10.00`) → the trigger is not in its error state. Red: `[SEC-001] leaves the desktop popover trigger neutral for an unaffordable committed stake` — expected neutral, got error (current `is_stake_above_balance`).
- [x] In the same spec, add a test for the mobile collapsed field: a `stake`/`amount` proposal error present → the collapsed `TextField` `status` is `neutral`. Red: `[SEC-001] leaves the mobile collapsed field neutral for a stake-field proposal error` — expected neutral, got `error` (current `useTradeError` status).

### 3. Implementation — Buy button

- [x] `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button.tsx`: remove `is_stake_above_balance` from `is_disabled`; delete the `is_stake_above_balance` computation, the `isStakeAboveBalance` import, and the now-unused `balance` read; stop passing `is_stake_above_balance` to `PurchaseButtonContent`. Leave `is_insufficient_balance`, the click handler, and all other disable conditions untouched.
- [x] `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button-content.tsx`: remove the `is_stake_above_balance` prop and its payout-withholding branch so the amount renders via the normal priced/`-`/skeleton logic.

### 4. Implementation — collapsed stake trade parameter

- [x] `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-mobile.tsx`: render the collapsed `TextField` `status='neutral'`; remove the `useTradeError` read and the `should_show_snackbar`/`has_error` locals if they become unused.
- [x] `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-desktop.tsx`: set the trigger `has_error={false}`; remove the `useTradeError` and `isStakeAboveBalance` reads and the `is_stake_above_balance`/`should_show_snackbar` locals if unused.

### 5. Green + refactor

- [x] Run the co-located suites and confirm green: 114 passed across PurchaseButton + Stake suites.
- [x] Run ESLint on the four changed files: no new warnings/errors introduced (the 3 remaining warnings — `account_currency`, StakePopoverContent `symbol`, and the content nested-ternary — are all pre-existing, verified against HEAD).

### 6. Specs & docs

- [x] Update `CLAUDE.md`: the two "Purchase button" gotchas describe the client-provable balance gate disabling **Buy** and the desktop chip red — revise them to state **Buy** stays enabled for a client-provable shortfall (server sheet is the authority) and the collapsed stake parameter stays neutral, keeping the stake-editor balance-hint behaviour accurate.
- [x] `openspec validate confine-stake-validation-error-input --strict` passes.

### 7. Revision — align desktop stake Save with mobile (block on balance hint)

- [x] Red test in `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake.spec.tsx`: with balance `4.00`, drafting an unaffordable `10` in the desktop modal disables the footer **Save**, and re-enables it once an affordable `4` is drafted.
- [x] `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input-desktop.tsx`: compute `balance_hint` before `onSave` and gate the footer **Save** button's `disabled`, `onSave`, and `handleKeyDown` on it — only **Buy** stays exempt.
- [x] Update the `balance-aware-stake-warning` delta and `CLAUDE.md` gotchas: both breakpoints now block Save while the balance hint shows; only **Buy** is exempt.
