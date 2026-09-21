/**
 * @name     Forex — live feed ticks on Market Info
 * @id       flow-1.2
 * @flow     playwright/flows/feed/flow.md#flow-12--forex--live-feed-or-closed-market-state
 * @coverage playwright/flows/feed/coverage.md
 */
import { test } from '../../fixtures/fixtures';

test.describe('Feed', { tag: ['@desktop', '@mobile', '@feed', '@smoke', '@production'] }, () => {
    test.beforeAll(async () => {
        if (!process.env.BASE_URL) throw new Error('BASE_URL is not set in playwright/.env');
    });

    test('VERIFY Forex markets show live price feed or closed-market state', async ({
        tradeParametersPage,
        marketSelectionPage,
        feedPage,
    }) => {
        await feedPage.verifyCategoryMarkets(marketSelectionPage, tradeParametersPage, 'Forex');
    });
});
