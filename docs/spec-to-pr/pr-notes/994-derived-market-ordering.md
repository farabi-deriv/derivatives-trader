# PR notes — 994-derived-market-ordering

Content for the pull request description. `Closes #994`.

## What changed

The Derived (`synthetic_index`) section order is now defined in exactly one place —
`DERIVED_SECTION_ORDER` in `packages/trader/src/AppV2/Utils/market-ordering-utils.ts` — and read by
both mechanisms that produce the rendered order:

- `sortSymbols` decorates each symbol with `getDerivedSubmarketRank(...) ?? CURATED_RANK_ABSENT` and
  compares market rank → submarket rank → the existing localized-name `localeCompare`. The rank
  lookup stays in the **decoration** pass, so no new `localize()` call is introduced and the INP
  guard (28 calls per sort) is untouched.
- `groupSymbolsForList` imports `DERIVED_SUBGROUP_ORDER` instead of declaring
  `['baskets', 'synthetics']` locally, which flips the sections to Synthetics then Baskets.

Both alias spellings of a pair share one rank. Every submarket with no curated rank — `range_index`
inside Derived, and all of Forex / Stock indices / Cryptocurrencies / Commodities — falls through to
today's comparator, so nothing outside Derived's section order moves and no symbol is dropped.

## Note for reviewers reading only the issue

The seven-item order implemented here **supersedes the six-item list in the issue body**: Crash/Boom
is added, and Daily reset indices moves to 5th. The authoritative order is Volatility indices → Step
indices → Jump indices → Crash/Boom → Daily reset indices → Forex basket → Gold (commodities) basket.

"Gold basket" is the commodities-basket submarket — confirmed against a live `active_symbols`
response: `WLDXAU` ("Gold Basket") is the only `commodity_basket` symbol and no separate gold-basket
submarket key exists. The same response confirmed the API sends the **alias** spellings
(`step_index`, `jump_index`, `crash_index`, `forex_basket`, `commodity_basket`) and that
`range_index` carries `subgroup: 'synthetics'`.

## Proof of red

Full evidence in `docs/spec-to-pr/tdd-evidence/994-derived-market-ordering.md`. Ten tests were
written first and run against unfixed code (`Test Suites: 2 failed, Tests: 10 failed, 15 passed`):

```
Red: [DMO-001] orders the seven curated Derived submarkets by rank, whatever order they arrive in
     — expected random_index, step_indices, jump_indices, crash_boom, random_daily, basket_forex,
       basket_commodities; got basket_commodities, basket_forex, crash_boom, random_daily,
       jump_indices, step_indices, random_index (alphabetical by localized name)
Red: [DMO-002] orders Derived identically under a locale whose translations collate the other way
     — expected the curated order; got its exact reverse, range_index first
Red: [DMO-003] ranks alias submarket keys identically to their primary spellings — same inversion
Red: [DMO-004] keeps an uncurated Derived submarket and places it after every curated one
     — expected random_index, random_daily, commodity_basket, range_index;
       got commodity_basket, random_daily, range_index, random_index
Red: [DMO-001] splits Derived into Synthetics then Baskets subgroup sections
     — expected ['synthetics','baskets']; got ['baskets','synthetics']
```

**Characterization tests (never went red — declared, not presented as red→green):** the whole of
`market-ordering-utils.spec.ts` (new module, no prior behaviour to fail),
`[DMO-006] leaves the submarket order of every non-Derived market untouched`, and
`[DMO-004] drops no symbol and duplicates none while ordering`. The pre-existing `sortSymbols`
market-order cases and the INP `localize` guard are unmodified regression guards — the diff to
`sort-symbols-utils.spec.ts` is append-only after line 211.

## Manual test steps — previous vs expected

**Status:** these steps have **not** been walked through in a browser — the implementation stage runs
unattended and cannot drive one. They are written out for QA to execute. What _was_ verified without
a browser: the live `active_symbols` taxonomy (below), a successful `@deriv/trader` webpack build, the
dev server booting on https://localhost:8443, and the automated equivalents listed at the end of this
section.

Reach the market selector by tapping the symbol name at the top of the trade page, then pick the
**Derived** category chip.

### 1. Desktop selector (Web), Rise/Fall — `DMO-001`

|              | Order shown                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Previous** | **Baskets**: Commodities basket, Forex basket — then **Synthetics**: Crash/Boom, Daily reset indices, Jump indices, Range break indices, Step indices, Volatility indices |
| **Expected** | **Synthetics**: Volatility indices, Step indices, Jump indices, Crash/Boom, Daily reset indices, Range break indices — then **Baskets**: Forex basket, Commodities basket |

Range break indices is uncurated, so it sits last inside Synthetics rather than alphabetically
between Jump and Step.

### 2. Desktop selector, a second trade type (e.g. Multipliers or Touch/No Touch) — `DMO-005`

- **Previous:** each tab showed its own alphabetical arrangement of whatever Derived submarkets it
  offers, baskets first.
- **Expected:** the same relative order as step 1, with only the missing submarkets omitted — no gap,
  no reordering.

### 3. Mobile / Responsive selector at a small breakpoint, same two trade types — `DMO-005`

- **Previous:** same wrong order as desktop (both breakpoints render `MarketSelectionList`).
- **Expected:** identical to steps 1 and 2.

### 4. Non-English UI language, both breakpoints — `DMO-002`

- **Previous:** headings translated **and** the sections re-sorted, because the order came from the
  translated names — so a locale whose collation differs from English produced a different order.
- **Expected:** headings translate, nothing moves. Synthetics still precedes Baskets and the five
  synthetics sections keep the curated sequence.

### 5. Non-Derived categories and search — `DMO-006`

Check Forex, Stock indices, Cryptocurrencies, Commodities and the search results view against a
pre-change build.

- **Previous / Expected:** identical. No non-Derived submarket has a curated rank, so every one of
  them falls straight through to the unchanged comparator. Symbol order _within_ a section, the
  market-level order and the category chips are also unchanged.

## Automated equivalents

Every step above has a test: the section order end to end at both breakpoints and across trade-type
subsets (`market-selection-list-ordering.spec.tsx`, which toggles `useDevice().isMobile`), the
locale independence (`sort-symbols-utils.spec.ts`, with `localize` mocked to translations that
collate in reverse), and the non-Derived regression (same file). The ordering table's own invariants,
including the `DMO-007` drift guard, are in `market-ordering-utils.spec.ts`.

## Deferrals filed

- `docs/spec-to-pr/deferrals/non-derived-submarket-locale-ordering.md` — non-Derived submarket
  sections stay locale-dependent.
- `docs/spec-to-pr/deferrals/symbol-sort-order-spec-reconciliation.md` — the unmerged
  `symbol-sort-order` capability's "alphabetically by the localized submarket display name" clause
  becomes false for Derived; it cannot be corrected from here while
  `openspec/specs/symbol-sort-order/spec.md` is absent (confirmed absent at implementation time, so
  no `MODIFIED` delta was added — `openspec archive` aborts on one with no target spec).
