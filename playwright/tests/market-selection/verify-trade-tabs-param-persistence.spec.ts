/**
 * @name     Multiple trade tabs — trade params persist per tab across reload
 * @id       flow-25
 * @flow     playwright/flows/market-selection/flow.md#flow-25--trade-params-persist-per-tab-across-reload
 * @coverage playwright/flows/market-selection/coverage.md
 */
import { test, expect } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Market Selection', { tag: ['@desktop', '@mobile', '@market-selection'] }, () => {
    test.beforeAll(async () => {
        if (!process.env.BASE_URL) throw new Error('BASE_URL is not set in playwright/.env');
    });

    test.beforeEach(async ({ page, tradeParametersPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await tradeParametersPage.gotoTradePage();
    });

    /**
     * Issue #1186 — each (symbol, contract_type) tab owns its stake + duration in
     * `tab_trade_params_v2`. Editing/reloading tab B must not rewrite tab A's saved values.
     */
    test('VERIFY stake and duration persist per tab across reload and do not leak between tabs', async ({
        tradeParametersPage,
        marketSelectionPage,
    }) => {
        await tradeParametersPage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall');
        await tradeParametersPage.setStake('25.00');
        await tradeParametersPage.selectDuration('Minutes', '5 min');
        const { stake: tabAStake, duration: tabADuration } =
            await tradeParametersPage.verifyStakeAndDurationPersistAcrossReload(25, /^5\s+min(utes)?$/);

        await tradeParametersPage.selectMarketAndTradeType('Bull Market Index', 'Rise/Fall', {
            openInNewTab: true,
        });
        await expect(marketSelectionPage.marketTabs, 'Two tabs should be open').toHaveCount(2);
        await tradeParametersPage.expectCommittedStakeAndDuration(tabAStake, tabADuration, 'on a newly opened tab', {
            differs: true,
        });

        await tradeParametersPage.setStake('35.00');
        await tradeParametersPage.selectDuration('Minutes', '10 min');
        const { stake: tabBStake, duration: tabBDuration } =
            await tradeParametersPage.verifyStakeAndDurationPersistAcrossReload(35, /^10\s+min(utes)?$/);
        await expect(
            marketSelectionPage.marketTab('Bull Market Index', 'Rise/Fall'),
            'Bull Market Index tab should still be present after reload'
        ).toBeVisible();
        await expect(tradeParametersPage.activeMarketTab, 'Tab B should remain active after reload').toContainText(
            'Bull Market Index'
        );

        await marketSelectionPage.switchToMarketTab('Volatility 100 Index', 'Rise/Fall');
        await tradeParametersPage.expectCommittedStakeAndDuration(
            tabAStake,
            tabADuration,
            'after switching back to tab A — tab B edits must not rewrite tab A'
        );

        await marketSelectionPage.switchToMarketTab('Bull Market Index', 'Rise/Fall');
        await tradeParametersPage.expectCommittedStakeAndDuration(
            tabBStake,
            tabBDuration,
            'after switching back to tab B'
        );
    });
});
