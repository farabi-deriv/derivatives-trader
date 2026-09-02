# daily-contract-expiry Specification

## ADDED Requirements

### Requirement: [DCE-001] First proposal for a daily-only contract carries the market close time

When the active symbol/trade-type pair offers `daily` as its only duration unit, the first `proposal` request the app sends after the symbol's `contracts_for` resolves SHALL carry a `date_expiry` equal to the epoch of the symbol's close time on the chosen expiry date. The app SHALL NOT send any `proposal` built from an intermediate or placeholder expiry time, and SHALL NOT rely on a corrective follow-up `proposal` to obtain a valid price.

The close time SHALL be the last entry of the symbol's `trading_times.close` for the expiry date (some underlyings publish two close times per day; the later one is authoritative), falling back to `23:59:59` only when `trading_times` returns no usable close time for that symbol and date.

#### Scenario: Daily-only symbol opens without a rejected proposal

- **WHEN** the Trade page loads with a symbol/trade-type pair whose `duration_units_list` contains only `d` (e.g. USD/JPY with Touch/No Touch)
- **THEN** exactly one `proposal` request is sent for that trade type
- **AND** its `date_expiry` equals the epoch of the expiry date at the symbol's close time (`23:59:59` GMT for USD/JPY)
- **AND** no `ContractBuyValidationError` response is received for that request

#### Scenario: Symbol closes earlier than end of day

- **WHEN** the symbol's `trading_times.close` for the expiry date is earlier than `23:59:59` (e.g. `['20:55:00']`)
- **THEN** the seeded `expiry_time` is that close time, not `23:59:59`

#### Scenario: Trading times unavailable for the symbol

- **WHEN** `trading_times` returns no close time (or `'--'`) for the symbol on the expiry date
- **THEN** the seeded `expiry_time` falls back to `23:59:59`
- **AND** the proposal is still sent exactly once

### Requirement: [DCE-002] The trade store is the single writer of the daily-only expiry seed

The daily-only expiry seed SHALL be applied by `TradeStore` while the `contracts_for` proposal hold (`is_awaiting_contracts_for`) is still engaged, and released only after the derived `expiry_type`, `expiry_date` and `expiry_time` have settled in the store. No React component SHALL write a daily expiry default into the store; duration components SHALL read `expiry_type`, `expiry_date` and `expiry_time` from the store for display.

The seed SHALL commit `expiry_type: 'endtime'` together with the resolved `expiry_date`, and SHALL delegate resolution of the exact `expiry_time` to the existing `StartDate.onChangeExpiry` → `ContractType.getExpiryTime` chain rather than writing a literal time of its own.

#### Scenario: Proposal is held across the seeding step

- **WHEN** `processContractsForV2` applies a default duration whose unit is `d` for a symbol with no intraday duration units
- **THEN** `is_awaiting_contracts_for` is still `true` while the expiry date and time are derived
- **AND** it is set to `false` only after the derived values are in the store
- **AND** any `requestProposal` invoked during that window returns without sending a request

#### Scenario: No component seeds the expiry

- **WHEN** the desktop duration popover or the shared duration component mounts for a daily-only contract
- **THEN** neither component calls `onChangeMultiple` to set `expiry_type`, `expiry_date` or `expiry_time` on mount
- **AND** the duration field's displayed value is derived from the store's `expiry_date` and `expiry_time`

#### Scenario: A user-set duration is not overwritten

- **WHEN** the user has explicitly saved a duration or end time for the current trade-type group and the symbol changes within that group
- **THEN** the daily seed does not run, matching the existing `duration_default_applied_for` / `isValidPersistedDuration` gate

#### Scenario: The resolved close time supersedes the provisional one

The seed commits `expiry_date` before the close time is known, so a reader that caches the pair must not keep the placeholder.

