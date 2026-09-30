## Why

`.github/workflows/test.yml`'s `Check TypeScript` step backgrounds three `tsc` runs and ends with a bare `wait`, which always returns 0 — so the step reports green no matter how many type errors the runs report. It is not hypothetical: `packages/stores` is one of the three packages the step already runs and it exits 2 with 16 errors at HEAD, and CI has never failed on it. The `Run linting` step (`test.yml:78-82`) has the same bare-`wait` defect, so stylelint and ESLint failures are swallowed the same way.

A second, independent blindness compounds it: a **config-level** `tsc` diagnostic suppresses all semantic checking for that project. `packages/components`' only reported error today is `TS2688` from a `typeRoots` entry pointing at a directory that does not exist — and it is hiding 14 real errors that reappear the moment the config error clears. Meanwhile four of the eight packages (`shared`, `core`, `reports`, `components`) were never targeted at all.

## What Changes

- **Make the gate fail.** Replace the backgrounded `tsc` lines with `npm run test:typescript`, backed by a new `scripts/typecheck.js` that runs every gated project in parallel, waits on each, and exits non-zero listing **every** failing package (not just the first). The package list lives in one place so CI and a local run gate the same set.
- **Make the lint step fail.** Capture each background PID in `Run linting` and `wait "$pid"` per child, aggregating both statuses so neither stylelint nor ESLint can fail silently.
- **Widen the gated set** from 3 packages to 7: `api`, `components`, `reports`, `shared`, `stores`, `trader`, `utils`. `packages/core` is deliberately excluded — see Open Questions in `tasks.md` and the deferral below.
- **Fix the tsconfigs that were suppressing checks**, not the symptoms:
    - `packages/shared` and `packages/components` each narrow `typeRoots` to a path that does not exist, which silently drops every ambient `@types` package. Removing the field restores the default root walk-up that the other five packages already use.
    - `packages/stores` does not include the `@deriv-com/translations` shim, which is 15 of its 16 errors.
    - `packages/components`' `include` carries a dangling `./@types/@enykeev/react-virtualized/...` entry matching no file.
    - `@testing-library/jest-dom`'s matcher augmentation is currently registered by a one-line `packages/trader/index.d.ts` that only `trader` includes. Promote it to `types/testing-library.d.ts` next to the existing `types/deriv-com-translations.d.ts` and include it from every gated package.
- **Fix the 25 genuine errors** the corrected configs expose (1 in `stores`, 5 in `shared`, 5 in `reports`, 14 in `components`). Test files are in scope; the residue is small enough to land a clean zero, so **no committed per-package error baseline is introduced** — unlike `knip:check`/`baseline:check`, this gate asserts zero.
- **Pin the gate against regression** in `scripts/__tests__/` — no `run:` step in the workflow may end on a bare `wait`, and the gated package set must match the packages that have a `tsconfig.json`.
- Remove the three deferral records this change discharges (`ci-typescript-gate-is-a-no-op.md`, `components-tsconfig-typeroots-typo.md`, `reports-pre-existing-type-errors.md`) and document `npm run test:typescript` in `CLAUDE.md`.

### Corrections to the issue's follow-up list, from measurement

- **`packages/utils` needs no tsconfig change.** It reports 0 errors and imports `@deriv-com/translations` in 0 files; `stores` only failed because it pulls `shared`/`api` sources through the `@deriv/*` alias. Adding the shim to `utils` would be speculative. (It does receive the shared `types/testing-library.d.ts` include, for a uniform gate — measured no-op: `utils` stays at 0.)
- **`packages/shared` lands at 0 errors in `src`, not 2.** Both `TS2580` errors (`process`, `require`) are artifacts of the broken `typeRoots` dropping `@types/node`; they disappear with the config fix rather than needing source edits. `shared`'s residue is 5 errors, all in `__tests__`.
- **`packages/components` is worse than "1 error".** Its single `TS2688` is a config diagnostic that makes `tsc` skip semantic checking entirely — verified by re-running with both a valid and the broken type root present, where the 14 spec errors vanish behind the one config error. The package is effectively unchecked today.

## Capabilities

### New Capabilities

- `typescript-gate`: the repository's blocking TypeScript check — which packages it covers, that a failure in any of them fails CI, that the checked packages sit at zero errors with no baseline allowlist, and how the shared ambient declarations are wired so no package's project can silently lose its types.

### Modified Capabilities

None. `cleanup-safety-net` (CSN-00x) governs the `knip:check` / `baseline:check` gates and their committed baselines; this gate asserts zero rather than diffing a baseline, so it is a separate capability rather than a change to those requirements. The `scripts/__tests__/safety-net-wiring.spec.js` assertion that pins the literal `npx tsc --project packages/api/tsconfig.json -noEmit` string is updated as an implementation consequence, not a requirement change.

## Impact

- `.github/workflows/test.yml` — `Check TypeScript` and `Run linting` steps.
- `package.json` — new `test:typescript` script.
- `scripts/typecheck.js` (new), `scripts/__tests__/typecheck.spec.js` (new), `scripts/__tests__/safety-net-wiring.spec.js` (updated pin + new bare-`wait` assertion).
- `types/testing-library.d.ts` (new); `packages/trader/index.d.ts` (deleted).
- `packages/{api,components,reports,shared,stores,trader,utils}/tsconfig.json`.
- 25 error sites across `packages/{stores,shared,reports,components}` — 23 in test files, 2 in `packages/reports/src` (`composite-calendar-mobile.tsx`, `profit-table.tsx`).
- `CLAUDE.md` Commands section; `docs/spec-to-pr/deferrals/` (three resolved records removed).
- Not touched: `packages/core` — gating it needs cross-package alias unification and a rename to resolve the `Types` alias collision between `trader` and `reports`. Deferred.
