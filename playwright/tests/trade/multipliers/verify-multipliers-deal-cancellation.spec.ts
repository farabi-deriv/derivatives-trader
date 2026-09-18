/**
 * @name     Multipliers with Deal Cancellation — Buy Up → Cancel + Buy Down → Cancel
 * @id       flow-9.7, flow-9.8
 * @flow     playwright/flows/trade/flow.md#flow-97--multipliers-with-deal-cancellation-buy-up--cancel-contract
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string = undefined!;
let accountPassword: string = undefined!;

test.describe('Trade — Multipliers', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_MULTIPLIERS_DC_MOBILE' : 'TEST_EMAIL_MULTIPLIERS_DC';
        const account = await createAccountV2viaJS('real', {
            currency: 'USD',
            trading: true,
            backupAccount: process.env[backupEmailVar],
        });
        accountEmail = account.email;
        accountPassword = account.password;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(accountEmail, accountPassword);
    });

    /**
     * Flow 9.7 — configure Deal Cancellation, buy Up, verify the open position and timer,
     * then cancel the contract and verify the stake refund.
     */
    test('VERIFY Buy "Up" Multipliers Contract With Deal Cancellation and Cancel (Demo Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyUpAndVerifyWithDC({
            accountType: 'demo',
            market: 'Volatility 75 Index',
            multiplier: 'x300',
            stake: '20.00',
            currency: 'USD',
            dealCancellation: '5 min',
        });
    });

    test('VERIFY Buy "Up" Multipliers Contract With Deal Cancellation and Cancel (Real Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyUpAndVerifyWithDC({
            accountType: 'real',
            market: 'Volatility 75 Index',
            multiplier: 'x300',
            stake: '20.00',
            currency: 'USD',
            dealCancellation: '10 min',
        });
    });

    /**
     * Flow 9.8 — configure Deal Cancellation, buy Down, verify the open position and timer,
     * then cancel the contract and verify the stake refund.
     */
    test('VERIFY Buy "Down" Multipliers Contract With Deal Cancellation and Cancel (Demo Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyDownAndVerifyWithDC({
            accountType: 'demo',
            market: 'Volatility 75 Index',
            multiplier: 'x300',
            stake: '21.00',
            currency: 'USD',
            dealCancellation: '30 min',
        });
    });

    test('VERIFY Buy "Down" Multipliers Contract With Deal Cancellation and Cancel (Real Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyDownAndVerifyWithDC({
            accountType: 'real',
            market: 'Volatility 75 Index',
            multiplier: 'x300',
            stake: '21.00',
            currency: 'USD',
            dealCancellation: '60 min',
        });
    });
});
