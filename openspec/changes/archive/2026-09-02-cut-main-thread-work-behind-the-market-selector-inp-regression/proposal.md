## Why

Interaction to Next Paint (INP) on the DTrader web app regressed from ~408 ms to ~1120 ms (p75) starting with the `production_V20260813_0` rollout (hourly p75 jumped 440 → 564 → 1032 ms between 08:00–10:00 UTC on 2026-08-13). PostHog `$web_vitals` isolates it to `dtrader.deriv.*` only — every other Deriv host is flat over the same window with the same users and browsers, and only INP moved (LCP/FCP/CLS unchanged) — so this is application interaction-handling code, not the browser, bundle size, or startup. The interaction users feel it on is tapping the market tab to open the market selector, and the AppV2 shell routes that mount the market strip (`/`, `/automate`, `/positions`, `/menu`) took the hit while `/reports/*` barely moved. Both mobile and desktop regressed; mobile is worse because the cost is main-thread JavaScript and mobile CPUs are slower.

The root cause is two independent chunks of redundant main-thread work on the path that runs when the market selector mounts:

1. **`sortSymbols` rebuilds a localized name map inside the sort comparator.** `getSubmarketDisplayName()` constructs a 28-entry object and makes 28 `localize()` calls on every invocation, and it is invoked twice per comparison. An O(n log n) sort drags O(n log n) map constructions along — ~39,000 `localize()` calls for a single ~100-symbol sort — and the selector sorts the symbol list of every trade type.
2. **`useAvailableContracts` sorts symbol lists it never reads.** It only asks "does this trade type return at least one symbol?" (a count) but goes through `useAllTradeTypeSymbols`, which builds and sorts a full symbol list per trade type. The cost is paid once per mounted consumer — `useAvailableContracts` mounts from six places at once (`MarketTabs`, `TradeTypeTabs`, `MarketSelectionSidebar`, `positions-content`, `Guide`, `useMarketSelection`) — because React Query dedupes the network request but each hook instance runs its own `useMemo`.

## What Changes

- Rewrite `sortSymbols` (`packages/trader/src/AppV2/Utils/sort-symbols-utils.ts`) to precompute sort keys once per call instead of resolving them inside the comparator: hoist the static market-order map to module scope, build the localized submarket display-name map once per `sortSymbols` call (NOT at module scope — `localize()` must resolve against the runtime-active language), decorate each symbol with `market_order` + `submarket_name`, sort on those, then map back. Ordering must be **byte-identical** to today; existing ordering specs pass unmodified.
- Add a new hook `useTradeTypeAvailability` (`packages/trader/src/AppV2/Hooks/useTradeTypeAvailability.ts`) that answers availability only — one `active_symbols` query per trade type via `useQueries`, server-filtered by `contract_type`, with query keys **identical** to `useAllTradeTypeSymbols` (so React Query's cache is shared and no extra network requests are issued) — and returns `{ available_trade_type_ids: Set<string>, isLoading: boolean }` without sorting or retaining symbol lists.
- Switch `useAvailableContracts` (`packages/trader/src/AppV2/Hooks/useAvailableContracts.ts`) from `useAllTradeTypeSymbols` to `useTradeTypeAvailability`, filtering with `available_trade_type_ids.has(contract.id)`. Keep the eager warm-up at page mount, keep both fail-open behaviours, keep symbol ordering identical.
- Leave `useAllTradeTypeSymbols` unchanged — `useMarketSelection` still needs its sorted per-trade-type grouping for the search view.
- Add a regression guard to the `sortSymbols` spec asserting `localize` is called ≤ 28 times for one sort of a ~200-symbol list, and update the `useAvailableContracts` spec to mock `useTradeTypeAvailability` (a `Set`) instead of `useAllTradeTypeSymbols` (a `Map`).
- No UI, visual, or rendered-output changes.

## Capabilities

### New Capabilities

- `symbol-sort-order`: The deterministic, locale-aware ordering of the market symbol list produced by `sortSymbols`, and the bound on redundant localization work performed per sort.
- `trade-type-availability`: How the trade-type list is filtered to what the server actually offers a client — availability is a count question, is fail-open, and shares the symbol-fetch cache so it adds no network requests.

### Modified Capabilities

<!-- None. No existing spec under openspec/specs/ (contract-details-chart, duration-end-time-fields, market-descriptions, positions-drawer) covers symbol sorting or trade-type availability. -->

## Impact

- Affected code:
    - `packages/trader/src/AppV2/Utils/sort-symbols-utils.ts` — rewrite comparator to precompute keys (behaviour-preserving).
    - `packages/trader/src/AppV2/Hooks/useTradeTypeAvailability.ts` — **new** count-only availability hook.
    - `packages/trader/src/AppV2/Hooks/useAvailableContracts.ts` — consume `useTradeTypeAvailability`.
- Affected tests:
    - `packages/trader/src/AppV2/Utils/__tests__/sort-symbols-utils.spec.ts` — existing ordering assertions unchanged; add a `localize`-call-count regression guard.
    - `packages/trader/src/AppV2/Hooks/__tests__/useAvailableContracts.spec.tsx` — swap the mocked dependency to `useTradeTypeAvailability` returning a `Set`; all existing assertions (fail-open, memoization, filtering) keep passing.
- Unchanged: `useAllTradeTypeSymbols` and its consumers (`useMarketSelection`, market search views). No API, dependency, store, data-model, routing, or rendered-UI changes. React Query network traffic is unchanged (shared query keys).
- Expected result: on a realistic load (10 trade types × ~100 symbols × 4 mounted consumers) the sorting work drops from ~12.6 ms / 750,400 `localize()` calls to ~1.1 ms / 1,120 calls with identical ordering; INP p75 for `dtrader.deriv%` should trend back toward the pre-13-August ~408 ms baseline.
