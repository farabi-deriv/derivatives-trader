/**
 * @name     Turbos with Take Profit — Buy Up → Verify
 * @id       flow-10.3
 * @flow     playwright/flows/trade/flow.md#turbos
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string = undefined!;
let accountPassword: string = undefined!;

test.describe('Trade — Turbos with Take Profit — Up', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_TURBOS_TP_MOBILE' : 'TEST_EMAIL_TURBOS_TP';
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

    /** Flow 10.3 — Turbos with TP: set TP 20.00 → buy Up → verify TP in details → close early → verify closed */
    test('VERIFY Buy "Up" Turbos Contract With Take Profit (Demo Account)', async ({ tradeTurbosPage }) => {
        await tradeTurbosPage.buyTurbosAndVerify({
            accountType: 'demo',
            market: 'Volatility 100 (1s) Index',
            direction: 'Up',
            stake: '10.50',
            currency: 'USD',
            takeProfit: '20.00',
        });
    });

    test('VERIFY Buy "Up" Turbos Contract With Take Profit (Real Account)', async ({ tradeTurbosPage }) => {
        await tradeTurbosPage.buyTurbosAndVerify({
            accountType: 'real',
            market: 'Volatility 100 (1s) Index',
            direction: 'Up',
            stake: '10.50',
            currency: 'USD',
            takeProfit: '20.00',
        });
    });
});
