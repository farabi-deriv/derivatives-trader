/**
 * @name     Positions — Page Load, Views & Navigation
 * @id       flow-1, flow-2, flow-4, flow-7
 * @flow     playwright/flows/positions/flow.md#flow-1--open-positions-list-loads-on-mobile
 * @coverage playwright/flows/positions/coverage.md
 */
import { test, expect, redirectionHelpers } from '../../fixtures/fixtures';
import { NavigationUtils } from '../../utils';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Positions — Page Load & Navigation', { tag: ['@positions', '@smoke', '@desktop', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_MOBILE' : 'TEST_EMAIL';
        const email = process.env[emailVar];

        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    test.afterEach(async ({ page, positionsPage, isMobileViewport }) => {
        if (isMobileViewport) {
            await redirectionHelpers.redirectTo(page, '/positions');
        }
        await positionsPage.closeAllOpenContracts().catch(() => {});
    });

    test('VERIFY open positions list loads with contract cards on mobile', async ({
        page,
        tradeRiseFallPage,
        positionsPage,
        isMobileViewport,
    }) => {
        if (!isMobileViewport) {
            test.skip(true, 'Flow 1 is mobile-only; desktop positions use sidebar flyout');
        }

        // Ensure at least one open contract exists with 5m duration
        await tradeRiseFallPage.gotoTradePage();
        await tradeRiseFallPage.selectDuration('Minutes', '5 min');
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        await expect(tradeRiseFallPage.purchaseButton, 'Purchase button should be visible').toBeVisible();
        await tradeRiseFallPage.purchaseButton.click();
        await expect(tradeRiseFallPage.purchaseNotification, 'Purchase notification should appear').toBeVisible();

        await redirectionHelpers.redirectTo(page, '/positions');
        await expect(positionsPage.positionsOpenTab, 'Open tab should be active by default').toBeVisible();
        await expect(
            positionsPage.firstContractCard,
            'At least one contract card should be visible in Open positions'
        ).toBeVisible();
        await expect(positionsPage.mobileTotalProfitLoss, 'Total P/L summary should be visible').toBeVisible();
    });

    test('VERIFY positions flyout opens from sidebar on desktop', async ({
        tradeRiseFallPage,
        positionsPage,
        isMobileViewport,
    }) => {
        if (isMobileViewport) {
            test.skip(true, 'Flow 2 is desktop-only; mobile positions use /positions route');
        }

        // Ensure at least one open contract exists on desktop
        await tradeRiseFallPage.gotoTradePage();
        await tradeRiseFallPage.selectDuration('Minutes', '5 min');
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        await tradeRiseFallPage.clickBuy();

        await positionsPage.sidebarPositionsButton.click();
        await expect(positionsPage.positionsFlyout, 'Positions flyout should be visible').toBeVisible();
        await expect(positionsPage.positionsTitle, 'Flyout title should read "Positions"').toHaveText('Positions');
        await expect(
            positionsPage.firstContractCard,
            'At least one contract card should be visible in flyout'
        ).toBeVisible();
        await expect(positionsPage.footerTotalPL, 'Flyout footer with Total P/L should be visible').toBeVisible();
    });

    test('VERIFY closed positions tab shows contracts grouped by date on mobile', async ({
        page,
        positionsPage,
        isMobileViewport,
    }) => {
        if (!isMobileViewport) {
            test.skip(true, 'Flow 4 is mobile-only; desktop positions use sidebar flyout');
        }

        await redirectionHelpers.redirectTo(page, '/positions');
        await positionsPage.clickClosedTab();
        await NavigationUtils.waitForDerivApiSettled(page);

        await expect(
            positionsPage.closedPositionsDateHeader.first(),
            'Date section header should be visible'
        ).toBeVisible();
        await expect(positionsPage.firstMobileClosedCard, 'Closed contract card should be visible').toBeVisible();
        await expect(positionsPage.mobileClosedCardStatusText, 'Closed card should show "Closed" status').toBeVisible();
    });

    test('VERIFY clicking a contract card navigates to contract details on mobile', async ({
        page,
        tradeRiseFallPage,
        positionsPage,
        isMobileViewport,
    }) => {
        if (!isMobileViewport) {
            test.skip(true, 'Flow 7 is mobile-only; desktop positions cards are non-navigable divs');
        }

        // Buy contract
        await tradeRiseFallPage.gotoTradePage();
        await tradeRiseFallPage.selectDuration('Minutes', '5 min');
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        await expect(tradeRiseFallPage.purchaseButton, 'Purchase button should be visible').toBeVisible();
        await tradeRiseFallPage.purchaseButton.click();
        await expect(tradeRiseFallPage.purchaseNotification, 'Purchase notification should appear').toBeVisible();

        // Navigate to positions and open details
        await redirectionHelpers.redirectTo(page, '/positions');
        await expect(positionsPage.firstContractCard, 'Open contract card should be visible').toBeVisible();
        await positionsPage.firstContractCard.click();
        await NavigationUtils.waitForDerivApiSettled(page);

        await expect(page.getByText('Contract details'), 'Contract details header should be visible').toBeVisible();
        await expect(positionsPage.firstContractCard, 'Contract card should be visible in details view').toBeVisible();

        await page.goBack();
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(positionsPage.firstContractCard, 'Should return to positions list').toBeVisible();
    });
});
