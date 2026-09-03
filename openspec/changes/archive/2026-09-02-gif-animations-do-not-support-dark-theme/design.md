## Context

The trade-type guide (`AppV2/Components/Guide`) renders each trade type's description via `getContractDescription` (`AppV2/Utils/contract-description-utils.tsx`). Content entries of `type: 'video'` render `<VideoFragment contract_type={text} />`, where `text` is the animation key (`rise`, `fall`, `higher`, `vanillas_call`, `Accumulators`, …).

`VideoFragment` (`AppV2/Components/Guide/Description/video-fragment.tsx`) builds its `.lottie` source with:

```ts
getUrlBase(`/public/videos/${contract_type.toLowerCase()}_mobile.${extension}`);
```

This always points at the light asset. The component is a plain function component (not an `observer`) and does not read the theme, so it can neither pick the dark asset nor react to a theme toggle.

The pattern for theme-aware media already exists next door: `getDescriptionVideoId(contract_type, is_dark_theme)` in `AppV2/Utils/video-config.ts` returns a light/dark Cloudflare id, and `OnboardingVideo` reads `ui.is_dark_mode_on` from `useStore()`. The 19 dark `.lottie` assets have already been added by motion design and sit beside their light siblings in `packages/core/src/public/videos/`.

## Goals / Non-Goals

**Goals:**

- Guide animations render the dark asset in Dark mode and the light asset in Light mode.
- Switching theme while a guide is open swaps the animation live, no reload.
- Keep the change minimal, testable, and consistent with the existing `video-config.ts` helper pattern.

**Non-Goals:**

- Changing the "How to trade …?" Cloudflare videos (`VideoPreview`), which already switch by theme.
- Introducing desktop-specific assets — the code already reuses the `_mobile` assets for both desktop and mobile; this change only adds the `_dark` dimension.
- Any change to how the guide decides which trade types show an animation.

## Decisions

**Decision: Derive the themed filename via a small pure helper in `video-config.ts`.**
Add `getContractDescriptionAnimationSrc(video_key: string, is_dark_theme: boolean)` (or an equivalent named helper) that returns the `/public/videos/<key>_mobile[_dark].lottie` path suffix, mirroring `getDescriptionVideoId`. Rationale: keeps the light/dark suffix rule in one unit-testable place next to the sibling video helpers, rather than inline string interpolation in the component.

- Alternative considered: inline the `_dark` suffix directly in `video-fragment.tsx`. Rejected — harder to unit test and diverges from the established `video-config.ts` convention.

**Decision: Read `ui.is_dark_mode_on` via `useStore()` and wrap `VideoFragment` in `observer()`.**
Per the CLAUDE.md MobX convention, a component that reads an observable must be wrapped in `observer()` to re-render on change. `is_dark_mode_on` is the same observable used by `OnboardingVideo` and `trade-chart`. Rationale: this is what makes the "switch theme while open updates live" requirement work — the memoized `lottie_src` recomputes when `is_dark_mode_on` flips.

- Alternative considered: read theme once on mount. Rejected — would not update on toggle, failing the issue's expected result.

**Decision: Recompute `lottie_src` from `(contract_type, is_dark_mode_on)`.**
Add `is_dark_mode_on` to the `getVideoSource`/`lottie_src` `useMemo`/`useCallback` dependencies so `DotLottieReact` receives a new `src` and reloads the correct asset when the theme changes. `is_loading` naturally resets on the new `load` event; the brief `Skeleton` during the swap is acceptable.

## Risks / Trade-offs

- **A dark asset is missing for some key → broken/blank animation in Dark mode.** → Mitigation: the spec requires a dark sibling for all 19 keys; a task verifies the committed set matches the referenced keys 1:1.
- **Naming mismatch between the video `text` key and the file basename.** → Mitigation: verified the `type: 'video'` `text` values (`rise`, `fall`, `higher`, `lower`, `even`, `odd`, `over`, `under`, `matches`, `differs`, `touch`, `no_touch`, `turbos_up/down`, `multipliers_up/down`, `vanillas_call/put`, `Accumulators`) lower-case exactly onto the existing `_mobile.lottie` basenames.
- **Extra re-render from `observer()`.** → Negligible; the component is only mounted inside an open guide.

## Migration Plan

Pure front-end change; no data migration or feature flag. Ship the code change together with the already-committed dark `.lottie` assets. Rollback is a straightforward revert of the code change (the assets are inert without it).

## Open Questions

None that change the implementation. The light/dark asset naming and store observable are all established patterns in this repo.
