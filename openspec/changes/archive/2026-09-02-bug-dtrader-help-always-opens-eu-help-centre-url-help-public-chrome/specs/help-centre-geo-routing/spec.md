## Purpose

Defines where the DTrader Help entry points send the visitor: the help centre matching the visitor's regulatory market (EU vs non-EU/global), with a safe non-EU default when the market is unknown, one shared resolution rule across every Help entry point (desktop sidebar Help, mobile Menu → Help centre, footer Help centre link), and unchanged link-opening mechanics.

## ADDED Requirements

### Requirement: Help destination matches the visitor's regulatory market

A DTrader Help entry point SHALL resolve to the help centre that matches the visitor's regulatory market: the EU help centre for a visitor in an EU market, and the non-EU (global) help centre for a visitor in a non-EU market. The resolved destination SHALL NOT be a single fixed URL that ignores the visitor's market, and it SHALL NOT pass through an intermediate hop that discards the market decision (the current `trade.deriv.com/help-centre/deriv-trader` hop forwards every visitor to the EU help centre).

#### Scenario: Non-EU visitor reaches the non-EU help centre

- **WHEN** a logged-out visitor whose market resolves as non-EU (for example, egress from Kenya) activates any Help entry point
- **THEN** the destination that finally renders is the non-EU (global) help centre for Derivatives Trader (for example, `https://deriv.com/helpcentre/deriv-trader`)
- **AND** the destination is not the EU (`/eu/`) help centre and shows no EU-only CFD risk copy

#### Scenario: EU visitor reaches the EU help centre

- **WHEN** a logged-out visitor whose market resolves as EU (for example, egress from Spain) activates any Help entry point
- **THEN** the destination that finally renders is the EU help centre for Derivatives Trader (for example, `https://deriv.com/eu/helpcentre/deriv-trader`)

### Requirement: Unknown market defaults to the non-EU help centre

When the visitor's regulatory market cannot be determined — the market signal is missing, has not yet resolved, or errored — the Help entry points SHALL resolve to the non-EU (global) help centre. The resolution SHALL NOT block or delay opening the Help link while waiting on a market signal, and it SHALL NOT surface an error to the visitor when the signal fails.

#### Scenario: Missing or failed market signal falls back to non-EU

- **WHEN** the market signal is unavailable or has errored at the moment a visitor activates a Help entry point
- **THEN** the destination is the non-EU (global) help centre
- **AND** the Help link still opens immediately, with no error shown

#### Scenario: Signal still resolving falls back to non-EU

- **WHEN** a visitor activates a Help entry point before the market signal has finished resolving
- **THEN** the destination is the non-EU (global) help centre, not a blocked or deferred navigation

### Requirement: All Help entry points resolve through one shared rule

Every DTrader Help entry point SHALL obtain its destination from the same market-aware resolution rule, so no entry point can drift to a different or fixed destination. This covers the desktop sidebar Help item (`dt_sidebar_help`), the mobile Menu → Help centre entry, and the footer Help centre link (`dt_help_centre`) — including entry points that are currently not mounted but remain in the codebase.

#### Scenario: Desktop sidebar Help routes via the shared rule

- **WHEN** a visitor activates the desktop sidebar Help item (`dt_sidebar_help`)
- **THEN** the destination is the one produced by the shared market-aware rule for that visitor

#### Scenario: Mobile Menu Help centre routes via the shared rule

- **WHEN** a visitor activates Menu → Help centre in the mobile chrome
- **THEN** the destination is the one produced by the shared market-aware rule for that visitor
- **AND** it is identical to the destination the desktop sidebar Help item would produce for the same visitor

#### Scenario: Footer Help centre link routes via the shared rule

- **WHEN** the footer Help centre link (`dt_help_centre`) is rendered (now or after being remounted)
- **THEN** its destination is the one produced by the shared market-aware rule, not a separately hardcoded path

### Requirement: Help link opening mechanics are preserved

Making the Help destination market-aware SHALL NOT change how Help links open or present themselves. Each Help entry point SHALL keep opening the help centre in a new browsing context with `noopener` and `noreferrer` protection, and SHALL keep its existing visible label, icon, and test identifiers (`dt_sidebar_help`, `dt_help_centre`).

#### Scenario: Help opens in a protected new tab

- **WHEN** a visitor activates any Help entry point
- **THEN** the help centre opens in a new browsing context (new tab)
- **AND** the opener relationship is severed via `noopener,noreferrer` (or the anchor-equivalent `rel="noopener noreferrer"`)

#### Scenario: Visible affordance and test hooks are unchanged

- **WHEN** the Help entry points are rendered after the change
- **THEN** each still shows its existing label ("Help" / "Help centre") and icon
- **AND** the `data-testid`/`id` hooks `dt_sidebar_help` and `dt_help_centre` are still present and attached to the same elements as before
