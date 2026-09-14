# dead-code-removal Specification

## Purpose

TBD - created by archiving change c1-c2-extraction-remnant-deletions-store-1. Update Purpose after archive.

## Requirements

### Requirement: [DCR-001] Per-unit re-verification precedes every deletion

Every deletion in this change SHALL be re-verified as dead at HEAD immediately before the file, export or dependency is removed. Verification SHALL grep for ANY importer — including lazy and `makeLazyLoader`/`React.lazy` dynamic-import patterns — not only static `import` statements. A unit that turns out to have a live importer SHALL NOT be deleted, and the discrepancy SHALL be reported instead.

#### Scenario: A unit with a live importer is not deleted

- **WHEN** a component, utility, file or dependency slated for deletion is found (by re-grep at HEAD) to have any importer, static or dynamic
- **THEN** it is left in place and the discrepancy is surfaced rather than deleted

#### Scenario: Green gate after each phase

- **WHEN** a deletion phase lands
- **THEN** `npm run bootstrap`, `npm run build:all`, `npm run test:jest`, `npm run check-imports` and `npm run knip:check` all pass, and the tree is coherent on its own

### Requirement: [DCR-002] The @deriv/api-v2 package is removed entirely

The `packages/api-v2` workspace SHALL be deleted in full. Before deletion, `useDebounce` SHALL be moved into `@deriv/api`'s hooks and its two consumers (`packages/trader/src/AppV2/Components/TradeParameters/Barrier/barrier-input.tsx` and `barrier-content-desktop.tsx`, plus the co-located test) SHALL be repointed to the new location. Deletion SHALL also remove trader's `@deriv/api-v2` dependency entry, all webpack/tsconfig/jest references, and the root workspace/lockfile artifacts. The orphaned dependencies `md5` and `uuid` and the dead files `onfido.ts`, `file-utils.ts` and `constants/platforms.ts` die with the package. The live `useRemoteConfig` (`@deriv/api`) SHALL be unaffected.

#### Scenario: No api-v2 references remain

- **WHEN** the C1a phase lands and `grep -r "@deriv/api-v2" packages/*/src` is run
- **THEN** it returns zero hits, and `packages/api-v2` no longer exists

#### Scenario: useDebounce still works from @deriv/api

- **WHEN** the barrier inputs that used `useDebounce` render after the move
- **THEN** they import `useDebounce` from `@deriv/api` and behave identically, with tests green

### Requirement: [DCR-003] Nine dead @deriv/components are removed

The nine unused components `Numpad`, `Autocomplete`, `ButtonToggle`, `RadioGroup`, `TickPicker`, `ErrorModal`, `RelativeDatepicker`, `InformationBanner` and `PopoverMessageCheckbox` SHALL be deleted — each its directory under `packages/components/src/components/`, its export line in `packages/components/src/index.ts`, its tests and its scss. The dead dependencies `embla-carousel-react` and `react-dropzone` and the transitive orphans `dropdown-list/`, `utils/helper.js` and `use-onlongpress` SHALL also be removed. `ErrorModal`'s `triangle-warning-icon.tsx` and `triangle-warning.webp` are NOT orphans — the kept `FullscreenError` imports them — so per DCR-001 they SHALL be relocated into `fullscreen-error/` (their only surviving consumer) with `fullscreen-error.tsx`'s import repointed to `./triangle-warning-icon`, rather than deleted. Internally-consumed components (`ButtonLink`, `CircularProgress`, `CurrencyBadge`, `FullscreenError`, `Field`, `InputWithCheckbox`, `TickProgress`, `Tooltip`) SHALL NOT be deleted. Live `RadioGroup` usages import from `@deriv-com/quill-ui` (a different symbol) and SHALL NOT be confused with the deleted `@deriv/components` one.

#### Scenario: Deleted components no longer exported

- **WHEN** the C1b phase lands
- **THEN** none of the nine names is exported from `packages/components/src/index.ts`, their directories and tests are gone, and `knip:check` reports no new orphans

#### Scenario: triangle-warning relocated, FullscreenError still renders it

- **WHEN** `ErrorModal` is deleted
- **THEN** `triangle-warning-icon.tsx` and `triangle-warning.webp` live under `fullscreen-error/`, `FullscreenError` renders the icon from `./triangle-warning-icon`, and its tests stay green

#### Scenario: quill-ui RadioGroup untouched

- **WHEN** components importing `RadioGroup` from `@deriv-com/quill-ui` render
- **THEN** they are unaffected by the deletion of the `@deriv/components` `RadioGroup`

### Requirement: [DCR-004] Dead KYC/upload utilities are removed from @deriv/shared

