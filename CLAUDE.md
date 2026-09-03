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
- Stores persist UI state (theme, chart type, sidebar collapse, last-used trade params) to localStorage
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
- Purchase button: two separate insufficient-balance mechanisms with a deliberate boundary. (1) **Client-provable** — when the proposal's charge (`proposal_info[trade_type].stake`, i.e. `proposal.ask_price`, which already includes multiplier commission + DC fee) exceeds a *readable* `client.balance`, Buy is disabled, an inline reason renders directly above it (`purchase-button-balance-message.tsx`, a Fragment sibling of `.purchase-button__wrapper` — never a wrapper, or desktop's `.trade-params__content >` rule stops matching), and the payout amount is withheld via `PurchaseButtonContent`'s existing `-` placeholder (label kept, skeleton unreachable). A readable `0` engages it; an unreadable balance, an unpriced proposal, a logged-out user or an in-flight account switch leave it fully inert. (2) **Server-reported** — `is_insufficient_balance` (proposal `error_code` or `common.services_error.code`) is unchanged: Buy stays *enabled* and the click still opens `ServiceErrorSheet` with **Deposit now** / **OK**, which remains the authority for anything the client can't predict. The stake is never capped. The mobile/desktop stake inputs separately show a balance-aware hint (`getInsufficientBalanceMessage` in `AppV2/Utils/insufficient-balance-utils.tsx` — the shared source for both sentences) while drafting a stake above the balance. The two breakpoints diverge on Save: the mobile action sheet's header Save is disabled while the hint is showing (`stake-input.tsx`'s `is_save_disabled`/`onSave` both gate on `balance_hint`); the desktop modal's footer Save stays enabled and deliberately commits an unaffordable stake, because the Buy gate is what makes that state visible on the trade page.
- Daily-only expiry seed (symbols whose `duration_units_list` is `['d']` only, e.g. USD/JPY Touch/No Touch): owned exclusively by `TradeStore.processContractsForV2` / `applyDefaultDuration` (via the private `getDailyExpirySeed()`), applied _inside_ the `is_awaiting_contracts_for` proposal hold so the first `proposal` is never built from a placeholder expiry. Duration components (`duration.tsx`, `duration-desktop.tsx`) must only _read_ `expiry_type`/`expiry_date`/`expiry_time` from the store — never write an expiry default on mount — or the same race that caused a guaranteed-to-fail first `proposal` (and off-by-one weekend dates from local-time `+1 day` seeding) comes back.
- Purchase button: allows attempts with insufficient balance (shows error modal, doesn't disable button). The modal itself keeps the existing mapped/backend message unconditionally (unchanged). The mobile/desktop stake inputs separately show a balance-aware hint (`getInsufficientBalanceMessage` in `AppV2/Utils/insufficient-balance-utils.tsx`) while drafting a stake above the balance. The two breakpoints diverge on Save: the mobile action sheet's header Save is disabled while the hint is showing (`stake-input.tsx`'s `is_save_disabled`/`onSave` both gate on `balance_hint`); the desktop modal's footer Save stays enabled, matching Buy's inform-don't-disable stance.
- Error snackbars: every AppV2 error snackbar takes its `style.marginBottom` from `getErrorSnackbarBottomOffset` in `AppV2/Utils/layout-utils.tsx`, which clears the bottom nav **and** `HEIGHT.PURCHASE_BLOCK` on the Trade page so a toast never covers the Buy button. Do not reintroduce a hard-coded `48px`/`-8px` at a call site.
- Proposal expiry: a duration-taking contract never goes on the wire without an expiry. `getDurationParams` falls back to `duration`/`duration_unit` when an `endtime` expiry has no usable `expiry_time`, `processNewValuesAsync` rewrites such a commit to `expiry_type: 'duration'`, and `requestProposal` withholds the request entirely when `hasResolvableExpiry` (`Trading/Helpers/proposal.ts`) is false.
- SmartCharts version: `@deriv-com/smartcharts-champion@1.9.6` with `keepPreviousData` strategy for symbol switches
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
- `ui`: UIStore (modal states, notifications, UI toggles)
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

All Playwright rules, conventions, and skill-loading instructions live in `playwright/CLAUDE.md`.
