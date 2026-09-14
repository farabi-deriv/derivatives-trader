## Context

See `proposal.md` — Why. Everything below was re-measured against HEAD `8038e85f3f` (the tip of `akmal/issue-1272-shared-sweep`, 2026-09-07); where the issue body and the measurement disagree, the measurement wins.

Four properties of this repository shape the approach:

1. **There is no working type gate in CI.** `.github/workflows/test.yml`'s "Check TypeScript" step backgrounds four `tsc` runs behind a bare `wait`, so the step always exits 0; one target (`packages/api-v2`) was deleted in C1a. Webpack uses `babel-loader` and Jest uses `babel-jest` — both strip types without checking. The oracle has to be run locally, per package.
2. **Dangling imports are silent in `.js`/`.jsx` consumers.** They are excluded from `tsconfig.json`, `import/named` does not fire through barrel re-exports, and there is no `strictExportPresence`. `packages/components/src/index.ts` is 78 lines of named and wildcard re-exports; `packages/core` and `packages/reports` still hold `.jsx` consumers of it.
3. **Two committed baselines block CI in both directions.** `scripts/knip-check.js` fails on an _unbanked shrink_ — deleting a file already listed in `knip-baseline.json` fails the build until the baseline is regenerated — and `scripts/baseline-check.js` fails on any alias-usage count movement.
4. **`packages/core` is off-limits.** It is issue #1274's scope. This matters because `packages/core` is a _consumer_ of the components being pruned (`toggle-settings.jsx` renders `VerticalTab`, 49 `<Modal` call sites live across core and trader). Consumers must be read to prove a prop is unused; they must not be edited to make one unused.

### Measured corrections to the issue body, in full

