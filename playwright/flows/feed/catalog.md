# 🗺️ Feed Journey Catalog — Technical Reference

> Source of truth: `packages/trader/src/AppV2/Components/MarketSelection/` · `market-info-screen.tsx`
> · `market-search-results.tsx`
> Last updated: 2026-09-21

---

## Section 1 — Journey Index

| Journey ID | Spec File                                                | Tags                                        |
| ---------- | -------------------------------------------------------- | ------------------------------------------- |
| Flow 1.1   | `feed/verify-derived-markets-streaming.spec.ts`          | `@feed @smoke @desktop @mobile @production` |
| Flow 1.2   | `feed/verify-forex-markets-streaming.spec.ts`            | `@feed @smoke @desktop @mobile @production` |
| Flow 1.3   | `feed/verify-stocks-indices-markets-streaming.spec.ts`   | `@feed @smoke @desktop @mobile @production` |
| Flow 1.4   | `feed/verify-cryptocurrencies-markets-streaming.spec.ts` | `@feed @smoke @desktop @mobile @production` |
| Flow 1.5   | `feed/verify-commodities-markets-streaming.spec.ts`      | `@feed @smoke @desktop @mobile @production` |

---

## Section 2 — Flow Details

### Flows 1.1–1.5 — one test per category chip

Search stays cross-trade-type. The category chip is the **test boundary**, not the navigation: a chip only lists symbols the selected trade type offers. All five tests carry `@smoke` and `@production`, so production still checks every market in `FeedPage.MARKETS`.

Each test calls `FeedPage.marketsIn(category)`:

| Flow | Category chip    |
| ---- | ---------------- |
| 1.1  | Derived          |
| 1.2  | Forex            |
| 1.3  | Stocks & indices |
| 1.4  | Cryptocurrencies |
| 1.5  | Commodities      |

```typescript
await feedPage.verifyCategoryMarkets(marketSelectionPage, tradeParametersPage, 'Derived');
```

One attempt per market, paced at 800ms. If staging shows the rate-limit page, the walk refreshes and retries that symbol once. Any other failure closes the picker before the next symbol so a stuck Market Info screen does not make every later market wait on **Add market**.

**Market data:** `FeedPage.MARKETS` — each entry is `{ label, category, status }`. `category` matches a picker chip (`Derived`, `Forex`, `Stocks & indices`, `Cryptocurrencies`, `Commodities`). `status` is `'open'` (24/7 synthetics) or `'session_gated'` (forex, indices, commodities, crypto, baskets). Optional `mobileLabel` remains on the type for viewport overrides but is unused by current entries.

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

| UI element                   | Locator / class                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| Picker (mobile)              | `[role="dialog"][aria-label="Market selection"]`                                             |
| Picker (desktop)             | `.market-selection-desktop`                                                                  |
| Search icon (mobile header)  | `marketSelectionPanel` → `getByRole('button', { name: 'Search' })`                           |
| Search page (mobile)         | `.market-search`                                                                             |
| Search input (mobile)        | `.market-search` → `getByPlaceholder('Search markets')`                                      |
| Search input (desktop)       | `.market-selection-desktop__search` → `getByPlaceholder('Search by market name')`            |
| Search results list          | `.market-search-results`                                                                     |
| Search loading skeleton      | `.market-selection-list--loading`                                                            |
| Search result row (mobile)   | `.market-search-results` → `.market-selection-row` filtered by `.market-selection-row__name` |
| Search result row (desktop)  | `.market-search-results` → `.market-row-desktop` filtered by `.market-row-desktop__name`     |
| Info button (mobile row)     | `.market-selection-row__action--info` — use `dispatchEvent('click')`                         |
| Info button (desktop row)    | row → `getByRole('button', { name: 'Info' })`                                                |
| Market Info screen           | `.market-info`                                                                               |
| Market name on Info          | `.market-info__name`                                                                         |
| Live price on Info           | `.market-info__price`                                                                        |
| Search result row CLOSED tag | `.market-selection-row__content` → `.tag__color--error-fill` with text **CLOSED**            |
| Closed tag on Market Info    | `.market-info__price-row` → `.tag__color--error-fill` with text **Closed**                   |
| Back from Info               | `getByRole('button', { name: 'Back' })` on `.market-info`                                    |

---

## Section 4 — POM Method Reference

| What the step does                                           | Method                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Full per-market flow (search → Info → assert; picker reused) | `feedPage.verifyMarketFeedViaInfoScreen(marketSelectionPage, market)`                |
| One category: trade page → each market → close picker        | `feedPage.verifyCategoryMarkets(marketSelectionPage, tradeParametersPage, category)` |
| Ensure picker + search ready (idempotent; safe on retry)     | `feedPage.openMarketSearchInPicker(marketSelectionPage)`                             |
| Type query and return first row (CLOSED → skip Info)         | `feedPage.searchMarketFirstResultRow(marketSelectionPage, label)`                    |
| Check CLOSED tag on a search row                             | `marketSelectionPage.isSearchResultRowClosed(row)`                                   |
| Search, open Info, assert (when row is live)                 | `feedPage.searchMarketAndOpenInfo(marketSelectionPage, label)`                       |
| Back to search between markets                               | `feedPage.returnFromMarketInfoForNextSearch(marketSelectionPage)`                    |
| Assert live price ticks; skip closed session-gated           | `feedPage.verifyMarketInfoFeedState(marketSelectionPage, label, status, category)`   |
| Resolve display label for viewport                           | `feedPage.resolveLabel(market)`                                                      |
| Static array of all markets, tagged by category chip         | `FeedPage.MARKETS`                                                                   |
| Markets for one chip                                         | `FeedPage.marketsIn(category)`                                                       |
| Locator: Market Info root                                    | `marketSelectionPage.marketInfoScreen`                                               |
| Locator: live price on Market Info                           | `marketSelectionPage.marketInfoScreen.locator('.market-info__price')`                |
| Open search page / confirm input ready                       | `marketSelectionPage.openMarketSearch()`                                             |
| Wait for first matching search row (past skeleton)           | `marketSelectionPage.waitForMarketSearchResultRow(market)`                           |
| First row in cross-trade-type results                        | `marketSelectionPage.firstMarketSearchResultRow(market)`                             |
| Open Info on a specific search row                           | `marketSelectionPage.openMarketInfoOnSearchRow(row)`                                 |
| Close picker after the loop                                  | `marketSelectionPage.closeMarketSelectionPicker()`                                   |
| Navigate to trade page (entry point)                         | `tradeParametersPage.gotoTradePage()`                                                |
| Seed localStorage (suppress tours)                           | `TradeBasePage.seedLocalStorageOnOrigin(page)`                                       |
