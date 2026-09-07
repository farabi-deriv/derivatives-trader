# Non-Derived submarket sections still order by localized display name

**What was deferred:**

Change `994-derived-market-ordering` replaces the alphabetical submarket tie-breaker in
`packages/trader/src/AppV2/Utils/sort-symbols-utils.ts` with a curated, key-based rank — but only for
the seven **Derived** submarkets. Every other market (Forex, Stock indices, Cryptocurrencies,
Commodities) has no curated rank, so its submarket sections still fall through to
`submarket_name.localeCompare(...)` where `submarket_name` is the **localized** display name resolved
by `localize()`. Those sections therefore remain locale-dependent: switching the UI language can
reorder them, and their order is whatever the active locale's collation happens to produce rather than
a deliberate product decision.

Concretely, in Stock indices the English labels "American indices", "Americas", "Asia/Oceania",
"Asian indices", "European indices", "Europe/Africa" and "OTC indices" are ordered by ICU collation
rules over strings containing spaces and slashes — no one chose that sequence, and it is not stable
across languages.

**Why:**

GitHub issue #994 and the seeded requirement specify an order for the Derived category only. Curating
a rank for the remaining ~21 submarket keys would silently rewrite four other categories' section
order, and reproducing today's locale-dependent order exactly as a static list is guesswork — the
change's constraints explicitly forbid changing the ordering of anything the issue did not name.

**Follow-up required:**

Decide the intended submarket section order for Forex, Stock indices, Cryptocurrencies and Commodities
with the product owner, then extend the ordering table in
`packages/trader/src/AppV2/Utils/market-ordering-utils.ts` — introduced by change
`994-derived-market-ordering` — from a Derived-only table to a per-market one, and drop the
`localeCompare` fallback from `sort-symbols-utils.ts` entirely once every submarket key has a rank.
Cover it with a unit test that asserts identical ordering under two locales whose collation of the
translated names differs, mirroring the Derived test added by that change
(`packages/trader/src/AppV2/Utils/__tests__/sort-symbols-utils.spec.ts`). Note that the alias pairs
already handled for Derived (`step_indices`/`step_index` and friends) have non-Derived equivalents in
the same display maps — `americas`/`americas_OTC`, `cryptocurrency`/`non_stable_coin` — that must be
resolved deliberately rather than assumed to be aliases.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1357
