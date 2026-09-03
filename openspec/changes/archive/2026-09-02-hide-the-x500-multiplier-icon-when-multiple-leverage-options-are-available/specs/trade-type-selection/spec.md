## ADDED Requirements

### Requirement: Multipliers shows no fixed leverage badge in the trade-type selector

The trade-type selector SHALL NOT display a fixed leverage badge (e.g. `x500`) next to the Multipliers trade type, because Multipliers offers multiple leverage values and a single fixed value misrepresents the available choices. This applies to every surface that renders the trade-type list from `AVAILABLE_CONTRACTS` — the desktop market-selection sidebar and the mobile market-selection tabs.

The Multipliers entry in `AVAILABLE_CONTRACTS` MUST NOT define a `badge` value. The generic `badge` rendering mechanism (the optional `badge` field and the guarded render sites) SHALL remain in place, so a badge can be re-enabled later without reworking the selector.

#### Scenario: Multipliers tab renders without a leverage badge on mobile

- **WHEN** the mobile market-selection trade-type tabs render the Multipliers tab
- **THEN** no `x500` (or other fixed leverage) badge element is shown next to the "Multipliers" label

#### Scenario: Multipliers item renders without a leverage badge on desktop

- **WHEN** the desktop market-selection sidebar renders the Multipliers item
- **THEN** no `x500` (or other fixed leverage) badge element is shown next to the "Multipliers" label

#### Scenario: Other trade types are unaffected

- **WHEN** the trade-type selector renders any non-Multipliers trade type
- **THEN** its appearance is unchanged from before this change (none defines a `badge`, so none renders one)

### Requirement: Badge rendering remains conditional on a defined badge value

Each trade-type entry MAY optionally define a `badge` string, and a badge element SHALL render for an entry only when that entry defines a non-empty `badge`. Removing the `badge` from an entry SHALL hide the badge for that entry on all selector surfaces without affecting any other entry.

#### Scenario: Entry without a badge shows no badge element

- **WHEN** a trade-type entry has no `badge` value defined
- **THEN** the selector renders that entry's label with no badge element

#### Scenario: Entry with a badge value shows the badge element

- **WHEN** a trade-type entry defines a non-empty `badge` value
- **THEN** the selector renders that value as a badge element next to the entry's label
