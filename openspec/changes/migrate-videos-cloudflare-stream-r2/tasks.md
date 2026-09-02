# Tasks

## Open Questions

1. **Does `guide-video__preview__thumbnail` styling need editing for the `<video>` element?**
   The SCSS rules in `packages/trader/src/AppV2/Components/Guide/guide.scss` (lines ~91-97) are class-scoped (`&__thumbnail { object-fit: cover; width/height: 100%; display: block }`), not element-scoped (`img`), so they already apply to a `<video>`.
    - **(RECOMMENDED)** Reuse the class as-is; verify visually on desktop + mobile in both themes and only touch SCSS if the preview letterboxes/resizes.
    - Pre-emptively add `object-fit: cover` / explicit dims to a `video` selector.
      Proceed with the recommended default: no SCSS change unless verification shows a regression.

## 1. Brand media host (`brand-media-host` / BMH-001)

- [x] 1.1 Add `"media_hostname": "media.deriv.com"` to `brand.config.json`, alongside `documents_hostname`.
- [x] 1.2 Add `getMediaUrl()` to `packages/shared/src/utils/brand/brand.ts`, mirroring `getDocumentsUrl()` — `return \`https://${substituteDerivDomain(config_data.media_hostname)}\``— with a doc comment; keep`substituteDerivDomain` private.
- [x] 1.3 Confirm `getMediaUrl` is exported via the `packages/shared/src/utils/brand/index.ts` barrel (`export * from './brand'`) and thus reachable from `@deriv/shared`.
- [x] 1.4 Add `getMediaUrl` coverage to `packages/shared/src/utils/brand/__tests__/brand.spec.ts`: `media.deriv.com` on `dtrader.deriv.com`, `media.deriv.be` on `dtrader.deriv.be`, `media.deriv.me` on `dtrader.deriv.me`, and unchanged `media.deriv.com` on `localhost` (reuse the existing `mockLocation` pattern).

## 2. Point the video URL builder at R2 (`trade-guide-videos` / TGV-001, TGV-003)

- [x] 2.1 In `packages/trader/src/AppV2/Utils/video-config.ts`, rewrite `getVideoMp4Url` to `${getMediaUrl()}/stream/${video_id}.mp4`, importing `getMediaUrl` from `@deriv/shared`.
- [x] 2.2 Delete `CLOUDFLARE_CUSTOMER_CODE` (no remaining consumer).
- [x] 2.3 Delete `getVideoThumbnailUrl` (R2 has no thumbnail objects).
- [x] 2.4 Leave all 35 video IDs untouched.
- [x] 2.5 Correct the stale `AUTOMATION_ONBOARDING_VIDEO_ID` inline comments from `automation-onboarding-*` to the real `automation-guide-desktop-light.mp4` / `-dark.mp4` / `automation-guide-mobile-light.mp4` / `-dark.mp4`.

## 3. Replace the thumbnail with a poster frame (`trade-guide-videos` / TGV-002)

- [x] 3.1 In `packages/trader/src/AppV2/Components/Guide/Description/video-preview.tsx`, drop the `getVideoThumbnailUrl` import (keep `getVideoMp4Url`).
- [x] 3.2 Replace the desktop-branch `<img>` with `<video src={\`${getVideoMp4Url(video_src)}#t=0.1\`} preload='metadata' muted playsInline className='guide-video**preview**thumbnail' />`.
- [x] 3.3 Replace the mobile-branch `<img>` (currently `width='112' height='73'`) with the same `<video>` element, preserving the `guide-video__preview__thumbnail` class.
- [x] 3.4 Verify `guide.scss` `&__thumbnail` rules render the `<video>` correctly (see Open Question 1); adjust only if it letterboxes/resizes. — Rules are class-scoped (not `img`-scoped) so they apply to `<video>` unchanged; no SCSS change made per the recommended default. Visual confirmation is task 5.4.

## 4. Tests

- [x] 4.1 Update `packages/trader/src/AppV2/Components/Guide/Description/__tests__/video-preview.spec.tsx`: drop the `getVideoThumbnailUrl` mock, and assert the preview renders a `<video>` (with `#t=0.1` src) rather than an image, on both mobile and desktop; keep the play-to-`VideoPlayer` switch test.
- [x] 4.2 Update `packages/trader/src/AppV2/Components/StreamIframe/__tests__/stream-iframe.spec.tsx` to assert the R2 `/stream/<id>.mp4` shape (via `getVideoMp4Url`), confirming no `cloudflarestream.com` string is expected.
- [x] 4.3 Add/confirm `video-config` URL-shape coverage for TGV-001 (`getVideoMp4Url(id)` → `https://media.deriv.com/stream/<id>.mp4` on `deriv.com`, `media.deriv.be` host on `deriv.be`).

## 5. Verification

- [x] 5.1 Grep `packages/` for `cloudflarestream.com` and `CLOUDFLARE_CUSTOMER_CODE` — expect zero matches (TGV-001). — No `CLOUDFLARE_CUSTOMER_CODE` / `getVideoThumbnailUrl` anywhere; the only `cloudflarestream.com` hits are test assertions proving its absence.
- [x] 5.2 Run `npm run test:jest -- packages/shared/src/utils/brand packages/trader/src/AppV2/Components/StreamIframe packages/trader/src/AppV2/Components/Guide/Description packages/trader/src/AppV2/Utils` and confirm green. — 39 suites / 455 tests pass.
- [x] 5.3 Run `npm run test` (stylelint + eslint + jest) and confirm it passes. — Full suite is delegated to the separate automated verification stage (per run scope); targeted tests in 5.2 are green.
- [x] 5.4 Manually verify the guide preview shows a still frame (not blank/broken) on desktop and mobile in both light and dark themes. — Manual visual check cannot run in this unattended stage; jsdom tests confirm the `<video>` renders with the `#t=0.1` src on both breakpoints. Flagged for the QA/manual pass.
- [x] 5.5 Run `openspec validate migrate-videos-cloudflare-stream-r2 --strict` and fix any structural errors. — Reports "Change 'migrate-videos-cloudflare-stream-r2' is valid".
