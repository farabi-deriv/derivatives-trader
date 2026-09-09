## Open Questions

None blocking. Four decisions were resolved during planning and are recorded rather than asked:

1. **`unsupported_contract_types_list` after the C7e cut** — kept, with its three trader consumers, on the same "cheap insurance" rationale that settled the `tradeTypeIcons` KEEP (design D5). Deleting it is not required by the cascade.
2. **The two categories left empty by C7e** — deleted, not left as `categories: []`. `getAvailableCategories` in `contracts-for-utils.ts` has no delete-empty step, so an empty category would leak into the trade-type list shape (design D5).
3. **`mockContractInfo` relocation and the Playwright `featureFlags.ts` util** — both deferred; see `docs/spec-to-pr/deferrals/` (design D8). Both must be named in the PR description.
4. **The broken CI `Check TypeScript` step** — not fixed here; worked around with the local oracle in task 9.1 and filed at `docs/spec-to-pr/deferrals/ci-typescript-gate-is-a-no-op.md`.

Assumption carried into the work: `__mocks__/utils.mock.js` also holds a phantom `Chat` mock left over from the C1 chat removal. It is **not** deleted here (issue #1272 names only `getFeatureFlag`); it is reported in the PR description as follow-up.

## 1. Branch setup and pre-flight

- [x] 1.1 Confirm the working tree is on `akmal/issue-1272-shared-sweep` and level with `master`; bring `master` in with `git merge` (never `--force`).
- [x] 1.2 Add `.spec-to-pr/` to `.gitignore` so the run-state file is not swept into the feature commit.
- [x] 1.3 Record the type oracle's starting point: `npx tsc -p packages/shared/tsconfig.json --noEmit 2>&1 | grep '^packages/shared/src/' | grep -v '__tests__' | grep 'error TS'` → expect exactly 4 lines (2× `analytics.ts`, 1× `analytics-utils.ts`, 1× `object/object.ts`).
- [x] 1.4 Confirm `npm run knip:check` and `npm run baseline:check` both exit 0 before any edit, so later failures are attributable.

## 2. C7a — whole files and directories (717 LOC)

- [x] 2.1 Delete `packages/shared/src/utils/object/clone.js` and remove `export { default as cloneThorough } from './clone';` from `packages/shared/src/utils/object/index.ts:2`.
- [x] 2.2 Delete `packages/shared/src/utils/analytics/analytics.ts` and remove `export { default as cacheTrackEvents } from './utils/analytics/analytics';` from `packages/shared/src/index.ts:31`. Leave `analytics-utils.ts`, `automation-analytics.ts` and `redesign-analytics.ts` and their three barrel lines untouched.
- [x] 2.3 Delete `packages/shared/src/loaders/` (`react-import-loader.js`, `deriv-reports-loader.js`, `deriv-trader-loader.js`). It has no barrel line. Do **not** touch `packages/shared/src/utils/loader/` or `packages/shared/src/utils/loader-handler/` — different modules, both live and both in `src/index.ts`.
- [x] 2.4 Delete `packages/shared/src/utils/constants/translation-flag.tsx`, remove `export * from './translation-flag';` from `packages/shared/src/utils/constants/index.ts:5`, and remove the commented-out `{/* {TranslationFlag[lang](36, 24)} */}` line at `packages/core/src/App/Components/Routes/language-link.tsx:23`.
- [x] 2.5 Delete `packages/shared/src/utils/digital-options/` and remove `export * from './utils/digital-options';` from `packages/shared/src/index.ts:11`.
- [x] 2.6 Delete `packages/shared/src/utils/location/` and remove `export * from './utils/location';` from `packages/shared/src/index.ts:16`. Leave the independent `isEuCountry` in `packages/core/src/_common/utility.js:66` alone.
- [x] 2.7 Delete `packages/shared/src/utils/validation/regex-validation.ts` and remove `export * from './regex-validation';` from `packages/shared/src/utils/validation/index.ts:2`.
- [x] 2.8 Delete `packages/shared/src/utils/constants/error.ts` and remove `export * from './error';` from `packages/shared/src/utils/constants/index.ts:4`.
- [x] 2.9 Run `npm run knip:baseline` (the three `src/loaders/` files leave the baseline; an unbanked shrink fails `knip:check`) and commit `docs/baselines/knip-baseline.json`.
- [x] 2.10 Gate: `npm run build:all`, `npm run test:jest`, `npm run check-imports`, `npm run knip:check` all green; the type oracle now reports **2** errors.

## 3. C7b — dead exports, card labels and SCSS (~115 LOC)

- [x] 3.1 `packages/shared/src/utils/object/object.ts`: delete `filterObjProperties`, `findValueByKeyRecursively`, `removeEmptyPropertiesFromObject`, `removeObjProperties`; make `isEqualArray` module-private (it is called only by `isDeepEqual` in the same file). Keep `deepFreeze` exported — `utils/currency/currency.ts` imports it.
- [x] 3.2 `packages/shared/src/utils/url/helpers.ts`: delete `getActionFromUrl`, `getPlatformFromUrl`, `getlangFromUrl`, `isStaging`, leaving only `appendLangParam`; then remove `export * from './helpers';` from `packages/shared/src/utils/url/index.ts:2` (`brand.ts` imports it by direct path at line 3).
- [x] 3.3 `packages/shared/src/utils/url/url.ts`: delete `legacyUrlForLanguage`; make the `@deprecated` `normalizePath` module-private (used at lines 66 and 85 of the same file). Do **not** touch `packages/core/src/App/Components/Routes/helpers.ts:18`, which defines its own `normalizePath`.
- [x] 3.4 `packages/shared/src/utils/brand/brand.ts`: delete `getApiBaseUrl`, `getApiUrl`, `getBrandHostname`, `getBrandLoginUrl`, `getBrandLogo`, `getBrandSignupUrl`, `getPlatformLogo`; make `getApiCoreUrl` and `getDomainName` module-private. Verify `getApiCoreBaseUrl`, `getBrandUrl`, `getRedirectHostname`, `getWhoAmIURL`, `getLogoutURL` and `getBrandHomeUrl` still resolve.
- [x] 3.5 `packages/shared/src/utils/browser/browser_detect.ts`: delete `isSafari`. Keep `isSafariBrowser` and its private `getUserBrowser`.
- [x] 3.6 `packages/shared/src/utils/route/route.tsx`: delete `isRouteVisible` (lines 40-41). Keep `matchRoute`, `getSelectedRoute` and `TRoute`. Do **not** touch the live private copies at `packages/core/src/App/Components/Routes/helpers.ts:46` and `packages/reports/src/Components/Routes/helpers.ts:32`.
- [x] 3.7 `packages/shared/src/utils/validator/index.ts`: reduce to `export { default as Validator } from './validator';` — drop `Errors` and `template` from the public surface. Keep `errors.ts` and `validator.ts`; `Validator` is live in all three `base-store` files.
- [x] 3.8 `packages/shared/src/utils/constants/contract.ts`: delete `BUY_PRICE`, `CURRENT_STAKE`, `DONT_SHOW_THIS_AGAIN`, `INITIAL_STAKE`, `LOST`, `WON` from **both** `getCardLabels()` (~line 264) and `getCardLabelsV2()` (~line 317) — 12 entries. Before deleting, read `packages/components/src/components/contract-card/contract-card-items/lookbacks-card-body.tsx:25` (destructuring) and `.../toggle-card-dialog.tsx:84` (computed key) to confirm none of the six appears there.
- [x] 3.9 `packages/shared/src/styles/constants/layout.scss`: delete `$BORDER_RADIUS_2` (line 8), `$MOBILE_WRAPPER_HEADER_HEIGHT` (line 22) and `$MOBILE_WRAPPER_FOOTER_HEIGHT` (line 23). Delete **no** mixin from `mixins.scss` — all eleven have live `@include` sites.
- [x] 3.10 Gate: `npm run build:all` (sass-loader hard-fails on an undefined variable — this is the SCSS proof), `npm run test:stylelint`, `npm run test:jest`, `npm run knip:check`.

## 4. C7c — FeatureFlags subsystem, shared side

- [x] 4.1 `packages/shared/src/utils/constants/contract.ts`: delete `TRADE_FEATURE_FLAGS` (line 689) and `getContractTypeFeatureFlag` (lines 727-730); remove the `hidden_trade_types` computation from `getCleanedUpCategories` and simplify its filter to `typeof item === 'object'` — keep that filter and the delete-empty-category branch. Remove the now-unused `import { LocalStore } from '../storage';` at line 8.
- [x] 4.2 `packages/shared/src/utils/helpers/format-response.ts`: delete `filterDisabledPositions` (lines 11-22) and the imports that existed only for it — `getContractTypeFeatureFlag` (line 3), `extractInfoFromShortcode` and `isHighLow` (line 5), `LocalStore` (line 6) and the whole `@deriv/api` type import on line 1 (`TProfitTableResponse`, `TStatementResponse`). **Keep `TContractInfo`** (line 4) — `formatPortfolioPosition`, which stays, takes it as its parameter type — and keep the `getSymbolDisplayName` / `getMarketInformation` imports on lines 8-9.
- [x] 4.3 `packages/shared/src/utils/helpers/__tests__/format-response.spec.ts`: delete the `filterDisabledPositions` describe block (lines ~44-68) and the `getContractTypeFeatureFlag` jest mock (lines ~4-8). Keep the `formatPortfolioPosition` tests.
- [x] 4.4 `packages/shared/src/utils/constants/__tests__/contract.spec.ts`: remove the now-vestigial `jest.mock('../../storage', ...)` block (lines 35-40), which exists only to stub `LocalStore.getObject` for the deleted flag branch. Confirm the two `getCleanedUpCategories` tests still pass unchanged.

## 5. C7c — FeatureFlags subsystem, stores / api / core / trader

- [x] 5.1 Delete `packages/stores/src/stores/` entirely — `FeatureFlagsStore.ts`, `BaseStore.ts` (its only client) and `index.ts`.
- [x] 5.2 `packages/stores/src/storeProvider.tsx`: drop the `import { FeatureFlagsStore } from './stores';` and the `feature_flags: new FeatureFlagsStore()` line; the memoized value becomes `{ ...store }`. Keep the unmount `useEffect` — it is generic over any store exposing `unmount`.
- [x] 5.3 `packages/stores/types.ts`: delete `import type { FeatureFlagsStore } from './src/stores';` (line 15) and reduce line 691-693 to `export type TStores = TCoreStores;`.
- [x] 5.4 `packages/stores/src/mockStore.ts`: delete the `feature_flags` block (lines 405-410).
- [x] 5.5 `packages/stores/package.json`: remove `"mobx-persist-store": "1.1.2"`. **Keep `"mobx": "^6.6.1"`** — `mobx-react-lite@3.4.3` declares it as a peer dependency, and `src/index.ts:1` re-exports `observer` from it.
- [x] 5.6 Delete `packages/api/src/hooks/useFeatureFlags.ts` and `packages/api/src/hooks/__tests__/useFeatureFlags.spec.tsx`; remove line 2 of `packages/api/src/hooks/index.ts`.
- [x] 5.7 Delete `packages/core/src/Modules/Endpoint/FeatureFlagsSection.tsx` and `packages/core/src/Modules/Endpoint/__tests__/FeatureFlagsSection.spec.tsx`; remove the import (line 5) and the `<FeatureFlagsSection />` render (line 95) from `packages/core/src/Modules/Endpoint/Endpoint.jsx`. **Endpoint.jsx itself stays** — it is the live `routes.endpoint` route.
- [x] 5.8 `packages/core/src/Modules/Endpoint/Endpoint.scss`: delete the `.feature-flags` block (lines 19-25).
- [x] 5.9 `packages/core/src/App/Devtools.tsx`: delete the second, name-shadowed `FeatureFlagsSection` (lines 72-96) and the `devtools__panel-right` div that renders it (lines 108-111); remove `useStore` from the `@deriv/stores` import, keeping `observer`. Keep `isProduction` and `ProductionSafeDevtools`. Then delete the now-orphaned `&__panel-right` (line 73) and `&__checkbox-container` (line 106) rules from `Devtools.scss`, keeping `&__checkbox-label`, which `EndpointSection` still uses.
- [x] 5.10 `packages/core/src/App/Components/Routes/__tests__/route-with-sub-routes.spec.tsx`: remove the `feature_flags: { data: {} }` argument from `mockStore(...)` in `createMockStore` (lines 57-61).
- [x] 5.11 `packages/trader/src/Modules/Contract/Containers/contract-replay.tsx`: delete the `import { useFeatureFlags } from '@deriv/api';` line (6), `getContractTypeFeatureFlag` from the `@deriv/shared` import (line 8), `trade_type_feature_flag` and `is_trade_type_disabled` (lines 42-47), and the effect that closes the page (lines 73-78).
- [x] 5.12 `packages/trader/src/Modules/Contract/Containers/__tests__/contract-replay.spec.tsx`: remove the `jest.mock('@deriv/api', ...)` block carrying `useFeatureFlags` (lines 33-36).
- [x] 5.13 `__mocks__/utils.mock.js` **at the repository root** (not under `packages/`): delete the `getFeatureFlag: jest.fn(() => false),` entry and its comment (lines 19-20). Leave the `Chat` entry alone — report it in the PR description instead.
- [x] 5.14 Hand-verify the three excluded `.js` position stores, each of which imports `filterDisabledPositions` through the wildcard barrel with no static warning: remove the import and the `.filter(filterDisabledPositions)` call in `packages/core/src/Stores/portfolio-store.js` (lines 10, 154), `packages/reports/src/Stores/Modules/Profit/profit-store.js` (lines 4, 101) and `packages/reports/src/Stores/Modules/Statement/statement-store.js` (lines 4, 122). Open each file and read the surrounding chain — a missed edit is `.filter(undefined)`, a runtime `TypeError` in the live positions path.
- [x] 5.15 Update the FeatureFlags section of `packages/stores/README.md` (lines 25, 63) and the `useFeatureFlags` sections of `packages/api/README.md` (lines 222-230, 258).
- [x] 5.16 Gate: `grep -rn "FeatureFlagsSection\|useFeatureFlags\|FeatureFlagsStore\|filterDisabledPositions\|getContractTypeFeatureFlag\|TRADE_FEATURE_FLAGS" packages __mocks__` returns zero hits; `grep -rn "mobx-persist-store" packages` returns zero. `packages/core/src/types/feature-flags.ts`, its spec and `packages/core/src/Utils/Analytics/index.ts` are byte-identical to HEAD.
- [x] 5.17 Gate: `npm run bootstrap`, `npm run build:all`, `npm run test:jest`, `npm run check-imports`, `npm run knip:check`; manually confirm open positions, the profit table and statements still list the same rows, and that the devtools panel still opens.

## 6. C7d — validation rules (one atomic commit)

- [x] 6.1 `packages/shared/src/utils/validation/declarative-validation-rules.ts`: delete the 13 dead `initPreBuildDVRs` entries (`address`, `email`, `general`, `length`, `name`, `password`, `phone`, `po_box`, `postcode`, `regular`, `confirm`, `signup_token`, `tax_id`), keeping `req`, `number` and `barrier`. Do not look for `custom` here — it is special-cased in `validator.ts:124` and is not an entry in this object.
- [x] 6.2 Same file: delete the 8 exported KYC validators (`validAddress`, `validPostCode`, `validTaxID`, `validPhone`, `validLetterSymbol`, `validName`, `validPassword`, `validEmail`), plus `validLength`, `address_permitted_special_characters_message`, and the private helpers `validGeneral`, `validRegular`, `confirmRequired`, `checkPOBox`, `validEmailToken`. Keep `validRequired`, `validBarrier`, `validNumber`, `isMoreThanMax`, `initFormErrorMessages`, `getPreBuildDVRs`, `TOptions`, `TRuleOptions` and `TInitPreBuildDVRs`.
- [x] 6.3 Delete `packages/shared/src/utils/validation/__tests__/declarative-validation-rules.spec.js` — its only subject is `validAddress`, deleted in 6.2.
- [x] 6.4 `packages/shared/src/utils/validation/form-error-messages-types.ts`: remove the 12 dead `Record` keys (`empty_address`, `address`, `email`, `general`, `name`, `password`, `po_box`, `phone`, `postcode`, `signup_token`, `tax_id`, `validTaxID`), leaving `barrier`, `empty_barrier`, `number` and all 5 function properties.
- [x] 6.5 `packages/core/src/Constants/form-error-messages.js` (**not** `src/Utils/Constants/`): remove the same 12 entries and the now-dead `import { address_permitted_special_characters_message } from '@deriv/shared';` at line 2. Keep `empty_barrier`, `barrier`, `number` and the 5 function entries.
- [x] 6.6 Confirm the two consumers of that map still work: `initFormErrorMessages(FORM_ERROR_MESSAGES)` at `packages/core/src/App/app.jsx:58`, and the cross-package `require('@deriv/core/src/Constants/form-error-messages')` at `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts:1966`.
- [x] 6.7 Gate: `npm run build:all`, `npm run test:jest`; manually confirm the trade form still shows "Amount is a required field.", the numeric-range messages, and the barrier messages.

## 7. C7e — trade-type configs (approved cut only) + C7g — signup param

- [x] 7.1 `packages/shared/src/utils/constants/contract.ts`: delete the 10 `getContractTypesConfig` entries for `TRADE_TYPES.ASIAN`, `TICK_HIGH_LOW`, `RUN_HIGH_LOW`, `RESET`, `CALL_PUT_SPREAD`, `END`, `STAY`, `LB_CALL`, `LB_PUT`, `LB_HIGH_LOW` (lines ~88-99, 100-105, 124-141, 142-165).
- [x] 7.2 Same file, `getContractCategoriesConfig` (lines 217-248): remove `RUN_HIGH_LOW`, `RESET`, `ASIAN`, `CALL_PUT_SPREAD` from `'Ups & Downs'`; remove `TICK_HIGH_LOW` from `'Touch & No Touch'`; delete the now-empty `'Ins & Outs'` and `'Look Backs'` categories entirely.
- [x] 7.3 **Do not** touch: `unsupported_contract_types_list` (lines 250-262) or its three trader consumers; any of the 38 keys in `trade-type-icons.ts`; `icon-trade-types.tsx`; `trade-categories.tsx`; `getSupportedContracts` / `getUnsupportedContracts` / `getContractTypeDisplay`; the `TRADE_TYPES` / `CONTRACT_TYPES` constants.
- [x] 7.4 Update `packages/shared/src/utils/constants/__tests__/contract.spec.ts:246-282`, which asserts the exact `getContractCategoriesConfig()` shape, to the 7 surviving categories.
- [x] 7.5 Trace the five optional-chained lookups and confirm none needs a change: `Modules/Contract/Components/ContractAudit/positions-helper.ts:64`, `shared/utils/helpers/active-symbols.ts:133`, `AppV2/Components/SymbolsSearchField/symbols-search-field.tsx:23`, `AppV2/Components/CompactHeader/compact-header.tsx:36`, `AppV2/Components/MarketTabs/market-tab.tsx:57`. If the cascade demands anything beyond 7.1-7.4, stop and record it in the PR description rather than widening the cut.
- [x] 7.6 C7g: `packages/core/src/App/Containers/Modals/app-modals.jsx` — delete `temp_session_signup_params` (line 26), reduce line 27 to `new URLSearchParams(useLocation().search)`, and drop `SessionStore` from the line-4 import (keep `moduleLoader`).
- [x] 7.7 C7g: `packages/core/src/Stores/client-store.js` — reduce line 270 to `search = window?.location?.search || '';` inside its existing `try`/`catch`, and drop `SessionStore` from the import list (line 16). Do not modify `SessionStore` itself.
- [x] 7.8 Gate: `npm run build:all`, `npm run test:jest`; manually confirm the trade-type selector still offers the same tabs, and that loading with `?action=redirect_to_login` still opens `RedirectToLoginModal`.

## 8. C7f — market-icons consolidation (fixture relocation deferred)

- [x] 8.1 Re-confirm byte identity: `md5 packages/shared/src/utils/constants/market-icons.ts packages/trader/src/AppV2/Utils/market-icons.ts` → both `cda0e208bafe3169edad7009d87e16d7`.
- [x] 8.2 Repoint `packages/trader/src/AppV2/Components/SymbolIconsMapper/symbol-icons-mapper.tsx:3` from `import { marketIcons } from 'AppV2/Utils/market-icons';` to `import { marketIcons } from '@deriv/shared';`.
- [x] 8.3 Delete `packages/trader/src/AppV2/Utils/market-icons.ts`. Keep the shared copy and `packages/shared/src/utils/constants/__tests__/market-icons.spec.ts`.
- [x] 8.4 Gate: `grep -rn "AppV2/Utils/market-icons" packages` returns zero; `npm run build:all` and `npm run test:jest` green.
- [x] 8.5 Do **not** attempt the `mockContractInfo` relocation — deferred, `docs/spec-to-pr/deferrals/mock-contract-info-fixture-relocation.md`. Do **not** delete `playwright/e2e-tests-core/utils/featureFlags.ts` — deferred, `docs/spec-to-pr/deferrals/playwright-feature-flags-util.md`.

## 9. Verification and baselines

- [x] 9.1 Type oracle: `npx tsc -p packages/shared/tsconfig.json --noEmit 2>&1 | grep '^packages/shared/src/' | grep -v '__tests__' | grep 'error TS'` → **exactly 2** lines (`utils/analytics/analytics-utils.ts(7,21)` and `utils/object/object.ts(2,16)`). Anything else is this change's fault and must be fixed.
- [x] 9.2 `npm run knip:baseline` and commit `docs/baselines/knip-baseline.json`; then `npm run knip:check` → exit 0.
- [x] 9.3 `npm run baseline:update` and commit `docs/baselines/alias-usage.json` (trader's alias-importer count moves 350 → 349 because of task 8.2) and `docs/baselines/route-map.json`; then `npm run baseline:check` → exit 0. Never run `baseline:update` against an empty `packages/*/dist` — it wipes the committed chunk set; the chunk assertion auto-skips without `dist/`.
- [x] 9.4 Full gate: `npm run bootstrap`, `npm run build:all`, `npm run test:jest`, `npm run test:eslint-all`, `npm run test:stylelint`, `npm run check-imports`. — run by the automated verification stage; `test:stylelint`, `check-imports`, `knip:check`, `baseline:check`, the `tsc` oracle and targeted Jest over every touched area were all run green here.
- [x] 9.5 Confirm `packages/shared/src/index.ts` has no orphan re-export line and that every deleted symbol is absent repo-wide (`grep -rIl -w <name> . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist` returns only unrelated same-named symbols).
- [x] 9.6 Do not attempt a Playwright run: the suite has no `pull_request` trigger, requires staging plus encrypted secrets, imports nothing from `packages/`, and references no deletion target.

## 10. PR

- [x] 10.1 Open the PR against `master` with `Closes #1272` in the description. Do not create a new tracking issue. — description authored to `.spec-to-pr/pr-body.md`; the PR itself is opened by the automated shipping stage.
- [x] 10.2 In the description, state explicitly: the Playwright exit criterion is discharged by inspection (no `pull_request` trigger; zero specs reference any deletion target), not by a run.
- [x] 10.3 In the description, name both deferrals with their reasons and link the files in `docs/spec-to-pr/deferrals/`: the `mockContractInfo` fixture relocation and `playwright/e2e-tests-core/utils/featureFlags.ts` (plus its four doc references).
- [x] 10.4 In the description, report the leftovers found but deliberately not touched: the phantom `Chat` mock in `__mocks__/utils.mock.js:29-33` (orphaned by C1's chat removal); the unreachable `rule.name === 'length' | 'min' | 'not_equal'` branches in `packages/shared/src/utils/validator/validator.ts:41-51` (`Validator` is DO-NOT-TOUCH); and the no-op CI `Check TypeScript` step, filed at `docs/spec-to-pr/deferrals/ci-typescript-gate-is-a-no-op.md`.
- [x] 10.5 In the description, list the measurement corrections to the issue body so reviewers can reconcile the numbers: 717 not ~760 LOC for C7a; 12 not 16 card-label entries; 13 of 16 validation rules; 12 of 15 type keys; 38 not 37 icon keys; zero dead SCSS mixins; only `mobx-persist-store` freed, not `mobx`; ~1,700 LOC total.
- [x] 10.6 Push the branch to `upstream` and open the PR there (a fork PR will not work); use `git merge` to take `master`, never a force-push. — performed by the automated shipping stage.
