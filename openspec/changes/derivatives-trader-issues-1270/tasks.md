# Tasks — derivatives-trader-issues-1270 (C5 Store deep-clean)

## Open Questions

### Should C5a perform the full BaseStore relocation into @deriv/stores now, given the discovered couplings (name collision with the generic BaseStore, no @deriv/shared dependency, trader-local getValidationRules type import)?

- [recommended] Yes — do the full move as the issue directs; the coupling is type-only (`ReturnType<typeof getValidationRules>`) and cleanly generalized, and C5a is the M1/S1 precondition ("do C5a first")
- No — only strip dead members and delete one JS copy in place, deferring the physical @deriv/stores move to a separate change (lower churn, but leaves the duplication and does not unblock M1/S1)
- Move BaseStore into @deriv/shared instead of @deriv/stores (fewer new deps, but @deriv/stores is the store-infrastructure home so this is the wrong architectural fit)

### Should the live-code cross-store sell-flow dedup (portfolio-store vs contract-replay-store) be attempted in this dead-code cleanup?

- [recommended] Yes, but guarded — extract a shared helper only if behavior is provably preserved; if a safe extraction is not achievable, leave both and file a deferral (captures the brief's C5d item without risking a sell/cancel regression)
- Yes, unconditionally merge the two implementations (maximal dedup, but real regression risk on the divergent mobile-gating/banner/validation semantics)
- No — defer the sell-flow dedup entirely to a follow-up change (safest, but drops a brief line item)

---

**Multi-run protocol.** Each `##` phase is ordered and independently green — `build:all` + `test:jest` + `check-imports` + per-package `tsc` + `test:eslint-all` + `knip:check` + `baseline:check` + `test:scripts` pass at every phase boundary. Tick `- [x]` the instant a phase lands (the tick is the only durable record; a resumed run restarts from the first unticked item). NEVER ship a partially-ticked plan: stop at a phase boundary and file a deferral under `docs/spec-to-pr/deferrals/` if remaining work will not fit. The whole issue is one revert unit (one branch/PR/commit).

**Re-verify at HEAD before every delete** (DCR-001 / SMC-001): grep `\bmember\b` across ALL packages (never dotted-access only — members reach consumers via `useStore()` destructuring AND dynamic `this[name]`); for files grep for ANY importer incl. lazy/`makeLazyLoader`/`React.lazy`. A unit found live is NOT deleted — surface the discrepancy. Delete `packages/stores/{types.ts,src/mockStore.ts}` mirror lines in the same diff (those files are mirrors, not consumers).

_Resolved defaults (see Open Questions): BaseStore = full move into `@deriv/stores` with the type-only coupling generalized; sell-flow dedup = guarded, deferred if not safely extractable._

## 1. C5a — BaseStore consolidation (BSC-001, BSC-002, BSC-003)

- [x] 1.1 Create `packages/stores/src/base-store.ts` from the trader TS `BaseStore` (`packages/trader/src/Stores/base-store.ts`); generalize the validation-rules type — replace `type TValidationRules = ReturnType<typeof getValidationRules> | ...` and drop the `import { getValidationRules } from './Modules/Trading/Constants/validation-rules'` so the base imports nothing from trader; keep the constructor `validation_rules` injection path unchanged
- [x] 1.2 In `packages/stores/package.json` add `@deriv/shared` as a dependency (for `isEmptyObject`/`isProduction`/`Validator`); export `BaseStore` from `packages/stores/src/index.ts`; confirm no collision with the generic `src/stores/BaseStore.ts` (leave it and `FeatureFlagsStore` untouched) and no circular import (`npm run check-imports`)
- [x] 1.3 Strip the dead theme-listener machinery from the consolidated base: `onThemeChange`, `disposeThemeChange`, `themeChangeDisposer`, `theme_change_listener` (BSC-002); confirm `onRealAccountSignupEnd`/`disposeRealAccountSignupEnd` are already absent; keep `onLogout`/`onClientInit`/`onNetworkStatusChange`/`onUnmount` + validation/storage
- [x] 1.4 Harden `retrieveFromStorage` (BSC-003): default `store_name = ''` with `String(getItem(...))` so no `getItem(undefined)` call occurs, and carry forward core's declared-keys filter (assign only keys in the store's `*_storage_properties`)
- [x] 1.5 Repoint every real-`BaseStore` subclass's import/`extends` to `@deriv/stores`: core `client-store.js`/`common-store.js`/`ui-store.js`/`notification-store.js`/`portfolio-store.js`/`gtm-store.js`/`contract-store.js`/`contract-trade-store.js`/`contract-replay-store.js`; reports `Modules/Profit/profit-store.js`/`Modules/Statement/statement-store.js`; trader `Modules/Trading/trade-store.ts`/`automation-store.ts`/`Modules/Positions/positions-store.ts`/`Modules/Markets/markets-store.ts`
- [x] 1.6 Delete `packages/core/src/Stores/base-store.js`, `packages/reports/src/Stores/base-store.js`, and `packages/trader/src/Stores/base-store.ts`; remove the now-dead `this.disposeThemeChange()` call at `packages/trader/src/Stores/Modules/Trading/trade-store.ts:3390`
- [x] 1.7 **Green gate:** `npm run bootstrap && npm run build:all && npm run test:jest && npm run check-imports` pass; the real `BaseStore` exists only at `packages/stores/src/base-store.ts`; `grep -rn "base-store" packages/*/src` shows every subclass pointing at `@deriv/stores`

