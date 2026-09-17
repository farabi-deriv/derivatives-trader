## Context

The mobile bridge is the `DerivAppChannel` postMessage channel between DTrader (running in a WebView) and the native Deriv mobile shell. It is detected by `useMobileBridge` (`packages/api/src/hooks/useMobileBridge.ts`) from an `is_mobile_app=true` query param (persisted to sessionStorage) plus a live `window.DerivAppChannel.postMessage`. When active it (a) hides web-only UI, (b) restricts offered trade types to a remote-config allow-list (`native_app_allowed_trade_types` → `useNativeAppAllowedTradeTypes`), and (c) routes logout/home/transfer/account-creation through `sendBridgeEvent`, each of which already carries a web **fallback**. This is **live** code, not dead code — so c10 is a deliberate feature removal, not a dead-code sweep. The removal is mechanical because every fork has a pre-existing web branch to collapse onto.

Every path below was re-confirmed against HEAD during planning. The full call-site inventory is in the proposal's Impact section.

## Goals / Non-Goals

**Goals:**

- Delete the bridge hook, its detection, its global types and its remote-config allow-list.
- Collapse each `trading:*` event send to its existing web fallback as the sole behaviour, with no observable change to the web experience.
- Restore the bridge-conditional UI (menu language/support/logout, sidebar logout label, trade-types "View all", positions onboarding) to its web form.
- Leave the tree green (`build:all` + `test:jest` + `check-imports`) with zero bridge references in `packages/*/src`.

**Non-Goals:**

- No change to the general `ce_dtrader_app_v2` analytics event or the `tracking_*` remote-config flags (explicitly kept — MBR-006).
- No change to the web fallback destinations themselves (the `getBrandUrl()` transfer/home/onboarding URLs), to `TryRealModal`, or to server-driven trade-type availability (the symbol-count filter in `trade-type-availability`).
- No re-architecture of navigation/logout — only the bridge branch is excised.

## Decisions

- **Collapse to the fallback, do not delete the action.** Each `sendBridgeEvent(event, fallback)` becomes the fallback body inline. The fallback was what a non-bridge web user always got, so this is behaviour-preserving for the web. _Alternative:_ delete the handler entirely — rejected; the web user still needs logout/deposit/home.
- **`ce_dtrader_app_v2` is KEPT.** It fires unconditionally in `AppV2/app.tsx` on `when(() => !is_logging_in)` — it is the AppV2 "app open" event, not a bridge event (the bridge uses `trading:*` via `DerivAppChannel`, never `trackAnalyticsEvent`). Removing it would silently drop general analytics. Confirmed unconditional at HEAD. _Alternative:_ treat it as bridge integration (as one reading of CLAUDE.md suggests) — rejected on evidence.
- **Remove the now-dead `nativeAppAllowedTradeTypes?` parameter from all three helpers**, not just stop passing it. With the allow-list gone the parameter and its filter branch are unreachable; leaving them is dead code that invites confusion (`getAvailableContractTypes`'s copy is already dead — it was never passed). Removing them keeps the trade-type utils honest. _Alternative:_ leave the optional params unused — rejected (YAGNI/DRY); smaller diff but leaves a dead filter path. (See Open Question 1.)
- **Modify the living specs that reference the removed surfaces.** `trade-type-availability`'s "Native-app restriction and server availability combine" scenario and `[DCR-007]`'s "kept" mention of `native_app_allowed_trade_types` both describe state c10 makes false, so they are updated in the same change to keep `openspec/specs/` internally consistent. (See Open Question 2.) The MODIFIED headings are copied verbatim (DCR-007 keeps its `[DCR-007]` ID; the un-IDed `trade-type-availability` requirement keeps its exact heading — an ID is deliberately NOT added, or the archive merge would fail to match the original).
- **Remove the vanilla-JS bootstrap hooks too.** The `is_mobile_app` loader block (`index.html`) and the `is_mobile_app && ory_cookie_link` Ory recovery fetch (`initStore.js`) are the boot-time half of the bridge; they are removed for completeness so no `is_mobile_app` read survives anywhere.

## Risks / Trade-offs

- **[An import goes unused after an effect is deleted]** → e.g. `getInitialLanguage` in `AppContent.tsx` is used only by the `trading:config` effect; MBR-002 requires removing such orphaned imports. `build:all` (TypeScript `noUnusedLocals`/lint) catches any missed one.
- **[A dependency-array edit changes hook timing]** → `useContractsFor.ts` drops `isMobileApp`/`nativeAppAllowedTradeTypes` from its effect deps and its wait-guard; the effect must still run on `response`/`isLoading`. Covered by the existing `useContractsFor.spec.tsx` once its bridge branches are removed.
- **[A test mocks a now-deleted symbol]** → the twelve bridge-affected `__tests__` are updated in the same change (MBR-007); a stale mock of `useMobileBridge`/`useNativeAppAllowedTradeTypes` fails at import and is caught by `test:jest`.
- **[Removing `native_app_allowed_trade_types` breaks the `typeof initData` remote-config type]** → the only reader of that key is `useNativeAppAllowedTradeTypes.ts`, which is deleted first; `useRemoteConfig`'s type is structurally derived from the JSON, so dropping the key is type-safe once the reader is gone.
- **[Spec MODIFIED heading mismatch at archive]** → both MODIFIED requirements copy the existing heading exactly (whitespace-insensitive match); validated by `openspec validate`.

## Migration Plan

No data or runtime migration. Rollout is the single squashed commit; rollback is a straight revert. Verification: `npm run build:all` + `npm run test:jest` + `npm run check-imports`, plus a repo-wide grep proving zero `useMobileBridge`/`DerivAppChannel`/`is_mobile_app`/`isBridgeAvailable`/`sendBridgeEvent`/`native_app_allowed_trade_types` hits in `packages/*/src` and `types/global.d.ts`. Analytics is informed (non-blocking, via the PR description) that the `trading:*` bridge events stop emitting; `ce_dtrader_app_v2` is unaffected.

## Open Questions

Both resolved with the recommended option; the plan is complete as written under those choices.

1. **Remove the dead `nativeAppAllowedTradeTypes?` parameter from the three trade-type helpers, or just stop passing it?** — recommended: **remove the parameter + filter branch** (full cleanup; updates callers/tests). Alternative: leave the optional params unused (smaller diff, but a dead filter path lingers).
2. **Update `[DCR-007]` to drop `native_app_allowed_trade_types` from its "kept" list?** — recommended: **update it** (keeps the living spec truthful now that c10 removes the key). Alternative: leave DCR-007 unchanged and let the `mobile-bridge-removal` spec be the sole authority.
