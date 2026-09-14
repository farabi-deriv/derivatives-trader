# Two notification banners point at images that do not exist in the repository

## What was deferred

Fixing a pre-existing defect found while auditing `packages/core`'s static assets for issue [#1274](https://github.com/deriv-com/derivatives-trader/issues/1274), and left in place because repairing it is not a dead-code removal.

`packages/core/src/Stores/notification-store.js` builds two notifications with an `img_src` that resolves to a file the repository does not contain:

```js
// packages/core/src/Stores/notification-store.js:368
img_src: getUrlBase('/public/images/common/trustpilot_banner.png'),
// packages/core/src/Stores/notification-store.js:436
img_src: getUrlBase('/public/images/common/derivgo_banner.png'),
```

Measured at HEAD `6da4e254dd`: `find packages/core/src/public -name '*banner*'` returns **nothing**. `packages/core/src/public/images/common/` contains exactly `logos/`, `plus.svg` and `static_images/`, and `static_images/` holds only `404.png`, `no-market-found.webp`, `presets-onboarding/` and 26 `migration-onboarding-*.png` files. Neither banner is anywhere in the tree, so neither is copied by `packages/core/build/config.js` and neither exists at the deployed URL.

Whenever either notification is raised, the user sees a broken image where the banner should be. Nothing errors and nothing is logged — an `<img>` with a 404 `src` fails silently.

## Why

This is a **defect to repair or a feature to remove**, not dead code to delete, and it falls outside issue #1274's scope in both directions:

- Deleting the two notification definitions would remove user-facing product surface (a Trustpilot prompt and a Deriv GO promo), which a cleanup change has no mandate to decide.
- Adding the two missing PNGs is an asset addition inside a change whose entire purpose is deletion, and it needs the real artwork from whoever owns those campaigns.

Issue #1274 therefore leaves `notification-store.js` untouched and records the finding rather than silently choosing one of the two fixes.

## Follow-up required

1. Decide, with the owner of the notification surface, whether the Trustpilot and Deriv GO banner notifications are still wanted.
2. **If they are wanted:** add `trustpilot_banner.png` and `derivgo_banner.png` to `packages/core/src/public/images/common/static_images/` (the directory `packages/core/build/config.js` copies to `public/images/common`, which is where `getUrlBase('/public/images/common/...')` resolves), and confirm both render.
3. **If they are not:** delete the two notification definitions in `packages/core/src/Stores/notification-store.js` together with any `client-notifications.js` key, translation string and CSS rule that exists only to serve them, and any spec that asserts them.
4. Either way, add a guard so this cannot recur silently: a small test that walks every `getUrlBase('/public/...')` string literal in `packages/*/src` and asserts the referenced file exists under `packages/core/src/public/`. The complete current set is `404.png`, `no-market-found.webp`, `derivgo_banner.png`, `trustpilot_banner.png` and `videos/fire.lottie` — the first two and the lottie resolve; the two banners do not. A test like `packages/trader/src/AppV2/Utils/__tests__/guide-animation-assets.spec.ts`, which already resolves `core/src/public/videos` from `packages/trader`, is the pattern to follow.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1390
