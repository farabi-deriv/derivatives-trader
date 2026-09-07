## Context

See `proposal.md` — Why. The design-relevant facts, all verified against `master` at `d31e3f1822`:

- **Two independent mechanisms produce the rendered Derived order.** `sortSymbols` (`AppV2/Utils/sort-symbols-utils.ts`) returns one flat, ordered symbol list; `groupSymbolsForList` (`AppV2/Utils/market-selection-utils.ts:103`) then buckets Derived symbols by `subgroup` and sorts those sections by the hand-written `DERIVED_SUBGROUP_ORDER` (line 95). Everything below the section level — `groupSymbolsBySubmarket` (line 70) — preserves **encounter order**, so the submarket order inside a section is entirely `sortSymbols`' output.
- **Both breakpoints share the path.** `market-selection-desktop.tsx` and `market-selection-mobile.tsx` both render `MarketSelectionList`, which calls `groupSymbolsForList`; both take `visible_symbols` from `useMarketSelection` → `useTradeTypeSymbols`, whose only ordering step is `sortSymbols`. `useAllTradeTypeSymbols` (search) also calls `sortSymbols`. These are the only two callers of `sortSymbols` outside `symbol-categories-utils.ts`.
- **`sortSymbols` was recently rewritten for INP** (unarchived change `cut-main-thread-work-behind-the-market-selector-inp-regression`): it decorates each symbol with precomputed sort keys and builds the localized submarket map once per call. The map **must** stay inside the function — `localize()` resolves against the runtime language. Its guard test caps `localize` calls at 28 per sort (`__tests__/sort-symbols-utils.spec.ts:180-209`), so the design must not add per-symbol localization.
- **`sortSymbols` is market-agnostic**; it sorts every market with the same comparator. Any change to the submarket tie-breaker is felt by Forex, Stock indices, Cryptocurrencies and Commodities too unless it is scoped.
- **Alias keys are real.** The display maps in `sort-symbols-utils.ts`, `market-selection-labels.tsx` and `symbol-categories-utils.ts` all carry both spellings for Step, Jump, Crash, Forex basket and Commodities basket, and `trade-params-preset-utils.ts:195-225` normalizes the same pairs — the API can send either.

## Goals / Non-Goals

**Goals:**

- One ordering definition that both the flat sort and the section grouping read, so they cannot drift (spec `DMO-007`).
- Locale-independent ordering for Derived, keyed on submarket keys (`DMO-002`).
- Bounded blast radius: nothing outside Derived's section order changes (`DMO-006`).
- Preserve the INP characteristics of the current `sortSymbols` — no new per-symbol or per-comparison work.

**Non-Goals:**

- Curating a submarket order for non-Derived markets. Their current order is produced by `localeCompare` on translated names and reproducing it exactly as a static list is guesswork; leaving them on the existing comparator is the only way to guarantee "unchanged".
- Removing `localeCompare` from `sortSymbols`. It stays as the fallback for every submarket with no curated rank.
- Touching `categorizeSymbols`, the chart adapter, the favourites view, or `DiscoveryView` (see proposal — Out of scope).

## Decisions

### D1 — A single ordered table of `{ subgroup, submarkets }`, in a new standalone module

`packages/trader/src/AppV2/Utils/market-ordering-utils.ts` exports one literal:

```ts
// Ordered Derived sections. Each entry's `submarkets` lists the alias spellings of ONE section;
// aliases share a rank, so it does not matter which key `active_symbols` sends.
const DERIVED_SECTION_ORDER = [
    {
        subgroup: 'synthetics',
        submarkets: [
            ['random_index'],
            ['step_indices', 'step_index'],
            ['jump_indices', 'jump_index'],
            ['crash_boom', 'crash_index'],
            ['random_daily'],
        ],
    },
    {
        subgroup: 'baskets',
        submarkets: [
            ['basket_forex', 'forex_basket'],
            ['basket_commodities', 'commodity_basket'],
        ],
    },
] as const;
```

Everything else is derived from it at module load: a flat `Map<string, number>` of alias key → rank, `getDerivedSubmarketRank(submarket)` returning that rank or `undefined`, and `DERIVED_SUBGROUP_ORDER = DERIVED_SECTION_ORDER.map(s => s.subgroup)` — the constant `market-selection-utils.ts` imports instead of declaring. That is what makes `DMO-007` structural rather than a convention, and it is the answer to "keep the ordering data-driven and in one place".

_Alternatives considered._ (a) Two separate constants with a comment telling maintainers to keep them in sync — that is exactly the arrangement that produced this bug. (b) Deriving the subgroup order dynamically from the symbols present (rank a subgroup by its lowest submarket rank) — correct in every realistic input but data-dependent, harder to reason about, and it produces no order at all for a subgroup whose submarkets are all uncurated. (c) Putting the table in `market-selection-utils.ts` and importing it into `sort-symbols-utils.ts` — rejected because `market-selection-utils.ts` imports `markets-store` and `trade-types-utils`, which would drag store code into the sort module and risk a cycle (`npm run check-imports` guards this).

The table is deliberately **not** keyed by market. Every key in it is a Derived submarket; a non-Derived submarket simply gets no rank. The helper is named `getDerivedSubmarketRank` so that stays obvious.

