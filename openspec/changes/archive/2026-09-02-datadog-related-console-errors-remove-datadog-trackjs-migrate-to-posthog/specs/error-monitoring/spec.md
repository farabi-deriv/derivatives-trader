## ADDED Requirements

### Requirement: Runtime errors reported via PostHog, not TrackJS

The application SHALL report runtime errors through PostHog (via `@deriv-com/analytics`) and SHALL NOT depend on the `trackjs` package. No module SHALL import from `trackjs`, reference the `TrackJS` global, or reference `window.TrackJS`.

#### Scenario: No TrackJS references remain

- **WHEN** the source tree is searched for `trackjs` imports, the `TrackJS` symbol, or `window.TrackJS`
- **THEN** no application source file contains them
- **AND** the `trackjs` dependency is absent from `package.json`
- **AND** `useTrackJS` is no longer exported from `@deriv/api` or `@deriv/api-v2`

#### Scenario: PostHog exception autocapture enabled

- **WHEN** PostHog is initialized through `AnalyticsInitializer`
- **THEN** PostHog exception capture is enabled via its configuration so uncaught errors are captured without per-call instrumentation

### Requirement: React error boundary reports to PostHog

The application's `ErrorBoundary` SHALL continue to render the fallback error UI on a caught error, and SHALL report the error and its context (component stack, error message/name/stack) through PostHog instead of TrackJS. Error reporting failures SHALL be swallowed so the fallback UI still renders.

#### Scenario: Error is reported and fallback rendered

- **WHEN** a child component throws and `componentDidCatch` runs
- **THEN** the error and context are reported through the PostHog-backed analytics wrapper
- **AND** the fallback error component is rendered

#### Scenario: Reporting failure does not break the UI

- **WHEN** reporting the error to PostHog throws
- **THEN** the exception is caught and the fallback error component still renders

### Requirement: WebSocket response-timeout logging via PostHog

The WebSocket layer SHALL, when no message is received within 30 seconds of a connection opening, report a diagnostic event (message, socket URL, pending response types) through PostHog instead of `window.TrackJS`.

#### Scenario: Timeout diagnostic reported without TrackJS

- **WHEN** 30 seconds elapse after the socket opens with no message received
- **THEN** the diagnostic is reported through the PostHog-backed analytics wrapper
- **AND** no reference to `window.TrackJS` is used

### Requirement: Shared logError utility via PostHog

The `logError(message, data)` utility in `@deriv/utils` SHALL report the error through PostHog instead of TrackJS, SHALL preserve its `(message: string, data?: TLogData)` signature, and SHALL swallow reporting failures without throwing.

#### Scenario: logError reports through PostHog

- **WHEN** `logError('some message', { foo: 'bar' })` is called
- **THEN** an error event carrying the message and data is reported through the PostHog-backed analytics wrapper

#### Scenario: logError never throws

- **WHEN** the underlying reporting call throws
- **THEN** `logError` catches the error and returns without throwing
