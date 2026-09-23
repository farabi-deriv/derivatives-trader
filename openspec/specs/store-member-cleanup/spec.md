# store-member-cleanup Specification

## Purpose

TBD - created by archiving change c1-c2-extraction-remnant-deletions-store-1. Update Purpose after archive.

## Requirements

### Requirement: [SMC-001] Store members are verified dead by member-grep before removal

Every store member removed in C2 SHALL be re-verified dead immediately before removal using a `\bmember\b` word-boundary grep across ALL packages, because store members are consumed both via `useStore()` destructuring and via dynamic `this[name]` assignment — a dotted-access (`store.member`) grep alone is insufficient. A member with any surviving live consumer SHALL NOT be removed. Each C2 removal SHALL be a single, self-contained sub-diff that leaves the tree building and all tests, `check-imports` and `knip:check` green, and leaves `mockStore`/`types` compiling.

#### Scenario: Destructured-and-dynamic consumers are caught

- **WHEN** a store member is checked before removal
- **THEN** the check greps `\bmember\b` across every package (not `store.member` only), and any live destructured or `this[name]` consumer blocks the removal

#### Scenario: Each removal is independently green

- **WHEN** a C2 sub-diff lands
- **THEN** `build:all`, `test:jest`, `check-imports` and `knip:check` pass, `packages/stores` types and `mockStore` compile, and the knip diff shows only the intended removals

### Requirement: [SMC-002] The extracted traders-hub localStorage key is confirmed removed

The change SHALL confirm that PR #912's `traders-hub-store` deletion also removed the `traders_hub_store` localStorage cleanup key; if the key survives, it SHALL be removed.

#### Scenario: No stale traders_hub_store key remains

- **WHEN** the tree is grepped for `traders_hub_store`
- **THEN** no localStorage cleanup entry for it remains

### Requirement: [SMC-003] Orphaned module and common-store members are removed

The always-`undefined` `cashier` field in `packages/trader/src/Stores/Modules/index.ts` SHALL be removed. In `packages/core/src/Stores/common-store.js`, `withdraw_url`, `setWithdrawURL` and `setAppstorePlatform` SHALL be removed (their observable/action registrations included). The remainder of the platform cluster is reserved for C5 and SHALL NOT be touched here.

#### Scenario: cashier field gone

- **WHEN** the C2 modules phase lands
- **THEN** `Stores/Modules/index.ts` no longer declares or assigns `cashier`, and trader still builds

#### Scenario: common-store withdraw/appstore members gone

- **WHEN** the common-store phase lands
- **THEN** `withdraw_url`, `setWithdrawURL` and `setAppstorePlatform` and their `makeObservable` registrations are removed, while the rest of the platform cluster is left for C5

### Requirement: [SMC-004] Dead ui-store clusters and their store-package mirrors are removed

The dead clusters in `packages/core/src/Stores/ui-store.js` SHALL be removed together with their mirrored lines in `packages/stores/types.ts` and `packages/stores/mockStore.ts`: the MT5 top-up modal, verification modals, trading-assessment flags, account-needed/switch-to-real modals, `real_account_signup*`, `choose_crypto_currency_target`, `manage_real_account_tab_index`, `is_real_tab_enabled`, `should_trigger_tour_guide`, `is_mt5_migration_modal_enabled` and `should_show_cancel`. `is_try_real_modal_visible`, `toggleTryRealModal` and `TryRealModal` SHALL be KEPT (6 live consumers: profile-completion upsell → external onboarding), even though they sit amid the deleted clusters.

#### Scenario: Dead clusters removed, TryRealModal kept

- **WHEN** the ui-store phase lands
- **THEN** the listed dead observables/actions and their `types.ts`/`mockStore.ts` mirrors are gone, `is_try_real_modal_visible`/`toggleTryRealModal` remain, and `mockStore`/`types` compile

### Requirement: [SMC-005] The RealAccountSignupEnd listener machinery is removed

In `packages/core/src/Stores/base-store.js`, the `RealAccountSignupEnd` listener machinery (`onRealAccountSignupEnd`, `disposeRealAccountSignupEnd` and their registrations) and the ui-store reaction that consumed it SHALL be removed, because nothing sets the flag after the ui-store cluster removal.

#### Scenario: Listener machinery gone

- **WHEN** the base-store phase lands
- **THEN** `onRealAccountSignupEnd`/`disposeRealAccountSignupEnd` and the corresponding ui-store reaction are removed and no code references the flag

### Requirement: [SMC-006] Orphaned @deriv/stores types and mocks are removed

