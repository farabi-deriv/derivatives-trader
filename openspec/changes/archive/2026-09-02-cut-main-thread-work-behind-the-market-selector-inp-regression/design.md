## Context

See `proposal.md` — Why for the INP regression evidence and root cause. Two hot spots on the market-selector mount path do redundant main-thread work:

- `packages/trader/src/AppV2/Utils/sort-symbols-utils.ts` — `getSubmarketDisplayName()` builds a 28-entry object with 28 `localize()` calls, and the comparator calls it twice per comparison. So an O(n log n) sort performs O(n log n) map builds.
- `packages/trader/src/AppV2/Hooks/useAvailableContracts.ts` — needs only a per-trade-type "has ≥1 symbol?" answer but routes through `useAllTradeTypeSymbols`, which builds and **sorts** a full symbol list per trade type. The `useMemo` cost is paid once per mounted consumer (six mounts: `MarketTabs`, `TradeTypeTabs`, `MarketSelectionSidebar`, `positions-content`, `Guide`, `useMarketSelection`).

Constraints that shape the approach:

- `sortSymbols` output must stay **byte-identical** — existing ordering specs pass unmodified, and `useAllTradeTypeSymbols` (search-view grouping) still depends on it.
- `localize()` resolves against the runtime-active language, and the user can switch language without reload; anything localized must be recomputed per call, not frozen at import.
- The availability lookup must keep sharing React Query's cache with `useAllTradeTypeSymbols` (identical query keys) so it adds zero network requests.

## Goals / Non-Goals

**Goals:**

- Remove per-comparison localized-map construction from the sort while preserving order exactly.
- Give `useAvailableContracts` a count-only availability source that skips sorting and list retention.
- Keep every documented behaviour of `useAvailableContracts`: eager page-mount warm-up, fail-open-while-loading, fail-open-on-empty, and identical filtering/ordering.

**Non-Goals:**

- Changing `useAllTradeTypeSymbols` or the search-view grouping it powers.
- Gating the availability lookup behind selector-open (explicitly forbidden — it causes the collapse-on-open bug).
- Any UI, visual, rendered-output, store, routing, or API change.
- Introducing a runtime performance benchmark; the localize-call-count guard is the proxy for the sort cost.

## Decisions

- **Decorate-sort-undecorate in `sortSymbols`, with the display-name map built once per call.**
  Hoist the static `marketSortingOrder`/`marketOrderMap` to module scope (never localized, safe to freeze). Inside `sortSymbols`, build the localized submarket display-name map **once**, then map each symbol to `{ symbol, market_order, submarket_name }`, sort the decorated array on those precomputed keys, and map back to the original symbol objects. `market_order` uses `marketOrderMap[market] ?? symbolsList.length` to preserve the exact "unknown market sorts last" fallback. Early-return `symbolsList.slice()` for lengths < 2.
    - _Why not hoist the display-name map to module scope?_ `localize()` binds to the language active when it runs; a module-scope map freezes whichever language loaded the bundle and never updates on runtime language switch. A code comment must state this so it is not "optimized" later.
    - _Why decorate instead of a memoized `getSubmarketDisplayName`?_ A per-call local map is simpler (KISS), needs no cache-invalidation on language change, and removes the double-resolution-per-comparison entirely.

- **New `useTradeTypeAvailability` hook rather than a flag on `useAllTradeTypeSymbols`.**
  A focused hook returns `{ available_trade_type_ids: Set<string>, isLoading }`. It issues one `active_symbols` query per trade type via `useQueries`, built from the **same** payload shape as `useAllTradeTypeSymbols` (`active_symbols: 'brief'`, `contract_type: getApiContractTypesForTradeType(trade_type)`, same 5-minute `cacheTime`/`staleTime`, `keepPreviousData: true`) so query keys match exactly and the cache is shared — no extra requests. It adds an id to the set iff `results[index]?.data?.active_symbols?.length`. It never calls `sortSymbols` and never keeps the lists.
    - _Why a separate hook, not a parameter?_ Keeps `useAllTradeTypeSymbols` untouched for the search view (YAGNI on a branching flag), and keeps each hook's return type honest (`Set` for "which are available" vs `Map` for "the sorted lists").

- **Memoize the set against a `data_signature`.** `useQueries` returns a fresh `results` array every render, so the set is memoized on `trade_types` + the joined `dataUpdatedAt` stamps (the same technique `useAllTradeTypeSymbols` uses), changing only when a query actually lands new data.

- **`useAvailableContracts` filters with `available_trade_type_ids.has(contract.id)`.** Replaces `symbols_by_trade_type.get(contract.id)?.length`. Both fail-open branches (`isLoading` → full list; empty result → full list) and the eager mount call are preserved verbatim.

## Risks / Trade-offs

- **Ordering drift from the rewrite** → The two existing `sortSymbols` ordering specs run unmodified as the guard; the decorate step copies `market`/`submarket` semantics 1:1 including the `length` fallback rank. Any drift fails those specs.
- **Someone re-hoists the display-name map to module scope for "perf"** → A pointed code comment plus the new `localize`-call-count regression spec (≤ 28 for a ~200-symbol sort) both document and enforce the constraint; hoisting would break the language-switch behaviour, not the count guard, so the comment is the primary defence.
- **Query-key divergence would double network traffic** → Build the `useQueries` items from the identical payload shape and options as `useAllTradeTypeSymbols`; keys are derived from `{ name, payload }`, so identical payloads guarantee cache sharing. Covered by keeping the payload construction structurally identical.
- **The availability spec mock drifts from the real hook** → Update `useAvailableContracts.spec.tsx` to mock `useTradeTypeAvailability` returning a `Set` with the same "cached reference across renders" behaviour the current mock provides, so the memoization assertions stay meaningful.

## Migration Plan

- Pure in-place refactor across three files plus two test files; no data migration, no feature flag, no config.
- Ship together so `useAvailableContracts` and its updated spec move in lockstep with the new hook.
- Rollback: revert the three source files and two test files; there is no persisted state or schema to unwind.

## Open Questions

- None blocking. The realistic-load figures in the proposal are illustrative estimates, not an asserted benchmark; the enforced guarantee is the `localize`-call-count guard plus identical ordering.
