## Context

See `proposal.md` — Why (issue #1037) for motivation and the full evidence trail. The design-relevant facts:

**The click path today** (`inferred from code`):

1. `packages/trader/src/AppV2/Containers/Chart/trade-chart.tsx:264` renders `<ToolbarWidgets updateChartType={updateChartType} updateGranularity={updateGranularity} />`, passing `contract_trade.updateGranularity` through unmodified.
2. `packages/trader/src/Modules/SmartChart/Components/toolbar-widgets.tsx:23` forwards it as `<ChartMode … onGranularity={updateGranularity} />`. This is the only `ChartMode` render site in the repo.
3. Inside `@deriv-com/smartcharts-champion@1.10.1` `src/components/Timeperiod.tsx`, each item computes `is_disabled = (is_tick && chartTypeId !== 'line') || (!is_tick && allowTickChartTypeOnly)`, but `onIntervalClick` only early-returns for `isLoading` and for the _first_ branch. The second branch falls through to `changeGranularity(interval)` → `TimeperiodStore.onGranularityChange` → our `onGranularity` prop.
4. `packages/core/src/Stores/contract-trade-store.js:274-287` `updateGranularity` then writes `LocalStore.set('contract_trade.granularity', …)`, sets the `granularity` observable, and calls `setTradeURLParams({ granularity })`.
5. `packages/shared/src/utils/contract/trade-url-params-config.ts:107-121` maps the granularity to its text form (`60 → 1m`) and `history.replaceState`s `interval=1m` onto `routes.index`.

**Constraints that rule options out:**

- **The library is the real bug site, and we do not control it.** `Timeperiod.tsx` ships compiled in `dist/`; there is no `patch-package` / `postinstall` patching in this repo (`package.json` has only an `overrides` block for versions). Waiting on an upstream release is not an option for this fix.
- **CSS cannot make the item inert.** `dist/smartcharts.css` sets `.sc-interval__item--disabled span{opacity:.32;pointer-events:none}` — `pointer-events: none` is on the inner `<span>`, while `onClick` lives on the wrapping `Tooltip` element, which still receives the click. A repo-side `pointer-events: none` override on `.sc-interval__item--disabled` would work only by reaching into third-party BEM classes (the repo already does some of this in `packages/trader/src/sass/app/modules/smart-chart.scss` and `_common/layout/trader-layouts.scss`), and it would still leave keyboard/programmatic activation unguarded.
- **The store is the wrong choke point.** `packages/trader/src/Stores/Modules/Trading/trade-store.ts:1853-1866` calls `updateGranularity(0)` when a tick-only trade type is selected and `updateGranularity(prev_granularity)` when the user leaves one. That restore runs inside `processNewValuesAsync`, i.e. _before_ `this.contract_type` has been written, so a "reject non-tick granularity while tick-only" guard placed inside `contract_trade.updateGranularity` would read the **outgoing** Accumulators/Digits contract type and swallow the legitimate restore.
- **`trade-chart.tsx` already holds both halves of the condition.** It computes `is_accumulator` and reads `show_digits_stats`, and passes exactly `show_digits_stats || is_accumulator` as `allowTickChartTypeOnly` (`:255`). Anything the chart is told to disable can be derived there without new plumbing.
- **The callback we hand to the chart is long-lived, so it must not capture the trade type.** `Chart.tsx` in the library does `const ToolbarWidget = React.useCallback(toolbarWidget, [t.lang]);` — our `toolbarWidget` render prop is memoised on the chart's first render and only ever replaced when the language changes. `TimeperiodStore` then holds the `onGranularity` callback that render produced (`updateProps` assigns `onGranularityChange`, and a MobX `reaction` on `state.granularity` calls it as well). The callback instance built at mount is therefore the one every later interval click reaches, so any trade-type flag closed over inside it is frozen at its mount value.

## Goals / Non-Goals

**Goals:**

- Make disabled interval clicks inert for _all_ activation routes (mouse, touch, keyboard, or any future library path that calls `onGranularity`), not just for the mouse click seen in the screenshot.
- Guard at the single boundary where our code hands a callback to SmartCharts, so the fix is one small, obvious, unit-testable predicate.
- Leave every programmatic granularity write (`processNewValuesAsync`, `setChartModeFromURL`, `chartStateChange`) on exactly its current path.

**Non-Goals:**

- Forking, vendoring, or patching `@deriv-com/smartcharts-champion`.
- Restyling the disabled interval item (no cursor/opacity changes) — a visual polish pass on third-party classes is a separate concern from the state leak.
- Touching `setTradeURLParams` / `getTradeURLParams` or the `interval` ↔ granularity mapping.
- Changing the _set_ of intervals the chart disables; `allowTickChartTypeOnly` semantics stay as they are.
- The Contract Details / replay chart (no interval selector) and the Duration time-grid picker (`time-grid-picker.tsx`, real `<button disabled>`, no URL writes).

## Decisions

**Decision: Guard the `onGranularity` callback in `trade-chart.tsx`, keyed on the same flag passed as `allowTickChartTypeOnly`.**

Extract the tick-only condition into a named local in `trade-chart.tsx` (e.g. `is_tick_chart_type_only = show_digits_stats || is_accumulator`), use it for the existing `allowTickChartTypeOnly` and `granularity` props _and_ for a wrapper handed to `ToolbarWidgets`. The wrapper reads the flag from a ref rather than from its closure, because the chart keeps calling the callback instance built on its first render (see Context — the callback we hand to the chart is long-lived):

```ts
const is_tick_chart_type_only_ref = React.useRef(is_tick_chart_type_only);
is_tick_chart_type_only_ref.current = is_tick_chart_type_only;

const handleGranularityChange = React.useCallback(
    (new_granularity: number) => {
        // SmartCharts renders non-tick intervals as disabled while only the tick chart is
        // allowed, but still fires onGranularity for them (issue #1037). Dropping the value
        // here keeps store, LocalStore and the `interval` URL param in step with the chart.
        if (shouldIgnoreGranularityChange(new_granularity, is_tick_chart_type_only_ref.current)) return;
        updateGranularity(new_granularity);
    },
    [updateGranularity]
);
```

Rationale: it is the single place where the "which intervals are disabled" truth and the "apply a granularity" action meet, it needs no new props or store coupling, and it covers every activation route because it sits on the callback rather than on the DOM event. Deriving the guard from the _same_ expression already passed as `allowTickChartTypeOnly` means the guard cannot drift from what the chart renders as disabled.

The ref is what makes that non-drift claim true at runtime and not just at the first render. A version of this guard that read `is_tick_chart_type_only` straight from the closure was rejected in review: with the flag frozen at mount, mounting the chart on Digits/Accumulators leaves it stuck at `true`, so **enabled** intervals stop responding after the user switches to a candle-capable trade type; mounting on a candle-capable trade type leaves it stuck at `false`, so disabled intervals keep rewriting the `interval` URL parameter — the original defect, intermittently. `updateGranularity` needs no such treatment: it is `action.bound` on `ContractTradeStore` (`packages/core/src/Stores/contract-trade-store.js:69`), so its identity is stable for the life of the store.

- Alternative considered — **CSS `pointer-events: none` on `.sc-interval__item--disabled`** in `packages/trader/src/sass/app/modules/smart-chart.scss`. Rejected as the primary fix: it depends on third-party class names, leaves keyboard/programmatic activation open, and is invisible to unit tests. May be added later as cosmetic hardening; not required by the spec.
- Alternative considered — **guard inside `contract_trade.updateGranularity`** (`packages/core/src/Stores/contract-trade-store.js`). Rejected: as noted in Context it would swallow the legitimate `updateGranularity(prev_granularity)` restore in `processNewValuesAsync`, and it would push trade-type knowledge into a core store that currently takes granularity at face value.
- Alternative considered — **guard inside `toolbar-widgets.tsx`**. Rejected: that component knows nothing about trade types; it would need a new `allowTickChartTypeOnly`-shaped prop threaded from `trade-chart.tsx` anyway, adding a hop for no gain.
- Alternative considered — **filter in `setTradeURLParams`**. Rejected: it fixes only the URL symptom and leaves the store observable and `LocalStore` corrupted, so the "leaving tick-only mode does not resurrect a rejected interval" scenario would still fail.

**Decision: Express the guard as a pure exported predicate in `packages/trader/src/Modules/SmartChart/Utils/chart-utils.ts`.**

Add `shouldIgnoreGranularityChange(granularity: number, is_tick_chart_type_only: boolean)` returning `is_tick_chart_type_only && granularity !== 0` alongside the existing `getMarketsOrder` / `CHART_CONSTANTS`. Rationale: it gives the Red step of TDD a target that needs no chart mock, documents the rule in one sentence, and matches where chart helpers already live. The comparison is against `0` because `0` _is_ the tick granularity in this codebase (`Modules/SmartChart/Adapters/types.ts:28` — "0 for ticks, >0 for candles in seconds"; `trade-url-params-config.ts` maps `0 → 1t`).

- Alternative considered — inline the two-term condition in `trade-chart.tsx`. Acceptable and marginally smaller, but the component test then has to exercise it through the mocked `SmartChart` prop capture for every case; the pure helper is cheaper to cover and self-documenting.

**Decision: No guard for the tick-disabled-on-candle-chart case.**

`Timeperiod.onIntervalClick` already early-returns for `key === 'tick' && chart_type_id !== 'line'`, so that disabled item never reaches our callback. The spec scenario for it is a regression assertion of existing correct behaviour, verified manually, not new code. Adding a chart-type term to the predicate would duplicate library logic we would then have to keep in sync — and `updateGranularity(0)` already coerces `chart_type` to `'line'` (`contract-trade-store.js:277-279`) if it ever did arrive.

**Decision: Cover it with a pure unit test plus one component test; no E2E.**

`packages/trader/src/Modules/SmartChart/Utils/__tests__/chart-utils.spec.ts` covers the predicate truth table. `packages/trader/src/AppV2/Containers/Chart/__tests__/trade-chart.spec.tsx` already captures the props given to the mocked `SmartChart`; mocking `Modules/SmartChart/Components/toolbar-widgets` the same way lets a test invoke the captured `updateGranularity` and assert `contract_trade.updateGranularity` was / was not called. There is no existing Playwright flow for the chart interval selector (`playwright/flows/` has no chart module), and adding one is disproportionate to a two-term guard — the URL-level behaviour is verified by the manual QA steps in `tasks.md`.

The component test must reproduce the library's callback lifetime, or it cannot see the stale-closure failure at all: capture `mockSmartChartProps.toolbarWidget` **before** the trade type changes, change the trade type, then invoke the callback from that captured render prop. Switching trade types mid-test also has to go through MobX — `observer()` wraps the component in `React.memo`, so a bare `rerender()` of a propless component bails out — hence `makeObservable(store.modules.trade, { contract_type: observable })` on the mock store and a `runInAction` write.

## Risks / Trade-offs

- **[Risk] The guard and the library's `is_disabled` rule drift apart if a future SmartCharts release changes which intervals it disables.** → Mitigation: the guard is derived from the very value we pass as `allowTickChartTypeOnly`, so it can only drift if the library changes the _meaning_ of that prop. The SCSS/`allowTickChartTypeOnly` touchpoints are noted in the code comment pointing at issue #1037, and the smartcharts version is pinned via `overrides` in the root `package.json`.
- **[Risk] The chart holds our callback for its whole lifetime, so anything the callback captures goes stale.** → Mitigation: the callback closes over nothing that changes — the flag comes from a ref updated on every render, and `updateGranularity` is a bound store action. The two "granularity changes after the trade type changed" tests fail if a future edit reintroduces a captured value.
- **[Risk] Upstream fixes `Timeperiod.tsx`, making our guard redundant.** → Mitigation: a redundant two-term guard is harmless and still protects the store from any other caller of `onGranularity`. Report the upstream bug (proposal — Follow-up) and let the guard age out naturally.
- **[Risk] A disabled item still looks clickable (`cursor: auto`, no `not-allowed`), so users may keep clicking and read "nothing happened" as a hang.** → Trade-off accepted for this change: issue #1037 asks for no URL/state change, which the guard delivers. The library already shows a tooltip for the tick case; a cursor/affordance tweak on `.sc-interval__item--disabled` is optional cosmetic follow-up.
- **[Trade-off] Fixing at the consumer rather than the source means any _other_ future consumer of `ChartMode` in this repo must apply the same guard.** → Mitigation: there is exactly one `ChartMode` render site (`toolbar-widgets.tsx`), reached from exactly one container (`trade-chart.tsx`); the predicate lives in shared chart utils so a second consumer can reuse it in one line.

## Migration Plan

Pure front-end behaviour fix. No feature flag, no data migration, no API change. Ships with the normal `@deriv/trader` bundle. Rollback is a revert of the two touched source files (the predicate in `chart-utils.ts` and the wrapper in `trade-chart.tsx`).

One migration-adjacent note: users who already clicked a disabled interval before this fix have a stale non-tick value in `LocalStore('contract_trade.granularity')` and possibly a stale `interval` in a bookmarked URL. Both are valid granularities, so existing behaviour handles them — `setChartModeFromURL` applies the URL value and `processNewValuesAsync` forces `0` while a tick-only trade type is selected. No cleanup code is warranted.
