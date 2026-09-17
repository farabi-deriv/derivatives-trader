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

### Requirement: [DCR-020] Dead @deriv/components hooks, components and utilities are removed

The nine `packages/components/src/hooks/` modules with zero call sites anywhere in the repository SHALL be deleted together with their barrel lines in `packages/components/src/hooks/index.ts` and their co-located specs: `use-deep-effect.ts`, `use-event-listener.ts`, `use-interval.ts`, `use-isomorphic-layout-effect.ts`, `use-on-scroll.ts`, `use-prevent-ios-zoom.ts`, `use-safe-state.ts`, `use-state-callback.ts` and `use-device.ts`. `use-event-listener.ts` and `use-isomorphic-layout-effect.ts` SHALL be deleted only as an atomic pair with `use-onclickoutside.ts`'s dependency re-pointed or inlined, because `use-onclickoutside.ts:2` — which is live in eight files — imports `useEventListener`.

`packages/components/src/components/inline-message/` (3 files, 137 LOC), `packages/components/src/components/autosizer/` (2 files, 4 LOC) and `packages/components/utils/rename.js` (30 LOC) SHALL be deleted with their `packages/components/src/index.ts` export lines. `getEffectiveUnderlying` in `packages/components/src/utils/contract-helpers.ts` SHALL be deleted; `getUnderlyingFromShortcode` in the same file SHALL be kept — `contract-card-header.tsx:20` and `positions-drawer-card.tsx:20` import it.

The orphaned type shim `packages/components/@types/react-drag-drawer/` SHALL be deleted with its `packages/components/tsconfig.json` `include` entry; no source file imports `react-drag-drawer` and it is not a declared dependency. `@types/react-div-100vh/` SHALL be kept — `div100vh-container.tsx:2` references it by path.

#### Scenario: Deleted hooks have no importer

- **WHEN** the C8a hooks phase lands and each deleted hook's exported symbol is grepped word-bounded across `packages/` and `playwright/` excluding `node_modules`
- **THEN** every one returns zero hits, and `packages/components/src/hooks/index.ts` no longer lists them

#### Scenario: useOnClickOutside still works after use-event-listener is removed

- **WHEN** the eight files that call `useOnClickOutside` render after the deletion
- **THEN** they behave identically, and `packages/components/src/hooks/use-onclickoutside.ts` no longer imports a deleted module

#### Scenario: AutoSizer consumers are unaffected

- **WHEN** `packages/components/src/components/autosizer/` and the `AutoSizer` line in `packages/components/src/index.ts` are deleted
- **THEN** `data-list.tsx` and `data-table.tsx`, which import `AutoSizer` directly from `react-virtualized`, still render, and the reports specs that mock `react-virtualized`'s `AutoSizer` stay green

### Requirement: [DCR-021] Dead @deriv/components statics and type files are removed

The nine dead component statics SHALL be deleted: the seven `VerticalTab.*` assignments at `packages/components/src/components/vertical-tab/vertical-tab.tsx:185-191`, `Button.Group` at `packages/components/src/components/button/button.tsx:145` (with the `ButtonGroup` component and the `TButtonGroupProps` type it is the sole user of), and `ContractCard.ContractTypeCell` at `packages/components/src/components/contract-card/contract-card.tsx:71` (with its import at line 6). `ContractTypeCell` itself SHALL be kept — `contract-card-header.tsx:148` renders it. Imports in `vertical-tab.tsx` that exist only to feed a deleted static SHALL be removed; the `TItem` type import from `./vertical-tab-header` SHALL be kept.

The three fully-dead type files under `packages/components/src/components/types/` SHALL be deleted with their `index.ts` import and export entries: `icons.types.ts` (`TIconsManifest`, `TIconProps`), `accordion.types.ts` (`TAccordionProps`, `TAccordionItem`) and `multi-step.types.ts` (`TMultiStepProps`, `TMultiStepRefProps`) — none has a reference outside the `types/` directory. `TErrorMessages` SHALL be deleted from `contract.types.ts` and `TGenericObjectType` from `common.types.ts` (its only reader is the deleted `icons.types.ts`). `popover.types.ts`, the surviving members of `contract.types.ts` (`TGetContractPath`, `TToastConfig`) and of `common.types.ts` (`TGetCardLables`, `TGetContractTypeDisplay`, `TDatePickerOnChangeEvent`) SHALL be kept.

#### Scenario: No static assignment survives without a reader

- **WHEN** the statics phase lands and `grep -rn "VerticalTab\.\|Button\.Group\|ContractCard\.ContractTypeCell" packages` is run excluding `node_modules`
- **THEN** it returns zero hits

#### Scenario: Deleted types have no reference

- **WHEN** each deleted type name is grepped word-bounded across `packages/` excluding `node_modules`
- **THEN** it returns zero hits, and `packages/components/src/components/types/index.ts` compiles with no dangling import

### Requirement: [DCR-022] The @deriv/components prop surface is pruned to its measured consumers

Each prop removed from a live `@deriv/components` component SHALL be removed only after every consumer of that component has been read and confirmed not to pass it. The consumer set SHALL be the union across all packages, including `packages/core`, whose files are read but never edited.

`VerticalTab` has exactly two consumers: `packages/reports/src/Containers/reports.tsx:222` (passing `is_floating`, `current_path`, `is_routed`, `is_full_width`, `is_sidebar_enabled`, `setVerticalTabIndex`, `list`) and `packages/core/src/App/Components/Layout/Footer/toggle-settings.jsx:16` (passing `list` only). The prune SHALL keep those seven props and MAY remove the other seventeen. `packages/components/src/components/vertical-tab/vertical-tab-header-group.tsx` is reachable only through the `list_groups` prop (`vertical-tab-headers.tsx:84`) and `vertical-tab-layout.tsx` only through the deleted `VerticalTab.Layout` static; each SHALL be deleted only once its sole entry point is removed in the same commit. `vertical-tab-header-title.tsx` is reachable only through `header_title` and follows the same rule.

The remaining prune targets are `tabs`, `modal`, `input-field`'s long-press branch, `input`'s counter and icon props, and `dropdown`/`select-native`/`data-table`/`popover`. Any prop whose removal would require editing a file under `packages/core` SHALL NOT be removed in this change; it SHALL be recorded as a deferral for issue #1274 instead.

#### Scenario: A prop with a live consumer is not removed

- **WHEN** a prop slated for removal is found to be passed by any consumer, in any package
- **THEN** the prop is left in place and the discrepancy is reported rather than removed

#### Scenario: A subcomponent dies with its only entry point

- **WHEN** `list_groups` is removed from `VerticalTab`'s prop type and its `item_groups` pass-through in `vertical-tab.tsx`/`vertical-tab-headers.tsx`
- **THEN** `vertical-tab-header-group.tsx` is deleted in the same commit and nothing imports it

#### Scenario: The prune does not edit packages/core

- **WHEN** the prop-surface prune lands and `git diff --name-only` is inspected
- **THEN** no path under `packages/core/` appears

### Requirement: [DCR-023] The @deriv/components dependency manifest is corrected

`@deriv/stores`, `dayjs`, `glob` and `gh-pages` SHALL be removed from `packages/components/package.json`'s `dependencies` — none is imported by any file under `packages/components`, in source, build config or webpack config. `"@deriv/quill-icons": "2.4.16"` SHALL be added, matching the pin already used by `packages/core`, `packages/shared` and `packages/trader`; 37 files under `packages/components/src` import it today with no declaration. `@types/react-virtualized`, `usehooks-ts`, `react-div-100vh` and `framer-motion` SHALL be kept — each has a live importer or is required for typing.

#### Scenario: quill-icons resolves from the package's own manifest

- **WHEN** `packages/components/package.json` is read after the manifest phase
- **THEN** it declares `@deriv/quill-icons` at `2.4.16` and no longer declares `@deriv/stores`, `dayjs`, `glob` or `gh-pages`, and `npm run build:all` passes

### Requirement: [DCR-024] The reports binary-link cascade and its route helpers are removed

`packages/reports/src/Components/Routes/binary-link.tsx` (34 LOC) SHALL be deleted with `packages/reports/src/Components/Routes/__tests__/binary-link.spec.tsx` and its name in the `export { BinaryLink, RouteWithSubRoutes };` line of `packages/reports/src/Components/Routes/index.ts`; it has no production consumer in `packages/reports`. `packages/core`'s independently defined `BinaryLink` is a different component and SHALL NOT be touched.

