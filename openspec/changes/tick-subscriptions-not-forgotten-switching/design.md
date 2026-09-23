## Context

The Trade page keeps one `SmartChart` instance alive (`key='trade-chart'` in `AppV2/Containers/Chart/trade-chart.tsx`) and only changes its `symbol` prop. The chart is a Flutter Web canvas build shipped as `@deriv-com/smartcharts-champion`; all WebSocket work is delegated back to the app through the `getQuotes` / `subscribeQuotes` / `unsubscribeQuotes` props, which `useSmartChartsAdapter` supplies.

Teardown on symbol change is initiated by the chart, not by us. In the bundled chart (`dist/smartcharts.js`):

```
changeSymbol()  →  newChart()  →  feed.unsubscribe({ symbol: <old>, granularity })
                →  Feed._forgetStream(`${symbol}-${granularity}`)
                →  stream.forget()  →  BinaryAPI.forget({ symbol, granularity })
                →  app's unsubscribeQuotes(request, callback)
```

where `request = createGetQuotesRequest({ ...params, subscribe: 1 })` and that builder writes `granularity` only when it is truthy (`e && (o.granularity = +e)`). A tick chart therefore always hands us a request with **no `granularity` key**.

Our side then fails in two places, both verified by reading the code:

- `useSmartChartsAdapter.ts:402` gates the keyed teardown on `typeof request.granularity !== 'undefined'`, so tick charts fall through to `transport.unsubscribeAll('ticks')`.
- `transport.ts:225` filters that bulk teardown with `subscription.request[msgType]`; every quote stream is stored as a `{ ticks_history: <symbol>, subscribe: 1, ... }` request, so `request['ticks']` is `undefined` and the filter matches nothing.

Net effect: the chart asks us to forget, we accept the call and do nothing. The RxJS subscription returned by `WS.subscribeTicksHistory` is never unsubscribed, so deriv-api's `finalize` teardown — the thing that actually sends `{ forget: <id> }` — never fires. Candle charts (granularity > 0) escape the bug entirely, which is why it only shows up in the WS panel.

Constraints: we do not own `@deriv-com/smartcharts-champion`, so the omitted-granularity convention is a given we must accommodate; and the same hook backs the replay / contract-details charts, so the fix must not change their behaviour beyond actually forgetting.

## Goals / Non-Goals

**Goals:**

- A symbol switch on a tick chart forgets the previous symbol's `ticks_history` stream.
- Unmounting a chart forgets every quote stream it opened.
- The two failure modes above become structurally impossible to reintroduce silently: one shared endpoint constant, and no caller outside the adapter naming a message type.
- Repeated switching cannot accumulate streams, even if a re-subscribe arrives without a preceding forget.

**Non-Goals:**

- No change to `@deriv-com/smartcharts-champion`, `socket_base.js`, `api_middleware.js` or `@deriv/deriv-api`. The `forget` machinery below `WS.subscribeTicksHistory` already works once the RxJS subscription is dropped.
- No change to the `useSubscription('ticks')` path. `useLiveTick` re-points per symbol and unsubscribes in its effect cleanup; `useAutomationTicks` unsubscribes in its cleanup too.
- No app-level sweep that forgets "every stream whose symbol is not the active one". The replay and contract-details charts legitimately stream a symbol other than `trade_store.symbol`, so a global sweep keyed on the trade symbol would break them.
- No change to `WS.forgetAll` (which, separately, is not exported by `socket_base.js` — out of scope here; see the deferral).

## Decisions

### D1 — Default an omitted `granularity` to `0` rather than widening the fallback

`unsubscribeQuotes` routes on `request?.symbol` alone and resolves `granularity` through the existing `isValidGranularity` guard, which already maps anything invalid (including `undefined`) to `0`. That matches the chart's own convention exactly: it omits the key precisely when the value is `0`.

_Alternative considered:_ make the bulk fallback work for `ticks` by aliasing `ticks` → `ticks_history` in the transport filter. Rejected — it would tear down _all_ streams when the chart asked to forget _one_, and it encodes an alias that is not real (no chart stream is ever opened as a bare `ticks` request).

