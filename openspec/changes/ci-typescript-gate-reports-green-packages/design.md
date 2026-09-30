## Context

Measured at HEAD `c23f863ca2` with `npx tsc -p packages/<pkg>/tsconfig.json --noEmit`:

| package      | exit | errors today | gated today                                 | errors after the tsconfig fixes |
| ------------ | ---- | ------------ | ------------------------------------------- | ------------------------------- |
| `api`        | 0    | 0            | yes, via the no-op step                     | 0                               |
| `utils`      | 0    | 0            | yes, via the no-op step                     | 0                               |
| `stores`     | 2    | 16           | yes, via the no-op step — **failing**       | 1                               |
| `trader`     | 0    | 0            | via `ForkTsCheckerWebpackPlugin` (blocking) | 0                               |
| `shared`     | 2    | 1612         | no                                          | 5                               |
| `reports`    | 2    | 289          | no                                          | 5                               |
| `components` | 2    | 1            | no                                          | 14                              |
| `core`       | 2    | 236          | no                                          | ~16, blocked — see Non-Goals    |

Three separate failure modes stack up:

1. **The bare `wait`.** `bash -eo pipefail -c 'false & true & wait; echo $?'` prints `0`; `wait` with no arguments discards every child's status. This is the default GitHub Actions shell, so neither `set -e` nor `pipefail` rescues it. The same pattern is in `Run linting`.
2. **`typeRoots` pointing nowhere.** `packages/shared` sets `"typeRoots": ["node_modules/@types"]` with `baseUrl: "./"`, resolving to `packages/shared/node_modules/@types`, which does not exist — so `@types/jest`, `@types/node` and the rest are dropped and the project reports 902 `TS2304` + 668 `TS2582`. `packages/components` sets `["./types", "@types"]`; `./types` does not exist, and `@types` resolves to `packages/components/@types/`, whose `react-div-100vh/` subdirectory has no entry point, producing `TS2688`.
3. **A config diagnostic suppresses semantic checking.** Verified directly: running `components` with a valid type root _and_ the broken one present still reports exactly one error (`TS2688`); with only the valid root, 14 spec errors appear. So `components` is not "one error from clean" — it is unchecked.

The residue after fixing the configs is 25 errors, listed exhaustively in `tasks.md`.

## Goals / Non-Goals

**Goals:**

- A `Check TypeScript` step that fails when any gated package fails, and names every failing package.
- A gated set covering 7 of the 8 packages, at zero errors, with no baseline allowlist.
- A `Run linting` step that fails when either parallel command fails.
- The gate runnable locally as `npm run test:typescript`, from the same package list CI uses.
- Regression pins in `scripts/__tests__/` so neither defect can return unnoticed.

**Non-Goals:**

- **Gating `packages/core`.** Widening core's `paths` with the sibling alias roots takes it from 236 errors to 16, but the last one is structural: `packages/trader/src/Types` and `packages/reports/src/Types` are entirely different modules that both claim the bare `Types` alias, and TypeScript resolves a `paths` candidate list by first _existing_ file, not by which exports the importer wants. Whichever ordering is chosen, the other package's imports break — and each alias fixed pulls more of that package's graph into core's program, cascading further. Resolving it means renaming one package's `Types` alias across its tsconfig, webpack config, jest `moduleNameMapper` and 14 (reports) or 42 (trader) import sites. Out of scope; deferred.
- Fixing core's own genuine errors (`login-button.tsx:34` `TS2339`, three store specs). They belong with the follow-up that gates core, so the fix and the gate that holds it land together.
- Adding `test:typescript` to the root `npm test`. CI runs it as its own step; `npm test` stays stylelint + ESLint + Jest as documented.
- Changing how `knip:check` / `baseline:check` work. This gate asserts zero rather than diffing a committed baseline, so it shares no machinery with them.

## Decisions

