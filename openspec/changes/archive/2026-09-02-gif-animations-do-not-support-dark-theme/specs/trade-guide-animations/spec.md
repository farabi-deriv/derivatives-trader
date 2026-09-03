## ADDED Requirements

### Requirement: Guide animation asset follows the active theme

The trade-type guide animation (`VideoFragment`) SHALL select its `.lottie` source based on the active app theme: the dark asset (`<name>_mobile_dark.lottie`) when `ui.is_dark_mode_on` is true, and the existing light asset (`<name>_mobile.lottie`) when it is false. The `<name>` prefix SHALL be the lower-cased animation key already used for the light asset (e.g. `rise`, `fall`, `higher`, `vanillas_call`, `accumulators`), so the dark asset resolves to the committed sibling file for every trade type.

#### Scenario: Dark mode loads the dark animation

- **WHEN** the guide is opened for a trade type (e.g. `rise`) while `ui.is_dark_mode_on` is true
- **THEN** the animation source resolves to `/public/videos/rise_mobile_dark.lottie`

#### Scenario: Light mode loads the light animation

- **WHEN** the guide is opened for a trade type (e.g. `rise`) while `ui.is_dark_mode_on` is false
- **THEN** the animation source resolves to `/public/videos/rise_mobile.lottie`

### Requirement: Theme switch updates an open guide animation live

`VideoFragment` SHALL react to changes in `ui.is_dark_mode_on` so that toggling the theme while a guide is open swaps the animation to the matching light/dark asset without requiring the guide to be reopened or the page reloaded.

#### Scenario: Toggling to dark mode while the guide is open

- **WHEN** the guide is open showing the light animation and the user switches the app to Dark mode
- **THEN** the animation source updates to the `_mobile_dark.lottie` asset without a manual reopen or reload

#### Scenario: Toggling back to light mode while the guide is open

- **WHEN** the guide is open showing the dark animation and the user switches the app back to Light mode
- **THEN** the animation source updates back to the `_mobile.lottie` asset without a manual reopen or reload

### Requirement: A dark asset exists for every guide animation

Every trade-type animation rendered in a guide SHALL have a committed dark-theme `.lottie` asset alongside its light-theme asset under `packages/core/src/public/videos/`, so no trade type falls back to a missing dark source.

#### Scenario: Each light animation has a dark sibling

- **WHEN** a light asset `<name>_mobile.lottie` is referenced by a guide (for `<name>` in accumulators, differs, even, fall, higher, lower, matches, multipliers_down, multipliers_up, no_touch, odd, over, rise, touch, turbos_down, turbos_up, under, vanillas_call, vanillas_put)
- **THEN** a corresponding `<name>_mobile_dark.lottie` file exists in the same directory

### Requirement: Dark assets are packaged in a loadable dotLottie format

Every dark `.lottie` asset SHALL be packaged in the same dotLottie archive format the installed player (`@lottiefiles/dotlottie-web`) can parse — a `manifest.json` whose declared animation ids resolve to `animations/<id>.json` entries inside the archive — so the animation renders instead of the guide remaining stuck on the skeleton loader. A dark asset that only exists but cannot be parsed does not satisfy this capability.

#### Scenario: Dark asset resolves its manifest animation entry

- **WHEN** a dark asset `<name>_mobile_dark.lottie` is loaded
- **THEN** its `manifest.json` declares an animation whose id resolves to an existing `animations/<id>.json` entry, matching the loadable format of its light sibling

#### Scenario: Dark asset renders rather than showing the skeleton loader

- **WHEN** a guide is opened for a trade type in Dark mode
- **THEN** the dark animation loads and displays, and the skeleton video loader is hidden once loading completes

### Requirement: Guide content shows a skeleton loader while it loads

The guide SHALL show a skeleton loader for the description content while its lazily-loaded chunk is being fetched, matching the skeleton already shown for the animation, so both content and lotties present a consistent skeleton experience until everything has loaded.

#### Scenario: Skeleton shown while the description chunk loads

- **WHEN** the guide is opened for a trade type and its description chunk has not yet resolved
- **THEN** a skeleton loader is shown in place of the description text (rather than a spinner)

#### Scenario: Skeleton replaced once the description loads

- **WHEN** the description chunk resolves
- **THEN** the skeleton loader is removed and the description content is displayed
