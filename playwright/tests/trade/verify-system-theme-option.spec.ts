/**
 * @name     Trade — System theme option follows OS / locks explicit Light·Dark
 * @id       flow-20
 * @flow     playwright/flows/trade/flow.md#flow-20--system-theme-option-follows-os
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Trade — System theme', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.beforeAll(() => {
        if (!process.env.BASE_URL) throw new Error('BASE_URL is not set in playwright/.env');
    });

    test.beforeEach(async ({ page, tradeParametersPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await TradeBasePage.seedThemePreference(page, 'system');
        await tradeParametersPage.gotoTradePage();
    });

    /**
     * Issue #1177 — System tracks `prefers-color-scheme`; an explicit Light/Dark choice
     * ignores OS flips. Preference UI is viewport-specific inside `setThemePreference`.
     */
    test('VERIFY System theme follows OS and locks after explicit choice', async ({ page, tradeParametersPage }) => {
        await tradeParametersPage.setThemePreference('System');

        await page.emulateMedia({ colorScheme: 'dark' });
        await tradeParametersPage.expectResolvedBodyTheme('dark');

        await page.emulateMedia({ colorScheme: 'light' });
        await tradeParametersPage.expectResolvedBodyTheme('light');

        await tradeParametersPage.setThemePreference('Light');
        await page.emulateMedia({ colorScheme: 'dark' });
        await tradeParametersPage.expectResolvedBodyTheme('light');

        await tradeParametersPage.setThemePreference('Dark');
        await page.emulateMedia({ colorScheme: 'light' });
        await tradeParametersPage.expectResolvedBodyTheme('dark');
    });
});
