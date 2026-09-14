# `packages/reports` keeps build-time and type-only packages in `dependencies`

## What was deferred

Moving six `packages/reports` entries out of `dependencies`, where they do not belong:

| Entry                    | Why it is not a runtime dependency                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `typescript`             | compiler; only ever invoked by `tsc`                                                                                       |
| `@types/react`           | type-only                                                                                                                  |
| `@types/react-dom`       | type-only                                                                                                                  |
| `null-loader`            | webpack loader, referenced as a string at `packages/reports/build/constants.js:95`                                         |
| `workbox-webpack-plugin` | build plugin — **removed** by #1273, since nothing references it at all                                                    |
| `react-dom`              | declared as a webpack `externals` entry at `packages/reports/build/webpack.config.js:61`, i.e. supplied by the host bundle |

Issue #1273's C8d manifest pass removes the sixteen entries with **zero** references anywhere, and deliberately keeps the five above that do have a reference (plus `core-js`, which `@babel/preset-env`'s `useBuiltIns: "usage"` injects without any source import ever appearing). It does not reclassify them.

## Why

Removing a dependency with zero references is provably safe; moving one between `dependencies` and `devDependencies` changes the installed graph for anything that consumes `@deriv/reports` as a package, and in a workspace monorepo the failure mode is a hoisting change that surfaces only in a clean install or in CI. That is a different risk profile from a dead-code deletion, and it deserves its own PR with its own clean-install verification rather than riding along in a ~1,900-line sweep.

`packages/api`, `packages/components`, `packages/core` and `packages/trader` have the same pattern to varying degrees, so fixing only `packages/reports` would leave the monorepo inconsistent.

## Follow-up required

In a separate change covering all workspaces at once:

1. Audit every workspace `package.json` for entries in `dependencies` that are compilers, `@types/*` packages, webpack loaders/plugins, or declared webpack externals; move each to `devDependencies`.
2. Keep `core-js` in `dependencies` wherever `@babel/preset-env` is configured with `useBuiltIns: "usage"` — it is a genuine runtime dependency with no source import.
3. Verify with a clean install from scratch (`rm -rf node_modules packages/*/node_modules && npm run bootstrap`), then `npm run build:all`, `npm run test`, and a per-package `npx tsc -p packages/<pkg>/tsconfig.json --noEmit` against the recorded baselines.
4. Regenerate and commit `docs/baselines/knip-baseline.json` — knip classifies unused `dependencies` and `devDependencies` separately, so the reclassification moves entries between baseline buckets.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1376
