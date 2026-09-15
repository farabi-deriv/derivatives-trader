/**
 * @name     Positions — Empty States (Open & Closed)
 * @id       flow-3, flow-10
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

    test.describe('Open tab', () => {
        test.beforeEach(async ({ page, loginPage, isMobileViewport }) => {
            if (!isMobileViewport) return;

            await TradeBasePage.seedLocalStorageOnOrigin(page);
            await loginPage.login(testEmail);
            await redirectionHelpers.redirectTo(page, '/positions');
        });

        /** Flow 3 + issue #1036 — empty Open tab in light theme, then dark-theme icon contrast */
        test('VERIFY empty open positions state on mobile', async ({ page, positionsPage, isMobileViewport }) => {
            if (!isMobileViewport) {
                test.skip(true, 'Flow 3 is mobile-only; desktop positions use sidebar flyout');
            }

            await test.step('Light theme — full empty state', async () => {
                await positionsPage.ensureEmptyOpenPositionsTab();
                await positionsPage.verifyEmptyOpenPositionsState();
            });

            await test.step('Dark theme — empty-state icon stays visible (#1036)', async () => {
                await TradeBasePage.seedDarkThemePreference(page);
                await page.reload();
                await NavigationUtils.waitForDerivApiSettled(page);
                await redirectionHelpers.redirectTo(page, '/positions');
                await positionsPage.ensureEmptyOpenPositionsTab();

                await expect(
                    page.locator('body.theme--dark'),
                    'Dark theme class should be applied after seeding theme_preference'
                ).toHaveClass(/theme--dark/);
                await expect(
                    positionsPage.emptyStateIcon,
                    'Empty-state icon should stay visible with sufficient contrast in dark mode'
                ).toBeVisible();
            });
        });
    });

    /** Flow 10 — needs a fresh account with no closed-contract history (cannot share the Open-tab inbox). */
    test('VERIFY empty closed positions state on mobile', async ({
        page,
        loginPage,
        positionsPage,
        isMobileViewport,
    }, testInfo) => {
        if (!isMobileViewport) {
            test.skip(true, 'Flow 10 is mobile-only; desktop positions use sidebar flyout');
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
        await positionsPage.verifyEmptyClosedPositionsState();
    });
});
