/**
 * @name     Insufficient Balance
 * @id       flow-17
 * @flow     playwright/flows/trade/flow.md#flow-17--insufficient-balance--buy-disabled-balance-hint
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Trade — Insufficient Balance', { tag: ['@trade', '@desktop', '@mobile'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_INSUFFICIENT_BALANCE_MOBILE' : 'TEST_EMAIL_INSUFFICIENT_BALANCE';
        const email = process.env[emailVar];

        if (!email) throw new Error(`${emailVar} is not set in playwright/.env.staging`);

        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage, tradeParametersPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
        await tradeParametersPage.gotoTradePage();
        await tradeParametersPage.switchToAccountType('real');
    });

    test('VERIFY insufficient balance disables Buy and shows balance hint', async ({ tradeParametersPage }) => {
        await tradeParametersPage.verifyInsufficientBalanceClientGate();
    });
});
