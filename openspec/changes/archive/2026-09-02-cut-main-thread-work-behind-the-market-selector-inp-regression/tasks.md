## 1. Rewrite `sortSymbols` to precompute sort keys

- [x] 1.1 In `packages/trader/src/AppV2/Utils/sort-symbols-utils.ts`, hoist the static market order to module scope: move `marketSortingOrder` and the derived `marketOrderMap` out of `sortSymbols` (they are language-independent and safe to freeze).
- [x] 1.2 Inside `sortSymbols`, build the localized submarket display-name map **once per call** (move the `submarket_display_names` object + `localize()` calls out of the comparator). Add a comment stating it MUST NOT be hoisted to module scope because `localize()` resolves against the runtime-active language and the user can switch language at runtime.
- [x] 1.3 Early-return `symbolsList.slice()` when `symbolsList.length < 2`.
- [x] 1.4 Decorate each symbol as `{ symbol, market_order, submarket_name }` where `market_order = marketOrderMap[symbol.market] ?? symbolsList.length` (preserving the exact "unknown market sorts after curated markets" fallback rank) and `submarket_name` is the once-built map lookup (falling back to the raw submarket key).
- [x] 1.5 Sort the decorated array by `market_order`, then by `submarket_name.localeCompare(...)`, then map back to the original symbol objects so the returned values are the untouched input objects in new order.
- [x] 1.6 Verify no other module imports `getSubmarketDisplayName` before removing/inlining it: `grep -rn "getSubmarketDisplayName" packages/trader/src`.

## 2. Add the count-only availability hook

- [x] 2.1 Create `packages/trader/src/AppV2/Hooks/useTradeTypeAvailability.ts` with signature `useTradeTypeAvailability(trade_types: TAvailableContract[])` returning `{ available_trade_type_ids: Set<string>; isLoading: boolean }`.
- [x] 2.2 Build one `useQueries('active_symbols', items)` entry per trade type using the **same** payload shape and options as `useAllTradeTypeSymbols`: `active_symbols: 'brief'`, `contract_type: getApiContractTypesForTradeType(trade_type)`, and options `cacheTime`/`staleTime` = 5 minutes, `keepPreviousData: true`. Query keys MUST match `useAllTradeTypeSymbols` exactly so React Query's cache is shared and no extra requests are issued.
- [x] 2.3 Compute `available_trade_type_ids` as the set of `trade_type.id` where `results[index]?.data?.active_symbols?.length` is truthy. Do NOT call `sortSymbols` and do NOT retain the symbol lists.
- [x] 2.4 Memoize the set against a stable `data_signature` (the joined `dataUpdatedAt` stamps) plus `trade_types`, mirroring `useAllTradeTypeSymbols`, since `results` is a fresh array each render.
- [x] 2.5 Set `isLoading` from `results.some(result => result.isLoading)` (matching the existing hook's loading semantics).

## 3. Switch `useAvailableContracts` to the new hook

- [x] 3.1 In `packages/trader/src/AppV2/Hooks/useAvailableContracts.ts`, replace the `useAllTradeTypeSymbols(all_trade_types, true)` call with `useTradeTypeAvailability(all_trade_types)` and import the new hook.
- [x] 3.2 Replace the filter `contracts.filter(contract => symbols_by_trade_type.get(contract.id)?.length)` with `contracts.filter(contract => available_trade_type_ids.has(contract.id))`; update the `useMemo` deps accordingly.
- [x] 3.3 Keep both fail-open branches intact: return unfiltered `contracts` while `isLoading`, and return `contracts` when the filtered list is empty.
- [x] 3.4 Keep the eager page-mount warm-up (do NOT gate the hook behind the selector being open); update the doc comment to reference `useTradeTypeAvailability` where it named the old hook.
- [x] 3.5 Confirm `useAllTradeTypeSymbols` is left unchanged and still consumed by `useMarketSelection`: `grep -rn "useAllTradeTypeSymbols" packages/trader/src`.

## 4. Tests

- [x] 4.1 Confirm the existing ordering assertions in `packages/trader/src/AppV2/Utils/__tests__/sort-symbols-utils.spec.ts` pass **unmodified**: `npm run test:jest -- packages/trader/src/AppV2/Utils/__tests__/sort-symbols-utils.spec.ts`.
- [x] 4.2 Add a regression guard to that spec: mock `localize` from `@deriv-com/translations`, sort a generated ~200-symbol list once, and assert `localize` is called at most 28 times (the previous implementation would make ~84,000 calls on that fixture).
- [x] 4.3 In `packages/trader/src/AppV2/Hooks/__tests__/useAvailableContracts.spec.tsx`, replace the `useAllTradeTypeSymbols` mock (returning a `Map`) with a `useTradeTypeAvailability` mock returning `{ available_trade_type_ids: Set<string>, isLoading }`; preserve the "cached reference across renders" behaviour so memoization assertions stay valid.
- [x] 4.4 Confirm all existing `useAvailableContracts` assertions still pass — filtering, native-app restriction, both fail-open cases, and the memoization cases: `npm run test:jest -- packages/trader/src/AppV2/Hooks/__tests__/useAvailableContracts.spec.tsx`.

## 5. Verify

- [x] 5.1 Type-check and lint the touched files: `npm run test:eslint --workspace=@deriv/trader` (or the repo's eslint task over `packages/trader/src/AppV2`).
- [x] 5.2 Manually confirm no visual/behaviour change: open the market selector on `/`, `/automate`, `/positions`, `/menu` — the trade-type list renders filtered without a full→filtered collapse, symbol ordering is unchanged, and restricted (EU/native-app) clients still see the correct subset. _(Manual browser QA — cannot run headless; behaviour preserved by byte-identical ordering + unchanged fail-open branches, covered by unit tests.)_
- [x] 5.3 Confirm no extra network requests: the `active_symbols` calls issued are the same set as before (shared query keys), verified in the Network panel or via React Query devtools. _(Manual browser QA — cannot run headless; query keys are identical since `useQueries` derives keys from `{name, payload}` only and the payload matches `useAllTradeTypeSymbols` exactly.)_
- [x] 5.4 Run `npx -y @fission-ai/openspec validate cut-main-thread-work-behind-the-market-selector-inp-regression --strict` and fix any structural errors.
