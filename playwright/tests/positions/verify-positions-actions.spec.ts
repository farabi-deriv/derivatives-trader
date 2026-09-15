/**
 * @name     Positions — In-Position Card Actions (Close & Cancel)
 * @id       flow-8, flow-9
 * @flow     playwright/flows/positions/flow.md#flow-8--close-open-contract-from-positions-card-swipe-action
 * @coverage playwright/flows/positions/coverage.md
 */
import { test, expect, redirectionHelpers } from '../../fixtures/fixtures';
import { NavigationUtils } from '../../utils';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Positions — Card Actions', { tag: ['@positions', '@regression', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_MOBILE' : 'TEST_EMAIL';
        const email = process.env[emailVar];

        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage, isMobileViewport }) => {
        if (!isMobileViewport) return;
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    test.afterEach(async ({ page, positionsPage, isMobileViewport }) => {
        if (!isMobileViewport) return;
        await redirectionHelpers.redirectTo(page, '/positions');
        await positionsPage.closeAllOpenContracts().catch(() => {});
    });

    test('VERIFY swiping left on a contract card allows closing the position on mobile', async ({
        page,
        tradeRiseFallPage,
        positionsPage,
        isMobileViewport,
    }) => {
        if (!isMobileViewport) {
            test.skip(true, 'Flow 8 is mobile-only; desktop contracts use inline Close button');
        }

        // Buy 5m Rise/Fall contract
        await tradeRiseFallPage.gotoTradePage();
        await tradeRiseFallPage.selectDuration('Minutes', '5 min');
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        await expect(tradeRiseFallPage.purchaseButton, 'Purchase button should be visible').toBeVisible();
        await tradeRiseFallPage.purchaseButton.click();
        await expect(tradeRiseFallPage.purchaseNotification, 'Purchase notification should appear').toBeVisible();

        await redirectionHelpers.redirectTo(page, '/positions');
        await expect(positionsPage.firstContractCard, 'Open contract card should be visible').toBeVisible();

        await positionsPage.closeFirstContract();
    });

    test('VERIFY swiping left on a multiplier contract with DC allows cancelling on mobile', async ({
        page,
        tradeMultipliersPage,
        positionsPage,
        isMobileViewport,
    }) => {
        if (!isMobileViewport) {
            test.skip(true, 'Flow 9 is mobile-only; desktop multiplier contracts use inline Cancel button');
        }

        // Buy Multiplier with Deal Cancellation
        await tradeMultipliersPage.gotoTradePage();
        await tradeMultipliersPage.selectMarketAndTradeType('Volatility 100 (1s) Index', 'Multipliers');
        await tradeMultipliersPage.clickUpDownOption('Up');
        await tradeMultipliersPage.setStake('1.00');
        await tradeMultipliersPage.setRiskManagement({ dealCancellation: '5 min' });
        await tradeMultipliersPage.clickMultipliersBuy();
        await expect(tradeMultipliersPage.purchaseNotification, 'Purchase notification should appear').toBeVisible();

        await redirectionHelpers.redirectTo(page, '/positions');
        await expect(positionsPage.firstContractCard, 'Open contract card should be visible').toBeVisible();

        await expect(
            positionsPage.mobileContractCardCancelButton,
            'Mobile cancel button should be attached to card wrapper'
        ).toBeAttached();
        await positionsPage.mobileContractCardCancelButton.click({ force: true });
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(
            positionsPage.emptyStateIcon,
            'Empty state icon should appear after cancelling contract'
        ).toBeVisible();
    });
});
