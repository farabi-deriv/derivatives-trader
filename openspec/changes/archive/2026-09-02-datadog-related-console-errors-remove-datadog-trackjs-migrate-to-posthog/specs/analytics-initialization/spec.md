## ADDED Requirements

### Requirement: Startup analytics provider initialization

The application SHALL initialize its analytics/RUM providers once at startup from `AnalyticsInitializer`, gated by remote feature flags and build-time environment variables. The only supported providers are Google Tag Manager, RudderStack (via `@deriv-com/analytics`), and PostHog (via `@deriv-com/analytics`). DataDog RUM SHALL NOT be initialized.

#### Scenario: DataDog RUM is never initialized

- **WHEN** the application starts and `AnalyticsInitializer` runs
- **THEN** no DataDog RUM SDK is imported or initialized
- **AND** no `datadogRum.init` call is made
- **AND** the DataDog-related console errors observed on dtrader.deriv.com no longer appear

#### Scenario: PostHog initializes when enabled

- **WHEN** the resolved feature flags contain `tracking_posthog: true` and `process.env.POSTHOG_KEY` is set
- **THEN** `Analytics.initialise` is called with `posthogOptions.apiKey` set to `POSTHOG_KEY`
- **AND** when `process.env.POSTHOG_HOST` is set, `posthogOptions.config.api_host` is set to that host

#### Scenario: RudderStack initializes when enabled

- **WHEN** the resolved feature flags contain `tracking_rudderstack: true` and `process.env.RUDDERSTACK_KEY` is set
- **THEN** `Analytics.initialise` is called with `rudderstackKey` set to `RUDDERSTACK_KEY`

#### Scenario: No analytics providers enabled

- **WHEN** neither PostHog nor RudderStack is enabled (flag off or key missing)
- **THEN** `Analytics.initialise` is not called and startup proceeds without error

### Requirement: Feature flag schema excludes DataDog

The `FeatureFlags` type and its `isFeatureFlags` type guard SHALL NOT include a `tracking_datadog` field. The type guard SHALL validate `tracking_posthog` and `tracking_rudderstack` as booleans. Local `remote_config.json` fallbacks SHALL NOT contain `tracking_datadog`.

#### Scenario: Type guard accepts config without tracking_datadog

- **WHEN** a remote config object without a `tracking_datadog` field is validated by `isFeatureFlags`
- **THEN** the object is accepted as valid `FeatureFlags`

#### Scenario: Local fallback config enables PostHog

- **WHEN** the remote config fetch fails and the local `remote_config.json` fallback is used
- **THEN** the fallback contains `tracking_posthog: true`
- **AND** the fallback does not contain a `tracking_datadog` key

### Requirement: DataDog build and CI configuration removed

The build DefinePlugin and CI workflows SHALL NOT define or pass DataDog (`DATADOG_*`) or TrackJS (`TRACKJS_TOKEN`) environment variables, since no code reads them.

#### Scenario: Build config has no DataDog/TrackJS env

- **WHEN** the webpack DefinePlugin config in `packages/core/build/constants.js` is inspected
- **THEN** it defines no `process.env.DATADOG_*` entries and no `process.env.TRACKJS_TOKEN` entry

#### Scenario: CI workflows have no DataDog/TrackJS env

- **WHEN** the build action and release workflows are inspected
- **THEN** they declare no `DATADOG_*` inputs/env and no `TRACKJS_TOKEN` input/env