### D2 — Rank first, `localeCompare` second, inside the existing decorate-sort-undecorate

The comparator becomes: market rank → curated submarket rank → localized-name `localeCompare`. A symbol with a curated rank always sorts ahead of one without, within the same market. Concretely the decoration gains one field:

```ts
submarket_rank: getDerivedSubmarketRank(symbol.submarket) ?? CURATED_RANK_ABSENT,   // Number.MAX_SAFE_INTEGER
```

and the comparator compares `submarket_rank` before falling through to the existing `submarket_name.localeCompare(...)`.

This is the smallest change that satisfies `DMO-001`, `DMO-004` (uncurated Derived submarkets — `range_index` today — sort after every curated one in the flat list, then among themselves by name; `groupSymbolsForList` then drops each into whichever subgroup bucket its own `subgroup` field names, so it lands at the end of that section) and `DMO-006` (no non-Derived market has any curated rank, so every one of them falls straight through to today's comparator and is byte-identically ordered). It also keeps the INP guard green: `getDerivedSubmarketRank` is a `Map` lookup done once per symbol in the decoration pass, and no additional `localize()` call is introduced.

_Alternative considered:_ curate a rank for **all** 28 submarket keys and drop `localeCompare` entirely. Cleaner in principle and it would make every market locale-independent, but it silently rewrites Forex, Stock indices, Cryptocurrencies and Commodities section order — the constraint list explicitly forbids changing what the issue did not ask for. The residual non-Derived locale-dependence is recorded in `docs/spec-to-pr/deferrals/non-derived-submarket-locale-ordering.md`.

### D3 — Section order stays a defensive re-sort, now fed by the shared table

`groupSymbolsForList` keeps sorting its subgroup sections; only its rank source changes (imported `DERIVED_SUBGROUP_ORDER` instead of the local literal, with the array flipped to `['synthetics', 'baskets']` by construction). Once D2 lands, `sortSymbols` already emits synthetics before baskets, so the re-sort is usually a no-op — but `groupSymbolsForList` is an exported utility with its own spec file and is called with whatever list the caller holds, so it should not silently depend on an upstream sort. Keeping it also means the section order is directly unit-testable without going through `sortSymbols`.

`groupSymbolsBySubmarket` is deliberately **not** given a rank sort. It preserves encounter order by contract and is reused by `market-search-results.tsx`, where the incoming per-trade-type list is already `sortSymbols`-ordered and re-sorting would be redundant. One ordering authority, two consumers — not three.

### D4 — "Gold basket" is the commodities-basket submarket

Repo evidence: `packages/shared/src/utils/constants/contract.ts:459` maps `WLDXAU: 'Gold Basket'`, and `WLDXAU` carries `submarket: 'commodity_basket'` in the existing fixture at `__tests__/symbol-categories-utils.spec.ts:40-43`. No separate gold-basket submarket key appears anywhere in the codebase. The table therefore ranks `basket_commodities`/`commodity_basket` at position 7. A task re-verifies this against a live `active_symbols` response before shipping; if a distinct key turns up, only the table entry changes.

### D5 — Requirement `DMO-005` is satisfied structurally, not by per-trade-type code

The order is identical across trade types and breakpoints because there is exactly one code path: every tab's symbols come from the same `useTradeTypeSymbols` → `sortSymbols` pipeline, and both shells render the same `MarketSelectionList`. Nothing trade-type-specific is added. `DMO-005` is therefore verified manually (two trade types × two breakpoints) rather than by a unit test that would only re-assert D2.

## Risks / Trade-offs

- **A live `active_symbols` payload uses a submarket key not in the table** (a third spelling, or a new Derived submarket) → it falls through to `CURATED_RANK_ABSENT` and renders after the curated sections instead of disappearing (`DMO-004`). Adding it later is a one-line table edit. The alias-pair coverage is taken from the three display maps that already exist, so a spelling unknown to them would also render an unlabelled raw key today.
- **The INP guard test could regress** if the rank lookup were added inside the comparator rather than the decoration pass → the decoration is the only place `getDerivedSubmarketRank` is called, and `__tests__/sort-symbols-utils.spec.ts:180-209` stays in the suite unmodified to catch it.
- **Non-Derived markets remain locale-dependent** → accepted and deferred (D2 alternative); recorded as a deferral file so it survives archiving.
- **Spec collision with the unmerged `symbol-sort-order` capability** → its "alphabetically by the localized submarket display name" clause becomes false for Derived. It cannot be corrected from here as a `MODIFIED` delta while `openspec/specs/symbol-sort-order/spec.md` is absent (`openspec archive` aborts: _"target spec does not exist; only ADDED requirements are allowed for new specs"_ — verified locally). Handled by a conditional task plus `docs/spec-to-pr/deferrals/symbol-sort-order-spec-reconciliation.md`.
- **New file vs. knip/bundle baselines** → `market-ordering-utils.ts` exports only symbols that are imported by production code, so knip should stay quiet; the tasks include running `npm run knip:check` and regenerating the baseline only if it legitimately shifts.

## Migration Plan

None. Pure client-side presentation ordering with no persisted state, no stored user preference, and no API contract. Rollback is reverting the commit; a user's next page load picks up whichever order is deployed.
