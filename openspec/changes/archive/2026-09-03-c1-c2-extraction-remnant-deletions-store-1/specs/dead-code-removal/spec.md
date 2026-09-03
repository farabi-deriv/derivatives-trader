## ADDED Requirements

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

`cs_chat_intercom` and `cs_chat_whatsapp` SHALL be removed from the `FeatureFlags` interface AND the `isFeatureFlags` guard in `packages/core/src/types/feature-flags.ts`, and both keys SHALL be removed from `packages/api/src/remote_config.json`. `tracking_rudderstack`, `tracking_posthog` and `native_app_allowed_trade_types` SHALL be kept. This is the remote-config chat gating only — the `FeatureFlagsStore`/`useFeatureFlags` subsystem is NOT touched here (reserved for C7).

#### Scenario: Only chat keys removed from remote config

- **WHEN** the C1d feature-flags phase lands
- **THEN** `cs_chat_intercom` and `cs_chat_whatsapp` are gone from the interface, the `isFeatureFlags` guard and `remote_config.json`, while `tracking_rudderstack`, `tracking_posthog` and `native_app_allowed_trade_types` remain

### Requirement: [DCR-008] Cleanup documentation is updated

`CLAUDE.md` SHALL be updated to reflect that `@deriv/api-v2` has been removed.

#### Scenario: CLAUDE.md no longer lists api-v2

- **WHEN** the C1 docs phase lands
- **THEN** `CLAUDE.md` no longer references `@deriv/api-v2` as an existing package
