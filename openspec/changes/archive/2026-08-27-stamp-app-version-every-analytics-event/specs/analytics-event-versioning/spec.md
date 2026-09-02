## ADDED Requirements

### Requirement: [AEV-001] Every analytics event carries app_version

Every analytics event emitted through the central `trackAnalyticsEvent` funnel SHALL include a flat `app_version` property. The property SHALL sit alongside the existing `account_type` and `device_type` properties — a top-level key on the event, not a nested metadata object. The value SHALL be resolved once from the build-time `process.env.APP_VERSION` variable.

Caller-supplied custom properties SHALL NOT be able to accidentally suppress `app_version`; the injected value takes the standard place among the common properties the funnel already merges.

#### Scenario: An event routed through the funnel includes app_version

- **WHEN** any code calls `trackAnalyticsEvent(eventName, ...)`
- **THEN** the underlying `Analytics.trackEvent` receives an event-properties object that contains an `app_version` key
- **AND** `app_version` is a sibling of `account_type` and `device_type`, not nested

#### Scenario: Events from the trader and reports bundles are covered

- **WHEN** an event originates from code compiled into the trader or reports bundle
- **THEN** that event still carries `app_version`, because `@deriv/shared` is an external compiled only by core's webpack and the build-time value is defined there for all three bundles

### Requirement: [AEV-002] app_version falls back deterministically when unset

When the build-time `process.env.APP_VERSION` is absent or an empty string, `trackAnalyticsEvent` SHALL emit `app_version: "0.0.0"` rather than `undefined`, a crash, or a missing key. The fallback SHALL treat an empty string the same as an unset value (i.e. `||`, not `??`), because an unset build variable arrives at runtime as `''`.

#### Scenario: Local dev / build without the variable yields 0.0.0

- **WHEN** the app is built or run without `APP_VERSION` set (local dev, `npm run build:all` without the var, or Jest)
- **THEN** events carry `app_version: "0.0.0"`
- **AND** no event carries `app_version: undefined` and no error is thrown

#### Scenario: Empty-string build variable yields 0.0.0

- **WHEN** `process.env.APP_VERSION` is defined but resolves to an empty string
- **THEN** events carry `app_version: "0.0.0"`

### Requirement: [AEV-003] Deployed app_version matches the app-info beacon

On a release deploy, the `app_version` stamped into events SHALL be identical to the `version` that `generate_app_info` writes into `/app-info.json` for that same deploy, so PostHog events can be joined to the deployed build.

#### Scenario: Production deploy stamps the production tag

- **WHEN** the production workflow runs (triggered by a `push` of a `production_*` tag)
- **THEN** `app_version` equals `github.ref_name` — the `production_*` tag
- **AND** that same string is served at `/app-info.json`

#### Scenario: Staging deploy stamps a per-deploy identity

- **WHEN** the staging workflow runs (triggered by a `push` to `master`)
- **THEN** `app_version` equals `staging_<sha>` for that commit
- **AND** `/app-info.json` on staging serves that same `staging_<sha>` string rather than the literal `master`
