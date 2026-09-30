## Open Questions

### Should `packages/core` be added to the TypeScript gate in this change?

- [recommended] No — gate the other seven now and file core as a follow-up (core's 236 errors drop to 16 once its `paths` are widened, but `trader` and `reports` both claim the bare `Types` alias for different modules, so core's project cannot resolve both without renaming one across ~56 import sites plus its webpack and jest configs)
- Yes — rename `packages/reports`' `Types` alias (14 import sites, `tsconfig.json`, `build/webpack.config.js`, `jest.config.js`) in this change so core can be gated too
- Yes — gate core with `continue-on-error` until the alias work lands (rejected on sight: the repo already asserts no workflow step is advisory, in `safety-net-wiring.spec.js`)

### Are test files in scope, or should the gate exclude them?

- [recommended] In scope, at zero — with the tsconfig defects fixed the whole residue is 25 errors (23 of them in specs), small enough to clear outright, and no baseline file is needed
- Exclude `__tests__/`, `*.spec.*` and `*.test.*` from the gated projects, so only `src` is checked
- Land a committed per-package error baseline (the `scripts/knip-check.js` pattern) and shrink it later

Both are answered with the recommended option throughout the tasks below.

## 1. Pin the defect so it cannot return

- [x] 1.1 In `scripts/__tests__/safety-net-wiring.spec.js`, add a `describe('typescript gate (TSG-001)')` block that reuses the file's existing `parseWorkflowSteps` helper and asserts no `run:` step in `.github/workflows/test.yml` contains a line matching `/^\s*wait\s*$/m` — a bare `wait` returns 0 regardless of its children.
      `Red: safety-net-wiring.spec.js › [TSG-001] no CI step ends on a bare wait — expected [], got ['Check TypeScript', 'Run linting'] (test.yml:53 and test.yml:82).`
- [x] 1.2 In the same block, assert the `Check TypeScript` step's body matches `/^\s*run:\s*npm run test:typescript\s*$/m`, with no `|| true`, no trailing `&` and no `continue-on-error` — mirroring the existing per-gate assertions for `knip:check` and `baseline:check`.
      `Red: safety-net-wiring.spec.js › [TSG-001] Check TypeScript invokes the aggregating runner — expected a "npm run test:typescript" run line, got the three backgrounded "npx tsc --project …" lines.`
- [x] 1.3 Update the CSN-008 assertion at `scripts/__tests__/safety-net-wiring.spec.js` that pins the literal `'npx tsc --project packages/api/tsconfig.json -noEmit'` — replace it with a pin on `npm run test:typescript`, keeping the adjacent test-matrix pin (`'packages/api packages/shared packages/stores packages/utils packages/components'`) untouched. Without this the correct workflow fails an existing test.
- [x] 1.4 Create `scripts/__tests__/typecheck.spec.js` asserting: (a) the aggregator returns a non-zero exit when any package result has a non-zero status, and zero only when all are zero — the exact property the bare `wait` lacked; (b) the summary names **every** failing package, not just the first; (c) `GATED_PACKAGES` equals the directories under `packages/` holding a `tsconfig.json`, minus `core`; (d) `package.json`'s `test:typescript` script is exactly `node scripts/typecheck.js`.
      `Red: typecheck.spec.js — expected scripts/typecheck.js to exist, got MODULE_NOT_FOUND.`

## 2. The aggregating runner

- [x] 2.1 Create `scripts/typecheck.js` following the `scripts/knip-check.js` conventions (repo-root CJS, `ROOT` via `path.resolve(__dirname, '..')`, `process.exit(main())` under `require.main === module`, named `module.exports`): spawn `tsc --noEmit -p packages/<pkg>/tsconfig.json` for each of `api`, `components`, `reports`, `shared`, `stores`, `trader`, `utils` concurrently, await all, print each failing package's captured output, and exit 1 if any exited non-zero. Export `GATED_PACKAGES` and the pure summarizer so 1.4 can test it without spawning `tsc`.
- [x] 2.2 In `scripts/typecheck.js`, record `packages/core`'s exclusion in a one-line comment stating the reason (core resolves `@deriv/trader` and `@deriv/reports` sources through `@deriv/*` without their alias roots, and both claim the `Types` alias).
- [x] 2.3 Add `"test:typescript": "node scripts/typecheck.js"` to the root `package.json` `scripts`, next to `knip:check` / `baseline:check`. Do not add it to the aggregate `test` script.
- [x] 2.4 Run `npm run test:scripts -- --testPathPattern=typecheck` and confirm the 1.4 assertions now pass.

