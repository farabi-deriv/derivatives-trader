# refactor: remove dead code from components, reports, api, stores and utils

Closes #1273

**Base branch: `akmal/issue-1272-shared-sweep`.** GitHub retargets this PR to `master` when #1272 merges. `master` is neither rebased onto nor merged in.

## What this does

The C8-small slice of the dead-code sweep: `@deriv/components` (C8a), `@deriv/reports` (C8d) and `@deriv/api` / `@deriv/stores` / `@deriv/utils` (C8e).

97 files changed, **+465 / −4,180**.

| Package             | Files | Net                     |
| ------------------- | ----- | ----------------------- |
| `@deriv/components` | 61    | +225 / −2,323           |
| `@deriv/api`        | 9     | +5 / −893               |
| `@deriv/reports`    | 9     | +5 / −381               |
| `@deriv/utils`      | 11    | +7 / −322               |
| `@deriv/stores`     | 2     | +11 / −11               |
| `@deriv/trader`     | 1     | −3 (one dead SCSS rule) |

Every deletion was proven per symbol by a word-bounded repository grep — including `__mocks__/`, `scripts/`, `playwright/` and every `.js`/`.jsx` file — and every hit was read. `npm run knip:check` was **not** used as evidence for any deletion: `packages/components/src/index.ts` re-exports through barrels, there is no `strictExportPresence`, and `.js`/`.jsx` consumers sit outside `tsconfig.json`, so a deleted export reaches them as `undefined` at runtime with zero static warning.

### Deleted

