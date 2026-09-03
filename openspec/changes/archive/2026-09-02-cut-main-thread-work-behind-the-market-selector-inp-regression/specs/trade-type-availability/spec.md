## Purpose

Defines how the trade-type list offered to a client is filtered down to what the server actually makes tradeable, so restricted clients (e.g. EU accounts offered Multipliers only) are never shown trade types they cannot open — without the UI knowing anything about jurisdictions, and without adding network requests or blocking the market selector's interaction.

## ADDED Requirements

### Requirement: Trade-type availability is determined by symbol count

The set of trade types offered to a client SHALL be derived from the static trade-type list by removing any trade type for which the server returns no tradeable symbols. A trade type is available if and only if its server response contains at least one symbol. Availability SHALL be decided from symbol counts only; the availability lookup SHALL NOT sort or retain the symbol lists it inspects.

#### Scenario: Trade type with symbols is offered

- **WHEN** the server returns at least one symbol for a trade type
- **THEN** that trade type is included in the offered trade-type list

#### Scenario: Trade type with no symbols is dropped

- **WHEN** the server returns no symbols for a trade type (e.g. an EU account for which only Multipliers is tradeable)
- **THEN** that trade type is excluded from the offered trade-type list

### Requirement: Availability filtering fails open

While the availability lookup has not yet resolved, the offered trade-type list SHALL be the full (unfiltered) list so the trade-type list renders complete rather than empty. If the lookup resolves but yields no available trade types at all (for example, every request errored), the offered list SHALL likewise fall back to the full list rather than presenting a client with no trade types.

#### Scenario: Loading state returns the full list

- **WHEN** the availability lookup is still loading
- **THEN** the full, unfiltered trade-type list is returned

#### Scenario: Empty availability result returns the full list

- **WHEN** the availability lookup has resolved but reports no available trade types
- **THEN** the full, unfiltered trade-type list is returned rather than an empty list

#### Scenario: Native-app restriction and server availability combine

- **WHEN** the native app restricts the allowed trade types AND the server reports availability for a subset of them
- **THEN** the offered list is the intersection — restricted to what the native app allows and what the server makes tradeable

### Requirement: Availability warm-up runs at page mount

The availability lookup SHALL be initiated when the page mounts (from the market strip that mounts with the page), not gated behind the market selector being opened, so the trade-type list does not render in full and then visibly collapse when the selector is opened.

#### Scenario: Trade-type list does not collapse on selector open

- **WHEN** the page has mounted and the user opens the market selector
- **THEN** the trade-type list is already filtered to available trade types and does not visibly change from a full list to a filtered one on open

### Requirement: Availability lookup adds no network requests

The availability lookup SHALL reuse the exact same server requests as the symbol-fetch used by the market selector's search grouping — identical request keys so results are shared from a single cache — and SHALL NOT issue additional network requests. Repeatedly opening the selector SHALL NOT refetch while the cached data is fresh.

#### Scenario: Availability shares the symbol cache

- **WHEN** availability is requested for a trade type whose symbols have already been fetched (or vice versa)
- **THEN** the cached response is reused and no additional network request is issued