## 3. Shared ambient declarations

- [x] 3.1 Create `types/testing-library.d.ts` containing `import '@testing-library/jest-dom';` with a one-line comment stating it registers the matcher augmentation for every package's type check (mirrors `types/deriv-com-translations.d.ts`).
- [x] 3.2 Delete `packages/trader/index.d.ts` (its only content is that import) and in `packages/trader/tsconfig.json` replace the `"./index.d.ts"` include entry with `"../../types/testing-library.d.ts"`. Nothing else references the file — `packages/trader/package.json` declares no `types` field.
- [x] 3.3 While in `packages/trader/tsconfig.json`, drop the two `include` entries that match no file, `"../../globals.d.ts"` and `"../../utils.d.ts"`; `tsc` ignores a non-matching `include` silently, so they read as coverage that is not there.
- [x] 3.4 Add `"../../types/testing-library.d.ts"` to the `include` array of `packages/{api,components,reports,shared,stores,utils}/tsconfig.json`.
- [x] 3.5 Run `npx tsc -p packages/api/tsconfig.json --noEmit`, `npx tsc -p packages/utils/tsconfig.json --noEmit` and `npx tsc -p packages/trader/tsconfig.json --noEmit` — each must still report 0 errors (measured no-op at HEAD; these three need no further work).

## 4. `packages/stores` → 0

- [x] 4.1 Add `"../../types/deriv-com-translations.d.ts"` to `include` in `packages/stores/tsconfig.json`. This clears the 15 `TS7016` errors raised against `packages/{api,shared}` sources that `stores` pulls in through the `@deriv/*` alias.
- [x] 4.2 Fix `packages/stores/src/__tests__/useStore.spec.tsx:33` — `TS2353`: the `DeepPartial<TStores>` literal sets `client: { email: … }`, but the `client` member of `TStores` has no `email`. Give the mock a property the type actually carries (`packages/stores/types.ts` declares `email` on other members), or widen the mock's type at the seam; do not cast the whole literal to `any`. Re-run `npm run test:jest -- packages/stores/src/__tests__/useStore.spec.tsx` to confirm `[DCR-013]` still passes.
      `Red: npx tsc -p packages/stores/tsconfig.json --noEmit — expected 0 errors, got 16 (15× TS7016 '@deriv-com/translations', 1× TS2353 useStore.spec.tsx:33).`
- [x] 4.3 Run `npx tsc -p packages/stores/tsconfig.json --noEmit` and confirm 0 errors.

## 5. `packages/shared` → 0

- [x] 5.1 Delete the `typeRoots` compiler option from `packages/shared/tsconfig.json`. With `baseUrl: "./"` it resolves to `packages/shared/node_modules/@types`, which does not exist, so the project loads no ambient `@types` at all. Removing it restores the default root walk-up and takes the project from 1612 errors to 9 — including all six non-test errors (`TS2580 process` / `require`, `TS2503 NodeJS`), which were `@types/node` artifacts, not broken code.
      `Red: npx tsc -p packages/shared/tsconfig.json --noEmit — expected 0 errors, got 1612 (902× TS2304, 668× TS2582 — jest/node globals unresolvable).`
- [x] 5.2 Fix `packages/shared/src/utils/brand/__tests__/brand.spec.ts:8` and `:54`, and `packages/shared/src/utils/config/__tests__/config.spec.ts:57` — `TS2322`: the `mockLocation` helpers assign an object cast `as Location` to `window.location`, whose lib type is `string & Location`. Assign via `Object.defineProperty(window, 'location', { value: …, writable: true })`, matching the `afterEach` in `brand.spec.ts` that already restores it that way.
- [x] 5.3 Fix `packages/shared/src/utils/helpers/__tests__/limit-orders.spec.ts:111` — `TS2322`: the barrier literal is missing `updateColor`, required by `ChartBarrierStore` via `TBarrier`. Add the missing member to the fixture.
- [x] 5.4 Fix `packages/shared/src/utils/validator/__tests__/validator.spec.ts:123` — `TS2345`: `{ barrier_1 }` is passed where a full `Pick<…>` of 16 properties is expected. Type the argument as a partial at the call site or complete the fixture.
- [x] 5.5 Run `npm run test:jest -- packages/shared/src/utils/brand packages/shared/src/utils/config packages/shared/src/utils/helpers/__tests__/limit-orders.spec.ts packages/shared/src/utils/validator` then `npx tsc -p packages/shared/tsconfig.json --noEmit` — 0 errors.

