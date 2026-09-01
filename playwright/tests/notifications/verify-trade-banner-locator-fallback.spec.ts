/**
 * @name Notifications — Trade banner locator fallback
 * @id notifications/verify-trade-banner-locator-fallback
 * @flow G2 — Trade banner has no data-testid
 * @coverage @notifications @mobile
 */

import { expect, test } from '../../fixtures/fixtures';
import { NavigationUtils } from '../../e2e-tests-core/utils';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Notifications — Trade banner locator fallback', { tag: ['@notifications', '@mobile'] }, () => {
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

    for (const option of ['Rise', 'Fall'] as const) {
        test(`VERIFY CSS selector queries trade banner element reliably for ${option} trade`, async ({
            tradeRiseFallPage,
        }) => {
            await tradeRiseFallPage.setStake('1.00');
            await tradeRiseFallPage.clickRiseFallOption(option);
            await expect(tradeRiseFallPage.purchaseButton, 'Purchase button should be visible').toBeVisible();
            await tradeRiseFallPage.purchaseButton.click();

            // Test Case 1: Fallback locator queries purchase banner element reliably
            await expect(
                tradeRiseFallPage.purchaseNotification.first(),
                `Purchase banner should be found and visible via CSS fallback locator for ${option} trade`
            ).toBeVisible({ timeout: 15000 });

            // Test Case 2: Banner auto-hides after timeout
            await expect(
                tradeRiseFallPage.purchaseNotification.first(),
                `Purchase banner should auto-hide after display timeout for ${option} trade`
            ).not.toBeVisible({ timeout: 10000 });
        });
    }
});
