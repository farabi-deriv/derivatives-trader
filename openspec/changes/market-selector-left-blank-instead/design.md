## Context

Automate keeps its **own** tab collection (`open_markets_automation`), separate from manual. On first entry nothing pre-populates it by design: `reconcileTradeModeMarket` no-ops when the automation collection is empty with no remembered market, and `recordActiveMarketTab()` returns early in automation mode. The **only** thing that creates that first tab is the seed effect in `packages/trader/src/AppV2/Components/MarketTabs/market-tabs.tsx` (~L138-185).

That seed is destroyed exactly once per store instance — on the first strip mount that hands the store a _new_ supported-set reference:

1. The seed effect latches `has_added_default_ref.current = true` **before** `await pickDefaultSymbol(...)` (L163-164).
2. The effect above it (L130-132) calls `setAutomationSupportedTradeTypes`, which routes through `setActiveOpenMarkets` (`trade-store.ts` L1278-1292). In automation mode that writer builds `guarded` via `next.filter(...)`, which **allocates a new array on every call even when nothing is filtered out** (L1285).
3. Reassigning the observable invalidates the `open_markets` computed → the observer re-renders → the seed effect's `open_markets` dependency changes → cleanup runs → `is_cancelled = true`.
4. The effect re-runs, hits `if (has_added_default_ref.current) return`, and returns. The ref is only reset when a supported tab is already active or the supported set is empty — neither now happens.
5. `pickDefaultSymbol` resolves with a valid symbol and it is discarded (guarded by `!is_cancelled`).

Additionally the async IIFE has no `.catch()`, so a failed commit produces an unhandled rejection **and** leaves the latch on forever.

Every other path (second entry, strategies refetch, remembered supported market, restored persisted collection) supplies a tab by other means and masks the bug — which is why it looked intermittent. The one exception that also fails: a remembered automate pair **equal to** the carried-over pair (reconciler makes no call). The seed is load-bearing, not a rare fallback.

## Goals / Non-Goals

**Goals:**

- On first Automate entry with an empty automate collection, always seed one supported default market as the active tab (spec `MT-005`).
- Make the seed immune to observable-churn cancellation (`MT-006`) and to commit failure, with retries bounded per Automate visit (`MT-007`).
- Stop the open-markets writer from churning observers on a no-op write (`MT-008`).

**Non-Goals:**

- Surfacing a failed or empty `auto_list_strategies` response (a different trigger for a similar symptom) — deferred, see `docs/spec-to-pr/deferrals/auto-list-strategies-error-surfacing.md`.
- Any change to manual mode, the active-run–locked strip, or the mode-flip reconciler.

## Decisions

**Decision 1 — Land both fixes (A and B), not one.** Each alone fixes every failing scenario in the verified matrix; the analysis recommends both because they address different layers. **A** (writer short-circuit) removes one churn source and is a general correctness/perf win on every add/remove/replace/restore path; **B** (seed effect) makes the seed immune to churn from _any_ source, present or future. Landing only one would leave the seed brittle to a second churn source. Alternative considered: reorder the seed to latch _after_ the await — rejected because a second concurrent effect run could then start a duplicate pick before the first commits; the ref-as-"one-seed-in-flight" guard is the right primitive, it just must survive an interrupted run.

**Decision 2 — Element-wise equality for the writer short-circuit (fix A).** Compare the resulting list against the current collection position by position; if equal, return without reassigning or re-persisting. Applied to **both** branches — the automation one (where `next.filter(...)` fabricates a new equal array) and the manual one, matching `MT-008`'s scope of "the active open-markets writer" and pre-empting the same bug class in manual mode. The comparison is an exported helper, `isSameOpenMarketList` in `AppV2/Utils/open-markets-utils.ts` beside `isSameMarket`, rather than a closure defined inside `setActiveOpenMarkets` — that writer is on every add/remove/replace path, and the helper is independently unit-testable. Alternative considered: reference-equality only — insufficient, because `filter` always yields a fresh reference even when nothing is filtered out, which is exactly the no-op that triggers the bug.

**Decision 3 — Drop the `is_cancelled` gate on the seed commit and add `.catch()` (fix B).** The commit targets the app-level MobX store, not React state, so a write that lands after the component's cleanup is harmless; and `selectMarketAndTradeType` already dedupes an existing category-sibling tab, so a late commit cannot create a duplicate. The commit is `await`ed so a rejection reaches the `.catch()`, which resets `has_added_default_ref.current = false` so a failed seed can retry on a later run. The `is_cancelled` flag and the effect's cleanup return were removed outright — nothing else read them.

