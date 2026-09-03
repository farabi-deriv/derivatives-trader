# Coordination tasks (before production)

These items live outside this repository and must be actioned by the team that
owns the remote feature-flag config and the CI environment. They are required
for this change to take full effect in production; the code change alone flips
only the local fallback config.

## Remote feature-flag config (`REMOTE_CONFIG_URL`)

- **Ships now (staging/demo):** the local `remote_config.json` fallbacks in
  `@deriv/api` and `@deriv/api-v2` now set `tracking_posthog: true` and no longer
  carry `tracking_datadog`. Dev and failed-fetch paths therefore enable PostHog.
- **Before production:** update the remotely-hosted config served from
  `REMOTE_CONFIG_URL` to set `tracking_posthog: true`. The live config overrides
  the local fallback, so if it still has `tracking_posthog: false` PostHog stays
  off in production. Removing the now-unused `tracking_datadog` key there is
  optional cleanup (the code ignores it as an extra field).
- **Why staging is OK:** the local fallback already enables PostHog for
  non-production environments, so migration can be validated on staging before
  the remote flip.

## CI secrets and variables

- **Before production:** retire the now-unused DataDog and TrackJS CI
  secrets/vars, since no build step reads them any longer:
    - `DATADOG_APPLICATION_ID`, `DATADOG_CLIENT_TOKEN`, `DATADOG_CLIENT_TOKEN_LOGS`,
      `DATADOG_SESSION_REPLAY_SAMPLE_RATE`, `DATADOG_SESSION_SAMPLE_RATE`,
      `DATADOG_SESSION_SAMPLE_RATE_LOGS`
    - `TRACKJS_TOKEN`
- **Why staging is OK:** leaving the retired secrets/vars in place is harmless
  during rollout (nothing reads them), which also keeps rollback to a straight
  `git revert`. They are dead configuration and should be removed once the
  change is fully rolled out.

## Verify PostHog is wired for CI

- Confirm `POSTHOG_KEY` (secret) and `POSTHOG_HOST` (var) exist for the staging
  and production environments — PostHog only initialises when `POSTHOG_KEY` is
  present. These are already referenced by `.github/actions/build/action.yml`
  and both release workflows.
