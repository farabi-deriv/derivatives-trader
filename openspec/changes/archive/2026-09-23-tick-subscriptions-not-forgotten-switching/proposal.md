## Why

Switching symbols on the Trade page leaves the previous symbol's `ticks_history` stream alive on the WebSocket — ticks for the old market keep arriving, and every further switch adds another orphaned stream (issue [#1433](https://github.com/deriv-com/derivatives-trader/issues/1433)).

The chain is fully traceable in this repo plus the bundled chart:

1. `packages/trader/src/AppV2/Containers/Chart/trade-chart.tsx` renders one long-lived `SmartChart` (`key='trade-chart'`) and changes only its `symbol` prop.
2. SmartCharts' `ChartStore.changeSymbol()` → `newChart()` → `feed.unsubscribe({ symbol: <old>, granularity })` → `Feed._forgetStream()` → `BinaryAPI.forget({ symbol, granularity })`, which calls the app's `unsubscribeQuotes(request, callback)` with a request built by `createGetQuotesRequest`. That builder **omits `granularity` when it is `0`** (`e&&(o.granularity=+e)` in `node_modules/@deriv-com/smartcharts-champion/dist/smartcharts.js`), i.e. for every tick chart.
3. `unsubscribeQuotes` in `packages/trader/src/Modules/SmartChart/Hooks/useSmartChartsAdapter.ts:402` only takes the keyed teardown path when `typeof request.granularity !== 'undefined'`. With the key absent it falls through to `transport.unsubscribeAll('ticks')`.
4. `unsubscribeAll(msgType)` in `packages/trader/src/Modules/SmartChart/Adapters/transport.ts:225` filters with `subscription.request[msgType]`, but every chart stream is stored as a `ticks_history` request. `request['ticks']` is `undefined`, so the filter matches nothing, `messageSubscription.unsubscribe()` is never called, no `forget` reaches the socket, and the old stream keeps flowing.

So the teardown call from the chart _does_ arrive — the app silently drops it. Candle charts (granularity > 0) are unaffected, which is why the leak is invisible in the UI and only shows up in the WS panel. The same broken fallback is the chart's unmount cleanup (`useSmartChartsAdapter.ts:423`), so leaving the Trade page leaks too.

## What Changes

- **Resolve an omitted granularity to ticks.** `unsubscribeQuotes` treats a request that carries a `symbol` but no `granularity` as granularity `0`, matching SmartCharts' own request builder, so the keyed teardown (`transport.unsubscribe`) runs for tick charts instead of the fallback.
- **Give the adapter a working bulk teardown.** A new `unsubscribeAllQuotes()` on the adapter tears down every quote stream it owns and clears its internal `subscriptions` map. Both the no-symbol fallback and the unmount cleanup in `useSmartChartsAdapter` call it instead of `transport.unsubscribeAll('ticks')`. The endpoint name becomes a single shared constant (`ticks_history`) used to build the subscribe request _and_ to filter the teardown, so the two can no longer drift apart.
- **Make a new subscription supersede the old one for the same key.** `subscribeQuotes` tears down any existing stream registered under the same `symbol-granularity` before registering the new one, so a re-subscribe that arrives without a preceding `forget` (reconnect, rapid switching) cannot strand the earlier stream.
- **Make transport subscription ids collision-proof.** The current id is `` `${symbol}-${Date.now()}` ``; two subscriptions created in the same millisecond overwrite each other in the tracking map and the first stream becomes permanently unreachable. Ids move to a monotonic counter (same `<name>-<number>` shape).
- **Regression tests** at the transport, adapter and hook levels proving a symbol switch on a tick chart unsubscribes the previous stream.

Non-goals: no change to `@deriv-com/smartcharts-champion`, to `socket_base.js`/`deriv-api`, to the `useSubscription('ticks')` path (`useLiveTick` already tears down per symbol), or to `useAutomationTicks` (already unsubscribes in its effect cleanup).

## Capabilities

### New Capabilities

- `chart-quote-subscriptions`: how the SmartCharts adapter opens, supersedes and forgets live quote (`ticks_history`) streams, so that exactly the active symbol's stream stays on the socket.

### Modified Capabilities

<!-- None. No existing capability in openspec/specs/ covers chart quote-stream lifecycle. -->

## Impact

- **Code (behavior):**
    - `packages/trader/src/Modules/SmartChart/Hooks/useSmartChartsAdapter.ts` — granularity defaulting in `unsubscribeQuotes`; both teardown call sites move to the adapter method.
    - `packages/trader/src/Modules/SmartChart/Adapters/index.ts` — shared endpoint constant, supersede-on-subscribe, new `unsubscribeAllQuotes()`.
    - `packages/trader/src/Modules/SmartChart/Adapters/transport.ts` — collision-proof subscription ids.
    - `packages/trader/src/Modules/SmartChart/Adapters/types.ts` — `unsubscribeAllQuotes` added to `SmartchartsChampionFunctions`.
- **Consumers (no source change required):** `AppV2/Containers/Chart/trade-chart.tsx`, `Modules/Contract/Containers/replay-chart.tsx` (and `AppV2/Containers/Chart/contract-details-chart.tsx`, which renders `ReplayChart`) all pass the hook's `subscribeQuotes`/`unsubscribeQuotes` straight to `SmartChart`, so they inherit the fix.
- **Tests:** `Adapters/__tests__/transport.spec.ts`, `Adapters/__tests__/index.spec.ts`, `Hooks/__tests__/useSmartChartsAdapter.spec.ts`.
- **Network effect:** one `forget` per superseded stream, and one fewer live `ticks_history` stream per symbol switch. No new request types, no API/protocol/dependency changes.
