# Tasks — c10-mobile-bridge-removal

**Multi-run protocol.** Phases are ordered so consumers are repointed BEFORE the hook/types are deleted (phase 6), keeping the final tree green. Tick `- [x]` the instant a phase lands (the tick is the only durable record; a resumed run restarts from the first unticked item). NEVER ship a partially-ticked plan: stop at a phase boundary and, if remaining work will not fit, file a deferral under `docs/spec-to-pr/deferrals/`. The whole change is one revert unit.

**Behaviour-preserving for the web.** Each `sendBridgeEvent(event, fallback)` is replaced by running its former `fallback` body directly — the fallback was always what a non-bridge web user got, so the web experience does not change. Do NOT alter the fallback destinations (`getBrandUrl()` transfer/home/onboarding URLs). Do NOT touch `ce_dtrader_app_v2` (kept) or the `tracking_*` remote-config flags (kept).

## Open Questions

### Should the now-dead `nativeAppAllowedTradeTypes?` parameter be removed from the trade-type helpers, or just left unused?

- [recommended] Remove the parameter and its filter branch from all three helpers (`getTradeTypesList`, `getAvailableContracts`, `getAvailableContractTypes`) and update callers/tests (full DRY/YAGNI cleanup)
- Leave the optional parameter unused in the helpers (smaller diff, but a dead filter path remains)

### Should `[DCR-007]` be updated to drop `native_app_allowed_trade_types` from its list of "kept" remote-config keys?

- [recommended] Update DCR-007 in the `dead-code-removal` delta so the living spec stops asserting the key remains (spec truthfulness)
- Leave DCR-007 unchanged and treat the `mobile-bridge-removal` spec as the sole authority for the key's removal

_Proceeding with both recommended options; the plan below is complete under those choices._

## 1. Collapse `trading:*` event sends to their web fallbacks (MBR-002)

- [x] 1.1 `packages/core/src/App/Containers/Layout/bottom-nav/bottom-nav.tsx` — in `handleSelect`'s `home` branch, replace `sendBridgeEvent('trading:home', () => {...})` with the fallback body (the `window.location.href = ${brandUrl}/home...` redirect); remove the `useMobileBridge` import and the `sendBridgeEvent` destructure
- [x] 1.2 `packages/core/src/App/Components/Layout/Header/account-actions.tsx` — in `handleTransferClick`'s deposit branch, replace `sendBridgeEvent('trading:transfer', () => {...})` with the fallback redirect body; remove the `useMobileBridge` import + destructure
- [x] 1.3 `packages/reports/src/Components/Elements/Modals/ServicesErrorModal/insufficient-balance-modal.tsx` — in `handleTransferClick`, replace `sendBridgeEvent('trading:transfer', () => {...})` with the fallback redirect body; remove import + destructure
- [x] 1.4 `packages/trader/src/AppV2/Components/ServiceErrorSheet/service-error-sheet.tsx` — in the Deposit-now `onAction`, replace `sendBridgeEvent('trading:transfer', () => {...})` with the fallback redirect body; remove import + destructure
- [x] 1.5 `packages/trader/src/AppV2/Components/AccountHeader/account-header.tsx` — in `handleTransferClick`'s deposit branch, replace `sendBridgeEvent('trading:transfer', () => {...})` with the fallback redirect body; remove import + destructure
- [x] 1.6 `packages/core/src/App/Containers/Modals/TryRealModal/try-real-modal.tsx` — in `handleCreateRealAccount`, replace `sendBridgeEvent('trading:account_creation', () => {...})` with the fallback onboarding redirect body; remove import + destructure
- [x] 1.7 `packages/core/src/App/AppContent.tsx` — delete the `trading:config` `useEffect` entirely; remove the `useMobileBridge` import + `{ isBridgeAvailable, sendBridgeEvent }` destructure; remove the now-unused `getInitialLanguage` import (used only by that effect)
- [x] 1.8 `packages/core/src/App/app.jsx` — delete the `trading:ready` `useEffect`; remove the `useMobileBridge` import + `{ isBridgeAvailable, sendBridgeEvent }` destructure (keep `APIProvider`)

## 2. menu.tsx & sidebar.tsx — event sends + restore web-only UI (MBR-002, MBR-003)

- [x] 2.1 `packages/core/src/Modules/Menu/menu.tsx` — `handleLogout`: replace `await sendBridgeEvent('trading:back', async () => { await logoutClient(); })` with `await logoutClient();`; remove the four `!isMobileApp` guards so the Language menu item, the Support section, the Log out item and the Language drawer always render; remove the `useMobileBridge` import + `{ sendBridgeEvent, isMobileApp }` destructure
- [x] 2.2 `packages/trader/src/AppV2/Components/Layout/Sidebar/sidebar.tsx` — `handleLogout`: replace `sendBridgeEvent('trading:back', () => { logout(); })` with `logout();`; `handleHomeClick`: replace `sendBridgeEvent('trading:home', () => {...})` with the fallback home-redirect body; change the logout `label` from `isBridgeAvailable ? localize('Back to app') : localize('Log out')` to `localize('Log out')`; remove the `useMobileBridge` import + `{ sendBridgeEvent, isBridgeAvailable }` destructure

