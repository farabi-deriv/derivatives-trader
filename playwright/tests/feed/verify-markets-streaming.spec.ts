/**
 * @name     Category markets — live feed ticks on Market Info
 * @id       flow-1.1–1.5
 * @flow     playwright/flows/feed/flow.md#shared-category-walk-flows-11-15
 * @coverage playwright/flows/feed/coverage.md
 *
 * One file, five category tests, serial mode — avoids parallel launches that trip
 * staging's requests-per-second rate limit on the initial trade-page load.
 */
import { test } from '../../fixtures/fixtures';

test.describe('Feed', { tag: ['@desktop', '@mobile', '@feed', '@smoke', '@production'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async () => {
        if (!process.env.BASE_URL) throw new Error('BASE_URL is not set in playwright/.env');
    });

    test('VERIFY Feed for Derived markets', async ({ tradeParametersPage, marketSelectionPage, feedPage }) => {
        await feedPage.verifyCategoryMarkets(marketSelectionPage, tradeParametersPage, 'Derived');
    });

    test('VERIFY Feed for Forex markets', async ({ tradeParametersPage, marketSelectionPage, feedPage }) => {
        await feedPage.verifyCategoryMarkets(marketSelectionPage, tradeParametersPage, 'Forex');
    });

    test('VERIFY Feed for Stocks & indices markets', async ({ tradeParametersPage, marketSelectionPage, feedPage }) => {
        await feedPage.verifyCategoryMarkets(marketSelectionPage, tradeParametersPage, 'Stocks & indices');
    });

    test('VERIFY Feed for Cryptocurrencies markets', async ({ tradeParametersPage, marketSelectionPage, feedPage }) => {
        await feedPage.verifyCategoryMarkets(marketSelectionPage, tradeParametersPage, 'Cryptocurrencies');
    });

    test('VERIFY Feed for Commodities markets', async ({ tradeParametersPage, marketSelectionPage, feedPage }) => {
        await feedPage.verifyCategoryMarkets(marketSelectionPage, tradeParametersPage, 'Commodities');
    });
});
