## Why

All Deriv videos are being migrated off Cloudflare Stream onto R2, served from `media.deriv.com`. DTrader currently builds every video URL against the Cloudflare Stream customer endpoint (`customer-<code>.cloudflarestream.com/...`), so once the Stream account is retired every guide, onboarding, and manual video in the app breaks. The R2 object keys are `stream/<video_id>.mp4` using the **same** 35 video IDs already in the repo, so only the URL builders — not the IDs — need to change.

## What Changes

- Add a `media_hostname` (`media.deriv.com`) to `brand.config.json` and expose a `getMediaUrl()` helper in `@deriv/shared` that routes the hostname through the existing `substituteDerivDomain`, so it resolves to `media.deriv.be` / `media.deriv.me` on those brand domains.
- Repoint `getVideoMp4Url` in `packages/trader/src/AppV2/Utils/video-config.ts` to `${getMediaUrl()}/stream/${video_id}.mp4`.
- **BREAKING (internal)**: Remove `CLOUDFLARE_CUSTOMER_CODE` and `getVideoThumbnailUrl` from `video-config.ts` — R2 holds only `.mp4` objects, so the Stream thumbnail endpoint has no equivalent.
- Replace the `<img>` thumbnail in `video-preview.tsx` (both desktop and mobile branches) with a paused first-frame `<video src=...#t=0.1 preload='metadata' muted playsInline>` off the R2 mp4.
- Correct the stale inline comments on `AUTOMATION_ONBOARDING_VIDEO_ID` (they name `automation-onboarding-*` files; the real assets are `automation-guide-*`).
- Update tests to assert the R2 URL shape and the `<video>` preview element, and add `getMediaUrl()` coverage.
- The 35 video IDs stay exactly as they are.

## Capabilities

### New Capabilities

- `brand-media-host`: A brand-aware media host resolver (`getMediaUrl()`) that returns `https://media.deriv.com` and substitutes the current brand TLD (`.be` / `.me`) via `substituteDerivDomain`, mirroring `getDocumentsUrl()`.
- `trade-guide-videos`: How the AppV2 trade-type guide, onboarding, accumulator manual, automation onboarding, and accumulator-stats surfaces resolve their video URLs and render the guide preview still-frame from R2.

### Modified Capabilities

_None — no existing spec in `openspec/specs/` owns video URL construction or the media host._

## Impact

- **Config**: `brand.config.json` (add `media_hostname`).
- **Code**: `packages/shared/src/utils/brand/brand.ts` (new `getMediaUrl()`, auto-exported via the `brand/index.ts` barrel and `@deriv/shared`); `packages/trader/src/AppV2/Utils/video-config.ts` (rewrite `getVideoMp4Url`, delete `CLOUDFLARE_CUSTOMER_CODE` + `getVideoThumbnailUrl`); `packages/trader/src/AppV2/Components/Guide/Description/video-preview.tsx` (thumbnail → `<video>`).
- **Styles**: `packages/trader/src/AppV2/Components/Guide/guide.scss` — the `&__thumbnail` rules are class-based (not element-scoped), so they already apply to a `<video>`; verify `object-fit`/dimensions still hold.
- **Tests**: `video-preview.spec.tsx`, `stream-iframe.spec.tsx`, `brand.spec.ts`.
- **Consumers unchanged**: all 35 IDs and every calling surface (`StreamIframe`, guide/description modal, onboarding, accumulator manual/stats, automation onboarding) keep their existing call signatures.
- **Out of scope**: the ~93 other Cloudflare assets not referenced by this repo; the local `.lottie` animations served from `/public/videos/`; uploading/verifying the R2 objects themselves.
