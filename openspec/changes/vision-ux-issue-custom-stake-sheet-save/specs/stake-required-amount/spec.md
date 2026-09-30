## Purpose

Defines how the stake editor treats an empty stake amount: as an inline validation state reported while the field is empty, on the same footing as a below-minimum stake, rather than a message withheld until the user presses Save.

## ADDED Requirements

### Requirement: [SRA-001] An empty stake shows the required-field message inline, before any Save press

While the amount field in the stake editor is empty, the editor SHALL show `Amount is a required field.` in the input's message slot with the input in its error state, without the user having to press Save or any other control first.

This SHALL hold on both breakpoints — the mobile stake action sheet (`packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx`) and the desktop stake popover's Custom/input tab (`stake-input-desktop.tsx`).

The message occupies the same slot the below-minimum and format errors already use, so while it shows, the `Range: {min} to {max}` helper text is not shown.

#### Scenario: Clearing the desktop field reports the requirement immediately

- **WHEN** the desktop stake popover's input holds `10` and the user clears it
- **THEN** `Amount is a required field.` is shown in the input's message slot, the input is in its error state, and no Save press was needed to produce it

#### Scenario: Typing letters reports the requirement

- **WHEN** the user types `abc` into the stake input, which the input's character filter strips to an empty value
- **THEN** `Amount is a required field.` is shown, exactly as for a field cleared by deletion

#### Scenario: Clearing the mobile field reports the requirement immediately

- **WHEN** the mobile stake action sheet's input holds `10` and the user clears it
- **THEN** `Amount is a required field.` is shown in the input's message slot with the input in its error state

#### Scenario: The range helper yields to the requirement

- **WHEN** the stake input is empty and the contract's stake limits are known
- **THEN** the `Range:` helper text is not shown; the required-field message is shown in its place

### Requirement: [SRA-002] An empty stake blocks Save on both breakpoints, by click and by Enter

While the amount field is empty, the stake editor's Save action SHALL be disabled and SHALL NOT commit a value — by pointer activation and by pressing Enter in the input alike.

On desktop this is the popover's footer Save button; on mobile it is the action sheet's header Save, which the input publishes through `registerHeaderActions`. Committing means writing the drafted amount to the trade store and closing the editor; neither SHALL happen while the field is empty.

The editor's other disable conditions — an in-flight proposal, a front-end format error, an applicable proposal stake error, and the balance hint — are unchanged and continue to apply.

#### Scenario: Desktop Save is disabled while the field is empty

- **WHEN** the user clears the desktop stake input
- **THEN** the footer **Save** button reports disabled

#### Scenario: Desktop Enter does not commit an empty amount

- **WHEN** the user clears the desktop stake input and presses Enter in it
- **THEN** no amount is written to the trade store and the popover stays open

#### Scenario: Mobile Save stays disabled while the field is empty

- **WHEN** the user clears the mobile stake input
- **THEN** the Save action published to the sheet header reports disabled, as it already did

#### Scenario: A below-minimum stake is still blocked the same way

- **WHEN** the user drafts a stake the proposal rejects as below the market minimum
- **THEN** the minimum message is shown and Save reports disabled, unchanged by this capability

### Requirement: [SRA-003] Emptiness is read from the live input value, not from validation timing

The empty-amount state SHALL be derived from the value currently in the input, and SHALL NOT depend on a proposal response, a pending request, or a debounce interval. A non-empty value that has not yet been validated SHALL NOT be reported as a missing amount.

The mobile editor debounces the value it sends for pricing, so its live value is the displayed draft, not the last value sent for validation; the desktop editor updates its value on each keystroke. Each editor SHALL read whichever of its own values is the live one.

Because the proposal is deliberately withheld while the amount is empty and any existing stake error is cleared in that state, the requirement SHALL NOT be expressed as, or depend on, an API error.

#### Scenario: A freshly typed value is not reported as missing

- **WHEN** the user types `5` into an emptied mobile stake input and the debounced pricing request has not yet been sent
- **THEN** the required-field message is gone as soon as `5` is in the field, and it does not reappear while that value is being validated

#### Scenario: Re-entering a value clears the requirement and restores the helper

- **WHEN** the user clears the desktop stake input and then types `4`
- **THEN** the required-field message is gone, the input is no longer in its error state for that reason, and the `Range:` helper text is shown again

#### Scenario: A zero stake is not treated as a missing amount

- **WHEN** the user enters `0` in the stake input
- **THEN** the amount is treated as present and priced, so the proposal's own minimum-stake error reports it — not the required-field message
