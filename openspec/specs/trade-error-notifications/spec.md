# trade-error-notifications Specification

## Purpose

TBD - created by archiving change p2-red-error-banner-persists-covers-buy-button-when-switching-between-gold-and-step200-tiles. Update Purpose after archive.

## Requirements

### Requirement: An error notification belongs to the market tab that raised it

An error notification raised for one market tab SHALL NOT be shown while a different market tab is active. Switching market tabs SHALL clear the outgoing tab's pending error state — the cached proposal error, the trade-parameter validation errors, and any pending service error — before the incoming tab's market and trade type are applied, so no error from the previous tab can be raised (or re-raised) against the new one.

#### Scenario: Switching away from a failing tab does not carry its error over

- **WHEN** the active market tab is showing an error and the user taps a different market tab
- **THEN** no error notification for the previous tab is shown on the newly active tab

#### Scenario: A healthy tab shows no error

- **WHEN** the user switches to a market tab whose own trade parameters are valid for its market and trade type
- **THEN** no error notification is shown for that tab
- **AND** the Buy button shows a price for that tab

#### Scenario: Repeated tab switching does not raise intermittent errors

- **WHEN** the user switches back and forth between two market tabs several times
- **THEN** no error notification appears on a tab whose trade parameters are valid
- **AND** no error notification appears and disappears without a change the user made

#### Scenario: A late response for a superseded tab is ignored

- **WHEN** a price-proposal response arrives for a market or trade type that is no longer the active tab's
- **THEN** that response is discarded
- **AND** it raises no error notification and does not change the displayed price

### Requirement: An error notification never covers the Buy button

An error notification on the Trade page SHALL be positioned clear of the purchase area, so the Buy button (or, when the market is closed, the message that replaces it) stays fully visible and tappable while the notification is on screen. This SHALL hold on mobile web for every error notification the Trade page can raise — trade-parameter errors, proposal/service errors, and purchase errors. The offset SHALL account for both the bottom navigation and the purchase block, and SHALL follow the trade-params sheet when the chart is maximised and the bottom navigation collapses.

#### Scenario: An error notification leaves the Buy button tappable

- **WHEN** an error notification is shown on the Trade page while logged in
- **THEN** the Buy button remains fully visible
- **AND** tapping the Buy button reaches the button, not the notification

#### Scenario: The notification follows the sheet when the chart is maximised

- **WHEN** an error notification is shown while the chart is maximised and the bottom navigation is collapsed
- **THEN** the notification still sits clear of the purchase block at its new position

#### Scenario: Logged-out layout also keeps its primary action clear

- **WHEN** an error notification is shown to a logged-out user on the Trade page
- **THEN** the notification sits clear of the logged-out purchase block

### Requirement: Error notifications continue to auto-dismiss and stay non-duplicating

Preserving the behaviour established for immortal error toasts, every error notification SHALL auto-dismiss after its configured duration and SHALL remain individually dismissible. Repositioning or clearing notifications SHALL NOT reintroduce a notification that persists indefinitely, and SHALL NOT cause the same error to be shown twice at once.

#### Scenario: An error notification dismisses itself

- **WHEN** an error notification is shown and the user does not interact with it
- **THEN** it disappears on its own after its configured duration

#### Scenario: A single error is announced once

- **WHEN** a single error condition is raised
- **THEN** exactly one error notification is shown for it