## 6. `packages/reports` → 0

- [x] 6.1 Add `"../../types/testing-library.d.ts"` to `packages/reports/tsconfig.json` `include` (covered by 3.4) and confirm it drops the project from 289 errors to 5 — 284 of them were `TS2339` on `toBeInTheDocument` / `toHaveClass`, i.e. the missing jest-dom matcher augmentation.
      `Red: npx tsc -p packages/reports/tsconfig.json --noEmit — expected 0 errors, got 289 (284× TS2339 on jest-dom matchers, plus the 5 below).`
- [x] 6.2 Fix `packages/reports/src/Containers/profit-table.tsx:211` — `TS2345`: `withRouter(ProfitTable)` is rejected because the observer-wrapped component carries an added `displayName` that widens it off `ComponentType<RouteComponentProps>`. Annotate the wrapped component as `React.ComponentType<RouteComponentProps>` rather than casting.
      Implemented as `type TProfitTable = RouteComponentProps & { component_icon }`, matching the two siblings that already compile (`statement.tsx`, `archived-statement.tsx`). `withRouter` then infers `P` correctly and the export requires `component_icon` again — so `__tests__/profit-table.spec.tsx` passes it, the same one-line fix as 6.5.
- [x] 6.3 Fix `packages/reports/src/Components/Form/CompositeCalendar/composite-calendar-mobile.tsx:91` — `TS2769`: `toMoment().startOf('day').subtract(new_from, 'day')` where `new_from` is `TInputDateRange['duration']` (`number | undefined`) matches no `subtract` overload. Narrow `new_from` before the call; the surrounding ternary already establishes it is set on that branch.
- [x] 6.4 Fix `packages/reports/src/Components/Routes/__tests__/binary-routes.spec.tsx:29` — `TS2769`: the `<BinaryRoutes is_logged_in is_logging_in />` props do not match `TBinaryRoutes`. Align the props with the component's type.
- [x] 6.5 Fix `packages/reports/src/Containers/__tests__/archived-statement.spec.tsx:87` — `TS2741`: `<ArchivedStatement />` is rendered without the required `component_icon`. Pass it.
- [x] 6.6 Fix `packages/reports/src/Stores/Modules/Profit/Helpers/__tests__/format-request.spec.ts:17` — `TS2345`: `jest.useFakeTimers('modern')` — the string argument was removed in Jest 27+ ('modern' is the default). Drop the argument.
- [x] 6.7 Run `npm run test:jest -- packages/reports` then `npx tsc -p packages/reports/tsconfig.json --noEmit` — 0 errors.

## 7. `packages/components` → 0

- [x] 7.1 Delete the `typeRoots` compiler option from `packages/components/tsconfig.json`. `./types` does not exist and `@types` resolves to `packages/components/@types/`, a directory of loose `.d.ts` files with no entry point, which raises `TS2688` — and a config-level diagnostic makes `tsc` skip semantic checking for the whole project. The `.d.ts` files are already listed by path in `include`, which is the mechanism that works.
      `Red: npx tsc -p packages/components/tsconfig.json --noEmit — expected 0 errors, got 1 (TS2688 'react-div-100vh'), which is masking 14 semantic errors: with a valid type root added alongside the broken one the run still reports only the TS2688, and with the broken one removed the 14 below appear.`
