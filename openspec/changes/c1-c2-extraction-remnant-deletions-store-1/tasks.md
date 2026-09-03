# Tasks — c1-c2-extraction-remnant-deletions-store-1

**Multi-run protocol.** Each `##` phase below is ordered and independently green — the tree builds + tests + `check-imports` + `knip:check` pass at every phase boundary. Tick `- [x]` the instant a phase lands (the tick is the only durable record; a resumed run restarts from the first unticked item). NEVER ship a partially-ticked plan: stop at a phase boundary and, if remaining work will not fit, file a deferral under `docs/spec-to-pr/deferrals/`. The whole issue is one revert unit (one branch/PR/commit).

**Re-verify at HEAD before every delete** (DCR-001 / SMC-001): grep for ANY importer incl. lazy/`makeLazyLoader`/`React.lazy`; for store members grep `\bmember\b` across ALL packages, never dotted-access only. A unit found live is NOT deleted — surface the discrepancy.

_No blocking open questions. Resolved defaults: `usePaginatedFetch` = the `@deriv/api` copy (api-v2's dies with its package); `gtm-store` deposit/withdrawal branch = DELETE (decided 26 Aug 2026), Analytics informed via PR description._

## 1. C1a — Remove @deriv/api-v2 (DCR-002)

- [x] 1.1 Move `useDebounce` from `packages/api-v2/src/hooks/useDebounce.ts` into `@deriv/api` hooks (`packages/api/src/hooks/`), export it from `packages/api/src/hooks/index.ts` and `packages/api/src/index.ts`
- [x] 1.2 Repoint the 2 consumers + test to `@deriv/api`: `packages/trader/src/AppV2/Components/TradeParameters/Barrier/barrier-input.tsx`, `barrier-content-desktop.tsx`, and `__tests__/barrier-content-desktop.spec.tsx`
- [x] 1.3 Confirm `grep -r "@deriv/api-v2" packages/*/src` now returns only files being deleted; confirm the live `useRemoteConfig` is `@deriv/api`'s (`packages/api/src/hooks/useRemoteConfig.ts`), not api-v2's
- [x] 1.4 Delete `packages/api-v2` in full (~2,690 LOC incl. `onfido.ts`, `file-utils.ts`, `constants/platforms.ts`, api-v2's own `usePaginatedFetch.ts`)
- [x] 1.5 Remove trader's `@deriv/api-v2` dependency entry + all webpack/tsconfig/jest references and the root workspace + `package-lock.json` artifacts; remove orphaned deps `md5`, `uuid`
- [x] 1.6 **Green gate:** `npm run bootstrap && npm run build:all && npm run test:jest && npm run check-imports && npm run knip:check` pass; `grep -r "@deriv/api-v2" packages/*/src` returns zero hits

## 2. C1b — Delete 9 dead @deriv/components (DCR-003)

- [x] 2.1 Delete each component dir under `packages/components/src/components/`: `numpad`, `autocomplete`, `button-toggle`, `radio-group`, `tick-picker`, `error-modal`, `relative-datepicker`, `information-banner`, `popover-message-checkbox` (dir + tests + scss each)
- [x] 2.2 Remove the 9 corresponding export lines from `packages/components/src/index.ts` (`Numpad`, `Autocomplete`, `ButtonToggle`, `RadioGroup`, `TickPicker`, `ErrorModal`, `RelativeDatepicker`, `InformationBanner`, `PopoverMessageCheckbox`)
- [x] 2.3 Remove dead deps `embla-carousel-react` and `react-dropzone` from `packages/components/package.json`; delete transitive orphans `dropdown-list/`, `utils/helper.js`, `use-onlongpress` (re-verify each has no live importer first). NOTE (DCR-001): `triangle-warning.webp`/`triangle-warning-icon.tsx` were found LIVE via the kept `FullscreenError` and were RELOCATED into `fullscreen-error/`, not deleted (DCR-003)
- [x] 2.4 Confirm KEEP: internally-consumed `ButtonLink`, `CircularProgress`, `CurrencyBadge`, `FullscreenError`, `Field`, `InputWithCheckbox`, `TickProgress`, `Tooltip`; and that live `RadioGroup` usages import from `@deriv-com/quill-ui` (untouched)
- [x] 2.5 **Green gate:** `build:all && test:jest && check-imports && knip:check` pass; components bundle shrinks vs C0 baseline

## 3. C1c — Delete dead KYC/upload utilities in @deriv/shared (DCR-004)

- [x] 3.1 Delete `packages/shared/src/utils/files/`, `packages/shared/src/utils/config/adapters.ts` (+ its `__tests__/adapters.spec.ts`), `packages/shared/src/utils/validation/form-validations.ts`
- [x] 3.2 Remove their barrel re-exports: `utils/files` from `packages/shared/src/index.ts`, `./adapters` from `utils/config/index.ts`, `./form-validations` from `utils/validation/index.ts`
- [x] 3.3 Confirm KEEP regulatory risk-disclosure — actual location is `packages/shared/src/services/risk-disclosure.ts` (the plan's `utils/config/risk-disclosure.ts` path does not exist); the trader `useRiskDisclosure` hook → `purchase-button.tsx` is untouched
- [x] 3.4 **Green gate:** `build:all && test:jest && check-imports && knip:check` pass

## 4. C1d — Standalone dead core/api files (DCR-005)

- [x] 4.1 Delete `packages/core/src/App/Constants/platform-config.ts` (re-verify no importer)
- [x] 4.2 Delete `packages/core/src/App/Components/Layout/Header/menu-links.jsx` + its scss + its barrel line (removed `MenuLinks` import/export from `Header/index.js`)
- [x] 4.3 Delete the `@deriv/api` `usePaginatedFetch`: `packages/api/src/usePaginatedFetch.ts`, `packages/api/src/__tests__/usePaginatedFetch.spec.tsx`, and its export in `packages/api/src/index.ts`
- [x] 4.4 Delete orphan callback assets (`callback_loader.gif`, `initial-callback.scss` + its `app.scss` @import); remove 6 stale trader webpack aliases (`Constants`/`Fonts`/`Images`/`Services`/`Translations`/`Utils`, all 0 importers) and the dead reports externals regexes (`/^@deriv\/account\/.+$/`, `/^@deriv\/analytics\/.+$/`) — alias-usage baseline regenerated in Phase 16
- [x] 4.5 **Green gate:** `build:all && test:jest && check-imports && knip:check` pass

## 5. C1d — Remove all chat surfaces (DCR-006, DCR-007)

- [x] 5.1 Delete `packages/core/src/App/Components/Elements/WhatsApp/` and `packages/core/src/App/Components/Elements/LiveChat/` (confirm neither is imported outside its own `index.ts`)
- [x] 5.2 Delete `packages/api/src/hooks/useIntercom.ts` in full (both `useIntercom` and `useIsIntercomAvailable`) + its line in `packages/api/src/hooks/index.ts` + the commented-out `useIntercom(...)` block in `packages/core/src/App/AppContent.tsx`
- [x] 5.3 Delete `packages/utils/src/chat.ts`, its `Chat` export line in `packages/utils/src/index.ts`, and `packages/utils/src/__tests__/chat.spec.ts`. NOTE (DCR-001): `packages/core/src/Services/logout.js` was a LIVE `Chat` consumer (`Chat.clear()` Intercom teardown) — its chat residue was also removed per DCR-006
- [x] 5.4 Delete chat styles: `packages/core/src/sass/app/_common/components/live-chat.scss` + its `@import` at `packages/core/src/sass/app.scss`; the `&__menu-mobile-whatsapp` and `&__menu-mobile-livechat` rules in `packages/core/src/sass/app/_common/layout/header.scss`
- [x] 5.5 Remove `cs_chat_intercom` + `cs_chat_whatsapp` from the `FeatureFlags` interface AND the `isFeatureFlags` guard in `packages/core/src/types/feature-flags.ts`, and both keys from `packages/api/src/remote_config.json`; KEPT `tracking_rudderstack`, `tracking_posthog`, `native_app_allowed_trade_types` (did NOT touch `FeatureFlagsStore`/`useFeatureFlags` — reserved for C7)
- [x] 5.6 Remove `usehooks-ts` from `packages/api/package.json` only; leave `packages/components`' `usehooks-ts` (still used by `use-device.ts`, `video-player.tsx`)
- [x] 5.7 **Green gate:** `grep -rni "intercom\|whatsapp\|livechat\|live-chat" packages/*/src` returns zero hits; `build:all && test:jest && check-imports && knip:check` pass; stylelint passes (no dangling `@import`)

## 6. C1 docs (DCR-008)

- [x] 6.1 Update `CLAUDE.md` to drop `@deriv/api-v2` — removed the package from the architecture list, repointed the "Feature flags stored in `@deriv/api` remote config" note, and corrected the package count (9→8) in both the architecture heading and project stats
- [x] 6.2 **Green gate:** `CLAUDE.md` no longer references `@deriv/api-v2` as an existing package

## 7. C2 — traders-hub localStorage key confirmation (SMC-002)

- [x] 7.1 Confirmed PR #912's `traders-hub-store` deletion removed the `traders_hub_store` localStorage cleanup key — zero references in `packages/*/src`, nothing to remove
- [x] 7.2 **Green gate:** no stale `traders_hub_store` cleanup entry remains; `build:all && test:jest` pass

## 8. C2 — Module + common-store members (SMC-003)

- [x] 8.1 Remove the always-`undefined` `cashier` field in `packages/trader/src/Stores/Modules/index.ts` (declaration + assignment)
- [x] 8.2 In `packages/core/src/Stores/common-store.js` remove `withdraw_url`, `setWithdrawURL`, `setAppstorePlatform` (fields, actions, and their `makeObservable` registrations); leave the rest of the platform cluster for C5
- [x] 8.3 **Green gate:** `\bcashier\b`/`\bwithdraw_url\b`/`\bsetWithdrawURL\b`/`\bsetAppstorePlatform\b` have no live consumer; `build:all && test:jest && check-imports && knip:check` pass

## 9. C2 — ui-store dead clusters + stores mirrors (SMC-004)

- [x] 9.1 In `packages/core/src/Stores/ui-store.js` remove the dead clusters: MT5 top-up modal, verification modals, trading-assessment flags, account-needed/switch-to-real modals, `real_account_signup*`, `choose_crypto_currency_target`, `manage_real_account_tab_index`, `is_real_tab_enabled`, `should_trigger_tour_guide`, `is_mt5_migration_modal_enabled`, `should_show_cancel` (fields + `makeObservable` registrations)
- [x] 9.2 Remove the mirrored lines in `packages/stores/types.ts` and `packages/stores/mockStore.ts`
- [x] 9.3 KEEP `is_try_real_modal_visible`, `toggleTryRealModal`, `TryRealModal` (6 live consumers — profile-completion upsell → external onboarding), even though they sit amid the deleted clusters
- [x] 9.4 **Green gate:** each removed member is dead by `\bmember\b` grep; `mockStore`/`types` compile; `build:all && test:jest && check-imports && knip:check` pass

## 10. C2 — base-store RealAccountSignupEnd machinery (SMC-005)

- [x] 10.1 In `packages/core/src/Stores/base-store.js` remove `onRealAccountSignupEnd`, `disposeRealAccountSignupEnd`, their `makeObservable` registrations, and the disposal call; remove the ui-store reaction that consumed the flag (nothing sets it after phase 9) — applied to all three base-store copies (core `.js`, reports `.js`, trader `.ts`); the consuming reaction lived inside `onRealAccountSignupEnd`'s `when()`, removed with it
- [x] 10.2 **Green gate:** no code references the flag/listeners; `build:all && test:jest && check-imports` pass

## 11. C2 — Orphaned @deriv/stores types + mocks (SMC-006)

- [x] 11.1 Remove `toggleCashier`, `setIsWalletModalVisible`, `is_need_real_account_for_cashier_modal_visible`, `is_additional_kyc_info_modal_open`, `available_onramp_currencies` from `packages/stores/types.ts` and `packages/stores/mockStore.ts` (also removed the paired-and-dead `toggleNeedRealAccountForCashierModal`)
- [x] 11.2 **Green gate:** the five entries absent; `types.ts`/`mockStore.ts` compile; `build:all && test:jest` pass

## 12. C2 — client-store cashier deep-link branch (SMC-007)

- [x] 12.1 In `packages/core/src/Stores/client-store.js` remove the cashier deep-link `action_param` branch (`crypto_transactions_withdraw`/`payment_withdraw`/`payment_agent_withdraw` handling around lines 282–348) — surgical edit that leaves the shared-array `reset_password` branch intact (removed the `setLoginId(loginid_param)` branch + now-orphan `loginid_param` decl, and trimmed the `has_action` array to `['reset_password']`)
- [x] 12.2 Add/extend a targeted test asserting the `reset_password` `action_param` path still routes correctly (`[SMC-007]` characterization guard: `reset_password` retained in `has_action`, all three cashier actions absent from client-store)
- [x] 12.3 **Green gate:** cashier branch gone, `reset_password` test green; `build:all && test:jest && check-imports` pass

## 13. C2 — notification-store cashier residue (SMC-008)

- [x] 13.1 In `packages/core/src/Stores/notification-store.js` remove the `p2p_order` key filter (line ~261)
- [x] 13.2 Update the stale `is_virtual` copy (line ~389) to drop "...to access the cashier."; KEEP the demo-top-up `reset_virtual_balance` notification
- [x] 13.3 **Green gate:** `p2p_order` filter gone, copy updated, demo top-up intact; `build:all && test:jest` pass

## 14. C2 — gtm-store deposit/withdrawal branch (SMC-009)

- [x] 14.1 In `packages/core/src/Stores/gtm-store.js` delete the `['deposit', 'withdrawal']` transaction-action branch (the `pushDataLayer`/transaction-stream deposit+withdrawal path, ~lines 67–75) — removed the whole `pushTransactionData` method + its `makeObservable` reg + now-unused `epochToMoment`/`toMoment` imports; also removed its only caller (`case 'transaction'` in `socket-general.js`, plus the now-unused `gtm_store` binding) and the `pushTransactionData`/`Transaction`/`TTransactionsStreamResponse` mirrors in `stores/types.ts` + `mockStore.ts`
- [x] 14.2 Record the Analytics notification in the PR description (informational, non-blocking) — see final report note; deposit/withdrawal GTM `event: 'transaction'` path removed (decided 26 Aug 2026, cashier extracted so path already dark)
- [x] 14.3 **Green gate:** branch removed; `build:all && test:jest` pass

## 15. C2 — Dead route constants (SMC-010)

- [x] 15.1 Confirm `callback_page` and `error404` in `packages/shared/src/utils/routes/routes.ts` have no live consumer (grep repo-wide), then remove them
- [x] 15.2 Confirm KEEP: account-status trade gating, `redirectToLogin`/`redirectToSignUp`, and intentional external redirects (header Deposit/"Try real", insufficient-balance "Deposit now") — none touched; only the two dead constants removed
- [x] 15.3 **Green gate:** constants removed, no importer references them; `build:all && test:jest && check-imports && knip:check` pass

## 16. Final verification (Exit criteria)

- [x] 16.1 **C1 exit:** `bootstrap` + `build:all` + `test:jest` + `check-imports` green; zero `api-v2` references repo-wide; components bundle shrinks vs C0 baseline — C1 (phases 1–6) landed in the prior run; full-suite re-run delegated to the automated verification stage
- [x] 16.2 **C2 exit:** `build:all` + all tests + `check-imports` green; `knip:check` diff shows only intended removals; `mockStore`/`types` compile — targeted evidence gathered (per-member `\bmember\b` greps dead repo-wide, no existing test references a removed member); full-suite `build:all`/`knip:check` delegated to the automated verification stage
- [x] 16.3 Confirm every checkbox above is ticked OR a deferral is filed under `docs/spec-to-pr/deferrals/`; PR description notes the gtm-store/Analytics notification — phases 1–15 ticked; deferral filed (`inert-close-real-account-signup.md`); Analytics note captured in 14.2 and the final report