The orphaned entries `toggleCashier`, `setIsWalletModalVisible`, `is_need_real_account_for_cashier_modal_visible`, `is_additional_kyc_info_modal_open` and `available_onramp_currencies` SHALL be removed from `packages/stores/types.ts` and `packages/stores/mockStore.ts`.

#### Scenario: Orphaned type/mock entries gone

- **WHEN** the stores-types phase lands
- **THEN** the five listed entries are absent from `types.ts` and `mockStore.ts`, and both compile

### Requirement: [SMC-007] The cashier deep-link branch is surgically removed from client-store

In `packages/core/src/Stores/client-store.js`, the cashier deep-link `action_param` branch SHALL be removed. Because it shares an array with the live `reset_password` branch, the edit SHALL be surgical — the `reset_password` handling SHALL remain intact — and SHALL be covered by a targeted test asserting `reset_password` still routes correctly.

#### Scenario: Cashier branch removed, reset_password intact

- **WHEN** the client-store phase lands
- **THEN** the cashier `action_param` handling is gone, the `reset_password` branch still functions, and a targeted test proves the `reset_password` path is unaffected

### Requirement: [SMC-008] Cashier residue is removed from notification-store

In `packages/core/src/Stores/notification-store.js`, the `p2p_order` key filter SHALL be removed and the stale "...to access the cashier." copy in the `is_virtual` notification SHALL be updated to remove the cashier reference. The legitimate demo-top-up `reset_virtual_balance` notification SHALL be KEPT.

#### Scenario: p2p_order filter and cashier copy cleaned, demo top-up kept

- **WHEN** the notification-store phase lands
- **THEN** the `p2p_order` filter is gone, the `is_virtual` message no longer mentions the cashier, and the `reset_virtual_balance` notification remains intact

### Requirement: [SMC-009] The gtm-store deposit/withdrawal branch is deleted

The deposit/withdrawal branch in `packages/core/src/Stores/gtm-store.js` SHALL be deleted (decided 26 Aug 2026): with the cashier extracted, the path is unreachable and its events already stopped arriving, so no non-zero analytics data is lost. The deletion SHALL be noted in the PR description to inform Analytics — this is a notification, not a blocking sign-off.

#### Scenario: Deposit/withdrawal branch gone

- **WHEN** the gtm-store phase lands
- **THEN** the `['deposit', 'withdrawal']` transaction-action branch is removed, gtm-store still builds, and the PR description records the Analytics notification

### Requirement: [SMC-010] Dead route constants are removed

The route constants `callback_page` and `error404` in `packages/shared/src/utils/routes/routes.ts` SHALL be removed once confirmed to have no live consumers. Account-status trade gating, `redirectToLogin`/`redirectToSignUp` and intentional external cross-app redirects (header Deposit/"Try real", insufficient-balance "Deposit now") SHALL NOT be touched.

#### Scenario: Dead route constants removed

- **WHEN** the routes phase lands
- **THEN** `callback_page` and `error404` are removed from `routes.ts`, no importer references them, and the live redirect surfaces are untouched

### Requirement: [SMC-011] The trade-store is_dtrader_v2 gate is collapsed

The `is_dtrader_v2` getter in `packages/trader/src/Stores/Modules/Trading/trade-store.ts` returns a constant `true` at HEAD, so its 11 read sites are dead gates with no reachable else-arms. Each `if (this.is_dtrader_v2)` block SHALL be made unconditional and each `this.is_dtrader_v2 &&` prefix dropped; the three `setServicesError(..., this.is_dtrader_v2)` calls SHALL pass the literal `true`; the separate `processPurchase` `is_dtrader_v2?` parameter (always passed `true` by the sole `onPurchaseV2` caller) SHALL be removed and its `if (!is_dtrader_v2 || !isMobile)` check simplified to `if (!isMobile)`. The cross-file reader `packages/trader/src/AppV2/Hooks/useGuideContractTypes.ts` SHALL drop its unreachable `contract_types_list` arm (always use `contract_types_list_v2`). The getter and its `makeObservable` `computed` registration SHALL be removed **last**, after all readers are gone, and the `is_dtrader_v2` mirror in `packages/stores/src/mockStore.ts` removed. The unrelated same-named local var in `replay-chart.tsx` and the `account-info-wrapper.tsx` Popover prop SHALL NOT be touched.

#### Scenario: Gate collapsed and getter removed last

- **WHEN** the trade-store `is_dtrader_v2` phase lands
- **THEN** no `this.is_dtrader_v2` read remains, the getter/registration and the `processPurchase` parameter are gone, `useGuideContractTypes` uses only the V2 list, the `mockStore.ts` mirror is removed, and the tree builds green