**A Node script, not inline shell.** `scripts/typecheck.js` follows the existing `scripts/knip-check.js` / `scripts/baseline-check.js` pattern: repo-root CJS, `module.exports` for unit testing, `process.exit(main())` under `require.main === module`. It buys three things the shell cannot: the gated package list exists once instead of one YAML line per package; the aggregation logic is unit-testable under `scripts/__tests__/` (already run in CI by `npm run test:scripts`), which is where the proof-of-red for the `wait` defect lives; and `npm run test:typescript` reproduces CI locally. _Alternative considered:_ per-PID `wait "$pid"` inline in the YAML — correct, but leaves the package list in YAML where nothing can assert on it and gives no local command.

**Inline shell for the lint step.** `Run linting` runs two fixed npm scripts, so it gets the per-PID pattern directly in the YAML rather than a second runner. Generalising `typecheck.js` into a "run these commands in parallel" utility would be an abstraction with two callers and no third in sight.

**Run all seven projects concurrently.** Measured 11s wall from cold (no `.tsbuildinfo`) on 8 cores; the `validate` job has a 15-minute budget and an 8-core runner. No concurrency cap — adding one would be tuning for a runner shape this repo does not use.

**Remove `typeRoots` rather than repair it.** Five of the seven gated packages set no `typeRoots` and resolve ambient types by walking up to the repo root `node_modules/@types`. Repairing the two broken paths would keep two packages on a bespoke rule that breaks again the moment `baseUrl` moves; deleting the field puts all seven on one behaviour. _Alternative considered:_ the deferral record for `components` suggested `["./@types", "../../node_modules/@types"]` — that re-creates the `TS2688`, because `@types/` holds loose `.d.ts` files, not type packages. The `.d.ts` files are already listed explicitly in `include`, which is the mechanism that actually works.

**Promote jest-dom registration to `types/testing-library.d.ts`.** `packages/trader/index.d.ts` contains one line, `import '@testing-library/jest-dom';`, and is why `trader` is the only large package measuring clean. Moving it beside `types/deriv-com-translations.d.ts` and including it from all seven puts the matcher augmentation on one footing. It is a measured no-op where it was not needed: `api` and `utils` stay at 0 with it added. `packages/trader/index.d.ts` is deleted and its `include` entry replaced — nothing else references it (`packages/trader/package.json` declares no `types` field).

**Zero, not a baseline.** `knip:check` and `baseline:check` diff against a committed baseline because their findings are large and shrink deliberately. Here the post-config residue is 25 errors across four packages, so the gate asserts zero. A baseline file would preserve exactly the "reports green while something fails" property this change exists to remove.

**Fix the two live `reports` source errors properly.** `profit-table.tsx:211` and `composite-calendar-mobile.tsx:91` are on shipping surfaces. Annotate or narrow the type rather than silencing with `as` / `@ts-expect-error`, per `.buildwright/steering/philosophy.md`'s stance on escape hatches. Both have jest coverage in `packages/reports/src/**/__tests__/` to run alongside the edit.

## Risks / Trade-offs

- **[Turning the gate on makes CI red for anyone rebasing onto this change mid-flight]** → The change lands the gate and the 25 fixes together, so the merge result is green; nothing is staged behind a flag.
- **[`scripts/__tests__/safety-net-wiring.spec.js` pins the exact string `npx tsc --project packages/api/tsconfig.json -noEmit`]** → That assertion is updated in the same commit to pin `npm run test:typescript` instead; leaving it would make CSN-008 fail on a correct workflow.
- **[Deleting `typeRoots` from `components` exposes 14 previously-suppressed spec errors]** → All 14 are enumerated in `tasks.md` with file and line; they are prop-type mismatches in specs, not behaviour changes.
- **[`packages/core` stays ungated, so its 236 errors keep accumulating]** → Unchanged from today, and the follow-up is recorded with the specific blocker (the `Types` alias collision) so it can be picked up without re-deriving the analysis.
- **[Seven concurrent `tsc` processes on a smaller runner could contend for memory]** → The `validate` job pins `runner_8cores_derivatives_trader`; the measured cold run is 11s at 571% CPU.

## Open Questions

Both are answered in `tasks.md` under `## Open Questions`, with the recommended option already applied throughout this design: `core` is out of scope, and test files are in scope with no baseline file.