## 2. C5b — trade-store `is_dtrader_v2` collapse (SMC-011)

- [x] 2.1 In `trade-store.ts`, collapse the 11 `is_dtrader_v2` gates (856, 870, 2563, 2648, 2675, 2738, 2842, 4165 → unconditional; 2281/2343/2360 `setServicesError(..., this.is_dtrader_v2)` → literal `true`), keeping every guarded body
- [x] 2.2 Remove the `processPurchase` `is_dtrader_v2?` parameter (2302) and simplify `if (!is_dtrader_v2 || !isMobile)` (2422) → `if (!isMobile)`; update the 5 `__tests__/trade-store.spec.ts` call sites that pass `true`
- [x] 2.3 In `packages/trader/src/AppV2/Hooks/useGuideContractTypes.ts` drop the unreachable `: contract_types_list` arm (line 19) and the `is_dtrader_v2`/`contract_types_list` destructure + `useMemo` dep; update `useGuideContractTypes.spec.tsx`
- [x] 2.4 Remove the getter (2750–2755) and its `computed` registration (695) **last**; remove the `is_dtrader_v2: false` mirror at `packages/stores/src/mockStore.ts:347`; confirm `is_dtrader_v2` is absent from `types.ts`; leave the unrelated `replay-chart.tsx`/`account-info-wrapper.tsx` same-named symbols
- [x] 2.5 **Green gate:** `grep -rn "\bis_dtrader_v2\b" packages/trader/src` returns only the unrelated `replay-chart.tsx` local var and `account-info-wrapper.tsx` prop; `build:all && test:jest && check-imports` pass

## 3. C5b — trade-store dead WS layer + dead members (SMC-012)

