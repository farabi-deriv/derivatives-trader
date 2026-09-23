/**
 * @name     Higher/Lower — Buy Higher → Verify
 * @id       flow-3.1
 * @flow     playwright/flows/trade/flow.md#flow-31--higherlower-buy-higher--close-contract
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string = undefined!;
let accountPassword: string = undefined!;

test.describe('Trade — Higher/Lower', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_HIGHER_LOWER_MOBILE' : 'TEST_EMAIL_HIGHER_LOWER';
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

    /** Flow 3.1 — Higher/Lower: verify Barrier + Duration params, buy Higher → verify closed contract */
    test('VERIFY Buy "Higher" Contract and Close (Demo Account)', async ({ tradeHigherLowerPage }) => {
        await tradeHigherLowerPage.buyHigherAndVerify({
            accountType: 'demo',
            market: 'Volatility 100 Index',
            durationUnit: 'Hours',
            durationValue: '1 hr',
            barrierType: 'Above spot',
            barrier: '8.11',
            stake: '10.00',
            currency: 'USD',
        });
    });

    test('VERIFY Buy "Higher" Contract and Close (Real Account)', async ({ tradeHigherLowerPage }) => {
        await tradeHigherLowerPage.buyHigherAndVerify({
            accountType: 'real',
            market: 'Volatility 100 Index',
            durationUnit: 'Hours',
            durationValue: '1 hr',
            barrierType: 'Above spot',
            barrier: '8.11',
            stake: '10.00',
            currency: 'USD',
        });
    });
});
