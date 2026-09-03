## Why

The looping animated illustrations inside the trade-type guides (the "?" / "How to trade …" entry) always load their light-theme `.lottie` asset, so in Dark mode they render as bright rectangles against the dark guide panel (issue #1031). Dark-theme versions of every animation have now been supplied by the motion design team and are already committed under `packages/core/src/public/videos/*_mobile_dark.lottie`, so the app must select the light or dark asset based on the active theme.

## What Changes

- Make the trade-type guide animation (`VideoFragment`) select the `_mobile_dark.lottie` asset when the app is in Dark mode and the existing `_mobile.lottie` asset in Light mode.
- Make `VideoFragment` reactive to `ui.is_dark_mode_on` so toggling the theme while a guide is open swaps the animation live, with no reload — matching the behaviour already in place for the "How to trade …?" Cloudflare videos.
- Add a small pure helper to derive the animation filename from the video key + theme, mirroring the existing `getDescriptionVideoId(contract_type, is_dark_theme)` pattern in `video-config.ts`, so the selection is unit-testable.
- The 19 dark `.lottie` assets are already present in the working tree (from motion design) and are committed as part of this change; no code references them today.

No breaking changes. This affects only the inline guide animations, not the separate "How to trade …?" videos (which already switch correctly).

## Capabilities

### New Capabilities

- `trade-guide-animations`: Selection of the looping trade-type guide illustration (`.lottie`) asset by active theme, and live re-selection when the theme changes.

### Modified Capabilities

<!-- None. No existing spec in openspec/specs/ covers the guide animations. -->

## Impact

- **Code**
    - `packages/trader/src/AppV2/Components/Guide/Description/video-fragment.tsx` — read theme from the store, wrap in `observer()`, derive the themed `.lottie` source.
    - `packages/trader/src/AppV2/Utils/video-config.ts` — add a pure helper that returns the themed animation filename/URL.
    - Tests: `packages/trader/src/AppV2/Components/Guide/Description/__tests__/video-fragment.spec.tsx` and the `video-config` util test.
- **Assets** (already staged, committed here): the 19 `packages/core/src/public/videos/*_mobile_dark.lottie` files (accumulators, differs, even, fall, higher, lower, matches, multipliers_down, multipliers_up, no_touch, odd, over, rise, touch, turbos_down, turbos_up, under, vanillas_call, vanillas_put).
- **Stores / APIs**: none. Reuses the existing `ui.is_dark_mode_on` observable already consumed elsewhere (e.g. `onboarding-video.tsx`, `trade-chart.tsx`).
- **Scope**: mobile and desktop AppV2 trade-type guides; Dark mode behaviour only changes, Light mode unchanged.