### Requirement: [SMC-012] The trade-store dead WebSocket layer and orphaned members are removed

In `trade-store.ts`, the dead WS layer — `wsSubscribe`, `wsForget`, `wsForgetStream`, `wsSendRequest` and `g_subscribers_map` (no caller anywhere) — SHALL be removed together with the type imports it alone kept live (`History`, `TTicksResponse`, `TActiveSymbolsRequest`, `TServerTimeRequest`, `TTicksHistoryRequest`, `TTradingTimesRequest`); the live `WS`, `ServerTime`, `TickSpotData` and `TTicksStreamResponse` SHALL be kept. The dead members `is_synthetics_available`, `is_synthetics_trading_market_available`, `getFirstOpenMarket` (with the then-orphaned `findFirstOpenMarket` import), the `setMobileDigitView`/`is_mobile_digit_view_selected` pair and the `setIsDigitsWidgetActive`/`is_digits_widget_active` pair SHALL be removed with their `makeObservable` registrations. The duplicated barrier-validation-error clearing MAY be de-duplicated where the lifecycle timing is provably equivalent; where it is not (the per-key, symbol-change, `setTimeout` and `clearBarrierValidationErrors` sites guard different races), it SHALL be left as-is rather than merged unsafely.

#### Scenario: WS layer and dead members gone, live WS kept

- **WHEN** the trade-store WS/dead-member phase lands
- **THEN** `wsSubscribe`/`wsForget`/`wsForgetStream`/`wsSendRequest`/`g_subscribers_map` and the six listed dead members are absent, `WS`/`ServerTime`/`TickSpotData` remain, and no orphaned type import is left dangling

### Requirement: [SMC-013] Dead trader positions- and markets-store members are removed

The dead members `dateFrom`, `dateTo`, `setDateFrom`, `setDateTo` in `packages/trader/src/Stores/Modules/Positions/positions-store.ts` (no app consumer; the same-named symbols in `archived-statement.tsx` are unrelated local `useState`) SHALL be removed. In `packages/trader/src/Stores/Modules/Markets/markets-store.ts`, the dead favorites cluster `favoriteIndicators`, `favoriteSymbols`, `setFavoriteIndicators`, `setFavoriteSymbols`, `removeFavoriteIndicator`, `removeFavoriteSymbol`, the private `syncLocalStorage`, and the `cq-favorites` constructor init block SHALL be removed, with their mirror at `packages/stores/src/mockStore.ts:285-290`. The live `favouriteMarkets`/`setFavouriteMarkets` (consumed by `useFavouriteMarkets`) and the positions filter members (`openContractTypeFilter`, `closedContractTypeFilter`, `timeFilter`, `customTimeRangeFilter`, `tradeModeFilter` + setters) SHALL be kept.

#### Scenario: Dead members gone, live favourites/filters kept

- **WHEN** the positions/markets store phase lands
- **THEN** `dateFrom`/`dateTo` and the `favorite*`/`syncLocalStorage`/`cq-favorites` cluster are removed with their `mockStore.ts` mirror, `favouriteMarkets`/`setFavouriteMarkets` and the positions filters remain, and each removed member is dead by `\bmember\b` grep across all packages

### Requirement: [SMC-014] Dead ui-store modal/flow clusters are removed

In `packages/core/src/Stores/ui-store.js`, the dead modal/flow clusters SHALL be removed with their `packages/stores/types.ts` and `packages/stores/src/mockStore.ts` mirrors: the legacy PWA pair `pwa_prompt_event`/`setPWAPromptEvent`/`removePWAPromptEvent`; the reset/link/email/password modals (`is_link_expired_modal_visible`/`toggleLinkExpiredModal`, `is_reset_password_modal_visible`/`toggleResetPasswordModal`, `is_reset_email_modal_visible`/`toggleResetEmailModal`, `is_update_email_modal_visible`/`toggleUpdateEmailModal`, `is_reset_trading_password_modal_visible`/`setResetTradingPasswordModalOpen`); the signup/phone-verification flags (`is_from_signup_account`/`setIsFromSignupAccount`, `is_closing_create_real_account_modal`/`setIsClosingCreateRealAccountModal`, `should_show_real_accounts_list`/`toggleShouldShowRealAccountsList`, `should_show_phone_number_otp`/`setShouldShowPhoneNumberOTP`, `is_forced_to_exit_pnv`/`setIsForcedToExitPnv`, `is_phone_verification_completed`/`setIsPhoneVerificationCompleted`, `is_redirected_from_email`/`setRedirectFromEmail`, `is_tnc_update_modal_open`/`toggleTncUpdateModal`); the dead settings/misc members (`is_settings_modal_on`/`toggleSettingsModal`, `settings_extension`/`populateSettingsExtensions`, `is_nativepicker_visible`/`setIsNativepickerVisible`, `show_positions_toggle`, `is_cfd_page`, `modal_index`/`setModalIndex`, `field_ref_to_focus`/`setFieldRefToFocus`, `sub_section_index`/`setSubSectionIndex`, `url_hashed_values`/`setHashedValue`, `is_landscape`, `onChangeUiStore`, `getDurationFromUnit`). Each SHALL be re-verified dead by `\bmember\b` grep across all packages immediately before removal. The write-only duration cluster (`duration_t/s/m/h/d`, `advanced_duration_unit`, `simple_duration_unit`, `advanced_expiry_type`, the dead `setChartCountdown` setter) MAY additionally be removed if the paired trade-store writes and the `local_storage_properties` list are updated in the same diff. The live surfaces `is_try_real_modal_visible`/`toggleTryRealModal`, `prompt_when`/`promptFn`/`setPromptHandler`, `deferred_prompt`/`notifyAppInstall`/`installWithDeferredPrompt`, `is_advanced_duration`, `is_chart_countdown_visible` and the whole theme system SHALL be kept.

