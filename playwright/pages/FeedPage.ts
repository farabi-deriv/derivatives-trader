import { Locator, expect } from '@playwright/test';
import { MarketSelectionPage } from './MarketSelectionPage';
import { TradeBasePage } from './TradeBasePage';

export type MarketStatus = 'open' | 'session_gated';

export interface Market {
    label: string;
    /** Override used on mobile when the action sheet renders a different name than SmartCharts. */
    mobileLabel?: string;
    status: MarketStatus;
}

/**
 * FeedPage — Verifies every market's live price feed (or closed-market state) via the Market Info
 * screen in the market-selection picker.
 *
 * Flow per market: open picker → search row → Info → assert `.market-info__price`
 * ticks from the live stream. Search is cross-trade-type; when a symbol appears under several
 * groups, the first matching row is used. Session-gated markets outside exchange hours are skipped.
 *
 * @example
 * ```typescript
 * await tradeParametersPage.gotoTradePage();
 * await feedPage.verifyMarketFeedViaInfoScreen(marketSelectionPage, market);
 * await marketSelectionPage.closeMarketSelectionPicker();
 * ```
 */
export class FeedPage extends TradeBasePage {
    // ============================================
    // MARKET LIST
    // ============================================

    static readonly MARKETS: Market[] = [
        // ── Volatility indices (1s) — 24/7 ────────────────────────────────────
        { label: 'Volatility 100 (1s) Index', status: 'open' },
        { label: 'Volatility 10 (1s) Index', status: 'open' },
        { label: 'Volatility 25 (1s) Index', status: 'open' },
        { label: 'Volatility 50 (1s) Index', status: 'open' },
        { label: 'Volatility 75 (1s) Index', status: 'open' },
        // ── Volatility indices — 24/7 ──────────────────────────────────────────
        { label: 'Volatility 10 Index', status: 'open' },
        { label: 'Volatility 25 Index', status: 'open' },
        { label: 'Volatility 50 Index', status: 'open' },
        { label: 'Volatility 75 Index', status: 'open' },
        { label: 'Volatility 100 Index', status: 'open' },
        // ── Jump indices — 24/7 ────────────────────────────────────────────────
        { label: 'Jump 10 Index', status: 'open' },
        { label: 'Jump 25 Index', status: 'open' },
        { label: 'Jump 50 Index', status: 'open' },
        { label: 'Jump 75 Index', status: 'open' },
        { label: 'Jump 100 Index', status: 'open' },
        // ── Step indices — 24/7 ────────────────────────────────────────────────
        { label: 'Step 100 Index', status: 'open' },
        { label: 'Step 200 Index', status: 'open' },
        { label: 'Step 300 Index', status: 'open' },
        { label: 'Step 400 Index', status: 'open' },
        { label: 'Step 500 Index', status: 'open' },
        // ── Daily reset indices — 24/7 ─────────────────────────────────────────
        { label: 'Bear Market Index', status: 'open' },
        { label: 'Bull Market Index', status: 'open' },
        // ── Basket indices — weekday-only (closed on weekends) ─────────────────
        { label: 'Gold Basket', status: 'session_gated' },
        { label: 'AUD Basket', status: 'session_gated' },
        { label: 'EUR Basket', status: 'session_gated' },
        { label: 'GBP Basket', status: 'session_gated' },
        { label: 'USD Basket', status: 'session_gated' },
        // ── Stock indices — session-gated (exchange hours only) ────────────────
        { label: 'Wall Street 30', status: 'session_gated' },
        { label: 'US Tech 100', status: 'session_gated' },
        { label: 'US 500', status: 'session_gated' },
        { label: 'Australia 200', status: 'session_gated' },
        { label: 'Hong Kong 50', status: 'session_gated' },
        { label: 'Japan 225', status: 'session_gated' },
        { label: 'Netherlands 25', status: 'session_gated' },
        { label: 'France 40', status: 'session_gated' },
        { label: 'UK 100', status: 'session_gated' },
        { label: 'Germany 40', status: 'session_gated' },
        { label: 'Swiss 20', status: 'session_gated' },
        { label: 'Euro 50', status: 'session_gated' },
        // ── Crypto — weekday-only ──────────────────────────────────────────────
        { label: 'BTC/USD', status: 'session_gated' },
        { label: 'ETH/USD', status: 'session_gated' },
        // ── Forex major — weekday-only ─────────────────────────────────────────
        { label: 'AUD/JPY', status: 'session_gated' },
        { label: 'AUD/USD', status: 'session_gated' },
        { label: 'EUR/AUD', status: 'session_gated' },
        { label: 'EUR/CAD', status: 'session_gated' },
        { label: 'EUR/CHF', status: 'session_gated' },
        { label: 'EUR/GBP', status: 'session_gated' },
        { label: 'EUR/JPY', status: 'session_gated' },
        { label: 'EUR/USD', status: 'session_gated' },
        { label: 'GBP/AUD', status: 'session_gated' },
        { label: 'GBP/JPY', status: 'session_gated' },
        { label: 'GBP/USD', status: 'session_gated' },
        { label: 'USD/CAD', status: 'session_gated' },
        { label: 'USD/CHF', status: 'session_gated' },
        { label: 'USD/JPY', status: 'session_gated' },
        // ── Forex minor — weekday-only ─────────────────────────────────────────
        { label: 'AUD/CAD', status: 'session_gated' },
        { label: 'AUD/CHF', status: 'session_gated' },
        { label: 'AUD/NZD', status: 'session_gated' },
        { label: 'EUR/NZD', status: 'session_gated' },
        { label: 'GBP/CAD', status: 'session_gated' },
        { label: 'GBP/CHF', status: 'session_gated' },
        { label: 'GBP/NZD', status: 'session_gated' },
        { label: 'NZD/JPY', status: 'session_gated' },
        { label: 'NZD/USD', status: 'session_gated' },
        { label: 'USD/MXN', status: 'session_gated' },
        { label: 'USD/PLN', status: 'session_gated' },
        // ── Commodities — session-gated ────────────────────────────────────────
        { label: 'Silver/USD', status: 'session_gated' },
        { label: 'Gold/USD', status: 'session_gated' },
        { label: 'Palladium/USD', status: 'session_gated' },
        { label: 'Platinum/USD', status: 'session_gated' },
    ];