The dead KYC/upload utilities `utils/files/`, `utils/config/adapters.ts` and `utils/validation/form-validations.ts` in `@deriv/shared`, together with their barrel re-exports, SHALL be deleted. `utils/config/risk-disclosure.ts` is regulatory (Spain purchase-gating via `useRiskDisclosure` → `purchase-button.tsx`), NOT a KYC utility, and SHALL be kept.

#### Scenario: KYC utilities gone, risk-disclosure kept

- **WHEN** the C1c phase lands
- **THEN** `utils/files/`, `utils/config/adapters.ts` and `utils/validation/form-validations.ts` and their barrel lines are gone, while `risk-disclosure.ts` and `useRiskDisclosure` remain live

### Requirement: [DCR-005] Standalone dead core and api files are removed

The following standalone dead files SHALL be deleted with their barrels and assets: `packages/core/src/App/Constants/platform-config.ts`; `packages/core/src/App/Components/Layout/Header/menu-links.jsx` (plus its scss and barrel line); the `@deriv/api` `usePaginatedFetch` (`packages/api/src/usePaginatedFetch.ts`, its spec, and its `packages/api/src/index.ts` export); orphan callback assets; stale trader webpack aliases; and the dead reports externals regex.

#### Scenario: Standalone files removed cleanly

- **WHEN** the C1d standalone-files phase lands
- **THEN** each named file/alias/regex is gone, no importer references it, and `build:all` + `check-imports` pass

### Requirement: [DCR-006] All chat surfaces are removed

Both dead chat entry points — `packages/core/src/App/Components/Elements/WhatsApp/` and `packages/core/src/App/Components/Elements/LiveChat/` (neither imported outside its own `index.ts`) — SHALL be deleted. `packages/api/src/hooks/useIntercom.ts` SHALL be deleted in full (both `useIntercom` and `useIsIntercomAvailable`), along with its line in the api hooks barrel and the commented-out `useIntercom(...)` block in `AppContent.tsx`. `packages/utils/src/chat.ts`, its `Chat` export line in `packages/utils/src/index.ts`, and `packages/utils/src/__tests__/chat.spec.ts` SHALL be deleted. `packages/core/src/Services/logout.js` is a live `Chat` consumer — it calls `Chat.clear()` from an `endChat()` helper inside `doLogout` — so its `import { Chat } from '@deriv/utils'`, the `endChat()` function and its call SHALL be removed in the same change; `Chat` is purely an Intercom wrapper (`window.Intercom('shutdown')`), so the teardown is dead once the chat surfaces are gone, and leaving the import would break the core build. The rest of `doLogout` (cookie/localStorage/sessionStorage/SocketCache cleanup) SHALL be unchanged. The chat styles — `sass/app/_common/components/live-chat.scss` and its `@import` in `app.scss`, plus the `&__menu-mobile-whatsapp` and `&__menu-mobile-livechat` rules in `sass/app/_common/layout/header.scss` — SHALL be deleted. `usehooks-ts` SHALL be removed from `packages/api/package.json` (its only importer was `useIntercom.ts`); the `packages/components` `usehooks-ts` declaration SHALL be kept (still used by `use-device.ts` and `video-player.tsx`).

#### Scenario: Chat-removal gate is clean

- **WHEN** the C1d chat phase lands and `grep -rni "intercom\|whatsapp\|livechat\|live-chat" packages/*/src` is run
- **THEN** it returns zero hits

#### Scenario: logout drops the chat teardown but keeps the rest

- **WHEN** `chat.ts` is deleted and `doLogout` runs
- **THEN** `logout.js` no longer imports `Chat` or defines `endChat()`, and the cookie/localStorage/sessionStorage/SocketCache cleanup still runs

#### Scenario: usehooks-ts kept where still used

- **WHEN** the api `usehooks-ts` entry is removed
- **THEN** `packages/components`'s `usehooks-ts` declaration is untouched and `use-device.ts`/`video-player.tsx` still build

### Requirement: [DCR-007] Remote-config chat gating keys are removed, tracking flags kept

`cs_chat_intercom` and `cs_chat_whatsapp` SHALL be removed from the `FeatureFlags` interface AND the `isFeatureFlags` guard in `packages/core/src/types/feature-flags.ts`, and both keys SHALL be removed from `packages/api/src/remote_config.json`. `tracking_rudderstack`, `tracking_posthog` and `native_app_allowed_trade_types` SHALL be kept. This is the remote-config chat gating only — a distinct subsystem from the `FeatureFlagsStore`/`useFeatureFlags` store subsystem, which was reserved for C7 and is removed by DCR-013. `packages/core/src/types/feature-flags.ts` and `packages/core/src/Utils/Analytics/index.ts` survive DCR-013 unchanged.

