## Why

Inside the **Derived** market category (`market: 'synthetic_index'`) the submarket sections render in an order nobody chose:

- `sortSymbols` (`packages/trader/src/AppV2/Utils/sort-symbols-utils.ts:73`) breaks a same-market tie with `submarket_name.localeCompare(...)`, where `submarket_name` is the **localized display name** (built at `sort-symbols-utils.ts:31-58`). Within Derived that yields alphabetical sections — and it is locale-dependent, so switching the UI language can reorder the list.
- `groupSymbolsForList` (`packages/trader/src/AppV2/Utils/market-selection-utils.ts:95`) then renders the Derived subgroup sections with `DERIVED_SUBGROUP_ORDER = ['baskets', 'synthetics']`, putting both basket sections **above** every synthetics section.

Today (English) a Derived list reads: _Baskets_ → Commodities basket, Forex basket; _Synthetics_ → Crash/Boom, Daily reset indices, Jump indices, Range break indices, Step indices, Volatility indices.

GitHub issue [#994](https://github.com/deriv-com/derivatives-trader/issues/994) requires one fixed, language-independent order, identical for every trade type and on both Web (desktop) and Responsive (mobile). The seeded requirement supersedes the six-item list in the issue body: the authoritative order is **Volatility indices, Step indices, Jump indices, Crash/Boom, Daily reset indices, Forex basket, Gold (commodities) basket** — items 1-5 are the `synthetics` subgroup, items 6-7 the `baskets` subgroup.

## What Changes

- **Add one ordering table as the single source of truth** for Derived section order: a new `packages/trader/src/AppV2/Utils/market-ordering-utils.ts` holding an ordered list of `{ subgroup, submarkets }` entries — `synthetics` (`random_index`, `step_indices`/`step_index`, `jump_indices`/`jump_index`, `crash_boom`/`crash_index`, `random_daily`) then `baskets` (`basket_forex`/`forex_basket`, `basket_commodities`/`commodity_basket`) — plus the rank helpers derived from it. Every alias pair the display maps already carry gets the same rank, so it does not matter which key the API sends.
- **`sortSymbols` orders Derived submarkets by curated rank instead of localized name.** Within a market, a symbol whose submarket key has a curated rank sorts by that rank, ahead of every submarket with no curated rank. Submarkets with no curated rank (e.g. `range_index`, "Range break indices", and every non-Derived submarket) keep the existing `localeCompare` fallback among themselves, so no non-Derived market's ordering changes and no symbol disappears.
- **`groupSymbolsForList` derives its Derived subgroup order from the same table**, flipping the rendered sections to `synthetics` then `baskets`. The constant `DERIVED_SUBGROUP_ORDER` stops being hand-maintained in a second place, which is what let the two mechanisms disagree.
- **A guard test asserts the two consumers cannot drift**: the subgroup sequence implied by the curated submarket order must equal the subgroup order used to render sections.
- No change to the market-level order, the category chips (`MARKET_CATEGORY_ORDER`), the relative order of symbols within a submarket, the favourites/search grouping, or any display label.

## Capabilities

### New Capabilities

- `derived-market-ordering`: The fixed, language-independent order in which the market selector presents the Derived market's subgroup sections and submarket sections, how submarket-key aliases are treated as one section, and how uncurated Derived submarkets are placed without being dropped. Applies to every trade type and both breakpoints, which share `MarketSelectionList`.

### Modified Capabilities

None under `openspec/specs/`. Note the overlap with the **unmerged** change `cut-main-thread-work-behind-the-market-selector-inp-regression`, which proposes a `symbol-sort-order` capability whose first requirement states that same-market symbols order "alphabetically by the localized submarket display name". That clause becomes false for Derived once this change lands. It cannot be expressed as a `MODIFIED Requirements` delta here, because `openspec/specs/symbol-sort-order/spec.md` does not exist yet and `openspec archive` aborts on a MODIFIED delta with no target spec (verified locally). The reconciliation is tracked in `docs/spec-to-pr/deferrals/symbol-sort-order-spec-reconciliation.md` and as a conditional step in `tasks.md`.

## Impact

- **Code**
    - `packages/trader/src/AppV2/Utils/market-ordering-utils.ts` — **new**. The ordered `{ subgroup, submarkets[] }` table plus `getDerivedSubmarketRank(submarket)` / `getDerivedSubgroupRank(subgroup)` / `DERIVED_SUBGROUP_ORDER`. Standalone (no store or component imports) so `sort-symbols-utils.ts` can import it without a cycle — `npm run check-imports` covers this.
    - `packages/trader/src/AppV2/Utils/sort-symbols-utils.ts` — decorate each symbol with a curated submarket rank; comparator becomes market rank → submarket rank → existing `localeCompare` fallback. The per-call localized map stays (it still feeds the fallback), so the INP guard test at `__tests__/sort-symbols-utils.spec.ts:180-209` keeps passing.
    - `packages/trader/src/AppV2/Utils/market-selection-utils.ts` — `DERIVED_SUBGROUP_ORDER` is imported from the new table rather than declared at line 95.
- **Surfaces reached** (verified): both `market-selection-desktop.tsx` and `market-selection-mobile.tsx` render `MarketSelectionList` → `groupSymbolsForList`, and both get their symbols from `useTradeTypeSymbols`, which is the only caller of `sortSymbols` for the list (`useAllTradeTypeSymbols` is the second, feeding search). So one central fix covers Web and Responsive for every trade type, plus the search view.
- **Tests**
    - New: `packages/trader/src/AppV2/Utils/__tests__/market-ordering-utils.spec.ts`.
    - Updated: `packages/trader/src/AppV2/Utils/__tests__/market-selection-utils.spec.ts:122` (asserts `['baskets', 'synthetics']`) and `packages/trader/src/AppV2/Utils/__tests__/sort-symbols-utils.spec.ts` (gains Derived-order coverage; its two existing market-order cases use no two Derived submarkets, so they stay green).
- **Dependencies / APIs**: none. Pure client-side ordering; no request or response shape changes.
- **Out of scope**
    - Non-Derived submarket sections keep ordering by localized display name, so they stay locale-dependent — deferred, see `docs/spec-to-pr/deferrals/non-derived-submarket-locale-ordering.md`.
    - `categorizeSymbols` in `symbol-categories-utils.ts:130-145` has its own `submarket_display_name.localeCompare` sort, but it is referenced only by its own spec file — no production caller — so it is left untouched.
    - The chart's own symbol list: `Modules/SmartChart/Adapters/transformers.ts` only enriches display names; section ordering there is internal to `@deriv-com/smartcharts-champion`.
    - `DiscoveryView` is unreachable (`useMarketSelection.ts` hardcodes `show_discovery = false`), and the favourites view groups by trade type then favourite order — neither presents Derived submarket sections.
- **PR**: the description must include `Closes #994` and manual test steps (previous vs expected order, per surface, across more than one trade type).
