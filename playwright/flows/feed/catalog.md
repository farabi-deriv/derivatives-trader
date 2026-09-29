# 🗺️ Feed Journey Catalog — Technical Reference

> Source of truth: `packages/trader/src/AppV2/Components/MarketSelection/` · `market-info-screen.tsx`
> · `market-search-results.tsx`
> Last updated: 2026-09-24

---

## Section 1 — Journey Index

| Journey ID | Spec File | Tags |
| --- | --- | --- |
| Flow 1.1–1.2 | `feed/verify-feed-derived.spec.ts` | `@feed @smoke @desktop @mobile @production` |
| Flow 2.1–2.2 | `feed/verify-feed-forex.spec.ts` | `@feed @smoke @desktop @mobile @production` |
| Flow 3 | `feed/verify-feed-stocks.spec.ts` | `@feed @smoke @desktop @mobile @production` |
| Flow 4 | `feed/verify-feed-crypto.spec.ts` | `@feed @smoke @desktop @mobile @production` |
| Flow 5 | `feed/verify-feed-commodities.spec.ts` | `@feed @smoke @desktop @mobile @production` |

All five specs share Playwright lock `feed-market-info` so Market Info walks never overlap across files / workers / projects in one run.

---

## Section 2 — Flow Details

### Flows 1–5 — category walks (one locked spec per chip family)

Search stays cross-trade-type. The category chip is the **test boundary**, not the navigation. Tests carry `@smoke` and `@production`, so production checks every market in `FeedPage.MARKETS`.

**Concurrency:** `lock: 'feed-market-info'` on each describe (Playwright 1.63+). Only one feed walk runs at a time in a single Playwright process; a failure does not cascade-skip other categories. Locks do **not** sync across separate CI jobs/shards.

**File cut:**

| Spec | Flows | Markets |
| --- | --- | --- |
| `verify-feed-derived.spec.ts` | 1.1–1.2 | Derived synthetics + baskets |
| `verify-feed-forex.spec.ts` | 2.1–2.2 | Forex major + minor pairs |
| `verify-feed-stocks.spec.ts` | 3 | Stocks & indices |
| `verify-feed-crypto.spec.ts` | 4 | Cryptocurrencies |
| `verify-feed-commodities.spec.ts` | 5 | Commodities |

Large chips are also split into shorter tests:

- **Derived** → synthetics vs baskets
- **Forex** → major vs minor pairs

Each test calls `FeedPage.marketsIn(category, filter?)`:

| Flow | Category chip | Filter | Test title | Spec |
| --- | --- | --- | --- | --- |
| 1.1 | Derived | `{ derivedGroup: 'synthetics' }` | `VERIFY Feed for Derived - Synthetics markets` | derived |
| 1.2 | Derived | `{ derivedGroup: 'baskets' }` | `VERIFY Feed for Derived - Basket markets` | derived |
| 2.1 | Forex | `{ forexGroup: 'major' }` | `VERIFY Feed for Forex - Major pairs` | forex |
| 2.2 | Forex | `{ forexGroup: 'minor' }` | `VERIFY Feed for Forex - Minor pairs` | forex |
| 3 | Stocks & indices | — | `VERIFY Feed for Stocks & indices markets` | stocks |
| 4 | Cryptocurrencies | — | `VERIFY Feed for Cryptocurrencies markets` | crypto |
| 5 | Commodities | — | `VERIFY Feed for Commodities markets` | commodities |

```typescript
await feedPage.verifyCategoryMarkets(marketSelectionPage, tradeParametersPage, 'Derived', {
    derivedGroup: 'synthetics',
});
await feedPage.verifyCategoryMarkets(marketSelectionPage, tradeParametersPage, 'Forex', {
    forexGroup: 'major',
});
```

One attempt per market, paced at **3s** (`paceFeedMarketInfoLookup` / `FEED_MARKET_INFO_LOOKUP_PACE_MS`). If staging shows the rate-limit page, the walk refreshes and retries that symbol once. Any other failure closes the picker before the next symbol so a stuck Market Info screen does not make every later market wait on **Add market**.

**Market data:** `FeedPage.MARKETS` — each entry is `{ label, category, status, derivedGroup?, forexGroup? }`. `category` matches a picker chip. `derivedGroup` is `'synthetics' | 'baskets'` on Derived rows; `forexGroup` is `'major' | 'minor'` on Forex rows. `status` is `'open'` (24/7 synthetics) or `'session_gated'` (forex, indices, commodities, crypto, baskets). Optional `mobileLabel` remains on the type for viewport overrides but is unused by current entries.

**Tick wait:** **15s** for always-open markets (`status: 'open'`); **45s** for session-gated markets (forex, stocks & indices, commodities, crypto, baskets) — driven by `status`, not category, in `verifyMarketInfoFeedState`. Initial numeric-price/closed load uses **45s** for every market.

