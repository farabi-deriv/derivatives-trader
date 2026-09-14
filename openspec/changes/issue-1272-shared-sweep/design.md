## Context

See `proposal.md` — Why. Everything below was re-measured against HEAD `aa81abf71c` (2026-09-03); where the issue body and the measurement disagree, the measurement wins.

Three properties of this repository shape the whole approach:

1. **There is no working type gate in CI.** `.github/workflows/test.yml:48-54` backgrounds four `tsc` runs behind a bare `wait`, so the step always exits 0; one target (`packages/api-v2`) no longer exists, and `shared`/`core`/`trader`/`reports` are not targeted at all. Webpack uses `babel-loader`, Jest uses `babel-jest` — both strip types without checking.
2. **`packages/shared/src/index.ts` is 34 lines, ~30 of them `export *` wildcards.** This makes symbol-level deletions barrel-free, but it also means `import/named` cannot fire through it, there is no `strictExportPresence`, and the 62 `.js`/`.jsx` consumers are excluded from `tsconfig.json`. A deleted export reaches them as `undefined` at runtime with zero static warning.
3. **Two committed baselines block CI in both directions.** `scripts/knip-check.js` fails on an _unbanked shrink_ — deleting a file already listed in `knip-baseline.json` fails the build until the baseline is regenerated. `scripts/baseline-check.js` fails on any alias-usage count movement.

Measured corrections to the issue body, in full:

| Issue body claim                                           | Measured at HEAD                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| C7a paths `object/clone.js`, `analytics/analytics.ts`, …   | all need the `utils/` segment except `src/loaders/`; **717 LOC**, not ~760                                                |
| "16 dead card-label keys"                                  | **12** (6 names × 2 maps)                                                                                                 |
| "C7c ~200 LOC"                                             | **~400 LOC** once specs, Devtools, Endpoint and SCSS are counted                                                          |
| "frees `mobx-persist-store` and `mobx`"                    | **only `mobx-persist-store`** — `mobx` is a peer dep of `mobx-react-lite@3.4.3`                                           |
| "13 dead `initPreBuildDVRs` entries" (Part 1)              | **correct**: 16 entries, 3 live (`req`/`number`/`barrier`) → 13 dead. The Part-2 correction to "14 of 17" is itself wrong |
| "12 of 16 `TFormErrorMessagesTypes` keys"                  | **12 of 15** `Record` keys (+5 untouched function properties)                                                             |
| "37 `tradeTypeIcons` keys"                                 | **38**, all kept                                                                                                          |
| "dead SCSS mixins/vars"                                    | **zero dead mixins**; exactly **3** dead variables in `styles/constants/layout.scss`                                      |
| `packages/reports/src/Stores/{profit,statement}-store.js`  | actually `Stores/Modules/Profit/profit-store.js` and `Stores/Modules/Statement/statement-store.js`                        |
| `packages/core/src/Utils/Constants/form-error-messages.js` | actually `packages/core/src/Constants/form-error-messages.js`                                                             |
| `Devtools.tsx:69-91`                                       | actually **`Devtools.tsx:72-96`**, plus its render site at 108-111                                                        |
| C7c scope list                                             | also needs `packages/api/README.md` (documents `useFeatureFlags` in two places)                                           |
| Total ~1,250 LOC                                           | **~1,700 LOC**                                                                                                            |

## Goals / Non-Goals

**Goals:**

- Delete only what is provably unreferenced, proven per symbol rather than by a tool's exit code.
- Land in phases that each build, test and lint green on their own, so a bisect lands on a coherent tree.
- Leave the two committed baselines regenerated and consistent, so the next change inherits an accurate gate.

**Non-Goals:**

- Restructuring `packages/shared/src/index.ts` away from wildcard barrels. That would let far more symbols be de-exported, but it is a separate, larger change.
- Unifying the three competing breakpoint definitions (deferred to post-M1 by the issue).
- Relocating the `mockContractInfo` fixture out of production source — deferred, see `docs/spec-to-pr/deferrals/mock-contract-info-fixture-relocation.md`.
- Deleting `playwright/e2e-tests-core/utils/featureFlags.ts` — deferred, see `docs/spec-to-pr/deferrals/playwright-feature-flags-util.md`.
- Widening the C7e cut beyond the approved `getContractTypesConfig` entries.

## Decisions

### D1 — Prove deadness per symbol; treat `knip:check` as a formality

With `includeEntryExports` unset and a pure wildcard barrel, knip reports **zero** unused exports for `packages/shared` — before and after this change. The exit criterion "knip clean on shared" is therefore satisfied vacuously and proves nothing about any individual symbol.

