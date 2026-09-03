/**
 * @name     Reports — Empty States on Trade Table & Statement
 * @id       flow-7, flow-8
 * @flow     playwright/flows/reports/flow.md#flow-7--empty-state--no-trading-activity-trade-table
 * @coverage playwright/flows/reports/coverage.md
 */

import { expect, test, redirectionHelpers } from '../../fixtures/fixtures';
import { NavigationUtils, createAccountV2viaJS } from '../../utils';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Reports — Empty States', { tag: ['@reports', '@regression', '@desktop', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    let accountEmail: string;
    let accountPassword: string;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_MOBILE' : 'TEST_EMAIL';

        if (process.env.TEST_ENV === 'production') {
            const email = process.env[emailVar];
            const password = process.env.TEST_PASSWORD;
            if (!email || !password)
                throw new Error(`${emailVar} and TEST_PASSWORD must be set in playwright/.env.production`);
            accountEmail = email;
            accountPassword = password;
        } else {
            const account = await createAccountV2viaJS('real', {
                currency: 'USD',
                trading: true,
                backupAccount: process.env[emailVar],
            });
            accountEmail = account.email;
            accountPassword = account.password;
        }
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(accountEmail, accountPassword);
    });

    test('VERIFY empty state shown on Trade Table when account has no trading activity', async ({
        page,
        reportsPage,
    }) => {
        await redirectionHelpers.redirectTo(page, '/reports/profit');
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(reportsPage.metaWrapper, 'Meta wrapper should be visible on Trade Table tab').toBeVisible();

        await expect(
            page.getByText(
                /You('ve made no transactions of this type during this period| have no trading activity yet)/i
            ),
            'Empty state message should be visible on empty Trade Table'
        ).toBeVisible();
    });

    test('VERIFY empty state shown on Statement when account has no transactions of selected type', async ({
        page,
        reportsPage,
    }) => {
        await redirectionHelpers.redirectTo(page, '/reports/statement');
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(reportsPage.metaWrapper, 'Meta wrapper should be visible on Statement tab').toBeVisible();

        // Fresh account has an initial Deposit transaction, so filtering by Withdrawal yields empty state
        await reportsPage.selectTransactionTypeFilter('Withdrawal');
        await NavigationUtils.waitForDerivApiSettled(page);

        await expect(
            page.getByText(/You('ve made no transactions of this type during this period| have no transactions yet)/i),
            'Empty state message should be visible on Statement for zero transactions of selected type'
        ).toBeVisible();
    });
});
