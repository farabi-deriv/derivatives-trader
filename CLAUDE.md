# Code style

- Use ES modules (import/export), not CommonJS (require)
- Destructure imports when possible: `import { foo } from 'bar'`
- Use TypeScript strict mode (noImplicitAny, strictNullChecks enabled)
- Wrap data-driven components with `observer()` HOC from mobx-react-lite
- Co-locate tests with source: `__tests__/` subdirectories next to implementation files

# Commands

```bash
# Install dependencies
npm run bootstrap

# Start development servers
npm run serve --workspace=@deriv/core        # https://localhost:8443
npm run serve --workspace=@deriv/trader
npm run serve --workspace=@deriv/reports

# Build
npm run build:all                            # All packages
npm run build --workspace=@deriv/core        # Specific package

# Testing
npm run test                                 # Stylelint + ESLint + Jest
npm run test:jest                            # Jest only
npm run test:jest -- path/to/test.spec.ts    # Single test file
npm run test:jest -- --watch                 # Watch mode
npm run test:eslint-all                      # ESLint all packages
npm run test:stylelint                       # SCSS linting
npm run stylelint:fix                        # Auto-fix styles
npm run prettify                             # Format with Prettier

# Bundle analysis
npm run analyze:bundle                       # All packages summary
npm run analyze:bundle --workspace=@deriv/core  # Generates bundle-report.html

# Utilities
npm run check-imports                        # Check circular imports
npm run generate:colors                      # Generate color tokens
npm run clean                                # Clean node_modules (interactive)
```

# Workflow

- Always run tests before pushing
- Use HMR during development (auto-rebuild + browser refresh on file save)
- Run `npm run analyze:bundle` to check bundle size after adding dependencies
- Use `npm run bootstrap` to regenerate types after package changes
- Clear `.tsbuildinfo` caches if TypeScript IDE errors persist

# Testing

- Tests use Jest 29 with React Testing Library
- Multi-project Jest config: root `jest.config.js` discovers package-level configs
- Test regex: `(/__tests__/.*|(\\.)(test|spec))\\.(js|jsx|tsx|ts)?$`
- Mock MobX stores by passing `mockRoot` to store constructors
- Wrap components in `<StoreProvider store={mockStore}>` for integration tests
- Use `render()` from @testing-library/react for component tests

# Architecture

## Monorepo structure (8 NPM packages via npm workspaces)

- `@deriv/core` - App shell, routing, global stores, initialization
- `@deriv/trader` - Trading terminal (main + mobile AppV2 variant)
- `@deriv/reports` - Portfolio, positions, statements, P&L analytics
- `@deriv/components` - 77 shared UI components
- `@deriv/stores` - Store infrastructure (StoreProvider, useStore, BaseStore)
- `@deriv/api` - React Query hooks (useQuery, useSubscription, useMutation, APIProvider)
- `@deriv/shared` - Cross-package utilities (contract types, validators, routes, analytics, brand config)
- `@deriv/utils` - General utilities (safeParse, crypto, type helpers)

## State management (MobX 6)

