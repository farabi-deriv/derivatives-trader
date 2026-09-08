/**
 * @name     Reports — Navigation, Tabs & Statement
 * @id       flow-1, flow-5, flow-6, gap-g2
 * @flow     playwright/flows/reports/flow.md#flow-1--reports-page-loads-with-default-tab-open-positions
 * @coverage playwright/flows/reports/coverage.md
 */

import { expect, test, redirectionHelpers } from '../../fixtures/fixtures';
import { NavigationUtils } from '../../utils';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Reports — Navigation & Statement', { tag: ['@reports', '@regression', '@desktop', '@mobile'] }, () => {
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

    test('VERIFY reports page loads with default Open positions tab', async ({ page, reportsPage }) => {
        await redirectionHelpers.redirectTo(page, '/reports');
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(
            reportsPage.reportsHeaderTitle,
            'Reports heading should be visible in header overlay'
        ).toBeVisible();
        await expect(page, 'URL should default to /reports/positions').toHaveURL(/\/reports\/positions/);
    });

    test('VERIFY trade table tab loads with date filter and content', async ({ page, reportsPage }) => {
        await redirectionHelpers.redirectTo(page, '/reports/profit');
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(reportsPage.metaWrapper, 'Meta wrapper should be visible on Trade Table tab').toBeVisible();
        await expect(
            reportsPage.tableRows.first().or(reportsPage.emptyStateIcon),
            'Trade Table should display either profit table rows or empty state icon'
        ).toBeVisible();
    });

    test('VERIFY statement tab loads with transaction filter and statement content', async ({
        page,
        reportsPage,
        tradeRiseFallPage,
        isMobileViewport,
    }) => {
        // Ensure at least one Buy transaction exists in statement
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

        await redirectionHelpers.redirectTo(page, '/reports/statement');
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(reportsPage.metaWrapper, 'Meta wrapper should be visible on Statement tab').toBeVisible();
        await expect(
            reportsPage.transactionTypeFilter,
            'Transaction type filter should be visible on Statement'
        ).toBeVisible();
        await expect(
            reportsPage.tableRows.first(),
            'Statement should display at least one transaction row'
        ).toBeVisible();
    });

    test('VERIFY filtering by Buy on statement tab', async ({
        page,
        reportsPage,
        tradeRiseFallPage,
        isMobileViewport,
    }) => {
        // Ensure at least one Buy transaction exists in statement
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

        await redirectionHelpers.redirectTo(page, '/reports/statement');
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(reportsPage.metaWrapper, 'Meta wrapper should be visible on Statement tab').toBeVisible();

        await reportsPage.selectTransactionTypeFilter('Buy');
        await NavigationUtils.waitForDerivApiSettled(page);

        await expect(reportsPage.tableRows.first(), 'Buy transaction row should be visible').toBeVisible();
        await expect(reportsPage.tableRows.first(), 'Buy transaction row should contain Buy action').toContainText(
            /Buy/i
        );
    });

    test('VERIFY archived statement route and header display', async ({ reportsPage }) => {
        await redirectionHelpers.redirectTo(reportsPage.page, '/reports/archived-statement');
        await NavigationUtils.waitForDerivApiSettled(reportsPage.page);

        await expect(
            reportsPage.reportsHeaderTitle,
            'Reports header should be visible on archived statement route'
        ).toBeVisible();
        await expect(
            reportsPage.archivedStatementTab,
            'Archived statement header text should be visible on archived statement route'
        ).toBeVisible();
    });
});