`packages/reports/src/Components/Routes/helpers.ts` (36 LOC) SHALL then be deleted in full with `__tests__/helpers.spec.tsx` and the `export * from './helpers';` line: `normalizePath` and `findRouteByPath` are used only by the deleted `binary-link.tsx`, and `isRouteVisible` and `getPath` are already test-only. The `RouteWithSubRoutes` named export SHALL be dropped from `index.ts` — `binary-routes.tsx:5` imports the module directly — while `route-with-sub-routes.tsx`, `binary-routes.tsx` and the `export default BinaryRoutes` line SHALL be kept: `Containers/routes.tsx:4` renders `BinaryRoutes`, which is the live reports router.

#### Scenario: The reports router still resolves its sub-routes

- **WHEN** the cascade lands and `/reports/positions`, `/reports/profit`, `/reports/statement` and `/reports/statement/archived` are exercised
- **THEN** each resolves through `BinaryRoutes` → `RouteWithSubRoutes` → `Constants/routes-config.tsx` exactly as before, and `packages/reports`'s Jest suite is green

#### Scenario: Nothing references the deleted helpers

- **WHEN** `grep -rnw "normalizePath\|findRouteByPath\|isRouteVisible\|getPath\|BinaryLink" packages/reports` is run
- **THEN** it returns zero hits

### Requirement: [DCR-025] Dead reports types and SCSS are removed under the base-class rule

`TColumnTemplateType` and `TSupportedContractType` in `packages/reports/src/Types/common-prop.type.ts` SHALL be deleted — neither is referenced anywhere, including inside its own file. `TPassthrough` SHALL lose its `export` keyword; it is read only by `TBinaryRoutes` and `TRoutes` in the same file. `TBinaryRoutes`, `TRoute`, `TRouteConfig`, `TErrorComponent`, `TRoutes`, `TInputDateRange`, `TColIndex`, `TCellContentProps`, `THeaderProps` and `TUnsupportedContractType` all have live consumers and SHALL be kept.

Dead SCSS in `packages/reports/src/sass/` SHALL be removed only after the **base class** — not a modifier — is proven absent from the TSX. A class reached by a template literal (for example `amount--${getProfitOrLoss(...)}` at `data-table-constants.tsx:116` and `profit-loss-cell.tsx:12`) is live even with zero literal grep hits, and SHALL NOT be deleted. `reports.scss` (imported at `Containers/reports.tsx:21`) and `composite-calendar.scss` (imported at `reports.scss:1`) are live even though `sass/app.scss` does not import them, and SHALL NOT be deleted. Chart-library classes (`cq-*`, `stx-*`, `sc-*`, `ciq-*`) are emitted by smartcharts at runtime and SHALL NOT be deleted on a grep result.

Statement rendering SHALL remain intact: the deposit, withdrawal and transfer action-type handling in `packages/reports/src/Containers/statement.tsx`, `packages/reports/src/Stores/Modules/Statement/Helpers/format-response.ts` and `packages/reports/src/Constants/data-table-constants.tsx` SHALL NOT be removed, however cashier-shaped it looks — users read this as their transaction history.

#### Scenario: A dynamically-composed class survives

- **WHEN** a SCSS rule whose class is only ever produced by string interpolation is considered for deletion
- **THEN** it is kept, and the base class is verified in the TSX before any sibling rule is removed

#### Scenario: Statement action types still render

- **WHEN** the statement page renders deposit, withdrawal and transfer rows after the SCSS phase
- **THEN** each row shows its icon, label and amount exactly as before

### Requirement: [DCR-026] The reports dependency manifest is corrected

The sixteen dependencies in `packages/reports/package.json` with zero importers in source, build config or webpack config SHALL be removed: `@deriv/deriv-api`, `acorn`, `canvas-toBlob`, `crc-32`, `dayjs`, `extend`, `formik`, `framer-motion`, `i18next`, `js-cookie`, `lodash.throttle`, `object.fromentries`, `prop-types`, `react-i18next`, `react-transition-group` and `workbox-webpack-plugin`.

Four look dead to a source grep and SHALL be kept: `null-loader` (referenced at `packages/reports/build/constants.js:95`), `react-dom` (declared as a webpack external at `packages/reports/build/webpack.config.js:61`), `core-js` (injected by `@babel/preset-env` with `useBuiltIns: "usage"`, `corejs: 3` in `packages/reports/babel.config.json`) and the `@types/react` / `@types/react-dom` / `typescript` toolchain entries.

`"@deriv/quill-icons": "2.4.16"` and `"@deriv/utils": "^1.0.0"` SHALL be added: seven non-test files under `packages/reports/src` import `@deriv/quill-icons` and `Containers/reports.tsx:15` imports `isAllowedRedirectDomain` from `@deriv/utils`, both resolving only through workspace hoisting today.

#### Scenario: Reports builds from its own declared graph

- **WHEN** the reports manifest phase lands and `npm run build --workspace=@deriv/reports` runs
- **THEN** the build succeeds, `@deriv/quill-icons` and `@deriv/utils` are declared, and none of the sixteen removed names appears in `dependencies`

### Requirement: [DCR-027] Dead @deriv/api modules are removed

`packages/api/src/constants/` SHALL be deleted in full — `countries.ts` (507 LOC, exporting only `ALPHA_2_TO_ALPHA_3`, which has zero references) and its `index.ts` barrel, which `packages/api/src/index.ts` never re-exports.

`packages/api/src/utils/file-utils.ts` (195 LOC) and `packages/api/src/utils/__test__/file-utils.spec.ts` SHALL be deleted, and `export * from './file-utils';` removed from `packages/api/src/utils/index.ts:1`. Every one of its exports (`compressImage`, `convertToBase64`, `isSupportedImageFormat`, `compressImageFile`, `numToUint8Array`, `generateChunks`, `readFile`, `TFileObject`) is referenced only by that spec. `query-utils.ts` and `crypto.utils.ts` SHALL be kept — `getQueryKeys` and `hashObject` are both live.

`packages/api/src/useInfiniteQuery.ts` (44 LOC) SHALL be deleted with its `import` line and its name in the `export { useInfiniteQuery, useMutation, useQueries, useQuery };` line of `packages/api/src/index.ts`, and the `useInfiniteQuery` section plus its row in the hooks table of `packages/api/README.md`. The `@tanstack/react-query` `useInfiniteQuery` type import at `packages/api/types.ts:49` and the types built on it SHALL be left alone — it is a different symbol.

The six dependencies with zero importers SHALL be removed from `packages/api/package.json`: `@deriv-com/analytics`, `@deriv-com/ui`, `@simplewebauthn/typescript-types`, `dayjs`, `js-cookie` and `react-i18next`, with the matching rows in the README's Dependencies list.

#### Scenario: Nothing imports a deleted api module

- **WHEN** the C8e api phase lands and `ALPHA_2_TO_ALPHA_3`, each `file-utils` export, and `useInfiniteQuery` are each grepped word-bounded across `packages/` excluding `node_modules` and `packages/api/README.md`
- **THEN** the only surviving `useInfiniteQuery` hits are the `@tanstack/react-query` type usages in `packages/api/types.ts`, and the others return zero

#### Scenario: The api package still builds and its hooks still resolve

- **WHEN** `npx tsc -p packages/api/tsconfig.json --noEmit` runs after the phase
- **THEN** it reports zero non-test errors, matching the pre-change baseline

### Requirement: [DCR-028] APIProvider's WSConnections and subscription dedup registry are preserved verbatim

The `WSConnections` machinery in `packages/api/src/APIProvider.tsx` — the `Window` type augmentation at line 50, the initialisation and reuse at lines 94-120, and the `subscriptions` hash-dedup registry at lines 167-197 with its `hashObject` import at line 16 — SHALL NOT be deleted, moved or restructured by this change. They read as dead standalone machinery, but workstream W4 reshapes rather than removes them; deleting them here would force W4 to rebuild them. `packages/api/src/utils/crypto.utils.ts` SHALL survive the `utils/index.ts` edit for the same reason.

#### Scenario: The APIProvider connection machinery is untouched

- **WHEN** `git diff packages/api/src/APIProvider.tsx` is inspected after the change
- **THEN** it shows no change to the `WSConnections` declaration, initialisation, reuse or the `subscriptions` registry

### Requirement: [DCR-029] Dead @deriv/utils modules are removed and logError is preserved

`packages/utils/src/moment.ts` SHALL be deleted with `packages/utils/src/__tests__/moment.spec.ts` and the `export { toMoment } from './moment';` line: it duplicates `packages/shared/src/utils/date/date-time.ts:18`, and every `toMoment` consumer in the repository imports it from `@deriv/shared`.

