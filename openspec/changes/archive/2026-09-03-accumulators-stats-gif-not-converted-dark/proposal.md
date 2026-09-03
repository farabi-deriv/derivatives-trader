## Why

The Accumulators **Stats** explainer animation (the looping "GIF" shown in the Stats info action sheet) always loads a single theme-agnostic Cloudflare Stream asset, so in Dark mode it renders as a bright light-theme rectangle against the dark UI (issue #1213). Every other Accumulators video — the contract-type description videos and the manual videos — was already given a dark variant (#917, #772); this Stats asset was missed. It should follow the active theme like the rest.

## What Changes

- Give the Accumulators Stats video a dark variant: replace the single `UNIFIED_MODE_VIDEO_ID.accumulator_stats` string with a `{ light, dark }` pair, matching the existing `DESCRIPTION_VIDEO_ID` / `ACCUMULATOR_MANUAL_VIDEO_ID` shape in `video-config.ts`, and add a pure `getAccumulatorStatsVideoId(is_dark_theme)` helper mirroring `getDescriptionVideoId`.
- Make `AccumulatorStatsDescription` read `ui.is_dark_mode_on` from `useStore()`, wrap it in `observer()`, and pass the themed id to `StreamIframe`, so the Stats animation shows the dark asset in Dark mode and the light asset in Light mode — and swaps live when the theme is toggled while the sheet is open.
- Update the affected tests (`stream-iframe.spec.tsx`, which currently treats `accumulator_stats` as a string) and add coverage for the helper and the themed selection.

No breaking changes to user-facing behaviour beyond the fix; Light mode is unchanged. The dark Cloudflare Stream asset for the Stats animation must be supplied by the motion/design team (same delivery channel as #917/#772) and its id plugged into the config — see Open Questions in `tasks.md`.

## Capabilities

### New Capabilities

- `accumulator-stats-media`: Theme-aware selection of the Accumulators Stats explainer animation asset, and live re-selection when the app theme changes.

### Modified Capabilities

<!-- None. No existing spec in openspec/specs/ covers the Accumulators Stats media. The sibling `trade-guide-animations` capability (change gif-animations-do-not-support-dark-theme) covers the `.lottie` guide animations, a separate asset set and component. -->

## Impact

- **Code**
    - `packages/trader/src/AppV2/Utils/video-config.ts` — change `UNIFIED_MODE_VIDEO_ID.accumulator_stats` to a `{ light, dark }` variant and add `getAccumulatorStatsVideoId(is_dark_theme)`.
    - `packages/trader/src/AppV2/Components/AccumulatorStats/accumulator-stats-description.tsx` — read `ui.is_dark_mode_on`, wrap in `observer()`, pass the themed id to `StreamIframe`.
    - Tests: `packages/trader/src/AppV2/Components/StreamIframe/__tests__/stream-iframe.spec.tsx` (uses `accumulator_stats` as a string today), plus new/extended tests for `video-config` and `accumulator-stats-description`.
- **Assets**: one new dark Cloudflare Stream / R2 video for the Stats animation (`accumulators_stats_dark.mp4`), served from the existing brand media host via `getVideoMp4Url`. Provided by motion/design; only its Stream id is added to the repo.
- **Stores / APIs**: none. Reuses the existing `ui.is_dark_mode_on` observable already consumed by `onboarding-video.tsx`, `trade-chart.tsx`, etc.
- **Scope**: AppV2 Accumulators Stats info sheet only. Dark-mode rendering changes; Light mode unchanged. Desktop and mobile share the same component.
