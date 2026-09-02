## Context

`trackAnalyticsEvent` in `packages/shared/src/utils/analytics/analytics-utils.ts` is the single funnel every DTrader analytics event passes through. It already merges two common, flat properties (`account_type`, `device_type`) into every event before calling `Analytics.trackEvent`. Build-time constants reach the client via webpack's `DefinePlugin`, configured once in `packages/core/build/constants.js` and fed by inputs on `.github/actions/build/action.yml`.

A key structural fact makes the plumbing cheap: `@deriv/shared` is declared an **external** in both `packages/trader/build/webpack.config.js` (line 83) and `packages/reports/build/webpack.config.js` (line 66). Shared source is therefore only ever compiled by **core's** webpack, so a single `DefinePlugin` entry in core covers the shared code consumed by all three bundles.

## Goals / Non-Goals

**Goals**

- Emit a flat `app_version` on every event through the existing funnel.
- Value identical to the `generate_app_info` `version` for the same deploy.
- Deterministic `'0.0.0'` fallback for local dev, unset builds, and Jest.
- Give staging a per-deploy version identity (currently every staging deploy stamps the literal `master`).

**Non-Goals**

- Backfilling historical PostHog events.
- Vision-side dashboard or query changes.
- Versioning non-PostHog telemetry (GTM `dataLayer`).
- Per-package webpack plumbing (unnecessary given the externals note).

## Decisions

### Resolve `APP_VERSION` once at module scope, inject inline

```ts
// `||` not `??`: an unset build var arrives as '' and must also fall back.
const APP_VERSION = process.env.APP_VERSION || '0.0.0';
```

Injected into `eventProperties` next to `...commonData`. Rationale: matches the existing flat-property shape; `DefinePlugin` performs a compile-time textual substitution of `process.env.APP_VERSION`, so a module-scope const is the idiomatic read. **Alternative considered:** compute inside `trackAnalyticsEvent` per call — rejected as needless repeated work for a value fixed at build time. **Alternative considered:** a nested `metadata.app_version` — rejected; the issue and existing convention want flat properties.

### `||` over `??`

`DefinePlugin` replaces an undefined `process.env.APP_VERSION` with the string `'undefined'`... but only if the key is defined in the plugin; when the env var is unset at build time, `JSON.stringify(undefined)` yields the literal token `undefined`, and when set-but-empty it yields `""`. Empty string is falsy but not nullish, so `??` would let `''` through. `||` collapses both `''` and `undefined` to the fallback. This is the explicit contract in AEV-002.

### Single `DefinePlugin` entry in core only

Add `'process.env.APP_VERSION': JSON.stringify(process.env.APP_VERSION)` to the block in `packages/core/build/constants.js`, mirroring the existing `REF_NAME` / `POSTHOG_KEY` entries. Bare env name (`APP_VERSION`) per repo convention. No trader/reports change needed (externals). **Alternative considered:** add the DefinePlugin entry to trader and reports configs too — rejected as dead config, since those webpacks never compile shared source.

### CI plumbing mirrors existing inputs

`action.yml` gets an `APP_VERSION` input and an `env: APP_VERSION: ${{ inputs.APP_VERSION }}` line, mirroring `REF_NAME`. Production passes `github.ref_name` (the `production_*` tag, same string already given to `generate_app_info`). Staging passes `staging_${{ github.sha }}` and also changes `generate_app_info`'s `version` to the same, so beacon and events agree.

## Risks / Trade-offs

- **Staging beacon value changes from `master` to `staging_<sha>`** → Heads-up to Vision dashboard owners before merge, so a staging beacon that stops saying `master` is not read as an outage. Recorded as a deferral-style operational note; the change itself is correct (a per-deploy identity is the point).
- **Module-scope const is frozen at first import in Jest** → Testing the unset/empty fallback requires `jest.resetModules()` + re-`require` inside `jest.isolateModules` (or per-test `process.env` mutation before import), since the const is captured once. The test file handles this explicitly.
- **`DefinePlugin` textual substitution vs. runtime `process.env`** → In Jest there is no DefinePlugin; `process.env.APP_VERSION` is a real runtime read, so the fallback is exercised naturally. In the browser bundle the token is substituted at build time. Both paths converge on the same `|| '0.0.0'` guard.

## Migration Plan

1. Merge code + CI changes together (single PR).
2. Before merge: notify Vision dashboard owners of the staging beacon value change.
3. On next staging deploy, verify `/app-info.json` serves `staging_<sha>` and events carry the matching `app_version`.
4. On next production deploy, verify `app_version` equals the `production_*` tag and matches `/app-info.json`.
5. **Rollback:** revert the PR; staging beacon returns to `master` and events lose `app_version`. No data migration involved.

## Open Questions

None blocking. Staging version format `staging_<sha>` is taken directly from the issue.