#### Scenario: Only chat keys removed from remote config

- **WHEN** the C1d feature-flags phase lands
- **THEN** `cs_chat_intercom` and `cs_chat_whatsapp` are gone from the interface, the `isFeatureFlags` guard and `remote_config.json`, while `tracking_rudderstack`, `tracking_posthog` and `native_app_allowed_trade_types` remain

#### Scenario: The two feature-flag subsystems stay separate

- **WHEN** the C7 store-subsystem removal (DCR-013) lands
- **THEN** the remote-config `FeatureFlags` interface, its guard and its analytics consumers are untouched, and only the `FeatureFlagsStore`/`useFeatureFlags` surfaces are deleted

### Requirement: [DCR-008] Cleanup documentation is updated

`CLAUDE.md` SHALL be updated to reflect that `@deriv/api-v2` has been removed.

#### Scenario: CLAUDE.md no longer lists api-v2

- **WHEN** the C1 docs phase lands
- **THEN** `CLAUDE.md` no longer references `@deriv/api-v2` as an existing package

### Requirement: [DCR-009] Dead files and directories are removed from @deriv/shared

The following eight paths in `@deriv/shared`, each verified at HEAD to have zero references outside itself, SHALL be deleted in full together with every barrel line that re-exports them:

| Path                                                       | LOC |
| ---------------------------------------------------------- | --- |
| `packages/shared/src/utils/object/clone.js`                | 265 |
| `packages/shared/src/utils/analytics/analytics.ts`         | 192 |
| `packages/shared/src/loaders/` (3 files)                   | 97  |
| `packages/shared/src/utils/constants/translation-flag.tsx` | 61  |
| `packages/shared/src/utils/digital-options/`               | 50  |
| `packages/shared/src/utils/location/`                      | 36  |
| `packages/shared/src/utils/validation/regex-validation.ts` | 9   |
| `packages/shared/src/utils/constants/error.ts`             | 7   |

Exactly five barrel lines change: `src/index.ts` loses `./utils/digital-options`, `./utils/location` and the `cacheTrackEvents` default re-export; `utils/object/index.ts` loses `cloneThorough`; `utils/constants/index.ts` loses `./error` and `./translation-flag`; `utils/validation/index.ts` loses `./regex-validation`. No other barrel line is touched — symbol-level deletions inside leaf files need none, because `src/index.ts` is a wildcard barrel.

`packages/shared/src/loaders/` (dead webpack loaders) SHALL NOT be confused with the live `utils/loader/` and `utils/loader-handler/` directories, which stay.

#### Scenario: Each named path is gone with its barrel line

- **WHEN** the C7a deletions land
- **THEN** none of the eight paths exists, the five barrel lines named above are gone, and `packages/shared/src/index.ts` has no re-export line pointing at a deleted module

#### Scenario: The live loader utilities survive

- **WHEN** `src/loaders/` is deleted
- **THEN** `packages/shared/src/utils/loader/` and `packages/shared/src/utils/loader-handler/` are untouched and still re-exported from `src/index.ts`

#### Scenario: TranslationFlag's only remaining mention is a comment

- **WHEN** `translation-flag.tsx` is deleted
- **THEN** the sole surviving reference — the commented-out `{/* {TranslationFlag[lang](36, 24)} */}` in `packages/core/src/App/Components/Routes/language-link.tsx` — is also removed, and the file still compiles

#### Scenario: Same-named live symbols elsewhere are not deleted

