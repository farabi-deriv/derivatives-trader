## Purpose

Establishes a single shared MobX `BaseStore` in `@deriv/stores` as the one source of the store infrastructure (storage sync, validation, lifecycle listeners) that every module store extends, replacing the three near-duplicate copies that had drifted apart, and guarantees the consolidated base has no dead machinery and never reads an undefined storage key.

## ADDED Requirements

### Requirement: [BSC-001] A single shared BaseStore lives in @deriv/stores

The real `BaseStore` (storage sync + validation + lifecycle listeners) SHALL exist as exactly one implementation, owned by `@deriv/stores` at `packages/stores/src/base-store.ts` and exported from `packages/stores/src/index.ts`. Every store that currently extends a real `BaseStore` — core (`ClientStore`, `CommonStore`, `UIStore`, `NotificationStore`, `PortfolioStore`, `GTMStore`, `ContractStore`, `ContractTradeStore`, `ContractReplayStore`), reports (`ProfitTableStore`, `StatementStore`), and trader (`TradeStore`, `AutomationStore`, `PositionsStore`, `MarketsStore`) — SHALL extend that shared class. The two JS copies (`packages/core/src/Stores/base-store.js`, `packages/reports/src/Stores/base-store.js`) and the trader `packages/trader/src/Stores/base-store.ts` SHALL be removed once every subclass is repointed. The trader-local `getValidationRules` **type** coupling (`ReturnType<typeof getValidationRules>`) SHALL be replaced by a generic/structural validation-rules type so the shared base carries no trader dependency, while subclasses keep passing their rules via the constructor `validation_rules` option. `@deriv/stores` SHALL declare `@deriv/shared` as a dependency (it provides `isEmptyObject`, `isProduction`, `Validator`); no circular dependency is introduced. The pre-existing generic `BaseStore<T>` at `packages/stores/src/stores/BaseStore.ts` (used only by `FeatureFlagsStore`) is a different class and SHALL NOT be renamed, moved, or altered.

#### Scenario: One BaseStore, all subclasses repointed

- **WHEN** the consolidation lands and `base-store` files across packages are enumerated
- **THEN** the real `BaseStore` exists only at `packages/stores/src/base-store.ts`, the two JS copies and the trader TS copy are gone, and every listed subclass imports/extends the `@deriv/stores` class

#### Scenario: No trader coupling and no circular import

- **WHEN** `@deriv/stores` is type-checked and built after the move
- **THEN** the shared `BaseStore` imports nothing from `@deriv/trader`, its validation-rules type is generic, `@deriv/shared` is a declared dependency, and `check-imports` reports no circular dependency

#### Scenario: Generic BaseStore untouched

- **WHEN** `FeatureFlagsStore` is built after the consolidation
- **THEN** it still extends the generic `BaseStore<T>` at `packages/stores/src/stores/BaseStore.ts`, unchanged

#### Scenario: Runtime behavior is identical

- **WHEN** the full jest suite runs after every subclass is repointed
- **THEN** store construction, storage sync, validation and lifecycle behavior are unchanged and the suite is green

### Requirement: [BSC-002] Dead lifecycle and theme-listener machinery is stripped

The consolidated `BaseStore` SHALL NOT carry the dead theme-listener machinery `onThemeChange`, `disposeThemeChange`, `themeChangeDisposer` and `theme_change_listener` (none has any live caller; the live theme DOM writer is ui-store's `changeTheme()` autorun). The now-dead `this.disposeThemeChange()` call at `packages/trader/src/Stores/Modules/Trading/trade-store.ts:3390` SHALL be removed. The already-removed `onRealAccountSignupEnd`/`disposeRealAccountSignupEnd` machinery SHALL be confirmed absent. The live lifecycle listeners `onLogout`/`onClientInit`/`onNetworkStatusChange`/`onUnmount` (and their disposers) and the validation/storage machinery SHALL be preserved. The stale `CLAUDE.md` note describing `BaseStore.onThemeChange` as a live theme consumer SHALL be corrected.

#### Scenario: Theme-listener machinery gone, live listeners kept

- **WHEN** the consolidated `BaseStore` and `trade-store.ts` are inspected after the strip
- **THEN** `onThemeChange`/`disposeThemeChange`/`themeChangeDisposer`/`theme_change_listener` and the `trade-store.ts:3390` disposer call are absent, `onLogout`/`onClientInit`/`onNetworkStatusChange`/`onUnmount` remain, and no code references a real-account-signup-end listener

### Requirement: [BSC-003] retrieveFromStorage never reads an undefined key and keeps the declared-keys filter

The consolidated `BaseStore.retrieveFromStorage` SHALL never call `localStorage.getItem`/`sessionStorage.getItem` with an `undefined` key: with a default `store_name` of `''` (and the coercion the trader TS copy already used) a store constructed without a `store_name` reads a harmless empty key instead of `getItem(undefined)`. It SHALL also carry forward the core copy's behavior of assigning only keys declared in the store's `*_storage_properties` lists, so a stale key in an old snapshot cannot overwrite derived state. This removes the `getItem(undefined)` defect that was present in both deleted JS copies.

#### Scenario: Store without store_name reads no undefined key

- **WHEN** a subclass that passes no `store_name` (e.g. a reports store) is constructed and `retrieveFromStorage` runs
- **THEN** no `getItem(undefined)` call occurs and construction completes without reading a bogus `"undefined"` key

#### Scenario: Stale snapshot keys are ignored

- **WHEN** `retrieveFromStorage` reads a stored snapshot containing a key not in the store's declared `*_storage_properties`
- **THEN** that key is not assigned onto the store, and only declared keys are restored
