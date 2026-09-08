/**
 * @name Notifications — Trade banner: purchase notification appears after buy
 * @id notifications/verify-trade-banner-purchase
 * @flow Flow 1 — Trade banner: purchase notification appears after contract buy
 * @coverage @notifications @mobile
 */

import { expect, test } from '../../fixtures/fixtures';
import { NavigationUtils } from '../../e2e-tests-core/utils';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Notifications — Trade banner purchase', { tag: ['@notifications', '@mobile'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_MOBILE' : 'TEST_EMAIL';
        const email = process.env[emailVar];

        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage, tradeRiseFallPage, isMobileViewport }) => {
        if (!isMobileViewport) {
            test.skip(true, 'Trade banner notifications are mobile (AppV2) only');
        }
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
        await tradeRiseFallPage.gotoTradePage();
        await NavigationUtils.waitForDerivApiSettled(page);
    });

    test('VERIFY purchase notification banner appears after contract buy', async ({
        tradeRiseFallPage,
        notificationsPage,
    }) => {
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        // Buy contract using trade purchase button wrapper
        await expect(tradeRiseFallPage.purchaseButton, 'Purchase button should be visible').toBeVisible();
        await tradeRiseFallPage.purchaseButton.click();

        // Assert purchase banner element appears
        await expect(
            notificationsPage.purchaseBanner.first(),
            'Trade purchase notification banner should appear at the top after contract buy'
        ).toBeVisible({ timeout: 15000 });
    });
});
