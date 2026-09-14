/**
 * @name     Closed Market
 * @id       flow-15
 * @flow     playwright/flows/trade/flow.md#flow-15--market-closed--buy-hidden-params-disabled-countdown
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Trade — Closed Market', { tag: ['@trade', '@desktop', '@mobile'] }, () => {
    test.beforeEach(async ({ page, loginPage, tradeParametersPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login();
        await tradeParametersPage.gotoTradePage();
    });

    test('VERIFY closed market hides purchase button and shows reopening countdown', async ({
        tradeParametersPage,
    }) => {
        const selection = await tradeParametersPage.selectClosedMarketFromPicker();
        if (!selection) {
            test.skip(true, 'No session-gated market is CLOSED right now — rerun outside exchange hours');
            return;
        }

        await tradeParametersPage.verifyClosedMarketTradeState(selection.market, selection.tradeType);
    });
});