- [x] 3.1 Delete the WS block (`trade-store.ts:3443–3535`): `wsSubscribe`/`wsForget`/`wsForgetStream`/`wsSendRequest` and `g_subscribers_map` (303); remove the type imports it alone kept live (`History` 164, `TTicksResponse` 277, `TActiveSymbolsRequest`, `TServerTimeRequest`, `TTicksHistoryRequest`, `TTradingTimesRequest`); keep `WS`, `ServerTime`, `TickSpotData`, `TTicksStreamResponse`
- [x] 3.2 Remove the dead members with their `makeObservable` regs: `is_synthetics_available` (2757), `is_synthetics_trading_market_available` (2761), `getFirstOpenMarket` (3641) + the orphaned `findFirstOpenMarket` import (36), `setMobileDigitView` (2779)/`is_mobile_digit_view_selected` (502), `setIsDigitsWidgetActive` (3805)/`is_digits_widget_active` (588); re-verify each `\bmember\b`-dead first
- [x] 3.3 Barrier-error dedup (CANDIDATE): only merge the four `validation_errors.barrier_1/2 = []` sites (2563, 2648, 2738, 4164) if lifecycle timing is provably equivalent; otherwise leave as-is — LEFT AS-IS (the per-key, symbol-change-immediate, symbol-change-`setTimeout`, and `clearBarrierValidationErrors` sites guard different races; merging is not provably equivalent)
- [x] 3.4 **Green gate:** `grep -rn "wsSubscribe\|wsForget\|g_subscribers_map" packages/*/src` returns zero; each removed member `\bmember\b`-dead; `build:all && test:jest && check-imports` pass

## 4. C5c — dead trader helper whole-file deletions (DCR-053)

- [x] 4.1 Re-verify zero importers, then delete `packages/trader/src/Stores/Modules/Trading/Helpers/multiplier.ts` + `__tests__/multiplier.spec.ts` (leave the unrelated `AppV2/.../Multiplier/` module)
- [x] 4.2 Re-verify zero importers, then delete `packages/trader/src/Stores/Modules/Trading/Helpers/preview-proposal.ts` + `__tests__/preview-proposal.spec.ts` (keep the live `proposal.ts` it imported `createProposalRequests` from)
- [x] 4.3 **Green gate:** `check-imports` passes with no dangling importer; the `preview-proposal` entry drops from `docs/baselines/knip-baseline.json` once regenerated in Phase 14; `build:all && test:jest` pass

## 5. C5c — contract-type/validation-rules session collapse (DCR-054)

- [x] 5.1 In `packages/trader/src/Stores/Modules/Trading/Helpers/contract-type.ts` collapse the dead session/start-date logic: `getSessions` stub, `getValidTime` + `hours`/`minutes` consts, the `is_end_of_session` branch in `getExpiryTime`, and `getStartDates`/`start_dates_list`/`contract_start_type`; keep the live `getExpiryTime`/`getExpiryDate` (also dropped the `sessions` param from `getExpiryTime`/`getStartTime`, updated `Actions/start-date.ts`, and deleted the now-dead `Helpers/start-date.ts` + spec whose sole `isSessionAvailable` export lost all non-test importers)
- [x] 5.2 Remove the paired dead trade-store outputs `sessions` (484, 723) and `start_dates_list` (482, 737) with any `mockStore.ts`/`types.ts` mirror; update `contract-type.spec.ts` / `Actions/contract-type.spec.ts` (no mirror existed in `mockStore.ts`/`types.ts`)
- [x] 5.3 In `packages/trader/src/Stores/Modules/Trading/Constants/validation-rules.ts` remove the neutered `start_time` block (109–142), the always-`true` last `expiry_time` rule (166–174), the `start_date` trigger (103–105) and the dead `isSessionAvailable` import (6); keep `getValidationRules`/`getMultiplierValidationRules` and the format rules
- [x] 5.4 **Green gate:** duration/expiry selection tests green; `getExpiryTime`/`getExpiryDate`/`getValidationRules` intact; `build:all && test:jest && check-imports` pass

## 6. C5c — positions- and markets-store trims (SMC-013)

