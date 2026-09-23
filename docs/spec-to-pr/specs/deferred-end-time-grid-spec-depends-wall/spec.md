## ADDED Requirements

### Requirement: [EGRID-001] The intraday same-day DCE-004 grid case is deterministic regardless of wall-clock time

`packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/duration-end-time-desktop.spec.tsx`'s `[DCE-004] characterizes the intraday same-day path` test clicks `Hour 14` / `Minute 30` in `TimeGridPicker` and asserts `expiry_time: '14:30:00'`. Because `duration-end-time-desktop.tsx` derives `start_times` for the grid from `adjusted_start_time` (server time + 5 minutes) via `getBoundaries`/`getClosestTimeToCurrentGMT`, the suite must pin the system clock to a morning instant (`FROZEN_NOW`, via `jest.useFakeTimers().setSystemTime(...)`) so the clicked slot is never before "now" and never gets pushed to the next available slot.

#### Scenario: suite runs at a real afternoon wall-clock time

- **WHEN** the Jest process itself starts after 14:30 local/UTC wall-clock time
- **THEN** the `[DCE-004]` same-day test still asserts `expiry_time: '14:30:00'` because `beforeEach` freezes `Date` to a morning `FROZEN_NOW` instant before the store and component are constructed

### Requirement: [EGRID-002] The frozen clock covers every sibling DCE-004 case in the same file

The other two `[DCE-004]` tests in `duration-end-time-desktop.spec.tsx` (the daily-only end-of-day close and the before-midnight market-close case) read `common.server_time` and real-time-derived defaults through the same `beforeEach`, so they must run under the identical `FROZEN_NOW` freeze rather than each managing its own clock.

#### Scenario: all DCE-004 cases share one frozen instant

- **WHEN** any of the three `[DCE-004]` tests in the file executes
- **THEN** it runs inside the shared `beforeEach` that calls `jest.useFakeTimers` and `jest.setSystemTime(FROZEN_NOW)` before rendering, and `afterEach` restores real timers afterward so no faked state leaks to other spec files

### Requirement: [EGRID-003] `time-grid-picker.spec.tsx`'s market-hours filtering is proven independent of the real current date

`TimeGridPicker`'s `isTimeValid` (`packages/trader/src/AppV2/Components/TradeParameters/Duration/time-grid-picker.tsx`) compares only the hour/minute of `dayjs()` against the supplied `startTimes`/`endTimes`, never filtering by whether a slot is in the past. A regression test must pin the system clock to an arbitrary faked date and confirm the disabled/enabled hour classes for a fixed market-hours window are unchanged, proving there is no hidden wall-clock dependency for `time-grid-picker.spec.tsx` to freeze.

#### Scenario: same market-hours window is evaluated under an arbitrary faked "today"

- **WHEN** the system clock is faked to an arbitrary date distinct from the real run date, and `TimeGridPicker` is rendered with a fixed 09:00-17:00 `startTimes`/`endTimes` window
- **THEN** the same hours are disabled/enabled as when the suite runs under the real system clock (e.g. `Hour 08` disabled, `Hour 10` enabled, `Hour 18` disabled), confirming the market-hours check depends only on hour/minute, not on which calendar date is "today"