| Issue body claim                                         | Measured at HEAD `8038e85f3f`                                                                                                                                                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C8a: delete `dropdown-list/` (305 LOC)                   | **Directory does not exist.** C1b deleted it under DCR-003. `dropdown/` (592 LOC) and `filter-dropdown/` are live prune targets, not substitutes. The `.dc-dropdown-list` CSS class survives — it is emitted by `dropdown.tsx:82`'s internal `DropdownList` and matched by `modal.tsx:90`   |
| C8a: delete `utils/helper.js` + `rename.js` (91 LOC)     | `src/utils/helper.js` **does not exist** (C1b). Only `packages/components/utils/rename.js` (30 LOC, outside `src`, a standalone dev script) survives                                                                                                                                        |
| C8a: delete `triangle-warning.webp`                      | **Live.** `fullscreen-error/triangle-warning-icon.tsx:5` imports it; `fullscreen-error.tsx:9` renders the icon. DCR-003 relocated both files here on purpose. `FullscreenError` is on the do-not-touch list                                                                                 |
| C8a: "9 dead hooks (255)"                                | **9 hooks, 234 LOC** of module bodies + 6 barrel lines + 2 co-located specs. `use-event-listener`/`use-isomorphic-layout-effect` are only dead _after_ `use-onclickoutside.ts:2` (live in 8 files) stops importing them                                                                     |
| C8a: `inline-message/` 137 LOC                           | **Exactly 137**, 3 files. No TSX importer; the `.inline-message__information` rules nested in `contract-type-dialog.scss:125` and `mobile-dialog.scss:94` become dead with it                                                                                                               |
| C8a: `autosizer/` 4 LOC                                  | **Exactly 4**, 2 files (`autosizer.scss` is empty). `AutoSizer` is exported at `src/index.ts:13` but nothing imports it from `@deriv/components`; `data-list.tsx` and `data-table.tsx` import it straight from `react-virtualized`                                                          |
| C8a: "dead type files (77)"                              | **58 LOC** of whole files (`icons.types.ts` 34, `accordion.types.ts` 11, `multi-step.types.ts` 13) plus `TErrorMessages` and `TGenericObjectType`. `popover.types.ts`, `common.types.ts` and `contract.types.ts` survive                                                                    |
| C8a: `VerticalTab.*` ×7                                  | **Correct** — `vertical-tab.tsx:185-191`, zero external readers                                                                                                                                                                                                                             |
| C8a: "`@deriv/quill-icons` used 34×"                     | **37 files** under `packages/components/src`                                                                                                                                                                                                                                                |
| C8a: vertical-tab "sole consumer uses 6/24 props"        | **Two consumers, 7 of 24 props.** `reports.tsx:222` passes 7; `packages/core/.../toggle-settings.jsx:16` passes `list`. The 6/24 figure omitted core                                                                                                                                        |
| C8a: `vertical-tab-header-group.tsx` "fully unreachable" | **Conditionally correct.** It is reachable from `vertical-tab-headers.tsx:84`, but only when `item_groups` is non-empty, and no consumer passes `list_groups`. It dies _with_ the prop, not before it                                                                                       |
| C8a total ~1,442 LOC                                     | **~880 LOC** once `dropdown-list` (305), `helper.js` (61 of the 91) and the type-file over-count are subtracted                                                                                                                                                                             |
| C8d: "16 dead deps"                                      | **Correct**, but only after keeping four that look dead to a source grep: `null-loader` (`build/constants.js:95`), `react-dom` (webpack external, `build/webpack.config.js:61`), `core-js` (`babel.config.json` `useBuiltIns: "usage"`) and the `@types/*` + `typescript` toolchain entries |
| C8d: "dead route chain"                                  | **Not a chain deletion.** `Containers/routes.tsx` → `Components/Routes` (`BinaryRoutes`) → `RouteWithSubRoutes` → `routes-config.tsx` is the live reports router. What is dead is `binary-link.tsx`, the whole of `helpers.ts`, and the `RouteWithSubRoutes` _named_ export                 |
| C8d: "dead props + types"                                | **2 dead types** (`TColumnTemplateType`, `TSupportedContractType`) + 1 de-export (`TPassthrough`). The other 11 in `common-prop.type.ts` are live                                                                                                                                           |
| C8e: "13 dead deps across the three packages"            | **10** — api 6, stores **0**, utils 4 (`dayjs` only after `moment.ts` goes). `packages/stores` has no dead dependency: `mobx` is retained under DCR-014 and the other four have live importers                                                                                              |
| C8e: `@deriv/stores` "orphaned types mirrors"            | **Claim does not hold.** All six aliases at `types.ts:16-21` are read by members of `TCoreStores`. What _is_ dead is the `export` keyword on three types (`TUrlUnavailableModalReason`, `TCurrentAccount`, `TClientStore`)                                                                  |
| C8e: `@deriv/utils` "api-v2-only helpers"                | **Correct** — `getToken`, `getAccountsFromLocalStorage`, `getActiveLoginIDFromLocalStorage`: only README prose and `__mocks__/utils.mock.js`. `getLocalStorage` and `safeParse` are **live** and stay                                                                                       |
| `logError` "check the openspec change first"             | **Resolved: KEEP.** `openspec/specs/error-monitoring/spec.md:50` is live and non-archived                                                                                                                                                                                                   |
| C8-small total ~3,252 LOC                                | **~1,900 LOC** of deletions plus the prop-surface prune                                                                                                                                                                                                                                     |

## Goals / Non-Goals

**Goals:**

- Delete only what is provably unreferenced, proven per symbol by repository-wide grep rather than by a tool's exit code.
- Land in phases that each build, test and lint green on their own, so a bisect lands on a coherent tree.
- Fix the two manifests that resolve only through workspace hoisting, so the packages build from their own declared graph.
- Leave the two committed baselines regenerated, so the next change inherits an accurate gate.
- Report every stale claim explicitly rather than deleting something else to match a number.

**Non-Goals:**

- Editing `packages/core` in any way. It is #1274's scope, and it is also the reason parts of the prop prune are deferred.
- Fixing the broken CI `Check TypeScript` step, or the `typeRoots: ["./types", "@types"]` typo in `packages/components/tsconfig.json` that produces the two pre-existing `TS2688` errors. Both are recorded as deferrals.
- Moving `packages/reports`'s `typescript` / `@types/react` / `@types/react-dom` from `dependencies` to `devDependencies`. Recorded as a deferral.
- Restructuring `packages/components/src/index.ts` away from barrel re-exports.
- Widening the prune to props whose only consumer lives in `packages/core`.

## Decisions

### D1 — Prove deadness per symbol; treat `knip:check` as a formality

