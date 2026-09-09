# The CI "Check TypeScript" step never fails

**What was deferred:** Fixing the `Check TypeScript` step in `.github/workflows/test.yml:48-54`. As written it is a no-op gate:

```yaml
- name: Check TypeScript
  run: |
      npx tsc --project packages/api/tsconfig.json -noEmit &
      npx tsc --project packages/api-v2/tsconfig.json -noEmit &
      npx tsc --project packages/utils/tsconfig.json -noEmit &
      npx tsc --project packages/stores/tsconfig.json -noEmit &
      wait
```

Three defects: (1) a bare `wait` discards every child's exit status, so the step always exits 0 no matter how many type errors any run reports; (2) `packages/api-v2` was deleted in the C1 sweep, so that run fails to start and nobody notices; (3) `shared`, `core`, `trader` and `reports` — the four largest packages, and every package this change touched — are not targeted at all. Webpack uses `babel-loader` and Jest uses `babel-jest`, so neither catches type errors either: the repository has no type gate.

Change `issue-1272-shared-sweep` worked around this with a documented local oracle (DCR-019) rather than fixing the workflow.

**Why:** Fixing a CI workflow is a different change with a different blast radius from a 1,700-line deletion sweep. Turning the gate on is very likely to surface pre-existing errors across `core`, `trader` and `reports` — the `shared` project alone reports 1,705 lines of `tsc` output at HEAD, ~1,540 of them from test files — and triaging those inside a deletion PR would have blocked the deletion indefinitely.

**Follow-up required:**

1. Measure the true baseline per package first: run `npx tsc -p packages/<pkg>/tsconfig.json --noEmit` for `shared`, `core`, `trader`, `reports`, `api`, `utils` and `stores`, and record the counts. At HEAD the `shared` project reports **9** non-test errors across all packages it pulls in, of which **4** are in `packages/shared/src/` itself (two of those die with `utils/analytics/analytics.ts`, deleted by this change, leaving **2**).
2. Decide whether test files are in scope. Most of the noise is `Cannot find name 'jest'` / `Cannot find namespace 'NodeJS'` in `__tests__` and in `packages/stores/src/mockStore.ts`, which is fixable by adding `@types/jest` and `@types/node` to the relevant `tsconfig.json` `types` arrays rather than by editing sources.
3. Rewrite the step so failures propagate — either drop the backgrounding, or capture each PID and `wait "$pid"` individually, checking each status. Remove the `packages/api-v2` line. Add the packages that matter.
4. Land the gate behind a committed per-package error baseline (the same pattern `scripts/knip-check.js` and `scripts/baseline-check.js` already use) if a clean zero is not reachable in one step.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1364
