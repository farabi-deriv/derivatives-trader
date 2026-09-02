## Context

DTrader builds video URLs against a single Cloudflare Stream customer endpoint. Every ID lives in one file (`packages/trader/src/AppV2/Utils/video-config.ts`, 35 IDs across 5 maps) and flows through two builders: `getVideoMp4Url` (mp4 playback) and `getVideoThumbnailUrl` (preview still). All videos are moving to R2 under `media.deriv.com`, keyed `stream/<video_id>.mp4` using the **same** IDs. The `.mp4` objects exist; **no thumbnail objects exist** on R2.

The brand layer already solves multi-domain host resolution: `substituteDerivDomain` (private, in `brand.ts`) rewrites a `deriv.com` host to the current brand TLD (`.be` / `.me`), and named helpers like `getDocumentsUrl()` expose specific hosts through it. `media.deriv.be` / `media.deriv.me` resolve to the same R2 objects, so no per-brand special-casing is needed.

## Goals / Non-Goals

**Goals:**

- Serve all 35 videos from R2 via `media.deriv.<tld>` with correct multi-domain resolution.
- Keep every calling surface and the 35 IDs untouched — change only the URL builders and the preview element.
- Remove all Cloudflare Stream references (`cloudflarestream.com`, `CLOUDFLARE_CUSTOMER_CODE`) from `packages/`.

**Non-Goals:**

- Uploading or verifying the R2 objects (owned by the migration).
- The ~93 other Cloudflare assets not referenced by this repo.
- The local `.lottie` trade-type animations served from `/public/videos/`.
- A general media-asset abstraction beyond the single `getMediaUrl()` helper (YAGNI).

## Decisions

**1. Expose the media host as a named `getMediaUrl()` helper, not by exporting `substituteDerivDomain`.**
Mirrors the existing `getDocumentsUrl()` exactly (`https://${substituteDerivDomain(config_data.media_hostname)}`) and keeps the primitive private, matching the file's established pattern. Alternative — exporting `substituteDerivDomain` and building the URL in trader — was rejected: it leaks the primitive and diverges from every other host helper.

**2. Store the host in `brand.config.json` as `media_hostname`, alongside `documents_hostname`.**
Config-driven hosts are the repo convention; no hardcoded domains. Alternative (constant in `video-config.ts`) rejected — it would not go through `substituteDerivDomain` and would break `.be`/`.me`.

**3. Replace the thumbnail with a `#t=0.1` media-fragment `<video>` rather than generating posters.**
R2 has no thumbnail objects, and `preload='metadata'` alone renders a blank frame in Safari/Chrome. The `#t=0.1` fragment forces the first frame to paint. Cheapest correct option; no build-time poster pipeline (YAGNI). `getVideoThumbnailUrl` is deleted since it has no remaining consumer.

**4. Reuse the existing `guide-video__preview__thumbnail` class on the `<video>`.**
The SCSS rules are class-scoped (`&__thumbnail { object-fit: cover; width/height: 100%; display: block }`), not element-scoped (`img`), so they already apply to a `<video>`. No SCSS change is expected; the implementer verifies the preview does not letterbox/resize on desktop and mobile.

## Risks / Trade-offs

- [`preload='metadata'` still shows a blank frame on some browsers] → the `#t=0.1` fragment is the mitigation; verify visually on desktop + mobile in both themes (acceptance criterion).
- [`stream-iframe.spec.tsx` asserts via `getVideoMp4Url(...)` itself, so it stays green regardless of host] → the spec's intent (R2 shape) is covered explicitly by TGV-001's URL-shape scenarios in the `video-config` tests; no false confidence.
- [R2 objects not yet uploaded at deploy time] → out of scope for this change; deploy is gated on the migration completing (rollback = revert this change to the Stream builders).
- [A stray Cloudflare reference lingers] → guarded by the TGV-001 "zero matches" scenario / grep check in tasks.

## Migration Plan

1. Land the code change; R2 objects are populated by the separate migration.
2. Rollback: revert this change — the Stream builders and `CLOUDFLARE_CUSTOMER_CODE` return, restoring the prior endpoint.

## Open Questions

None blocking — see `tasks.md` for the one noted assumption (SCSS carry-over), resolved with a sensible default (reuse the class, verify visually).
