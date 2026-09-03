## Purpose

Moves the discovery of an unaffordable stake from the **Buy** button back to the moment the stake is chosen. The stake input warns when the drafted amount exceeds the account balance, so a user with USD 4 who taps the `10 USD` preset is told so in the sheet instead of finding out after committing the value and tapping **Buy**. On the desktop modal this warning is purely informational; on the mobile action sheet it also blocks **Save** for as long as it shows (see "The mobile action sheet's Save is blocked while the warning shows" below).

## ADDED Requirements

### Requirement: The stake input warns when the drafted stake exceeds the balance

Both stake inputs — the mobile sheet (`packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx`) and the desktop modal (`.../stake-input-desktop.tsx`) — SHALL show a balance-aware hint whenever the currently drafted stake exceeds the active account's balance.

The hint SHALL reuse the gate's below-stake string, `You only have {{balance}} {{currency}} left. Try a lower stake.`, resolved through the same `getInsufficientBalanceMessage` helper, so there is one balance-aware sentence to translate and the sheet and the gate can never disagree about the balance they report.

The hint SHALL be driven by the value the user is looking at (the local display amount), so it appears as soon as a preset is tapped or an amount is typed — it SHALL NOT wait for a proposal round-trip, because `proposal` is a pricing call that never rejects on balance.

The balance and currency SHALL come from `ClientStore` (`client.balance`, `client.currency`) — the stake inputs currently read `useTraderStore()` only and gain a `useStore()` read for this.

#### Scenario: Tapping an unaffordable preset warns immediately

- **WHEN** the account balance is `4.00 USD` and the user taps the `10 USD` preset chip in the mobile stake sheet
- **THEN** the input shows `You only have 4.00 USD left. Try a lower stake.` without waiting for the proposal response

#### Scenario: Typing an unaffordable amount warns immediately

- **WHEN** the account balance is `4.00 USD` and the user types `10` into either stake input
- **THEN** the same hint is shown

#### Scenario: An affordable stake shows no warning

- **WHEN** the balance is `4.00 USD` and the drafted stake is `4` or `1`
- **THEN** no balance hint is shown and the input's existing range hint is displayed as before — a stake exactly equal to the balance is affordable

#### Scenario: The desktop stake modal warns the same way

- **WHEN** the balance is `4.00 USD` and the user drafts `10` in the desktop stake modal
- **THEN** the identical hint appears in that input's message slot

#### Scenario: An unknown balance shows no warning

- **WHEN** `client.balance` is `undefined`, `''` or non-numeric
- **THEN** no balance hint is shown — the input behaves exactly as it does today rather than reporting a `0.00` balance

#### Scenario: A zero balance warns too

- **WHEN** the account balance is `0` and the user taps any stake preset (or an amount is already drafted)
- **THEN** the input shows `Balance is empty. Deposit funds to buy this contract.` instead of staying silent

### Requirement: The warning only applies while the drafted amount is the sum being charged

The hint SHALL be shown only when `TradeStore.basis` is `stake`, because the drafted amount is the sum the account is charged only on that basis.

On `payout` basis the field holds a target payout and the charge is the lower `ask_price`, so comparing it against the balance would warn about a trade the user can in fact afford. `payout` basis is reachable: `PurchaseButton` switches `basis` to `stake` for every trade type **except** Rise/Fall (`packages/trader/src/AppV2/Components/PurchaseButton/purchase-button.tsx:196-201`), and `basis` is persisted to localStorage (`trade-store.ts:488`). Any other value SHALL likewise be treated as "not a stake" and stay silent rather than risk a wrong number: the empty string before the contract config resolves, and `multiplier`. Note that the `multiplier` literal does **not** come from the Multiplier product — that declares `basis: ['stake']` (`packages/shared/src/utils/constants/contract.ts`) like accumulators, turbos and vanillas, and so takes the `stake` branch. `multiplier` is produced only by the Lookback trade types `LB_CALL`, `LB_PUT` and `LB_HIGH_LOW`, which declare `basis: ['multiplier']` (`contract.ts:127,133,139`). Lookbacks are not offered in AppV2 today, so this branch is defensive/future-proofing rather than reachable in the current UI.

Every trade type AppV2 offers resolves to `stake` by default (`packages/shared/src/utils/constants/contract.ts`: accumulators, multipliers, turbos and vanillas declare `basis: ['stake']`; the classic types declare `['stake', 'payout']` and default to the first), so this guard costs nothing in the common case. The gate at **Buy** remains the authority whenever the hint stays silent.

