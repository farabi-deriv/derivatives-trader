## Purpose

Defines the user-facing theme preference control: the Light / Dark / System selection offered on mobile, the one-click toggle kept on desktop, and the behavioural guarantees of each choice — an explicit Light or Dark selection is enforced on every app surface regardless of the OS appearance, while a System selection follows the OS theme live and can be returned to after an explicit choice.

## ADDED Requirements

### Requirement: Mobile menu offers Light, Dark and System theme options

On mobile viewports, the menu's Settings section SHALL offer a Theme item that opens a dedicated theme selection view with exactly three options — Light, Dark and System — replacing the previous two-state dark-theme switch. The selection view SHALL be dismissible back to the menu. The selection SHALL indicate the user's stored preference, not the resolved theme: a user whose preference is System sees System selected even while the app is rendering dark because the OS is dark.

#### Scenario: Three options are offered

- **WHEN** a user opens the mobile menu's Settings section and taps the Theme item
- **THEN** a theme selection view opens offering the options Light, Dark and System
- **AND** no two-state dark-theme switch is shown
- **AND** the view can be dismissed back to the menu via its back control

#### Scenario: The stored preference is indicated as selected

- **WHEN** the user's stored preference is System and the OS theme is Dark (so the app renders dark)
- **THEN** the System option is indicated as selected
- **AND** the Dark option is not indicated as selected

#### Scenario: A user with no stored preference sees System selected

- **WHEN** a user who has never chosen a theme opens the theme selection
- **THEN** the System option is indicated as selected

### Requirement: An explicit Light or Dark selection is enforced app-wide regardless of OS appearance

Selecting Light or Dark SHALL apply that theme to every app surface — page chrome, menus, modals, and the canvas-rendered chart — immediately and persistently, regardless of the OS or browser appearance setting. Later OS theme changes SHALL NOT alter the app's theme while an explicit preference is stored.

#### Scenario: Light selected on a dark-OS device

- **WHEN** a user on a device whose OS theme is Dark selects Light in the mobile theme selection
- **THEN** the whole app, including the chart, renders in the light theme
- **AND** the choice persists across a reload

#### Scenario: OS theme change does not override an explicit choice

- **WHEN** a user has selected Dark and the device's OS theme then switches from Dark to Light while the app is open
- **THEN** the app remains in the dark theme on every surface

#### Scenario: Forced browser darkening does not leak into an explicitly light app

- **WHEN** a user has selected Light and opens the app in a browser with an automatic/forced dark feature active (for example Samsung Internet "Dark mode") on a dark-OS device
- **THEN** the page is not inverted or force-darkened by the browser
- **AND** the page and the chart both render in the app's light theme

### Requirement: Selecting System follows the OS theme live

Selecting System SHALL resolve the app theme from the device's current OS appearance and SHALL keep following it live: an OS theme change while the app is open re-themes every surface, including the chart, without a reload. A System selection made after a previous explicit choice SHALL resume following the OS, and SHALL persist across reloads.

#### Scenario: Selecting System adopts the current OS theme

- **WHEN** a user whose explicit preference is Light selects System while the device's OS theme is Dark
- **THEN** the app re-renders in the dark theme, including the chart

#### Scenario: OS theme change re-themes the app live under System

- **WHEN** the user's preference is System and the device's OS theme switches from Light to Dark while the app is open
- **THEN** the app re-renders in the dark theme without a reload
- **AND** the chart re-renders in dark alongside the page

#### Scenario: System selection survives a reload

- **WHEN** a user selects System and reloads the app on a device whose OS theme is Dark
- **THEN** the app loads in the dark theme
- **AND** the theme selection still indicates System

### Requirement: Desktop keeps a one-click theme toggle that records an explicit choice

On viewports wider than the mobile breakpoint, the sidebar theme control SHALL remain a one-click toggle with no modal, flyout or side sheet. Activating it SHALL flip the theme relative to the currently resolved theme and record that result as an explicit preference, which then wins over later OS theme changes. Before the first activation, the app follows the OS theme by default.

#### Scenario: Desktop default follows the OS

- **WHEN** a user with no stored preference opens the app on a desktop whose OS theme is Dark
- **THEN** the app renders in the dark theme

#### Scenario: One click flips from the OS-followed theme and sticks

- **WHEN** a user following the OS theme Dark clicks the sidebar theme toggle once
- **THEN** the app switches to the light theme on every surface
- **AND** a later OS theme change does not switch the app back

#### Scenario: No flyout opens for the theme control

- **WHEN** a user clicks the sidebar theme toggle
- **THEN** the theme changes in place
- **AND** no flyout, modal or side sheet opens

### Requirement: Every theme selection path applies without a reload

Choosing any option — Light, Dark or System, on mobile or desktop — SHALL re-theme all app surfaces in place, with no page reload and no surface (including the chart) left in the previous theme.

#### Scenario: Mobile selection re-themes in place

- **WHEN** a user switches the mobile theme selection from Light to Dark
- **THEN** the menu, the page chrome and the chart all render dark without a reload

#### Scenario: No surface lags behind a selection

- **WHEN** any theme option is selected while trade or contract-details screens are mounted
- **THEN** no mounted surface continues to render in the previously resolved theme