For each symbol: grep the name **word-bounded** across the whole repository excluding `node_modules`, `.git` and `dist` (so `__mocks__/`, `scripts/`, `playwright/` and every `.js`/`.jsx` file are included), then _read_ every hit. A hit that is the symbol's own definition, spec or barrel line is not a consumer. A hit inside the same package makes the symbol internally live: keep the implementation, drop the barrel line.

This is what caught the three stale claims and the `use-onclickoutside` → `useEventListener` chain, none of which a knip exit code would surface. Removing an import line is always paired with removing the call it fed, in the same commit — the pattern the parent C7 change settled on.

_Alternative rejected:_ trusting `npm run knip:check` plus the CI type step. Both are structurally blind here (barrels defeat the first, the bare `wait` defeats the second).

### D2 — Five local `tsc` oracles, each stated as a shrinking-or-equal number

Measured at HEAD, filtered to non-test lines:

```
components  2   TS2688  Cannot find type definition file for 'react-div-100vh'
                TS2688  Cannot find type definition file for 'react-drag-drawer'
reports     2   composite-calendar-mobile.tsx(91,66)  TS2769
                profit-table.tsx(214,27)              TS2345
api         0
stores      0
utils       0
```

The gate is `≤ baseline`, not "no new errors", so it is unambiguous. Deleting `packages/components/@types/react-drag-drawer/` may take the components count to 1; it must never go up. The four pre-existing lines are named so any fifth is attributable.

_Alternative rejected:_ fixing the `typeRoots` typo to reach 0. It is a real defect but a different change, and coupling a tsconfig fix to a 1,900-line deletion makes both harder to review. Recorded as a deferral.

### D3 — Phase order, chosen so each phase is independently green

1. **C8e-utils** first — smallest, no cross-package coupling, and it touches the repo-root `__mocks__/utils.mock.js`, which every other package's Jest run reads. Getting it wrong early is cheap to spot.
2. **C8e-api** — `constants/`, `file-utils`, `useInfiniteQuery`, deps, README. Independent of everything else.
3. **C8e-stores** — three de-exports plus a README line. Must come after api, because `types.ts` type-imports from `@deriv/api`.
4. **C8d-reports** — the `binary-link` cascade, types, SCSS, manifest. Before C8a, so the reports suite is green _before_ `@deriv/components` starts changing underneath it.
5. **C8a-deletions** — hooks, `inline-message/`, `autosizer/`, type files, statics, `rename.js`, `@types/react-drag-drawer/`, manifest. Regenerate `knip:baseline` here: the deleted files leave the baseline and an unbanked shrink fails `knip:check`.
6. **C8a-prop-prune** last, one commit per component, because it edits live code rather than deleting dead code and is the only phase that can change rendering. Regenerate `baseline:update` at the end — the deletions move the alias-usage counts.

### D4 — The prop prune is bounded by its consumers, and `packages/core` is a read-only consumer

The union of props passed by _all_ consumers is the keep set. For `VerticalTab` that is exactly seven: `is_floating`, `current_path`, `is_routed`, `is_full_width`, `is_sidebar_enabled`, `setVerticalTabIndex` (from `reports.tsx:222`) and `list` (from both consumers). The issue's "sole consumer uses 6/24" figure came from grepping `packages/reports` only; `packages/core/src/App/Components/Layout/Footer/toggle-settings.jsx:16` is the second consumer and it is not editable here.

Two subcomponents die _with_ a prop rather than before it, and only in the same commit:

| File                                      | Sole entry point                                         | Dies when                       |
| ----------------------------------------- | -------------------------------------------------------- | ------------------------------- |
| `vertical-tab-header-group.tsx` (102 LOC) | `vertical-tab-headers.tsx:84`, guarded on `item_groups`  | `list_groups` is removed        |
| `vertical-tab-layout.tsx` (18 LOC)        | the `VerticalTab.Layout` static only — never rendered    | the static is removed (DCR-021) |
| `vertical-tab-header-title.tsx` (14 LOC)  | `vertical-tab-headers.tsx:81`, guarded on `header_title` | `header_title` is removed       |

`vertical-tab-wrapper.tsx` and `vertical-tab-header.tsx` are rendered by `vertical-tab-headers.tsx` unconditionally and stay; `vertical-tab.tsx` keeps its `TItem` type import from the latter.

