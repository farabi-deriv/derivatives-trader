/**
 * @name     Multiple trade tabs — max tab limit enforced (4 mobile / 7 desktop)
 * @id       flow-24
 * @flow     playwright/flows/market-selection/flow.md#flow-24--max-tab-limit-enforced-4-on-mobile-7-on-desktop
 * @coverage playwright/flows/market-selection/coverage.md
 */
import { test, expect } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';

// Always-open synthetic indices with identical labels on both viewports (no mobile-label override),
// so the same pool can fill tabs up to either platform's cap without per-viewport branching.
const MARKET_POOL = [
    'Volatility 10 Index',
    'Volatility 25 Index',
    'Volatility 50 Index',
    'Volatility 75 Index',
    'Volatility 100 Index',
    'Jump 10 Index',
    'Jump 25 Index',
];

test.describe(
    'Market Selection',
    { tag: ['@desktop', '@mobile', '@market-selection', '@smoke', '@production'] },
    () => {
        test.beforeAll(async () => {
            if (!process.env.BASE_URL) throw new Error('BASE_URL is not set in playwright/.env');
        });

        test.beforeEach(async ({ page, tradeParametersPage }) => {
            await TradeBasePage.seedLocalStorageOnOrigin(page);
            await tradeParametersPage.gotoTradePage();
        });

        test('VERIFY Add-market is disabled at the platform cap and recovers after closing one tab', async ({
            tradeParametersPage,
            marketSelectionPage,
        }) => {
            const max = marketSelectionPage.maxOpenMarkets;

            // One default tab is already open — fill up to (max - 1) more.
            for (let i = 0; i < max - 1; i++) {
                await tradeParametersPage.selectMarketAndTradeType(MARKET_POOL[i], 'Rise/Fall', {
                    openInNewTab: true,
                });
            }
            await expect(marketSelectionPage.marketTabs, `Should have ${max} tabs open at the cap`).toHaveCount(max);

            await expect(
                marketSelectionPage.addMarketButton,
                'Add-market button should report aria-disabled'
            ).toHaveAttribute('aria-disabled', 'true');

            await marketSelectionPage.verifyAddMarketBlockedAtCap(max);

            // Recovery: closing one tab should re-enable Add-market and allow a new tab.
            await marketSelectionPage.removeMarketTab(MARKET_POOL[0], 'Rise/Fall');
            await expect(marketSelectionPage.marketTabs, 'One tab should be closed').toHaveCount(max - 1);
            await expect(
                marketSelectionPage.addMarketButton,
                'Add-market should be enabled again below the cap'
            ).toHaveAttribute('aria-disabled', 'false');

            await tradeParametersPage.selectMarketAndTradeType('Jump 50 Index', 'Rise/Fall', { openInNewTab: true });
            await expect(
                marketSelectionPage.marketTabs,
                'A new tab should be addable again, bringing the count back to the cap'
            ).toHaveCount(max);
        });
    }
);
