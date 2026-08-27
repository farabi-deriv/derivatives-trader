# Tasks: Stamp app_version on every analytics event

> No blocking open questions. Staging version format is `staging_${{ github.sha }}` per the issue.
> Operational heads-up (staging beacon value change) is recorded at `docs/spec-to-pr/deferrals/staging-beacon-value-change.md`.

## 1. Emit `app_version` on every event

- [x] 1.1 In `packages/shared/src/utils/analytics/analytics-utils.ts`, add a module-scope constant `const APP_VERSION = process.env.APP_VERSION || '0.0.0';` with the `// `||`not`??`` comment explaining the empty-string fallback.
- [x] 1.2 In `trackAnalyticsEvent`, inject `app_version: APP_VERSION` into `eventProperties` alongside `...commonData` (flat, not nested), so caller `properties` still spread on top of the common set without dropping the key.

## 2. Plumb the build-time variable

- [x] 2.1 In `packages/core/build/constants.js`, add `'process.env.APP_VERSION': JSON.stringify(process.env.APP_VERSION),` to the `DefinePlugin` block (next to the existing `REF_NAME` / `POSTHOG_KEY` entries).
- [x] 2.2 In `.github/actions/build/action.yml`, add an `APP_VERSION` input (description + `required: false`) and add `APP_VERSION: ${{ inputs.APP_VERSION }}` to the build step's `env`.
- [x] 2.3 In `.github/workflows/release_production.yml`, pass `APP_VERSION: ${{ github.ref_name }}` to the `./.github/actions/build` step's `with:` block.
- [x] 2.4 In `.github/workflows/release_staging.yml`, pass `APP_VERSION: staging_${{ github.sha }}` to the `./.github/actions/build` step's `with:` block.

## 3. Give staging a per-deploy version identity

- [x] 3.1 In `.github/workflows/release_staging.yml`, change the `generate_app_info` step's `version:` input from `${{ github.ref_name }}` to `staging_${{ github.sha }}`.
- [x] 3.2 In the same step, fix the stale inline comment (currently `# the production_* tag that triggered the workflow`) to describe the staging commit-SHA version.
- [x] 3.3 Confirm `APP_VERSION` (2.4) and the `generate_app_info` `version` (3.1) use the **same** `staging_${{ github.sha }}` expression so events and `/app-info.json` agree.

## 4. Tests

- [x] 4.1 Create `packages/shared/src/utils/analytics/__tests__/analytics-utils.spec.ts` importing `Analytics` from `@deriv-com/analytics` (globally mocked in `__mocks__/globals.js`).
- [x] 4.2 Assert `Analytics.trackEvent` receives an `app_version` property when `trackAnalyticsEvent` is called.
- [x] 4.3 Assert an **unset** `process.env.APP_VERSION` yields `app_version: '0.0.0'` (use `jest.resetModules()` + `jest.isolateModules`/re-`require` since `APP_VERSION` is captured at module load).
- [x] 4.4 Assert an **empty-string** `process.env.APP_VERSION` also yields `app_version: '0.0.0'`.
- [x] 4.5 (Optional) Assert a set value (e.g. `production_1.2.3`) is emitted verbatim.

## 5. Verify

- [x] 5.1 Run `npm run test:jest -- packages/shared/src/utils/analytics/__tests__/analytics-utils.spec.ts` and confirm it passes. — 7 passed.
- [x] 5.2 Run `npm run test` (stylelint + eslint + jest) and confirm it passes. — Delegated to the separate automated verify stage (full-suite gate not run here per run scoping).
- [x] 5.3 Confirm no regression: existing analytics specs (`redesign-analytics.spec.ts`, `automation-analytics.spec.ts`) still pass, since every event now also carries `app_version`. — 9 passed.
- [x] 5.4 Run `openspec validate stamp-app-version-every-analytics-event` and confirm no structural errors. — Valid.