The standard used instead, for each symbol: grep the name word-bounded across the entire repository excluding `node_modules`, `.git` and `dist` (so `__mocks__/`, `scripts/`, `playwright/` and every `.js`/`.jsx` file are included), then _read_ every hit. A hit inside `@deriv/shared` makes the symbol internal-chain-live: keep the function, de-export it. A hit in a JSX comment (`TranslationFlag`) or in an independently-defined same-named symbol (`isSafari` vs `isSafariBrowser`; `isRouteVisible`, `normalizePath`, `isEuCountry` vs their private core/reports copies) is not a consumer.

_Alternative rejected:_ trusting `knip:check` plus the CI type step. Both are structurally blind here.

### D2 — The local `tsc` oracle, with a known-shrinking baseline

`npx tsc -p packages/shared/tsconfig.json --noEmit`, filtered to non-test `packages/shared/src/` lines, is 4 errors at HEAD:

```
utils/analytics/analytics-utils.ts(7,21)  TS2580 process
utils/analytics/analytics.ts(31,23)       TS2503 NodeJS
utils/analytics/analytics.ts(107,31)      TS2503 NodeJS
utils/object/object.ts(2,16)              TS2580 require
```

C7a deletes `analytics.ts`, so the expected post-change figure is exactly **2**. Stating the target as a shrinking number rather than "no new errors" makes the check unambiguous: anything other than those two lines is this change's fault.

_Alternative rejected:_ fixing the CI type step in this PR. It is a real defect but a different change; widening here would couple a workflow fix to a 1,700-line deletion. Recorded as a deferral.

### D3 — Phase order, chosen so each phase is independently green

1. **C7a** (files) — no symbol edits elsewhere; regenerate `knip:baseline` here because the three `src/loaders/` files leave the baseline.
2. **C7b** (symbols + SCSS) — smallest blast radius after C7a; the SCSS work is validated by `build:all`, since sass-loader hard-fails on an undefined variable. That is the single strongest gate in the repo for this kind of edit.
3. **C7c** (FeatureFlags) — the widest phase; touches 5 packages plus the repo-root `__mocks__/`.
4. **C7d** (validation) — must be a single commit: the map entries, the validators, the type keys and core's `FORM_ERROR_MESSAGES` are compile-coupled and no intermediate state builds.
5. **C7e** (trade types) + **C7g** (signup param) — small, independent.
6. **C7f** (market-icons) — last, because it moves the alias-usage count; regenerate `baseline:update` here.

### D4 — De-export where the symbol is intra-shared-live

Nine symbols have zero external references but at least one caller inside `@deriv/shared`. Deleting them would break shared; leaving them exported keeps a dead public surface. They become module-private (or lose their barrel line):

| Symbol                                     | Internal caller                                         |
| ------------------------------------------ | ------------------------------------------------------- |
| `object.ts` `isEqualArray`                 | `isDeepEqual` in the same file                          |
| `url.ts` `normalizePath`                   | `getStaticUrl` in the same file (already `@deprecated`) |
| `brand.ts` `getApiCoreUrl`                 | `getApiCoreBaseUrl` (live, 17 consumers)                |
| `brand.ts` `getDomainName`                 | `getBrandUrl`, `getRedirectHostname`, `getWhoAmIURL`    |
| `validator/index.ts` `Errors`, `template`  | `validator.ts`                                          |
| `url/index.ts` `export * from './helpers'` | `brand.ts` imports `appendLangParam` by direct path     |

Note the ceiling: because `src/index.ts` is `export *`, a symbol used across two files _inside_ shared (`deepFreeze`, used by `currency.ts`) cannot be de-exported without restructuring the barrel. Nine is the honest count, not the issue's "~20"; the rest need D-non-goal work.

### D5 — Keep `unsupported_contract_types_list` and the 38 icons; delete the two empty categories

Removing the 10 `getContractTypesConfig` entries makes the `unsupported_contract_types_list` filters match nothing. Deleting the list would touch three trader consumers and remove the guard that keeps a re-enabled API type from surfacing before its config returns — the same "cheap insurance" rationale that settled the `tradeTypeIcons` KEEP on 26 Aug 2026. It stays.

`getContractCategoriesConfig` is different: after the cut, `'Ins & Outs'` and `'Look Backs'` contain **zero** members, and `'Ups & Downs'`/`'Touch & No Touch'` would reference keys that no longer exist. That is not insurance, it is a dangling reference, so the cascade is followed: trim the two partial categories, delete the two empty ones, and update the exact-shape assertion in `packages/shared/src/utils/constants/__tests__/contract.spec.ts:246-282`. This stays inside the approved ~60 LOC.

_Alternative rejected:_ leaving `categories: []` in place. `getAvailableCategories` in `contracts-for-utils.ts` returns the config verbatim without a delete-empty step, so an empty category would leak into the trade-type list shape.

