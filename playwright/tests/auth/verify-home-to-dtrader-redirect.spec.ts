/**
 * @name     Home → Options → DTrader redirect
 * @flow     playwright/flows/auth/flow.md#flow-4
 * @coverage playwright/flows/auth/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { HomePage } from '../../pages/HomePage';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Home to DTrader redirect', { tag: ['@auth', '@smoke', '@desktop', '@mobile', '@production'] }, () => {
    test.beforeAll(async () => {
        if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
            throw new Error('Missing required env vars: TEST_EMAIL and TEST_PASSWORD must be set in playwright/.env');
        }
    });

    test.beforeEach(async ({ page, loginPage, tradeBasePage, homePage, optionsPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await HomePage.seedLocalStorageOnOrigin(page);

        await loginPage.login();
        await tradeBasePage.verifySuccessfulLogin();

        await tradeBasePage.clickHome();
        await homePage.dismissPostLoginPopupsIfPresent();
        await homePage.verifyOnHomeDashboard();

        await homePage.navigateToOptionsFromSidebar();
        await optionsPage.verifyOptionsPageLoaded();
    });

    test('VERIFY Demo tab Trade redirects to DTrader demo account', async ({ optionsPage, tradeBasePage }) => {
        await optionsPage.switchToDemoTab();
        await optionsPage.clickTradeBanner();
        await tradeBasePage.verifyLandedOnDTraderAs('demo');
    });

    test('VERIFY Real tab Trade redirects to DTrader real account', async ({ optionsPage, tradeBasePage }) => {
        await optionsPage.switchToRealTab();
        await optionsPage.clickTradeBanner();
        await tradeBasePage.verifyLandedOnDTraderAs('real');
    });
});