#### Scenario: Dead clusters removed, live surfaces kept

- **WHEN** the ui-store phase lands
- **THEN** the listed dead members and their `types.ts`/`mockStore.ts` mirrors are gone, `is_try_real_modal_visible`/`toggleTryRealModal`, the route-leave trio, the app-install pair, the theme system and `is_chart_countdown_visible` remain, and `mockStore`/`types` compile

### Requirement: [SMC-015] The portfolio-store hover-barrier chain is removed, chart barriers kept

In `packages/core/src/Stores/portfolio-store.js`, the dead hover-barrier chain SHALL be removed: `onHoverPosition` (no caller), the `hovered_position_id` field it alone writes, `updateTradeStore`, `setPurchaseSpotBarrier`, `updateLimitOrderBarriers`, and the now-unreachable `if (this.hovered_position_id === …)` branch in `proposalOpenContractHandler`; the paired `types.ts`/`mockStore.ts` mirrors (`onHoverPosition`) SHALL be removed too. The unused computed getters `is_accumulator`, `is_turbos` and the write-only `main_barrier` MAY be removed after re-verification. `barriers`, `barriers_flattened`, `is_empty`, `is_multiplier`, `contract_type`/`setContractType`, `active_positions` and `open_accu_contract` SHALL be KEPT — `barriers` stays an array `trade-store` reads harmlessly after the hover chain is gone.

#### Scenario: Hover chain gone, barriers kept

- **WHEN** the portfolio-store phase lands
- **THEN** `onHoverPosition`/`hovered_position_id`/`updateTradeStore`/`setPurchaseSpotBarrier`/`updateLimitOrderBarriers` and the unreachable branch are removed, `barriers`/`barriers_flattened`/`is_empty`/`is_multiplier` remain live, and the trade chart still renders barriers

### Requirement: [SMC-016] Remaining dead members in the smaller core stores are removed

The remaining core-store dead members SHALL be removed, each re-verified dead by `\bmember\b` grep across all packages first, with their `types.ts`/`mockStore.ts` mirrors:

