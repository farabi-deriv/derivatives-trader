/**
 * @name     Vanillas — Buy Call → Verify
 * @id       flow-11.1
 * @flow     playwright/flows/trade/flow.md#vanillas
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string = undefined!;
let accountPassword: string = undefined!;

test.describe('Trade — Vanillas', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_VANILLAS_MOBILE' : 'TEST_EMAIL_VANILLAS';
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

    /** Flow 11.1 — Vanillas: buy Call → verify open position, early close, and closed Reports chain */
    test('VERIFY Buy "Call" Vanillas Contract (Demo Account)', async ({ tradeVanillasPage }) => {
        await tradeVanillasPage.buyVanillasAndVerify({
            accountType: 'demo',
            market: 'Volatility 75 (1s) Index',
            direction: 'Call',
            durationUnit: 'Minutes',
            durationValue: '5 min',
            strike: '+0.00',
            stake: '10.00',
            currency: 'USD',
        });
    });

    test('VERIFY Buy "Call" Vanillas Contract (Real Account)', async ({ tradeVanillasPage }) => {
        await tradeVanillasPage.buyVanillasAndVerify({
            accountType: 'real',
            market: 'Volatility 75 (1s) Index',
            direction: 'Call',
            durationUnit: 'Minutes',
            durationValue: '5 min',
            strike: '+0.00',
            stake: '10.00',
            currency: 'USD',
        });
    });
});