- **WHEN** `utils/location/` (shared's `isEuCountry`) is deleted
- **THEN** the independent private `isEuCountry` in `packages/core/src/_common/utility.js` is untouched and its callers still work

### Requirement: [DCR-010] Dead exports are removed and intra-file-only exports are de-exported

The exports below, each verified at HEAD to have zero reference outside its defining file (including `.js`/`.jsx` consumers, `__mocks__/`, `scripts/` and `playwright/`), SHALL be deleted:

- `utils/object/object.ts`: `filterObjProperties`, `findValueByKeyRecursively`, `removeEmptyPropertiesFromObject`, `removeObjProperties`
- `utils/url/helpers.ts`: `getActionFromUrl`, `getPlatformFromUrl`, `getlangFromUrl`, `isStaging`
- `utils/url/url.ts`: `legacyUrlForLanguage`
- `utils/brand/brand.ts`: `getApiBaseUrl`, `getApiUrl`, `getBrandHostname`, `getBrandLoginUrl`, `getBrandLogo`, `getBrandSignupUrl`, `getPlatformLogo`
- `utils/browser/browser_detect.ts`: `isSafari`
- `utils/route/route.tsx`: `isRouteVisible`

Symbols still consumed inside `@deriv/shared` but nowhere outside it SHALL be **de-exported** rather than deleted, so the package's public surface shrinks without breaking an internal caller: `object.ts`'s `isEqualArray`, `url.ts`'s `normalizePath`, `brand.ts`'s `getApiCoreUrl` and `getDomainName` become module-private; `utils/validator/index.ts` stops re-exporting `Errors` and `template` (both used only by `validator.ts`); `utils/url/index.ts` stops re-exporting `./helpers` (only `brand.ts` imports `appendLangParam`, and it does so by direct path).

Four name-collision traps SHALL each be resolved by reading the hit, never by a bare grep verdict: shared's dead `isSafari` versus the live `isSafariBrowser` in the same file; shared's dead `isRouteVisible` versus the live private copies in `packages/core/src/App/Components/Routes/helpers.ts` and `packages/reports/src/Components/Routes/helpers.ts`; shared's deprecated `normalizePath` versus core's own in `App/Components/Routes/helpers.ts`; and `getApiCoreUrl`, which is dead externally but is called by the live `getApiCoreBaseUrl`.

#### Scenario: Every deleted export is unreferenced repo-wide

- **WHEN** the C7b symbol deletions land and each deleted name is grepped across the whole repository excluding `node_modules`, `.git` and `dist`
- **THEN** the only remaining hits are same-named, independently-defined symbols in other packages

#### Scenario: De-exported symbols still work for their internal callers

- **WHEN** `getApiCoreUrl` and `getDomainName` become module-private in `brand.ts`
- **THEN** `getApiCoreBaseUrl`, `getBrandUrl`, `getRedirectHostname` and `getWhoAmIURL` still resolve correctly and their tests stay green

#### Scenario: The Validator mechanism is unaffected by the de-exports

- **WHEN** `utils/validator/index.ts` stops re-exporting `Errors` and `template`
- **THEN** `Validator` is still exported, and `packages/{core,trader,reports}/src/Stores/base-store.*` still construct it and validate normally

### Requirement: [DCR-011] Dead contract card-label entries are removed

Six card-label names — `BUY_PRICE`, `CURRENT_STAKE`, `DONT_SHOW_THIS_AGAIN`, `INITIAL_STAKE`, `LOST` and `WON` — SHALL be removed from **both** `getCardLabels()` and `getCardLabelsV2()` in `packages/shared/src/utils/constants/contract.ts`, for 12 deleted entries in total.

Every candidate key SHALL be verified against all three consumption patterns before deletion, because two of them defeat a naive property grep: destructuring (`const { PAYOUT, INDICATIVE_PRICE } = getCardLabels()` in `packages/components/src/components/contract-card/contract-card-items/lookbacks-card-body.tsx`) and computed access (`getCardLabels()[is_accumulator ? 'TAKE_PROFIT_IS_NOT_AVAILABLE' : 'TAKE_PROFIT_LOSS_NOT_AVAILABLE']` in `toggle-card-dialog.tsx`). No other key SHALL be deleted.

`LOST` and `WON` in `packages/trader/src/AppV2/Components/CurrentSpot/current-spot.tsx` belong to an unrelated local `STATUS` object and SHALL NOT be touched.

#### Scenario: Exactly twelve entries are removed

- **WHEN** the card-label deletions land
- **THEN** `getCardLabels()` and `getCardLabelsV2()` have each lost the same six names, no other key is removed, and the Jest suite is green

#### Scenario: Destructured and computed-key labels survive

- **WHEN** `lookbacks-card-body.tsx` and `toggle-card-dialog.tsx` render after the deletion
- **THEN** `PAYOUT`, `INDICATIVE_PRICE`, `PROFIT_LOSS`, `POTENTIAL_PROFIT_LOSS`, `PURCHASE_PRICE`, `TAKE_PROFIT_IS_NOT_AVAILABLE` and `TAKE_PROFIT_LOSS_NOT_AVAILABLE` still resolve to their strings

### Requirement: [DCR-012] Dead shared SCSS constants are removed

The three unused variables in `packages/shared/src/styles/constants/layout.scss` — `$BORDER_RADIUS_2`, `$MOBILE_WRAPPER_HEADER_HEIGHT` and `$MOBILE_WRAPPER_FOOTER_HEIGHT` — SHALL be deleted.

No mixin in `packages/shared/src/styles/mixins.scss` SHALL be deleted: all eleven (`colorIcon`, `convertTooltipColor`, `createBarspinnerAnimation`, `interpolate`, `pill-segmented-control`, `rtl`, `setTypeface`, `thumbStyle`, `toEm`, `tooltipColor`, `typeface`) have at least one live `@include` at HEAD, so the issue's "dead SCSS mixins" measures zero. No other file under `packages/shared/src/styles/` SHALL be modified.

Dynamically-constructed CSS class names SHALL NOT be deleted on a modifier-grep alone.

#### Scenario: sass-loader accepts the tree

- **WHEN** the three variables are removed and `npm run build:all` runs
- **THEN** the build succeeds — sass-loader hard-fails on an undefined variable or mixin, so a green build is the proof

#### Scenario: Stylelint stays green

- **WHEN** `npm run test:stylelint` runs after the SCSS edit
- **THEN** it passes with no new findings

### Requirement: [DCR-013] The FeatureFlags store subsystem is removed end-to-end

The `FeatureFlagsStore` / `useFeatureFlags` subsystem is inert — its flag set (`FLAGS` in `FeatureFlagsStore.ts`, `TRADE_FEATURE_FLAGS` in shared) is empty and has no populate path — and SHALL be removed across all five packages that carry it:

- **`@deriv/shared`**: `getContractTypeFeatureFlag` (always `''`) and its use in `utils/helpers/format-response.ts`; `filterDisabledPositions` (always `true`) and its spec block; `TRADE_FEATURE_FLAGS`; and the `hidden_trade_types` branch inside `getCleanedUpCategories`. The surviving `getCleanedUpCategories` SHALL keep its `typeof item === 'object'` filter and its delete-empty-category behaviour, which are load-bearing and unrelated to flags. The now-unused `LocalStore` import in `utils/constants/contract.ts` SHALL be removed.
- **`@deriv/stores`**: `src/stores/` in full — `FeatureFlagsStore.ts` and `BaseStore.ts`, whose only client it is — plus `src/stores/index.ts`, the `feature_flags` instantiation in `src/storeProvider.tsx`, `TStores.feature_flags` in `types.ts` (leaving `TStores` as an alias of `TCoreStores` so consumers keep compiling), and the `feature_flags` block in `src/mockStore.ts`.
- **`@deriv/api`**: `src/hooks/useFeatureFlags.ts`, its spec, and its line in `src/hooks/index.ts`.
- **`@deriv/core`**: `src/Modules/Endpoint/FeatureFlagsSection.tsx` and its spec, its render site and import in `src/Modules/Endpoint/Endpoint.jsx`, the `.feature-flags` block in `Endpoint.scss`, the **second, name-shadowed** inline `FeatureFlagsSection` in `src/App/Devtools.tsx` together with the `devtools__panel-right` block that renders it and its now-unused `useStore` import, and the `feature_flags` mockStore block in `src/App/Components/Routes/__tests__/route-with-sub-routes.spec.tsx`.
- **`@deriv/trader`**: the permanently-falsy `is_${trade_type}_enabled` branch in `src/Modules/Contract/Containers/contract-replay.tsx` (its `useFeatureFlags` import, `trade_type_feature_flag`, `is_trade_type_disabled` and the effect that closes the page), and the matching `jest.mock('@deriv/api')` block in its spec.
- **Repo root**: the phantom `getFeatureFlag` entry in `./__mocks__/utils.mock.js` — which is at the repository root, not under `packages/`.
- **Docs**: the FeatureFlags section in `packages/stores/README.md` and the `useFeatureFlags` sections in `packages/api/README.md`.

The unrelated, **live** RudderStack/PostHog remote-config gating SHALL NOT be touched: `packages/core/src/types/feature-flags.ts`, its spec, and `packages/core/src/Utils/Analytics/index.ts`. A repo-wide `FeatureFlags` grep hits both subsystems; they are distinct.

`packages/core/src/Modules/Endpoint/Endpoint.jsx` itself is a live route (`routes.endpoint`) and SHALL survive; only the section it rendered goes.

#### Scenario: Positions render unchanged after the filter is dropped

- **WHEN** `filterDisabledPositions` is removed from `packages/core/src/Stores/portfolio-store.js`, `packages/reports/src/Stores/Modules/Profit/profit-store.js` and `packages/reports/src/Stores/Modules/Statement/statement-store.js`
- **THEN** each `.filter(filterDisabledPositions)` call is removed along with its import, the surrounding chain is otherwise unchanged, and open positions, the profit table and statements list exactly the same rows as before — the predicate was a constant `true`

#### Scenario: No dangling import reaches a .js consumer

- **WHEN** the three `.js` store files above are edited
- **THEN** each is hand-verified to have no surviving reference to a deleted export, because these files are excluded from `tsconfig.json`, `import/named` does not fire through the wildcard barrel, and a missed edit would surface only at runtime as `.filter(undefined)`

#### Scenario: Both name-shadowed FeatureFlagsSection components are gone

- **WHEN** the core deletions land and `grep -rn "FeatureFlagsSection" packages` runs
- **THEN** it returns zero hits — neither `Modules/Endpoint/FeatureFlagsSection.tsx` nor the inline component in `App/Devtools.tsx` remains

#### Scenario: The Devtools panel still opens

- **WHEN** the `devtools__panel-right` block is removed from `Devtools.tsx`
- **THEN** the devtools panel still renders its endpoint section and toggle button, `useStore` is no longer imported, and `isProduction` still gates `ProductionSafeDevtools`

#### Scenario: Analytics feature flags are untouched

- **WHEN** the sweep completes
- **THEN** `packages/core/src/types/feature-flags.ts`, `packages/core/src/types/__tests__/feature-flags.spec.ts` and `packages/core/src/Utils/Analytics/index.ts` are byte-identical to HEAD, and `tracking_rudderstack` / `tracking_posthog` gating still works

#### Scenario: getCleanedUpCategories keeps its non-flag behaviour

- **WHEN** `getCleanedUpCategories` is called with a mix of string and `{value, text}` entries after the flag branch is removed
- **THEN** string entries are still dropped, categories left with zero entries are still deleted, and the existing spec assertions still pass

### Requirement: [DCR-014] mobx-persist-store is dropped and mobx is retained in @deriv/stores

`mobx-persist-store` SHALL be removed from `packages/stores/package.json`; `packages/stores/src/stores/BaseStore.ts` is its only importer in the repository and is deleted by DCR-013.

`mobx` SHALL be retained in `packages/stores/package.json` even though no source file in the package imports it directly after the deletion. `packages/stores/src/index.ts` exports `observer` from `mobx-react-lite@3.4.3`, whose `peerDependencies` declare `mobx: ^6.1.0`; removing the entry breaks a `--strict-peer-deps` install.

#### Scenario: Install stays clean under strict peer deps

- **WHEN** dependencies are installed with `--strict-peer-deps` after the dependency edit
- **THEN** the install succeeds and `mobx` is still declared by `packages/stores/package.json`

#### Scenario: mobx-persist-store has no importer left

- **WHEN** `grep -rn "mobx-persist-store" packages` runs after the change
- **THEN** it returns zero hits in source and zero hits in any `package.json`

### Requirement: [DCR-015] Dead declarative validation rules and form error messages are removed atomically

`initPreBuildDVRs` in `packages/shared/src/utils/validation/declarative-validation-rules.ts` has 16 entries at HEAD. Only `req`, `number` and `barrier` are named by any consumer, so the other **13** SHALL be deleted: `address`, `email`, `general`, `length`, `name`, `password`, `phone`, `po_box`, `postcode`, `regular`, `confirm`, `signup_token`, `tax_id`. (`custom` is special-cased in `validator.ts` and is not an entry in this object; it SHALL NOT be looked for here.)

The validator functions that die with those entries SHALL be deleted in the same commit: the 8 exported KYC validators `validAddress`, `validPostCode`, `validTaxID`, `validPhone`, `validLetterSymbol`, `validName`, `validPassword`, `validEmail`; the exported `validLength` and `address_permitted_special_characters_message`; and the private helpers `validGeneral`, `validRegular`, `confirmRequired`, `checkPOBox`, `validEmailToken`. `packages/shared/src/utils/validation/__tests__/declarative-validation-rules.spec.js`, whose only subject is `validAddress`, SHALL be deleted with them.

`TFormErrorMessagesTypes` has 15 `Record` keys plus 5 function properties. The 12 keys no longer referenced by any surviving rule SHALL be removed — `empty_address`, `address`, `email`, `general`, `name`, `password`, `po_box`, `phone`, `postcode`, `signup_token`, `tax_id`, `validTaxID` — leaving `barrier`, `empty_barrier`, `number` and all 5 function properties. The matching entries in `packages/core/src/Constants/form-error-messages.js` SHALL be removed in the same commit, along with its now-dead `address_permitted_special_characters_message` import.

`Validator`, `getPreBuildDVRs`, `initFormErrorMessages`, `validRequired`, `validBarrier`, `validNumber` and `isMoreThanMax` SHALL be kept; this trims the map, not the mechanism.

#### Scenario: Trade-form validation is unchanged

- **WHEN** the deletion lands and a user leaves the stake empty, types a non-numeric stake, or enters an invalid barrier
- **THEN** the same messages appear as before — `req`, `number` and `barrier` still resolve through `getPreBuildDVRs()`, and `custom` rules in `packages/trader/src/Stores/Modules/Trading/Constants/validation-rules.ts` still run

#### Scenario: The core message map and the type stay in step

- **WHEN** keys are removed from `TFormErrorMessagesTypes`
- **THEN** `packages/core/src/Constants/form-error-messages.js` loses exactly the same keys in the same commit, so `initFormErrorMessages(FORM_ERROR_MESSAGES)` in `app.jsx` and the `require` of that same path in `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` both still satisfy the type

#### Scenario: The deletion is one commit, not several

- **WHEN** the rules, validators, type keys and core map entries are removed
- **THEN** they land together, because each half is unusable without the other and an intermediate state does not build

### Requirement: [DCR-016] Permanently-filtered trade types are removed from getContractTypesConfig only

The 10 `getContractTypesConfig` entries whose keys appear in `unsupported_contract_types_list` SHALL be deleted from `packages/shared/src/utils/constants/contract.ts` — exactly the ten members of that list, no more and no fewer: `TRADE_TYPES.CALL_PUT_SPREAD`, `TRADE_TYPES.RUN_HIGH_LOW`, `TRADE_TYPES.RESET`, `TRADE_TYPES.ASIAN`, `TRADE_TYPES.TICK_HIGH_LOW`, `TRADE_TYPES.END`, `TRADE_TYPES.STAY`, `TRADE_TYPES.LB_CALL`, `TRADE_TYPES.LB_PUT`, `TRADE_TYPES.LB_HIGH_LOW`.

The cascade into `getContractCategoriesConfig` SHALL be followed so no category references a key that no longer exists: `'Ups & Downs'` loses `RUN_HIGH_LOW`, `RESET`, `ASIAN` and `CALL_PUT_SPREAD`; `'Touch & No Touch'` loses `TICK_HIGH_LOW`; and the two categories left with zero members — `'Ins & Outs'` and `'Look Backs'` — SHALL be removed entirely. `packages/shared/src/utils/constants/__tests__/contract.spec.ts`, which asserts the exact `getContractCategoriesConfig()` shape, SHALL be updated to match.

The cut SHALL go no further. These are a settled **KEEP** and SHALL NOT be deleted: all 38 keys of `packages/shared/src/utils/constants/trade-type-icons.ts`; the `icon-trade-types.tsx` switch arms; `getSupportedContracts` / `getUnsupportedContracts` / `getContractTypeDisplay`; `trade-categories.tsx`'s description arms; the `TRADE_TYPES` and `CONTRACT_TYPES` constants; and `unsupported_contract_types_list` with its three trader consumers (`Stores/Modules/Trading/Helpers/contract-type.ts`, `AppV2/Utils/trading-contract-type-helpers.tsx`, `AppV2/Utils/trade-types-utils.tsx`), which stay as the guard that keeps a re-enabled API type from surfacing before its config returns. If the cascade turns out to demand a change beyond this, the implementer SHALL stop and report it in the PR description rather than widen the cut.

#### Scenario: The remaining trade types still build and render

- **WHEN** the 10 entries and the two empty categories are removed
- **THEN** `getContractCategoriesConfig()` returns 7 categories, every category member resolves to a surviving `getContractTypesConfig` key, and the trade-type selection UI offers the same set it offered before (the removed types were already filtered out)

#### Scenario: Optional-chained lookups of a removed key stay safe

- **WHEN** `positions-helper.ts`, `active-symbols.ts`, `symbols-search-field.tsx`, `compact-header.tsx` or `market-tab.tsx` looks up a removed key
- **THEN** the existing `?.` guards return `undefined` without throwing, and `getUnsupportedContracts()` still supplies the display name for a historical contract of that type

#### Scenario: The KEEP set is byte-identical

- **WHEN** the change lands
- **THEN** `trade-type-icons.ts` still has 38 keys, `icon-trade-types.tsx` and `trade-categories.tsx` are unchanged, and `unsupported_contract_types_list` still has its 10 members

### Requirement: [DCR-017] The duplicated market-icons module is consolidated into @deriv/shared

`packages/trader/src/AppV2/Utils/market-icons.ts` is byte-identical to `packages/shared/src/utils/constants/market-icons.ts` (both md5 `cda0e208bafe3169edad7009d87e16d7`, 234 lines). The trader copy SHALL be deleted and its single importer, `packages/trader/src/AppV2/Components/SymbolIconsMapper/symbol-icons-mapper.tsx`, SHALL import `marketIcons` from `@deriv/shared` instead. The shared copy and its spec SHALL be kept.

Because that import is the file's only alias-root import, the rewrite drops one file from trader's alias-importer count (350 → 349), so `docs/baselines/alias-usage.json` SHALL be regenerated and committed with the change.

#### Scenario: Symbol icons still render

- **WHEN** `symbol-icons-mapper.tsx` resolves `marketIcons` from `@deriv/shared`
- **THEN** it renders the same icon component for every symbol it rendered before, and its tests pass

#### Scenario: No trader copy remains

- **WHEN** `grep -rn "AppV2/Utils/market-icons" packages` runs after the change
- **THEN** it returns zero hits and the file is gone

### Requirement: [DCR-018] Dead signup_query_param read branches are removed

`signup_query_param` is read in two places and written nowhere in the repository, so both reads are dead and SHALL be removed:

- `packages/core/src/App/Containers/Modals/app-modals.jsx`: the `temp_session_signup_params` binding and its use as the `URLSearchParams` fallback, leaving `new URLSearchParams(useLocation().search)`; `SessionStore` SHALL be dropped from the import, keeping `moduleLoader`.
- `packages/core/src/Stores/client-store.js`: the `SessionStore?.get?.('signup_query_param') ||` clause inside `init()`, leaving `window?.location?.search || ''` in the same `try`/`catch`; `SessionStore` SHALL be dropped from the import list.

`SessionStore` itself (in the DO-NOT-TOUCH `utils/storage/`) SHALL NOT be modified.

#### Scenario: URL-driven modals and login redirects behave identically

- **WHEN** the app loads with `?action=redirect_to_login` or with a `redirect_url` query parameter after the branches are removed
- **THEN** `AppModals` renders the same modal and `client-store.init()` reads the same `action`/`redirect_url` values, because the removed clause always evaluated to `undefined`

#### Scenario: SessionStore is no longer imported where it is unused

- **WHEN** the two files are edited
- **THEN** neither imports `SessionStore`, and no lint rule reports an unused import

### Requirement: [DCR-019] The sweep is verified by a local type oracle and regenerated baselines

CI provides no working type gate for this change: the "Check TypeScript" step in `.github/workflows/test.yml` backgrounds four `tsc` runs behind a bare `wait`, so its exit code is always 0, and one target (`packages/api-v2`) no longer exists; `shared`, `core`, `trader` and `reports` are not among the targets at all. Webpack uses `babel-loader` and Jest uses `babel-jest`, both of which strip types without checking.

The change SHALL therefore be verified against a local oracle: `npx tsc -p packages/shared/tsconfig.json --noEmit`, filtered to `packages/shared/src/` lines outside `__tests__`, reports exactly **4** pre-existing errors at HEAD — two in `utils/analytics/analytics.ts`, one in `utils/analytics/analytics-utils.ts`, one in `utils/object/object.ts`. Because DCR-009 deletes `analytics.ts`, the expected post-change count is exactly **2**. Any error not in that surviving pair is introduced by this change and SHALL be fixed.

`npm run knip:baseline` and `npm run baseline:update` SHALL both be run and their outputs committed: `scripts/knip-check.js` blocks on an unbanked shrink (the three `src/loaders/` files are listed in the current knip baseline), and `scripts/baseline-check.js` blocks on the alias-usage count change from DCR-017. `baseline:update` SHALL NOT be run against an empty `packages/*/dist`, which would wipe the committed chunk set; only the chunk assertion needs a prior `build:all`.

A clean `knip:check` on `packages/shared` SHALL NOT be treated as evidence that a symbol is dead: with `includeEntryExports` unset and `src/index.ts` a pure wildcard barrel, knip reports zero unused exports for the package both before and after this change. Per-symbol proof — "nothing outside `@deriv/shared` references this" — is the standard.

Playwright SHALL NOT be run for this change: the suite has no `pull_request` trigger, needs staging and encrypted secrets, imports nothing from `packages/`, and references no deletion target. That exit criterion is discharged by stating this in the PR description.

`.spec-to-pr/` SHALL be added to `.gitignore` so the run-state file is not swept into the feature commit.

#### Scenario: The type oracle shrinks to its expected two errors

- **WHEN** `npx tsc -p packages/shared/tsconfig.json --noEmit` is run after the change and filtered to non-test `packages/shared/src/` lines
- **THEN** it reports exactly the two surviving pre-existing errors (`analytics-utils.ts` `process`, `object/object.ts` `require`) and nothing else

#### Scenario: Both blocking baselines are regenerated in the same PR

- **WHEN** `npm run knip:check` and `npm run baseline:check` run on the change branch
- **THEN** both exit 0, and `docs/baselines/knip-baseline.json` and `docs/baselines/alias-usage.json` are committed with the change reflecting the removed files and the 350 → 349 alias count

#### Scenario: Run-state files stay out of the commit

- **WHEN** the change is committed
- **THEN** `.gitignore` contains `.spec-to-pr/` and no file under that directory is staged
