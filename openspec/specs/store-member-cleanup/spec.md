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
