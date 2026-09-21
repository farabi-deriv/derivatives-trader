## ADDED Requirements

### Requirement: [ANLY-001] `@deriv-com/analytics` is pinned to 1.43.0 across every manifest and the lockfile

Root `package.json` and the five workspace manifests (`packages/core`, `packages/reports`, `packages/shared`, `packages/trader`, `packages/utils`) declare `@deriv-com/analytics` as `1.43.0`, and `package-lock.json` resolves the same package to the `1.43.0` tarball/integrity everywhere it is required.

#### Scenario: dependency version is bumped

- **WHEN** any of the six `package.json` files or `package-lock.json` is read
- **THEN** every `@deriv-com/analytics` version reference reads `1.43.0` (no `1.42.1` occurrence remains)

### Requirement: [ANLY-002] `AnalyticsInitializer` registers `app_version` with the analytics library

`packages/core/src/Utils/Analytics/index.ts`'s `AnalyticsInitializer` passes a top-level `app_version` (sourced from `process.env.APP_VERSION`, falling back to `'0.0.0'`) into the `Analytics.initialise()` config whenever RudderStack and/or PostHog is enabled, so `@deriv-com/analytics@1.43.0` registers it once for both providers — fixing PostHog autocaptured events (pageviews, autocapture clicks) that previously carried no `app_version`.

#### Scenario: app_version is wired into initialise()

- **WHEN** `AnalyticsInitializer` runs with RudderStack and/or PostHog enabled via remote config
- **THEN** `Analytics.initialise` is called with a top-level `app_version` field equal to `process.env.APP_VERSION` (or `'0.0.0'` when unset)

### Requirement: [ANLY-003] Manual `app_version` stamping in `trackAnalyticsEvent` is deliberately kept, not removed

`packages/shared/src/utils/analytics/analytics-utils.ts`'s `trackAnalyticsEvent` continues to stamp `app_version` (from its own module-level `process.env.APP_VERSION` read) onto every manually tracked event, unchanged by this bump. Both this stamp and the new library-level registration in `[ANLY-002]` read the identical build-time `APP_VERSION` value, so they can never diverge — removing either one is unnecessary and would regress the existing `AEV-001`/`AEV-002`/`AEV-003` invariant coverage for no behavioural gain.

#### Scenario: manually tracked events keep their explicit app_version property

- **WHEN** `trackAnalyticsEvent` is called after the `@deriv-com/analytics` bump
- **THEN** the emitted event properties still contain an explicit `app_version` sourced from `process.env.APP_VERSION`, independent of the library's own registration
