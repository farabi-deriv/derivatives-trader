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
        page,
        tradeRiseFallPage,
        positionsPage,
        contractDetailsPage,
        notificationsPage,
    }) => {
        // Minutes (not Ticks): tick Rise/Fall does not offer resale, so Close stays disabled.
        // Do not require an empty Open tab — leftover unsellable positions must not block this flow.
        await tradeRiseFallPage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall');
        await tradeRiseFallPage.selectDuration('Minutes', '5 min');
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        await tradeRiseFallPage.clickBuy();
        await expect(
            tradeRiseFallPage.purchaseNotification.first(),
            'Purchase notification should confirm the buy before closing'
        ).toBeVisible({ timeout: 15_000 });

        await positionsPage.goToPositions();
        const riseCard = page
            .getByTestId('dt_contract_card')
            .filter({ hasText: 'Volatility 100 Index' })
            .filter({ hasText: 'Rise' })
            .first();
        await expect(riseCard, 'Bought Rise/Fall contract should appear in Open positions').toBeVisible({
            timeout: 15_000,
        });
        await riseCard.click();
        await NavigationUtils.waitForDerivApiSettled(page);
        await contractDetailsPage.sellContract();

        await expect(
            notificationsPage.sellBanner.first(),
            'Trade sell / contract closed notification banner should appear'
        ).toBeVisible({ timeout: 15_000 });
    });
});
