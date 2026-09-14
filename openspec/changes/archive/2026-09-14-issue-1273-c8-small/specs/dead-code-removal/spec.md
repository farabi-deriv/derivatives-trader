## ADDED Requirements

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