### D2 — Move bulk teardown onto the adapter as `unsubscribeAllQuotes()`

The hook currently reaches through the adapter into `transport.unsubscribeAll('ticks')` and has to know the endpoint name. It guessed wrong, and nothing caught it. Putting the operation on the adapter — which is the object that builds the request in the first place — lets one module-level constant (`QUOTES_ENDPOINT = 'ticks_history'`) serve both the subscribe request and the teardown filter. The adapter also clears its own `subscriptions` map, which the current bulk path leaves stale (entries whose transport subscription is already gone).

_Alternative considered:_ keep the call at the hook and just correct the string to `'ticks_history'`. Rejected — a one-character-class fix that leaves the same footgun (a caller naming a message type that silently matches nothing) in place for the next edit.

### D3 — Supersede on subscribe, keyed on `symbol-granularity`

`subscribeQuotes` already registers its unsubscribe under `` `${symbol}-${granularity}` ``. If a second subscription lands on the same key, the map entry is simply overwritten today and the first stream is unreachable forever. Calling the existing entry's unsubscribe first makes "one stream per key" an invariant of the adapter rather than an assumption about the chart's call order. This is what gives the "before (or as) the new subscription starts" guarantee the issue asks for, independent of the chart's behaviour.

### D4 — Monotonic counter for transport subscription ids

`` `${request.ticks_history || request.ticks || 'unknown'}-${Date.now()}` `` collides whenever two subscriptions for the same symbol are created inside one millisecond — the second `Map.set` evicts the first, orphaning its RxJS handle. A per-transport-instance counter removes the collision. The id shape stays `<name>-<number>`, so existing assertions like `expect(result).toMatch(/^EURUSD-\d+$/)` in `transport.spec.ts` keep passing.

_Alternative considered:_ key by the request itself (`JSON.stringify`). Rejected — it would make two legitimate concurrent subscriptions to the same request share one id, which is the same eviction bug by another route.

### D5 — Leave `transport.unsubscribeAll`'s signature alone

It stays `unsubscribeAll(msg_type?)` with its current truthiness filter, which is correct once given the real endpoint key. Only the callers change. Keeping the transport untouched here keeps the diff on the layer that was actually wrong.

## Risks / Trade-offs

- **[The chart re-subscribes for the same key as part of normal operation and D3 tears down a stream it still wants]** → D3 only fires when a subscription for the _identical_ `symbol`+`granularity` is already registered, and the chart's own `Feed` keys its `_activeStreams` the same way — it cannot hold two streams for one key either, so the entry we drop is one the chart has already replaced. Covered by a test asserting a different symbol is left untouched.
- **[The replay / contract-details charts regress, since they share the hook]** → Their behaviour changes only in that teardown now actually happens. Their existing specs (`Modules/Contract/Containers/__tests__/replay-chart.spec.tsx`, `AppV2/Containers/Chart/__tests__/contract-details-chart.spec.tsx`) run in the verification step.
- **[Forgetting a stream the chart is still rendering from, causing a frozen chart]** → The teardown is driven by the chart's own `forget` call for the _old_ key; the new symbol's `subscribeQuotes` is a separate registration. A frozen chart would require the chart to forget a key it is still feeding, which it does not do.
- **[The fix is invisible in unit tests because the real `forget` is sent inside `@deriv/deriv-api`]** → Tests assert at the seam we own: that `messageSubscription.unsubscribe()` is called on the object returned by `WS.subscribeTicksHistory`. That RxJS unsubscribe is what triggers deriv-api's `finalize` → `{ forget: <id> }`; asserting further down would only be testing the dependency.

## Migration Plan

No data, storage or protocol migration. The change is additive at the type level (`unsubscribeAllQuotes` on `SmartchartsChampionFunctions`) and behavioural everywhere else. Rollback is a straight revert of the four source files; nothing persists across a reload.

## Open Questions

None blocking. The one judgement call — whether to also add an app-level "forget everything not for the active symbol" sweep — is resolved as **no** under Non-Goals, because the replay and contract-details charts share this hook and stream a symbol other than the trade symbol.
