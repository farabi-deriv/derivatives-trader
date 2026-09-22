# mobile-bridge-removal Specification

## Purpose
TBD - created by archiving change c10-mobile-bridge-removal. Update Purpose after archive.
## Requirements
### Requirement: [MBR-001] The bridge hook, its detection and its types are removed

The `useMobileBridge` hook (`packages/api/src/hooks/useMobileBridge.ts`), its spec, and its export line in `packages/api/src/hooks/index.ts` SHALL be deleted. The `DerivAppChannel`, `DerivAppChannelMessage` and `TradingConfigData` declarations and the `Window.DerivAppChannel?` member in `types/global.d.ts` SHALL be removed. No `is_mobile_app` query-parameter or sessionStorage read, and no reference to `window.DerivAppChannel`, SHALL remain in `packages/*/src`.

#### Scenario: No bridge symbols remain

- **WHEN** the change lands and `packages/*/src` (plus `types/global.d.ts`) is searched for `useMobileBridge`, `DerivAppChannel`, `is_mobile_app`, `isMobileApp`, `isBridgeAvailable` or `sendBridgeEvent`
- **THEN** the search returns zero hits, and the deleted files no longer exist

#### Scenario: A host launching with is_mobile_app gets the web app

- **WHEN** DTrader is opened with `?is_mobile_app=true` and a `window.DerivAppChannel` injected
- **THEN** DTrader behaves exactly as the ordinary web app and emits no `trading:*` postMessage

### Requirement: [MBR-002] Every bridge event send collapses to its web fallback

