/**
 * @name     Positions — Empty States (Open & Closed)
 * @id       flow-3, gap-g3
 * @flow     playwright/flows/positions/flow.md#flow-3--empty-open-positions-state
 * @coverage playwright/flows/positions/coverage.md
 */
import { test, expect, redirectionHelpers } from '../../fixtures/fixtures';
import { NavigationUtils, createAccountV2viaJS } from '../../utils';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Positions — Empty States', { tag: ['@positions', '@regression', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_MOBILE' : 'TEST_EMAIL';
        const email = process.env[emailVar];

        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test('VERIFY empty state shown when no open positions exist on mobile', async ({
        page,
        loginPage,
        positionsPage,
        isMobileViewport,
    }) => {
        if (!isMobileViewport) {
            test.skip(true, 'Flow 3 is mobile-only; desktop positions use sidebar flyout');
        }

        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);

        await redirectionHelpers.redirectTo(page, '/positions');
        const hasOpen = await positionsPage.firstContractCard.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasOpen) {
            await positionsPage.closeAllOpenContracts();
        }

        await expect(positionsPage.emptyStateIcon, 'Empty state icon should be visible').toBeVisible();
        await expect(
            page.getByText('No open positions'),
            'Empty heading should show "No open positions"'
        ).toBeVisible();
        await expect(
            page.getByText('Your active trades will appear here.'),
            'Empty description should be visible'
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Start trading' }),
            'Start trading button should be visible in empty open positions state'
        ).toBeVisible();
    });

    test('VERIFY empty state shown on Closed tab when account has no history', async ({
        page,
        loginPage,
        positionsPage,
        isMobileViewport,
    }, testInfo) => {
        if (!isMobileViewport) {
            test.skip(true, 'Gap G3 is mobile-only; desktop positions use sidebar flyout');
        }

        const emailVar = testInfo.project.name.includes('mobile') ? 'TEST_EMAIL_MOBILE' : 'TEST_EMAIL';
        let accountEmail: string;
        let accountPassword: string;

        if (process.env.TEST_ENV === 'production') {
            const email = process.env[emailVar];
            const password = process.env.TEST_PASSWORD;
            if (!email || !password) {
                throw new Error(`${emailVar} and TEST_PASSWORD must be set in playwright/.env.production`);
            }
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

        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(accountEmail, accountPassword);

        await redirectionHelpers.redirectTo(page, '/positions');
        await positionsPage.clickClosedTab();
        await NavigationUtils.waitForDerivApiSettled(page);

        await expect(positionsPage.emptyStateIcon, 'Empty state icon should be visible on Closed tab').toBeVisible();
        await expect(
            page.getByText('No closed positions'),
            'Empty heading should show "No closed positions"'
        ).toBeVisible();
        await expect(
            page.getByText('Your closed positions will be shown here.'),
            'Empty description should be visible'
        ).toBeVisible();
    });
});
