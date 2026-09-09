# app-theme Specification

## Purpose

Defines how DTrader resolves its active light/dark theme from the device's system preference, an explicit user choice, or a `theme` URL parameter, how that resolution is announced to the browser so automatic dark-theme features do not force-darken the page, and the guarantee that every surface — including the canvas-rendered chart — renders in that one resolved theme.

## Requirements

### Requirement: A single resolved theme applies to every surface

DTrader SHALL render all of its surfaces — page chrome, trade panel, modals, drawers, and the chart — in one resolved theme at any moment. No surface MAY render in a theme other than the resolved one, regardless of how that surface is painted (DOM, canvas, or embedded renderer).

#### Scenario: Chart matches the page in dark theme

- **WHEN** the resolved theme is dark
- **THEN** the trade chart renders with its dark theme
- **AND** the surrounding page renders with its dark theme

#### Scenario: Chart matches the page in light theme

- **WHEN** the resolved theme is light
- **THEN** the trade chart renders with its light theme
- **AND** the surrounding page renders with its light theme

#### Scenario: Contract-details chart matches the page

- **WHEN** a user opens a contract's details page while the resolved theme is dark
- **THEN** the replay/contract-details chart renders with its dark theme, matching the rest of the page

#### Scenario: Switching theme re-themes the chart without a reload

- **WHEN** the resolved theme changes from light to dark while a chart is on screen
- **THEN** the chart re-renders in dark without requiring a page reload
- **AND** no surface is left in the previous theme

### Requirement: Theme follows the system preference by default

When the user has expressed no theme preference, DTrader SHALL resolve its theme from the device's `prefers-color-scheme` setting, on every viewport size and device class.

#### Scenario: First visit on a dark-themed device

- **WHEN** a user with no stored DTrader theme preference opens DTrader on a device whose system theme is Dark
- **THEN** DTrader resolves to the dark theme
- **AND** the chart renders dark

#### Scenario: First visit on a light-themed device

- **WHEN** a user with no stored DTrader theme preference opens DTrader on a device whose system theme is Light
- **THEN** DTrader resolves to the light theme

#### Scenario: System preference is followed regardless of viewport width

- **WHEN** a user with no stored theme preference opens DTrader on a dark-themed device at a viewport wider than the mobile breakpoint, or rotates a mobile device from portrait to landscape across that breakpoint
- **THEN** DTrader still resolves to the dark theme
- **AND** the resolved theme does not change as a result of the width change alone

#### Scenario: System preference changes while the app is open

- **WHEN** the device's system theme is switched from Light to Dark while DTrader is open and the user has expressed no theme preference
- **THEN** DTrader re-resolves to the dark theme without a reload
- **AND** both the page and the chart update to dark

### Requirement: An explicit theme choice overrides the system preference

Selecting Light or Dark in DTrader, or loading DTrader with a `theme` URL parameter, SHALL record an explicit preference that takes precedence over the device's system preference. An explicit preference SHALL persist across reloads and SHALL NOT be overridden by later system-theme changes.

#### Scenario: User picks Light on a dark-themed device

- **WHEN** a user on a dark-themed device selects Light in the theme selector
- **THEN** DTrader resolves to the light theme
- **AND** the chart renders light

#### Scenario: Explicit choice survives a reload

- **WHEN** a user has explicitly selected Dark and then reloads DTrader on a light-themed device
- **THEN** DTrader resolves to the dark theme

#### Scenario: Explicit choice is not overridden by a system change

- **WHEN** a user has explicitly selected Light and the device's system theme then switches to Dark while DTrader is open
- **THEN** DTrader remains in the light theme

#### Scenario: URL parameter sets the theme

- **WHEN** DTrader is opened with a `theme` URL parameter of `dark` on a light-themed device
- **THEN** DTrader resolves to the dark theme
- **AND** that choice is treated as explicit for the remainder of the session

### Requirement: An existing stored theme is preserved across the upgrade

A user who already has a stored DTrader theme from before this change SHALL continue to see that theme after upgrading. The upgrade MUST NOT silently switch a returning user's theme to match their system preference.

#### Scenario: Returning user with a stored light theme on a dark device

- **WHEN** a user whose stored DTrader state records the light theme, and which predates the explicit-preference concept, opens DTrader on a dark-themed device
- **THEN** DTrader resolves to the light theme
- **AND** the chart renders light, matching the rest of the page

#### Scenario: Returning user with a stored dark theme

- **WHEN** a user whose stored DTrader state records the dark theme opens DTrader on a light-themed device
- **THEN** DTrader resolves to the dark theme

### Requirement: The resolved theme is announced to the browser

DTrader SHALL declare its supported colour schemes and its currently resolved colour scheme to the browser, and MUST keep that declaration in step with the resolved theme for the lifetime of the page. This declaration is what tells a browser with an automatic dark-theme feature that the page themes itself, so the browser does not apply its own algorithmic darkening.

#### Scenario: Browser auto-dark does not force-darken the page

- **WHEN** DTrader is opened in a browser whose automatic/forced dark-theme feature is active (for example Samsung Internet "Dark mode" or Chrome for Android "Auto dark theme")
- **THEN** the browser does not apply its own darkening on top of DTrader's colours
- **AND** the page and the chart both render in DTrader's resolved theme

#### Scenario: Declaration follows a runtime theme switch

- **WHEN** the resolved theme changes from light to dark while the page is open
- **THEN** the declared colour scheme changes to dark at the same time
- **AND** the declaration does not remain at its page-load value

#### Scenario: Browser-painted UI matches the resolved theme

- **WHEN** the resolved theme is dark and a browser-painted control (such as a native scrollbar or form control) is shown
- **THEN** that control is painted for a dark colour scheme rather than a light one

### Requirement: The pre-render theme matches the resolved theme

The theme applied before the application code runs — the initial loading screen and the document background — SHALL match the theme the application will resolve to, so a dark-theme user does not see a light flash on load.

#### Scenario: No light flash on a dark-themed device

- **WHEN** a user with no stored preference loads DTrader on a dark-themed device
- **THEN** the initial loading screen is rendered dark
- **AND** the theme does not visibly change from light to dark once the app finishes loading

#### Scenario: Pre-render theme honours an explicit stored preference

- **WHEN** a user with an explicit stored preference of Light loads DTrader on a dark-themed device
- **THEN** the initial loading screen is rendered light
