/**
 * @name Notifications — No bell icon in DTrader trade page header
 * @id notifications/verify-no-bell-on-trade-page
 * @flow G1 — No bell icon in DTrader trade page header
 * @coverage @notifications @desktop @mobile
 */

import { expect, test } from '../../fixtures/fixtures';
import { NavigationUtils } from '../../e2e-tests-core/utils';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Notifications — No bell on trade page', { tag: ['@notifications', '@desktop', '@mobile'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_MOBILE' : 'TEST_EMAIL';
        const email = process.env[emailVar];

        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage, tradeBasePage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
        await tradeBasePage.gotoTradePage();
        await NavigationUtils.waitForDerivApiSettled(page);
    });

    test('VERIFY bell icon is absent from trade page header/sidebar', async ({ notificationsPage }) => {
        const hasBell = await notificationsPage.tradersHubShowNotifications.isVisible().catch(() => false);
        expect(hasBell, 'Traders Hub notifications wrapper should not be on trade page').toBeFalsy();
    });
});