- [x] 6.1 In `packages/trader/src/Stores/Modules/Positions/positions-store.ts` remove `dateFrom`/`dateTo`/`setDateFrom`/`setDateTo` (+ their `onUnmount` calls); `filteredContractTypes` (CANDIDATE) only if `getFilteredContractTypes` has no side effect; keep the live filter members — RE-VERIFY FOUND LIVE: `reports/.../profit-store.js` reads/calls all five cross-package (`.dateFrom`/`.dateTo`/`.filteredContractTypes`, `.setDateFrom`/`.setDateTo`), so per the re-verify rule they were KEPT and the discrepancy is filed at `docs/spec-to-pr/findings/smc-013-positions-members-not-dead.md`
- [x] 6.2 In `packages/trader/src/Stores/Modules/Markets/markets-store.ts` remove `favoriteIndicators`/`favoriteSymbols`/`setFavoriteIndicators`/`setFavoriteSymbols`/`removeFavoriteIndicator`/`removeFavoriteSymbol`/`syncLocalStorage` and the `cq-favorites` constructor block (CANDIDATE — confirm no chart reader of `localStorage['cq-favorites']`); keep `favouriteMarkets`/`setFavouriteMarkets` — dead members removed; `cq-favorites` **seed KEPT** (CANDIDATE re-verify failed: `@deriv/shared` active-symbols.ts + SmartCharts read the key), see the finding
- [x] 6.3 Remove the markets-favorites mirror at `packages/stores/src/mockStore.ts:285-290`; trim the favorite cases in `markets-store.spec.ts`
- [x] 6.4 **Green gate:** each removed member `\bmember\b`-dead; `favouriteMarkets`/positions filters live; `build:all && test:jest && check-imports && knip:check` pass

## 7. C5d — ui-store dead clusters (SMC-014)

- [x] 7.1 In `packages/core/src/Stores/ui-store.js` remove the dead modal/flow clusters listed in SMC-014 (legacy `pwa_prompt_event` pair; reset/link/email/password modals; signup/PNV flags; dead settings/misc members incl. `getDurationFromUnit`), fields + `makeObservable` regs; re-verify each `\bmember\b`-dead first — re-verified all across every file type; `settings_extension`/`is_nativepicker_visible` external hits proved to be unrelated independent component props (toggle-settings.jsx/dropdown.tsx), not store consumers
- [x] 7.2 Remove the mirrored lines in `packages/stores/types.ts` and `packages/stores/src/mockStore.ts` (per the SMC-014 line map) — also removed the now-orphaned `TPopulateSettingsExtensionsMenuItem` type
- [x] 7.3 Duration cluster (CANDIDATE): remove `duration_t/s/m/h/d`, `advanced_duration_unit`, `simple_duration_unit`, `advanced_expiry_type`, `setChartCountdown` only with the paired trade-store writes (`trade-store.ts:2020/2029/2030`) and the `local_storage_properties` list updated in the same diff; keep `is_advanced_duration` and `is_chart_countdown_visible` — done (write-only, no readers; paired trade-store writes removed; persistence list trimmed)
- [x] 7.4 Confirm KEEP: `is_try_real_modal_visible`/`toggleTryRealModal`, `prompt_when`/`promptFn`/`setPromptHandler`, `deferred_prompt`/`notifyAppInstall`/`installWithDeferredPrompt`, theme system
- [x] 7.5 **Green gate:** each removed member `\bmember\b`-dead; `mockStore`/`types` compile; `build:all && test:jest && check-imports && knip:check` pass

## 8. C5d — portfolio-store hover-barrier chain (SMC-015)

- [x] 8.1 In `packages/core/src/Stores/portfolio-store.js` remove `onHoverPosition`, `hovered_position_id`, `updateTradeStore`, `setPurchaseSpotBarrier`, `updateLimitOrderBarriers` and the now-unreachable `if (this.hovered_position_id === …)` branch in `proposalOpenContractHandler`; remove the `onHoverPosition` mirror in `types.ts`/`mockStore.ts` (also dropped the now-unused `ChartBarrierStore`/`removeBarrier`/`setLimitOrderBarriers`/`isEnded` imports)
- [x] 8.2 CANDIDATE: remove unused computed `is_accumulator`/`is_turbos` and write-only `main_barrier` after re-verification — removed (re-verified dead: the same-named component locals in `contract-card-header.tsx`/`contract-store.js` are unrelated; no `portfolio.is_accumulator`/`.is_turbos`/`.main_barrier` reader)
- [x] 8.3 Confirm KEEP: `barriers`/`barriers_flattened`/`is_empty`/`is_multiplier`/`contract_type`/`setContractType`/`active_positions`/`open_accu_contract`
- [x] 8.4 **Green gate:** hover chain `\bmember\b`-dead; trade chart still reads `barriers`; `build:all && test:jest && check-imports && knip:check` pass

