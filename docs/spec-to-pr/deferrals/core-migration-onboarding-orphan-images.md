# 2.0 MB of orphaned `migration-onboarding-*.png` files are not deleted

## What was deferred

Deleting the 26 `migration-onboarding-*.png` files in `packages/core/src/public/images/common/static_images/` — **2.0 MB**, measured at HEAD `6da4e254dd`, which is roughly **ten times** the size of the `presets-onboarding/` set (212 KB) that issue [#1274](https://github.com/deriv-com/derivatives-trader/issues/1274)'s asset bullet does name, and about three times the total the whole C8b asset bullet claims (~676 KB).

The files are `migration-onboarding-step-{1..6}[-eu]-{light,dark,mobile}.png`. Measured evidence:

- `grep -rn "migration-onboarding"` over every `.ts`, `.tsx`, `.js`, `.jsx` and `.scss` file in `packages/` returns **zero** hits.
- No `MigrationOnboarding` component exists anywhere in the repository. The only files matching `*migration*` are `packages/core/src/Services/migration-status.js` and `packages/shared/src/services/legacy-history-migration-status.ts`, neither of which references an image.
- The only reason they ship is the wholesale directory copy at `packages/core/build/config.js`: `{ from: '../src/public/images/common/static_images/', to: 'public/images/common' }`. Nothing addresses them by URL — the complete set of `getUrlBase('/public/images/...')` calls in the repository is `404.png`, `no-market-found.webp`, `derivgo_banner.png` and `trustpilot_banner.png`.

## Why

Two reasons, both about scope rather than evidence.

1. **Issue #1274's Do-NOT-touch list explicitly names "MigrationOnboarding wallet copy — intentional UX text".** That note is about copy, not images, and the component it refers to no longer exists — but deleting 2 MB of assets whose name matches a protected keep, inside a change that is already 11,500 lines of deletion across two packages, is exactly the kind of judgement that should be made deliberately rather than swept up.
2. **The issue enumerates its asset targets precisely** (`public/fonts/` 264 KB, `presets-onboarding` PNGs 212 KB, `plus.svg`, 29 orphan SVGs ~200 KB) and totals them at ~676 KB. Adding an unlisted 2.0 MB triples the asset half of the change and makes the PR's "measurably smaller vs. C0 baseline" number impossible to attribute to the work that was actually reviewed.

Keeping them costs 2 MB in the deployed static output and nothing at runtime — they are never requested.

## Follow-up required

A small, self-contained follow-up (it needs no source edit at all):

1. Re-confirm zero references: `grep -rn "migration-onboarding" packages playwright scripts --exclude-dir=node_modules` must return zero, and no `getUrlBase` call in the repository may name one of the files.
2. Confirm with the product owner for the wallets/migration surface that no unshipped or feature-flagged onboarding flow is waiting on them. `packages/core/src/Services/migration-status.js` is the only live code in that neighbourhood — check whether it is itself dead before assuming the images are.
3. Delete all 26 `packages/core/src/public/images/common/static_images/migration-onboarding-*.png` files.
4. While in that directory, resolve the sibling defect recorded in `core-missing-notification-banner-images.md` — `derivgo_banner.png` and `trustpilot_banner.png` are referenced by `packages/core/src/Stores/notification-store.js` but are **not present**, so two notifications render a broken image today.
5. Regenerate `docs/baselines/bundle-baseline.json` if the asset totals it records move.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1389