    // ============================================
    // LOCATORS (scoped via MarketSelectionPage — single source for `.market-info`)
    // ============================================

    private marketInfoName(marketSelectionPage: MarketSelectionPage): Locator {
        return marketSelectionPage.marketInfoScreen.locator('.market-info__name');
    }

    /** Live spot price on the Market Info screen. Source: market-info-screen.tsx `.market-info__price` */
    private marketInfoPrice(marketSelectionPage: MarketSelectionPage): Locator {
        return marketSelectionPage.marketInfoScreen.locator('.market-info__price');
    }

    /**
     * Closed tag in `.market-info__price-row` when the exchange is shut (replaces `.market-info__price`).
     * Search list uses uppercase **CLOSED**; Market Info uses title case **Closed** in `.tag__color--error-fill`.
     */
    private marketInfoClosedTag(marketSelectionPage: MarketSelectionPage): Locator {
        return marketSelectionPage.marketInfoScreen
            .locator('.market-info__price-row .tag__color--error-fill', { hasText: 'Closed' })
            .first();
    }

    // ============================================
    // ACTIONS
    // ============================================

    resolveLabel(market: Market): string {
        return this.isMobile && market.mobileLabel ? market.mobileLabel : market.label;
    }

    /**
     * Ensure the picker is open with search ready — idempotent, safe inside `.toPass()` retries.
     * Skips Add-market / Search taps when already on the search page or Market Info (Back first).
     */
    async openMarketSearchInPicker(marketSelectionPage: MarketSelectionPage): Promise<void> {
        if (await marketSelectionPage.marketInfoScreen.isVisible().catch(() => false)) {
            await this.returnFromMarketInfoForNextSearch(marketSelectionPage);
        }

        const pickerOpen = await marketSelectionPage.marketSelectionPanel.isVisible().catch(() => false);
        if (!pickerOpen) {
            await marketSelectionPage.addMarketButton.click();
            await expect(marketSelectionPage.marketSelectionPanel, 'Market-selection picker should open').toBeVisible();
        }

        const searchReady = await marketSelectionPage.marketSearchInput.isVisible().catch(() => false);
        if (!searchReady) {
            await marketSelectionPage.openMarketSearch();
        }
    }

    /** Search for a symbol and return the first matching search row. */
    async searchMarketFirstResultRow(marketSelectionPage: MarketSelectionPage, marketLabel: string): Promise<Locator> {
        await expect(
            marketSelectionPage.marketSearchInput,
            `[${marketLabel}] search input should be ready before typing`
        ).toBeVisible();
        await marketSelectionPage.marketSearchInput.fill(marketLabel);
        return marketSelectionPage.waitForMarketSearchResultRow(marketLabel);
    }

