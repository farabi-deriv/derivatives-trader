/**
 * @name     Reports — Open Positions Tab & Contract Filters
 * @id       flow-2, flow-3, flow-4, gap-g1
 * @flow     playwright/flows/reports/flow.md#flow-2--open-positions-tab-options-contracts-visible
 * @coverage playwright/flows/reports/coverage.md
 */

import { expect, test, redirectionHelpers } from '../../fixtures/fixtures';
import { NavigationUtils } from '../../utils';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Reports — Open Positions', { tag: ['@reports', '@smoke', '@regression', '@desktop', '@mobile'] }, () => {
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

    test.afterEach(async ({ positionsPage }) => {
        await positionsPage.closeAllOpenContracts().catch(() => {});
    });

    test('VERIFY open positions tab shows Options contracts by default', async ({
        page,
        reportsPage,
        tradeRiseFallPage,
        isMobileViewport,
    }) => {
        // Ensure at least one open Options contract exists
        await tradeRiseFallPage.gotoTradePage();
        await tradeRiseFallPage.selectDuration('Minutes', '5 min');
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        if (isMobileViewport) {
            await expect(tradeRiseFallPage.purchaseButton, 'Purchase button should be visible').toBeVisible();
            await tradeRiseFallPage.purchaseButton.click();
            await expect(tradeRiseFallPage.purchaseNotification, 'Purchase notification should appear').toBeVisible();
        } else {
            await tradeRiseFallPage.clickBuy();
            await NavigationUtils.waitForDerivApiSettled(page);
        }

        await redirectionHelpers.redirectTo(page, '/reports/positions');
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(reportsPage.reportsHeaderTitle, 'Reports overlay title should be visible').toBeVisible();

        await expect(
            reportsPage.tableRows.first(),
            'At least one Options contract row should be visible on Open Positions tab'
        ).toBeVisible();
    });

    test('VERIFY switching to Multipliers filter shows multiplier contracts', async ({
        page,
        reportsPage,
        tradeRiseFallPage,
        tradeMultipliersPage,
        isMobileViewport,
    }) => {
        // Seed an Options contract and a Multiplier contract to ensure contract_types_list > 1
        await tradeRiseFallPage.gotoTradePage();
        await tradeRiseFallPage.selectDuration('Minutes', '5 min');
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        if (isMobileViewport) {
            await expect(tradeRiseFallPage.purchaseButton, 'Purchase button should be visible').toBeVisible();
            await tradeRiseFallPage.purchaseButton.click();
            await expect(tradeRiseFallPage.purchaseNotification, 'Purchase notification should appear').toBeVisible();
        } else {
            await tradeRiseFallPage.clickBuy();
            await NavigationUtils.waitForDerivApiSettled(page);
        }

        await tradeMultipliersPage.gotoTradePage();
        await tradeMultipliersPage.selectMarketAndTradeType('Volatility 100 (1s) Index', 'Multipliers');
        await tradeMultipliersPage.clickUpDownOption('Up');
        await tradeMultipliersPage.setStake('1.00');
        await tradeMultipliersPage.clickMultipliersBuy();
        if (isMobileViewport) {
            await expect(
                tradeMultipliersPage.purchaseNotification,
                'Purchase notification should appear'
            ).toBeVisible();
        } else {
            await NavigationUtils.waitForDerivApiSettled(page);
        }

        await redirectionHelpers.redirectTo(page, '/reports/positions');
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(reportsPage.reportsHeaderTitle, 'Reports overlay title should be visible').toBeVisible();

        await reportsPage.selectContractTypeFilter('Multipliers');
        await NavigationUtils.waitForDerivApiSettled(page);

        await expect(
            reportsPage.tableRows.first(),
            'Multiplier contract row should be visible after filter'
        ).toBeVisible();
        await expect(
            reportsPage.tableRows.first(),
            'Filtered row should show Multiplier trade type or details'
        ).toContainText(/Multiplier|Up|x\d+|Vol/i);
    });

    test('VERIFY switching to Accumulators filter displays growth rate sub-filter', async ({
        page,
        reportsPage,
        tradeRiseFallPage,
        tradeMultipliersPage,
        isMobileViewport,
    }) => {
        // Seed an Options contract and a Multiplier contract to ensure contract_types_list > 1
        await tradeRiseFallPage.gotoTradePage();
        await tradeRiseFallPage.selectDuration('Minutes', '5 min');
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        if (isMobileViewport) {
            await expect(tradeRiseFallPage.purchaseButton, 'Purchase button should be visible').toBeVisible();
            await tradeRiseFallPage.purchaseButton.click();
            await expect(tradeRiseFallPage.purchaseNotification, 'Purchase notification should appear').toBeVisible();
        } else {
            await tradeRiseFallPage.clickBuy();
            await NavigationUtils.waitForDerivApiSettled(page);
        }

        await tradeMultipliersPage.gotoTradePage();
        await tradeMultipliersPage.selectMarketAndTradeType('Volatility 100 (1s) Index', 'Multipliers');
        await tradeMultipliersPage.clickUpDownOption('Up');
        await tradeMultipliersPage.setStake('1.00');
        await tradeMultipliersPage.clickMultipliersBuy();
        if (isMobileViewport) {
            await expect(
                tradeMultipliersPage.purchaseNotification,
                'Purchase notification should appear'
            ).toBeVisible();
        } else {
            await NavigationUtils.waitForDerivApiSettled(page);
        }

        await redirectionHelpers.redirectTo(page, '/reports/positions');
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(reportsPage.reportsHeaderTitle, 'Reports overlay title should be visible').toBeVisible();

        await reportsPage.selectContractTypeFilter('Accumulators');
        await NavigationUtils.waitForDerivApiSettled(page);

        await expect(
            reportsPage.growthRateFilter,
            'Growth rate sub-filter should appear when Accumulators is selected'
        ).toBeVisible();
    });

    test('VERIFY clicking an open position row navigates to contract details', async ({
        page,
        reportsPage,
        tradeRiseFallPage,
        isMobileViewport,
    }) => {
        // Ensure at least one open contract exists
        await tradeRiseFallPage.gotoTradePage();
        await tradeRiseFallPage.selectDuration('Minutes', '5 min');
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        if (isMobileViewport) {
            await expect(tradeRiseFallPage.purchaseButton, 'Purchase button should be visible').toBeVisible();
            await tradeRiseFallPage.purchaseButton.click();
            await expect(tradeRiseFallPage.purchaseNotification, 'Purchase notification should appear').toBeVisible();
        } else {
            await tradeRiseFallPage.clickBuy();
            await NavigationUtils.waitForDerivApiSettled(page);
        }

        await redirectionHelpers.redirectTo(page, '/reports/positions');
        await NavigationUtils.waitForDerivApiSettled(page);

        await expect(reportsPage.tableRows.first(), 'Contract row should be visible before navigating').toBeVisible();
        await reportsPage.tableRows.first().click();
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(
            page.getByText('Contract details').first(),
            'Contract details page should be visible after clicking a row'
        ).toBeVisible();
    });
});
