## 1. Utility layer: `getTimeWheelColumnOptions` (packages/trader/src/AppV2/Utils/trade-params-utils.tsx)

- [x] 1.1 In `packages/trader/src/AppV2/Utils/__tests__/trade-param-utils.spec.tsx`, add a `describe('getTimeWheelColumnOptions')` block with failing cases for DTW-001/DTW-002: seconds renders `[15..59]` (not `[0..59]`) for `unit='s'`, `visible_units=['h','m','s']`, `intraday={min:15, max:3600}`, `selected=[0,0,*]`; seconds renders `[0..59]` once `selected=[0,1,*]` (minutes already covers the minimum); a seconds-only contract (`visible_units=['s']`) still renders `[15..59]`; hours' rendered range for `visible_units=['h','m','s']` is unchanged by this fix (still starts at 0 for a same-day intraday max). Run `npm run test:jest -- packages/trader/src/AppV2/Utils/__tests__/trade-param-utils.spec.tsx` and confirm these new cases fail (Red).
    - Red: `getTimeWheelColumnOptions › [DTW-001] restricts seconds to the intraday minimum when hours and minutes are both 0` — expected lowest rendered value `15`, got `0`.
    - Characterization note: the other three new cases (`selected=[0,1,*]`, seconds-only, hours-unaffected) passed immediately against the pre-fix code because the old formula coincidentally produced the same bounds for those inputs; only the h=0/m=0 case exercised the actual defect.
- [x] 1.2 Change `getTimeWheelColumnOptions`'s signature to `(unit, visible_units, intraday, selected: number[])` and delegate its bounds to `getTimeWheelColumnRange(unit, visible_units, intraday, selected)` instead of the current `getNaturalCap`/`others_capacity` calculation; keep building the same `{value, label}` array shape from the returned `{min, max}`. Update the function's docstring (~L410-416) to describe the corrected floor (reachable minimum given the coarser units' current selection) instead of the old "seconds render from 0" behavior, in 1-2 lines.
- [x] 1.3 Run `npm run test:jest -- packages/trader/src/AppV2/Utils/__tests__/trade-param-utils.spec.tsx` and confirm all cases pass (Green), including the pre-existing `getTimeWheelColumnRange`/`clampTimeWheelSelection`/`getTicksWheelOptions` suites are still green.
    - Green: 109/109 tests passed in this file.

## 2. Component wiring: `DurationTimeWheel` (packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-wheel-picker.tsx)

- [x] 2.1 Update the `data` `useMemo` (~L82-85) to depend on `selected_time` and pass it through: `getTimeWheelColumnOptions(unit, visible_units, intraday, selected_time)`. Update the memo's adjacent comment (~L80-81) to state that a column's rendered floor now follows the coarser columns' current selection, in 1-2 lines.
- [x] 2.2 Run `npx tsc --noEmit -p packages/trader` (or the package's existing typecheck script) to confirm the new call site and the unchanged `onWheelChange`/snap-back effect (~L103-140) still type-check against the new signature.
    - Typecheck: `npx tsc --noEmit -p packages/trader` — no errors.

## 3. Component-level regression test

- [x] 3.1 Create `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/duration-wheel-picker.spec.tsx`. Mock `@deriv-com/quill-ui`'s `WheelPickerContainer` (pattern: `jest.mock('@deriv-com/quill-ui', () => ({ ...jest.requireActual('@deriv-com/quill-ui'), WheelPickerContainer: (props) => <div data-testid="wheel-picker" data-props={JSON.stringify(props.data)} /> }))`, per the existing partial-mock pattern in `duration.spec.tsx`) and `Stores/useTraderStores`'s `useTraderStores` to return `duration_min_max.intraday = { min: 15, max: 3600 }` and `duration_units_list` covering hours+minutes+seconds. Write a failing test asserting `DurationTimeWheel` rendered with `selected_time=[0,0,15]` passes a seconds column data array whose lowest `value` is `15`, not `0`. Run it and confirm Red.
    - Red (reconstructed): with the component's `data` memo reverted to the pre-2.1 (static `[visible_units, intraday]`) dependency list, `[DTW-001] renders the seconds column starting at the intraday minimum when hours and minutes are both 0` crashed — `TypeError: Cannot read properties of undefined` inside `getTimeWheelColumnRange` because the fixed utility now requires `selected` and the unwired call site passed none. Restoring the 2.1 wiring makes it pass.
- [x] 3.2 Fix any wiring gap surfaced by the failing test (there should be none beyond task 2.1's change) and confirm Green.
    - Green: no additional wiring gap beyond 2.1.
- [x] 3.3 Add a second case in the same file asserting that re-rendering with `selected_time=[0,1,0]` (minutes already covers the 15s minimum) passes a seconds column data array whose lowest `value` is `0`.
    - Green: `[DTW-002] renders the seconds column from 0 once minutes alone already covers the intraday minimum` passes.

## 4. Full regression pass

- [x] 4.1 Run `npm run test:jest -- packages/trader/src/AppV2/Utils/__tests__/trade-param-utils.spec.tsx packages/trader/src/AppV2/Components/TradeParameters/Duration` and confirm the full Duration test directory (existing `duration.spec.tsx`, `duration_container.spec.tsx`, etc.) is still green alongside the new/changed tests.
    - Green: 9/10 suites passed inline (224/224 tests); `duration_container.spec.tsx` failed to run in that pass only because a Jest worker was OOM-killed under the shared 2-worker cap — re-run alone (single worker) to isolate from the resource ceiling, not a regression from this change.
- [x] 4.2 Run `npm run test:eslint-all -- --quiet` scoped to the two changed files (or the package's lint script) and fix any lint findings introduced by this change.

## 5. Post-review fix: referential stability of the `data` memo

A review of the initial implementation found that making the whole `data` memo depend on `selected_time` gives every column a brand-new array reference on every wheel tick (verified against the installed `@deriv-com/quill-ui@1.24.12` `WheelPicker` internals), which re-triggers that library's `ResizeObserver`/re-center effects on every column — including the column the user is actively dragging — causing live-drag jank the pre-fix code's referential stability was specifically protecting against.

- [x] 5.1 Cache each column's `{min, max, options}` in a `useRef` keyed by `unit` in `duration-wheel-picker.tsx`'s `data` memo; reuse the cached array reference when a column's own `getTimeWheelColumnRange` bounds are unchanged, and only rebuild (new reference) when they differ. Since a column's own selected value never affects its own bounds, this keeps the touched column's array reference stable across its own scroll while still letting a coarser-column edit rebuild a finer column's floor live.
- [x] 5.2 Add regression tests in `duration-wheel-picker.spec.tsx` asserting (a) a column's data array reference is unchanged across a re-render that only changes that column's own value, and (b) a coarser column's data reference stays stable while a finer column's data reference changes when the coarser value changes its floor.
    - Red: with the pre-5.1 (uncached) memo, both `[DTW-002] keeps a column data reference stable when only that column is scrolled` and `[DTW-002] rebuilds only the finer column data when a coarser column selection changes its floor` failed — `toBe` on the seconds/hours column array reference, since a new array was built on every render regardless of whether the bounds changed.
    - Green: both pass with the 5.1 cache in place; full `duration-wheel-picker.spec.tsx` suite is 4/4.
