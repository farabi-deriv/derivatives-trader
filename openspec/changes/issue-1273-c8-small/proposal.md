## Why

`@deriv/components`, `@deriv/reports`, `@deriv/api`, `@deriv/stores` and `@deriv/utils` are the last four small-package reservoirs left by the C1–C2 extraction sweep and the C7 `@deriv/shared` sweep (`dead-code-removal`, DCR-001…DCR-019). Between them they still carry ~2,900 lines that nothing outside their own package references — nine unreferenced hooks, an unimported `InlineMessage`, orphaned type files, seven `VerticalTab.*` statics and two other dead component statics, the whole reports `BinaryLink` route-helper cascade, a 507-line ISO country table, a 195-line file-upload utility, a duplicate `toMoment`, and three `@deriv/api-v2`-era localStorage helpers — plus ~30 declared dependencies that no source file imports.

Two manifests are also wrong in a way that only works by accident: `@deriv/quill-icons` is imported by **37** files in `packages/components/src` and **10** in `packages/reports/src` without being declared in either manifest, and `packages/reports` imports `@deriv/utils` undeclared. All three resolve today only because npm workspaces hoists them; any hoisting change breaks the build.

This is the C8-small slice of GitHub issue [#1273](https://github.com/deriv-com/derivatives-trader/issues/1273). It is cut from `akmal/issue-1272-shared-sweep` (the C7 sweep, PR #1367) and targets that branch, so the diff shows only C8's changes.

## What Changes

- **C8a — `@deriv/components` internals (~880 LOC measured, not ~1,442).** Delete the nine hooks with zero call sites (`use-deep-effect`, `use-event-listener`, `use-interval`, `use-isomorphic-layout-effect`, `use-on-scroll`, `use-prevent-ios-zoom`, `use-safe-state`, `use-state-callback`, `use-device`), `inline-message/` (137), `autosizer/` (4 + its dead `AutoSizer` barrel export), the three fully-dead type files (`icons.types.ts`, `accordion.types.ts`, `multi-step.types.ts`) plus `TErrorMessages`/`TGenericObjectType`, `utils/rename.js` (30), `getEffectiveUnderlying`, and the orphaned `@types/react-drag-drawer/` shim. Delete the nine dead statics: `VerticalTab.ContentContainer|Header|HeaderGroup|Headers|HeaderTitle|Layout|Wrapper` (7), `Button.Group` (with `ButtonGroup` and `TButtonGroupProps`), and `ContractCard.ContractTypeCell` — each assigned in exactly one file and read nowhere (`ContractTypeCell` itself stays; `contract-card-header.tsx:148` renders it).
- **C8a — prop-surface prune (~543 LOC budget).** Narrow live components to their measured consumers, per component: `vertical-tab` (24 props → the 7 its two consumers pass; `vertical-tab-header-group.tsx` and `vertical-tab-layout.tsx` become unreachable and die with the `list_groups`/`header_title` props), `tabs`, `modal`, `input-field`'s long-press branch, `input`'s counter/icon props, and `dropdown`/`select-native`/`data-table`/`popover`.
- **C8a — manifest.** Remove `@deriv/stores`, `dayjs`, `glob`, `gh-pages` (zero importers each); declare `"@deriv/quill-icons": "2.4.16"` to match core/shared/trader.
- **C8d — reports (~200 LOC + manifest).** Delete the `BinaryLink` cascade: `Components/Routes/binary-link.tsx`, its spec, its barrel export, and the whole of `Components/Routes/helpers.ts` (`normalizePath`, `findRouteByPath`, `isRouteVisible`, `getPath` are then test-only) with its spec and `export * from './helpers'`. Drop the dead `RouteWithSubRoutes` named export (the file stays — `binary-routes.tsx` imports it directly). Delete the two unreferenced types (`TColumnTemplateType`, `TSupportedContractType`) and de-export `TPassthrough`. Prune dead SCSS. Remove the 16 unimported dependencies; declare `@deriv/quill-icons` (7 non-test importers) and `@deriv/utils` (`Containers/reports.tsx:15`).
- **C8e — api / stores / utils (~800 LOC + manifest).** Delete `packages/api/src/constants/` (`countries.ts` 507 LOC + its barrel — never re-exported from the package index), `packages/api/src/utils/file-utils.ts` (195) with its spec and barrel line, and `useInfiniteQuery.ts` (44) with its two `src/index.ts` lines. In `@deriv/utils` delete `moment.ts` (the duplicate `toMoment`; every consumer imports `@deriv/shared`'s), `getToken.ts`, `getAccountsFromLocalStorage.ts`, `getActiveLoginIDFromLocalStorage.ts` (all three `@deriv/api-v2`-era, dead since C1a), their specs, barrel lines, README sections and `__mocks__/utils.mock.js` entries. In `@deriv/stores` de-export the three types with no external consumer. Remove 10 dead dependencies (6 api, 0 stores, 4 utils).
- **Three stale issue claims are resolved by report, not by substitution.** `dropdown-list/` (305 LOC) no longer exists — C1b already deleted it (DCR-003); `dropdown/` and `filter-dropdown/` are live prune targets and are **not** substituted for it. `triangle-warning.webp` is **live** — `fullscreen-error/triangle-warning-icon.tsx:5` imports it and C1b relocated it there deliberately; it is **not** deleted. `utils/helper.js` (91 LOC) is likewise already gone; only `packages/components/utils/rename.js` (30 LOC, outside `src`) survives from that bullet.
- **`logError` is explicitly preserved.** `openspec/specs/error-monitoring/spec.md:50` carries a live, non-archived requirement for it. Its zero consumer count is expected, not evidence of death. `packages/utils/src/logging.ts`, its `src/index.ts` export, its spec and its README section are untouched.
- **`WSConnections` and the subscription hash-dedup registry are preserved verbatim** (`packages/api/src/APIProvider.tsx:50`, `:94-120`, `:167-197`) — workstream W4 reshapes them.
- **Verification.** Regenerate and commit `docs/baselines/knip-baseline.json` and `docs/baselines/alias-usage.json`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dead-code-removal`: adds the C8-small sweep requirements (DCR-020…DCR-033) covering `@deriv/components`, `@deriv/reports`, `@deriv/api`, `@deriv/stores` and `@deriv/utils`, the two manifest corrections, the three protected keeps (`logError`, `WSConnections`, `triangle-warning.webp`) and the stale-claim resolution rule.

## Impact

**Packages touched:** `@deriv/components` (primary), `@deriv/reports`, `@deriv/api`, `@deriv/stores`, `@deriv/utils`. Repo-root `__mocks__/utils.mock.js`.

**Explicitly NOT touched:** `packages/core` (issue [#1274](https://github.com/deriv-com/derivatives-trader/issues/1274)'s scope — including `socket_cache.getByMsgType` and `toggle-settings.jsx`, which is a `VerticalTab` consumer and constrains the prune but is not edited), `packages/trader`, `packages/shared`.

**Public API:** `@deriv/components` loses `AutoSizer`, `InlineMessage`, nine hooks, `getEffectiveUnderlying`, five type aliases and ten statics from its barrel, plus the pruned props. `@deriv/api` loses `useInfiniteQuery`. `@deriv/utils` loses `toMoment`, `getToken`, `getAccountsFromLocalStorage` and `getActiveLoginIDFromLocalStorage`. `@deriv/stores` narrows `types.ts`'s export surface by three type aliases; `TCoreStores`, `TStores` and `TPortfolioPosition` are unchanged.

**Dependencies:** `packages/components` −4 +1; `packages/reports` −16 +2; `packages/api` −6; `packages/utils` −4 (plus two `@types/*` devDependencies); `packages/stores` unchanged (`mobx` stays — `mobx-react-lite@3.4.3` declares it as a peer dependency, per DCR-014).

**Docs:** `packages/api/README.md` (the `useInfiniteQuery` section and the Dependencies list), `packages/utils/README.md` (four helper sections and the tree diagram), `packages/stores/README.md` (the `TClientStore` bullet).

**Behaviour:** none intended. Every deletion is of a symbol, file or dependency with zero call sites; every prop removal is of a prop no consumer passes.