**Decision 4 — Regression tests assert on the FIRST entry.** A test written against a _second_ Automate entry (or a session with a remembered/ restored tab) passes even with the bug present — this is precisely how it escaped QA. The component test must reproduce the empty-collection first entry and the "remembered pair equals carried pair" case.

**Decision 5 — Bound the retry at three attempts per visit (`MAX_SEED_ATTEMPTS`).** Releasing the latch in the `.catch()` makes the seed retryable, but also unbounded: `selectMarketAndTradeType`'s own failure path calls `removeOpenMarket(next_market)`, which mutates `open_markets` and so re-runs this very effect — a persistently failing commit (dead WebSocket) would retry on every churn, re-issuing a `pickDefaultSymbol` (and its `contracts_for`) each time. A `seed_attempts_ref` budget spent alongside the latch caps that at three, and is reset in the same two branches that reset the latch (a supported market becomes active, or `supported_trade_types` is cleared when Automate is left). Consequence, accepted deliberately: with the budget spent the strip stays blank **for that visit** — the original #1071 symptom, bounded. That is tolerable because three consecutive failures mean the connection is down, in which case the whole trade page is already degraded and `useActiveSymbols` surfaces its own error; and because both refs reset on leaving/re-entering Automate, so the blank state never outlives a visit. Alternatives considered: (a) retry on a meaningful signal instead of on churn (network status returning online, `active_symbols` reloading) — cleaner in principle, but needs the effect's dependency list rethought and is a larger change than #1071 warrants; (b) no cap at all — rejected, it trades a permanent blank strip for a hot retry loop against a dead socket. Routing the exhausted state into a visible error surface belongs with the deferred `auto_list_strategies` work, which needs the same "Automate can't load" affordance.

**Decision 6 — Gate the commit on the LIVE mode, not a captured or ref-mirrored value.** Removing the `is_cancelled` gate (Decision 3) dropped protection for two different situations, not one: benign churn within a visit (the bug) _and_ the user genuinely leaving Automate (needed). The commit therefore re-reads `trade_store.is_automation_mode` at commit time and bails if Automate has been left. A ref mirroring the latest `supported_trade_types` prop — the reviewer's suggestion — was tested and is **insufficient**: refs only update on render, and leaving Automate on mobile unmounts the strip, so the ref keeps its stale value and the commit still corrupts manual state. Reading the store covers unmount and desktop panel-switch alike because it reflects app state rather than component lifecycle.

## Risks / Trade-offs

- **[A late store commit lands after the user navigated away from Automate] → Mitigation:** `MAX_SEED_ATTEMPTS` does not help here; the commit is gated on the live `is_automation_mode` (Decision 6). An earlier draft of this doc claimed manual mode was safe because "manual reads its own collection" — that was **wrong**, and PR review caught it: `setActiveOpenMarkets` picks its collection from the live mode, so the late commit lands _in_ manual's collection. Measured before the guard: manual went from `[{frxBOOM300, accumulator}]` to `[{frxBOOM300, accumulator}, {1HZ100V, rise_fall}]` and the active market was overwritten to `(1HZ100V, rise_fall)`.
- **[Element-wise equality is O(n) on every write] → Mitigation:** `n` is capped at `MAX_OPEN_MARKETS` (7 web / 4 mobile); the comparison is trivially cheap and strictly cheaper than the re-render cascade it prevents.
- **[Retrying the seed after a failure could loop if the commit keeps failing] → Mitigation:** `MAX_SEED_ATTEMPTS` (Decision 5) caps attempts at three per visit. Without it the loop is real, not theoretical: the failed commit's own rollback (`removeOpenMarket`) churns `open_markets`, which re-runs the effect, which the released latch now permits to retry. Verified: with the cap condition removed, five churn cycles produce six commit attempts; with it, three.

## Migration Plan

Pure client-side state fix; no data migration, no API contract change. Existing persisted `open_markets_automation_v2` values remain valid and are unaffected. Rollback is a straight revert of the three edited source files (`open-markets-utils.ts`, `trade-store.ts`, `market-tabs.tsx`).

## Open Questions

None that change the implementation. The two-part fix and its test placement are settled by the verified scenario matrix in the issue.
