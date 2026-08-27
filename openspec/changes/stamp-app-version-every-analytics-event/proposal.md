## Why

Analytics events emitted by DTrader carry no indication of which build produced them, so a funnel regression cannot be attributed to a release and event volumes cannot be compared across deploys. Both release workflows already stamp a deployed-version beacon into `app-info.json` via `generate_app_info`, but that value never reaches the events — so PostHog data and the deployed version cannot be joined.

## What Changes

- Every event routed through `trackAnalyticsEvent` (`packages/shared/src/utils/analytics/analytics-utils.ts`) gains a flat `app_version` property, injected alongside the existing `account_type` / `device_type`. The value is resolved once at module scope from `process.env.APP_VERSION`, falling back to `'0.0.0'` when the build var is unset **or** an empty string.
- The build-time `APP_VERSION` value is plumbed to the client bundle through core's `DefinePlugin` (`packages/core/build/constants.js`). Because `@deriv/shared` is an **external** in the trader and reports webpack configs, shared source is only ever compiled by core's webpack — this single `DefinePlugin` entry covers all three bundles.
- `.github/actions/build/action.yml` gains an `APP_VERSION` input, passed through to the build step's `env`.
- `.github/workflows/release_production.yml` sets `APP_VERSION: ${{ github.ref_name }}` — the `production_*` tag already handed to `generate_app_info`.
- `.github/workflows/release_staging.yml` gains a per-deploy version identity: the `generate_app_info` `version` input and `APP_VERSION` both become `staging_${{ github.sha }}`, replacing the current literal `master` that every staging deploy stamps today. **BREAKING (operational):** the value Vision reads from the staging beacon changes from `master` to `staging_<sha>`; the stale copy-pasted `# the production_* tag...` comment on that step is corrected.
- A new test file `packages/shared/src/utils/analytics/__tests__/analytics-utils.spec.ts` asserts `app_version` is emitted and that both an unset and an empty-string `process.env.APP_VERSION` fall back to `'0.0.0'`.

## Capabilities

### New Capabilities

- `analytics-event-versioning`: Every analytics event emitted through DTrader's central `trackAnalyticsEvent` funnel carries an `app_version` property whose value matches the deployed build version served at `/app-info.json`, with a deterministic fallback when no build version is present. (No existing spec under `openspec/specs/` covers analytics event property injection.)

### Modified Capabilities

<!-- None. No existing spec under openspec/specs/ covers analytics-event property injection or release-workflow versioning. -->

## Impact

- **Code**
    - `packages/shared/src/utils/analytics/analytics-utils.ts` — resolve `APP_VERSION` at module scope; inject `app_version` into `eventProperties` in `trackAnalyticsEvent`.
    - `packages/core/build/constants.js` — add `'process.env.APP_VERSION': JSON.stringify(process.env.APP_VERSION)` to the `DefinePlugin` block.
- **CI / build**
    - `.github/actions/build/action.yml` — new `APP_VERSION` input, wired into the build step `env`.
    - `.github/workflows/release_production.yml` — pass `APP_VERSION: ${{ github.ref_name }}`.
    - `.github/workflows/release_staging.yml` — pass `APP_VERSION: staging_${{ github.sha }}`; change `generate_app_info` `version` to `staging_${{ github.sha }}`; fix the stale inline comment.
- **Tests**: new `packages/shared/src/utils/analytics/__tests__/analytics-utils.spec.ts`.
- **Operational**: the staging `/app-info.json` beacon stops serving `master` and starts serving `staging_<sha>` — needs a heads-up to Vision dashboard owners before merge so the change is not read as an outage.
- **Out of scope**: backfilling historical PostHog events, Vision-side dashboard/query changes, versioning non-PostHog telemetry (GTM `dataLayer`).
