# Two pre-existing type errors in `packages/reports` are left in place

## What was deferred

Fixing the two non-test type errors that `packages/reports` carries at HEAD `8038e85f3f`:

```
packages/reports/src/Components/Form/CompositeCalendar/composite-calendar-mobile.tsx(91,66):
  error TS2769: No overload matches this call.

packages/reports/src/Containers/profit-table.tsx(214,27):
  error TS2345: Argument of type '(({ component_icon }: TProfitTable) => Element) & { displayName: string; }'
  is not assignable to parameter of type 'ComponentType<RouteComponentProps<...>>'.
```

Issue #1273's C8-small sweep records these as the `packages/reports` type-oracle baseline and gates on "at or below 2". It does not fix either one.

## Why

Neither error is dead code, and neither is caused or touched by the sweep. `profit-table.tsx:214` is a `withRouter` typing mismatch on a live container; `composite-calendar-mobile.tsx:91` is an overload mismatch inside the date-range picker. Fixing them means changing the runtime types of two live reports surfaces, which is a behaviour-adjacent change that does not belong in a deletion PR — and doing so mid-sweep would make the "at or below baseline" gate unreadable, since a regression and a fix would cancel out.

They are also invisible to CI: `.github/workflows/test.yml`'s "Check TypeScript" step backgrounds its `tsc` runs behind a bare `wait` and never targets `packages/reports`, so nothing has ever failed on them. See `ci-typescript-gate-is-a-no-op.md`.

## Follow-up required

In a separate change, after (or independently of) the CI type-gate fix:

1. Fix `packages/reports/src/Containers/profit-table.tsx:214` — the `withRouter(...)` call whose argument carries an added `displayName` property that widens it off `ComponentType<RouteComponentProps>`. Most likely a `React.ComponentType` annotation on the wrapped component, not a cast.
2. Fix `packages/reports/src/Components/Form/CompositeCalendar/composite-calendar-mobile.tsx:91` — the failing overload; identify which of the candidate signatures is intended and narrow the argument rather than silencing with `as`.
3. Verify `npx tsc -p packages/reports/tsconfig.json --noEmit 2>&1 | grep 'error TS' | grep -v '__tests__' | grep -v '\.spec\.'` returns **zero** lines, and run `npm run test:jest -- packages/reports` plus the reports Playwright specs against staging.
4. Once at zero, add `packages/reports` to whatever type gate the CI fix establishes, so it cannot regress silently again.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1375