## 9. C5d — remaining core stores + orphaned-caller fix (SMC-016)

- [x] 9.1 `client-store.js`: remove `setPreferredLanguage` (re-verify 0 callers); KEEP `setCookieAccount`/`getAnalyticsConfig`/`setupVisibilityListener`/`removeVisibilityListener` — done (kept the live `preferred_language` field; only the 0-caller setter removed)
- [x] 9.2 `notification-store.js` (+ `Helpers/client-notifications.js`): remove the never-added `is_virtual`/`trustpilot`/`new_version_available` configs and the `system_maintenance` array entry; re-verify `site_maintenance` against `app-notification-messages.jsx:118` and keep if server-provisioned; KEEP `reset_virtual_balance`/`install_pwa`/`you_are_offline`/`deriv_go`/`contract_sold` — RE-VERIFY: only `is_virtual` was cleanly dead and removed; `new_version_available` is LIVE (added by `header-legacy.tsx`), `trustpilot`/`system_maintenance` are entangled with the render/priority pipeline, `site_maintenance` is live — all KEPT and documented in `docs/spec-to-pr/findings/smc-016-notification-configs-not-dead.md`
- [x] 9.3 `common-store.js`: remove `routeTo`/`isCurrentLanguage`/local `showError`; CANDIDATE `platform`/`app_router`/`was_socket_opened` (+ reduce the now-no-op `setAppRouterHistory` writer) after re-verify; KEEP `setPlatform`/`app_routing_history`/`setInitialRouteHistoryItem`/`routeBackInApp`/`selected_contract_type`/socket-state/language members — all removed; `setAppRouterHistory` (+ its `routes.jsx` call) removed as the app_router chain went dead; `setPlatform` kept but no longer writes the removed `platform` observable
- [x] 9.4 `contract-store.js`/`contract-replay-store.js` (CANDIDATE): remove write-only `sell_info` (declaration + all writes across contract-store/contract-replay-store/portfolio-store), `is_static_chart`, `is_chart_scaling` after confirming no observer side effect; KEEP `handleSubscribeProposalOpenContract`/`forgetProposalOpenContract`/`cached_barriers_data`/`contract_update_config` — removed (all write-only, no reader/reaction)
- [x] 9.5 `Stores/Helpers/`: delete the dead file `device.js`; remove the core-duplicate dead `getBuyPrice` from `Helpers/logic.js` (keep `getChartConfig`/`getChartType`/`getChartGranularity`/`calculateGranularity`, `chart-markers.js`, `chart-marker-helpers.js`)
- [x] 9.6 Remove the orphaned call to the already-removed `client.setExternalParams` in `common-store.js` (the `?ext_platform_url=` branch of `setInitialRouteHistoryItem`); confirm the two `client.setPreventRedirectToHub` sites were removed with the dead ui-store methods in Phase 7
- [x] 9.7 Remove the paired `types.ts`/`mockStore.ts` mirrors for the removed members; confirm `gtm-store.js` needs no change
- [x] 9.8 **Green gate:** `grep -rn "setPreventRedirectToHub\|setExternalParams" packages/*/src` returns zero; each removed member `\bmember\b`-dead; `mockStore`/`types` compile; `build:all && test:jest && check-imports && knip:check` pass

## 10. C5d — cross-store sell-flow dedup (SMC-017)