- [x] 7.2 Remove the dangling `"./@types/@enykeev/react-virtualized/dist/es/AutoSizer.d.ts"` entry from `packages/components/tsconfig.json` `include` — `packages/components/@types/` contains only `react-div-100vh/`. Confirm `data-list.tsx` and `data-table.tsx` still type-check (they cast `AutoSizer` via `as unknown as React.FC<AutoSizerProps>` and the declared `@types/react-virtualized` dependency covers them).
- [x] 7.3 Fix the `mockContractInfo` fixture arguments typed `number` where the field is `string` — `TS2322` at `contract-card/contract-card-items/__tests__/accumulator-card-body.spec.tsx:18,19,20`, `contract-update-form.spec.tsx:17`, `lookbacks-card-body.spec.tsx:11,13,14`, and `multiplier-card-body.spec.tsx:17,18,30,32`. Pass the values in the type the fixture declares rather than loosening the fixture.
      Clearing `multiplier-card-body.spec.tsx:32` unmasked a 15th error on the next line: excess-property `underlying`, which this repo's API types renamed to `underlying_symbol` (`packages/api/types.ts` omits `underlying` from `proposal_open_contract`). Renamed at both fixture sites; the component reads neither.
- [x] 7.4 Fix `packages/components/src/components/contract-card/result-overlay/__tests__/result-overlay.spec.tsx:28` and `:35` — `TS2322`: the mock `getCardLabels()` returns `{ CLOSED }` only, against a 40-key return type. Return the real labels helper's output, or type the mock so the partial is legal.
- [x] 7.5 Fix `packages/components/src/components/page-error/__tests__/page-error.spec.tsx:113` — `TS2554`: `expect(page_error).not.toHaveTextContent()` takes 1-2 arguments. Assert the intended text, or use the matcher that expresses "no text content".
- [x] 7.6 Run `npm run test:jest -- packages/components/src/components/contract-card packages/components/src/components/page-error` then `npx tsc -p packages/components/tsconfig.json --noEmit` — 0 errors.

## 8. Wire the workflow

- [x] 8.1 In `.github/workflows/test.yml`, replace the `Check TypeScript` step's three backgrounded `npx tsc … &` lines and the bare `wait` with the single command `npm run test:typescript`.
- [x] 8.2 In `.github/workflows/test.yml`'s `Run linting` step, capture each backgrounded command's PID and `wait "$pid"` individually, aggregating both statuses into the step's exit code so a stylelint failure and an ESLint failure each fail the job.
- [x] 8.3 Run `npm run test:scripts` and confirm the 1.1-1.3 workflow assertions pass against the edited YAML.
- [x] 8.4 Run `npm run test:typescript` locally and confirm it exits 0 across all seven gated packages.

## 9. Documentation and discharged records

- [x] 9.1 Add `npm run test:typescript` to the Testing block of `CLAUDE.md`'s Commands section, described as the blocking per-package type gate (seven packages, `core` excluded).
- [x] 9.2 Delete `docs/spec-to-pr/deferrals/ci-typescript-gate-is-a-no-op.md`, `docs/spec-to-pr/deferrals/components-tsconfig-typeroots-typo.md` and `docs/spec-to-pr/deferrals/reports-pre-existing-type-errors.md` — this change discharges all three (issues #1364, #1374, #1375), matching the hygiene in `c23f863ca2`.

## Closing gates

Not tasks — the automated verify stage runs these; they are listed so the reader knows what holds this change:

- `npm run test:typescript` — the new gate, expected 0 across the seven packages.
- `npm run test:scripts` — the workflow and runner regression pins in `scripts/__tests__/`.
- `npm run test:jest`, `npm run test:eslint-all`, `npm run test:stylelint` — unchanged.
- `npm run knip:check` — `scripts/typecheck.js` is covered by the root workspace's `scripts/*.js` entry glob and `types/*.d.ts` is outside its project globs, so no baseline regeneration is expected; if knip does report the new files, bank it with `npm run knip:baseline` in this PR rather than working around it.
  Banked: deleting `packages/trader/index.d.ts` moved its `@testing-library/jest-dom` import to the root `types/`, so knip now reports the devDependency as unused in `packages/trader` — the same accepted entry the baseline already carries for `components`, `core` and `shared`. One line added to `docs/baselines/knip-baseline.json`; the package still needs it, via root `setupTests.js`.
- `openspec validate ci-typescript-gate-reports-green-packages`.
