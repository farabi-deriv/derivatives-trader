## ADDED Requirements

### Requirement: [ASM-001] Accumulators Stats animation follows the active theme

The Accumulators Stats explainer animation (rendered by `AccumulatorStatsDescription` via `StreamIframe`) SHALL select its Cloudflare Stream source based on the active app theme: the dark asset when `ui.is_dark_mode_on` is true, and the light asset when it is false. The light/dark id pair SHALL be resolved through a pure helper (`getAccumulatorStatsVideoId(is_dark_theme)`) that mirrors the existing `getDescriptionVideoId` selection, so the rule lives in one unit-testable place in `video-config.ts`.

#### Scenario: Dark mode loads the dark Stats animation

- **WHEN** the Accumulators Stats info sheet is opened while `ui.is_dark_mode_on` is true
- **THEN** the `StreamIframe` source resolves to the dark Stats video id (not the light id)

#### Scenario: Light mode loads the light Stats animation

- **WHEN** the Accumulators Stats info sheet is opened while `ui.is_dark_mode_on` is false
- **THEN** the `StreamIframe` source resolves to the light Stats video id, unchanged from today's behaviour

### Requirement: [ASM-002] Theme switch updates an open Stats animation live

`AccumulatorStatsDescription` SHALL react to changes in `ui.is_dark_mode_on` (be wrapped in `observer()` and read the observable) so that toggling the theme while the Stats info sheet is open swaps the animation to the matching light/dark asset without requiring the sheet to be reopened or the page reloaded.

#### Scenario: Toggling to dark mode while the Stats sheet is open

- **WHEN** the Stats sheet is open showing the light animation and the user switches the app to Dark mode
- **THEN** the `StreamIframe` source updates to the dark Stats id without a manual reopen or reload

#### Scenario: Toggling back to light mode while the Stats sheet is open

- **WHEN** the Stats sheet is open showing the dark animation and the user switches the app back to Light mode
- **THEN** the `StreamIframe` source updates back to the light Stats id without a manual reopen or reload

### Requirement: [ASM-003] A dark asset exists for the Stats animation

The Accumulators Stats animation SHALL have a dark-theme Cloudflare Stream / R2 asset registered alongside its light asset in `UNIFIED_MODE_VIDEO_ID.accumulator_stats`, so the dark selection resolves to a real, playable video rather than an empty or missing source.

#### Scenario: Dark id is registered and non-empty

- **WHEN** `getAccumulatorStatsVideoId(true)` is called
- **THEN** it returns a non-empty Cloudflare Stream id distinct from the light id, resolvable by `getVideoMp4Url` to a `/stream/<id>.mp4` URL on the brand media host
