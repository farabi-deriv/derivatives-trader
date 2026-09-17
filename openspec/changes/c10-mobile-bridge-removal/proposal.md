## Why

The DerivAppChannel "mobile bridge" — the `is_mobile_app`/`window.DerivAppChannel` integration that lets DTrader run embedded in the native Deriv mobile app — is being retired (c10). While it is active it forks live behaviour across ~20 files: it hides web-only UI (language, support, logout), restricts the offered trade types to a remote-config allow-list, and swaps navigation/logout/deposit actions for `postMessage` calls to the native shell. Removing it collapses every fork back to the single web code path (the existing fallbacks), deletes the bridge hook, its detection, its global types and its remote-config allow-list, and leaves DTrader a plain web app again.

## What Changes

- **BREAKING (embedding contract):** the `is_mobile_app` query param / `is_mobile_app` sessionStorage flag and the `window.DerivAppChannel` postMessage channel are no longer honoured. A host that launches DTrader with `?is_mobile_app=true` gets the ordinary web experience; no `trading:*` events are emitted.
- Delete the bridge hook `packages/api/src/hooks/useMobileBridge.ts` (+ its spec + its barrel export) and the `DerivAppChannel`/`DerivAppChannelMessage`/`TradingConfigData` global declarations in `types/global.d.ts`.
- Collapse every `sendBridgeEvent(event, fallback)` call site to run its former web fallback directly — logout (`menu.tsx`, `sidebar.tsx`), Home redirect (`bottom-nav.tsx`, `sidebar.tsx`), transfer/Deposit redirect (`account-actions.tsx`, `account-header.tsx`, `service-error-sheet.tsx`, `insufficient-balance-modal.tsx`), account-creation redirect (`try-real-modal.tsx`). Remove the `trading:config` effect (`AppContent.tsx`) and the `trading:ready` effect (`app.jsx`) outright.
- Unconditionally render the web-only menu items previously hidden by `!isMobileApp` (Language item + drawer, Support section, Log out) in `menu.tsx`; drop the `isBridgeAvailable` "Back to app" logout label in `sidebar.tsx`; drop the `!isBridgeAvailable` gates on the trade-types "View all" button and the positions onboarding guide; remove the bridge-only description preload effect in `trade-description.tsx`.
- Remove the native-app trade-type restriction: delete `useNativeAppAllowedTradeTypes.ts` (+ spec), drop the now-dead `nativeAppAllowedTradeTypes?` parameter + filter branch from `getTradeTypesList`, `getAvailableContracts` (`trade-types-utils.tsx`) and `getAvailableContractTypes` (`trading-contract-type-helpers.tsx`), repoint the three hook consumers (`useContractsFor.ts`, `useAvailableContracts.ts`, `useGuideContractTypes.ts`), and remove `native_app_allowed_trade_types` from `packages/api/src/remote_config.json`.
- Remove the native-app bootstrap hooks in vanilla JS: the `is_mobile_app` loader-hiding block in `packages/core/src/index.html` and the `is_mobile_app && ory_cookie_link` Ory recovery-link block in `packages/core/src/App/initStore.js`.
- Update the bridge-affected `__tests__` (drop the `useMobileBridge` mocks/branches, keep the rest) and update `CLAUDE.md`.
- **Explicitly kept (NOT removed):** the general `ce_dtrader_app_v2` "app open" analytics event (`AppV2/app.tsx`, unconditional — not bridge-gated) and the `tracking_rudderstack` / `tracking_posthog` remote-config flags. The web fallback redirect URLs (`getBrandUrl()` transfer/home/onboarding) become the sole behaviour. `TryRealModal` / `toggleTryRealModal` stay live.

## Capabilities

### New Capabilities

- `mobile-bridge-removal`: The contract for retiring the native-app bridge — which files/exports/types are deleted, how each `trading:*` event send collapses to its web fallback, which bridge-conditional UI is unconditionally restored, that the native-app trade-type allow-list is gone, that the vanilla-JS bootstrap hooks are removed, and the do-not-touch surfaces (`ce_dtrader_app_v2`, `tracking_*`) that must survive — plus the green-gate (zero bridge references in `packages/*/src`; `build:all` + `test:jest` + `check-imports` pass).

### Modified Capabilities

- `trade-type-availability`: the "Availability filtering fails open" requirement drops its "Native-app restriction and server availability combine" scenario — with the bridge gone there is no native-app restriction to intersect, so the offered list is the server-availability-filtered set only.
- `dead-code-removal`: `[DCR-007]` drops `native_app_allowed_trade_types` from its list of remote-config keys that "SHALL be kept" — C1 kept it, and c10 now removes it, so the living spec must stop asserting it remains.

## Impact

- **Deleted files:** `packages/api/src/hooks/useMobileBridge.ts` (+ `__tests__/useMobileBridge.spec.ts`); `packages/trader/src/AppV2/Hooks/useNativeAppAllowedTradeTypes.ts` (+ `__tests__/useNativeAppAllowedTradeTypes.spec.tsx`).
- **Edited (bridge event sends → fallback):** `packages/core/src/Modules/Menu/menu.tsx`, `packages/core/src/App/Containers/Layout/bottom-nav/bottom-nav.tsx`, `packages/core/src/App/Components/Layout/Header/account-actions.tsx`, `packages/core/src/App/Containers/Modals/TryRealModal/try-real-modal.tsx`, `packages/core/src/App/AppContent.tsx`, `packages/core/src/App/app.jsx`, `packages/trader/src/AppV2/Components/Layout/Sidebar/sidebar.tsx`, `packages/trader/src/AppV2/Components/ServiceErrorSheet/service-error-sheet.tsx`, `packages/trader/src/AppV2/Components/AccountHeader/account-header.tsx`, `packages/reports/src/Components/Elements/Modals/ServicesErrorModal/insufficient-balance-modal.tsx`.
- **Edited (bridge UI gates):** `packages/trader/src/AppV2/Containers/Trade/trade-types.tsx`, `packages/trader/src/AppV2/Containers/Positions/positions.tsx`, `packages/trader/src/AppV2/Components/Guide/Description/trade-description.tsx`.
- **Edited (trade-type restriction):** `packages/trader/src/AppV2/Hooks/useContractsFor.ts`, `useAvailableContracts.ts`, `useGuideContractTypes.ts`, `packages/trader/src/AppV2/Utils/trade-types-utils.tsx`, `packages/trader/src/AppV2/Utils/trading-contract-type-helpers.tsx`.
- **Edited config/types/barrels/bootstrap:** `packages/api/src/hooks/index.ts`, `types/global.d.ts`, `packages/api/src/remote_config.json`, `packages/core/src/index.html`, `packages/core/src/App/initStore.js`.
- **Edited tests:** the twelve co-located `__tests__` that mock `useMobileBridge`/`useNativeAppAllowedTradeTypes` (Menu, TryRealModal, bottom-nav, account-actions, service-error-sheet, account-header, sidebar, trade-types, useContractsFor, useGuideContractTypes, useAvailableContracts, insufficient-balance-modal) — plus the `trade-types-utils` / `trading-contract-type-helpers` specs if they exercise the dropped `nativeAppAllowedTradeTypes` parameter.
- **Docs:** `CLAUDE.md` (mobile-bridge gotcha + "Mobile bridge hidden features").
- **Behaviour:** no product change for the web app; the native-embedded experience is retired. Analytics is informed (non-blocking) that `trading:*` bridge events stop; `ce_dtrader_app_v2` is unaffected.
