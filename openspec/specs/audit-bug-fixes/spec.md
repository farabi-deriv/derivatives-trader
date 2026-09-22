# audit-bug-fixes Specification

## Purpose
TBD - created by archiving change c6. Update Purpose after archive.
## Requirements
### Requirement: [ABF-001] Each fix is re-verified at HEAD and gated green; not-present reports are recorded

Every fix in this change SHALL be re-verified against HEAD immediately before it is applied — the buggy code (or dead member, or duplicate file) SHALL be confirmed still present, and store members SHALL be grepped `\bmember\b` across all packages so a live consumer is never missed. After each grouped phase, `npm run bootstrap`, `npm run build:all`, `npm run test:jest`, `npm run check-imports` and `npm run knip:check` SHALL all pass. A reported bug that re-verification finds NOT present at HEAD SHALL NOT be coded; the discrepancy SHALL be recorded under `docs/spec-to-pr/findings/` instead.

#### Scenario: A phase lands green and independently

- **WHEN** a grouped phase of fixes is applied
- **THEN** the tree builds, `test:jest`, `check-imports` and `knip:check` pass at the phase boundary, and the phase is a coherent standalone diff

#### Scenario: Bug 14 is recorded as a not-present discrepancy

- **WHEN** `toolbar-widgets.tsx` is re-checked and `isDesktopOs()` is found to be called and `isTabletOs` to be a boolean constant (so `!isTabletOs` is a valid negation and StudyLegend/Share already render on real desktop)
- **THEN** no code change is made and a findings note recording the discrepancy is written under `docs/spec-to-pr/findings/`

### Requirement: [ABF-002] Reports stores dispose base reactions on unmount

`StatementStore` and `ProfitTableStore` `onUnmount()` overrides SHALL invoke `super.onUnmount()` so the reports BaseStore's network-status, logout, client-init and theme disposers are torn down, instead of leaking a fresh network-status reaction on every tab visit.

#### Scenario: Base disposers run when a reports tab unmounts

- **WHEN** a Statement or Profit-table tab is unmounted after mount
- **THEN** the base network-status reaction created on mount is disposed (no accumulation across repeated visits)

### Requirement: [ABF-003] A transient reports error clears and unblocks the tab

The Statement and Profit-table response handlers SHALL reset the error on a successful response and clear the loading flag on the error branch, so a single transient API error no longer leaves the tab stuck in a permanent loading/empty state.

#### Scenario: Success after an error restores the table

- **WHEN** a reports fetch first returns an error and a later fetch succeeds
- **THEN** the error is cleared, loading is false, and the returned rows render

#### Scenario: An error does not brick the tab

- **WHEN** a reports fetch returns an error
- **THEN** the loading flag is cleared so the tab can render its empty/error state rather than spin indefinitely

### Requirement: [ABF-004] Reports empty state has no unreachable no-filter branch

The reports empty-state message shown when a table returns no rows SHALL remain the "no transactions during this period" message, and the unreachable no-filter branch (dead because the date range is always seeded) together with the always-true `has_selected_date` gate that fed it SHALL be removed, with no change to what users see.

#### Scenario: An empty reports table shows the period message

- **WHEN** a Statement or Profit-table query returns zero rows
- **THEN** the "no transactions during this period" empty-state message is shown and no dead no-filter branch remains in the component

### Requirement: [ABF-005] The positions contract-type filter is observable

`PositionsStore.filteredContractTypes` SHALL be a registered MobX observable, so its cross-package readers (e.g. `@deriv/reports` ProfitTableStore) observe writes reactively rather than reading an untracked field.

#### Scenario: A reactive reader re-evaluates when the filter changes

- **WHEN** `filteredContractTypes` is updated via `setClosedContractTypeFilter`
- **THEN** a MobX reaction/observer that reads it re-evaluates, and `isObservableProp(store, 'filteredContractTypes')` is true

### Requirement: [ABF-006] Limit-order barriers clear from the populated source

`clearLimitOrderBarriers` SHALL read the barrier list from `root_store.portfolio.barriers` (the populated source used by `updateLimitOrderBarriers`) instead of the never-populated store-own `barriers`, so a purchased multiplier's take-profit/stop-loss/stop-out chart lines are actually removed after purchase.

#### Scenario: Chart limit-order lines clear after purchase

- **WHEN** `clearLimitOrderBarriers` runs after a successful multiplier purchase and `portfolio.barriers` holds limit-order barriers
- **THEN** those limit-order barriers are removed from the populated barrier list (not a no-op against an empty array)

### Requirement: [ABF-007] The persisted vanilla strike restores on desktop

The persisted `v2_params_initial_values.strike` restore for vanilla Call/Put SHALL run on desktop as well as mobile (the restore SHALL NOT be gated on `ui.is_mobile`), so a returning desktop user's stored strike is applied instead of the bare default from `contracts_for`.

#### Scenario: Desktop applies the stored strike

- **WHEN** a vanilla Call/Put is restored on desktop with a persisted `v2_params_initial_values.strike`
- **THEN** the restored barrier reflects that stored strike rather than the default strike-price choice

### Requirement: [ABF-008] Barrier colours honour dark mode

