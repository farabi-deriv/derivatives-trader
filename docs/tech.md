# Derivatives Trader — Tech

**Status:** extracted · **Owner:** `nijil-deriv` · **Sources:** package manifests,
[`.github/workflows/`](../.github/workflows/), [`CLAUDE.md`](../CLAUDE.md),
[`docs/README.md`](README.md)

What this repository is built with, read off the manifests and CI rather than
restated from prose. Architectural reasoning lives in
[`architecture/architecture-analysis.md`](architecture/architecture-analysis.md);
the conventions agents must follow live in [`CLAUDE.md`](../CLAUDE.md).

## Shape

A private npm-workspaces monorepo of eight published packages, shipping a single
browser front end — no server of its own.

| Package             | Role                                                            |
| ------------------- | --------------------------------------------------------------- |
| `@deriv/core`       | App shell, routing, global stores, initialisation               |
| `@deriv/trader`     | Trading terminal (desktop + mobile `AppV2` variant)             |
| `@deriv/reports`    | Portfolio, positions, statements, P&L                           |
| `@deriv/components` | Shared UI component library                                     |
| `@deriv/stores`     | Store infrastructure (`StoreProvider`, `useStore`, `BaseStore`) |
| `@deriv/api`        | React Query hooks and `APIProvider`                             |
| `@deriv/shared`     | Cross-package utilities, contract types, routes, brand config   |
| `@deriv/utils`      | General utilities                                               |

## Languages and runtime

- **TypeScript** `^5.0.0` (strict) and JavaScript, **SCSS** via `sass` `^1.62.1`
- **Node.js** `20.x`, **npm** `9.x` (`engines` in [`package.json`](../package.json))
- Target: evergreen browsers, desktop and mobile web

## Frameworks and libraries

- **React** `^18.2.0` with `react-dom` `^18.2.0`
- **MobX** `^6.6.1` with `mobx-react-lite` and `mobx-persist-store` — root store
  plus modular stores extending `BaseStore`; not Redux
- **React Router** `react-router-dom` `^5.2.0`, config-based route arrays
- **TanStack Query** `@tanstack/react-query` `^4.36.1` for caching and
  deduplication over the WebSocket layer
- **Design system:** `@deriv-com/ui` `1.36.4` and `@deriv-com/quill-ui` `1.24.12`
- **Charting:** `@deriv-com/smartcharts-champion` `1.13.0` — a Flutter Web canvas
  build, themed only through its `settings.theme` prop
- **i18n:** `@deriv-com/translations` `1.4.9` over `i18next` `^22.4.6`, with
  translations synced from Crowdin
  ([`sync-translations.yml`](../.github/workflows/sync-translations.yml))
- **Analytics:** `@deriv-com/analytics` `1.43.0`

## Services it talks to

- **Deriv API v3 over WebSocket** via `@deriv/deriv-api` `^1.0.15` — default
  endpoint `wss://api.deriv.com/websockets/v3`, connection reuse, 30s keep-alive
  ping, exponential-backoff reconnect. Hosts per environment are declared in
  [`brand.config.json`](../brand.config.json) (`api`, `api_core`, `auth`).
- **Multi-brand hosts** — `deriv.com`, `deriv.be`, `deriv.me`; no hardcoded
  domains, everything resolves through `brand.config.json`.

## Build

- **Webpack** `^5.81.0`, one config per package under
  `packages/{core,trader,reports,components}/build/`
- Code splitting into shell + trader + reports + vendors + per-route bundles,
  `[contenthash]` asset hashing, path aliases (`App/`, `Stores/`, `Components/`,
  `Utils/`, `Sass/`, …) declared in both webpack and `tsconfig`
- Dev server on `https://localhost:8443` with HMR
- Bundle budgets tracked as committed baselines in
  [`baselines/`](baselines/), enforced by `npm run baseline:check`

## Test and quality gates

- **Jest** `^29.7.0` with React Testing Library, multi-project config discovering
  package-level configs; tests co-located in `__tests__/` directories
- **Playwright** `^1.52.0` end-to-end suite in [`playwright/`](../playwright/),
  reported through `@testdino/playwright`; rules in
  [`playwright/AGENTS.md`](../playwright/AGENTS.md)
- **ESLint 8** with `@deriv-com/eslint-config-deriv`, **Prettier 3**,
  **Stylelint 16**, enforced pre-commit via husky + lint-staged
- **knip** for dead-code detection and `scripts/` safety-net checks, both
  baselined and run in CI
- CI entry points: [`test.yml`](../.github/workflows/test.yml) (build, TypeScript,
  lint, imports, knip, baselines) and
  [`playwright.yml`](../.github/workflows/playwright.yml)

## Deploy

- **Cloudflare Pages**, built and published from GitHub Actions:
  [`release_staging.yml`](../.github/workflows/release_staging.yml) and
  [`release_production.yml`](../.github/workflows/release_production.yml)
  (triggered by `production_*` tags)
- Environments: `staging-dtrader.deriv.com`, `beta-dtrader.deriv.com`,
  `dtrader.deriv.com`
- [`vercel.json`](../vercel.json) and [`Dockerfile`](../Dockerfile) cover preview
  and container runs; both serve the same static SPA build
