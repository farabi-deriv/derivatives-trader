## Purpose

Lets a mobile trader pick a value on a wheel picker inside a swipe-to-close action sheet by tapping the row, not only by dragging the wheel, without the wheel's gestures moving or closing the sheet.

## ADDED Requirements

### Requirement: [WPT-001] Tapping a wheel row centres it and makes it the draft selection

On mobile, a single tap on any rendered row of a wheel picker inside a swipe-to-close action sheet (Duration ticks and time wheels, the End-time time picker, Multiplier, Growth rate, Strike, Payout per point, Deal cancellation) SHALL scroll that row to the wheel's centre and SHALL make that row's value the sheet's draft selection. A tap on a row SHALL NOT be suppressed because the row is not currently centred. The greyed styling of non-centred rows is presentation only and SHALL NOT make a row unselectable. A tap SHALL only change the draft: the parameter MUST still be committed solely through the sheet's header Save action, and dismissing the sheet MUST still discard the draft.

#### Scenario: Tapping "1 tick" selects it on the Duration ticks wheel

- **WHEN** a mobile trader on Over/Under for Volatility 100 (1s) Index, whose `contracts_for` tick range is 1–10 and whose committed duration is 2 ticks, opens Duration and taps the "1 tick" row once
- **THEN** the "1 tick" row scrolls to the centre of the ticks wheel and is shown as the selected row
- **AND** the header Save action becomes enabled

#### Scenario: Saving after the tap commits the tapped value

- **WHEN** the trader has tapped "1 tick" on the ticks wheel and then taps the header Save action
- **THEN** the trade's duration is committed as 1 tick and the Duration field reads "1 tick"

#### Scenario: A tap alone commits nothing

- **WHEN** the trader taps a different row on the ticks wheel and then dismisses the sheet without tapping Save
- **THEN** the committed duration is unchanged

#### Scenario: Tapping a row of a multi-column time wheel selects it in that column

- **WHEN** the trader on the Duration Time tab taps a visible, non-centred row in the minutes column
- **THEN** that minutes row scrolls to the centre of the minutes column and becomes the minutes draft value, with finer columns following their existing floor rules

### Requirement: [WPT-002] Wheel gestures never move or close the sheet and are not mistaken for taps

A press that starts on a wheel picker inside a swipe-to-close action sheet SHALL NOT be delivered to the sheet's drag-to-close gesture. As a result, scrolling the wheel never drags or dismisses the sheet. A press SHALL count as a tap on a row only if it is released on the same row it started on and is not cancelled in between, for example by the browser taking over the touch to scroll the wheel. Any other press (cancelled, released on a different row, or not on a row at all) SHALL NOT re-centre any row.

#### Scenario: Dragging the wheel does not close the sheet

- **WHEN** the trader drags vertically on the Duration ticks wheel
- **THEN** the wheel scrolls and the Duration sheet stays open

#### Scenario: A cancelled press does not re-centre the pressed row

- **WHEN** a press starts on a wheel row and is cancelled before release because the touch became a scroll
- **THEN** no row is re-centred as a result of that press

#### Scenario: A press released on a different row is not a tap

- **WHEN** a press starts on one wheel row and is released on another row
- **THEN** neither row is re-centred as a result of that press

#### Scenario: A press outside any wheel row is ignored

- **WHEN** a press starts and ends inside the wheel area but not on a wheel row
- **THEN** no row is re-centred
