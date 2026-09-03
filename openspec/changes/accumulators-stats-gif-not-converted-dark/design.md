## Context

The Accumulators Stats info sheet (`AppV2/Components/AccumulatorStats/accumulator-stats-description.tsx`) renders its looping explainer "GIF" via:

```tsx
<StreamIframe src={UNIFIED_MODE_VIDEO_ID.accumulator_stats} title='accumulator_stats' />
```

`StreamIframe` turns that id into a URL with `getVideoMp4Url(src)` → `${getMediaUrl()}/stream/<id>.mp4`. `UNIFIED_MODE_VIDEO_ID` in `AppV2/Utils/video-config.ts` is explicitly the "won't have dark and light theme" bucket:

```ts
export const UNIFIED_MODE_VIDEO_ID = {
    accumulator_stats: '26d1401d2e3f6ae16913a21ec0579fc1',
};
```

Because there is a single id, the sheet always plays the light asset — in Dark mode it shows a bright rectangle (issue #1213). `AccumulatorStatsDescription` is a plain function component that does not read the theme.

The theme-aware pattern already exists next door and is the model to follow:

- `DESCRIPTION_VIDEO_ID`, `ACCUMULATOR_MANUAL_VIDEO_ID`, `ONBOARDING_VIDEO_ID` are all `{ light, dark }` maps typed `TDtraderVideoUrl`.
- Helpers `getDescriptionVideoId` / `getAccumulatorManualVideoId` / `getOnboardingVideoId` select by `is_dark_theme`.
- Consumers such as `onboarding-video.tsx` read `ui.is_dark_mode_on` from `useStore()` and are wrapped in `observer()`.

The prior dark-mode work for Accumulators videos (#917, #772) supplied dark Cloudflare Stream assets for the description and manual videos; the Stats asset was simply not included.

## Goals / Non-Goals

**Goals:**

- The Stats animation renders the dark asset in Dark mode and the light asset in Light mode.
- Toggling the theme while the Stats sheet is open swaps the animation live, no reopen/reload.
- Keep the change minimal and consistent with the existing `video-config.ts` helper convention.

**Non-Goals:**

- No change to any other video (description, manual, onboarding) — those already switch by theme.
- No change to `StreamIframe` internals (it already just renders whatever id it is handed).
- No new player, container, or styling changes; the 16:9 wrapper and skeleton behaviour stay as-is.

## Decisions

**Decision: Convert `UNIFIED_MODE_VIDEO_ID.accumulator_stats` to a `{ light, dark }` variant and add `getAccumulatorStatsVideoId(is_dark_theme)`.**
This matches the `TDtraderVideoUrl` shape and the `getDescriptionVideoId` helper used by every other themed video, keeping the light/dark selection in one unit-testable place.

- Alternative considered: inline the id choice in the component. Rejected — diverges from the established `video-config.ts` convention and is harder to unit test.
- Alternative considered: keep a separate flat "unified" map and add a parallel dark map. Rejected — an entry that now has two theme variants belongs in the same `{ light, dark }` shape as its siblings; the misleading `UNIFIED_MODE` name is retained only to avoid a wider export rename, with its comment updated.

**Decision: Read `ui.is_dark_mode_on` via `useStore()` and wrap `AccumulatorStatsDescription` in `observer()`.**
Per the repo's MobX convention (CLAUDE.md), a component reading an observable must be an `observer()` to re-render on change. This is exactly what `onboarding-video.tsx` does. It is what makes the live theme-swap requirement (ASM-002) work: the `src` passed to `StreamIframe` recomputes when `is_dark_mode_on` flips, `StreamIframe`'s `getVideoMp4Url(src)` yields a new URL, and the `<video>` reloads the correct asset.

- Alternative considered: read the theme once on mount. Rejected — would not update on toggle, failing the issue's expected result.

**Decision: The dark id is data, supplied by motion/design.**
The code plumbing is the change; the actual dark Cloudflare Stream id is an external input, delivered the same way the #917/#772 dark assets were. The implementer plugs the delivered id into `UNIFIED_MODE_VIDEO_ID.accumulator_stats.dark`. See Open Questions in `tasks.md`.

## Risks / Trade-offs

- **Dark id not yet delivered at implement time** → the plumbing, helper, and tests can all land first with the light id duplicated as a placeholder is _not_ acceptable for merge (Dark mode would still look light); merge is gated on the real dark id. Tracked as the single Open Question in `tasks.md`. Rollback is a trivial revert.
- **Shape change breaks existing string usage** → `stream-iframe.spec.tsx` references `UNIFIED_MODE_VIDEO_ID.accumulator_stats` as a string; it must be updated to `.light` (or to use the new helper). Covered by an explicit task.
- **Extra re-render from `observer()`** → negligible; the component only mounts inside the open Stats sheet.

## Migration Plan

Pure front-end change; no data migration or feature flag. Land the code change together with the dark Stream asset id once delivered. Rollback = revert the code change (the asset id is inert without it).

## Open Questions

See `tasks.md` `## Open Questions` — the only outstanding item is the source of the dark Stats Cloudflare Stream id. The recommended path (obtain it from motion/design, same channel as #917/#772) is assumed for the rest of the plan.
