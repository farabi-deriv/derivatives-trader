## Why

On the Trade page, the chart's **Time interval** list disables every non-tick interval whenever only the tick chart is allowed (Digits and Accumulators). Those disabled items are still clickable: SmartCharts fires `onGranularity` for them, which reaches `contract_trade.updateGranularity(...)` and rewrites the `interval` query parameter in the URL ([issue #1037](https://github.com/deriv-com/derivatives-trader/issues/1037)).

The URL is the visible symptom, but the same click also writes `contract_trade.granularity` and `LocalStore('contract_trade.granularity')`. The chart itself keeps rendering ticks (its `granularity` prop is hard-forced to `0` in tick-only mode), so the app's persisted chart state silently disagrees with what the user sees — and can surface as an unexpected candle interval after switching away from Digits/Accumulators.

## What Changes

- Disabled time intervals in the chart's Time interval list become inert on the Trade page: clicking one SHALL NOT change chart granularity, SHALL NOT write `LocalStore('contract_trade.granularity')`, and SHALL NOT touch the `interval` URL query parameter.
- The Trade page guards the `onGranularity` callback it hands to SmartCharts: while only the tick chart type is allowed (`show_digits_stats || is_accumulator` — the exact condition already passed as `allowTickChartTypeOnly`), a non-tick granularity coming back from the chart toolbar is dropped instead of applied.
- Programmatic granularity writes stay untouched: `processNewValuesAsync` still forces `updateGranularity(0)` when Accumulators/Digits is selected and still restores `prev_granularity` when the user leaves those trade types, and `setChartModeFromURL` still applies a granularity read from the URL on mount.
- Enabled intervals keep working exactly as today: selecting one updates the chart, the store, `LocalStore`, and the `interval` URL parameter.
- Regression coverage added at the guard boundary (unit test for the pure predicate plus a Trade-chart test that the guarded callback swallows non-tick granularity in tick-only mode).

No breaking changes. No API, dependency, or WebSocket changes.

## Capabilities

### New Capabilities

- `trade-chart-interval`: Behaviour of the Trade page chart's Time interval (granularity) selector — which intervals are selectable in which chart mode, and what a selection is allowed to change (chart granularity, persisted `contract_trade.granularity`, and the `interval` URL query parameter).

### Modified Capabilities

<!-- None. openspec/specs/ has no existing spec covering the Trade page chart interval selector or the trade URL query parameters. `contract-details-chart` covers the Contract Details / replay chart, which has no interval selector. -->

## Impact

**Root cause (third-party, `inferred from code`)** — `@deriv-com/smartcharts-champion@1.10.1`, `src/components/Timeperiod.tsx` (recovered from `node_modules/@deriv-com/smartcharts-champion/dist/smartcharts.js.map`):

- `is_disabled` is computed as `(is_tick && chartTypeId !== 'line') || (!is_tick && allowTickChartTypeOnly)`.
- `onIntervalClick` early-returns only for `isLoading` and for `key === 'tick' && chart_type_id !== 'line'`. The `!is_tick && allowTickChartTypeOnly` branch has **no** guard, so `changeGranularity(interval)` runs for a visually disabled item.
- CSS cannot save it: `dist/smartcharts.css` has `.sc-interval__item--disabled span{opacity:.32;pointer-events:none}` — `pointer-events: none` is on the inner `<span>` only, while the `onClick` sits on the wrapping `Tooltip` element, which still receives the click (`.sc-interval__item--disabled{background:transparent!important;cursor:auto}` — not even a `not-allowed` cursor).

**Affected code in this repo:**

- `packages/trader/src/AppV2/Containers/Chart/trade-chart.tsx` — `:255` passes `allowTickChartTypeOnly={show_digits_stats || is_accumulator}`; `:264` passes `contract_trade.updateGranularity` straight through to `ToolbarWidgets`. This is where the guard belongs (both conditions are already in scope here).
- `packages/trader/src/Modules/SmartChart/Components/toolbar-widgets.tsx` — `:23` `<ChartMode portalNodeId='modal_root' onChartType={updateChartType} onGranularity={updateGranularity} />`; the only place `ChartMode` is rendered (`packages/trader/src/Modules/SmartChart/index.js` re-exports it).
- `packages/core/src/Stores/contract-trade-store.js:274-287` — `updateGranularity` writes `LocalStore.set('contract_trade.granularity', granularity)`, sets the observable, and calls `setTradeURLParams({ granularity })`. **Not** the fix site: `packages/trader/src/Stores/Modules/Trading/trade-store.ts:1853-1866` legitimately calls `updateGranularity(0)` / `updateGranularity(prev_granularity)` from `processNewValuesAsync` while `this.contract_type` may still be the outgoing Accumulators/Digits value, so a tick-only guard inside the store would block the legitimate restore.
- `packages/shared/src/utils/contract/trade-url-params-config.ts:107-121` — `setTradeURLParams` maps granularity to the `interval` text (`0 → 1t`, `60 → 1m`, …) and `history.replaceState`s it onto `routes.index`. Unchanged by this fix.
- Optional home for the pure predicate: `packages/trader/src/Modules/SmartChart/Utils/chart-utils.ts` (already holds `getMarketsOrder` and `CHART_CONSTANTS`).

**Tests:**

- `packages/trader/src/AppV2/Containers/Chart/__tests__/trade-chart.spec.tsx` — already captures the props handed to the mocked `SmartChart`; extend to drive the guarded granularity callback.
- New/extended `packages/trader/src/Modules/SmartChart/Utils/__tests__/chart-utils.spec.ts` if the predicate is extracted there.

**Out of scope:** the Contract Details / replay chart (`packages/trader/src/Modules/Contract/Containers/replay-chart.tsx`) renders no interval selector; `packages/trader/src/AppV2/Components/TradeParameters/Duration/time-grid-picker.tsx` is the _duration_ time grid (real `<button disabled>` elements, no URL writes) and is unrelated despite the similar wording.

**Follow-up (not this change):** the missing `allowTickChartTypeOnly` guard should also be reported upstream in `smartcharts-champion` `Timeperiod.tsx` so the disabled item stops firing `onIntervalClick` at source; this change makes the Trade page correct without waiting for that release.
