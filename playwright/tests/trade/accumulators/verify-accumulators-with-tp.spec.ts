/**
 * @name     Accumulators with Take Profit — Buy → Close
 * @id       flow-8.2
 * @flow     playwright/flows/trade/flow.md#accumulators
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string = undefined!;
let accountPassword: string = undefined!;

test.describe('Trade — Accumulators', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_ACCUMULATORS_MOBILE' : 'TEST_EMAIL_ACCUMULATORS';
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
     * Flow 8.2 — Accumulators with Take Profit: set growth rate 5% + take profit 4.00 → buy → let the
     * contract auto-settle (take profit / barrier), with a manual-close fallback → verify the settled
     * contract in Positions, contract details, balance, and Reports.
     */
    test('VERIFY Buy Accumulators Contract With Take Profit and Close (Demo Account)', async ({
        tradeAccumulatorsPage,
    }) => {
        await tradeAccumulatorsPage.buyAccumulatorAndVerify({
            accountType: 'demo',
            market: 'Volatility 100 Index',
            growthRate: '5%',
            stake: '10.00',
            currency: 'USD',
            takeProfit: '4.00',
        });
    });

    test('VERIFY Buy Accumulators Contract With Take Profit and Close (Real Account)', async ({
        tradeAccumulatorsPage,
    }) => {
        await tradeAccumulatorsPage.buyAccumulatorAndVerify({
            accountType: 'real',
            market: 'Volatility 100 Index',
            growthRate: '5%',
            stake: '10.00',
            currency: 'USD',
            takeProfit: '4.00',
        });
    });
});