- Root store + modular stores pattern (not Redux)
- All stores extend `BaseStore` (provides localStorage/sessionStorage auto-sync via mobx-persist-store)
- RootStore contains: client, common, ui, modules, notifications, portfolio, active_symbols, contract_trade, contract_replay, traders_hub, gtm
- TradeStore (main trading state) lives in `packages/trader/src/Stores/Modules/Trading/trade-store.ts` (103KB)
- Stores accessed via `const { client, trading } = useStore()` hook
- Store lifecycle hooks: `onLogout()`, `onClientInit()`, `onNetworkStatusChange()`
- Validation errors built into BaseStore: `validation_errors` observable + `validateProperty()` action
- Stores persist UI state (theme, chart type, sidebar collapse) to localStorage. Last-used trade params are per-browser-tab: they live in sessionStorage keyed by (symbol, trade type) tab (`tab_trade_params_v2` / `tab_trade_params_automation_v2` via `AppV2/Utils/tab-trade-params-utils`), owned by TradeStore's own persistence reaction — never re-add a trade param to `local_storage_properties` (one owner per parameter)
- Stores persist UI state (theme, chart type, sidebar collapse, last-used trade params) to localStorage
- Theme resolution: `ui.theme_preference` (`'system' | 'light' | 'dark'`, default `'system'`) is the source of truth; `ui.is_dark_mode_on` is its resolved output — derived, never persisted — and stays the observable every consumer reads (charts, `ThemeProvider`, GTM, chart markers, `BaseStore.onThemeChange`). Order: `?theme=` param → explicit `theme_preference` → `prefers-color-scheme`. The param is applied in `app.jsx`'s mount effect via `setDarkMode()` as an **explicit choice** — first priority, persisted, and shown as the selected option in the Theme menu (deliberate product decision: a deep link behaves exactly like tapping the switcher, so a parameterised launch overwrites a stored System preference by design; the mount effect runs after `initApp`'s async work, i.e. after the rehydrate timers, so the param lands last and wins). While the preference is `system`, a `matchMedia('(prefers-color-scheme: dark)')` `change` listener re-resolves it live at any viewport width. `setDarkMode()` records an explicit preference, so a system change no longer overrides a chosen theme. `theme_preference` is seeded by parsing `localStorage.ui_store` **synchronously** in the class-field initialiser (`readStoredThemePreference()`), including the legacy read of a bare `is_dark_mode_on` boolean as an explicit choice. Nothing theme-related may be deferred to after `BaseStore.retrieveFromStorage()`: it is a MobX `action`, so the local-storage reaction created alongside it writes `theme_preference` back before any timer queued behind it can read storage. `retrieveFromStorage()` assigns only keys declared in the `*_storage_properties` lists, so stale keys in an old snapshot (like the once-persisted `is_dark_mode_on`) cannot overwrite derived state
- Provider nesting order: Router → StoreProvider → BreakpointProvider → APIProvider → TranslationProvider

## API integration (WebSocket + React Query)

- DerivAPIBasic (@deriv/deriv-api) handles WebSocket protocol (v3 API endpoint)
- React Query handles caching + deduplication
- Single QueryClient shared across packages via `window.ReactQueryClient`
- WebSocket connections reused via `window.WSConnections[wss_url]` global (readyState 0/1 check)
- Subscriptions deduplicated by hashing `{ name, payload }` object
- 30-second keep-alive ping: `send({ time: 1 })`
- Reconnection: exponential backoff starting 500ms
- APIProvider manages connection lifecycle, environment switching (real/demo/custom), subscription cleanup
- Standalone mode: APIProvider creates own WebSocket if `standalone={true}`

## Routing

- Config-based routes (not JSX): arrays of `{ path, component, getTitle, protected, routes }` objects
- Core routes: `packages/core/src/App/Constants/routes-config.js`
- Trader routes: `packages/trader/src/App/Constants/routes-config.ts`
- Rendered via `RouteWithSubRoutes` HOC in `binary-routes.jsx`
- Lazy-loaded modules: `React.lazy(() => import(/* webpackChunkName: "..." */ '@deriv/trader'))`
- Route constants: `@deriv/shared` exports `routes` object (index, contract, reports, positions, profit, statement, etc.)
- Trade params synced to URL: `getTradeURLParams()` / `setTradeURLParams()`
- Mobile `/positions` route uses `PositionsSwitch` component (renders positions page on mobile, redirects + opens flyout on desktop)

## Responsive UI

- Two-component approach: `screen-large.tsx` (desktop) + `screen-small.tsx` (mobile, touch-optimized)
- Selected via `const { isMobile } = useDevice()` hook from @deriv-com/ui
- Loadable dynamic import: `Loadable({ loader: () => isMobile ? import('./screen-small') : import('./screen-large') })`
- Mobile bundle ~40% smaller via code splitting
- RTL support: swipe gestures + button animations respect RTL mode (Arabic)

## Form handling

- No Formik - MobX observables directly for state
- Validation: `validateProperty(name, value)` sets `validation_errors[name]` observable
- Validation rules from `getValidationRules(trade_store)` (MobX observable, triggers re-render)
- Input pattern: `<input value={store.amount} onChange={(e) => store.setAmount(Number(e.target.value))} error={store.validation_errors.amount?.[0]} />`

# Environment

## Required environment variables

- `CROWDIN_URL` - Crowdin API endpoint
- `R2_PROJECT_NAME` - Project name (derivatives-trader)
- `CROWDIN_BRANCH_NAME` - Branch for translations (main)
- `NODE_ENV` - production/development

## Development server

