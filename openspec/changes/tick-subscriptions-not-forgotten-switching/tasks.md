## Open Questions

### Should the fix also add an app-level sweep that forgets every quote stream whose symbol is not the currently selected one?

- [recommended] No — fix the teardown path the chart already calls, plus supersede-on-subscribe in the adapter (the replay and contract-details charts share this hook and legitimately stream a symbol other than `trade_store.symbol`, so a sweep keyed on the trade symbol would kill their stream)
- Yes, in `trade-chart.tsx` only — a `useEffect` on `symbol` that forgets any stream for another symbol (stronger guarantee, but a second teardown owner alongside the chart's own `forget`)
- Yes, in the adapter — make `subscribeQuotes` forget every stream for a different symbol (simplest to express, but silently breaks any future multi-symbol chart)

### Where should the bulk quote-stream teardown live — on the adapter, or stay at the hook with a corrected endpoint string?

- [recommended] On the adapter as `unsubscribeAllQuotes()` — one shared `QUOTES_ENDPOINT` constant builds the subscribe request and filters the teardown, so the caller can no longer name a message type that matches nothing, and the adapter's own `subscriptions` map gets cleared too
- Keep it at the hook, just change `transport.unsubscribeAll('ticks')` to `'ticks_history'` — one-line diff, but leaves the same silent-no-op footgun and the stale `subscriptions` map
- Make `transport.unsubscribeAll` throw (or warn) when a `msg_type` matches no tracked subscription — surfaces the mistake but does not prevent it, and adds noise on legitimately empty teardowns

Both recommended options are used below, so the plan is complete and implementable as written.

## 1. Reproduce (Red)

- [x] 1.1 In `packages/trader/src/Modules/SmartChart/Hooks/__tests__/useSmartChartsAdapter.spec.ts`, add a failing test for the tick-chart teardown: render the hook, call `unsubscribeQuotes({ symbol: 'R_100', style: 'ticks', count: 1000, adjust_start_time: 1, subscribe: 1 })` (no `granularity` key — this is exactly what SmartCharts' `createGetQuotesRequest` produces for granularity `0`), and assert the mocked `adapter.unsubscribeQuotes` was called with `{ symbol: 'R_100', granularity: 0 }`. Run it against current code and record the red inline here as `Red: <test name> — expected <x>, got <y>`.
    - Red: `unsubscribeQuotes > [CQS-001] resolves a teardown request with a symbol but no granularity to ticks (granularity 0)` — expected `mockUnsubscribeQuotes` called with `{ symbol: 'R_100', granularity: 0 }`, got 0 calls (fell through to the untyped fallback instead of the keyed path).
    - Also added, same red cause: `[CQS-001] falls back to the adapter bulk teardown when the request names no symbol` — expected `mockUnsubscribeAllQuotes` to have been called, got 0 calls (old fallback calls `transport.unsubscribeAll('ticks')` directly, not the adapter's `unsubscribeAllQuotes`).
    - Also added (task 3.4 coverage), same run: `unmount cleanup > [CQS-002] calls the adapter bulk teardown on unmount` — expected `mockUnsubscribeAllQuotes` to have been called, got 0 calls.
- [x] 1.2 In `packages/trader/src/Modules/SmartChart/Adapters/__tests__/transport.spec.ts`, add a failing test proving the current bulk filter misses chart streams: create a `{ ticks_history: 'R_100', subscribe: 1 }` subscription, call `transport.unsubscribeAll('ticks')`, and assert the subscriber's `unsubscribe` was NOT called — then convert it into the positive assertion the fix makes true (teardown via the adapter's `unsubscribeAllQuotes()` in 1.3). Record the red inline.
    - Characterization (never goes red): `unsubscribeAll > [CQS-002] does not unsubscribe a ticks_history subscription when filtered by the wrong message type` — pins the transport's existing exact-match filter, which D5 leaves unchanged; the test passes against current code both before and after the fix (the fix moves the caller to the correct `ticks_history` constant rather than changing this filter). The positive assertion for the fixed end-to-end path lives in 1.3's adapter-level `unsubscribeAllQuotes()` test.
- [x] 1.3 In `packages/trader/src/Modules/SmartChart/Adapters/__tests__/index.spec.ts`, add failing tests for (a) `adapter.unsubscribeAllQuotes()` existing and calling `transport.unsubscribeAll('ticks_history')`, and (b) `subscribeQuotes` for an already-registered `symbol-granularity` key tearing down the previous stream before registering the new one. Record the reds inline.
    - Red: `unsubscribeAllQuotes > [CQS-002] tears down every quote stream via the shared ticks_history endpoint constant` — expected `typeof adapter.unsubscribeAllQuotes` to be `"function"`, got `"undefined"`.
    - Red: `unsubscribeAllQuotes > [CQS-002] clears the subscriptions registry so a later teardown for the same key is a no-op` — `TypeError: adapter.unsubscribeAllQuotes is not a function`.
    - Red: `subscribeQuotes supersede-on-subscribe (CQS-003) > [CQS-003] tears down the previously registered stream for the same symbol and granularity` — expected `mockTransport.unsubscribe` called with `'R_100-1'`, got 0 calls.
    - Also added, same file: `[CQS-003] leaves a different symbol/granularity stream untouched` and `repeated symbol switching (CQS-005) > [CQS-005] leaves exactly one registered stream after three switches...` — both pass unchanged against current code since they only exercise the existing keyed `subscribeQuotes`/`unsubscribeQuotes` path; they guard the fix (CQS-003/CQS-005 non-regression) rather than prove new red.
- [x] 1.4 In `packages/trader/src/Modules/SmartChart/Adapters/__tests__/transport.spec.ts`, add a failing test that two subscriptions created with `Date.now()` frozen (`jest.spyOn(Date, 'now').mockReturnValue(...)` or fake timers) receive different ids and that unsubscribing each one reaches its own subscriber. Record the red inline.
    - Red: `subscribe > [CQS-004] gives two subscriptions created in the same millisecond different ids` — expected `id1` and `id2` to differ, got both equal to `"EURUSD-1700000000000"` (the second `Map.set` evicted the first under the frozen clock).

## 2. Fix — adapter and transport

- [x] 2.1 In `packages/trader/src/Modules/SmartChart/Adapters/transport.ts`, replace the `` `${...}-${Date.now()}` `` subscription id with a monotonic per-transport counter, keeping the `<name>-<number>` shape so existing `/^EURUSD-\d+$/` assertions still hold.
    - Green: `transport.spec.ts` — all 22 tests pass, including `[CQS-004]`.
- [x] 2.2 In `packages/trader/src/Modules/SmartChart/Adapters/index.ts`, add a module-level `QUOTES_ENDPOINT = 'ticks_history'` constant and use it to build the `subscribeQuotes` request (replacing the inline `ticks_history:` key) and, in 2.4, to filter the bulk teardown.
- [x] 2.3 In `packages/trader/src/Modules/SmartChart/Adapters/index.ts`, make `subscribeQuotes` tear down any stream already registered under the same `` `${symbol}-${granularity}` `` key before creating the new subscription.
- [x] 2.4 In `packages/trader/src/Modules/SmartChart/Adapters/index.ts`, add `unsubscribeAllQuotes()` to the returned `functions`: call `transport.unsubscribeAll(QUOTES_ENDPOINT)` and clear the adapter's `subscriptions` map so no stale entry survives a bulk teardown.
    - Green (2.2-2.4): `index.spec.ts` — all 43 tests pass, including `[CQS-002]`, `[CQS-003]`, `[CQS-005]`.
- [x] 2.5 In `packages/trader/src/Modules/SmartChart/Adapters/types.ts`, add `unsubscribeAllQuotes: () => void` to `SmartchartsChampionFunctions`.

## 3. Fix — hook wiring

- [x] 3.1 In `packages/trader/src/Modules/SmartChart/Hooks/useSmartChartsAdapter.ts`, change `unsubscribeQuotes` to route on `request?.symbol` alone and resolve the granularity through the existing `isValidGranularity` guard (which maps `undefined` to `0`), so a tick-chart teardown takes the keyed path instead of the fallback. Add a one-line comment stating the rule: SmartCharts omits `granularity` when it is `0`.
- [x] 3.2 In the same file, replace the no-symbol fallback `smartChartsAdapter.transport.unsubscribeAll('ticks')` with `smartChartsAdapter.unsubscribeAllQuotes()`.
- [x] 3.3 In the same file, replace the unmount cleanup effect's `smartChartsAdapter.transport.unsubscribeAll('ticks')` with `smartChartsAdapter.unsubscribeAllQuotes()`, keeping the pending-retry `clearTimeout` as is.
    - Green (3.1-3.3): `useSmartChartsAdapter.spec.ts` — all 20 tests pass, including `[CQS-001]` (x3) and `[CQS-002]` unmount.
- [x] 3.4 Update the `jest.mock('../../Adapters', ...)` factory in `packages/trader/src/Modules/SmartChart/Hooks/__tests__/useSmartChartsAdapter.spec.ts` to expose `unsubscribeAllQuotes` on the mocked adapter, and add a test asserting the hook calls it on unmount.

## 4. Verify

- [x] 4.1 Run `npm run test:jest -- packages/trader/src/Modules/SmartChart` and confirm every test in `Adapters/__tests__/transport.spec.ts`, `Adapters/__tests__/index.spec.ts` and `Hooks/__tests__/useSmartChartsAdapter.spec.ts` passes (the reds from section 1 are now green).
    - Green: 16 suites / 154 tests passed.
- [x] 4.2 Run `npm run test:jest -- packages/trader/src/AppV2/Containers/Chart packages/trader/src/Modules/Contract/Containers` to confirm the trade chart, replay chart and contract-details chart specs are unaffected.
    - Green: 6 suites / 29 tests passed.
- [x] 4.3 Run `npx tsc --noEmit -p packages/trader/tsconfig.json` (or the package's configured type-check) to confirm the `SmartchartsChampionFunctions` addition type-checks across all adapter consumers.
    - Green: no output, exit clean.
- [x] 4.4 Run `npm run test:eslint-all` (or ESLint scoped to `packages/trader/src/Modules/SmartChart`) on the changed files.
    - Green: 0 errors on all changed files. 66 pre-existing warnings surfaced (mostly `@typescript-eslint/no-explicit-any` on pre-existing code, plus 5 pre-existing unused `sub1`/`sub2` vars in `transport.spec.ts` that predate this change — confirmed via `git stash` diff, same warnings at their original line numbers). No new warnings introduced by this change.

## 5. Documentation and follow-ups

- [x] 5.1 Add a Gotchas entry to `CLAUDE.md` recording the invariant: SmartCharts' `createGetQuotesRequest` omits `granularity` when it is `0`, so a chart teardown request with a `symbol` and no `granularity` means ticks; quote-stream teardown is owned by the adapter (`unsubscribeQuotes` / `unsubscribeAllQuotes`) and the endpoint name lives in one constant — never name a message type at a call site.
- [x] 5.2 Confirm `docs/spec-to-pr/deferrals/ws-forget-all-not-exported.md` (already written during planning — the out-of-scope defect that `socket_base.js` exports `forgetStream` but not `forgetAll`, while three `@deriv/core` call sites invoke `WS.forgetAll(...)`) is still present and its file/line references still match the code; correct any line numbers that have moved.
    - Verified: file present. All references still accurate — `socket_base.js:335` (`forgetStream` definition), `:355` (returned in object literal), `:352`/`:380-381` (return-literal span incl. `cache`/`storage` delegateToObject), and the three callers `socket-general.js:108`, `portfolio-store.js:123`, `contract-replay-store.js:49`. No line numbers moved; no edit needed.
