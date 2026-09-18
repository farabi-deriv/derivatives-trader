# automation-strategy-params Specification

## Purpose
TBD - created by archiving change strategy-params-should-disable-closed. Update Purpose after archive.
## Requirements
### Requirement: [ASP-001] Automation strategy and risk-management parameters are disabled while the market is closed

The automation configuration fields — the **Strategy** selector, the **Stake multiplier / increment**, the **Max. stake**, and the **Profit / Loss threshold** (take-profit / stop-loss) inputs — SHALL be non-interactive whenever the active market is closed. This SHALL hold on both the mobile automation screen and the desktop Automated-trading panel, and SHALL match the disabled treatment the manual trade parameters already receive on a closed market. A disabled field SHALL NOT open its editor when interacted with.

#### Scenario: Fields disable on a closed market (mobile)

- **WHEN** the active market is closed on the mobile automation screen and no automation run is active
- **THEN** the Strategy selector and every visible strategy / risk-management field is disabled and cannot open its editor

#### Scenario: Fields disable on a closed market (desktop)

- **WHEN** the active market is closed on the desktop Automated-trading panel and no automation run is active
- **THEN** the Strategy selector and every visible strategy / risk-management field is disabled and cannot open its editor

#### Scenario: Fields are interactive when the market is open

- **WHEN** the active market is open, no run is active, and the symbol is automatable
- **THEN** every strategy and risk-management field is interactive and opens its editor exactly as before this change

### Requirement: [ASP-002] Closed-market disabling does not surface the automation-lock message

When a field is disabled **only** because the market is closed — no automation run is active and the active symbol is automatable — interacting with it SHALL NOT show the automation-lock overlay or the "Parameters are locked until automation is stopped." snackbar, nor the non-automatable-symbol snackbar. Market closure SHALL be communicated by the existing closed-market messaging and the hidden Run control, not by an automation-lock message.

#### Scenario: No lock message on a closed market

- **WHEN** the market is closed with no run active and an automatable symbol, and the user taps a disabled strategy or risk-management field
- **THEN** no automation-lock overlay is rendered over the field and no "Parameters are locked until automation is stopped." snackbar appears

#### Scenario: The lock message still appears during a run

- **WHEN** an automation run is active (market open or closed) and the user taps a disabled strategy or risk-management field
- **THEN** the automation-lock overlay and its snackbar appear exactly as they do today

### Requirement: [ASP-003] The automation lock and run controls are preserved

The existing automation lock SHALL be unchanged. While an automation run is active, or the active symbol is not automatable, the strategy and risk-management fields SHALL remain disabled and SHALL show the automation-lock overlay/snackbar as they do today, independent of market state. The Run/Pause/Stop controls SHALL remain hidden while the market is closed, as they are today. No manual trade parameter, validation rule, or run control behaviour SHALL change.

#### Scenario: Run-active lock is independent of market state

- **WHEN** an automation run is active
- **THEN** the strategy and risk-management fields are disabled with the automation-lock overlay whether the market is open or closed

#### Scenario: Non-automatable symbol keeps its own message

- **WHEN** the active symbol is not automatable, no run is active, and the market is open
- **THEN** the fields are disabled and interacting with one shows the symbol-specific "isn’t available for automated trading" message, unchanged

#### Scenario: Run controls stay hidden on a closed market

- **WHEN** the active market is closed
- **THEN** the Run/Pause/Stop controls are not shown, as before this change