- Webpack dev server runs at `https://localhost:8443`
- HMR enabled (MobX stores persist state during reload)
- Custom server URL override: `localStorage.config.server_url`
- Default WebSocket: `wss://api.deriv.com/websockets/v3`

## Build system (Webpack 5)

- Per-package webpack configs: `packages/{core,trader,reports,components}/build/webpack.config.js`
- Path aliases (App/, Modules/, Stores/, Components/, Utils/, Types/, Sass/) configured in webpack + tsconfig
- Code splitting: core (shell) + trader + reports + vendors + per-route bundles (contract.js, reports.js, 404.js)
- Asset hashing: `[contenthash]` for long-term caching
- Optimization: minimize in production, splitChunks (minSize 100KB, maxSize 2.5MB)
- Plugins: HtmlWebpackPlugin, MiniCssExtractPlugin, CopyPlugin, GitRevisionPlugin, AnalyzerPlugin
- Source maps: production maps included

## Path aliases

```
App/ → src/App/
Modules/ → src/Modules/
Stores/ → src/Stores/
Components/ → src/Components/
Utils/ → src/Utils/
Types/ → src/types/
Sass/ → src/sass/
```

# Gotchas

- `useStore()` must be called inside StoreProvider; throws error otherwise
- Observer HOC required for MobX reactivity: wrap components with `observer()` or they won't re-render on store changes
- MobX enforce actions: `configure({ enforceActions: 'observed' })` is enabled
- Account status handling: platform checks `trading_disabled` status before connecting WebSocket, falls back to demo or public user
- Account status types: `active`, `inactive`, `trading_disabled`
- WebSocket connection reuse: check `window.WSConnections[wss_url]` to avoid duplicate connections
- Global store reference for debugging: `window.__deriv_store.client.email` / `window.__deriv_store.client.logout()`
- Bundle size threshold: check analyze output if adding heavy deps (charts, ace editor)
- TypeScript caches: delete `.tsbuildinfo` + restart TS server in VS Code if IDE shows stale errors
- Mobile bridge detection: use `useMobileBridge().isMobileApp` to hide web-only UI (language selector, logout, support section)
- Duration picker: calendar shows early close/late open red dots for markets with restricted hours (desktop hover only)
- Purchase button: insufficient balance has exactly ONE authority — the **server-reported** path. `is_insufficient_balance` (proposal `error_code` or `common.services_error.code`) leaves Buy _enabled_; the click opens `ServiceErrorSheet` with **Deposit now** / **OK**. There is no client-provable gate: a charge the client can prove exceeds `client.balance` no longer disables Buy, states an inline reason, or withholds the payout — Buy stays pressable and quotes its payout via the normal priced/`-`/skeleton logic in `PurchaseButtonContent`, and the server sheet reports the shortfall on press (`purchase-button.tsx` reads neither `balance` nor `isStakeAboveBalance`). The stake is never capped. The collapsed stake trade parameter (`stake-mobile.tsx` renders `status='neutral'`; `stake-desktop.tsx` renders `has_error={false}`) stays neutral for every stake-field error — front-end validation, a `stake`/`amount` proposal error, or an unaffordable stake — so the error is confined to the stake editor. The mobile/desktop stake inputs still show a balance-aware hint (`getInsufficientBalanceMessage` in `AppV2/Utils/insufficient-balance-utils.tsx`) while drafting a stake above the balance, and both breakpoints disable Save while the hint shows: the mobile action sheet's header Save (`stake-input.tsx`'s `is_save_disabled`/`onSave` both gate on `balance_hint`) and the desktop modal's footer Save (`stake-input-desktop.tsx`'s Save button, `onSave`, and `handleKeyDown` all gate on `balance_hint`). Buy is the only control exempt from the balance gate — it stays pressable and defers to the server-reported path.
- Daily-only expiry seed (symbols whose `duration_units_list` is `['d']` only, e.g. USD/JPY Touch/No Touch): owned exclusively by `TradeStore.processContractsForV2` / `applyDefaultDuration` (via the private `getDailyExpirySeed()`), applied _inside_ the `is_awaiting_contracts_for` proposal hold so the first `proposal` is never built from a placeholder expiry. Duration components (`duration.tsx`, `duration-desktop.tsx`) must only _read_ `expiry_type`/`expiry_date`/`expiry_time` from the store — never write an expiry default on mount — or the same race that caused a guaranteed-to-fail first `proposal` (and off-by-one weekend dates from local-time `+1 day` seeding) comes back.
- Stake editor balance hint: the stake-field error (unaffordable stake, out-of-range amount) is owned solely by the stake editor (`stake-input.tsx` / `stake-input-desktop.tsx`) — the inline message, the input's error status, and Save gating live there and are unchanged. It never leaks to the collapsed stake trade parameter or to Buy (see the Purchase button gotcha above). Both breakpoints disable Save while the balance hint or a validation error shows: the mobile action sheet's header Save (`is_save_disabled`/`onSave` gate on `balance_hint`) and the desktop modal's footer Save (the Save button, `onSave`, and `handleKeyDown` gate on `balance_hint`). Only Buy is exempt from the balance gate, matching its inform-don't-disable stance.
- Language switches in trade parameters: a desktop trade-parameter component that renders text through `localize` must take it from `useTranslations()` — the module-level `localize` export carries no React subscription, so its text stays in the previous language until a refresh (issue #960). Taking the hook is only half of it: `localize` must also appear in every `useMemo`/`useCallback` dependency array that closes over it, or the memoised callback keeps returning the previous language's closure and the re-render changes nothing. Pin it before listing it, though — the hook returns a fresh identity on every render, so listing the raw value satisfies `exhaustive-deps` while memoising nothing (a silent per-render churn, with no lint signal either way). Take the hook, pin it, then list the **pinned** value: `const { localize: localizeForLanguage, instance } = useTranslations();` then `const localize = useCallback(localizeForLanguage, [instance.language]);` (needs an `eslint-disable-next-line react-hooks/exhaustive-deps`). i18next sets `instance.language` before it emits `languageChanged`, so this invalidates on exactly the renders where the language changed. Shadowing the raw value as `localizeForLanguage` keeps the unpinned identity out of scope, so the file cannot regress by accident. Never trigger off `common.current_language` or `useTranslations().currentLang` — both flip when the user _picks_ a language, before the Crowdin bundle has downloaded (see `packages/components/src/hooks/use-document-title.ts`); i18next's `languageChanged`, which `useTranslations()` binds to, is the only moment translated text exists. Every such component must hold its **own** subscription rather than relying on an ancestor's re-render cascading down — an unsubscribed child works only until someone wraps it (or its parent) in `React.memo`, which silently restores the bug with no lint or compiler signal. The mobile `AppV2/Components/TradeParameters/Duration/duration.tsx` is the reference implementation; for the regression test, `__mocks__/translation.mock.js` exports `fireLanguageChanged(lang)` and `__mocks__/language-aware-translations.mock.js` exports `createLanguageAwareTranslationsMock()` — a per-spec opt-in layer that makes the identity-like global mock able to express one key in two languages.
- Error snackbars: every AppV2 error snackbar takes its `style.marginBottom` from `getErrorSnackbarBottomOffset` in `AppV2/Utils/layout-utils.tsx`, which clears the bottom nav **and** `HEIGHT.PURCHASE_BLOCK` on the Trade page so a toast never covers the Buy button. Do not reintroduce a hard-coded `48px`/`-8px` at a call site.
- Proposal expiry: a duration-taking contract never goes on the wire without an expiry. `getDurationParams` falls back to `duration`/`duration_unit` when an `endtime` expiry has no usable `expiry_time`, `processNewValuesAsync` rewrites such a commit to `expiry_type: 'duration'`, and `requestProposal` withholds the request entirely when `hasResolvableExpiry` (`Trading/Helpers/proposal.ts`) is false.
- Theme DOM state has exactly one runtime writer: `changeTheme()` in `packages/core/src/Stores/ui-store.js` (driven by an `autorun` on `is_dark_mode_on`, guarded by `applied_theme` so a no-change run never touches the DOM). It writes the `theme--light`/`theme--dark` body class, the `light`/`dark` `<html>` class and `color-scheme` on `documentElement`, **clears** the inline `--color-surface-primary`/`--color-text-primary` the boot script painted for the pre-CSS loader (so hardcoded values never shadow the brand tokens), and sets `<meta name="theme-color">` from the resolved surface token (brand.config.json via the generated semantic tokens; hex literals in `FALLBACK_SURFACE_COLORS` cover jsdom only). The pre-React boot script in `packages/core/src/index.html` paints the same state before any bundle loads (and duplicates the resolution order in vanilla JS, since it cannot import). Do not add a second writer — a mount-only effect in `app.jsx` used to, and went stale on every theme switch
- `color-scheme` must stay in step with the resolved theme: the static `<meta name="color-scheme" content="light dark">` in `index.html` tells automatic dark-theme features (Samsung Internet, Chrome auto dark) not to force-darken the page, and the `color-scheme` property on `:root` says which scheme is actually in use. Without them the browser force-darkens CSS-painted surfaces but cannot reach the canvas-rendered chart, so page and chart disagree (issue #1177). `.theme--light`/`.theme--dark` in `packages/shared/src/styles/tokens/semantic.scss` carry a CSS-side backstop — that file is generated, so change `scripts/generate-colors.js` alongside it
- SmartCharts version: `@deriv-com/smartcharts-champion@^1.10.8` with `keepPreviousData` strategy for symbol switches. The chart is a Flutter Web canvas build: it reads no app CSS, so `settings.theme` (derived from `is_dark_mode_on`) is the only thing that keeps it in the page's theme
- Derived market ordering: the Derived (`synthetic_index`) section order lives in exactly one table — `DERIVED_SECTION_ORDER` in `AppV2/Utils/market-ordering-utils.ts` — read by two consumers. `sortSymbols` ranks submarkets with `getDerivedSubmarketRank` in its **decoration** pass (never in the comparator, or the 28-call `localize` INP guard in `sort-symbols-utils.spec.ts` breaks), and `groupSymbolsForList` takes its subgroup section order from the derived `DERIVED_SUBGROUP_ORDER`. Both spellings of an alias pair (`crash_boom`/`crash_index` and friends — live `active_symbols` sends the second) share one rank; every uncurated submarket, Derived (`range_index`) or not, gets `CURATED_RANK_ABSENT` and falls through to the existing localized-name `localeCompare`, which is why no non-Derived market's order moved. `groupSymbolsBySubmarket` is deliberately left on encounter order — `market-search-results.tsx` depends on it, so there is no third sort.
- API error copy: `mapErrorMessage` humanizes raw API parameter names via the glossary in `error-mapping/api-parameter-labels.ts` (`date_expiry` → "end time"), applied to `code_args` and to the unmapped-fallback `error.message`. An unmapped message still holding a lowercase snake_case identifier is replaced by the generic message rather than leaked. Adding an authored `localize(...)` template with a snake_case identifier fails the guard test in `error-message-mapper.spec.ts` (`describe('authored error copy')`) — use a glossary label instead. Values (`R_100`, `MULTUP`, `+207.90`) are uppercase or numeric and pass through untouched.

# Repo etiquette

- Feature flags stored in `@deriv/api` remote config (no rebuild required)
- Analytics: track events via `trackAnalyticsEvent(name, payload)` from @deriv/shared
- Mobile app integration: `ce_dtrader_app_v2` event with `action: 'open'` fired after auth completes
- Multi-brand support: deriv.com, deriv.be, deriv.me (URLs adapt to current domain via `@deriv/shared` brand utilities)
- Brand config: `brand.config.json` (no hardcoded domain assumptions)

# Reference

## Key file locations

- Store initialization: `packages/core/src/App/initStore.js`
- Root component: `packages/core/src/App/app.jsx`
- Main trading state: `packages/trader/src/Stores/Modules/Trading/trade-store.ts` (103KB)
- WebSocket + QueryClient: `packages/api/src/APIProvider.tsx`
- Subscription hook: `packages/api/src/useSubscription.ts`
- Contract utilities: `packages/shared/src/utils/contract/contract-types.ts`
- Core routes: `packages/core/src/App/Constants/routes-config.js`
- Trader routes: `packages/trader/src/App/Constants/routes-config.ts`
- Trade form: `packages/trader/src/Modules/Trading/Components/Form/`
- Brand config: `packages/shared/src/utils/brand/brand.ts`, `brand.config.json`
- Positions routing: `packages/trader/src/AppV2/Routes/PositionsSwitch.tsx`
- Market indicators: `packages/trader/src/AppV2/Components/TradeParameters/Duration/early-close-dot.tsx`
- Jest config: root `jest.config.js`
- Webpack config: `packages/core/build/webpack.config.js`

## Store structure (RootStore modules)

- `client`: ClientStore (auth, user profile, accounts)
- `common`: CommonStore (platform config, language, theme)
- `ui`: UIStore (modal states, notifications, UI toggles, theme: `theme_preference` + resolved `is_dark_mode_on`, set via `setThemePreference`)
- `modules`: ModulesStore (Trading, Markets, Positions, Reports)
- `notifications`: NotificationStore (toast queue)
- `portfolio`: PortfolioStore (open positions, balance)
- `active_symbols`: ActiveSymbolsStore (market data)
- `contract_trade`: ContractTradeStore (contract state)
- `contract_replay`: ContractReplayStore (replay functionality)
- `traders_hub`: TradersHubStore (hub/dashboard state)
- `gtm`: GTMStore (analytics tracking)

## BaseStore features

- Storage modes: `BaseStore.STORAGES.LOCAL_STORAGE`, `BaseStore.STORAGES.SESSION_STORAGE`
- Observable: `validation_errors`
- Actions: `validateProperty(name, value)`
- Lifecycle: `onLogout()`, `onClientInit()`, `onNetworkStatusChange()`
- Persistence: auto-sync to localStorage/sessionStorage via mobx-persist-store
- Disposal: cleanup pattern for unmount

## TradeStore computed properties

- `barriers`: derives barriers from spot price
- `is_market_closed`: checks trading hours
- `price_proposal`: cached proposal
- `is_valid`: computed from validation_errors length

## API hook patterns

```typescript
// Fetch once
const { data, isLoading, error } = useQuery(name, { payload });

// Stream updates
const { subscribe, unsubscribe, isLoading, data, error } = useSubscription(name);
subscribe({ payload });

// Send request
const { mutate, isLoading } = useMutation(name);
mutate({ payload });

// Cache invalidation
const invalidateQuery = useInvalidateQuery();
invalidateQuery([name]);
```

## Error handling patterns

```typescript
// API errors
const { data, error } = useQuery('active_symbols', {});
if (error?.code === 'InvalidToken') {
    store.client.logout();
}

// Store validation
@observable validation_errors: Record<string, string[]> = {};
validateProperty(property, value) {
    if (!value) {
        this.validation_errors[property] = ['This field is required'];
    }
}
```

## Performance patterns

```typescript
// Memoization
const Screen = React.useMemo(() => (isMobile ? SmallScreen : LargeScreen), [isMobile]);

// Computed (MobX)
@computed get is_valid() {
    return Object.keys(this.validation_errors).length === 0;
}

// Lazy loading
const LazyModule = React.lazy(() => import('./Module'));
<React.Suspense fallback={<Spinner />}><LazyModule /></React.Suspense>
```

## API type exports from @deriv/api

- TActiveSymbolsRequest, TActiveSymbolsResponse
- TBuyContractRequest, TBuyContractResponse
- TPriceProposalRequest, TPriceProposalResponse
- TSocketError<T extends TSocketEndpointNames>
- 100+ trading types exported

## Account switcher behavior

- Trading disabled accounts: reduced opacity + disabled cursor
- Label: "Trading disabled" shown below account type
- Interaction: accounts cannot be selected
- Color: disabled text color applied

## Mobile bridge hidden features

- Language selector (native app controls)
- Logout button (native app handles)
- Support section (native app provides own)
- Settings menu items (native app manages)

## Debugging tools

- React DevTools (component props/state)
- MobX DevTools (action trace)
- Redux DevTools (snapshot timeline if configured)
- Global store: `window.__deriv_store.client`, `window.__deriv_store.trading`
- Network panel: WebSocket messages to `wss://api.deriv.com/websockets/v3`

## Resources

- MobX Docs: https://mobx.js.org
- React Query Docs: https://tanstack.com/query
- Deriv API Docs: https://api.deriv.com
- TypeScript Handbook: https://www.typescriptlang.org/docs
- Webpack Docs: https://webpack.js.org
- Claude Code Best Practices: https://code.claude.com/docs/en/best-practices

## Project stats

- Monorepo with 8 packages
- ~210K lines of code
- React 18 + MobX 6 + TypeScript 5 + Webpack 5 + Jest 29
- Last updated: 2025-01-16

---

# Playwright E2E Tests

All Playwright rules, conventions, and skill-loading instructions live in `playwright/AGENTS.md` (`playwright/CLAUDE.md` symlinks it for Claude Code).
