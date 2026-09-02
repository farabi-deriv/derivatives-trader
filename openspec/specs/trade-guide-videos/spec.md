# trade-guide-videos Specification

## Purpose
TBD - created by archiving change migrate-videos-cloudflare-stream-r2. Update Purpose after archive.
## Requirements
### Requirement: [TGV-001] Video mp4 URLs are built against the R2 media host

`getVideoMp4Url(video_id)` in `packages/trader/src/AppV2/Utils/video-config.ts` SHALL build the URL as `${getMediaUrl()}/stream/${video_id}.mp4`, using the brand-aware media host from [BMH-001]. The 35 existing video IDs SHALL remain unchanged — they are the R2 object keys. No occurrence of `cloudflarestream.com` or `CLOUDFLARE_CUSTOMER_CODE` SHALL remain anywhere in `packages/`.

#### Scenario: mp4 URL points at the R2 stream path on deriv.com

- **WHEN** `getVideoMp4Url('26d1401d2e3f6ae16913a21ec0579fc1')` is called on a `deriv.com` hostname
- **THEN** it returns `https://media.deriv.com/stream/26d1401d2e3f6ae16913a21ec0579fc1.mp4`

#### Scenario: mp4 URL follows the brand TLD

- **WHEN** `getVideoMp4Url(<id>)` is called on a `deriv.be` hostname
- **THEN** the returned URL host is `media.deriv.be` and the path is `/stream/<id>.mp4`

#### Scenario: No Cloudflare Stream references remain

- **WHEN** the codebase under `packages/` is searched for `cloudflarestream.com` or `CLOUDFLARE_CUSTOMER_CODE`
- **THEN** there are zero matches

### Requirement: [TGV-002] Guide preview renders a still frame from the R2 mp4

The guide video preview (`packages/trader/src/AppV2/Components/Guide/Description/video-preview.tsx`) SHALL render its paused first frame from a `<video>` element sourced at `${getVideoMp4Url(video_src)}#t=0.1` with `preload='metadata'`, `muted`, and `playsInline`, in **both** the desktop and mobile branches. The prior Cloudflare Stream `<img>` thumbnail and the `getVideoThumbnailUrl` helper SHALL be removed, since R2 holds no thumbnail objects. The `guide-video__preview__thumbnail` styling (object-fit and dimensions) SHALL apply to the `<video>` element so the preview neither letterboxes nor resizes.

#### Scenario: Desktop preview shows a video still frame, not an image

- **WHEN** the guide description preview renders on desktop before playback starts
- **THEN** the preview element is a `<video>` whose `src` ends with `#t=0.1` and there is no `<img>` thumbnail

#### Scenario: Mobile preview shows a video still frame, not an image

- **WHEN** the guide description preview renders on mobile
- **THEN** the preview element is a `<video>` whose `src` ends with `#t=0.1` and there is no `<img>` thumbnail

#### Scenario: Play interaction is preserved

- **WHEN** the user activates the desktop preview (click or Enter)
- **THEN** the `VideoPlayer` replaces the still-frame preview, as before this change

### Requirement: [TGV-003] All video surfaces play from R2 across themes and devices

Every surface that resolves a video ID — the trade-type guide/description modal (11 types × light/dark), trade-type selection, both onboarding guides, the accumulator manual (desktop + mobile), accumulator stats, and automation onboarding (desktop + mobile) — SHALL request its video from `https://media.deriv.<tld>/stream/<id>.mp4` via `getVideoMp4Url`. The stale inline comments on `AUTOMATION_ONBOARDING_VIDEO_ID` SHALL be corrected to the real asset names (`automation-guide-*`).

#### Scenario: Accumulator stats stream uses the R2 mp4

- **WHEN** `StreamIframe` renders with `UNIFIED_MODE_VIDEO_ID.accumulator_stats`
- **THEN** the `<video>` `src` equals `getVideoMp4Url(UNIFIED_MODE_VIDEO_ID.accumulator_stats)`, i.e. an R2 `/stream/<id>.mp4` URL

#### Scenario: Automation onboarding comments match the real assets

- **WHEN** `video-config.ts` is read after this change
- **THEN** the `AUTOMATION_ONBOARDING_VIDEO_ID` inline comments name `automation-guide-desktop-light.mp4`, `automation-guide-desktop-dark.mp4`, `automation-guide-mobile-light.mp4`, and `automation-guide-mobile-dark.mp4`

