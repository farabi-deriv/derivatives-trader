## Purpose

Defines how the Take Profit and Stop Loss **amount** input field behaves and presents on web (the trade form and the contract-details editors): the control style users interact with, the currency and range affordances shown, and the input/validation behaviour that a value entry relies on.

## ADDED Requirements

### Requirement: TP/SL amount field has no increment/decrement steppers

The Take Profit and Stop Loss amount input field SHALL be a single filled text field with no positive/negative (+/-) increment or decrement stepper buttons. This applies to both fields and on both web layouts (desktop and responsive/mobile), so the control is identical to the mobile app and the Figma design.

#### Scenario: Take profit amount field renders without +/- buttons

- **WHEN** the user opens the Take profit input (the standalone Take profit action sheet, or the Take profit field within the Risk management action sheet)
- **THEN** the amount field is a filled text input
- **AND** no increment (+) or decrement (-) stepper button is rendered next to it

#### Scenario: Stop loss amount field renders without +/- buttons

- **WHEN** the user opens the Stop loss input within the Risk management action sheet
- **THEN** the amount field is a filled text input
- **AND** no increment (+) or decrement (-) stepper button is rendered next to it

#### Scenario: Contract-details TP/SL editor renders without +/- buttons

- **WHEN** the user edits Take profit or Stop loss on an open position from the contract-details page
- **THEN** the amount field is a filled text input
- **AND** no increment (+) or decrement (-) stepper button is rendered next to it

### Requirement: Currency and range remain visible on the field

The TP/SL amount field SHALL make the account currency and the allowed value range discoverable without the removed stepper unit affordance. The currency SHALL be shown in the field label, and while the field is enabled and a valid range is known, the allowed range SHALL be shown as helper text below the field.

#### Scenario: Currency is shown in the field label

- **WHEN** the TP/SL amount field is displayed for an account with currency USD
- **THEN** the field label conveys the amount and its currency symbol (for example, "Amount ($)")

#### Scenario: Allowed range is shown as helper text

- **WHEN** the field is enabled and the minimum and maximum allowed values are known
- **THEN** helper text below the field states the allowed range with the currency symbol (for example, "Range: $1 to $5,000")

### Requirement: Amount entry, validation, and save behaviour is preserved

Removing the steppers SHALL NOT change how a value is entered, validated, or committed. The enable/disable toggle, decimal and thousands handling, proposal-driven validation, and the save/dirty gate SHALL behave exactly as before the control change.

#### Scenario: Enabling, typing a valid amount, and saving commits the value

- **WHEN** the user enables the field with the toggle, types a valid amount, and confirms via the sheet's Save action
- **THEN** the entered Take profit / Stop loss amount is committed to the trade (or the open contract's limit order)
- **AND** the action sheet closes

#### Scenario: Save is blocked for an enabled empty field

- **WHEN** the field is enabled but no amount has been entered
- **THEN** the Save action does not commit a value
- **AND** an error prompts the user to enter an amount

#### Scenario: An out-of-range or backend-rejected amount surfaces an error

- **WHEN** the entered amount is outside the allowed range or is rejected by validation
- **THEN** the field shows the corresponding error message in place of (or alongside) the range helper text
- **AND** the invalid amount is not committed

### Requirement: Accumulator adjustment note is preserved

When the field applies to an accumulator contract, the note that the value cannot be adjusted for ongoing accumulator contracts SHALL still be shown.

#### Scenario: Accumulator note is shown

- **WHEN** the TP/SL field is displayed for an accumulator trade type or contract
- **THEN** the note "Cannot be adjusted for ongoing accumulator contracts." (or the equivalent contract-details wording) is displayed