- **`@deriv/components`** — nine dead hooks (`use-deep-effect`, `use-event-listener`, `use-interval`, `use-isomorphic-layout-effect`, `use-on-scroll`, `use-prevent-ios-zoom`, `use-safe-state`, `use-state-callback`, `use-device`), `inline-message/`, `autosizer/`, `utils/rename.js`, `@types/react-drag-drawer/`, three dead type files (`icons.types.ts`, `accordion.types.ts`, `multi-step.types.ts`) plus `TErrorMessages` and `TGenericObjectType`, `getEffectiveUnderlying`, and the nine dead statics (`VerticalTab.*` ×7, `Button.Group`, `ContractCard.ContractTypeCell`).
- **`@deriv/api`** — `src/constants/` (507-line `ALPHA_2_TO_ALPHA_3` with zero references), `src/utils/file-utils.ts`, `src/useInfiniteQuery.ts`.
- **`@deriv/reports`** — `Components/Routes/binary-link.tsx`, `Components/Routes/helpers.ts`, the `RouteWithSubRoutes` named export, `TColumnTemplateType` / `TSupportedContractType`, and three dead SCSS blocks.
- **`@deriv/utils`** — `moment.ts` (a duplicate of `@deriv/shared`'s `toMoment`) and the three `@deriv/api-v2`-era localStorage helpers.

### Prop-surface prune

`vertical-tab`, `tabs`, `modal`, `input-field`, `input`, `dropdown`, `select-native`, `data-table` and `popover` were pruned to the union of props their consumers actually pass. The consumer sweep read every `<Component` call site across **all** packages and filtered by import source, so `@deriv-com/quill-ui`'s same-named `Modal`, `Input` and `Popover` are excluded. Three subcomponents died with their sole entry point in the same commit: `vertical-tab-header-group.tsx` (with `list_groups`), `vertical-tab-header-title.tsx` (with `header_title`) and `vertical-tab-layout.tsx` (with the `VerticalTab.Layout` static).

`git diff --name-only` contains **no path under `packages/core/`** — it is issue #1274's scope, and its files were read as consumers but never edited.

### Manifests corrected

`@deriv/quill-icons@2.4.16` and `@deriv/utils@^1.0.0` were resolving only through workspace hoisting; both are now declared where they are imported.

## Stale claims in the issue body, and how each was resolved

Per DCR-031, a deletion target that is absent or live is **reported**, never replaced with a different unit to make a count work.

1. **`dropdown-list/` (claimed 305 LOC)** — the directory does not exist. C1b removed it under DCR-003. Ticked as already-satisfied and 305 LOC subtracted from the C8a total. `dropdown/` and `filter-dropdown/` are live and were **not** substituted for it; they are prop-prune targets in this PR.
2. **`triangle-warning.webp`** — listed as a dead static, but it is **live**: `fullscreen-error/triangle-warning-icon.tsx:5` imports it and `fullscreen-error.tsx:9` renders the icon. DCR-003 relocated both files into `fullscreen-error/` precisely so they would survive. Not deleted.
3. **`utils/helper.js` (claimed 91 LOC with `rename.js`)** — `packages/components/src/utils/helper.js` no longer exists (C1b). Only `packages/components/utils/rename.js` (30 LOC, outside `src`) survived from that bullet, and that is the only part of it deleted here.

A fourth correction, on `@deriv/stores`: the issue body describes the six aliases at `types.ts:16-21` (`ActiveSymbols`, `ContractUpdate`, `ContractUpdateHistory`, `LogOutResponse`, `Portfolio1`, `ProposalOpenContract`) as "orphaned types mirrors". That does not hold — each is read by a member of `TCoreStores` (`types.ts:580`, `:50`, `:534`, `:224`, `:49`, `:48`). None was deleted. What _is_ dead is the `export` keyword on three types, so `TUrlUnavailableModalReason`, `TCurrentAccount` and `TClientStore` were de-exported instead.

## Corrected dependency counts

| Scope                      | Issue body | Measured | Note                                                                 |
| -------------------------- | ---------- | -------- | -------------------------------------------------------------------- |
| `reports`                  | 16         | **16**   | correct, but only after keeping four that look dead to a source grep |
| `api` + `stores` + `utils` | 13         | **10**   | api 6, stores **0**, utils 4                                         |

`packages/stores` has no dead dependency: `mobx` is retained under DCR-014 and `@deriv/api`, `lodash.merge`, `mobx-react-lite` and `react` all have live importers. `packages/stores/package.json` is unchanged.

The four `reports` entries kept despite a clean source grep: `null-loader` (a string at `build/constants.js:95`), `react-dom` (a webpack `externals` entry at `build/webpack.config.js:61`), `core-js` (injected by `@babel/preset-env` with `useBuiltIns: "usage"`, `corejs: 3`, so no source import ever appears) and the `@types/react` / `@types/react-dom` / `typescript` toolchain entries. Every dependency removal in this PR was checked against `build/`, `webpack.config.js`, `babel.config.json` and `jest.config.js` as well as `src/`.

`packages/api`'s `@deriv-com/ui` is the mirror case: it appears only at `packages/api/jest.config.js:8` as a `moduleNameMapper` target. A mapper entry for an undeclared package is inert — the mapper intercepts before resolution — so the dependency goes and the mapper line stays.

## Deliberate keeps

- **`logError`** — the issue's "check the `openspec/` error-monitoring change first" gate resolves to **KEEP**. `openspec/specs/error-monitoring/spec.md:50` is a live, non-archived requirement that the utility exist with a `(message: string, data?: TLogData)` signature reporting through PostHog. `packages/utils/src/logging.ts` is byte-identical to its pre-change content, still exported, and its spec still passes. Deleting it would fail `openspec validate --strict`.
- **`WSConnections`** — the `Window` augmentation, the init/reuse block and the `subscriptions` hash-dedup registry in `packages/api/src/APIProvider.tsx` read as dead standalone machinery, but workstream W4 reshapes rather than removes them; deleting here would force W4 to rebuild them. `git diff packages/api/src/APIProvider.tsx` is empty, and `utils/crypto.utils.ts` survived the `utils/index.ts` edit for the same reason.
- **`triangle-warning.webp`** — live, as above.

Also untouched, per DCR-025/D9: the deposit / withdrawal / transfer action-type handling in `Containers/statement.tsx`, `Stores/Modules/Statement/Helpers/format-response.ts` and `Constants/data-table-constants.tsx`. It is cashier-shaped but it is what users read as their transaction history. `insufficient-balance-modal.tsx`'s "Deposit now" is an intentional cross-app redirect and stays.

## Deferrals

Four are filed under `docs/spec-to-pr/deferrals/`:

| File                                        | What is deferred                                                                                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components-tsconfig-typeroots-typo.md`     | `typeRoots: ["./types", "@types"]` in `packages/components/tsconfig.json` — the path does not exist, which is what produces the `TS2688` baseline. Plus a second dangling `include` entry found while implementing. |
| `reports-pre-existing-type-errors.md`       | The two non-test `packages/reports` type errors that define its oracle baseline.                                                                                                                                    |
| `components-prop-prune-core-consumers.md`   | Props kept only because a `packages/core` file passes them — now with the measured per-prop list appended.                                                                                                          |
| `reports-toolchain-deps-in-dependencies.md` | Six `packages/reports` entries that belong in `devDependencies`.                                                                                                                                                    |

`ci-typescript-gate-is-a-no-op.md` was **not** re-filed; the parent C7 change already filed it (tracked at #1364).

## Testing

**No test in this change went red first, by design.** Every test change is either the deletion of a test whose only subject is deleted in the same commit, or a **characterization / regression guard** added around behaviour that already works. This is declared as the characterization exception under `.buildwright/framework/tdd-evidence.md` rather than presented as red→green.

Four of the new guard specs did nonetheless produce genuine red before their phase landed, and those reds are cited:

```
Red: [DCR-029] no longer exports toMoment or the api-v2-era localStorage helpers
     — expected Object.keys(@deriv/utils) not to contain toMoment/getToken/getAccountsFromLocalStorage/
       getActiveLoginIDFromLocalStorage; got [... "getToken", "safeParse", "toMoment", ...]
Red: [DCR-027] should no longer expose any file-utils export
     — expected @deriv/api utils not to have "compressImage", got [Function compressImage]
Red: [DCR-030] should have de-exported the three internally-read types
     — expected types.ts not to contain "export type TClientStore"
Red: [DCR-026] should declare the two packages it imports through workspace hoisting
     — expected dependencies["@deriv/quill-icons"] to be "2.4.16", got undefined
```

`packages/components/src/hooks/__tests__/use-onclickoutside.spec.tsx` is a pure characterization spec: it was written and confirmed **green against the pre-change implementation**, then re-run after `useEventListener` was inlined and deleted, to prove the refactor preserved click-outside behaviour for its eight consumers.

Two specs were deleted as intentional coverage removal, not regression: `packages/api/src/utils/__test__/file-utils.spec.ts` and `packages/utils/src/__tests__/moment.spec.ts`. Both tested only code deleted in the same commit; leaving them would not compile.

`packages/components/src/components/popover/__tests__/popover.spec.tsx` lost four cases that exercised removed props (`is_open`, `onClick`, `counter`, `disable_message_icon`, `onBubbleOpen`, `has_error`) and gained two that cover the same ground through the surviving surface.

### Gates

| Gate                         | Result                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run build:all`          | green                                                                                                          |
| `npm run test:stylelint`     | green                                                                                                          |
| `npm run check-imports`      | green                                                                                                          |
| `npm run knip:check`         | green — 380 findings, matching the regenerated baseline                                                        |
| `npm run baseline:check`     | green                                                                                                          |
| `openspec validate --strict` | valid                                                                                                          |
| Jest, all packages           | 8 packages green (components 38 suites, reports 50, core 47, trader 325, shared 33, api 11, stores 3, utils 4) |

### Type oracles

`.github/workflows/test.yml`'s "Check TypeScript" step backgrounds its `tsc` runs behind a bare `wait` and targets the removed `packages/api-v2`, so it always exits 0 and cannot be relied on. Each package was checked locally instead, filtered to non-test lines:

| Package      | Baseline | After                                                    |
| ------------ | -------- | -------------------------------------------------------- |
| `components` | 2        | **1** (`react-drag-drawer` cleared by deleting the shim) |
| `reports`    | 2        | 2 (both pre-existing, see the deferral)                  |
| `api`        | 0        | 0                                                        |
| `stores`     | 0        | 0                                                        |
| `utils`      | 0        | 0                                                        |

The gate is `≤ baseline`; every remaining error is one of the four pre-existing lines named in the deferral files.

### Playwright

**Not run.** The suite has no `pull_request` trigger and needs staging plus encrypted secrets, so no run was attempted. C8d touches `packages/reports`, whose flows the suite does cover; the specs that would exercise the touched surfaces are:

- `playwright/tests/reports/verify-reports-navigation.spec.ts` — the `BinaryRoutes` → `RouteWithSubRoutes` → `routes-config.tsx` chain that the `binary-link` cascade sits next to, and the `VerticalTab` sidebar that `reports.tsx:222` renders.
- `playwright/tests/reports/verify-reports-open-positions.spec.ts` — `DataTable`, `Dropdown` and `SelectNative`, all pruned here.
- `playwright/tests/reports/verify-reports-empty-states.spec.ts` — `EmptyTradeHistoryMessage` and the `.empty-trade-history` / `.statement-empty` SCSS neighbourhood.
- `playwright/tests/positions/verify-positions-load.spec.ts`, `verify-positions-filters.spec.ts`, `verify-positions-actions.spec.ts`, `verify-positions-empty-states.spec.ts` — the positions surfaces that share `DataTable`, `Popover` and the `amount--*` profit/loss classes.

## CI note

`package-lock.json` changed (+208 / −147): the four manifest edits move per-workspace dependency records, and `npm ci` fails on a lock that disagrees with `package.json`. Expect the first `test` matrix run to time out — `timeout-minutes: 12` against a cold npm cache eats about six of them. `gh pr checks` reports that as "fail" while the API says "cancelled" with zero failed steps. Re-run the job once the cache is warm; do not change test code to work around it.
