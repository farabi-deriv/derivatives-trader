/**
 * @name     All markets — live feed ticks on Market Info
 * @id       flow-1
 * @flow     playwright/flows/feed/flow.md#flow-1--all-markets-live-feed-ticks-on-market-info-for-every-tradeable-symbol--feedverify-all-markets-streamingspects
 * @coverage playwright/flows/feed/coverage.md
 */
import { test, expect } from '../../fixtures/fixtures';
import { FeedPage } from '../../pages/FeedPage';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Feed', { tag: ['@desktop', '@mobile', '@feed', '@smoke', '@production'] }, () => {
    test.beforeAll(async () => {
        if (!process.env.BASE_URL) throw new Error('BASE_URL is not set in playwright/.env');
    });

    test('VERIFY all markets show live price feed or closed-market state', async ({
        page,
        tradeParametersPage,
        marketSelectionPage,
        feedPage,
    }) => {
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
    });
});
