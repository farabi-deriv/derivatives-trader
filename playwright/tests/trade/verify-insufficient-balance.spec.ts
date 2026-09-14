/**
 * @name     Insufficient Balance
 * @id       flow-17.1, flow-17.2
 * @flow     playwright/flows/trade/flow.md#flow-171--insufficient-balance-popup-dismiss-and-deposit
 *           playwright/flows/trade/flow.md#flow-172--stake-editor-hint--buy-enabled
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Trade — Insufficient Balance', { tag: ['@trade', '@desktop', '@mobile'] }, () => {
    test.describe('Insufficient balance popup on Buy click', () => {
        let testEmail: string = undefined!;

        test.beforeAll(() => {
            const email = process.env.TEST_EMAIL_ZERO_BALANCE;
            if (!email) throw new Error('TEST_EMAIL_ZERO_BALANCE is not set in playwright/.env.staging');
            testEmail = email;
        });

        test.beforeEach(async ({ page, loginPage, tradeParametersPage }) => {
            await TradeBasePage.seedLocalStorageOnOrigin(page);
            await loginPage.login(testEmail);
            await tradeParametersPage.gotoTradePage();
            await tradeParametersPage.switchToAccountType('real');
        });

        /** Flow 17.1 — insufficient balance popup dismiss and deposit */
        test('VERIFY insufficient balance popup dismiss and deposit', async ({ tradeParametersPage }) => {
            await tradeParametersPage.verifyEmptyBalanceStakeEditorHint();
            await tradeParametersPage.clickBuyWithInsufficientBalance();
            await tradeParametersPage.verifyInsufficientBalancePopup();
            await tradeParametersPage.clickInsufficientBalancePopupClose();
            await tradeParametersPage.verifyInsufficientBalancePopupDismissed();
            await tradeParametersPage.clickBuyWithInsufficientBalance();
            await tradeParametersPage.verifyInsufficientBalancePopup();
            await tradeParametersPage.clickInsufficientBalanceDepositButton();
            await tradeParametersPage.verifyNavigatedToDepositFromDTrader();
        });
    });

    test.describe('Stake editor hint', () => {
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

        /** Flow 17.2 — stake editor hint + Buy enabled */
        test('VERIFY insufficient balance keeps Buy enabled and shows balance hint', async ({
            tradeParametersPage,
        }) => {
            await tradeParametersPage.verifyInsufficientBalanceClientGate();
        });
    });
});
