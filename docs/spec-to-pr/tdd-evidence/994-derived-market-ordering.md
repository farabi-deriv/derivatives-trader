# Proof of red — 994-derived-market-ordering

Captured by running the two specs against `master` (`d31e3f1822`) **before** any production code
changed — the tests existed, `market-ordering-utils.ts` did not, and neither consumer was wired:

```
npm run test:jest -- packages/trader/src/AppV2/Utils/__tests__/sort-symbols-utils.spec.ts \
                     packages/trader/src/AppV2/Utils/__tests__/market-selection-utils.spec.ts
→ Test Suites: 2 failed, 2 total   Tests: 10 failed, 15 passed, 25 total
```

Every failure is an ordering mismatch — the behaviour is absent, not a compile or import error.

## Red — `sort-symbols-utils.spec.ts`

- `[DMO-001] orders the seven curated Derived submarkets by rank, whatever order they arrive in`
  — expected `random_index, step_indices, jump_indices, crash_boom, random_daily, basket_forex, basket_commodities`;
  got `basket_commodities, basket_forex, crash_boom, random_daily, jump_indices, step_indices, random_index`
  (alphabetical by localized name).
- `[DMO-001] places every synthetics submarket ahead of every baskets submarket`
  — expected `synthetics ×5` then `baskets ×2`; got `baskets` first.
- `[DMO-001] keeps the curated relative order when only a subset of the submarkets is tradeable`
  — expected `random_index, crash_boom, basket_forex`; got `basket_forex, crash_boom, random_index`.
- `[DMO-003] ranks alias submarket keys identically to their primary spellings`
  — expected `random_index, step_index, jump_index, crash_index, random_daily, forex_basket, commodity_basket`;
  got `commodity_basket, forex_basket, crash_index, random_daily, jump_index, step_index, random_index`.
- `[DMO-003] ranks both spellings of one submarket at the same position within a mixed list`
  — expected `random_index` first and `commodity_basket` last; got them swapped.
- `[DMO-004] keeps an uncurated Derived submarket and places it after every curated one`
  — expected `random_index, random_daily, commodity_basket, range_index`;
  got `commodity_basket, random_daily, range_index, random_index`.
- `[DMO-002] orders Derived identically under a locale whose translations collate the other way`
  — with `localize` mocked to translations that collate in reverse, expected the curated order;
  got the exact reverse, `range_index` first — proving the order was read off the translated names.

## Red — `market-selection-utils.spec.ts`

- `[DMO-001] splits Derived into Synthetics then Baskets subgroup sections, each grouped by submarket`
  — expected `['synthetics', 'baskets']`; got `['baskets', 'synthetics']`.
- `[DMO-001] orders the subgroup sections independently of the incoming symbol order`
  — expected `['synthetics', 'baskets']` from both input orders; got `['baskets', 'synthetics']`.
- `[DMO-004] keeps an uncurated Derived submarket at the end of its own subgroup section`
  — expected the first section's groups to read `random_index, random_daily, range_index`;
  got `['commodity_basket']`, because the first section was Baskets.

## Characterization tests (never went red — declared, not presented as red→green)

- `market-ordering-utils.spec.ts` (all cases) — a new module's own unit tests. The module did not
  exist before this change, so no red is possible; they pin the table down against future edits
  (including the `DMO-007` drift guard).
- `[DMO-006] leaves the submarket order of every non-Derived market untouched` — asserts existing
  behaviour is preserved. Green before and after by design; that is the point of the test.
- `[DMO-004] drops no symbol and duplicates none while ordering` — a set-equality invariant that held
  before the change too.
- The pre-existing `sortSymbols` market-order cases and the INP `localize`-call guard
  (`sort-symbols-utils.spec.ts:11-104`, `:105-179`, `:180-209`) are unmodified regression guards.
  </content>
  </invoke>
