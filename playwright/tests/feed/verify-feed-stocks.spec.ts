/**
 * @name     Stocks & indices markets — live feed ticks on Market Info
 * @id       flow-3
 * @flow     playwright/flows/feed/flow.md#shared-category-walk-flows-15
 * @coverage playwright/flows/feed/coverage.md
 *
 * Shared lock with other feed specs: `feed-market-info`.
 */
import { test } from '../../fixtures/fixtures';

test.describe(
    'Feed',
    {
        tag: ['@desktop', '@mobile', '@feed', '@smoke', '@production'],
        lock: 'feed-market-info',
    },
    () => {
        test.beforeAll(async () => {
            if (!process.env.BASE_URL) throw new Error('BASE_URL is not set in playwright/.env');
        });

        test('VERIFY Feed for Stocks & indices markets', async ({
            tradeParametersPage,
            marketSelectionPage,
            feedPage,
        }) => {
            await feedPage.verifyCategoryMarkets(marketSelectionPage, tradeParametersPage, 'Stocks & indices');
        });
    }
);
