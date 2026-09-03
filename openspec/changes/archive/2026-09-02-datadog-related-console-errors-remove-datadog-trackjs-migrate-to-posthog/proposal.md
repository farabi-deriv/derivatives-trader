## Why

DataDog RUM is throwing repeated console errors on dtrader.deriv.com (reported during a bug hunt on responsive web), and DataDog RUM support has reportedly ended for this app. TrackJS is the second, overlapping monitoring/error-tracking vendor. Both should be removed and their responsibilities consolidated onto PostHog, which is already partially wired into the analytics initializer (`posthogOptions`) but gated off (`tracking_posthog: false`). Consolidating on one provider clears the console errors, removes two dependencies (and their bundle weight), and leaves a single analytics + error-monitoring path.

## What Changes

- **BREAKING (build/deploy):** Remove the DataDog RUM integration entirely — delete `Utils/Datadog`, drop `@datadog/browser-rum`, and stop reading the `DATADOG_*` build/CI variables.
- **BREAKING (build/deploy):** Remove TrackJS entirely — delete both `useTrackJS` hooks (`@deriv/api`, `@deriv/api-v2`), the `trackjs` dependency, and stop reading `TRACKJS_TOKEN`.
- Remove the `tracking_datadog` feature flag from the `FeatureFlags` type/type-guard and from both `remote_config.json` fallbacks; enable `tracking_posthog` (`true`) so PostHog initializes.
- Replace TrackJS error/console tracking in the error boundary, the WebSocket 30s-timeout logger, and the shared `logError` utility with PostHog (enable PostHog exception autocapture via config, and emit structured error events through the existing `@deriv-com/analytics` wrapper).
- Update package/module READMEs that document TrackJS/DataDog as the monitoring integration.
- Verify the reported DataDog console errors are gone after removal.

## Capabilities

### New Capabilities

- `analytics-initialization`: How the app boots its analytics/RUM providers on startup — which providers are initialized, gated by which feature flags and env vars. This change removes DataDog RUM from initialization and turns PostHog on.
- `error-monitoring`: How runtime errors are captured and reported (React error boundary, WebSocket response-timeout logging, and the shared `logError` utility). This change moves error capture from TrackJS to PostHog.

### Modified Capabilities

<!-- None. openspec/specs/ contains no existing specs for these capabilities. -->

## Impact

- **Code (DataDog):** `packages/core/src/Utils/Datadog/index.ts` (deleted), `packages/core/src/Utils/Analytics/index.ts`, `packages/core/src/types/feature-flags.ts`, `packages/api/src/remote_config.json`, `packages/api-v2/src/remote_config.json`.
- **Code (TrackJS):** `packages/api/src/hooks/useTrackJS.ts` (deleted), `packages/api-v2/src/hooks/useTrackJS.ts` (deleted), `packages/api/src/index.ts`, `packages/api-v2/src/index.ts`, `packages/core/src/App/AppContent.tsx`, `packages/core/src/App/Components/Elements/Errors/error-boundary.jsx`, `packages/core/src/Services/socket-general.js`, `packages/utils/src/logging.ts`, `packages/utils/src/__tests__/logging.spec.ts`.
- **Dependencies:** remove `@datadog/browser-rum` (`packages/core/package.json`) and `trackjs` (root `package.json`). `@deriv-com/analytics` (1.42.1, already present) and its transitive `posthog-js` become the sole provider.
- **Build/CI:** `packages/core/build/constants.js` (DefinePlugin `DATADOG_*` + `TRACKJS_TOKEN`), `.github/actions/build/action.yml`, `.github/workflows/release_staging.yml`, `.github/workflows/release_production.yml` (`DATADOG_*`, `TRACKJS_TOKEN` inputs/env).
- **Docs:** `packages/core/README.md`, `packages/utils/README.md`, `packages/api/README.md`, `packages/api-v2/README.md`.
- **External (out of repo):** the remotely-hosted feature-flag config at `REMOTE_CONFIG_URL` must also have `tracking_posthog` enabled / `tracking_datadog` removed; the CI project secrets/vars for DataDog and TrackJS can be retired.