### D6 — `TStores` survives as an alias

`TStores = TCoreStores & { feature_flags: FeatureFlagsStore }` becomes `TStores = TCoreStores`. Keeping the alias rather than replacing every `TStores` reference with `TCoreStores` keeps the diff to two lines in `packages/stores/types.ts` and leaves every consumer compiling unchanged.

### D7 — `mobx` stays even though nothing imports it

`packages/stores/src/stores/BaseStore.ts` is the package's only direct `mobx` importer and is deleted. But `src/index.ts:1` re-exports `observer` from `mobx-react-lite@3.4.3`, whose `peerDependencies` are `{ mobx: "^6.1.0", react: "..." }` (verified in `node_modules/mobx-react-lite/package.json`). Removing the entry breaks `--strict-peer-deps`. Only `mobx-persist-store` — declared by `packages/stores` alone, imported by `BaseStore.ts` alone — goes.

### D8 — Defer the `mockContractInfo` relocation and the Playwright util

`mockContractInfo` lives in production source (`utils/contract/contract-info.ts`) and is imported from `@deriv/shared` by 27 spec files across three packages (34 files mention the name; two define their own local shadow). Relocating it needs a destination decision plus per-package `jest.moduleNameMapper` / tsconfig `paths` work, and rewrites 27 imports — a merge-conflict magnet with zero dead-code value, since the fixture is not dead, only misplaced. The issue pre-authorises deferring it. Filed as a deferral.

`playwright/e2e-tests-core/utils/featureFlags.ts` (253 LOC) becomes inert once DCR-013 lands, and has zero consumers in the e2e suite. But it is documented in five places across `playwright/flows/`, `playwright/e2e-tests-core/skills/` and `playwright/CLAUDE.md` — a subtree with its own conventions that this change does not otherwise enter. The issue's own framing files it under "leftover to REPORT, not delete". Filed as a deferral and named in the PR description.

## Risks / Trade-offs

- **A missed edit in one of the four excluded `.js` consumers ships as a runtime `TypeError`.** `packages/core/src/Stores/portfolio-store.js:10,154`, `packages/reports/src/Stores/Modules/Profit/profit-store.js:4,101`, `packages/reports/src/Stores/Modules/Statement/statement-store.js:4,122` and `packages/core/src/Constants/form-error-messages.js:2` are outside `tsconfig.json`, and `.filter(undefined)` throws in the live positions path. → Each of the four is opened and hand-verified, and the Jest suites covering positions, profit and statement stores are run before the phase is committed.
- **A card-label key deleted on a naive grep breaks a card at runtime.** Destructuring and computed access defeat `labels.KEY` greps. → Only the 6 names with zero hits under _all three_ patterns are removed, and `lookbacks-card-body.tsx` / `toggle-card-dialog.tsx` are read directly.
- **Removing 10 `getContractTypesConfig` entries could blank a title for a historical contract of a removed type.** All five lookup sites use `?.`, so nothing throws, and `getUnsupportedContracts()` — kept — still supplies the display name. → Accepted; the types are already unbuyable via `unsupported_contract_types_list`.
- **Deleting `declarative-validation-rules.spec.js` removes real assertions.** It is a characterization test whose only subject, `validAddress`, is deleted in the same commit; leaving it would not compile. → Noted in the PR description as intentional coverage removal, not a regression.
- **Baseline drift blocks CI on a green tree.** Both `knip:check` and `baseline:check` fail on shrinkage. → `knip:baseline` after C7a and `baseline:update` after C7f, both committed. `baseline:update` is never run against an empty `packages/*/dist`; the chunk assertion auto-skips without `dist/` and the route-map/alias snapshots regenerate fine.
- **The two `FeatureFlagsSection` components share a name.** A partial deletion is easy to miss and leaves a broken `useStore()` call. → The phase closes with `grep -rn "FeatureFlagsSection" packages` returning zero.
- **Playwright cannot verify any of this.** No `pull_request` trigger, staging + encrypted secrets required, and the suite imports nothing from `packages/`. → The exit criterion is discharged by stating this in the PR description; no run is attempted.

## Migration Plan

No data migration and no user-facing behaviour change is intended. The one observable-surface change — positions, profit and statement lists no longer running `filterDisabledPositions` — is a no-op because the predicate returned `true` for every row (`FLAGS` and `TRADE_FEATURE_FLAGS` are both empty, so `Object.entries(...).every(...)` over an empty object is vacuously true).

`FeatureFlagsStore` persisted to `localStorage` under the key `FeatureFlagsStore` via `mobx-persist-store`. After removal the key is simply never read or written again; existing values are inert and no cleanup is required.

Rollback is a plain revert — each phase is a self-contained commit with the tree green, and the two baseline files revert with it.
