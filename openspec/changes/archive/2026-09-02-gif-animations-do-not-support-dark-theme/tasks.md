## 1. Assets

- [x] 1.1 Confirm the 19 dark animations are committed under `packages/core/src/public/videos/` (`accumulators_mobile_dark.lottie`, `differs_mobile_dark.lottie`, `even_mobile_dark.lottie`, `fall_mobile_dark.lottie`, `higher_mobile_dark.lottie`, `lower_mobile_dark.lottie`, `matches_mobile_dark.lottie`, `multipliers_down_mobile_dark.lottie`, `multipliers_up_mobile_dark.lottie`, `no_touch_mobile_dark.lottie`, `odd_mobile_dark.lottie`, `over_mobile_dark.lottie`, `rise_mobile_dark.lottie`, `touch_mobile_dark.lottie`, `turbos_down_mobile_dark.lottie`, `turbos_up_mobile_dark.lottie`, `under_mobile_dark.lottie`, `vanillas_call_mobile_dark.lottie`, `vanillas_put_mobile_dark.lottie`) and that each has a matching `_mobile.lottie` light sibling.
- [x] 1.2 (Revision) The dark assets as delivered by motion design were exported in a newer dotLottie layout (`a/animation.json`, manifest `version: "2"`, generator `@dotlottie/dotlottie-js@1.4.0`) that the installed player (`@lottiefiles/dotlottie-web@0.28.0`) cannot parse, so Dark mode showed the skeleton loader forever. Repackage the 19 dark assets into the same loadable v1.0 layout as their light siblings (`animations/animation_1.json` + `manifest.json` version `"1.0"`), preserving the dark animation JSON byte-for-byte.
- [x] 1.3 (Revision) Add `packages/trader/src/AppV2/Utils/__tests__/guide-animation-assets.spec.ts` asserting each dark asset is a loadable dotLottie whose manifest animation ids resolve to `animations/<id>.json` and whose format matches its light sibling.

## 2. Theme-aware source helper

- [x] 2.1 In `packages/trader/src/AppV2/Utils/video-config.ts`, add a pure helper (e.g. `getContractDescriptionAnimationSrc(video_key: string, is_dark_theme = false)`) that returns `/public/videos/<video_key.toLowerCase()>_mobile{_dark?}.lottie`, mirroring the existing `getDescriptionVideoId` light/dark pattern.
- [x] 2.2 In `packages/trader/src/AppV2/Utils/__tests__/contract-description.spec.tsx` (or the `video-config` test), add cases asserting the helper returns the `_mobile_dark.lottie` path when `is_dark_theme` is true and `_mobile.lottie` when false, for a representative key (e.g. `rise`) and a `CONTRACT_LIST` key (`Accumulators`).

## 3. Make VideoFragment theme-aware

- [x] 3.1 In `packages/trader/src/AppV2/Components/Guide/Description/video-fragment.tsx`, read `ui.is_dark_mode_on` from `useStore()` (`@deriv/stores`).
- [x] 3.2 Replace the hardcoded `${contract_type.toLowerCase()}_mobile.lottie` source with the themed helper from 2.1, and add `is_dark_mode_on` to the `getVideoSource`/`lottie_src` memo dependencies so the `DotLottieReact` `src` recomputes on theme change.
- [x] 3.3 Wrap the `VideoFragment` export in `observer()` from `mobx-react-lite` so it re-renders when `is_dark_mode_on` flips (matching the repo MobX convention).

## 4. Tests

- [x] 4.1 In `packages/trader/src/AppV2/Components/Guide/Description/__tests__/video-fragment.spec.tsx`, mock the store so `is_dark_mode_on` is controllable; assert the `DotLottieReact` `src` uses the `_mobile_dark.lottie` path in dark mode and `_mobile.lottie` in light mode.
- [x] 4.2 Add a test that re-rendering with `is_dark_mode_on` toggled updates the `src` (covers the live-switch requirement).
- [x] 4.3 Run `npm run test:jest -- packages/trader/src/AppV2/Components/Guide/Description/__tests__/video-fragment.spec.tsx packages/trader/src/AppV2/Utils/__tests__/contract-description.spec.tsx` and confirm green.

## 6. Skeleton loaders for guide content (Revision)

- [x] 6.1 (Revision) The guide description text is lazily loaded and showed a spinner (`Loading`) while its chunk resolved, whereas the animation showed a `Skeleton`. Add `packages/trader/src/AppV2/Components/Guide/Description/description-loader.tsx` — a skeleton placeholder that mirrors the description shape (text lines + animation block) — and use it as the `makeLazyLoader` fallback in `trade-description.tsx` so both content and lotties show skeleton loaders until everything loads.
- [x] 6.2 (Revision) Add `guide.scss` styles for `.description-loader` and cover the new component in `packages/trader/src/AppV2/Components/Guide/Description/__tests__/description-loader.spec.tsx`; extend `trade-description.spec.tsx` to assert the skeleton fallback renders while the chunk loads and is replaced once it resolves.

## 5. Verify

- [x] 5.1 Manual check per issue #1031: open a trade-type guide (e.g. Rise/Fall) in Dark mode → animation uses the dark asset; toggle to Light mode with the guide open → animation swaps live to the light asset, and back. _(Deferred to manual QA — requires a running browser, not performed in the automated run. The light/dark selection and live-swap behaviour is covered by the automated tests in `video-fragment.spec.tsx`.)_
- [x] 5.2 Spot-check a two-sided trade type (e.g. Higher/Lower or Turbos up/down) so both animation keys resolve to their dark assets. _(Deferred to manual QA — requires a running browser. Two-sided keys resolve via the same pure `getContractDescriptionAnimationSrc` helper, covered by `video-config.spec.ts`.)_
- [x] 5.3 Run `npm run test:eslint-all` (or the trader-scoped lint) on the changed files.
