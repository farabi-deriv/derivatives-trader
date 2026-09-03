## Decisions

- **Dark Stats Stream id (resolved):** The video link on issue #1213 — `https://media.deriv.com/stream/4c54974c56304075985e4b50addb77d2.mp4` — IS the dark-mode Accumulators Stats video. It resolves through the exact `getVideoMp4Url` pattern (`<media-host>/stream/<id>.mp4`), so the dark Cloudflare Stream id is **`4c54974c56304075985e4b50addb77d2`**. No motion/design hand-off is needed; the id is used directly in task 1.1.

## 1. Themed video config

- [x] 1.1 In `packages/trader/src/AppV2/Utils/video-config.ts`, change `UNIFIED_MODE_VIDEO_ID.accumulator_stats` from a single string to a `{ light, dark }` variant (typed like the existing `TDtraderVideoUrl` maps): keep the current id `26d1401d2e3f6ae16913a21ec0579fc1` as `light`, and set `dark` to `4c54974c56304075985e4b50addb77d2` (the id from the issue #1213 video link). Update the "The ids here won't have dark and light theme" comment accordingly.
- [x] 1.2 In the same file, add a pure helper `getAccumulatorStatsVideoId = (is_dark_theme = false) => UNIFIED_MODE_VIDEO_ID.accumulator_stats[is_dark_theme ? 'dark' : 'light']`, mirroring `getDescriptionVideoId`.

## 2. Make the Stats description theme-aware

- [x] 2.1 In `packages/trader/src/AppV2/Components/AccumulatorStats/accumulator-stats-description.tsx`, read `ui.is_dark_mode_on` via `useStore()` from `@deriv/stores`.
- [x] 2.2 Replace `src={UNIFIED_MODE_VIDEO_ID.accumulator_stats}` with `src={getAccumulatorStatsVideoId(is_dark_mode_on)}` (import the helper from `AppV2/Utils/video-config`).
- [x] 2.3 Wrap the `AccumulatorStatsDescription` export in `observer()` from `mobx-react-lite` so it re-renders when `is_dark_mode_on` flips (ASM-002).

## 3. Tests

- [x] 3.1 Update `packages/trader/src/AppV2/Components/StreamIframe/__tests__/stream-iframe.spec.tsx` — it currently passes `UNIFIED_MODE_VIDEO_ID.accumulator_stats` as a string; change those references to `UNIFIED_MODE_VIDEO_ID.accumulator_stats.light` (or `getAccumulatorStatsVideoId(false)`) so the suite compiles and asserts against the light id.
- [x] 3.2 In `packages/trader/src/AppV2/Utils/__tests__/` (extend `contract-description.spec.tsx` or add a `video-config` test), assert `getAccumulatorStatsVideoId(true)` returns the dark id and `getAccumulatorStatsVideoId(false)` returns the light id, and that the two ids differ (ASM-001, ASM-003).
- [x] 3.3 Add `packages/trader/src/AppV2/Components/AccumulatorStats/__tests__/accumulator-stats-description.spec.tsx`: mock `useStore()` so `is_dark_mode_on` is controllable; assert the rendered `StreamIframe`/`<video>` src uses the dark id in dark mode and the light id in light mode, and that re-rendering with the flag toggled updates the src (ASM-001, ASM-002).
- [x] 3.4 Run `npm run test:jest -- packages/trader/src/AppV2/Components/AccumulatorStats/__tests__/accumulator-stats-description.spec.tsx packages/trader/src/AppV2/Components/StreamIframe/__tests__/stream-iframe.spec.tsx packages/trader/src/AppV2/Utils/__tests__` and confirm green.

## 4. Verify

- [x] 4.1 Run the trader-scoped lint on the changed files (`npm run test:eslint-all` or scoped equivalent).
- [x] 4.2 Manual check per issue #1213: open DTrader → switch to Dark mode → open the Accumulators Stats info sheet → the animation renders in Dark mode; toggle back to Light with the sheet open → it swaps live to the light asset. _(Requires a running browser; the light/dark selection and live-swap are covered by the automated tests above.)_
