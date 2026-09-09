# Playwright featureFlags util is orphaned by the FeatureFlagsStore removal

**What was deferred:** Deleting `playwright/e2e-tests-core/utils/featureFlags.ts` (253 LOC, exporting `enableFeatureFlags` / `disableFeatureFlags` / `getFeatureFlags`) and the five documentation sites that describe it. The util drives the `FeatureFlagsStore` `localStorage` key that change `issue-1272-shared-sweep` deletes (DCR-013), so it is inert from that change's merge onwards. It has **zero** consumers in the e2e suite — its only non-doc reference is the wildcard re-export at `playwright/e2e-tests-core/utils/index.ts:15`. (`getClientIdFromFeatureFlag` in `playwright/e2e-tests-core/scripts/v2_poi_poa.js:146` is an unrelated local function and must not be touched.)

**Why:** The `playwright/` subtree has its own conventions and its own `CLAUDE.md`, and change `issue-1272-shared-sweep` does not otherwise enter it. Removing the util correctly means editing five documentation files as well as the source, which turns a scoped deletion sweep into a docs change in a separately-owned area. Issue #1272 itself files this under "leftover to REPORT, not delete".

**Follow-up required:**

1. Confirm the util is still consumer-free (`grep -rn "enableFeatureFlags\|disableFeatureFlags\|getFeatureFlags" playwright`), then delete `playwright/e2e-tests-core/utils/featureFlags.ts` and the `export * from './featureFlags';` line at `playwright/e2e-tests-core/utils/index.ts:15`, plus the util's mention in that file's header comment at line 8.
2. Remove the now-stale documentation references:
    - `playwright/flows/_conventions/utils-reference.md` — the table row at line 22, the section at lines 169-182, and the quick-reference row at line 218.
    - `playwright/e2e-tests-core/skills/playwright/resources/01-project-structure.md` — lines 22, 119 and 234.
    - `playwright/e2e-tests-core/skills/playwright/resources/10-feature-flags.md` — the whole file, which documents nothing that still exists.
    - `playwright/CLAUDE.md` line 375 and `playwright/e2e-tests-core/README.md`.
3. Note that the e2e suite cannot be run in-PR (no `pull_request` trigger; staging plus encrypted secrets), so verification is limited to the grep above plus a TypeScript check of the `playwright/` project.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1366