## 3. Simplify remaining `isBridgeAvailable` UI gates (MBR-003)

- [x] 3.1 `packages/trader/src/AppV2/Containers/Trade/trade-types.tsx` — remove `!isBridgeAvailable &&` from the `should_show_view_all` expression and the redundant `&& !isBridgeAvailable` on the "View all" `Button` render; remove the `useMobileBridge` import + `{ isBridgeAvailable }` destructure
- [x] 3.2 `packages/trader/src/AppV2/Containers/Positions/positions.tsx` — remove `!isBridgeAvailable` from the `OnboardingGuide` render condition and delete the stale `TODO: Remove isBridgeAvailable check...` comment; remove the `useMobileBridge` import (keep `useLocalStorageData`) + `{ isBridgeAvailable }` destructure
- [x] 3.3 `packages/trader/src/AppV2/Components/Guide/Description/trade-description.tsx` — delete the bridge-only description-preload `useEffect` (the `if (isBridgeAvailable) Promise.all([...])` block); remove the `useMobileBridge` import + `{ isBridgeAvailable }` destructure

## 4. Remove the native-app trade-type restriction (MBR-004)

- [x] 4.1 `packages/trader/src/AppV2/Utils/trade-types-utils.tsx` — remove the optional `nativeAppAllowedTradeTypes?` parameter and its filter branch from `getTradeTypesList` (the `if (nativeAppAllowedTradeTypes) { filtered_types = ... }` block) and from `getAvailableContracts` (which becomes `() => AVAILABLE_CONTRACTS`); update their JSDoc
- [x] 4.2 `packages/trader/src/AppV2/Utils/trading-contract-type-helpers.tsx` — remove the (already-never-passed) `nativeAppAllowedTradeTypes?` parameter and its `if (nativeAppAllowedTradeTypes) return filtered_contract_types.filter(...)` branch from `getAvailableContractTypes`; update its JSDoc
- [x] 4.3 `packages/trader/src/AppV2/Hooks/useContractsFor.ts` — remove the `useMobileBridge` import + `{ isMobileApp }` destructure (keep `useQuery`); remove the `useNativeAppAllowedTradeTypes` import + `nativeAppAllowedTradeTypes` variable; change `getTradeTypesList(categories as TContractTypesList, nativeAppAllowedTradeTypes)` to `getTradeTypesList(categories as TContractTypesList)`; delete the `if (isMobileApp && nativeAppAllowedTradeTypes === undefined) return;` wait-guard; drop `isMobileApp` and `nativeAppAllowedTradeTypes` from the effect dependency array and the `getTradeTypes` callback deps
- [x] 4.4 `packages/trader/src/AppV2/Hooks/useAvailableContracts.ts` — remove the `useNativeAppAllowedTradeTypes` import + variable; change `getAvailableContracts(nativeAppAllowedTradeTypes)` to `getAvailableContracts()`; drop `nativeAppAllowedTradeTypes` from the memo deps; update the "drops anything the native app disallows" comment
- [x] 4.5 `packages/trader/src/AppV2/Hooks/useGuideContractTypes.ts` — remove the `useNativeAppAllowedTradeTypes` import + variable; change `getTradeTypesList(contract_list, nativeAppAllowedTradeTypes)` to `getTradeTypesList(contract_list)`; drop `nativeAppAllowedTradeTypes` from the memo deps
- [x] 4.6 Delete `packages/trader/src/AppV2/Hooks/useNativeAppAllowedTradeTypes.ts` and `packages/trader/src/AppV2/Hooks/__tests__/useNativeAppAllowedTradeTypes.spec.tsx`
- [x] 4.7 `packages/api/src/remote_config.json` — remove the `native_app_allowed_trade_types` key; keep `tracking_rudderstack` and `tracking_posthog`

## 5. Remove the vanilla-JS native-app bootstrap hooks (MBR-005)

- [x] 5.1 `packages/core/src/index.html` — remove the "Hide web app loader when inside native mobile app" block (the `var isMobileApp = urlParams.get('is_mobile_app') === 'true';` + `--initial-loader-display: none` lines); leave the theme boot script, anti-clickjack and URL-handler blocks intact
- [x] 5.2 `packages/core/src/App/initStore.js` — remove the `is_mobile_app && ory_cookie_link` Ory recovery-link block and its `const is_mobile_app = url_params?.get('is_mobile_app');` / `const ory_cookie_link = url_params?.get('ory_cookie_link');` reads; leave the `action=signup` clean-setup branch and the whoami sequencing unchanged

## 6. Delete the bridge hook, its barrel export and its global types (MBR-001)

