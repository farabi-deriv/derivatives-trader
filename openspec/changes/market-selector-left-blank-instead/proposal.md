## Why

On the very first entry into **Automate** with an empty persisted automate tab collection (the state of any user who has never opened Automate on that browser profile — localStorage key `open_markets_automation_v2` absent), the market strip renders with **zero tabs** and no market is selected, while `symbol`/`contract_type` stay populated from manual mode. The state is permanent for that page load and never self-corrects ([#1071](https://github.com/deriv-com/derivatives-trader/issues/1071)). The strip's seed effect latches its "already seeded" guard _before_ awaiting `pickDefaultSymbol`, and a no-op reallocation in the trade store's open-markets writer invalidates the effect's dependencies and cancels the pending seed — which the latch then prevents from ever retrying.

## What Changes

- **`trade-store.ts` `setActiveOpenMarkets` (fix A):** skip the write when the resulting list is element-wise identical to the current collection, so a no-op write (e.g. `setAutomationSupportedTradeTypes` re-applying the guard when nothing is filtered out) stops reallocating the observable array and invalidating every observer. Applied to **both** collections (automation and manual), per `MT-008`'s "the active open-markets writer". The comparison lives in `AppV2/Utils/open-markets-utils.ts` as the exported `isSameOpenMarketList`, beside `isSameMarket`, rather than as a closure re-allocated on every write. Also a general correctness/perf win on every add/remove/replace/restore path.
- **`market-tabs.tsx` seed effect (fix B):** drop the `is_cancelled` gate on the async seed's commit and add the missing `.catch()` that releases the `has_added_default_ref` latch on failure. The commit targets the app-level MobX store (not React state, so a late write is harmless) and `selectMarketAndTradeType` already dedupes an existing category-sibling tab, so committing after a cleanup is safe. The ref stays as the "one seed in flight at a time" guard — its actual purpose.
- **`market-tabs.tsx` bounded retry (fix B, cont.):** because the `.catch()` releases the latch, a persistently failing commit would retry on every dependency change (`selectMarketAndTradeType`'s own failure path removes the optimistic tab, which itself churns `open_markets`). A `MAX_SEED_ATTEMPTS = 3` budget (`seed_attempts_ref`) bounds this; it is reset wherever the latch is, so leaving and re-entering Automate always starts with a fresh budget. When the budget is spent the strip stays blank **for that visit** — acceptable because three consecutive failures mean the connection is down, which the app surfaces separately (see Out of scope).
- **No behavior change** to: manual mode, an active-run–locked strip, a second Automate entry, a session with a remembered supported automate market, or a restored `open_markets_automation_v2` collection — all already seed a tab by other means.

## Capabilities

### New Capabilities

- `market-tabs`: The Trade page market strip's tab-identity and selection behavior. This change adds the **seed-on-first-Automate-entry** requirements (defaulting to a supported market when the automate collection is empty, and making that seed immune to observable-churn and commit failure). (Not yet present under `openspec/specs/`; the in-flight changes `replacing-active-tab-already-open-market` and `trade-type-and-market-switching-lacks-clear-visual-cues` add other `market-tabs` requirements — this delta continues the shared `MT-NNN` numbering from `MT-005`.)

### Modified Capabilities

<!-- None. No existing spec under openspec/specs/ covers the market-tabs seed behavior. -->

## Impact

- **Code**
    - `packages/trader/src/AppV2/Utils/open-markets-utils.ts` — new exported `isSameOpenMarketList(a, b)`: element-wise list equality by `(symbol, contract_type)`, beside `isSameMarket`.
    - `packages/trader/src/Stores/Modules/Trading/trade-store.ts` — `setActiveOpenMarkets` (~L1279-1297): short-circuit via `isSameOpenMarketList` in both branches before reassigning the observable and persisting.
    - `packages/trader/src/AppV2/Components/MarketTabs/market-tabs.tsx` — seed effect (~L140-186): remove the `is_cancelled` gate (and the now-dead cleanup) on the `selectMarketAndTradeType` commit inside the async IIFE, `await` the commit so a rejection reaches the new `.catch()`, and reset `has_added_default_ref.current = false` there. Adds a module-level `MAX_SEED_ATTEMPTS = 3` and a `seed_attempts_ref` budget, spent when the latch is set and reset in both branches that reset the latch.
- **Tests**
    - `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` — coverage for the no-op-write short-circuit (`setActiveOpenMarkets` / `setAutomationSupportedTradeTypes` leaves the same array reference and does not churn observers).
    - `packages/trader/src/AppV2/Utils/__tests__/open-markets-utils.spec.ts` — unit coverage for `isSameOpenMarketList` (fresh-but-equal arrays, empty lists, length mismatch, order sensitivity, content mismatch).
    - `packages/trader/src/AppV2/Components/MarketTabs/__tests__/market-tabs.spec.tsx` — a regression test asserting on the **first** Automate entry (empty automate collection) that a supported default tab appears and is active; and on the "remembered automate pair equals the carried-over pair" case. A test written against a _second_ entry would pass even with the bug present (which is how it escaped QA), so the assertion must be on the first entry. Plus the churn-survival, commit-rejection, retry-cap and budget-reset cases.
- **Dependencies / APIs**: none. Pure client-side tab-strip state fix; no server/API contract involved.
- **Surfaces**: mobile (`/automate` route) and desktop (Automate panel inside the Trade page) AppV2 — the strip and its store are shared.
- **Out of scope** (see `docs/spec-to-pr/deferrals/`): surfacing a failed/empty `auto_list_strategies` response (a different trigger for a similar blank-strip symptom; the screenshot shows populated strategy/risk fields, so strategies had loaded — not what #1071 reports).