Any prop whose removal would require an edit under `packages/core/` is **not** removed; it goes to the deferral file for #1274. This is what keeps the ~543 LOC budget honest: the budget is a ceiling, not a target.

_Alternative rejected:_ deleting `vertical-tab-header-group.tsx` up front on the "fully unreachable" claim. It is reachable through a prop that still exists at that point; deleting it first leaves `vertical-tab-headers.tsx:84` importing a missing module.

### D5 — `use-event-listener` and `use-isomorphic-layout-effect` are an atomic sub-phase

`useOnClickOutside` is live in eight files and imports `useEventListener` (`use-onclickoutside.ts:2`), which imports `useIsomorphicLayoutEffect` (`use-event-listener.ts:3`). Neither of the two has any _other_ caller. So the deletion is: inline the single `addEventListener`/`removeEventListener` effect that `useOnClickOutside` actually needs into `use-onclickoutside.ts`, then delete both modules — in one commit. `useOnClickOutside` uses exactly one of `useEventListener`'s four overloads (document events), so the inlined version is a few lines.

_Alternative rejected:_ keeping `use-event-listener.ts` because it "might be useful". That is the YAGNI trap this whole sweep exists to undo; the 78 LOC of overload signatures serve one three-line call site.

### D6 — De-export rather than delete where a symbol is internally live

Six symbols have zero external references but at least one reader inside their own package. Deleting them breaks the package; leaving them exported keeps a dead public surface. They lose the `export` keyword (or their barrel line) and keep their implementation:

| Symbol                                         | Internal reader                                                 |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `packages/reports` `TPassthrough`              | `TBinaryRoutes`, `TRoutes` in the same file                     |
| `packages/stores` `TUrlUnavailableModalReason` | `TUiStore` at `types.ts:318`, `:361`                            |
| `packages/stores` `TCurrentAccount`            | `TClientStore` at `types.ts:187`                                |
| `packages/stores` `TClientStore`               | `TCoreStores` at `types.ts:673`                                 |
| `packages/components` `TGenericObjectType`     | only the deleted `icons.types.ts` → actually deleted            |
| `packages/components` `ContractTypeCell`       | `contract-card-header.tsx:148` → static dropped, component kept |

`packages/stores/README.md` documents `TClientStore`; that bullet is updated in the same commit, per the steering rule that documentation is part of done.

### D7 — Four reports dependencies that look dead to a grep are kept

`null-loader` is referenced as a string in `packages/reports/build/constants.js:95`, `react-dom` is a webpack `externals` entry at `build/webpack.config.js:61`, `core-js` is injected by `@babel/preset-env` (`useBuiltIns: "usage"`, `corejs: 3`) with no source import ever appearing, and `@types/react` / `@types/react-dom` / `typescript` back the `tsc` oracle. A source-only grep marks all six dead; removing any of them breaks the build or the type check. Every dependency removal in this change is therefore checked against `build/`, `webpack.config.js`, `babel.config.json` and `jest.config.js` as well as `src/`.

`packages/api`'s `@deriv-com/ui` is the mirror case: it appears only in `packages/api/jest.config.js:8` as a `moduleNameMapper` target pointing at a repo-root mock. A mapper entry for an undeclared package is harmless — the mapper intercepts before resolution — so the dependency goes and the mapper line stays.

### D8 — SCSS is validated by the build, but only after the base class is proven

`npm run build:all` is the strongest gate in this repo for SCSS: sass-loader hard-fails on an undefined mixin or variable. It cannot, however, catch a deleted _class_ that is still produced by string interpolation. Two live examples in the sweep's own path: `amount--${getProfitOrLoss(...)}` (`data-table-constants.tsx:116`, `:525`, `profit-loss-cell.tsx:12`) and `.dc-dropdown-list` (emitted by `dropdown.tsx`, matched by `modal.tsx:90`). So the rule is: prove the **base** class absent from the TSX, never delete on a modifier grep, and never delete `cq-*` / `stx-*` / `sc-*` / `ciq-*`.

