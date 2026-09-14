## ADDED Requirements

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