- [x] 10.1 Attempt a behavior-preserving extraction of the shared sell/cancel flow used by `portfolio-store.js` (`onClickCancel`/`onClickSell`/`handleSell`) and `contract-replay-store.js` (same trio) into one helper, preserving portfolio's numeric `bid_price` validation, position-index lookups, mobile-gated notification, `sell_notifications` de-dup and `addNotificationBannerCallback`; drop the dead `sell_info` rather than reproduce it — attempted; the two flows diverge semantically (per-position vs single state, numeric vs raw `bid_price`, gated vs unconditional notifications) and there is no test coverage to prove preservation, so a safe extraction is not achievable
- [x] 10.2 If a safe extraction is NOT achievable without a product-behavior change, leave both implementations intact and file `docs/spec-to-pr/deferrals/cross-store-sell-flow-dedup.md` instead (What was deferred / Why / Follow-up required) — DEFERRED: both flows left intact, deferral filed; the dead `sell_info` was still dropped from both (task 9.4)
- [x] 10.3 **Green gate:** either both stores route through the shared helper with sell/cancel tests green and portfolio semantics unchanged, OR the deferral is filed; `build:all && test:jest && check-imports` pass

## 11. C5e — reports store dead members (SMC-018)

- [x] 11.1 `packages/reports/src/Stores/Modules/Statement/statement-store.js`: remove `account_statistics` (28, 48); `filtered_date_range` (22, 46, 139)
- [x] 11.2 `packages/reports/src/Stores/Modules/Profit/profit-store.js`: remove `filtered_date_range` (21, 42, 205)
- [x] 11.3 `packages/reports/src/Stores/useReportsStores.tsx`: remove the `account_statistics` (25, 36), `filtered_date_range` (30, 41–46) and phantom `suffix_icon` (34, 50) type entries
- [x] 11.4 Update the tests that assert the removed members: `statement-store.spec.js:46,48`, `profit-store.spec.ts:365,376,381`; KEEP all live statement/profit members
- [x] 11.5 **Green gate:** each removed member `\bmember\b`-dead; reports type-checks and `test:jest` green; `build:all && check-imports` pass

## 12. C5e — reports defect fixes (RSF-001, RSF-002)

- [x] 12.1 RSF-001: in `packages/reports/src/Stores/Modules/Statement/statement-store.js:153` change `handleFilterChange(filterValue = {})` → `handleFilterChange(filterValue = 'all')`; add a test asserting an arg-less `handleFilterChange()` sets `action_type = 'all'`
- [x] 12.2 RSF-002: in `packages/reports/src/Constants/data-table-constants.tsx:67` change the statement icon `key={row_obj.transaction_id}` → `key={row_obj.refid}`; leave the profit-table (143) and archived-statement (470) sites unchanged
- [x] 12.3 **Green gate:** the new statement-filter test is green; reports `test:jest` + `test:eslint-all` pass

## 13. Docs

- [x] 13.1 In `CLAUDE.md` correct the stale note that `BaseStore.onThemeChange` is a live theme consumer — the sole theme DOM writer is ui-store's `changeTheme()` autorun (the note's own "exactly one runtime writer" line is the accurate one)
- [x] 13.2 Confirm `docs/spec-to-pr/deferrals/archived-statement-usestate-consolidation.md` exists (flagged, not implemented); confirm no dead-code task touched `archived-statement.tsx`

## 14. Final verification (Exit criteria)

- [x] 14.1 Regenerate and commit the knip baseline: `npm run knip:baseline` (deletions shrink `docs/baselines/knip-baseline.json`, e.g. the `preview-proposal` entry drops); confirm `npm run knip:check` exits 0 against the regenerated baseline
- [x] 14.2 Run the full gate: `npm run build:all && npm run test:jest && npm run check-imports && npm run test:eslint-all && npm run baseline:check && npm run test:scripts`, plus per-package `tsc` (`npx tsc --project packages/api/tsconfig.json --noEmit && npx tsc --project packages/utils/tsconfig.json --noEmit && npx tsc --project packages/stores/tsconfig.json --noEmit`)
- [x] 14.3 Confirm `packages/stores/types.ts` and `packages/stores/src/mockStore.ts` compile and the knip diff shows only intended removals; every removed store member is `\bmember\b`-dead repo-wide
- [x] 14.4 Confirm every checkbox above is ticked OR a deferral is filed under `docs/spec-to-pr/deferrals/`