The three `@deriv/api-v2`-era localStorage helpers `getToken.ts`, `getAccountsFromLocalStorage.ts` and `getActiveLoginIDFromLocalStorage.ts` SHALL be deleted with their specs, their `packages/utils/src/index.ts` export lines, their `packages/utils/README.md` sections and tree-diagram entries, and their `jest.fn()` entries in the repo-root `__mocks__/utils.mock.js`. The stale `Chat` mock left in that file by DCR-006 SHALL be removed in the same edit, with `packages/core/src/Services/__tests__/logout.spec.js` re-run to confirm nothing depended on it. `safeParse` and `getLocalStorage` SHALL be kept (`packages/api/src/hooks/useLocalStorageData.ts:2` and four `packages/trader` files), as SHALL `parse-url.ts` in full (`isExternalLink` in core, `isAllowedRedirectDomain` in reports).

**`packages/utils/src/logging.ts` SHALL NOT be deleted or modified**, nor its `export * from './logging';` line, its spec or its README section. `logError` has zero consumers, and that is expected: `openspec/specs/error-monitoring/spec.md:50` carries a live, non-archived requirement that the utility exist with a `(message: string, data?: TLogData)` signature reporting through PostHog. Deleting it would violate that spec and fail `openspec validate --strict`.

`bowser`, `lodash.groupby` and `lodash.pickby` SHALL be removed from `packages/utils/package.json`'s `dependencies` (zero references anywhere), along with the `@types/lodash.groupby` and `@types/lodash.pickby` devDependencies, and `dayjs` SHALL be removed once `moment.ts` is gone — it is that file's only importer.

#### Scenario: logError survives the sweep

- **WHEN** the C8e utils phase lands
- **THEN** `packages/utils/src/logging.ts` is byte-identical to its pre-change content, `logError` is still exported from `packages/utils/src/index.ts`, its spec passes, and `openspec validate --strict` reports no violation of the `error-monitoring` capability

#### Scenario: toMoment consumers are unaffected

- **WHEN** every `toMoment` call site is inspected after `packages/utils/src/moment.ts` is deleted
- **THEN** each imports from `@deriv/shared`, and the Jest suites covering them are green

### Requirement: [DCR-030] The @deriv/stores type surface is narrowed and its live compatibility aliases are kept

`TUrlUnavailableModalReason`, `TCurrentAccount` and `TClientStore` in `packages/stores/types.ts` SHALL lose their `export` keyword — each is read only inside that file — and `packages/stores/README.md`'s `TClientStore` bullet SHALL be updated accordingly. `TCoreStores`, `TStores`, `TPortfolioPosition`, `TNotificationMessage` and `TCommonStoreServicesError` all have external consumers and SHALL stay exported.

The six local aliases at `packages/stores/types.ts:16-21` (`ActiveSymbols`, `ContractUpdate`, `ContractUpdateHistory`, `LogOutResponse`, `Portfolio1`, `ProposalOpenContract`) SHALL NOT be deleted. The issue body describes them as "orphaned types mirrors"; that claim does not hold at HEAD — each is read by a member of `TCoreStores`. The discrepancy SHALL be reported rather than force-fitted.

No dependency SHALL be removed from `packages/stores/package.json`: `mobx` stays under DCR-014, and `@deriv/api`, `lodash.merge`, `mobx-react-lite` and `react` each have a live importer.

#### Scenario: The stores type mirrors are proven live, not deleted

- **WHEN** each of the six aliases is grepped inside `packages/stores/types.ts`
- **THEN** each has at least one reader, none is deleted, and the discrepancy with the issue body is recorded in the PR description

#### Scenario: The de-exported types break no consumer

- **WHEN** `npx tsc -p packages/stores/tsconfig.json --noEmit` and the full Jest suite run after the de-export
- **THEN** both are green, with zero non-test type errors matching the pre-change baseline

### Requirement: [DCR-031] Stale issue claims are resolved by report, never by substitution

Where a deletion named in issue #1273 does not exist at HEAD, or exists but is live, the change SHALL record the discrepancy in the PR description and SHALL NOT delete a different unit to make the count work.

`packages/components/src/components/dropdown-list/` (claimed 305 LOC) does not exist — C1b removed it under DCR-003. `dropdown/` and `filter-dropdown/` are live prop-prune targets and SHALL NOT be substituted for it. `packages/components/src/utils/helper.js` (claimed 91 LOC with `rename.js`) likewise no longer exists; only `packages/components/utils/rename.js` (30 LOC, outside `src`) survives from that bullet and is the only part of it deleted.

`packages/components/src/components/fullscreen-error/triangle-warning.webp` is **live** and SHALL NOT be deleted: `triangle-warning-icon.tsx:5` imports it and `fullscreen-error.tsx:9` renders the icon. DCR-003 relocated both files into `fullscreen-error/` precisely so they would survive; `FullscreenError` is on the change's do-not-touch list.

`packages/core/src/_common/base/socket_cache.js` SHALL NOT be edited. `socket_cache.getByMsgType` is duck-type-called by `@deriv/deriv-api` and grep-invisible, but the file belongs to issue #1274's scope; if a task appears to require editing it, the task is wrong.

#### Scenario: A missing deletion target is reported, not substituted

- **WHEN** a unit named for deletion is found absent at HEAD
- **THEN** the sub-item is marked already-satisfied, its LOC is subtracted from the phase total, and the discrepancy is named in the PR description — with no other directory deleted in its place

#### Scenario: FullscreenError still renders its warning image

- **WHEN** `FullscreenError` renders after the C8a phase
- **THEN** `triangle-warning.webp` is still present and rendered through `triangle-warning-icon.tsx`

### Requirement: [DCR-032] Deletions are proven per symbol, not by a clean knip exit

`npm run knip:check` SHALL NOT be used as the sole evidence for any deletion in this change. `packages/components/src/index.ts` re-exports through wildcard and named barrels and `packages/shared` uses `export *` throughout, so `import/named` cannot fire, there is no `strictExportPresence`, and `.js`/`.jsx` consumers are excluded from `tsconfig.json` — a deleted export reaches them as `undefined` at runtime with zero static warning.

For each deleted symbol the evidence SHALL be: grep the name word-bounded across the whole repository excluding `node_modules`, `.git` and `dist` — so `__mocks__/`, `scripts/`, `playwright/` and every `.js`/`.jsx` file are included — then read every hit. Removing an import line SHALL always be accompanied by removing the call it fed, in the same commit.

#### Scenario: A symbol with a hit outside its own package is kept

- **WHEN** a word-bounded repository grep for a symbol slated for deletion returns a hit that is not its own definition, spec or barrel line
- **THEN** the symbol is kept and the hit is reported

### Requirement: [DCR-033] The sweep is verified by per-package type oracles and regenerated baselines

Because `.github/workflows/test.yml`'s "Check TypeScript" step backgrounds its `tsc` runs behind a bare `wait` and targets the removed `packages/api-v2`, it always exits 0 and SHALL NOT be relied on. Each phase SHALL instead be checked with `npx tsc -p packages/<pkg>/tsconfig.json --noEmit`, filtered to non-test lines, against the measured pre-change baselines: `components` **2** (`TS2688` for `react-div-100vh` and `react-drag-drawer`, both caused by the `typeRoots: ["./types", "@types"]` typo in `packages/components/tsconfig.json`), `reports` **2**, `api` **0**, `stores` **0**, `utils` **0**. The post-change count SHALL be less than or equal to each baseline; anything above it is this change's fault.

`docs/baselines/knip-baseline.json` and `docs/baselines/alias-usage.json` SHALL be regenerated with the repo's `knip:baseline` / `baseline:update` scripts and committed — `scripts/baseline-check.js` and `scripts/knip-check.js` block CI on drift in either direction, including an unbanked shrink. `baseline:update` SHALL NOT be run against an empty `packages/*/dist`.

`npm run build:all` SHALL be treated as the authoritative gate for the SCSS work: sass-loader hard-fails on an undefined mixin or variable. Playwright SHALL NOT be run: the suite has no `pull_request` trigger and needs staging plus encrypted secrets. The C8d exit criterion SHALL be discharged by naming, in the PR description, which reports specs would exercise the change.

#### Scenario: No package regresses against its type baseline

- **WHEN** each of the five packages is type-checked after its phase
- **THEN** its non-test error count is at or below the recorded baseline, and every remaining error is one of the four pre-existing lines

#### Scenario: Baselines are regenerated and committed

- **WHEN** the change is ready to ship
- **THEN** `npm run knip:check` and `npm run baseline:check` both exit 0, and both baseline JSON files are part of the commit

#### Scenario: Playwright coverage is discharged by statement

