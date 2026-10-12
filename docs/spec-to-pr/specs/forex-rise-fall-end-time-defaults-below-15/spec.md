# Forex Rise/Fall End time defaults below 15-minute minimum (#1548)

The End time tab of the Duration parameter defaults its expiry to a hardcoded `now + 5 minutes`
and offers every 5-minute slot from there onward, even though the contract's intraday minimum
(e.g. 15 minutes for Forex Rise/Fall) is larger. The default and the sub-minimum slots must come
from the contract's own `duration_min_max.intraday.min`, computed on a full-precision server
timestamp, snapped up to the picker's 5-minute grid, and re-evaluated as the clock advances.

## ADDED Requirements

### Requirement: [FEET-001] End-time floor derives from the contract's intraday minimum duration

A shared helper `getEarliestEndTime` in `packages/trader/src/AppV2/Utils/trade-params-utils.tsx` computes the earliest selectable end time as `ceil_to_5min(contract_start + duration_min_max.intraday.min + 1 minute)`. The minimum is read from the contract's own `duration_min_max.intraday.min` (the same source the Minutes tab uses for its `15 - 60 minutes` range) — never a hardcoded constant — and the arithmetic runs on the full-precision server timestamp including seconds. The result is formatted `HH:mm`. When no intraday minimum exists, the helper falls back to the legacy market-boundary + 5-minute time.

#### Scenario: full-precision seconds keep the default strictly above the minimum

- **WHEN** server time is `10:00:20` and the intraday minimum is 15 minutes
- **THEN** the floor is `10:20`, not `10:15` — `10:15` is only 14m40s ahead of `10:00:20` and would be rejected by the backend

#### Scenario: the grid snap places the default on a selectable 5-minute slot

- **WHEN** server time is `10:13:50` and the intraday minimum is 15 minutes
- **THEN** the floor is `10:30` (`ceil(10:29:50)` to the 5-minute grid), 1m10s above the minimum

#### Scenario: an exact-minute server time still gets the buffer

- **WHEN** server time is `10:00:00` and the intraday minimum is 15 minutes
- **THEN** the floor is `10:20` (`10:15 + 1min = 10:16`, ceiled to the grid), not `10:15`

### Requirement: [FEET-002] Mobile End time (day.tsx) defaults to and offers only slots at or above the floor

In `packages/trader/src/AppV2/Components/TradeParameters/Duration/day.tsx`, `adjusted_start_time` is computed from the full-precision `server_time` and today's market boundaries via `getEarliestEndTime`. The value drives both the default end time seeded into the picker and the `adjusted_start_time` prop of the `EndTimePicker`, so sub-minimum slots are not the default and are not the start of the offered range.

#### Scenario: default end time respects a 15-minute minimum

- **WHEN** the mobile End time sheet opens for a Forex Rise/Fall contract (`duration_min_max.intraday.min = 900`) at server time `11:23:10`
- **THEN** the time field and the picker's `adjusted_start_time` show `11:40` (or a later 5-minute slot), never a time less than 15 minutes ahead

#### Scenario: switching to a market with a different minimum re-derives the floor

- **WHEN** the symbol or trade type changes so `duration_min_max.intraday.min` changes
- **THEN** `adjusted_start_time` recomputes from the new minimum because it is derived from `server_time` and `duration_min_max` in the render body

### Requirement: [FEET-003] Desktop End time (duration-end-time-desktop.tsx) defaults to and offers only slots at or above the floor

In `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-end-time-desktop.tsx`, `adjusted_start_time` is computed from the full-precision `server_time` and today's market boundaries via `getEarliestEndTime`. The value feeds both the initial/default time and the `start_times` given to `TimeGridPicker`, so slots below the floor are disabled in the grid. The `useMemo` keyed on `server_time` keeps the floor ticking every second, and the time-sync effect rewrites `selectedTime` only while it is the `23:59`/`23:59:59` placeholder or has fallen below the floor.

#### Scenario: sub-minimum slots are disabled in the time grid

