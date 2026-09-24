# chart-quote-subscriptions Specification

## Purpose
TBD - created by archiving change tick-subscriptions-not-forgotten-switching. Update Purpose after archive.
## Requirements
### Requirement: [CQS-001] A quote-stream teardown request with no granularity resolves to ticks

`unsubscribeQuotes` in `useSmartChartsAdapter` SHALL treat a teardown request that carries a `symbol` but no `granularity` as granularity `0` (ticks) and take the keyed teardown path (`adapter.unsubscribeQuotes({ symbol, granularity })`). SmartCharts' `createGetQuotesRequest` omits `granularity` whenever it is falsy, so a tick chart — the default — always forgets through this path. The no-symbol fallback SHALL remain reserved for requests that name no symbol at all.

#### Scenario: Tick chart forgets the previous symbol on a symbol switch

- **WHEN** a tick chart is streaming `R_100` and the chart requests teardown with `{ symbol: 'R_100', style: 'ticks', count: 1000, adjust_start_time: 1, subscribe: 1 }` (no `granularity` key)
- **THEN** the adapter's keyed `unsubscribeQuotes({ symbol: 'R_100', granularity: 0 })` is invoked
- **AND** the transport unsubscribes the stream registered for `R_100` at granularity `0`, so a `forget` is sent for it
- **AND** the bulk fallback is not used

#### Scenario: Candle chart teardown is unchanged

- **WHEN** the chart requests teardown with `{ symbol: 'R_100', granularity: 60, ... }`
- **THEN** the adapter's keyed `unsubscribeQuotes({ symbol: 'R_100', granularity: 60 })` is invoked exactly as before

#### Scenario: Teardown request names no symbol

- **WHEN** `unsubscribeQuotes` is called with no request, or with a request that has no `symbol`
- **THEN** every quote stream the adapter owns is torn down via the adapter's bulk teardown

### Requirement: [CQS-002] Bulk teardown forgets every quote stream the adapter owns

The adapter SHALL expose `unsubscribeAllQuotes()`, which tears down every live quote stream it holds and clears its own subscription registry. The endpoint used to open a quote stream and the endpoint used to filter the bulk teardown SHALL come from one shared constant (`ticks_history`), so the filter cannot silently match nothing. `useSmartChartsAdapter` SHALL call `unsubscribeAllQuotes()` for both its no-symbol fallback and its unmount cleanup, instead of naming a message type itself.

#### Scenario: Bulk teardown reaches ticks_history streams

- **WHEN** the adapter holds live streams opened as `ticks_history` requests and `unsubscribeAllQuotes()` is called
- **THEN** each stream's underlying WebSocket subscription is unsubscribed
- **AND** the adapter's subscription registry is left empty, so a later teardown for the same key does not act on a dead entry

#### Scenario: Chart unmount leaves no live quote stream

- **WHEN** a component using `useSmartChartsAdapter` unmounts while a tick stream is live
- **THEN** the hook's cleanup calls the adapter's bulk teardown
- **AND** the live stream's WebSocket subscription is unsubscribed

### Requirement: [CQS-003] A new quote subscription supersedes an existing one for the same key

`subscribeQuotes` SHALL tear down any stream already registered for the same `symbol` and `granularity` before registering the new one, so a re-subscribe that arrives without a preceding teardown cannot leave the earlier stream running.

#### Scenario: Re-subscribing to the same symbol and granularity

- **WHEN** `subscribeQuotes({ symbol: 'R_100', granularity: 0 }, cb)` is called while a stream for `R_100` at granularity `0` is already registered
- **THEN** the previously registered stream is unsubscribed before the new subscription is created
- **AND** exactly one stream for `R_100` at granularity `0` remains registered

#### Scenario: Subscribing to a different symbol leaves other streams untouched

- **WHEN** a stream for `R_100` at granularity `0` is registered and `subscribeQuotes({ symbol: 'R_50', granularity: 0 }, cb)` is called
- **THEN** the `R_100` stream is not torn down by the new subscription
- **AND** both streams remain individually addressable for teardown

### Requirement: [CQS-004] Every transport subscription is independently addressable

The transport SHALL give each subscription an id that is unique for the lifetime of the transport instance, so that no subscription can overwrite another in the tracking map and become unreachable for teardown. Ids SHALL keep the existing `<name>-<number>` shape.

#### Scenario: Two subscriptions created in the same millisecond

- **WHEN** two `ticks_history` subscriptions for the same symbol are created without the wall clock advancing
- **THEN** the two subscriptions receive different ids
- **AND** unsubscribing by each id unsubscribes its own underlying WebSocket subscription

### Requirement: [CQS-005] Only the active symbol's quote stream remains on the socket after a switch

After the chart switches from one symbol to another, the app SHALL hold no live quote stream for the previous symbol. Repeated switching SHALL NOT accumulate quote streams.

#### Scenario: Repeated symbol switches on a tick chart

- **WHEN** the chart switches symbol three times in a row on a tick (granularity `0`) chart
- **THEN** after the last switch exactly one quote stream is registered, for the newest symbol
- **AND** each superseded symbol's WebSocket subscription was unsubscribed

