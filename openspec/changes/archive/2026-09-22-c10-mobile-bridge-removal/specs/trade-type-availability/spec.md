## REMOVED Requirements

- `### Requirement: Availability filtering fails open`

**Reason**: Re-issued below as `[TTA-001]` with the "Native-app restriction and server availability combine" scenario dropped — with the bridge gone there is no native-app restriction to intersect, so the fail-open contract is re-stated against server availability alone. It is removed and re-added rather than MODIFIED because MODIFIED may not drop a scenario (archive rejects it) and may not change the heading (the ID would not match the un-IDed original).

## ADDED Requirements

### Requirement: [TTA-001] Availability filtering fails open

While the availability lookup has not yet resolved, the offered trade-type list SHALL be the full (unfiltered) list so the trade-type list renders complete rather than empty. If the lookup resolves but yields no available trade types at all (for example, every request errored), the offered list SHALL likewise fall back to the full list rather than presenting a client with no trade types.

#### Scenario: Loading state returns the full list

- **WHEN** the availability lookup is still loading
- **THEN** the full, unfiltered trade-type list is returned

#### Scenario: Empty availability result returns the full list

- **WHEN** the availability lookup has resolved but reports no available trade types
- **THEN** the full, unfiltered trade-type list is returned rather than an empty list
