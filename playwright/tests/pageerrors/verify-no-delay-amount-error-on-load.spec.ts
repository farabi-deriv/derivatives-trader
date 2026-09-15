/**
 * @name     Trade form load — no delay_amount pageerror
 * @id       flow-1
 * @flow     playwright/flows/pageerrors/flow.md#flow-1--trade-form-load-no-delay_amount-pageerror
 * @coverage playwright/flows/pageerrors/coverage.md
 */
import { test, expect } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Pageerrors — trade', { tag: ['@pageerrors', '@desktop', '@mobile'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_MOBILE' : 'TEST_EMAIL';
        const email = process.env[emailVar];

        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);

        testEmail = email;
    });

    test('VERIFY logged-in trade form load throws no delay_amount pageerror', async ({
        page,
        loginPage,
        tradeParametersPage,
    }) => {
        const delayAmountErrors: string[] = [];
        page.on('pageerror', error => {
            if (error.message.includes('delay_amount')) {
                delayAmountErrors.push(error.message);
            }
        });

        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
        await tradeParametersPage.verifyDTraderLandingPage();

        expect(delayAmountErrors, 'Trade panel load should not throw delay_amount TypeError (issue #901)').toHaveLength(
            0
        );
    });
});
