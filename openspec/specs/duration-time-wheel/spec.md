# duration-time-wheel Specification

## Purpose

TBD - created by archiving change duration-wheel-allows-scrolling-below. Update Purpose after archive.

## Requirements

### Requirement: [DTW-001] Time wheel columns never render below the currently reachable minimum

The mobile Duration action sheet's merged time wheel (`DurationTimeWheel`) SHALL NOT render, on any visible column (hours, minutes, or seconds), a value that is unreachable given the contract's intraday minimum duration and the other visible columns' _currently selected_ values. A column's rendered floor SHALL be computed from: the seconds already contributed by columns coarser than it (at their current selection) subtracted from the intraday minimum, divided by the column's unit size, with any remainder still covered by finer columns' maximum capacity. The rendered ceiling SHALL remain bounded by the column's natural capacity and the intraday maximum, unchanged from prior behavior.

#### Scenario: Seconds wheel starts at the intraday minimum when combined with hours and minutes

- **WHEN** the Duration action sheet's Time tab opens for a contract whose intraday minimum duration is 15 seconds, whose duration picker offers hours, minutes, and seconds, and whose hours and minutes columns are both currently selected as 0
- **THEN** the seconds column renders only values from 15 through 59
- **AND** no value below 15 is rendered or reachable by scrolling

#### Scenario: Seconds wheel renders from 0 once a coarser column covers the minimum

- **WHEN** the minutes column is scrolled to a value of 1 or more (so 60+ seconds are already covered by minutes alone) while the intraday minimum is 15 seconds
- **THEN** the seconds column renders values from 0 through 59

#### Scenario: A seconds-only contract is unaffected

- **WHEN** a contract's duration picker offers seconds as the only visible time unit and its intraday minimum is 15 seconds
- **THEN** the seconds column renders only values from 15 through 59, matching its existing (unchanged) behavior

#### Scenario: Hours column bounds are unaffected by this change

- **WHEN** the Duration action sheet's Time tab opens for any contract offering hours as a visible unit
- **THEN** the hours column's rendered range is identical to its range before this change, since hours has no coarser column to derive a tighter floor from

### Requirement: [DTW-002] Rendered options stay in step with the current selection without disrupting the active column's own scroll position

Each visible column's rendered option list SHALL be recomputed whenever any column's current selection changes, so that a coarser-column edit is reflected in a finer column's rendered floor without waiting for the post-scroll snap-back. A column's own rendered option list SHALL remain unaffected by changes to its own currently selected value, so that scrolling a column never changes that same column's own rendered items mid-scroll.

#### Scenario: Scrolling the seconds column does not change the seconds column's own rendered list

- **WHEN** the user scrolls the seconds column through its rendered values
- **THEN** the set of values rendered on the seconds column does not change as a result of that scroll

#### Scenario: Changing hours updates the rendered floor of minutes and seconds

- **WHEN** the hours column's selection changes such that hours and minutes together no longer cover the intraday minimum on their own
- **THEN** the seconds column's rendered floor updates to reflect the new shortfall, without requiring the 300ms post-scroll clamp to correct an out-of-range display

### Requirement: [DTW-003] Post-scroll clamp remains the correction path for cross-column recombination

`clampTimeWheelSelection` SHALL continue to correct a full hour/minute/second combination that ends up outside `[intraday.min, intraday.max]` after scrolling settles (for example, a combination carried over from a previous contract selection). This requirement is unchanged by DTW-001 and DTW-002 and exists so the snap-back remains a safety net rather than the primary mechanism for keeping the wheel in range.

#### Scenario: A stored out-of-range combination still snaps back after settling

- **WHEN** a previously stored hour/minute/second selection is below the current contract's intraday minimum when the Time tab opens
- **THEN** 300ms after the wheel stops moving, the selection snaps to the closest valid combination, exactly as before this change
