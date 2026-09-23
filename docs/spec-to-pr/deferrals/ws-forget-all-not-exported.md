# `WS.forgetAll` is called but never exported

**What was deferred:** Fixing the three production call sites that invoke `WS.forgetAll(...)` on an object that has no such method.

`WS` resolves to `BinarySocketBase` — `packages/core/src/Services/ws-methods.js` is `const WS = BinarySocket; export default WS;`, and `packages/core/src/App/app.jsx:64` feeds exactly that object to `setWebsocket(WS)`, which is what `@deriv/shared`'s `WS` re-exports. `packages/core/src/_common/base/socket_base.js` exports `forgetStream` (line 335/355) and nothing else forget-shaped; the underlying `deriv_api.forgetAll(...msg_types)` is never surfaced. The returned object literal at `socket_base.js:352-400` contains no `forgetAll` key, and the `delegateToObject` proxy is only applied to `cache` and `storage`, so nothing fills the gap at runtime.

Callers that would therefore throw `TypeError: WS.forgetAll is not a function`:

- `packages/core/src/Services/socket-general.js:108` — `WS.forgetAll('balance').then(subscribeBalance)` on a `WrongResponse` error for `balance`.
- `packages/core/src/Stores/portfolio-store.js:123` — `WS.forgetAll('proposal_open_contract', 'transaction')` when clearing the positions table after having subscribed.
- `packages/core/src/Stores/contract-replay-store.js:49` — `await WS.forgetAll('proposal_open_contract')` on the replay store's first subscription.

Every existing test of these paths mocks `WS.forgetAll` as a `jest.fn()`, so the suite is green and the defect is invisible to CI.

**Why:** This change is scoped to the chart's `ticks_history` quote streams on the SmartCharts adapter path (`packages/trader/src/Modules/SmartChart/`). The `forgetAll` defect sits in `@deriv/core` and concerns `balance`, `proposal_open_contract` and `transaction` subscriptions — a different package, different subscription types, and a different blast radius (restoring the method changes what actually gets torn down on logout, account switch and replay entry, which needs its own red tests and its own QA pass).

**Follow-up required:**

1. Decide the contract: either export `forgetAll` from `socket_base.js` as `(...msg_types) => deriv_api.forgetAll(...msg_types)`, or remove the three call sites and replace them with targeted `forgetStream(id)` teardowns owned by whoever holds the subscription.
2. If exporting: confirm the behaviour each call site actually wants. `deriv_api.forgetAll(msg_type)` completes **every** subscription of that message type across the app, which is exactly the cross-store damage that `packages/reports/src/Stores/Modules/Profit/profit-store.js:158` and `packages/reports/src/Stores/Modules/Statement/statement-store.js:205` already carry comments warning about (they deliberately do _not_ call it, to avoid killing the trade store's live proposals).
3. Write tests that do not mock `forgetAll` into existence — assert against the real `socket_base` surface, so a missing export fails the suite instead of passing it.
4. Audit the remaining `WS.*` call sites for the same class of error (a method name that exists on `DerivAPIBasic` but was never re-exported by `socket_base.js`).

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1480