Note that `packages/reports/src/sass/app.scss` does **not** `@import` `app/modules/reports.scss` (1,827 LOC) or `_common/components/composite-calendar.scss` — both are live anyway, reached through `Containers/reports.tsx:21` and `reports.scss:1`. An import-graph walk that only reads `app.scss` would wrongly condemn the largest stylesheet in the package.

### D9 — Statement rendering is treated as a protected surface

The deposit / withdrawal / transfer action-type handling in `statement.tsx`, `Stores/Modules/Statement/Helpers/format-response.ts` and `Constants/data-table-constants.tsx` is cashier-shaped but is what users read as their transaction history. It is not touched. The one confirmed-deletable piece from that neighbourhood — the `icons.types.ts` entries including the `cashier` key — is deletable because `MarketSymbolIconRow` never reads an `icon` prop, and it goes with the whole file under DCR-021.

`insufficient-balance-modal.tsx`'s "Deposit now" is an intentional external cross-app redirect and is kept.

## Risks / Trade-offs

- **A deleted `@deriv/components` export reaches a `.jsx` consumer as `undefined` at runtime with no static warning.** `packages/core` and `packages/reports` both hold `.jsx` files importing from the barrel, and they are outside `tsconfig.json`. → Every deleted barrel line is preceded by a repository-wide word-bounded grep including `.js`/`.jsx`, and `npm run test:jest` is run before each phase is committed.
- **The prop prune is the only phase that can change rendering.** ~543 LOC of edits to live components across eight components. → One commit per component, consumer list read before each, and the phase runs last so a revert costs nothing else.
- **`useOnClickOutside` is live in eight files and sits on top of the two hooks being deleted.** A partial edit ships a broken click-outside on dropdowns, popovers and the date picker. → D5's atomic sub-phase, closed by `grep -rn "use-event-listener\|use-isomorphic-layout-effect" packages` returning zero and the `use-onclickoutside` consumers' specs passing.
- **Removing a dependency that only a build config references breaks the build, not the tests.** → D7's four keeps, and every removal checked against `build/`, `webpack.config.js`, `babel.config.json` and `jest.config.js`.
- **Adding `@deriv/quill-icons` to two manifests changes `package-lock.json`, and the first CI run will likely time out.** The `test` matrix has `timeout-minutes: 12` and a cold npm install eats about six of them; `gh pr checks` reports it as "fail" while the API says "cancelled" with zero failed steps. → Expected; the job is re-run once the cache is warm. Test code is not changed to work around it.
- **Both committed baselines fail CI on a green tree if not regenerated.** `knip-check.js` fails on an unbanked shrink. → `knip:baseline` after the C8a deletions, `baseline:update` at the end, both committed. `baseline:update` is never run against an empty `packages/*/dist`.
- **Playwright cannot verify any of this in-PR.** No `pull_request` trigger, staging plus encrypted secrets required. C8d touches reports, whose flows the suite does cover. → The exit criterion is discharged by naming the covering specs in the PR description; no run is attempted.
- **Deleting `file-utils.spec.ts` and `moment.spec.ts` removes real assertions.** Both are characterization tests whose only subjects are deleted in the same commit; leaving them would not compile. → Noted in the PR description as intentional coverage removal, not a regression. No test in this change goes red first: every test change is a deletion of a test for deleted code, and the surviving suites are regression guards, so **there is no red step to cite** — the change is stated as characterization-only under `.buildwright/framework/tdd-evidence.md`.

## Migration Plan

No data migration and no user-facing behaviour change is intended. Every deletion is of a symbol, file or dependency with zero call sites, and every prop removal is of a prop no consumer passes.

Two removals are visible only to future authors: `@deriv/components` no longer exports `AutoSizer` (import `react-virtualized`'s directly, as `data-list.tsx` and `data-table.tsx` already do) and `@deriv/utils` no longer exports `toMoment` (import it from `@deriv/shared`, as every current consumer already does). Both are recorded in the affected READMEs.

Rollback is a plain revert — each phase is a self-contained commit with the tree green, and the two baseline files revert with it. The PR targets `akmal/issue-1272-shared-sweep`; GitHub retargets it to `master` when #1272 merges. `master` is neither rebased onto nor merged in.

## Open Questions

None. Every ambiguity encountered during planning was resolved and recorded — see `tasks.md` — and the four deferrals are filed under `docs/spec-to-pr/deferrals/`.