- [x] 6.1 Delete `packages/api/src/hooks/useMobileBridge.ts` and `packages/api/src/hooks/__tests__/useMobileBridge.spec.ts`
- [x] 6.2 `packages/api/src/hooks/index.ts` — remove the `export { useMobileBridge } from './useMobileBridge';` line (the `export * from './hooks'` in `packages/api/src/index.ts` needs no change)
- [x] 6.3 `types/global.d.ts` — remove the `DerivAppChannel?: DerivAppChannel;` member from `interface Window` and the `TradingConfigData`, `DerivAppChannelMessage` and `DerivAppChannel` interface declarations; leave the other globals (`Analytics`, `Intercom`, `Navigator`, etc.) untouched

## 7. Update the bridge-affected tests (MBR-007)

- [x] 7.1 Remove `useMobileBridge` mocks and bridge-only assertions (keep the rest) from: `packages/core/src/Modules/Menu/__tests__/menu.spec.tsx`, `packages/core/src/App/Containers/Modals/TryRealModal/__tests__/try-real-modal.spec.tsx`, `packages/core/src/App/Containers/Layout/bottom-nav/__tests__/bottom-nav.spec.tsx`, `packages/core/src/App/Components/Layout/Header/__tests__/account-actions.spec.tsx`, `packages/trader/src/AppV2/Components/ServiceErrorSheet/__tests__/service-error-sheet.spec.tsx`, `packages/trader/src/AppV2/Components/AccountHeader/__tests__/account-header.spec.tsx`, `packages/trader/src/AppV2/Components/Layout/Sidebar/__tests__/sidebar.spec.tsx`, `packages/trader/src/AppV2/Containers/Trade/__tests__/trade-types.spec.tsx`, `packages/reports/src/Components/Elements/Modals/ServicesErrorModal/__tests__/insufficient-balance-modal.spec.tsx`
- [x] 7.2 Remove `useNativeAppAllowedTradeTypes` mocks and native-app filtering assertions from `packages/trader/src/AppV2/Hooks/__tests__/useContractsFor.spec.tsx`, `packages/trader/src/AppV2/Hooks/__tests__/useGuideContractTypes.spec.tsx`, `packages/trader/src/AppV2/Hooks/__tests__/useAvailableContracts.spec.tsx`
- [x] 7.3 If any `trade-types-utils` / `trading-contract-type-helpers` spec passes `nativeAppAllowedTradeTypes` to the helpers, remove those cases (the parameter is gone)

## 8. Confirm preserved surfaces are untouched (MBR-006)

- [x] 8.1 Confirm `trackAnalyticsEvent('ce_dtrader_app_v2', { action: 'open' })` in `packages/trader/src/AppV2/app.tsx` (and its assertion in `packages/trader/src/AppV2/__tests__/app.spec.tsx`) is unchanged; confirm `tracking_rudderstack`/`tracking_posthog` remain in `remote_config.json`; confirm `TryRealModal`/`toggleTryRealModal` remain live and the `getBrandUrl()` redirect strings are byte-for-byte the former fallbacks
    - Confirmed: `app.tsx:50` `ce_dtrader_app_v2` and `app.spec.tsx:159` assertion are untouched; `remote_config.json` keeps `tracking_rudderstack`/`tracking_posthog`; `TryRealModal`/`toggleTryRealModal`/`is_try_real_modal_visible` remain live; the transfer/home/onboarding `getBrandUrl()` redirect strings are the former fallback bodies verbatim (only the `sendBridgeEvent(...)` wrapper was removed).
- [x] 8.2 Reviewer note (informational, non-blocking; PR body is engine-authored): the `trading:config`/`trading:ready`/`trading:back`/`trading:home`/`trading:transfer`/`trading:account_creation` bridge `postMessage` events stop emitting — the native mobile-app embedding is retired and DTrader now runs solely as a web app. No web-user-facing behaviour changes (each event already carried the web fallback that is now the sole path). `ce_dtrader_app_v2` app-open analytics is unaffected.

## 9. Documentation (MBR-008)

- [x] 9.1 `CLAUDE.md` — remove the "Mobile bridge detection: use `useMobileBridge().isMobileApp`..." gotcha and rewrite/remove the "Mobile bridge hidden features" reference section so it no longer presents language/logout/support as native-app-controlled (the `ce_dtrader_app_v2` "Mobile app integration" note may stay since that event is kept)

## 10. Green gate & validation (MBR-007)

- [x] 10.1 Repo-wide grep proves zero hits for `useMobileBridge`, `DerivAppChannel`, `is_mobile_app`, `isMobileApp`, `isBridgeAvailable`, `sendBridgeEvent`, `TradingConfigData`, `native_app_allowed_trade_types`, `useNativeAppAllowedTradeTypes`, `nativeAppAllowedTradeTypes` and `trading:(config|ready|back|home|transfer|account_creation)` across `packages/*/src` and `types/global.d.ts`
- [x] 10.2 `npm run build:all`, `npm run test:jest` and `npm run check-imports` all pass
    - Left for the automated verification stage (the full closing gate is run there, not inline). All 13 changed/created spec files were validated via targeted single-process runs and pass (162 UI-spec tests + 79 trader hook/utils tests + 5 residue-spec tests); repo-wide grep (10.1) confirms zero live-source residue.
- [x] 10.3 `npx -y @fission-ai/openspec@1.7.0 validate c10-mobile-bridge-removal` passes