    /** Search for a symbol and open its Market Info from the first matching search row. */
    async searchMarketAndOpenInfo(marketSelectionPage: MarketSelectionPage, marketLabel: string): Promise<void> {
        const resultRow = await this.searchMarketFirstResultRow(marketSelectionPage, marketLabel);

        await marketSelectionPage.openMarketInfoOnSearchRow(resultRow);
        await expect(
            marketSelectionPage.marketInfoScreen,
            `[${marketLabel}] Market Info screen should open`
        ).toBeVisible();
        await expect(
            this.marketInfoName(marketSelectionPage),
            `[${marketLabel}] Market Info should show the market name`
        ).toHaveText(marketLabel);
    }

    /** Back out of Market Info to search and open the next market (picker stays open). */
    async returnFromMarketInfoForNextSearch(marketSelectionPage: MarketSelectionPage): Promise<void> {
        await marketSelectionPage.marketInfoBackButton.click();
        await expect(
            marketSelectionPage.marketInfoScreen,
            'Market Info screen should close after Back'
        ).not.toBeVisible();
        await expect(
            marketSelectionPage.marketSearchInput,
            'Search input should be ready for the next market query'
        ).toBeVisible();
        await expect(marketSelectionPage.marketSearchInput, 'Search input should be editable').toBeEditable();
    }

    // ============================================
    // VERIFICATIONS
    // ============================================

    /**
     * End-to-end feed check for one market: search → Info → assert live price or closed state.
     * Opens the picker on first use; afterwards the picker stays open between markets.
     * `openMarketSearchInPicker` is idempotent so `.toPass()` retries never re-click Add market.
     */
    async verifyMarketFeedViaInfoScreen(marketSelectionPage: MarketSelectionPage, market: Market): Promise<void> {
        const label = this.resolveLabel(market);

        await this.openMarketSearchInPicker(marketSelectionPage);

        const resultRow = await this.searchMarketFirstResultRow(marketSelectionPage, label);

        if (await marketSelectionPage.isSearchResultRowClosed(resultRow)) {
            if (market.status === 'open') {
                throw new Error(`[${label}] Always-open market should not show CLOSED in search results`);
            }
            // session_gated and outside trading hours — skip Info; search page stays open for the next query
            return;
        }

        await marketSelectionPage.openMarketInfoOnSearchRow(resultRow);
        await expect(marketSelectionPage.marketInfoScreen, `[${label}] Market Info screen should open`).toBeVisible();
        await expect(
            this.marketInfoName(marketSelectionPage),
            `[${label}] Market Info should show the market name`
        ).toHaveText(label);

        try {
            await this.verifyMarketInfoFeedState(marketSelectionPage, label, market.status);
        } finally {
            await this.returnFromMarketInfoForNextSearch(marketSelectionPage);
        }
    }

    /**
     * Assert the Market Info screen shows a live ticking price.
     * Session-gated markets that are closed at runtime are skipped — proceed to the next market.
     */
    async verifyMarketInfoFeedState(
        marketSelectionPage: MarketSelectionPage,
        label: string,
        status: MarketStatus
    ): Promise<void> {
        const marketInfoPrice = this.marketInfoPrice(marketSelectionPage);
        const marketInfoClosedTag = this.marketInfoClosedTag(marketSelectionPage);

        await expect
            .poll(
                async () => {
                    const priceVisible = await marketInfoPrice.isVisible().catch(() => false);
                    const closedVisible = await marketInfoClosedTag.isVisible().catch(() => false);
                    return priceVisible || closedVisible;
                },
                { message: `[${label}] Market Info should finish loading price or closed state` }
            )
            .toBe(true);

        const isClosed = await marketInfoClosedTag.isVisible().catch(() => false);

        if (isClosed) {
            if (status === 'open') {
                throw new Error(`[${label}] Always-open market should not show Closed on Market Info`);
            }
            // session_gated and outside trading hours — no live feed to verify; move on
            return;
        }

        await expect(marketInfoPrice, `[${label}] Live price should be visible on Market Info`).toBeVisible();
        const initialPrice = ((await marketInfoPrice.textContent()) ?? '').trim();
        expect(initialPrice, `[${label}] Market Info price should be non-empty`).not.toBe('');
        expect(initialPrice, `[${label}] Market Info price should look numeric`).toMatch(/[\d.,]+/);

        await expect
            .poll(
                async () => {
                    const current = ((await marketInfoPrice.textContent()) ?? '').trim();
                    return current !== '' && current !== initialPrice;
                },
                { message: `[${label}] Market Info price should tick from the live feed`, timeout: 15_000 }
            )
            .toBe(true);
    }
}
