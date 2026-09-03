# allow-equals-toggle Specification

## Purpose

TBD - created by archiving change the-toggle-switch-component-on-desktop-is-cut-off-at-the-bottom. Update Purpose after archive.

## Requirements

### Requirement: Desktop Allow equals toggle is fully visible

On desktop Manual trading, when the non-minimized Allow equals row is shown under Stake for Rise/Fall (or Rise/Fall Equal), the toggle switch SHALL be fully visible. No part of the switch track or knob SHALL be clipped at the bottom of the row or by the surrounding trade-parameters panel.

#### Scenario: Toggle is not cut off on Manual trading

- **WHEN** a desktop user is on the Manual trading tab with Rise/Fall selected and the Allow equals row is visible under Stake
- **THEN** the full height of the Allow equals toggle switch is visible
- **AND** the bottom of the switch track and knob are not cut off by the row or the trade-parameters panel

#### Scenario: Toggle remains fully visible on Automated trading

- **WHEN** a desktop user switches to the Automated trading tab with Rise/Fall selected and the Allow equals row is visible
- **THEN** the Allow equals toggle switch remains fully visible (no regression of the already-correct Automated trading appearance)

### Requirement: Allow equals row height fits the toggle switch

The non-minimized Allow equals row SHALL be tall enough to contain the full height of the toggle switch control it hosts. The row MUST NOT impose a fixed height smaller than the switch control.

#### Scenario: Row is at least as tall as the switch

- **WHEN** the non-minimized Allow equals row is rendered with its toggle switch
- **THEN** the row's content box height is greater than or equal to the toggle switch control's height
- **AND** the switch is not overflow-clipped by the row

### Requirement: Allow equals behaviour is unchanged

Fixing the desktop clip SHALL NOT change Allow equals behaviour: label text, tooltip (desktop) / definition sheet (mobile), toggle on/off, disabled state when the market is closed or automation params are locked, and the mobile minimized field remain as they are today.

#### Scenario: Toggling still updates is_equal

- **WHEN** a user clicks the Allow equals toggle while it is enabled
- **THEN** the trade parameter `is_equal` is updated (off → on or on → off) exactly as before this change

#### Scenario: Disabled when market is closed

- **WHEN** the market is closed
- **THEN** the Allow equals toggle remains disabled and is not interactive

#### Scenario: Minimized mobile field unchanged

- **WHEN** Allow equals is rendered in minimized mode
- **THEN** it still shows the read-only field with "Yes" / "-" values and does not use the desktop toggle row layout

### Requirement: Toggling Allow equals preserves the current stake

Toggling the **Allow equals** control SHALL NOT change the current stake. Because Allow equals flips the contract between Rise/Fall and Rise/Fall Equal — a sub-type toggle within the same trade type, not a trade-type switch — the stake the user has entered MUST be carried over unchanged when the toggle is turned on and when it is turned off. This applies on both the desktop toggle switch and the mobile minimized Allow equals field.

A stake reset to the account default SHALL remain reserved for genuine changes: switching to a different trade type (a different trade-type group) or switching the underlying symbol. Those continue to reset the stake exactly as before this change.

#### Scenario: Turning Allow equals on keeps the entered stake

- **WHEN** a user has entered a custom stake on Rise/Fall and turns the Allow equals toggle on
- **THEN** the contract switches to Rise/Fall Equal
- **AND** the stake remains the user's entered value (it is not reset to the account default)

#### Scenario: Turning Allow equals off keeps the entered stake

- **WHEN** Allow equals is on (Rise/Fall Equal) with a user-entered stake and the user turns the toggle off
- **THEN** the contract switches back to Rise/Fall
- **AND** the stake remains the user's entered value (it is not reset to the account default)

#### Scenario: The default stake is untouched when Allow equals is toggled

- **WHEN** the stake still equals the account default and the user toggles Allow equals on or off
- **THEN** the stake stays at that default value (the toggle neither clears nor re-writes it)

#### Scenario: A genuine trade-type switch still resets the stake

- **WHEN** the user switches to a different trade type (a different trade-type group) after customising the stake
- **THEN** the stake is reset to the account default, unchanged from the behaviour before this fix

### Requirement: Toggling Allow equals preserves the other Rise/Fall trade parameters

Toggling Allow equals SHALL preserve the remaining trade parameters of the Rise/Fall contract — in particular the selected duration and expiry — because the flip stays within the same trade-type and duration group. The toggle MUST only change whether equals is applied (`is_equal`) and the corresponding Rise/Fall sub-type; it MUST NOT re-apply per-trade-type defaults.

#### Scenario: Duration survives an Allow equals toggle

- **WHEN** a user has selected a non-default duration on Rise/Fall and toggles Allow equals on or off
- **THEN** the selected duration is retained (no default duration is re-applied)

#### Scenario: The toggle still updates is_equal and the sub-type

- **WHEN** the user toggles Allow equals
- **THEN** the `is_equal` trade parameter updates (off → on or on → off)
- **AND** the contract sub-type flips between Rise/Fall and Rise/Fall Equal accordingly, exactly as before this change