- **WHEN** the store has committed `expiry_date` with `expiry_time` still unresolved, and a component has cached the fallback time
- **AND** the store then resolves the real close time for that same date
- **THEN** the cached time is upgraded to the resolved value rather than staying on the fallback
- **AND** a value the user has explicitly saved is never overwritten by this correction

#### Scenario: A symbol change during the seed abandons the seed

- **WHEN** the active symbol changes while the daily seed's trading-times lookup is still in flight
- **THEN** the in-flight run does not commit its values, leaving the newer run's symbol state intact

### Requirement: [DCE-003] Daily expiry date is server time on the next available trading day

The expiry date seeded for a daily-only contract SHALL be computed from server time (`common.server_time` / `ServerTime`), never from browser-local time, and SHALL be the next date on or after the candidate day that is an available trading day for the symbol according to `trading_days`.

The candidate day SHALL be the current server day when the contract offers intraday duration units, and the following server day when it does not. Non-trading weekdays SHALL be skipped forward.

#### Scenario: Friday seeds Monday for a weekday-only symbol

- **WHEN** server time is a Friday and the symbol's `trading_days` excludes `Sat` and `Sun`
- **THEN** the seeded `expiry_date` is the following Monday
- **AND** the `proposal` `date_expiry` uses that Monday's close time

#### Scenario: Local time near the GMT day boundary does not shift the date

- **WHEN** the browser's local date differs from the server (GMT) date because the client is in a timezone offset across midnight
- **THEN** the seeded `expiry_date` is derived from server time and matches the server's day, not the browser's

#### Scenario: Contract with intraday units seeds today

- **WHEN** the contract's `duration_units_list` contains an intraday unit (`m` or `h`) alongside `d`
- **THEN** the candidate day is the current server day rather than the next day

### Requirement: [DCE-004] The desktop end-time picker preserves seconds for daily contracts

For a contract with no intraday duration units, the desktop end-time picker SHALL carry the symbol's close time at full `HH:mm:ss` precision from the trading-times lookup through display and through Save. It SHALL NOT truncate the value to `HH:mm` and re-append `:00`.

#### Scenario: Picking a future end date saves the full close time

- **WHEN** the user picks a future end date in the desktop End time tab for a daily-only contract whose close time is `23:59:59`
- **AND** the user presses Save
- **THEN** the committed `expiry_time` is `23:59:59`, not `23:59:00`

#### Scenario: Displayed end time keeps its seconds

- **WHEN** the desktop End time tab shows a stored `expiry_time` of `23:59:59` for a daily-only contract
- **THEN** the End time field renders `23:59:59 GMT`

#### Scenario: Intraday end times are unchanged

- **WHEN** the contract offers intraday duration units and the user selects a same-day end time from the time grid
- **THEN** the existing `HH:mm` selection and the `:00` seconds suffix on save are preserved exactly as before this change

### Requirement: [DCE-005] Same-day 5-minute rounding never rolls the expiry past midnight

When `getExpiryTime` clamps a same-day end time that falls inside the 5-minute minimum window, the resulting `expiry_time` SHALL remain on the expiry date. It SHALL NOT round forward into the next day, because the returned `HH:mm` is later paired with the unchanged `expiry_date` and would produce a `date_expiry` in the past.

Where the `is_end_of_day` / `is_end_of_session` guard has already declined to add the 5 minutes, the 5-minute rounding SHALL NOT be applied on top of that decision.

#### Scenario: End of day inside the rounding window

- **WHEN** server time is `23:56` (or any minute from `23:56` to `23:59`) and a same-day `endtime` expiry is clamped
- **THEN** the resolved `expiry_time` is `23:56` (the unrounded value), not `00:00`
- **AND** the `date_expiry` built from it in `createProposalRequestForContract` is in the future

#### Scenario: Ordinary rounding is unaffected

- **WHEN** server time is `14:33` and a same-day `endtime` expiry is clamped
- **THEN** the resolved `expiry_time` is `14:35`, matching the 5-minute grid the time picker offers
