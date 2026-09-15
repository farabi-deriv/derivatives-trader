/**
 * @name     Invalid URL — Unsupported market and trade type modals (V2 copy)
 * @id       flow-18
 * @flow     playwright/flows/trade/flow.md#flow-18--invalid-url-unsupported-market-and-trade-type-modals
 * @coverage playwright/flows/trade/coverage.md
 */
import { test, expect } from '../../fixtures/fixtures';

const INVALID_TRADE_TYPE_QUERY = 'trade_type=high_lowsd&chart_type=area&interval=1t&symbol=1HZ100V';

const INVALID_MARKET_QUERY = 'symbol=NOT_A_REAL_MARKET&trade_type=rise_fall&chart_type=area&interval=1t';

test.describe('Trade — Invalid URL', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test('VERIFY Unsupported trade type modal shows correct copy and dismisses', async ({ tradeParametersPage }) => {
        await tradeParametersPage.gotoTradePageWithQuery(INVALID_TRADE_TYPE_QUERY);
        await tradeParametersPage.verifyAndDismissInvalidTradeTypeModal();

        await expect(
            tradeParametersPage.activeMarketTab,
            'Default market tab should remain visible after dismissing the modal'
        ).toBeVisible();
    });

    test('VERIFY Unsupported market modal shows correct copy and dismisses', async ({ tradeParametersPage }) => {
        await tradeParametersPage.gotoTradePageWithQuery(INVALID_MARKET_QUERY);
        await tradeParametersPage.verifyAndDismissInvalidMarketModal();

        await expect(
            tradeParametersPage.activeMarketTab,
            'Default market tab should remain visible after dismissing the modal'
        ).toBeVisible();
    });
});
