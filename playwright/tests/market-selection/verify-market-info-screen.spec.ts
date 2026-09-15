/**
 * @name     Market selection — Market Info screen
 * @id       flow-7
 * @flow     playwright/flows/market-selection/flow.md#flow-7--market-info-screen
 * @coverage playwright/flows/market-selection/coverage.md
 */
import { test, expect } from '../../fixtures/fixtures';
import { MARKET_INFO_DESCRIPTION_CASES } from '../../pages/market-info-description-cases';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Market Selection', { tag: ['@desktop', '@mobile', '@market-selection'] }, () => {
    test.beforeAll(async () => {
        if (!process.env.BASE_URL) throw new Error('BASE_URL is not set in playwright/.env');
    });

    test.beforeEach(async ({ page, tradeParametersPage, marketSelectionPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await tradeParametersPage.gotoTradePage();
        await marketSelectionPage.addMarketButton.click();
        await expect(marketSelectionPage.marketSelectionPanel, 'Picker should be open').toBeVisible();

        await marketSelectionPage.openMarketSearch();
        await marketSelectionPage.marketSearchInput.fill('Volatility 100 Index');
        await expect(
            marketSelectionPage.marketSearchResultRow('Volatility 100 Index', 'Rise/Fall'),
            'Search should locate the market'
        ).toBeVisible();
    });

    test('VERIFY Info screen shows market details and a Trade-on CTA commits the market', async ({
        tradeParametersPage,
        marketSelectionPage,
    }) => {
        for (let index = 0; index < MARKET_INFO_DESCRIPTION_CASES.length; index++) {
            const { market, description } = MARKET_INFO_DESCRIPTION_CASES[index];
            await test.step(market, async () => {
                if (index > 0) {
                    await marketSelectionPage.paceMarketInfoLookup();
                }
                await marketSelectionPage.verifyMarketInfoDescription(market, description);
            });
        }

        await test.step('Trade-on CTA commits market', async () => {
            await marketSelectionPage.openMarketInfoFromSearch('Volatility 100 Index');
            await expect(
                marketSelectionPage.marketInfoTradeOnSection,
                '"Trade on" section should list available trade types'
            ).toBeVisible();
            await expect(
                marketSelectionPage.marketInfoTradeOnCard('Multipliers'),
                'Multipliers should be one of the Trade-on CTAs for a synthetic index'
            ).toBeVisible();

            await marketSelectionPage.marketInfoTradeOnCard('Multipliers').click();
            await expect(
                marketSelectionPage.marketSelectionPanel,
                'Picker should close after selecting a Trade-on CTA'
            ).not.toBeVisible();
            await expect(
                tradeParametersPage.activeMarketTab,
                'Active tab should reflect the market committed from the Trade-on CTA'
            ).toContainText('Volatility 100 Index');
            await expect(
                tradeParametersPage.activeMarketTab,
                'Active tab should reflect the Multipliers trade type'
            ).toContainText('Multipliers');
        });
    });

    test('VERIFY the Favourite toggle on the Info screen updates independently of the row', async ({
        marketSelectionPage,
    }) => {
        await marketSelectionPage.openMarketInfo('Volatility 100 Index');
        await expect(marketSelectionPage.marketInfoScreen, 'Info screen should be visible').toBeVisible();

        await marketSelectionPage.marketInfoFavouriteButton.click();
        await expect(
            marketSelectionPage.marketInfoFavouriteButton,
            'Info-screen Favourite button should flip to Unfavourite'
        ).toContainText('Unfavourite');

        // Clean up so this test doesn't leave a persistent favourite for other tests/runs.
        await marketSelectionPage.marketInfoFavouriteButton.click();
        await expect(
            marketSelectionPage.marketInfoFavouriteButton,
            'Info-screen Favourite button should flip back to Favourite'
        ).toContainText('Favourite');
    });

    test('VERIFY the Back button returns to the previous browse view without committing', async ({
        tradeParametersPage,
        marketSelectionPage,
    }) => {
        const activeTabTextBefore = (await tradeParametersPage.activeMarketTab.textContent()) ?? '';

        await marketSelectionPage.openMarketInfo('Volatility 100 Index');
        await expect(marketSelectionPage.marketInfoScreen, 'Info screen should be visible').toBeVisible();

        await marketSelectionPage.marketInfoBackButton.click();
        await expect(marketSelectionPage.marketInfoScreen, 'Info screen should close after Back').not.toBeVisible();
        await expect(marketSelectionPage.marketSelectionPanel, 'Picker itself should remain open').toBeVisible();
        await expect(
            tradeParametersPage.activeMarketTab,
            'Active tab should be unchanged — Back does not commit anything'
        ).toHaveText(activeTabTextBefore);
    });
});