- `client-store.js`: `setPreferredLanguage` (0 callers). The internally-live `setCookieAccount`, `getAnalyticsConfig` and the WS idle-recovery `setupVisibilityListener`/`removeVisibilityListener` SHALL be KEPT.
- `notification-store.js` (+ `Helpers/client-notifications.js`): the never-added configs `is_virtual`, `trustpilot`, `new_version_available`, and the `system_maintenance` maintenance-array entry. The `reset_virtual_balance` (demo top-up), `install_pwa`, `you_are_offline`, `deriv_go` and `contract_sold` notifications SHALL be KEPT; `site_maintenance` SHALL be re-verified against its `app-notification-messages.jsx` key check before any removal and left in place if server-provisioned.
- `common-store.js`: `routeTo`, `isCurrentLanguage`, the local `showError` (the different `@deriv/shared` `showError` is unrelated and live), and the write-only `platform`/`app_router`/`was_socket_opened` (with the now-no-op `setAppRouterHistory` writer reduced accordingly) after re-verification. The live `setPlatform` (sessionStorage write), `app_routing_history`/`addRouteHistoryItem`/`setInitialRouteHistoryItem`, `routeBackInApp`, `selected_contract_type`, `server_time`/`setServerTime`, `setError`, socket-state and language members SHALL be KEPT.
- `contract-store.js`/`contract-replay-store.js`: the write-only `sell_info` (declared in contract-store, written in contract-replay-store and portfolio-store, read nowhere — remove the declaration and all writes together), `is_static_chart`, `is_chart_scaling`, after confirming the writes have no observer side effect. The internally-live `handleSubscribeProposalOpenContract`, `forgetProposalOpenContract`, `cached_barriers_data` and `contract_update_config` SHALL be KEPT.
- `Stores/Helpers/`: the whole dead file `device.js` (`getCookieObject`/`setDeviceDataCookie`, no importer) and the core-duplicate dead `getBuyPrice` in `Helpers/logic.js` (the live one is `@deriv/shared`'s). `getChartConfig`/`getChartType`/`getChartGranularity`/`calculateGranularity`, `chart-markers.js` and `chart-marker-helpers.js` SHALL be KEPT.
- `gtm-store.js`: verified to have no remaining dead members after C2 — no change.

The now-orphaned calls to the already-removed `client.setPreventRedirectToHub` (two sites inside the dead `toggleResetEmailModal`/`setResetTradingPasswordModalOpen`, removed automatically with SMC-014) and `client.setExternalParams` (`common-store.js`, inside the `?ext_platform_url=` branch of `setInitialRouteHistoryItem`) SHALL be removed so no code calls a non-existent method.

#### Scenario: Smaller-store dead members removed, live members kept

- **WHEN** the remaining-core-stores phase lands
- **THEN** the listed dead members across client/notification/common/contract stores and `Helpers` are removed with their mirrors, the KEEP surfaces (demo top-up, `install_pwa`, `setPlatform`, chart helpers, contract-update caches, WS idle-recovery) remain live, and `mockStore`/`types` compile

#### Scenario: No call to a removed client-store method survives

- **WHEN** the tree is grepped for `setPreventRedirectToHub` and `setExternalParams` after the phase
- **THEN** there is no remaining caller of either already-removed method

### Requirement: [SMC-017] Duplicate cross-store sell-flow logic is de-duplicated

The near-duplicate live sell flow in `portfolio-store.js` (`onClickCancel`/`onClickSell`/`handleSell`) and `contract-replay-store.js` (same trio) SHALL be de-duplicated behind one shared helper that both stores call, preserving the portfolio version's extra behaviors (numeric `bid_price` validation, position-index lookups, mobile-gated notification, per-contract `sell_notifications` de-dup, `addNotificationBannerCallback`) and the shared success path (`WS.sell`/`WS.cancelContract`, `is_sell_requested`, `common.setServicesError` on error, `contract_trade.clearAccumulatorBarriersData`, the `contractSold(...)` notification, the `ce_reports_form_v2 close_contract` analytics event). The dead write-only `sell_info` (see SMC-016) SHALL be dropped by the dedup rather than reproduced. If a safe behavior-preserving extraction is not achievable without a product-behavior change, the dedup SHALL be left undone and recorded as a deferral instead of risking a regression.

#### Scenario: One sell helper, behavior preserved

- **WHEN** the sell-flow phase lands with a safe extraction
- **THEN** both stores route sell/cancel through the shared helper, the portfolio mobile-gating/banner/validation semantics are unchanged, `sell_info` is not written, and the sell/cancel tests are green

#### Scenario: Unsafe dedup is deferred, not forced

- **WHEN** a behavior-preserving extraction cannot be achieved
- **THEN** the two implementations are left intact and a deferral is filed under `docs/spec-to-pr/deferrals/`, with no product-behavior change shipped

### Requirement: [SMC-018] Dead members in the reports stores are removed

In the reports stores, the dead members SHALL be removed with their `useReportsStores.tsx` type mirrors and their test references: `account_statistics` (`StatementStore`, always `{}`, never read), `filtered_date_range` (write-only in both `StatementStore` and `ProfitTableStore`), and the phantom type-only `suffix_icon` (declared only in the `TOverrideStatementStore` type, no backing field). The live members (`data`, `is_loading`, `has_loaded_all`, `date_from`/`date_to`, `error`, `action_type`, `client_loginid`, computed `is_empty`/`has_selected_date`/`totals`, and the `handle*`/`fetch*`/`clear*` methods) SHALL be KEPT. The shared `BaseStore` lifecycle machinery is owned by the consolidation (BSC-002) and is not trimmed per-copy here.

#### Scenario: Dead reports members removed, live members kept

- **WHEN** the reports-store phase lands
- **THEN** `account_statistics`, `filtered_date_range` and the phantom `suffix_icon` type member are gone with their `useReportsStores.tsx` type mirrors and updated tests, the live statement/profit members remain, and reports type-checks and tests are green
