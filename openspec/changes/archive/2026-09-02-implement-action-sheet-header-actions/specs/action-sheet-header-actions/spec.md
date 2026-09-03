## Purpose

Defines the commit and dismiss behavior contract for AppV2 value-editor action sheets: a title-row save/close action pair, a save button that is gated on a changed value, discard-on-dismiss semantics, and which sheet categories keep their footer buttons instead.

## ADDED Requirements

### Requirement: Value-editor sheets commit through a header save action

A value-editor action sheet (a mobile AppV2 sheet whose sole footer button today is a Save/Done/Apply commit button — Duration, Stake, Barrier, Strike, Multiplier, Growth rate, Payout-per-point, Last-digit prediction, Risk-management, the reusable date picker, and the four Automation-panel mobile sheets) SHALL present its commit action as a trailing `saveAction` (check) on `ActionSheet.Header` and a leading `closeAction` (X), and SHALL NOT render a separate footer commit button for that value. The save action's accessible name SHALL be a localized string.

#### Scenario: Header exposes save and close actions

- **WHEN** a value-editor sheet is opened on a mobile screen
- **THEN** the sheet header renders a trailing save (check) action and a leading close (X) action
- **AND** no footer Save/Done/Apply button is rendered for that value

#### Scenario: Save action has a localized accessible name

- **WHEN** the header save action is rendered
- **THEN** its accessible name resolves to the localized "Save" string (not the library's English default)

### Requirement: The header save action is disabled until the value changes

The header `saveAction` SHALL be disabled while the sheet's draft value equals the committed store value, and SHALL become enabled only once the draft differs from the committed value. A sheet that already disables its commit button on a validation error or incomplete input (e.g. stake/barrier validation, an empty date range) SHALL keep that condition, combined with the changed-value gate so the save is disabled when either the value is unchanged OR the input is invalid.

#### Scenario: Save disabled on open

- **WHEN** a value-editor sheet is opened and the user has not changed the value
- **THEN** the header save action is disabled

#### Scenario: Save enabled after a change

- **WHEN** the user changes the value so the draft differs from the committed value and the input is valid
- **THEN** the header save action becomes enabled

#### Scenario: Existing validation still blocks save

- **WHEN** a sheet that has its own validation (e.g. Stake) is in an invalid state
- **THEN** the header save action stays disabled even if the draft differs from the committed value

### Requirement: Dismissing a value-editor sheet discards the draft

Closing a migrated value-editor sheet by the header close action (X), an overlay tap, or a drag-to-dismiss SHALL NOT commit the draft to the store; the committed value SHALL remain unchanged. Committing SHALL occur only when the user taps the enabled header save action, which commits the draft and closes the sheet.

#### Scenario: X dismiss does not commit

- **WHEN** the user changes the value and then closes the sheet via the X, overlay, or drag
- **THEN** the committed store value is unchanged and the sheet closes

#### Scenario: Save commits and closes

- **WHEN** the user changes the value and taps the enabled header save action
- **THEN** the draft is committed to the store and the sheet closes

#### Scenario: Reopening after dismiss shows the committed value

- **WHEN** the user changes the value, dismisses without saving, and reopens the sheet
- **THEN** the sheet's draft is re-initialized from the committed store value (the earlier unsaved change is gone)

### Requirement: Tapping a Duration wheel item selects without committing

In the Duration sheet's ticks and time wheels, tapping a wheel item SHALL only update the in-sheet selection (draft), which may enable the header save action; it SHALL NOT commit the value or close the sheet. The commit path SHALL be the header save action alone.

#### Scenario: Tap updates draft only

- **WHEN** the user taps an item in the Duration ticks or time wheel
- **THEN** the wheel scrolls that item into place and the draft updates, the sheet stays open, and nothing is committed to the store

#### Scenario: Tap can enable save

- **WHEN** a tap changes the selection so the draft differs from the committed duration
- **THEN** the header save action becomes enabled

### Requirement: The Duration sheet commits the active tab through one header save

The Duration sheet's single header save action SHALL commit the currently active tab: for the Ticks and Time tabs it SHALL apply the wheel selection as a `duration`-type change (clamped into the contract's range, only when the resulting duration is greater than zero), and for the End-time tab it SHALL apply the selected end date/time as an `endtime`-type change. The End-time tab SHALL NOT carry its own separate footer save button. Save SHALL be disabled per active tab when that tab's selection equals its committed value.

#### Scenario: Save on the Ticks/Time tab commits a duration change

- **WHEN** the Ticks or Time tab is active with a changed, in-range, positive selection and the user taps save
- **THEN** the store receives a `duration`-type change reflecting the wheel selection and the sheet closes

#### Scenario: Save on the End-time tab commits an end time

- **WHEN** the End-time tab is active with a changed end date/time and the user taps save
- **THEN** the store receives an `endtime`-type change with the selected expiry date and time and the sheet closes

#### Scenario: Switching from a duration contract to the End-time tab is dirty

- **WHEN** the contract's committed `expiry_type` is `duration` and the user switches to the End-time tab
- **THEN** the header save action is enabled (committing changes `expiry_type`)

### Requirement: The nested end date/time picker uses header save with restore on dismiss

The nested "Pick an end date" / "Pick an end time" sub-sheet SHALL present header save/close actions instead of its "Done" footer button. It SHALL snapshot the committed end date and time when it opens. Tapping save SHALL keep the browsed date/time (as "Done" does today) and close; the save SHALL be disabled until the browsed value differs from the snapshot and while the live proposal validation for that date is in error. Dismissing via X, overlay, or drag SHALL restore the snapshot rather than keep the browsed value.

#### Scenario: Save keeps the browsed end date/time

- **WHEN** the user browses to a new end date/time in the nested picker and taps save
- **THEN** the selected expiry date/time is applied and the nested picker closes

#### Scenario: Dismiss restores the snapshot

- **WHEN** the user browses to a new end date/time and then dismisses the nested picker via X, overlay, or drag
- **THEN** the end date/time is restored to the snapshot taken when the picker opened

#### Scenario: Save disabled while the browsed date fails proposal validation

- **WHEN** the browsed end date produces a proposal validation error
- **THEN** the header save action is disabled

### Requirement: Non-commit sheets retain their footer buttons

Action sheets that are not single-commit value editors SHALL keep their existing footer buttons and SHALL NOT migrate to header actions: informational "Got it"/acknowledge sheets, two-button filter/reset sheets (whose secondary Reset/Clear-All needs a visible text button), and error/status sheets that use a coral primary button. These have no equivalent header-action rendering (icon-only check reads as "save"; no secondary-text or color slot exists on the header).

#### Scenario: Informational sheet keeps its acknowledge button

- **WHEN** an informational guide/description sheet (e.g. a "Got it" acknowledge sheet) is displayed
- **THEN** it still renders its footer acknowledge button and no header save/close actions are added

#### Scenario: Filter sheet keeps Apply and Reset in the footer

- **WHEN** a two-button filter/reset sheet is displayed
- **THEN** both its primary Apply and its secondary Reset/Clear-All remain footer buttons

#### Scenario: Coral error sheet keeps its footer button

- **WHEN** an error/status sheet with a coral primary button is displayed
- **THEN** it retains its coral footer button and does not migrate to a header save action
