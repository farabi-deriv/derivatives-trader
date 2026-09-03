## Open Questions

1. **How should the three explicit error sites report to PostHog?**
    - A) **(RECOMMENDED)** Emit a structured event via `Analytics.trackEvent('error_boundary' / 'websocket_timeout' / 'log_error', {...context})` from `@deriv-com/analytics` — no upstream change, keeps existing context payloads.
    - B) Call `posthog.captureException(error, props)` directly — requires the `@deriv-com/analytics` `Posthog` wrapper to expose `captureException` (it does not today → upstream change).
    - C) Rely solely on PostHog autocapture and drop explicit reporting at these sites — simplest, but loses the curated context (component stack, socket URL, pending response types).
    - _Proceeding with **A**, plus autocapture (Decision 1) for uncaught errors._

2. **Should PostHog exception autocapture be enabled?**
    - A) **(RECOMMENDED)** Yes — enable exception capture in `posthogOptions.config` so uncaught errors are collected automatically (closest RUM parity).
    - B) No — only report explicitly at the three sites.
    - _Proceeding with **A**._

3. **What is the analytics event name/shape for reported errors?**
    - A) **(RECOMMENDED)** One event per site with a shared shape: `{ message, name?, stack?, ...site_specific_context }`, event names `error_boundary`, `websocket_timeout`, `log_error`.
    - B) A single `client_error` event with a `source` property.
    - _Proceeding with **A** (mirrors the current per-site payloads most closely); a reviewer may standardize to B._

## 1. Migrate error reporting to PostHog

- [x] 1.1 Enable PostHog exception autocapture in `packages/core/src/Utils/Analytics/index.ts` by adding the capture-exceptions option to `config.posthogOptions.config` (alongside `api_host`).
- [x] 1.2 Replace TrackJS usage in `packages/core/src/App/Components/Elements/Errors/error-boundary.jsx`: remove `import { TrackJS } from 'trackjs'`; in `componentDidCatch`, report `{ message, name, stack, component_stack: info.componentStack }` via `Analytics.trackEvent('error_boundary', ...)` inside the existing try/catch; keep rendering the fallback UI.
- [x] 1.3 Replace `window.TrackJS?.console?.error(...)` in `packages/core/src/Services/socket-general.js` with `Analytics.trackEvent('websocket_timeout', { message, websocketUrl, pendingResponseTypes })` (import `Analytics` from `@deriv-com/analytics`).
- [x] 1.4 Rewrite `packages/utils/src/logging.ts` `logError(message, data)` to report via `Analytics.trackEvent('log_error', { message, ...data })`, keep the `(message, data?)` signature and the swallow-on-failure try/catch, and drop the `trackjs` import.
- [x] 1.5 Update `packages/utils/src/__tests__/logging.spec.ts` to mock `@deriv-com/analytics` `Analytics.trackEvent` instead of `trackjs`, asserting the message/data payload and that errors are swallowed.

## 2. Remove DataDog RUM

- [x] 2.1 Delete `packages/core/src/Utils/Datadog/index.ts`.
- [x] 2.2 In `packages/core/src/Utils/Analytics/index.ts`, remove `import initDatadog from 'Utils/Datadog'` and the `if (flags.tracking_datadog) { initDatadog(true); }` block.
- [x] 2.3 Remove `@datadog/browser-rum` from `packages/core/package.json` dependencies.
- [x] 2.4 In `packages/core/src/types/feature-flags.ts`, remove the `tracking_datadog` field from `FeatureFlags` and its check from `isFeatureFlags`.
- [x] 2.5 Remove `"tracking_datadog"` and set `"tracking_posthog": true` in `packages/api/src/remote_config.json` and `packages/api-v2/src/remote_config.json`.

## 3. Remove TrackJS

- [x] 3.1 Delete `packages/api/src/hooks/useTrackJS.ts` and `packages/api-v2/src/hooks/useTrackJS.ts`.
- [x] 3.2 Remove the `export { default as useTrackJS } from './hooks/useTrackJS';` line from `packages/api/src/index.ts` and `packages/api-v2/src/index.ts`.
- [x] 3.3 In `packages/core/src/App/AppContent.tsx`, drop `useTrackJS` from the `@deriv/api` import and remove the `const { initTrackJS } = useTrackJS();` line and the `initTrackJS(loginid)` `useEffect`.
- [x] 3.4 Remove `trackjs` from the root `package.json` dependencies.

## 4. Clean up build and CI configuration

- [x] 4.1 In `packages/core/build/constants.js`, remove the `process.env.DATADOG_APPLICATION_ID`, `DATADOG_CLIENT_TOKEN`, `DATADOG_SESSION_REPLAY_SAMPLE_RATE`, `DATADOG_SESSION_SAMPLE_RATE`, and `process.env.TRACKJS_TOKEN` DefinePlugin entries.
- [x] 4.2 In `.github/actions/build/action.yml`, remove the `DATADOG_*` and `TRACKJS_TOKEN` inputs and their `env` mappings.
- [x] 4.3 In `.github/workflows/release_staging.yml` and `.github/workflows/release_production.yml`, remove the `DATADOG_*` and `TRACKJS_TOKEN` env entries passed to the build step.

## 5. Update documentation

- [x] 5.1 Update `packages/core/README.md` (Analytics Integration / error monitoring lines) to describe PostHog instead of TrackJS/DataDog.
- [x] 5.2 Update `packages/utils/README.md` (Error Logging section and the `logging.ts` description) to reference PostHog.
- [x] 5.3 Update `packages/api/README.md` and `packages/api-v2/README.md` to remove the `useTrackJS` hook documentation.

## 6. Verify

- [x] 6.1 Grep the source tree to confirm zero remaining references to `trackjs`, `TrackJS`, `window.TrackJS`, `@datadog/browser-rum`, `datadogRum`, and `tracking_datadog` (excluding `dist/` and `bundle-stats.json`).
- [x] 6.2 Run `npm run test:jest -- packages/utils/src/__tests__/logging.spec.ts` (and any touched-package tests) and confirm green.
- [x] 6.3 Run `npm run test:eslint-all` and `npm run bootstrap` (to regenerate types after dependency removal) and confirm no unresolved-import or type errors.
- [x] 6.4 Build and load the app (staging config); confirm the DataDog console errors reported in issue #1083 are gone and PostHog receives events/exceptions.
- [x] 6.5 File a coordination task to enable `tracking_posthog` / remove `tracking_datadog` in the remotely-hosted config at `REMOTE_CONFIG_URL`, and retire the DataDog/TrackJS CI secrets and vars.
