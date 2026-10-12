## ADDED Requirements

### Requirement: [PHCFG-001] PostHog autocapture SHALL be turned off

`AnalyticsInitializer` in `packages/core/src/Utils/Analytics/index.ts` MUST pass `autocapture: false` inside `config.posthogOptions.config` so `@deriv-com/analytics`/posthog-js stops emitting automatic `$autocapture` click events (the library default is `{ dom_event_allowlist: ['click'] }`, applied before DTrader's own config). The inline `config` type in the same function MUST widen `posthogOptions.config` with `autocapture?: boolean`.

#### Scenario: autocapture is disabled on init

- **WHEN** `AnalyticsInitializer` runs with `POSTHOG_KEY` set and remote config `tracking_posthog: true`
- **THEN** `Analytics.initialise` is called with `posthogOptions.config.autocapture === false`

### Requirement: [PHCFG-002] PostHog feature-flag evaluation SHALL be disabled without skipping the `/flags` request

`AnalyticsInitializer` MUST pass `advanced_disable_feature_flags: true` inside `config.posthogOptions.config`, and MUST NOT pass `advanced_disable_flags`. DTrader reads its flags from `remote_config.json`/`REMOTE_CONFIG_URL`, so billed PostHog flag evaluation on init and on identify is wasted; `advanced_disable_feature_flags` still issues the `/flags` request (sending `disable_flags: true`) so PostHog's remote config — including the web-vitals setting a dashboard depends on — keeps loading, whereas `advanced_disable_flags` would skip the request entirely. The inline `config` type MUST widen `posthogOptions.config` with `advanced_disable_feature_flags?: boolean`.

#### Scenario: flag evaluation is disabled on init

- **WHEN** `AnalyticsInitializer` runs with `POSTHOG_KEY` set and remote config `tracking_posthog: true`
- **THEN** `Analytics.initialise` is called with `posthogOptions.config.advanced_disable_feature_flags === true` and no `advanced_disable_flags` key

### Requirement: [PHCFG-003] Existing PostHog capture settings SHALL be preserved

The only PostHog settings DTrader sets besides the two above MUST remain `capture_exceptions: true` and the conditional `api_host` override from `process.env.POSTHOG_HOST`. `capture_performance` MUST NOT be set, so `$web_vitals` keeps arriving, and `$pageview`/`$pageleave` stay on the library defaults. RudderStack setup and the `tracking_rudderstack`/`tracking_posthog` remote-config switches are unchanged.

#### Scenario: exception capture, api_host and web vitals are untouched

- **WHEN** `AnalyticsInitializer` runs with `POSTHOG_KEY` and `POSTHOG_HOST` set and remote config `tracking_posthog: true`
- **THEN** `Analytics.initialise` receives `posthogOptions.config` with `capture_exceptions: true`, `api_host` equal to `process.env.POSTHOG_HOST`, and no `capture_performance` key
