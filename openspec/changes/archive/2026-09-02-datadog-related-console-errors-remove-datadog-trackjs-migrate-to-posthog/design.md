## Context

Monitoring/analytics in this repo is currently spread across three vendors:

- **DataDog RUM** — initialized in `packages/core/src/Utils/Datadog/index.ts` and wired into `AnalyticsInitializer` (`packages/core/src/Utils/Analytics/index.ts`) behind the `tracking_datadog` remote flag. Gated to staging/production. This is the source of the reported console errors, and its RUM support has reportedly ended.
- **TrackJS** — error/console tracking via two identical `useTrackJS` hooks (`@deriv/api`, `@deriv/api-v2`), installed from `AppContent.tsx`; used directly in `error-boundary.jsx`, `socket-general.js` (`window.TrackJS`), and `@deriv/utils` `logError`.
- **PostHog + RudderStack** — both provided by `@deriv-com/analytics@1.42.1` (already installed; transitively bundles `posthog-js@1.383.1`). PostHog is already wired into `AnalyticsInitializer` via `posthogOptions` but disabled (`tracking_posthog: false`).

PostHog is therefore already available; this change removes the two retiring vendors and turns PostHog on. The `Analytics` wrapper exposes `trackEvent(event, data)` (used across the app) and, via `getInstances().posthog`, a `Posthog` wrapper. `posthog-js` itself supports exception autocapture (config) and `captureException`.

## Goals / Non-Goals

**Goals:**

- Eliminate the DataDog RUM console errors by removing DataDog entirely.
- Remove TrackJS entirely (both hooks, the dependency, the global usage).
- Route the three error-reporting sites (error boundary, socket timeout, `logError`) through PostHog.
- Turn PostHog on via feature flags and keep the build/CI free of dead DataDog/TrackJS config.

**Non-Goals:**

- Redesigning the analytics event taxonomy or RudderStack usage.
- Adding new product analytics events beyond the error-reporting parity.
- Changing the external remotely-hosted feature-flag config (tracked as a coordination task, not a code change here).
- Extending the `@deriv-com/analytics` wrapper API (see Risks — captured as report-upstream if needed).

## Decisions

### Decision 1: Use PostHog exception autocapture for uncaught errors

Enable PostHog's built-in exception capture through `posthogOptions.config` in `AnalyticsInitializer` so uncaught runtime errors are captured automatically, replacing DataDog RUM's error collection without per-call wiring.

- **Alternative considered:** manually forward every error. Rejected as the primary mechanism — autocapture matches RUM's "collect everything" behavior with the least code.

### Decision 2: Route explicit error sites through the existing `trackEvent` wrapper

For the three explicit TrackJS call sites (error boundary, socket timeout, `logError`), emit a structured error event via `Analytics.trackEvent(...)` from `@deriv-com/analytics` (already the app's standard analytics entry point). This preserves the existing context payloads (component stack, socket URL, pending response types, message/data) as event properties.

- **Alternative considered:** call `posthog.captureException` directly through `getInstances().posthog`. Rejected because the `@deriv-com/analytics` `Posthog` wrapper does not expose `captureException` (only `capture`, identify, feature flags). Using `trackEvent` needs no upstream change. If first-class exception capture at these sites is later required, that is an upstream ask on `@deriv-com/analytics` (report-upstream).

### Decision 3: Guard reporting so error paths never regress

Keep the existing try/catch-and-swallow behavior in `error-boundary.jsx` and `logError`, and keep `logError`'s signature `(message, data?)`. The fallback UI and callers must not break if analytics is uninitialized or throws.

### Decision 4: Remove the `tracking_datadog` flag rather than leave it dormant

Delete `tracking_datadog` from the `FeatureFlags` type, `isFeatureFlags` guard, and both local `remote_config.json` fallbacks; flip `tracking_posthog` to `true`. Removing the guard requirement is backward-compatible: remote configs that still carry `tracking_datadog` remain valid (it becomes an ignored extra field).

### Decision 5: Strip dead DataDog/TrackJS env from build and CI

Once no code reads `DATADOG_*` or `TRACKJS_TOKEN`, remove them from the webpack DefinePlugin and the GitHub build action/release workflows to avoid dead configuration and confusion.

## Risks / Trade-offs

- **[Error-reporting fidelity drops vs RUM]** — DataDog RUM captured resource/long-task/session-replay signals PostHog autocapture does not. → Accepted: RUM support has ended for this app; PostHog exception autocapture + explicit error events cover the error-reporting need that TrackJS served. Session replay is out of scope.
- **[Wrapper lacks `captureException`]** — the `@deriv-com/analytics` `Posthog` wrapper exposes no exception API, so explicit sites use `trackEvent`. → Mitigation: autocapture handles uncaught errors; if first-class capture is needed, raise upstream (report-upstream) rather than reaching into internals.
- **[External remote config still gates PostHog]** — the live config at `REMOTE_CONFIG_URL` overrides the local fallback; if it keeps `tracking_posthog: false`, PostHog stays off in production even after this merges. → Mitigation: coordination task to update the remote config; the local fallback is flipped so dev/failed-fetch paths enable PostHog.
- **[`POSTHOG_KEY` must be present in CI]** — PostHog only initializes when the key is set. → Already wired in `.github/actions/build/action.yml` and both release workflows; verify the secret exists.
- **[trackjs is a root dependency]** — removing it must not leave dangling imports. → Grep gate: no `trackjs` / `TrackJS` / `window.TrackJS` references remain before dropping the dep.

## Migration Plan

1. Migrate the three error sites to PostHog and enable autocapture (no behavior gap before removal).
2. Delete DataDog + TrackJS modules, hooks, exports, and dependencies.
3. Update feature flags, remote-config fallbacks, build DefinePlugin, and CI.
4. Update READMEs and tests.
5. Verify: `npm run test:jest` for touched packages, build the app, and confirm on staging that the DataDog console errors are gone and PostHog receives events/exceptions.
6. **Rollback:** revert the change set; the retired CI secrets/vars can stay in place harmlessly during rollout, so rollback is a straight git revert.

## Open Questions

Captured in `tasks.md` under `## Open Questions` with recommended defaults; the plan proceeds on those defaults.