- **WHEN** the desktop End time popover opens at server time `06:00:00` with `duration_min_max.intraday.min = 900`
- **THEN** grid slots earlier than `06:20` (e.g. `06:05`, `06:10`, `06:15`) are disabled and `06:20` onward are selectable

#### Scenario: the floor ticks as the clock advances

- **WHEN** `server_time` advances so that `ceil_to_5min(now + min + 1min)` moves to a later slot
- **THEN** `adjusted_start_time` recomputes (the `useMemo` depends on `server_time`) and the newly sub-floor slots become disabled

#### Scenario: a time that has decayed below the floor is bumped, a still-valid one is left alone

- **WHEN** the displayed time (the seeded default, a stored same-day time, or the user's own grid pick) drops below the floor as `server_time` advances
- **THEN** it is replaced with the current `adjusted_start_time`; a time still at or above the floor is untouched, whoever chose it

### Requirement: [FEET-004] A sub-minimum same-day endtime never goes on the wire (Save and Buy backstop)

`hasResolvableExpiry` in `packages/trader/src/Stores/Modules/Trading/Helpers/proposal.ts` returns `false` when `expiry_type === 'endtime'`, the expiry date is the server's today, the contract carries an intraday minimum, and the resolved `date_expiry` epoch is below `server_now + intraday.min` seconds. `requestProposal` already withholds the proposal when `hasResolvableExpiry` is false, so a decayed or bypassed sub-minimum selection can no longer reach the API on Buy.

#### Scenario: an endtime below the intraday minimum withholds the proposal

- **WHEN** `expiry_type` is `endtime`, the expiry date is today, `duration_min_max.intraday.min` is 900, and the resolved expiry epoch is less than `server_time + 900`
- **THEN** `hasResolvableExpiry` returns `false` and `requestProposal` does not send the request

#### Scenario: an endtime at or above the intraday minimum still resolves

- **WHEN** the resolved expiry epoch is at least `server_time + intraday.min`
- **THEN** `hasResolvableExpiry` returns `true` and the proposal is sent normally

#### Scenario: contracts without an intraday minimum are untouched

- **WHEN** the contract has no `duration_min_max.intraday.min` (e.g. a daily-only contract)
- **THEN** `hasResolvableExpiry` behaves exactly as before for any endtime expiry

### Requirement: [FEET-005] The minimum is measured from the contract's own start, not from now

`getEarliestEndTime` MUST take the later of the server time and the contract's effective start (`getBoundaries(...).start[0]`, i.e. a market that opens later today) as the point the intraday minimum runs from, and only then compare the result against the legacy `contract_start + 5 minutes`. Composing `max(now + min + buffer, contract_start + 5min)` instead leaves the floor short of the minimum by up to the whole gap between now and the start. `isEndtimeBelowIntradayMin` (FEET-004) MUST measure from the same point — `max(server_time, today's market open)` — so the guard and the picker agree on which end times are valid; measuring from now alone rejects the very slots the picker offers before a market opens.

#### Scenario: a market that opens later today

- **WHEN** server time is `08:00:00`, the market opens at `12:00`, and the intraday minimum is 15 minutes
- **THEN** the floor is `12:20` (`12:00 + 15min + 1min`, snapped up), not the `12:05` that the open's +5 minutes alone would give

#### Scenario: a contract start later than the minimum-derived floor still wins

- **WHEN** the contract start's +5 minutes is later than the minimum-derived floor
- **THEN** the contract start's value is the floor, so a market boundary is never undercut

#### Scenario: the proposal guard measures from the market open too

- **WHEN** the market opens at `12:00`, server time is `08:00:00`, the intraday minimum is 15 minutes and the end time is `12:20`
- **THEN** `isEndtimeBelowIntradayMin` is `false` — the picker offers `12:20`, so the guard must not reject it

#### Scenario: the proposal guard rejects a slot below the open-relative minimum

- **WHEN** the same market opens at `12:00`, server time is `08:00:00` and the end time is `12:05`
- **THEN** `isEndtimeBelowIntradayMin` is `true`, even though `12:05` is four hours from now

### Requirement: [FEET-006] A floor that crosses midnight clamps to the day's last slot

`getEarliestEndTime` MUST compare candidate floors chronologically and, when the winning floor falls on a later calendar day than the server time, return the day's last 5-minute slot (`23:55`). Formatting each candidate to `HH:mm` and taking a lexicographic maximum discards a next-day floor entirely (`'00:10' > '23:55'` is false), which restores the sub-minimum default and the sub-minimum offered range for the last minutes of every day. Whether the picker should instead roll the date to the next trading day is deferred to #1557; until then the date stays today and FEET-004 keeps the selection off the wire.

#### Scenario: the floor rolls past midnight

- **WHEN** server time is `23:50:00` and the intraday minimum is 15 minutes, so the true floor is `00:06` the next day
- **THEN** the returned floor is `23:55`, never an earlier same-day slot such as the `23:55` boundary start being replaced by a discarded `00:10`

#### Scenario: the floor lands exactly on midnight

- **WHEN** server time is `23:44:00` and the intraday minimum is 15 minutes, so the floor snaps to `00:00` the next day
- **THEN** the returned floor is `23:55`

### Requirement: [FEET-007] Mobile bumps a decayed draft, matching desktop

`day.tsx` MUST rewrite its **draft** end time (the browsed value and the sheet's unsaved selection, not the store's committed `expiry_time`) to `adjusted_start_time` whenever the selected date is today and the draft has fallen below the floor, so the mobile picker cannot keep a draft that is no longer in its own offered range. The existing seeding effect is keyed on the selected date alone and never re-fires as the clock advances, so the bump needs its own effect keyed on the floor. A committed end time that decays below the floor is covered by the proposal guard (FEET-004) until the user reopens the sheet and saves.

#### Scenario: the clock advances past the held draft

- **WHEN** the mobile End time field holds a draft of `11:40` for today and `server_time` advances to `11:30:00` with a 15-minute minimum, moving the floor to `11:50`
- **THEN** both the displayed time and the sheet's unsaved end time become `11:50`, and saving commits `11:50`

### Requirement: [FEET-008] A withheld sub-minimum end time states its reason on both breakpoints

While the committed end time is below the contract's intraday minimum — the state that makes `requestProposal` withhold the request — the Duration trade parameter MUST state the reason instead of the page silently going unpriced. The message MUST be a TradeStore `computed` (`endtime_minimum_error`) derived from `isEndtimeBelowIntradayMin` and `duration_min_max.intraday.min`, never a write into `validation_errors.duration`: a stored copy has a second owner (`validateAllProperties()` and `changeDurationValidationRules()` wipe it while the request stays withheld) and freezes the copy in the language it was built in. Both duration components read that computed — the mobile `duration.tsx` announces it through the shared error snackbar, and the desktop `duration-desktop.tsx` puts its Duration field in the error state. The copy names the contract's start rather than "now", matching where the minimum is measured from (FEET-005).

#### Scenario: the computed states the minimum

- **WHEN** the store holds a same-day end time below a 15-minute intraday minimum
- **THEN** `endtime_minimum_error` reads `Select an end time at least 15 minutes after the contract starts.`

#### Scenario: the computed is empty once the end time is valid

- **WHEN** the end time moves back to at or above the minimum
- **THEN** `endtime_minimum_error` is `''`

#### Scenario: another writer's duration error is untouched

- **WHEN** `validation_errors.duration` holds a message from another writer
- **THEN** that message is left standing, because the guard writes nothing to `validation_errors`

#### Scenario: mobile announces the message

- **WHEN** the mobile Duration parameter renders while `endtime_minimum_error` is set
- **THEN** an error snackbar carries that sentence and the Duration field is in the error state

#### Scenario: desktop marks the Duration field

- **WHEN** the desktop Duration parameter renders while `endtime_minimum_error` is set
- **THEN** its Duration field is in the error state and the same sentence is announced
