# proposal-request-integrity Specification

## Purpose
TBD - created by archiving change p2-red-error-banner-persists-covers-buy-button-when-switching-between-gold-and-step200-tiles. Update Purpose after archive.
## Requirements
### Requirement: A proposal request for a duration-taking contract always carries an expiry

Every price-proposal request the client sends for a contract type that takes an expiry SHALL carry either a duration (a duration value together with its duration unit) or an absolute expiry timestamp. A request carrying neither SHALL NOT be sent. Contract types that take no expiry (Accumulators, Multipliers) SHALL continue to send no expiry fields.

#### Scenario: End-time expiry with a resolvable time sends the absolute expiry

- **WHEN** the trade is configured to expire at an end time and both the expiry date and the expiry time are known
- **THEN** the proposal request carries the absolute expiry timestamp derived from that date and time
- **AND** it carries no duration fields

#### Scenario: End-time expiry with no resolvable time falls back to the duration

- **WHEN** the trade is configured to expire at an end time but no usable expiry time is available, while a duration value and duration unit are available
- **THEN** the proposal request carries that duration value and duration unit
- **AND** the request is sent normally

#### Scenario: Duration expiry sends the duration

- **WHEN** the trade is configured to expire after a duration
- **THEN** the proposal request carries the duration value and duration unit
- **AND** it carries no absolute expiry timestamp

#### Scenario: Accumulators and Multipliers send no expiry

- **WHEN** the selected contract type is Accumulator or Multiplier
- **THEN** the proposal request carries no duration and no absolute expiry timestamp
- **AND** the request is sent normally

### Requirement: No proposal is requested when the expiry cannot be resolved

When the trade parameters for a duration-taking contract yield neither a duration nor an absolute expiry, the client SHALL skip the proposal request entirely instead of sending an incomplete one. In that state the client SHALL clear any cached proposal prices, pending proposal requests and purchase state, exactly as it already does for the other conditions under which it withholds a proposal (a closed market, unapplied contract data for the symbol, or an outstanding trade-parameter validation error), so the Buy button shows no stale price and cannot be armed from stale data.

#### Scenario: Unresolvable expiry suppresses the request and its error

- **WHEN** the trade parameters yield neither a duration nor an absolute expiry for a duration-taking contract
- **THEN** no proposal request is sent
- **AND** no backend error message about a missing duration or expiry is shown to the user
- **AND** the cached proposal prices and pending proposal requests are cleared

#### Scenario: The trade recovers once an expiry becomes resolvable

- **WHEN** the trade parameters are subsequently corrected so a duration or an absolute expiry is resolvable
- **THEN** a proposal request is sent for the current market and trade type
- **AND** the Buy button shows the returned price

### Requirement: An end-time expiry is never committed without a time

The trade parameters SHALL NOT be left in a state where the expiry mode is "end time" but no usable expiry time is recorded. Any commit that selects the end-time expiry mode SHALL record an expiry time alongside the expiry date. If a commit would leave the end-time mode without a usable time, the trade SHALL fall back to a duration-based expiry rather than retaining the incomplete end-time state. This applies on every breakpoint, so mobile web behaves the same as desktop web.

#### Scenario: Selecting a day-based duration on mobile records an end time

- **WHEN** the duration unit becomes days on mobile web and no end time has been chosen yet
- **THEN** the committed trade parameters carry the defaulted expiry date **and** its expiry time
- **AND** the resulting proposal request carries an absolute expiry timestamp

#### Scenario: An incomplete end-time commit falls back to a duration

- **WHEN** a commit would set the expiry mode to end time without any usable expiry time
- **THEN** the trade parameters record a duration-based expiry instead
- **AND** the resulting proposal request carries a duration value and duration unit