`createBarriersArray` SHALL accept and apply the `is_dark_mode` argument its call sites already pass, so the theme-appropriate barrier colour reaches the created barriers instead of being silently dropped.

#### Scenario: Dark mode reaches the created barriers

- **WHEN** `createBarriersArray` is invoked with `is_dark_mode` true
- **THEN** the resulting barrier colour reflects the dark-mode intent consistently with the main-barrier colour path

### Requirement: [ABF-009] Contract-update is read from the store that populates it

The contract-replay container SHALL read `contract_update` from the replay store that assigns it (from the proposal's `limit_order`) rather than from `contract_store`, where it is never declared and is therefore permanently `undefined`.

#### Scenario: The drawer receives the populated contract-update

- **WHEN** a replayed open contract carries a `limit_order`
- **THEN** the contract drawer receives that populated `contract_update` object rather than `undefined`

### Requirement: [ABF-010] The ext_platform_url path does not crash

The `ext_platform_url` handling SHALL NOT call the nonexistent `client.setExternalParams`; the dead, non-functional external-return branch SHALL be removed so arrival of a `?ext_platform_url=` URL no longer throws a `TypeError`.

#### Scenario: An ext_platform_url URL is handled without throwing

- **WHEN** the app initialises with a URL containing `?ext_platform_url=`
- **THEN** route-history initialisation completes without throwing (no call to an undefined `setExternalParams`)

### Requirement: [ABF-011] Chart layout and countdown are fixed constants

`is_chart_layout_default` and `is_chart_countdown_visible` — whose only setters had zero callers and were thus frozen at their defaults — SHALL be inlined as the constant values their consumers already see; the dead observables, the `setChartLayout`/`setChartCountdown` setters, their `local_storage_properties` entries and their `@deriv/stores` type/mock mirrors SHALL be removed. Rewiring them into a real control is out of scope.

#### Scenario: Consumers keep the same chart layout and countdown values

- **WHEN** the trade chart and replay chart render after the conversion
- **THEN** the chart position and countdown are the same values as before, the dead setters and persisted keys no longer exist, and `@deriv/stores` types/mocks compile

### Requirement: [ABF-012] The dead cookie cluster is removed

The dead chain `setEmail` (no callers) → `email` (always `undefined`) → `setCookieAccount` (never writes) → `has_cookie_account` (permanently `false`) SHALL be deleted whole, along with its constructor reaction, the region/client-info cookie writes and the now-orphaned `getRegion`/`getTrustedDomainName` imports; the two `email` consumers SHALL be reworked so the build stays green and current observable behaviour is preserved. The region/client-info cookie removal rests on the recorded human confirmation that no other property reads them.

#### Scenario: The cookie cluster is gone and the tree stays green

- **WHEN** the cluster is deleted and its `email` consumers reworked
- **THEN** `setEmail`/`email`/`setCookieAccount`/`has_cookie_account` have no references, `build:all`/`test:jest`/`check-imports`/`knip:check` pass, and the GTM payload and app-mount Analytics behaviour are unchanged from before (both previously fed by the always-`undefined` `email`)

### Requirement: [ABF-013] GTM chart-asset-info reflects its constant value

The GTM `chart_asset_info` field SHALL be the constant it always resolves to (`'hidden'`), since `is_chart_asset_info_visible` is commented out and reads `undefined`; the commented-out ui-store block and its dead `local_storage_properties` string SHALL be removed. Reviving a real asset-info control is out of scope.

#### Scenario: chart_asset_info is a stable constant

- **WHEN** a GTM datalayer push includes `chart_asset_info`
- **THEN** it carries `'hidden'` and no longer derives from an undefined observable, and the dead commented block and persisted string are removed

### Requirement: [ABF-014] Contract-trade computeds parse trade-store once

The `contract-trade-store` computeds SHALL parse `sessionStorage['trade_store']` at most once per evaluation instead of repeating the parse (up to four times) across a single markers/filtered-contracts render cycle.

#### Scenario: A single markers evaluation parses once

- **WHEN** the markers/filtered-contracts computeds evaluate for one render cycle
- **THEN** the `trade_store` sessionStorage entry is parsed a single time and the computed outputs are unchanged

### Requirement: [ABF-015] The shadowed LandscapeBlocker module is removed

The byte-identical shadowed `LandscapeBlocker/index.tsx` SHALL be deleted so the directory keeps the single `index.ts` that module resolution already selects.

#### Scenario: Only one LandscapeBlocker barrel remains

- **WHEN** the LandscapeBlocker directory is inspected after the change
- **THEN** exactly one barrel (`index.ts`) exists, its consumers still resolve `LandscapeBlocker`, and the build passes

### Requirement: [ABF-016] Imported packages are declared in their manifests

Every package SHALL declare the dependencies its source and build actually import: `@deriv/quill-icons` in `@deriv/components` and `@deriv/reports`, `@deriv/utils` in `@deriv/reports`, and the devDeps `stylelint-webpack-plugin`, `webpack-bundle-analyzer` and `eslint-formatter-pretty` in `@deriv/trader` (required by its `build/constants.js`).

#### Scenario: Manifests declare their imports

- **WHEN** the affected `package.json` files are inspected after the change
- **THEN** each imported package above is a declared dependency (no longer relying solely on workspace hoisting) and installs/builds remain green

