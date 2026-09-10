# 📋 Feed Journey Spec — What to Test

> **Purpose:** Verifies every market's live price feed via the Market Info screen in the market-selection
> picker. The trade-page chart renders on `<canvas>` (not readable by Playwright), but the Market Info
> screen exposes a DOM-visible `.market-info__price` fed by the same ticks stream. Session-gated markets
> closed at runtime are skipped; always-open markets must tick when live.
>
> **Feature location:** `packages/trader/src/AppV2/Components/MarketSelection/` · `market-info-screen.tsx`
> **Entry:** Navigate to trade page root → open market-selection picker → cross-trade-type search → Info
> per market (first matching row when a symbol appears under several trade types).
> **Authentication:** No authentication required — feed is visible to logged-out users.

---

## Section 1 — Shared Step Pattern

### Search → Market Info → Back (picker stays open)

> Referenced by every market in Flow 1. The picker opens once on the **first** market; later markets
> reuse it — Back returns to search, then the next loop iteration types the next symbol.

| #   | Step                           | Action                                                                                                                                                   | Expected Result                                                                                                                                                                                                                                  | Platform |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | Open search (first market)     | Click **Add market** (+) → wait for picker → open search                                                                                                 | Desktop: inline search field (`placeholder="Search by market name"`) is ready. Mobile: tap header **Search** (`aria-label="Search"`) → dedicated search page (`.market-search`) with input (`placeholder="Search markets"`) visible and editable | Both     |
| 2   | Type market name               | `marketSearchInput.fill(label)`                                                                                                                          | Query runs across **all** trade types; results render in `.market-search-results` grouped by trade type (symbol may appear under several groups)                                                                                                 | Both     |
| 3   | Wait for results               | Poll until loading skeleton (`.market-selection-list--loading`) clears and the first matching row is visible                                             | First row for the label in list order is ready (not scoped to a single trade type)                                                                                                                                                               | Both     |
| 4   | Skip closed in list (optional) | If first row shows **CLOSED** tag (`.tag__color--error-fill`) and market is `session_gated` → return; do not open Info                                   | Search page stays open for next `fill()`. Always-open markets must **fail** if CLOSED appears                                                                                                                                                    | Both     |
| 5   | Open Info (live rows only)     | Click **Info** on that row — desktop: `getByRole('button', { name: 'Info' })`; mobile: `dispatchEvent('click')` on `.market-selection-row__action--info` | Market Info (`.market-info`) opens; `.market-info__name` matches the market label                                                                                                                                                                | Both     |
| 6   | Assert feed / skip closed      | Poll `.market-info__price` or **Closed** tag in `.market-info__price-row` (fallback)                                                                     | **Closed on Info:** skip session-gated. **Live:** `.market-info__price` ticks within 15 s. **Always-open:** must never show Closed                                                                                                               | Both     |
| 7   | Back for next market           | Click **Back** (`aria-label="Back"`) on Market Info                                                                                                      | Info screen closes; search input is visible and editable again. Next loop `fill()` replaces the previous query — picker stays open                                                                                                               | Both     |

> **Search is cross-trade-type.** Results are not filtered to Multipliers or any single trade type.
> When the same symbol appears under Rise/Fall, Accumulators, Multipliers, etc., the test uses the
> **first row in DOM order** via `firstMarketSearchResultRow(label)`.

> **First-search cold start.** The first query may briefly show a loading skeleton while per-trade-type
> `active_symbols` lists resolve (`useAllTradeTypeSymbols`). Later markets reuse cached symbol data and
> search is faster.

---

## Section 2 — Per-Flow Sections

### Flow 1 — All markets: live feed ticks on Market Info for every tradeable symbol · `feed/verify-all-markets-streaming.spec.ts`

> Iterates over ALL markets in `FeedPage.MARKETS` (~65 symbols). Soft-retries each market with
> `expect.soft(...).toPass({ timeout: 60_000 })`. Closes the picker once after the loop.

| #   | Step                           | Action                                                                                                 | Expected Result                                                                                           | Platform |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Navigate to trade page         | `TradeBasePage.seedLocalStorageOnOrigin(page)` then `tradeParametersPage.gotoTradePage()`              | Trade page loads; active market tab visible                                                               | Both     |
| 2   | Loop `FeedPage.MARKETS`        | `for (let index = 0; index < FeedPage.MARKETS.length; index++)`                                        | —                                                                                                         | Both     |
| 2a  | Ensure picker + search ready   | `verifyMarketFeedViaInfoScreen` → idempotent `openMarketSearchInPicker()` (opens once; no-op on retry) | Picker open; search input ready (see [Shared Step Pattern](#search--market-info--back-picker-stays-open)) | Both     |
| 2b  | Search → skip or Info          | `searchMarketFirstResultRow` → `isSearchResultRowClosed` skip, else `openMarketInfoOnSearchRow`        | CLOSED in list: skip without Info. Live row: Market Info opens with correct `.market-info__name`          | Both     |
| 2c  | Assert feed on Market Info     | `verifyMarketInfoFeedState(label, market.status)`                                                      | Live price ticks, or session-gated **Closed** tag on Info skipped                                         | Both     |
| 2d  | Back (finally block)           | `returnFromMarketInfoForNextSearch` — only when Info was opened (not on search-list CLOSED skip)       | Back to search; input ready for next market's `fill()`                                                    | Both     |
| 3   | Close picker after last market | `marketSelectionPage.closeMarketSelectionPicker()` after the loop                                      | Picker dismisses; trade page restored                                                                     | Both     |

**Market status branches (`FeedPage.MARKETS[].status`):**

| Status          | When live (list + Info)            | When **CLOSED** in search list | When **Closed** on Market Info |
| --------------- | ---------------------------------- | ------------------------------ | ------------------------------ |
| `open`          | Assert `.market-info__price` ticks | **Fail**                       | **Fail**                       |
| `session_gated` | Assert `.market-info__price` ticks | **Skip** (no Info, no Back)    | **Skip** (Back in `finally`)   |

**Example labels:** `'Volatility 100 Index'`, `'Step 100 Index'`, `'EUR/USD'`, `'Gold/USD'`.
