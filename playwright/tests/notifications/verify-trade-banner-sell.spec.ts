/**
 * @name Notifications — Trade banner: sell notification appears after contract close
 * @id notifications/verify-trade-banner-sell
 * @flow Flow 2 — Trade banner: sell notification appears after contract close
 * @coverage @notifications @mobile
 */

import { expect, test } from '../../fixtures/fixtures';
import { NavigationUtils } from '../../e2e-tests-core/utils';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Notifications — Trade banner sell', { tag: ['@notifications', '@mobile'] }, () => {
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

    test('VERIFY sell notification banner appears after closing contract', async ({
        tradeRiseFallPage,
        positionsPage,
        notificationsPage,
    }) => {
        // Step 1: Buy a short duration contract if no positions exist
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        await expect(tradeRiseFallPage.purchaseButton, 'Purchase button should be visible').toBeVisible();
        await tradeRiseFallPage.purchaseButton.click();

        // Step 2: Navigate to /positions and close the open contract
        await positionsPage.goToPositions();
        await expect(positionsPage.firstContractCard, 'Open contract card should be visible in positions').toBeVisible({
            timeout: 15000,
        });
        await positionsPage.closeFirstContract();

        // Step 3: Assert the contract-closed / sell notification banner appears
        await expect(
            notificationsPage.sellBanner.first(),
            'Trade sell / contract closed notification banner should appear'
        ).toBeVisible({ timeout: 15000 });
    });
});