**Why Market Info, not the trade form:** The redesign removed the DOM-visible live spot price from the
trade page (chart is `<canvas>` only). Market Info exposes `.market-info__price`, which updates from
the same ticks WebSocket stream.

**Search behaviour:** Cross-trade-type search groups results under each tradeable trade type. The test
opens Info from `firstMarketSearchResultRow(label)` — the first DOM match, not a fixed trade type.

**Between markets:** Picker stays open. `returnFromMarketInfoForNextSearch` clicks Back; the next
iteration's `fill()` replaces the search query. No need to close the picker or tap Search again.

**Session-gated skip:** When the first search row shows **CLOSED**, or Market Info shows **Closed**,
the market is skipped with no tick assertion.

---

## Section 3 — Key DOM Locators

| UI element | Locator / class |
| --- | --- |
| Picker (mobile) | `[role="dialog"][aria-label="Market selection"]` |
| Picker (desktop) | `.market-selection-desktop` |
| Search icon (mobile header) | `marketSelectionPanel` → `getByRole('button', { name: 'Search' })` |
| Search page (mobile) | `.market-search` |
| Search input (mobile) | `.market-search` → `getByPlaceholder('Search markets')` |
| Search input (desktop) | `.market-selection-desktop__search` → `getByPlaceholder('Search by market name')` |
| Search results list | `.market-search-results` |
| Search loading skeleton | `.market-selection-list--loading` |
| Search result row (mobile) | `.market-search-results` → `.market-selection-row` filtered by `.market-selection-row__name` |
| Search result row (desktop) | `.market-search-results` → `.market-row-desktop` filtered by `.market-row-desktop__name` |
| Info button (mobile row) | `.market-selection-row__action--info` — use `dispatchEvent('click')` |
| Info button (desktop row) | row → `getByRole('button', { name: 'Info' })` |
| Market Info screen | `.market-info` |
| Market name on Info | `.market-info__name` |
| Live price on Info | `.market-info__price` |
| Search result row CLOSED tag | `.market-selection-row__content` → `.tag__color--error-fill` with text **CLOSED** |
| Closed tag on Market Info | `.market-info__price-row` → `.tag__color--error-fill` with text **Closed** |
| Back from Info | `getByRole('button', { name: 'Back' })` on `.market-info` |

---

## Section 4 — POM Method Reference

| What the step does | Method |
| --- | --- |
| Full per-market flow (search → Info → assert; picker reused) | `feedPage.verifyMarketFeedViaInfoScreen(marketSelectionPage, market)` |
| One category (optional subset filter): trade page → each market → close picker | `feedPage.verifyCategoryMarkets(marketSelectionPage, tradeParametersPage, category, filter?)` |
| Ensure picker + search ready (idempotent; safe on retry) | `feedPage.openMarketSearchInPicker(marketSelectionPage)` |
| Type query and return first row (CLOSED → skip Info) | `feedPage.searchMarketFirstResultRow(marketSelectionPage, label)` |
| Check CLOSED tag on a search row | `marketSelectionPage.isSearchResultRowClosed(row)` |
| Search, open Info, assert (when row is live) | `feedPage.searchMarketAndOpenInfo(marketSelectionPage, label)` |
| Back to search between markets | `feedPage.returnFromMarketInfoForNextSearch(marketSelectionPage)` |
| Assert live price ticks; skip closed session-gated | `feedPage.verifyMarketInfoFeedState(marketSelectionPage, label, status)` |
| Resolve display label for viewport | `feedPage.resolveLabel(market)` |
| Static array of all markets, tagged by category chip | `FeedPage.MARKETS` |
| Markets for one chip (optional Derived / Forex subset) | `FeedPage.marketsIn(category, filter?)` |
| 3s pause between feed Market Info lookups | `marketSelectionPage.paceFeedMarketInfoLookup()` |
| Locator: Market Info root | `marketSelectionPage.marketInfoScreen` |
| Locator: live price on Market Info | `marketSelectionPage.marketInfoScreen.locator('.market-info__price')` |
| Open search page / confirm input ready | `marketSelectionPage.openMarketSearch()` |
| Wait for first matching search row (past skeleton) | `marketSelectionPage.waitForMarketSearchResultRow(market)` |
| First row in cross-trade-type results | `marketSelectionPage.firstMarketSearchResultRow(market)` |
| Open Info on a specific search row | `marketSelectionPage.openMarketInfoOnSearchRow(row)` |
| Close picker after the loop | `marketSelectionPage.closeMarketSelectionPicker()` |
| Navigate to trade page (entry point) | `tradeParametersPage.gotoTradePage()` |
| Seed localStorage (suppress tours) | `TradeBasePage.seedLocalStorageOnOrigin(page)` |
