# account-header-colors Specification

## Purpose

TBD - created by archiving change demo-account-label-and-balance-use-incorrect-text-color-in-mobile-web-view. Update Purpose after archive.

## Requirements

### Requirement: Account balance uses the theme's primary text colour

The account balance shown in the account header trigger SHALL be rendered in the theme's primary text
colour, for every account type. No stylesheet rule SHALL recolour the balance based on whether the
active account is demo or real.

The primary text colour is the one token that inverts with the theme: dark in Light theme, light in Dark
theme. A brand/status colour (success, warning, danger, info) is identical in both themes and therefore
does not satisfy this requirement.

#### Scenario: Demo balance in Light theme

- **GIVEN** a logged-in user whose active account is a demo account
- **WHEN** the account header is displayed in Light theme
- **THEN** the balance text is the theme's primary text colour (dark text)

#### Scenario: Demo balance in Dark theme

- **GIVEN** a logged-in user whose active account is a demo account
- **WHEN** the account header is displayed in Dark theme
- **THEN** the balance text is the theme's primary text colour (light text)

#### Scenario: Balance colour is the same for demo and real accounts

- **GIVEN** a logged-in user with both a demo and a real account
- **WHEN** the user switches between the demo account and the real account in a fixed theme
- **THEN** the balance text colour is unchanged by the switch

#### Scenario: Theme toggle repaints the balance

- **GIVEN** a demo account's balance is displayed
- **WHEN** the user switches the app between Light and Dark theme
- **THEN** the balance text colour changes with the theme rather than staying at a fixed brand colour

#### Scenario: No stylesheet override defeats the requested colour

- **WHEN** the balance element requests the primary text colour via the shared text component
- **THEN** no more-specific rule in the account header stylesheet overrides that colour for demo
  accounts, so the requested colour is the one rendered

### Requirement: The "No currency assigned" balance placeholder follows the same colour rule

When the active account has no currency assigned, the balance slot SHALL render its placeholder
message in the theme's primary text colour, under the same rule as an amount, for demo and real
accounts alike.

#### Scenario: Placeholder on a demo account without a currency

- **GIVEN** the active account is a demo account with no currency assigned
- **WHEN** the account header is displayed
- **THEN** the "No currency assigned" text uses the theme's primary text colour, in both Light and Dark
  theme

### Requirement: Account-type label keeps its demo/real colour coding

The account-type label above the balance (`Demo account` / `Real account`) SHALL remain deliberately
colour-coded by account type, and SHALL NOT be changed to the primary text colour:

- a demo account's label SHALL use the tertiary text colour (amber/orange);
- a real account's label SHALL use the secondary-alternate text colour (teal/green).

Both of these tokens are theme-aware in their own right, so the label already adapts between Light and
Dark theme. This requirement exists to pin the colour coding as intended behaviour, so that fixing the
balance colour does not flatten the label along with it.

#### Scenario: Demo label colour

- **GIVEN** the active account is a demo account
- **WHEN** the account header is displayed
- **THEN** the `Demo account` label uses the tertiary text colour

#### Scenario: Real label colour

- **GIVEN** the active account is a real account
- **WHEN** the account header is displayed
- **THEN** the `Real account` label uses the secondary-alternate text colour

#### Scenario: Label colour is not the balance colour

- **WHEN** the account header is displayed for either account type
- **THEN** the account-type label colour differs from the balance colour, so label and balance remain
  visually distinguishable

### Requirement: All account header surfaces agree on these colours

The colour rules above SHALL hold on every surface that renders the account header trigger, so the
header does not change appearance with viewport size or chart state:

- the mobile web header;
- the desktop header;
- the compact header shown on mobile while the chart is maximized.

#### Scenario: Mobile matches desktop

- **GIVEN** the same demo account and the same theme
- **WHEN** the header is viewed at a mobile viewport and at a desktop viewport
- **THEN** the balance colour is the primary text colour on both, and the account-type label colour is
  the tertiary colour on both

#### Scenario: Maximizing the chart on mobile does not change the colours

- **GIVEN** a demo account on mobile
- **WHEN** the chart is maximized and the compact header replaces the full header
- **THEN** the balance is still the primary text colour and the label is still the tertiary colour

### Requirement: Only the colour changes

Correcting the balance colour SHALL NOT alter the account header's layout, structure, markup, text
content, or interactive behaviour.

#### Scenario: Account switcher still opens

- **GIVEN** a logged-in user with more than one account
- **WHEN** the user activates the account header trigger
- **THEN** the account list opens exactly as before

#### Scenario: Demo-only user still sees no switcher affordance

- **GIVEN** a logged-in user whose only accounts are demo accounts
- **WHEN** the account header is displayed
- **THEN** the trigger remains non-interactive with no chevron, unchanged by the colour fix

#### Scenario: Account list rows are unaffected

- **WHEN** the account list is opened
- **THEN** each row's own balance styling is unchanged by the trigger's colour fix