- **WHEN** the C8d exit criterion is evaluated
- **THEN** the PR description names the reports Playwright specs that cover the touched flows and states why no run was attempted, and no run is attempted

### Requirement: [DCR-034] The unreachable core notification and layout clusters are removed

`packages/core/src/App/Containers/Layout/header/show-notifications.tsx` has zero consumers. The whole chain hanging off it SHALL be deleted together, in one commit, so no phase leaves a dangling import: `show-notifications.tsx` and its spec, its entry in `App/Containers/Layout/header/index.ts`, `App/Components/Layout/Header/toggle-notifications.jsx`, the `ToggleNotifications` line in `App/Components/Layout/Header/index.js`, and the whole of `App/Containers/NotificationsDialog/` (`notifications-dialog.tsx`, `notification-list-wrapper.tsx`, `notifications-list.tsx`, `notifications-clear-all-footer.tsx`, `index.ts` and their four specs). `App/Components/Layout/Header/header-legacy.tsx` SHALL be edited only to drop the reference it loses; `App/Containers/Layout/header/header.tsx` and `header-legacy.tsx` themselves SHALL be kept — `App/AppContent.tsx:16` renders `Header`.

`packages/core/src/App/Components/Layout/Footer/` SHALL be deleted except `network-status.tsx`, which `header-legacy.tsx` renders: `account-limits.jsx`, `endpoint-note.jsx`, `help-centre.jsx`, `responsible-trading.jsx`, `toggle-settings.jsx`, the `__tests__/` directory entries for the deleted files, and every line of `index.js` except the `NetworkStatus` default export. `App/Components/dev-tools/` (`index.tsx`, `mock-dialog.tsx`, `mock-dialog.scss`, 261 LOC, zero consumers) and `App/Containers/Modals/LogoutSuccessModal/` (3 files + spec, 173 LOC) SHALL be deleted with their barrel entries. `App/Devtools.tsx` SHALL be kept — it is a different module and `App/AppContent.tsx:19` renders it.

The Elements orphans SHALL be deleted: `App/Components/Elements/Media/` (4 files, 35 LOC), `App/Components/Elements/NotificationMessage/notification-order.jsx`, `App/Components/Layout/Header/account-info-icon.tsx` with its spec, `App/Components/Layout/Header/Components/ToggleMenu/menu-title.tsx`, `App/Components/Layout/Header/Components/Preloader/header-items.jsx`, and `App/Containers/server-time.jsx`. Both `src/templates/app/components/loading.jsx` and `src/templates/_common/components/loading.jsx` SHALL be deleted once confirmed unreferenced.

`LiveChat` SHALL NOT be deleted or substituted for: no file matching `*livechat*` or `*live-chat*` exists under `packages/core` at HEAD. The sub-item is already satisfied and SHALL be reported as such.

#### Scenario: The notification chain dies as one unit

- **WHEN** the notification-chain commit lands and `grep -rn "ShowNotifications\|ToggleNotifications\|NotificationsDialog" packages/core/src` is run
- **THEN** it returns zero hits, `npm run build --workspace=@deriv/core` succeeds, and no surviving file imports a deleted module

#### Scenario: The header still renders after the Footer prune

- **WHEN** the app boots after the Footer commit
- **THEN** `network-status.tsx` still renders its indicator through `header-legacy.tsx`, and `packages/core/src/App/Components/Layout/Footer/index.js` exports only `NetworkStatus`

#### Scenario: An absent target is reported, not substituted

- **WHEN** a unit named for deletion (`LiveChat`) is found absent at HEAD
- **THEN** the sub-item is marked already-satisfied, its LOC is subtracted from the phase total, and the discrepancy is named in the PR description — with no other module deleted in its place

### Requirement: [DCR-035] The cookie banner is deleted in full

The cookie banner SHALL be removed rather than preserved, per the product decision recorded in issue #1274 (late Aug 2026): `packages/core/src/App/Components/Elements/CookieBanner/cookie-banner.jsx` (43 LOC), `packages/core/src/sass/app/_common/components/cookie-banner.scss` (75 LOC) and its `@import` line in `packages/core/src/sass/app.scss`, the import at `packages/core/src/App/Containers/Layout/app-contents.jsx:12`, and the hard-disabled render branch in that file together with the `show_cookie_banner` state, the `tracking_status_cookie` / `TRACKING_STATUS_KEY` machinery and the `is_gtm_tracking` state that exist only to feed it.

Any GTM or analytics call in `app-contents.jsx` that survives independently of the banner SHALL be kept. If consent UI is needed later it is rebuilt against current requirements; this change SHALL NOT leave a disabled placeholder behind.

#### Scenario: No cookie-banner residue survives

- **WHEN** `grep -rniE "cookie.?banner|TRACKING_STATUS_KEY|show_cookie_banner" packages/core` is run after the phase, excluding `node_modules`
- **THEN** it returns zero hits, `packages/core/src/sass/app.scss` no longer imports the partial, and `npm run build:all` succeeds

#### Scenario: Analytics that never belonged to the banner still fires

- **WHEN** `app-contents.jsx` mounts after the deletion
- **THEN** every `Analytics` / `pushDataLayer` call that did not exist solely to serve the banner still runs, and `packages/core`'s Jest suite is green

### Requirement: [DCR-036] The core routes machinery is pruned and BinaryLink is preserved