Each `sendBridgeEvent(event, fallback)` call site SHALL be replaced by directly performing the former web fallback, which becomes the sole behaviour: logout (`menu.tsx`'s `handleLogout`, `sidebar.tsx`'s `handleLogout`), the Home brand-URL redirect (`bottom-nav.tsx` home action, `sidebar.tsx`'s `handleHomeClick`), the transfer/Deposit brand-URL redirect (`account-actions.tsx`, `account-header.tsx`, `service-error-sheet.tsx` Deposit-now action, `insufficient-balance-modal.tsx`), and the account-creation brand-URL redirect (`try-real-modal.tsx`). The `trading:config` effect in `packages/core/src/App/AppContent.tsx` and the `trading:ready` effect in `packages/core/src/App/app.jsx` SHALL be removed entirely, together with any import (e.g. `getInitialLanguage` in `AppContent.tsx`) left unused by that removal.

#### Scenario: Logout still logs the user out

- **WHEN** a logged-in user taps Log out from the mobile menu or the sidebar
- **THEN** the client logout runs directly (no bridge call) and the user is logged out

#### Scenario: Deposit still redirects to the brand transfer URL

- **WHEN** a real-account user triggers Deposit/transfer from any of the four transfer call sites
- **THEN** the browser navigates to the `getBrandUrl()` transfer URL that was the fallback, with no bridge attempt

#### Scenario: Config/ready effects are gone

- **WHEN** language or theme changes, or the app mounts
- **THEN** no `trading:config`/`trading:ready` work runs and no import is left dangling

### Requirement: [MBR-003] Bridge-conditional UI is restored to its web form

The `!isMobileApp` guards in `packages/core/src/Modules/Menu/menu.tsx` SHALL be removed so the Language menu item, the Language drawer, the Support section and the Log out item always render for a mobile web user. The `isBridgeAvailable ? 'Back to app' : 'Log out'` logout label in `sidebar.tsx` SHALL become `'Log out'`. The `!isBridgeAvailable` conditions on the "View all" trade-types button (`trade-types.tsx`) and the positions onboarding guide (`positions.tsx`, together with its stale `TODO` comment) SHALL be removed. The bridge-only description-preload effect in `trade-description.tsx` SHALL be deleted.

#### Scenario: Web-only menu items always show

- **WHEN** the mobile menu renders for a logged-in web user
- **THEN** Language, Support and Log out are all present (previously hidden when `isMobileApp`)

#### Scenario: Sidebar logout reads "Log out"

- **WHEN** the sidebar utility items render
- **THEN** the logout item is labelled "Log out" with no "Back to app" variant

### Requirement: [MBR-004] The native-app trade-type restriction is removed

`useNativeAppAllowedTradeTypes.ts` and its spec SHALL be deleted. The now-dead optional `nativeAppAllowedTradeTypes?` parameter and its filter branch SHALL be removed from `getTradeTypesList` and `getAvailableContracts` (`trade-types-utils.tsx`) and from `getAvailableContractTypes` (`trading-contract-type-helpers.tsx`), and the three consumers `useContractsFor.ts`, `useAvailableContracts.ts` and `useGuideContractTypes.ts` SHALL stop passing it (dropping the `isMobileApp && nativeAppAllowedTradeTypes === undefined` wait-guard in `useContractsFor.ts` and updating effect/memo dependency arrays). `native_app_allowed_trade_types` SHALL be removed from `packages/api/src/remote_config.json`; `tracking_rudderstack` and `tracking_posthog` SHALL be kept.

#### Scenario: Offered trade types are the full web set

- **WHEN** `contracts_for` resolves for a symbol
- **THEN** the offered trade types are the server-available set with no remote-config allow-list filtering applied

#### Scenario: Remote config drops only the native-app key

- **WHEN** `packages/api/src/remote_config.json` is read after the change
- **THEN** `native_app_allowed_trade_types` is gone while `tracking_rudderstack` and `tracking_posthog` remain

### Requirement: [MBR-005] The vanilla-JS native-app bootstrap hooks are removed

The `is_mobile_app` loader-hiding block in `packages/core/src/index.html` (which set `--initial-loader-display: none`) SHALL be removed. The `is_mobile_app && ory_cookie_link` Ory recovery-link block in `packages/core/src/App/initStore.js`, together with its `is_mobile_app` and `ory_cookie_link` param reads, SHALL be removed. The rest of `initStore` (whoami sequencing, the `action=signup` clean-setup branch) and the rest of `index.html` (theme boot script, anti-clickjack, URL handler) SHALL be unchanged.

#### Scenario: Loader and Ory bootstrap no longer branch on is_mobile_app

- **WHEN** `index.html` and `initStore.js` are read after the change
- **THEN** neither reads `is_mobile_app`, the Ory recovery-link fetch is gone, and the surrounding boot/init logic is otherwise intact

### Requirement: [MBR-006] Adjacent non-bridge surfaces are preserved

The `ce_dtrader_app_v2` analytics event fired unconditionally on auth-resolved app open in `packages/trader/src/AppV2/app.tsx` SHALL NOT be removed or gated — it is general AppV2 analytics, not a bridge event. The `tracking_rudderstack` and `tracking_posthog` remote-config flags, the `TryRealModal` / `toggleTryRealModal` / `is_try_real_modal_visible` upsell surface, and the `getBrandUrl()` transfer/home/onboarding redirect URLs (now the sole behaviour) SHALL all remain live.

#### Scenario: App-open analytics still fires

- **WHEN** the AppV2 app mounts and auth resolves
- **THEN** `trackAnalyticsEvent('ce_dtrader_app_v2', { action: 'open' })` still fires

#### Scenario: Try-real upsell still opens

- **WHEN** a demo-only user triggers the Try-real path
- **THEN** `TryRealModal` opens and its Complete-setup action redirects to the onboarding brand URL

### Requirement: [MBR-007] The change leaves a green tree with no bridge residue

After the change, `npm run build:all`, `npm run test:jest` and `npm run check-imports` SHALL pass, and the bridge-affected `__tests__` SHALL be updated (their `useMobileBridge`/`useNativeAppAllowedTradeTypes` mocks and branches removed) so the suite is green without referencing deleted symbols.

#### Scenario: Build and tests pass with no dangling bridge references

- **WHEN** the change lands
- **THEN** `build:all`, `test:jest` and `check-imports` pass and no test imports or mocks a deleted bridge symbol

### Requirement: [MBR-008] Bridge documentation is updated

`CLAUDE.md` SHALL be updated so it no longer instructs use of `useMobileBridge().isMobileApp` to hide web-only UI and no longer describes the "Mobile bridge hidden features" as native-controlled; the `ce_dtrader_app_v2` note MAY remain since that event is kept.

#### Scenario: CLAUDE.md no longer documents the bridge

- **WHEN** `CLAUDE.md` is read after the change
- **THEN** it contains no `useMobileBridge` guidance and no mobile-bridge hidden-features section presenting language/logout/support as native-app-controlled

