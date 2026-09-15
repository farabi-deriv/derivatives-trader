# 🗺️ Feed Journey Catalog — Technical Reference

> Source of truth: `packages/trader/src/AppV2/Components/MarketSelection/` · `market-info-screen.tsx`
> · `market-search-results.tsx`
> Last updated: 2026-09-10

---

## Section 1 — Journey Index

| Journey ID | Spec File                                   | Tags                                        |
| ---------- | ------------------------------------------- | ------------------------------------------- |
| Flow 1     | `feed/verify-all-markets-streaming.spec.ts` | `@feed @smoke @desktop @mobile @production` |

---

## Section 2 — Flow Details

### Flow 1 — All markets: live feed ticks on Market Info for every tradeable symbol

```typescript
// Entry: unauthenticated
await TradeBasePage.seedLocalStorageOnOrigin(page);
await tradeParametersPage.gotoTradePage();

for (let index = 0; index < FeedPage.MARKETS.length; index++) {
    const market = FeedPage.MARKETS[index];
    await expect
        .soft(
            async () => {
                await feedPage.verifyMarketFeedViaInfoScreen(marketSelectionPage, market);
            },
            `[${feedPage.resolveLabel(market)}] market feed check`
        )
        .toPass({ timeout: 60_000 });
}
await marketSelectionPage.closeMarketSelectionPicker();
```

**Market data:** `FeedPage.MARKETS` — static array of ~65 entries, each `{ label, status }` where
`status` is `'open'` (24/7 synthetics) or `'session_gated'` (forex, indices, commodities, crypto, baskets).
Optional `mobileLabel` remains on the type for viewport overrides but is unused by current entries
(e.g. step indices display as `Step 100 Index` on both platforms).

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

| What the step does                                           | Method                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Full per-market flow (search → Info → assert; picker reused) | `feedPage.verifyMarketFeedViaInfoScreen(marketSelectionPage, market)`    |
| Ensure picker + search ready (idempotent; safe on retry)     | `feedPage.openMarketSearchInPicker(marketSelectionPage)`                 |
| Type query and return first row (CLOSED → skip Info)         | `feedPage.searchMarketFirstResultRow(marketSelectionPage, label)`        |
| Check CLOSED tag on a search row                             | `marketSelectionPage.isSearchResultRowClosed(row)`                       |
| Search, open Info, assert (when row is live)                 | `feedPage.searchMarketAndOpenInfo(marketSelectionPage, label)`           |
| Back to search between markets                               | `feedPage.returnFromMarketInfoForNextSearch(marketSelectionPage)`        |
| Assert live price ticks; skip closed session-gated           | `feedPage.verifyMarketInfoFeedState(marketSelectionPage, label, status)` |
| Resolve display label for viewport                           | `feedPage.resolveLabel(market)`                                          |
| Static array of all ~65 markets                              | `FeedPage.MARKETS`                                                       |
| Locator: Market Info root                                    | `marketSelectionPage.marketInfoScreen`                                   |
| Locator: live price on Market Info                           | `marketSelectionPage.marketInfoScreen.locator('.market-info__price')`    |
| Open search page / confirm input ready                       | `marketSelectionPage.openMarketSearch()`                                 |
| Wait for first matching search row (past skeleton)           | `marketSelectionPage.waitForMarketSearchResultRow(market)`               |
| First row in cross-trade-type results                        | `marketSelectionPage.firstMarketSearchResultRow(market)`                 |
| Open Info on a specific search row                           | `marketSelectionPage.openMarketInfoOnSearchRow(row)`                     |
| Close picker after the loop                                  | `marketSelectionPage.closeMarketSelectionPicker()`                       |
| Navigate to trade page (entry point)                         | `tradeParametersPage.gotoTradePage()`                                    |
| Seed localStorage (suppress tours)                           | `TradeBasePage.seedLocalStorageOnOrigin(page)`                           |
