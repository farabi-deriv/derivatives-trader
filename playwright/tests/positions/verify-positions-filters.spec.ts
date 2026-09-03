/**
 * @name     Positions — Filter Options & No-Matches State
 * @id       flow-5, flow-6, gap-g4
 * @flow     playwright/flows/positions/flow.md#flow-5--filter-open-positions-by-trade-type
 * @coverage playwright/flows/positions/coverage.md
 */
import { test, expect, redirectionHelpers } from '../../fixtures/fixtures';
import { NavigationUtils } from '../../utils';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Positions — Filters', { tag: ['@positions', '@regression', '@mobile'] }, () => {
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

    test('VERIFY filter by trade type narrows open positions list and can be cleared', async ({
        page,
        tradeRiseFallPage,
        positionsPage,
        isMobileViewport,
    }) => {
        if (!isMobileViewport) {
            test.skip(true, 'Flow 5 is mobile-only; desktop positions use sidebar flyout');
        }

        // Buy open contract
        await tradeRiseFallPage.gotoTradePage();
        await tradeRiseFallPage.selectDuration('Minutes', '5 min');
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        await expect(tradeRiseFallPage.purchaseButton, 'Purchase button should be visible').toBeVisible();
        await tradeRiseFallPage.purchaseButton.click();
        await expect(tradeRiseFallPage.purchaseNotification, 'Purchase notification should appear').toBeVisible();

        await redirectionHelpers.redirectTo(page, '/positions');
        const initialCount = await positionsPage.contractCards.count();

        await positionsPage.openTradeTypeFilter();
        await positionsPage.selectFirstTradeTypeFilter();
        await positionsPage.applyFilter();
        await NavigationUtils.waitForDerivApiSettled(page);

        const filteredCount = await positionsPage.contractCards.count();
        expect(filteredCount, 'Filtered count should match expected positions').toBe(initialCount);
        await expect(positionsPage.tradeTypeFilterChip, 'Filter chip should show selected count (1)').toContainText(
            '(1)'
        );

        // Clear filter
        await positionsPage.openTradeTypeFilter();
        await positionsPage.clearFilter();
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(
            positionsPage.tradeTypeFilterChip,
            'Filter chip should return to unselected state'
        ).not.toContainText('(');
    });

    test('VERIFY no-matches state when trade type filter has no matching open positions', async ({
        page,
        tradeRiseFallPage,
        positionsPage,
        isMobileViewport,
    }) => {
        if (!isMobileViewport) {
            test.skip(true, 'Gap G4 is mobile-only; desktop positions use sidebar flyout');
        }

        // Buy open Rise/Fall contract
        await tradeRiseFallPage.gotoTradePage();
        await tradeRiseFallPage.selectDuration('Minutes', '5 min');
        await tradeRiseFallPage.setStake('1.00');
        await tradeRiseFallPage.clickRiseFallOption('Rise');
        await expect(tradeRiseFallPage.purchaseButton, 'Purchase button should be visible').toBeVisible();
        await tradeRiseFallPage.purchaseButton.click();
        await expect(tradeRiseFallPage.purchaseNotification, 'Purchase notification should appear').toBeVisible();

        await redirectionHelpers.redirectTo(page, '/positions');
        await positionsPage.openTradeTypeFilter();
        // Select a trade type that is not open (e.g. Accumulators)
        await page.getByRole('checkbox', { name: 'Accumulators' }).check();
        await positionsPage.applyFilter();
        await NavigationUtils.waitForDerivApiSettled(page);

        // Verify empty state with search icon and message
        await expect(positionsPage.emptyStateIcon, 'Empty state icon should be visible').toBeVisible();
        await expect(page.getByText('No matches found'), 'Heading should read "No matches found"').toBeVisible();
        await expect(
            page.getByText('Try changing or removing filters to view available positions.'),
            'Description text should be visible'
        ).toBeVisible();
    });

    test('VERIFY time filter narrows closed positions list and can be reset', async ({
        page,
        positionsPage,
        isMobileViewport,
    }) => {
        if (!isMobileViewport) {
            test.skip(true, 'Flow 6 is mobile-only; desktop positions use sidebar flyout');
        }

        await redirectionHelpers.redirectTo(page, '/positions');
        await positionsPage.clickClosedTab();
        await NavigationUtils.waitForDerivApiSettled(page);

        await positionsPage.openTimeFilter();
        await positionsPage.selectTimeFilterOption('Today');
        await NavigationUtils.waitForDerivApiSettled(page);

        await expect(positionsPage.timeFilterChip, 'Time chip should show "Today"').toContainText('Today');

        await positionsPage.resetTimeFilter();
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(positionsPage.timeFilterChip, 'Time chip should reset to default').not.toContainText('Today');
    });
});
