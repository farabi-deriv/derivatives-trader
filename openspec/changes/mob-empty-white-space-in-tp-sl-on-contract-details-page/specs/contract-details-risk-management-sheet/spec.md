## Purpose

Defines the layout contract for the mobile Contract Details risk-management rows (Take profit, Stop loss, Deal cancellation) and the amount-editor action sheet they open: the sheet is sized by its own content, its rows sit adjacent with no reserved dead space, and the existing commit, validation and read-only behaviours are preserved.

## ADDED Requirements

### Requirement: The Take profit and Stop loss editor sheet contains no empty dead space

When a user opens the Take profit or Stop loss amount editor from the mobile Contract Details page, the sheet SHALL show no empty region that is not occupied by its own content. The vertical extent of the sheet SHALL be determined by the height of the content it actually renders — the sheet title row, the amount input (with its validation message when present) and the Total profit/loss row when shown — plus the sheet's standard padding. The sheet MUST NOT reserve vertical space for a footer commit button, because the commit action lives in the sheet header and no footer button is rendered.

#### Scenario: Take profit sheet has no white band

- **WHEN** a mobile user opens a contract with Take profit set, goes to Contract Details, and opens the Take profit amount editor
- **THEN** the sheet renders the amount input and (when a profit/loss figure is available) the Total profit/loss row
- **AND** there is no empty white band between, above or below those rows beyond the sheet's normal padding and inter-row spacing

#### Scenario: Stop loss sheet has no white band

- **WHEN** a mobile user opens a contract with Stop loss set, goes to Contract Details, and opens the Stop loss amount editor
- **THEN** the sheet renders the amount input and (when a profit/loss figure is available) the Total profit/loss row
- **AND** there is no empty white band between, above or below those rows beyond the sheet's normal padding and inter-row spacing

#### Scenario: Sheet is not padded out to a fixed height

- **WHEN** the Take profit or Stop loss editor sheet is rendered
- **THEN** its content region does not declare a fixed height independent of its content
- **AND** the rendered sheet height changes when its content changes (for example when the Total profit/loss row is absent, or when a validation message appears)

### Requirement: The amount input and Total profit/loss row are adjacent

Within the Take profit / Stop loss editor sheet, the Total profit/loss row SHALL be laid out immediately after the amount input, separated only by the standard inter-row spacing. Content SHALL NOT be distributed to opposite ends of the sheet.

#### Scenario: Total profit/loss follows the amount input

- **WHEN** the editor sheet is open for a contract with a total profit/loss figure
- **THEN** the Total profit/loss row appears directly beneath the amount input with a single standard gap between them
- **AND** it is not pushed to the bottom edge of the sheet away from the input

#### Scenario: Input alone when there is no profit/loss figure

- **WHEN** the editor sheet is open for a contract with no total profit/loss figure available, so no Total profit/loss row is rendered
- **THEN** the sheet contains only the title row and the amount input, and its height shrinks accordingly
- **AND** no empty space is left where the Total profit/loss row would have been

### Requirement: A zero total profit/loss keeps the row visible

A total profit/loss of exactly zero is a figure in its own right, so the Total profit/loss row SHALL remain rendered showing that zero amount. The row SHALL be omitted only when no figure is available at all. Because the figure updates live and passes through zero on its way between profit and loss, hiding it at zero would remove and restore the row on a single tick, which appears as a flicker on mobile.

#### Scenario: Row stays put as the live figure passes through zero

- **WHEN** the editor sheet is open and the contract's total profit/loss changes from a profit, through exactly zero, to a loss
- **THEN** the Total profit/loss row stays visible throughout, showing zero on that tick
- **AND** it does not disappear and reappear as the figure crosses zero

#### Scenario: No figure available

- **WHEN** the editor sheet is open for a contract whose total profit/loss cannot yet be computed
- **THEN** no Total profit/loss row is rendered, and no partial or placeholder amount is shown in its place

### Requirement: The sheet's last row keeps bottom spacing from the sheet edge

Because no footer commit button sits below the content any more, the sheet SHALL apply its own bottom padding so the last rendered row does not sit flush against the bottom edge of the sheet. Inline (left/right) padding SHALL remain consistent with other AppV2 action sheets.

#### Scenario: Last row is not flush with the sheet edge

- **WHEN** the editor sheet is open and the last rendered row is either the Total profit/loss row or the amount input
- **THEN** there is visible padding between that row and the bottom edge of the sheet
- **AND** the row's left and right inset matches the other AppV2 action sheets

### Requirement: Removing the dead space does not change Take profit / Stop loss behaviour

Correcting the sheet layout SHALL NOT alter any Take profit or Stop loss behaviour on Contract Details: enabling and disabling each limit order via its toggle, opening the editor by tapping the read-only amount field, the header save action being disabled until the drafted amount differs from the committed amount, validation messages for empty / below-minimum / above-maximum amounts, committing the amount on save, discarding the draft on dismissal, and the info modal for each row.

#### Scenario: Toggling Take profit off still commits the removal

- **WHEN** a user turns the Take profit toggle off on Contract Details
- **THEN** the limit-order update is submitted exactly as before this change, and the read-only amount field is no longer shown

#### Scenario: Header save stays gated on a changed amount

- **WHEN** a user opens the Take profit or Stop loss editor and has not changed the amount
- **THEN** the header save action is disabled
- **AND** it becomes enabled once the drafted amount differs from the committed amount

#### Scenario: Validation messages still appear in the sheet

- **WHEN** a user clears the amount, or enters an amount below the minimum or above the maximum, and attempts to save
- **THEN** the corresponding validation message is shown under the amount input and the amount is not committed
- **AND** the sheet grows to accommodate the message rather than clipping it

#### Scenario: Dismissing the sheet discards the draft

- **WHEN** a user changes the amount and dismisses the sheet via its close action, an overlay tap or a drag
- **THEN** the committed amount is unchanged

### Requirement: Read-only risk-management rows are unaffected

Rows that never open an amount editor SHALL keep their current appearance and behaviour: the accumulator Take profit row, which shows a formatted read-only amount instead of a toggle, and the Deal cancellation row, which shows the remaining-time badge.

#### Scenario: Accumulator Take profit stays read-only

- **WHEN** a mobile user views Contract Details for an open accumulator contract with Take profit
- **THEN** the Take profit row shows the formatted amount as read-only text with no toggle and no editor sheet
- **AND** its layout is unchanged by this fix

#### Scenario: Deal cancellation row keeps its remaining-time badge

- **WHEN** a mobile user views Contract Details for a multiplier contract that is still valid to cancel
- **THEN** the Deal cancellation row shows its remaining-time badge
- **AND** its layout is unchanged by this fix

### Requirement: Contract Details risk-management card layout is unchanged

The page-level Contract Details layout SHALL be unchanged: the Take profit and Stop loss rows continue to share one card below the chart (and the Deal cancellation row its own card), with the existing card spacing, and each row keeps its label, info affordance and control on a single line.

#### Scenario: TP and SL still share one card

- **WHEN** a mobile user views Contract Details for an open contract where both Take profit and Stop loss are available
- **THEN** both rows are rendered inside the same card with the existing spacing between them
- **AND** no extra vertical space is introduced on the page by this fix