`packages/core/src/App/Components/Routes/helpers.ts` SHALL be pruned to its two live exports, **not** deleted, and the `export * from './helpers';` line of `App/Components/Routes/index.js` SHALL be dropped. Three of the five exports are dead: `isRouteVisible` has no caller, `getPath` is read only by `getContractPath` in the same file, and `getContractPath` is shadowed — every consumer in the repository (`App/Containers/trade-notifications.tsx:5`, `Stores/portfolio-store.js:12`, `packages/trader`'s `trade-store.ts:41` and `contract-card-list.tsx:4`) imports `getContractPath` from `@deriv/shared`. The issue body calls this a "trio"; the measured dead set is exactly three, but not the three it names.

**`normalizePath` and `findRouteByPath` SHALL be kept and SHALL remain exported.** `App/Components/Routes/binary-link.tsx:4` imports both directly from `./helpers` and calls them at `:23-24`, and `binary-link.tsx` is on the DCR-049 KEEP list — deleting the module would break a KEEP-set member. `__tests__/helpers.spec.ts` SHALL likewise be pruned to the cases for those two exports rather than deleted, so the surviving code keeps its coverage.

The `LanguageLink` and `RouteWithSubRoutes` **named** exports SHALL be dropped from `App/Components/Routes/index.js`. `BinaryLink` SHALL be kept and SHALL remain exported: it is live at `Layout/Footer/endpoint-note.jsx:4`, `Layout/Header/menu-link.tsx:9`, `Elements/NotificationMessage/notification.jsx:12` and `notification-order.jsx:6`. `route-with-sub-routes.jsx` and `binary-routes.jsx` SHALL be kept — `binary-routes.jsx` imports the former directly and is the live core router.

`packages/core/src/App/Components/Routes/language-link.tsx` SHALL NOT be deleted in this change. `packages/shared/src/__tests__/dead-code-sweep.spec.ts:54` reads that path with `fs.readFileSync`, which throws `ENOENT` if the file is gone; fixing the assertion requires editing `packages/shared`, which this change is forbidden to touch. Only its named export is dropped. The deletion SHALL be recorded as a deferral.

The account-closed regex in `App/Components/Routes/binary-routes.jsx:17` and the `case 'news'` branch in `App/Components/Elements/NotificationMessage/notification.jsx:71` (with the `'news'` entry at `:224`) SHALL be deleted once each is confirmed to have no producer.

#### Scenario: Every core route still resolves

- **WHEN** the routes commit lands and `/`, `/contract/:contract_id`, `/reports/*`, `/endpoint` and the 404 fallback are exercised
- **THEN** each resolves through `binary-routes.jsx` → `route-with-sub-routes.jsx` → `App/Constants/routes-config.js` exactly as before, `docs/baselines/route-map.json` is unchanged, and `npm run baseline:check` exits 0

#### Scenario: BinaryLink survives its four consumers

- **WHEN** `grep -rnw "BinaryLink" packages/core/src` is run after the phase
- **THEN** `binary-link.tsx`, the `index.js` export and every surviving consumer are still present, and the notification and menu links still navigate

#### Scenario: The helpers binary-link consumes survive the prune

- **WHEN** `App/Components/Routes/helpers.ts` is read after the phase
- **THEN** it exports `normalizePath` and `findRouteByPath` and nothing else, `binary-link.tsx`'s import of both still resolves, `index.js` no longer re-exports the module, and `__tests__/helpers.spec.ts` covers exactly those two exports

#### Scenario: language-link is kept and the reason is recorded

- **WHEN** the change is ready to ship
- **THEN** `packages/core/src/App/Components/Routes/language-link.tsx` still exists, `packages/shared/src/__tests__/dead-code-sweep.spec.ts` is green and unmodified, and a deferral file under `docs/spec-to-pr/deferrals/` names the cross-package coupling

### Requirement: [DCR-037] Core `_common/` legacy is removed and the live socket surface is preserved

`packages/core/src/_common/lib/` SHALL be deleted in full (`loadCSS.js`, `loadJS.js`, `plugins.js`) — no file under `packages/` imports any of them. The two 0-byte files `_common/base/client_base.js` and `_common/base/currency_base.js` SHALL be deleted; both are empty and unreferenced. In `_common/utility.js`, `createElement` and `isSyntheticsUnavailable` SHALL be deleted with their entries in the `module.exports` object; `getStaticHash` SHALL be kept (`_common/base/socket_cache.js:4` requires it), and `getRegion` and `isEuCountry` SHALL be kept (`Stores/client-store.js:28` imports `getRegion`, which reads `isEuCountry`, and `packages/shared/src/__tests__/dead-code-sweep.spec.ts:60` asserts `const isEuCountry` is still present in this file).

**`packages/core/src/_common/base/socket_cache.js` SHALL NOT be edited.** `getByMsgType` (definition `:128`, export `:173`) has zero in-repo call sites **by design**: it is duck-type-called by `@deriv/deriv-api`'s `DerivAPIBasic` as `storage.getByMsgType`. It SHALL never be deleted on grep evidence.

**`socket_base.sendKeepAlive` and `socket_base.waitForAuth` SHALL NOT be deleted.** `sendKeepAlive` is defined at `_common/base/socket_base.js:113`, consumed at `_common/base/network_monitor_base.js:63` and `:87`, wired to `setInterval` at `:135` and exported at `:406`; `waitForAuth` is defined at `socket_base.js:72` and gates the authorized proxy, client-store boot and gtm-store. Only the dead exports named in the issue scope SHALL be trimmed, each proven individually.

#### Scenario: The duck-typed cache method survives

- **WHEN** `git diff packages/core/src/_common/base/socket_cache.js` is inspected after the change
- **THEN** it is empty, and `getByMsgType` is still defined and exported

#### Scenario: Keep-alive and the auth gate still work

- **WHEN** the app boots and idles past the keep-alive interval after the `_common` phase
- **THEN** `network_monitor_base.js` still calls `sendKeepAlive`, the authorized proxy still awaits `waitForAuth`, and `packages/core/src/_common/base/__tests__/socket_base.spec.js` and `network_monitor_base.spec.js` are green

#### Scenario: utility.js keeps exactly its live exports

- **WHEN** `_common/utility.js` is read after the phase
- **THEN** it exports `getStaticHash`, `isEuCountry` and `getRegion` and nothing else, and `packages/shared`'s `dead-code-sweep.spec.ts` still passes

### Requirement: [DCR-038] Dead core Services, Utils and Constants exports are removed

`requestLogout` at `packages/core/src/Services/logout.js:50` SHALL be deleted with `packages/core/src/Services/__tests__/logout.spec.js` and any helper that becomes unreachable with it. `requestRestLogout` SHALL be kept — `Stores/client-store.js:22` imports it. The issue body describes a "trio"; the measured dead set is smaller and SHALL be re-derived per symbol rather than forced to three.

`authorizeAccount` in `packages/core/src/Services/socket-general.js` SHALL lose its entry in the returned object at `:196`; the implementation at `:167` and its internal call at `:90` SHALL be kept. `unregister` SHALL be deleted from `packages/core/src/Utils/PWA/register-service-worker.ts:73` with its `export { unregister } from './register-service-worker';` line at `Utils/PWA/index.ts:4`; `registerServiceWorker` SHALL be kept. `packages/core/src/Constants/currency.js` SHALL be deleted; `Constants/index.js` already re-exports only `./ui`, so the barrel half of the issue's bullet is already satisfied and SHALL be reported as such.

#### Scenario: Logout still works from the client store

- **WHEN** a user logs out after the Services phase
- **THEN** `client-store.js` still calls `requestRestLogout`, the session is cleared, and `packages/core`'s Jest suite is green

#### Scenario: A de-exported symbol keeps its internal caller

- **WHEN** `socket-general.js` handles an `authorize` response after the phase
- **THEN** `authorizeAccount` still runs at `:90` and `is_authorize` still flips, while nothing outside the module can import it

### Requirement: [DCR-039] Orphaned core assets are removed and the stale alias map is retired everywhere it is declared

`packages/core/src/public/fonts/` (264 KB, 5 files) SHALL be deleted: no `@font-face` rule, stylesheet, template or source file in the repository references `binary_symbols.woff` or `casino_hand-webfont.*`, and nothing imports through the `Fonts` alias. `packages/core/src/public/images/common/static_images/presets-onboarding/` (212 KB, 6 PNGs) and `packages/core/src/public/images/common/plus.svg` SHALL be deleted — zero references each. The orphaned SVGs under `packages/core/src/Assets/` SHALL be deleted only after each filename is grepped repository-wide and returns no importer.

The `Fonts` and `Translations` aliases SHALL be removed from **both** declarations that still carry them: `packages/core/build/constants.js:58` and `:64`, and the `packages/core` `paths` block in the repo-root `knip.json`. `packages/core/tsconfig.json` and `packages/core/jest.config.js` declare neither and SHALL NOT be edited for this. `Translations` points at `packages/core/src/public/translations`, which does not exist. The `Images` alias SHALL be **kept**: `packages/core/src/public/images/` is live — `favicons/`, `logos/platform_logos/` and `static_images/` are all copied by `packages/core/build/config.js` and served through `getUrlBase('/public/images/common/...')`.

`packages/core/src/public/videos/` SHALL NOT be deleted: `packages/trader/src/AppV2/Utils/__tests__/guide-animation-assets.spec.ts:35` resolves that directory, and `getUrlBase('/public/videos/fire.lottie')` reads from it.

`packages/core/src/root_files/front-channel.html` SHALL NOT be deleted in this change. Its only in-repo reference is the CopyPlugin entry at `packages/core/build/config.js:59-60`, and the repository contains no OIDC or front-channel-logout registration to check against — the page is a front-channel logout target registered with an external identity provider, which cannot be verified from this tree. The issue makes that verification a hard gate; the gate SHALL be discharged by deferring the deletion, not by assuming it.

#### Scenario: Deleted assets have no reference

- **WHEN** each deleted asset's filename is grepped repository-wide excluding `node_modules`, `.git` and `dist`
- **THEN** it returns zero hits, and `npm run build:all` emits a smaller asset set than the C0 baseline

#### Scenario: The alias map is retired consistently

- **WHEN** `grep -rn "Fonts\|Translations" packages/core/build/constants.js knip.json` is run after the phase
- **THEN** neither alias appears, `Images` still appears in both, `npm run baseline:update` records the new `roots.core` set, and `npm run baseline:check` exits 0

#### Scenario: Live static images still resolve at runtime

- **WHEN** the 404 page and the market-selection empty state render after the asset phase
- **THEN** `getUrlBase('/public/images/common/404.png')` and `getUrlBase('/public/images/common/no-market-found.webp')` still resolve to copied files

### Requirement: [DCR-040] The core dependency manifest is corrected

Every dependency in `packages/core/package.json` with zero importers in `src/`, `build/`, `babel.config.json`, `jest.config.js` or `webpack.config.js` SHALL be removed from `dependencies`. The measured candidate set at HEAD is fifteen, not the issue's sixteen: `@deriv-com/quill-tokens`, `@simplewebauthn/browser`, `acorn`, `canvas-toBlob`, `crc-32`, `framer-motion`, `i18next`, `loadjs`, `lodash.debounce`, `object.fromentries`, `postcss-rtlcss`, `react-i18next`, `react-tiny-popover`, `react-window` and `usehooks-ts`. Each SHALL be re-derived and any that proves live SHALL be kept and reported.

`null-loader` (`packages/core/build/constants.js`) and `dotenv-webpack` (same file) SHALL be **moved** to `devDependencies`, not removed.

Four entries look dead to a source-only grep and SHALL be **kept**: `@deriv/trader` and `@deriv/reports` (lazy-imported at `packages/core/src/App/Constants/routes-config.js` and resolved by path in `packages/core/build/config.js`), `core-js` (injected by `@babel/preset-env` with `useBuiltIns: "usage"`, `corejs: 3` in `packages/core/babel.config.json`) and `react-dom` / `react-router` / `react-transition-group`, each with live importers.

#### Scenario: Core builds from its own declared graph

- **WHEN** `npm run bootstrap` then `npm run build --workspace=@deriv/core` runs after the manifest phase
- **THEN** the build succeeds, none of the removed names appears in `dependencies`, and `null-loader` and `dotenv-webpack` appear under `devDependencies`

#### Scenario: A build-config-only dependency is not removed

- **WHEN** a dependency's only reference is a loader string, a webpack `externals` entry or a babel preset option
- **THEN** it is kept (or moved to `devDependencies`), never deleted, and the reference is cited in the PR description

### Requirement: [DCR-041] Core SCSS is pruned only on positive evidence of a dead base class

Core SCSS deletions SHALL be led by `packages/core/src/sass/app/_common/components/account-common.scss` (1,083 LOC), the never-imported module partials, the dead-end chains (`settings.scss`, `notifications-dialog.scss`, `media-item.scss`, `cookie-banner.scss`, `side-menu.scss`), `reset-email.scss` and the dead blocks in `reset-password.scss`. Each `@import` line removed from `packages/core/src/sass/app.scss` SHALL be removed in the same commit as its partial.

For every block, the **base** class SHALL be proven absent from the TSX/JSX before deletion — never a modifier. A class produced only by string interpolation (`${base}__row`) is live with zero literal grep hits and SHALL be kept. Chart-library classes `cq-*`, `stx-*`, `sc-*` and `ciq-*` are emitted by smartcharts at runtime, are live despite zero grep hits, and SHALL NOT be deleted.

**`.reset-password*` SHALL be kept** — it is live via `RedirectToLoginModal`. Only `reset-email.scss` and the blocks inside `reset-password.scss` that are proven dead go. When a block cannot be positively proven dead, it SHALL be left in place and recorded, not deleted on the absence of a hit.

`npm run build:all` SHALL be the authoritative gate for this phase: sass-loader hard-fails on an undefined mixin or variable. It SHALL NOT be treated as proof that a deleted class was unused.

#### Scenario: A dynamically-composed class survives

- **WHEN** a rule whose class is only ever produced by string interpolation is considered for deletion
- **THEN** it is kept, and the base class is verified in the JSX/TSX before any sibling rule is removed

#### Scenario: Reset-password still renders

- **WHEN** `RedirectToLoginModal` opens the reset-password surface after the SCSS phase
- **THEN** every `.reset-password*` rule it relies on is still present and the surface is visually unchanged

#### Scenario: The stylesheet phase closes green

- **WHEN** `npm run build:all` and `npm run test:stylelint` run after the core SCSS commit
- **THEN** both pass, and the emitted CSS bundle is measurably smaller than the C0 baseline

### Requirement: [DCR-042] The trader TradeTypes cluster is removed with its dependency and assets

`packages/trader/src/AppV2/Containers/Trade/index.ts` imports only `./trade`, and `trade.tsx` renders `trade-desktop.tsx` / `trade-mobile.tsx`, neither of which imports `trade-types`. The cluster is therefore unreachable from the router and SHALL be deleted as one unit: `AppV2/Containers/Trade/trade-types.tsx`, `AppV2/Containers/Trade/trade-types-content.tsx`, `AppV2/Containers/Trade/__tests__/trade-types.spec.tsx`, `AppV2/Components/TradeTypesSelector/` (6 files incl. `trade-types-selector.scss` and two specs), `AppV2/Components/DraggableList/` (6 files incl. `draggable-list.scss` and two specs), and `AppV2/Hooks/useIsTradeTypeSelectionRestricted.ts` with its spec.

The deletion frees, and SHALL therefore also remove: `react-beautiful-dnd` from `packages/trader/package.json` `dependencies` (its only importer is `draggable-list.tsx:2`), `@types/react-beautiful-dnd` from `devDependencies`, `packages/trader/src/Assets/SvgComponents/ic-grid.svg` (imported only by `trade-types-selector.tsx:9`), and the `pinned_trade_types` localStorage key, whose only readers and writers are the deleted files.

`AppV2/Utils/trade-types-utils.tsx` and `AppV2/Components/TradeTypeTabs/` SHALL be kept — both are live in `trade-desktop.tsx` / `trade-mobile.tsx` and are different modules with similar names.

#### Scenario: The trade page is unchanged

- **WHEN** the Trade route renders on mobile and desktop after the cluster is deleted
- **THEN** it renders exactly as before, `npm run test:jest -- packages/trader` is green, and `npx tsc -p packages/trader/tsconfig.json --noEmit` reports 0 errors

#### Scenario: Nothing references the cluster or its dependency

- **WHEN** `grep -rn "TradeTypesSelector\|DraggableList\|useIsTradeTypeSelectionRestricted\|pinned_trade_types\|react-beautiful-dnd\|ic-grid" packages playwright` is run excluding `node_modules`
- **THEN** it returns zero hits

### Requirement: [DCR-043] The trade-categories tree is removed and icon-trade-categories is preserved

`packages/trader/src/Assets/Trading/Categories/` SHALL be deleted except `icon-trade-categories.tsx` and its spec: `trade-categories.tsx`, `trade-categories-gif.tsx`, `contract-type-description-video.tsx`, all twenty files under `Description/`, and every spec under `__tests__/` and `Description/__tests__/` belonging to a deleted module. No file outside the directory imports any of them.

**`icon-trade-categories.tsx` SHALL be kept and SHALL remain importable at its current path** — `packages/trader/src/AppV2/Components/MarketSelection/market-info-screen.tsx:28` imports it as `IconTradeCategory`. Its directory therefore survives the tree deletion; the surrounding files go around it.

`packages/trader/src/AppV2/Components/Guide/Description/` SHALL NOT be touched — it is the live AppV2 guide surface and a different tree from `Assets/Trading/Categories/Description/`.

#### Scenario: Market info still shows its trade-type icon

- **WHEN** the market-info screen opens after the tree is deleted
- **THEN** `IconTradeCategory` still renders, `icon-trade-categories.spec.tsx` is green, and `market-info-screen.tsx`'s import resolves unchanged

#### Scenario: The SCSS that served the tree dies after it, not before

- **WHEN** `contract-type-info.scss` is considered for deletion
- **THEN** it is deleted only in the SCSS phase, after the `Description/*` files that reference `contract-type-info__content-definition` and `contract-type-info__video` are already gone

### Requirement: [DCR-044] Trader post-redesign orphans and runtime-dead modules are removed

The following SHALL be deleted, each after a repository-wide word-bounded grep confirms zero consumers: `AppV2/Components/SymbolNotFound/` (4 files, 58 LOC), `AppV2/Components/SymbolsSearchField/` (4 files, 173 LOC), `Modules/Contract/Components/AccumulatorsStats/` (4 files, 552 LOC) with `sass/app/modules/contract/accumulators-stats.scss` (251 LOC), the `Modules/Contract/Components/InfoBox/` tree (5 files), `Modules/Contract/Components/ContentLoader/trade-params.tsx` (`TradeParamsLoader`, exported and never imported), the remaining single-file orphans, the four dead hooks, and the dead re-exports and type aliases.

`AppV2/Components/AccumulatorStats/` (singular, `.accumulators-stats-v2`) SHALL be kept — it is the live AppV2 component and a different module from `Modules/Contract/Components/AccumulatorsStats/`. `Modules/Contract/Components/ContentLoader/positions-card.tsx` SHALL be kept, and `react-content-loader` SHALL therefore remain a declared dependency.

`Modules/SmartChart/Components/recent-trade-info.tsx` SHALL NOT be deleted on the issue's "runtime-dead" claim alone: `top-widgets.tsx:7` imports it and `:50` renders it behind `!is_digits_widget_active`. It SHALL be deleted only if the guarding branch is proven unreachable at HEAD; otherwise both it and the branch SHALL be kept and the sub-item recorded as a deferral.

**`AppV2/Utils/symbol-categories-utils.ts` and `categorizeSymbols` SHALL be kept.** The old audit note claiming it loses all consumers is void: it has five live consumers — `Stores/Modules/Trading/trade-store.ts`, `Modules/SmartChart/Adapters/transformers.ts`, `AppV2/Utils/market-selection-labels.tsx`, `AppV2/Hooks/useNonAutomatableSymbolSnackbar.ts` and `AppV2/Hooks/useActiveSymbols.ts`.

**`Config/trade-parameter-presets.ts` SHALL be kept as a module.** Four production files import it (`AppV2/Utils/trade-params-utils.tsx`, `AppV2/Utils/trade-params-preset-utils.ts`, `AppV2/Components/TradeParameters/Stake/stake-desktop.tsx`, `AppV2/Components/TradeParameters/Stake/stake-input.tsx`). Individual named exports with no external reference MAY be de-exported; the file SHALL NOT be deleted.

#### Scenario: A same-named live sibling is not deleted by mistake

- **WHEN** `AccumulatorsStats` (plural, `Modules/Contract/Components/`) is deleted
- **THEN** `AppV2/Components/AccumulatorStats/` (singular) is untouched, the accumulator stats panel still renders on the AppV2 contract surface, and its spec is green

#### Scenario: A runtime-dead claim without proof is deferred

- **WHEN** a module named as "runtime-dead" still has a static importer and its guard cannot be proven always-false at HEAD
- **THEN** the module is kept, the sub-item is left unticked in the plan, and a deferral file is created rather than the module being deleted on the claim

### Requirement: [DCR-045] The trader static directory and its alias map are removed

`packages/trader/src/public/` (107 files, 908 KB) SHALL be deleted in full. It has zero references from source and `packages/trader/build/constants.js` has its `CopyPlugin` import and `copyConfig` entry commented out at `:3` and `:17`, so nothing in it is emitted by any build.

The three alias entries that point into it SHALL be removed with it: `"Fonts/*"`, `"Images"` and `"Translations/*"` in `packages/trader/tsconfig.json:9-15`. That is the **only** declaration of them for `packages/trader`: `packages/trader/build/constants.js`'s `ALIASES` (7 roots) and `packages/trader/jest.config.js`'s `moduleNameMapper` never carried them, and `knip.json` declares no `paths` for `packages/trader`. The issue body's "3 copies of the same stale map (tsconfig + jest + webpack)" is therefore wrong for `packages/trader` and SHALL be corrected in the PR description rather than acted on.

Because `alias-usage.json`'s root set is derived from `build/constants.js`, this deletion SHALL NOT move `roots.trader`; only the core-side removal in DCR-039 moves a root set.

#### Scenario: Trader builds and type-checks with the directory gone

- **WHEN** `npm run build --workspace=@deriv/trader` and `npx tsc -p packages/trader/tsconfig.json --noEmit` run after the deletion
- **THEN** both succeed, `tsc` still reports 0 errors, and no emitted chunk changes name

#### Scenario: The trader root set is unchanged

- **WHEN** `npm run baseline:check` runs after the trader alias entries are removed
- **THEN** `docs/baselines/alias-usage.json`'s `roots.trader` is byte-identical to its pre-change value

### Requirement: [DCR-046] Dead trader build configuration is removed

`packages/trader/build/helpers.js` (33 LOC) SHALL be deleted: its only reference is the commented-out `// const { transformContentUrlBase } = require('./helpers');` at `packages/trader/build/config.js:4`, which SHALL be deleted with it. `generateSWConfig` (`build/config.js:6`) and `htmlOutputConfig` (`build/config.js:14`) SHALL be deleted with their entries in the module's export object at `:40` and `:43` and the commented-out call sites at `build/constants.js:127-128`; no live plugin consumes either.

The `is_test_env` eslint-loader block at `packages/trader/build/constants.js:46-60` SHALL be removed together with the `is_test_env` parameter wherever it exists only to feed it; every other `is_test_env` use in that file (`:76`, `:77`, `:101`, `:125`, `:141`) SHALL be kept. `packages/trader/.eslintrc.ts` SHALL be deleted — `packages/trader/.eslintrc.js` is the file ESLint actually resolves. `packages/trader/index.d.ts`'s `declare module '@binary-com/binary-document-uploader';` line SHALL be deleted; the `import '@testing-library/jest-dom';` line and the file's `include` entry in `packages/trader/tsconfig.json` SHALL be kept.

#### Scenario: The build is byte-equivalent after the config prune

- **WHEN** `npm run build --workspace=@deriv/trader` runs before and after the config commit
- **THEN** the emitted chunk-name set is identical, `docs/baselines/chunk-names.json` needs no change, and `npm run baseline:check` exits 0

#### Scenario: Linting still resolves its config

- **WHEN** `npm run test:eslint --workspace=@deriv/trader` runs after `.eslintrc.ts` is deleted
- **THEN** it resolves `packages/trader/.eslintrc.js` and behaves exactly as before

### Requirement: [DCR-047] The trader dependency manifest is corrected

Six dependencies in `packages/trader/package.json` SHALL be removed: `@deriv-com/quill-tokens`, `@deriv/deriv-api`, `formik`, `mobx-utils`, `prop-types` and `react-beautiful-dnd` (the last freed by DCR-042), together with the `@types/react-beautiful-dnd` devDependency. Each SHALL be re-derived against `src/`, `build/`, `babel.config.json`, `jest.config.js` and every `.scss` file before removal.

`null-loader` SHALL be **moved** to `devDependencies` — `packages/trader/build/constants.js` references it as a loader string. `@deriv-com/analytics`, `extend`, `framer-motion`, `lodash.debounce`, `react-content-loader`, `dayjs` and `clsx` SHALL be kept: each has a live importer under `packages/trader/src`.

#### Scenario: Trader builds from its own declared graph

- **WHEN** `npm run bootstrap` then `npm run build --workspace=@deriv/trader` runs after the manifest phase
- **THEN** the build succeeds and none of the removed names appears in `dependencies` or `devDependencies`

#### Scenario: A dependency freed by a deletion is removed in the same change, not before it

- **WHEN** `react-beautiful-dnd` is removed from the manifest
- **THEN** `packages/trader/src/AppV2/Components/DraggableList/` is already deleted, and `grep -rn "react-beautiful-dnd" packages/trader` returns zero hits

### Requirement: [DCR-048] Trader SCSS is pruned under the base-class and chart-library rules

Trader SCSS deletions SHALL cover the never-imported files, the fully-dead partials (`contract-type-info.scss` 267, `contract-type-widget.scss` 153, `contract-type-dialog.scss` 147, `contract-type-list.scss` 100, `contract-type-no-result.scss` 25, `range-slider.scss` 182, `time-picker.scss` 94) and the dead blocks in live partials (the v1 trade-form block in `sass/app/modules/trading.scss`, and the dead classes in `sass/app/_common/components/purchase-button.scss`). Each `@import` line in `packages/trader/src/sass/app.scss` SHALL be removed in the same commit as its partial.

This phase SHALL run **after** every trader TSX deletion. `contract-type-info.scss`'s classes are referenced today by `Assets/Trading/Categories/Description/*` and `contract-type-description-video.tsx`; the partial only becomes dead once DCR-043 has landed.

For every block the **base** class SHALL be proven absent from the TSX before deletion. `.trade-container` SHALL NOT be deleted wholesale — `Modules/Contract/Containers/contract-replay.tsx:97` renders `trade-container__replay`; only the v1 form block inside it goes. `AppV2/Components/PurchaseButton/purchase-button.scss` SHALL NOT be confused with `sass/app/_common/components/purchase-button.scss`; the AppV2 file is live.

**Chart-library classes `cq-*`, `stx-*`, `sc-*` and `ciq-*` are emitted by smartcharts at runtime and SHALL NOT be deleted on a grep result.** This is why the SUSPECT ~700 LOC around them stays suspect: verify the base, never delete on a modifier grep. Any block that cannot be positively proven dead SHALL be deferred and recorded.

#### Scenario: A partial dies only after its consumers do

- **WHEN** the trader SCSS commit lands
- **THEN** every deleted partial's base class already had zero TSX references at that commit, and `git log` shows the TSX deletion commits preceding it

#### Scenario: A chart-library rule is kept

- **WHEN** a `cq-*` / `stx-*` / `sc-*` / `ciq-*` rule returns zero grep hits
- **THEN** it is kept, and the PR description states that the chart classes were excluded from the sweep by rule

#### Scenario: The trade page and chart render unchanged

- **WHEN** `npm run build:all` and `npm run test:stylelint` run after the trader SCSS commit
- **THEN** both pass, and the emitted CSS bundle is measurably smaller than the C0 baseline

### Requirement: [DCR-049] The verified-live KEEP set is preserved verbatim

The following SHALL NOT be deleted, de-exported, moved or restructured by this change, regardless of what a grep or a tool reports:

- `packages/core/src/_common/base/socket_cache.js` in full, especially `getByMsgType` — duck-type-called by `@deriv/deriv-api`.
- `socket_base.sendKeepAlive` and `socket_base.waitForAuth` (added by PR #1158).
- `packages/core/src/App/Components/Routes/binary-link.tsx` and its `BinaryLink` export.
- `packages/core/src/App/Components/Routes/language-link.tsx` (guarded by a `packages/shared` spec — see DCR-036).
- The `trading_disabled` / `inactive` account-status trade gating, and `redirectToLogin` / `redirectToSignUp`.
- The intentional external cross-app redirects: the header **Deposit** and **Try real** actions, and the insufficient-balance **Deposit now** in `packages/trader/src/AppV2/Components/ServiceErrorSheet/service-error-sheet.tsx`.
- `.reset-password*` SCSS (live via `RedirectToLoginModal`).
- `packages/trader/src/AppV2/Utils/symbol-categories-utils.ts` / `categorizeSymbols`.
- `packages/trader/src/Assets/Trading/Categories/icon-trade-categories.tsx`.
- `packages/trader/src/Config/trade-parameter-presets.ts` as a module.
- `useRiskDisclosure` gating in `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button.tsx` — regulatory (Spain).
- The four AppV2 `commission` sites: `AppV2/Utils/contract-description-utils.tsx:74` (resale-value copy), `AppV2/Components/Guide/Description/ContractDescription/multipliers-trade-description.tsx:55` and `:61` (guide text), and the SCSS comments in `PayoutPerPoint`, `Strike` and `GrowthRate`. PR #1107 removed the commission **mechanism**; these document it, which is a product decision, not a cleanup one.
- Dynamically-constructed CSS classes and chart-library-emitted classes.

Any task that appears to require touching one of these SHALL be treated as wrong and reported, not executed.

#### Scenario: The KEEP set is provably untouched

- **WHEN** `git diff --name-only` and `git diff` are inspected before the PR is opened
- **THEN** none of the named files shows a modification to the named symbol, and the two new guard specs assert the presence of each

#### Scenario: Regulatory gating still fires

- **WHEN** a Spain-resident account opens the trade page after the sweep
- **THEN** `useRiskDisclosure` still gates the purchase button exactly as before

### Requirement: [DCR-050] The sweep lands as ordered, independently-green phases and is never shipped part-ticked

The implementation checklist SHALL be authored and executed as ordered phases, each of which leaves the tree building and testing green on its own, so that a run stopping between phases leaves a coherent branch. Phase order SHALL be cheapest-and-safest first: assets and dead dependencies before code, whole-file deletions before in-file edits, **SCSS last within each package**, and **all of C8b (core) complete before any of C8c (trader) starts**.

Each checklist item SHALL be ticked `- [x]` the instant its phase lands; the tick is the only durable record, and a resumed run restarts from the first unticked item and redoes anything unticked. A run that stops SHALL be resumed with `dstp continue "akmal/issue-1274-c8-core-trader"`; the branch and PR persist and accumulate, and QUALITY, VERIFY and SHIP fire once at the end.

**A partially-ticked plan SHALL NOT be shipped as complete.** If the remaining work does not fit, it SHALL be split into a follow-up issue via `docs/spec-to-pr/deferrals/` and named explicitly in the PR description. Everything in this change reverts together as one commit for the whole branch.

The PR base SHALL be `akmal/issue-1273-c8-small`. `master` SHALL NOT be rebased onto and SHALL NOT be merged in.

#### Scenario: An interrupted run leaves a coherent branch

- **WHEN** the run stops after a phase commits
- **THEN** `npm run build:all` and `npm run test:jest` are green at that commit, every landed phase is ticked, and no unticked item has partial work in the tree

#### Scenario: An incomplete sweep ships honestly

- **WHEN** the plan still has unticked items at ship time
- **THEN** the remainder is filed under `docs/spec-to-pr/deferrals/`, the PR description names what was left out and why, and the PR is not described as completing issue #1274's scope

### Requirement: [DCR-051] Verification is by local per-package type oracles, local Jest and regenerated baselines

`.github/workflows/test.yml`'s "Check TypeScript" step backgrounds its `tsc` runs behind a bare `wait` and targets the removed `packages/api-v2`, so it always exits 0 and SHALL NOT be relied on. Because this PR targets a feature branch, `test.yml`'s `pull_request: branches: [master]` filter means only **3 of 11** checks run at all; the PR description SHALL state this explicitly.

Two type oracles SHALL be recorded before any edit and gated at `≤` thereafter:

- `npx tsc -p packages/trader/tsconfig.json --noEmit` → **0 errors**, total.
- `npx tsc -p packages/core/tsconfig.json --noEmit` → **277** total `error TS` lines, of which **26** are non-test and exactly **1** is in `packages/core` itself (`packages/core/src/App/Components/Layout/Header/login-button.tsx(34,13): error TS2339`). The other 25 non-test lines are `packages/trader` (23) and `packages/reports` (2) source pulled in through the `@deriv/*` path mapping, where their own aliases do not resolve. The gate is stated as both numbers, and the `packages/core`-only count is the one this change owns.

Removing an import line SHALL always be accompanied by removing the call it fed, in the same commit: `packages/core` is heavily `.jsx`, `.js`/`.jsx` files are excluded from `tsconfig.json`, `import/named` does not fire through barrels, and there is no `strictExportPresence`, so a dangling import reaches a `.jsx` consumer as `undefined` at runtime with no static warning.

`docs/baselines/knip-baseline.json` and `docs/baselines/alias-usage.json` SHALL be regenerated with `npm run knip:baseline` and `npm run baseline:update` and committed — `scripts/knip-check.js` fails on an unbanked shrink and `scripts/baseline-check.js` fails on any root-set or count movement. `npm run baseline:update` SHALL NOT be run against an empty `packages/*/dist`; `npm run build:all` SHALL run first so the chunk assertion is live.

Playwright SHALL NOT be run: the suite has no `pull_request` trigger and needs staging plus encrypted secrets. The C8c exit criterion SHALL be discharged by naming, in the PR description, the specs under `playwright/tests/trade/` and `playwright/tests/trade-automate/` that cover the touched flows, and stating that no run was attempted.

#### Scenario: Neither package regresses against its oracle

- **WHEN** both `tsc` runs are repeated after every phase
- **THEN** `packages/trader` is still 0, `packages/core`'s own error count is still 1 and is still `login-button.tsx(34,13)`, and the total non-test count is at or below 26

#### Scenario: Baselines are regenerated after a full build

- **WHEN** the change is ready to ship
- **THEN** `npm run build:all` has run, `npm run knip:check` and `npm run baseline:check` both exit 0, and both baseline JSON files are part of the commit

#### Scenario: Playwright coverage is discharged by statement

- **WHEN** the C8c exit criterion is evaluated
- **THEN** the PR description names the covering Playwright specs and states why no run was attempted, and no run is attempted

### Requirement: [DCR-052] Both swept packages gain a dead-code guard spec

`packages/core/src/__tests__/dead-code-sweep.spec.ts` and `packages/trader/src/__tests__/dead-code-sweep.spec.ts` SHALL be created, following the pattern already used by `packages/shared`, `packages/components`, `packages/reports`, `packages/api`, `packages/stores` and `packages/utils`. Each SHALL assert, per requirement ID:

- that every path named for deletion no longer exists;
- that no barrel line points at a deleted module;
- that each member of the DCR-049 KEEP set is still present — at minimum `socket_cache.getByMsgType`, `socket_base.sendKeepAlive`, `socket_base.waitForAuth`, `BinaryLink`, `language-link.tsx`, `isEuCountry` in `_common/utility.js`, `categorizeSymbols`, `icon-trade-categories.tsx`, `Config/trade-parameter-presets.ts` and the four `commission` copy sites;
- that the removed alias entries are absent from `packages/core/build/constants.js`, `knip.json` and `packages/trader/tsconfig.json`, and that `Images` survives in the core pair.

These are **characterization tests**, not red→green TDD: they pin behaviour and structure that already hold, and they are written after the deletion they guard. They SHALL be declared as such in the PR description, per `.buildwright/framework/tdd-evidence.md`. No test in this change goes red first, because no behaviour changes; every other test change is the deletion of a test whose only subject is deleted in the same commit.

`packages/shared/src/__tests__/dead-code-sweep.spec.ts` SHALL NOT be modified.

#### Scenario: The guard specs fail if a KEEP item is deleted

- **WHEN** any member of the KEEP set is removed and the two new specs run
- **THEN** at least one assertion fails, naming the requirement ID

#### Scenario: The characterization exception is declared

- **WHEN** the PR description is written
- **THEN** it states that the two new specs are characterization guards with no cited red, and that the deleted specs covered only deleted code