#### Scenario: Payout basis shows no warning

- **WHEN** the balance is `4.00 USD`, `basis` is `payout`, and the user drafts `10` (a target payout, whose charge would be lower)
- **THEN** no balance hint is shown and the input's range hint is displayed as before

#### Scenario: An unresolved basis shows no warning

- **WHEN** `basis` is `''`, or any other non-`stake` value such as `multiplier` (the Lookback trade types' declared basis, not the Multiplier product's)
- **THEN** no balance hint is shown

### Requirement: The warning never masks a real error

The hint SHALL be ranked below real validation errors in the input's existing single `message` slot: a proposal `stake_error` (when it applies) and a front-end format error SHALL both take precedence over it, and the hint SHALL take precedence over the informational min/max range hint. This applies identically on both breakpoints.

#### Scenario: A proposal stake error outranks the balance hint

- **WHEN** the drafted stake is both above the balance and outside the contract's `min_stake`/`max_stake`, and the proposal returns that error
- **THEN** the proposal's own error message is shown (with `status` `error`), not the balance hint

#### Scenario: A malformed amount outranks the balance hint

- **WHEN** the user types a trailing separator so the front-end format error `Should be a valid number.` is set, on an amount above the balance
- **THEN** the format error is shown, not the balance hint

#### Scenario: The balance hint outranks the range hint

- **WHEN** the drafted stake is above the balance but inside the contract's stake limits
- **THEN** the balance hint replaces the `Range …` hint for as long as it applies, and the range hint returns once the amount is affordable again

### Requirement: The mobile action sheet's Save is blocked while the warning shows; the desktop modal's is not

The two breakpoints SHALL diverge on whether the balance hint blocks committing the drafted amount:

- On the mobile action sheet (`stake-input.tsx`), the balance hint SHALL contribute to `is_save_disabled`, so the header check published via `registerHeaderActions` is disabled for as long as the hint shows. `onSave` SHALL also treat the hint as a no-op guard, so invoking the commit handler directly (bypassing the disabled header control) SHALL NOT commit the amount either.
- On the desktop modal (`stake-input-desktop.tsx`), the balance hint SHALL NOT contribute to the footer **Save** button's `disabled` prop and SHALL NOT make `onSave` a no-op — Save stays enabled and committing an unaffordable stake succeeds, exactly as before this requirement existed.

This is an intentional divergence, not an inconsistency to reconcile: the mobile action sheet's header **Save** is a single, already-gated commit action (`is_save_disabled` already blocks on a dirty-check and on real errors), so folding the balance hint into that existing gate is a small, consistent addition. **Buy**, automation **Run**, and the desktop modal's **Save** keep the codebase's established "inform, don't disable" stance (`purchase-button.tsx:319-325`) unchanged — a user drafting a stake on the desktop modal, or tapping **Buy**, may still set an unaffordable value and deposit afterwards.

#### Scenario: The mobile header Save is disabled while the hint shows, and re-enables once affordable

- **WHEN** the balance is `4.00 USD` and the user taps a `20 USD` preset in the mobile stake sheet
- **THEN** the header action published via `registerHeaderActions` reports `is_save_disabled: true`, and invoking its `onSave` does not commit the amount or close the sheet
- **WHEN** the user then taps an affordable `1 USD` preset
- **THEN** `is_save_disabled` becomes `false` again

#### Scenario: The desktop footer Save still commits an unaffordable stake

- **WHEN** the balance is `4.00 USD`, the user drafts `10` in the desktop stake modal, and the proposal has returned without error
- **THEN** the footer **Save** button is enabled, clicking it commits the value to the trade store, the modal closes, and the user meets the existing insufficient-balance gate at **Buy** unchanged (its message and actions are out of scope for this capability)

### Requirement: Preset chips remain balance-blind

`getStakePresetValues` SHALL keep taking only the contract's `min_stake`/`max_stake` as inputs; the account balance SHALL NOT filter or clamp the preset chips.

The chips describe what the contract accepts, not what the user can currently afford, and a user may deposit — so removing chips would hide valid choices and make the list shift as the balance moves. The warning above is what makes an unaffordable choice visible.

#### Scenario: Chips are unchanged on a low balance

- **WHEN** the balance is `4.00 USD` and the contract's stake limits admit `1 / 5 / 10 / 20 / 50 / 100`
- **THEN** all six chips are still offered, and tapping `10` fills the input and shows the balance hint rather than being unavailable
