# Cross-store sell-flow dedup (SMC-017) deferred

**What was deferred:** de-duplicating the near-duplicate `onClickCancel`/`onClickSell`/`handleSell` trio in `packages/core/src/Stores/portfolio-store.js` and `packages/core/src/Stores/contract-replay-store.js` behind one shared helper.

**Why:** the two implementations diverge semantically, so a single shared helper could only reproduce both behaviours behind conditionals — a branch-heavy merge, not a true dedup — and there is **no** existing test coverage for either sell/cancel flow to prove behaviour is preserved on this trading-critical path. Per SMC-017's guarded resolution ("extract only if behaviour is provably preserved; otherwise leave both and file a deferral"), the dedup is left undone. Concrete divergences:

- **State model:** portfolio tracks per-position `positions[i].is_sell_requested` via `getPositionIndexById` (array index); contract-replay uses a single `this.is_sell_requested`.
- **`bid_price` handling:** portfolio converts to number and guards with `isNaN`, logging and resetting `is_sell_requested` on a bad conversion; contract-replay passes the raw `bid_price` to `WS.sell`.
- **Notification gating:** portfolio gates the `contractCancelled()`/`contractSold(...)` notifications on `window.location.pathname !== routes.index || !ui.is_mobile`; contract-replay adds them unconditionally.
- **Guards / error logging:** portfolio has a `i === -1` position-not-found guard and multiple `console.error` diagnostics with state reset; contract-replay has neither, and its `onClickCancel` has no `is_sell_requested` guard at all.

The dead write-only `sell_info` that SMC-017 said to drop rather than reproduce **was** removed from both stores (and contract-store) under SMC-016 (task 9.4) — only the flow dedup is deferred.

**Follow-up required:** before merging the trio, add test coverage for both sell/cancel flows (success, error, cancel; mobile vs desktop; on- vs off-trade-page notification gating; numeric vs raw `bid_price`), then extract a shared helper parameterised by (a) the position/state accessor (`positions[i].is_sell_requested` vs `is_sell_requested`), (b) the `bid_price` source + numeric validation, and (c) the notification-gate predicate — verifying the portfolio-specific `sell_notifications` de-dup, `addNotificationBannerCallback`, position-index lookups and mobile gating are unchanged, and the shared success path (`WS.sell`/`WS.cancelContract`, `clearAccumulatorBarriersData`, `contractSold`, the `ce_reports_form_v2 close_contract` analytics event) is preserved for both.
