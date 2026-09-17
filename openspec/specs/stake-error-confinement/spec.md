# stake-error-confinement Specification

## Purpose

TBD - created by archiving change confine-stake-validation-error-input. Update Purpose after archive.

## Requirements

### Requirement: [SEC-001] A stake-field error does not mark the collapsed stake trade parameter in error

The collapsed stake trade-parameter control on the trade page — the chip/field that opens the stake editor (`packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-mobile.tsx` and `stake-desktop.tsx`) — SHALL NOT be rendered in its error (red) state as a consequence of any stake-field error. This covers all three sources: a front-end amount validation error, a proposal error tagged to the `stake`/`amount` field, and a drafted or committed stake that exceeds the available balance.

This SHALL hold on both breakpoints. The collapsed control's other states (locked, disabled while the market is closed or an accumulator is open) are unaffected.

#### Scenario: An unaffordable committed stake leaves the desktop trade parameter neutral

- **WHEN** the available balance is `0.77 USD` and the committed stake is `4.00 USD`
- **THEN** the collapsed stake popover trigger is shown in its neutral state, not its error state

#### Scenario: A stake-field proposal error leaves the mobile trade parameter neutral

- **WHEN** the displayed contract's proposal returns an error tagged to the `stake`/`amount` field
- **THEN** the collapsed stake field on the mobile trade parameters row is shown in its neutral state, not its error state

### Requirement: [SEC-002] Buy stays enabled despite a client-provable stake shortfall; the server is the authority

The **Buy** control SHALL NOT be disabled solely because the client can prove the quoted charge for the displayed contract exceeds the available balance. In that state **Buy** SHALL remain pressable, and pressing it SHALL surface the server-reported insufficient-balance error via the existing insufficient-balance sheet (with its existing title, message, and **Deposit now** / **OK** actions).

While **Buy** is enabled in this state it SHALL quote its payout, total cost, or max payout normally — the client-side withholding of that amount is removed.

This requirement narrows only the affordability case. **Buy** SHALL still be disabled for the reasons unrelated to a client-provable stake shortfall: trade not enabled, an account switch in flight, a proposal error that is not a server-reported insufficient balance, or no resolved price and no error.

#### Scenario: An unaffordable stake keeps Buy pressable and quotes its payout

- **WHEN** the available balance is `0.77 USD`, the displayed contract's charge is `4.00 USD`, and the price has resolved a payout of `7.69 USD`
- **THEN** **Buy** is enabled, the payout `7.69 USD` is shown on the control, and pressing **Buy** opens the insufficient-balance sheet rather than being blocked before any request

#### Scenario: A non-affordability proposal error still disables Buy

- **WHEN** the displayed contract's proposal returns an error that is not a server-reported insufficient balance (for example a barrier or duration error)
- **THEN** **Buy** stays disabled, unchanged by this capability

### Requirement: [SEC-003] The stake editor's own error display and Save gating are unchanged

Confining the error to the editor SHALL NOT change the stake editor's existing behaviour. Inside the mobile action sheet and the desktop popover the input SHALL still show the stake-field error in its message slot with the input in its error state, and the editor's Save gating SHALL remain as already specified: the mobile action sheet's header Save stays disabled while a balance hint or a validation error shows, and the desktop modal's footer Save stays disabled while a front-end format error or an applicable proposal stake error shows.

#### Scenario: The mobile Save stays disabled while the inline error shows

- **WHEN** the balance is `4.00 USD` and the user taps a `20 USD` preset in the mobile stake sheet
- **THEN** the inline hint is shown in the input and the header Save action reports disabled, exactly as before this change

#### Scenario: The desktop input still shows the inline stake error

- **WHEN** the user drafts a stake in the desktop popover that the proposal rejects with a stake-field error
- **THEN** the input shows that error message in its error state, exactly as before this change
