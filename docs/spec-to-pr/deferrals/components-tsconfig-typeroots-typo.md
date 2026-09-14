# `packages/components/tsconfig.json` `typeRoots` typo leaves two permanent TS2688 errors

## What was deferred

Fixing the `typeRoots` entry in `packages/components/tsconfig.json`:

```json
"typeRoots": ["./types", "@types"]
```

`./types` does not exist — the package's ambient declarations live in `packages/components/@types/`. Because the first root cannot be resolved, `tsc` emits two errors on every run of the package's type check:

```
error TS2688: Cannot find type definition file for 'react-div-100vh'.
error TS2688: Cannot find type definition file for 'react-drag-drawer'.
```

These are the entire non-test baseline for `packages/components` (measured at HEAD `8038e85f3f`). Issue #1273's C8-small sweep deletes `packages/components/@types/react-drag-drawer/` (an orphaned shim for a module that is neither imported nor declared as a dependency), which should take the count from 2 to 1, but it does **not** correct the `typeRoots` path.

## Why

The sweep is a ~1,900-line deletion across five packages, gated by a local `tsc` oracle stated as "at or below the recorded baseline". Changing the tsconfig that defines that baseline mid-sweep would make every per-phase comparison ambiguous — a regression introduced by a deletion and an error cleared by the tsconfig fix would cancel out and hide each other. The fix also belongs with the broader CI type-gate work already filed at `ci-typescript-gate-is-a-no-op.md`, not with a dead-code change.

## Follow-up required

In a separate change:

1. Correct `packages/components/tsconfig.json`'s `typeRoots` to `["./@types", "../../node_modules/@types"]` (or drop the field and rely on the explicit `include` entries, which already list the two `.d.ts` files by path).
2. Verify `npx tsc -p packages/components/tsconfig.json --noEmit 2>&1 | grep 'error TS' | grep -v '__tests__' | grep -v '\.spec\.'` returns **zero** lines.
3. Confirm `packages/components/src/components/div100vh-container/div100vh-container.tsx:2`'s `/// <reference path="../../../@types/react-div-100vh/react-div-100vh-config.d.ts" />` still resolves, and consider removing the triple-slash directive if the corrected `typeRoots` makes it redundant.
4. Note that if the C8-small sweep landed first, `@types/react-drag-drawer/` is already gone and only the `react-div-100vh` error remains to clear.

## Also found while implementing issue #1273

`packages/components/tsconfig.json`'s `include` array carries a second dangling entry:

```json
"./@types/@enykeev/react-virtualized/dist/es/AutoSizer.d.ts"
```

No such path exists — `packages/components/@types/` contains only `react-div-100vh/` once the `react-drag-drawer/` shim is deleted. An `include` pattern that matches no file is silently ignored by `tsc`, so this produces no error and was left in place. Remove it together with the `typeRoots` fix, and confirm `react-virtualized`'s own types (via the declared `@types/react-virtualized` dependency) still cover `data-list.tsx` and `data-table.tsx`, which cast `AutoSizer` through `as unknown as React.FC<AutoSizerProps>`.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1374
