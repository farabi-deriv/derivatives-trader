/**
 * @name     Higher/Lower — Buy Lower → Verify
 * @id       flow-3.2
 * @flow     playwright/flows/trade/flow.md#flow-32--higherlower-buy-lower--close-contract
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string = undefined!;
let accountPassword: string = undefined!;

test.describe('Trade — Higher/Lower — Lower', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
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

    /** Flow 3.2 — Higher/Lower: buy Lower → verify positions, reports, contract details, balance, closed */
    test('VERIFY Buy "Lower" Contract and Close (Demo Account)', async ({ tradeHigherLowerPage }) => {
        await tradeHigherLowerPage.buyLowerAndVerify({
            accountType: 'demo',
            market: 'Volatility 100 (1s) Index',
            durationUnit: 'Hours',
            durationValue: '1h 30m',
            barrierType: 'Below spot',
            barrier: '5.00',
            stake: '10.00',
            currency: 'USD',
        });
    });

    test('VERIFY Buy "Lower" Contract and Close (Real Account)', async ({ tradeHigherLowerPage }) => {
        await tradeHigherLowerPage.buyLowerAndVerify({
            accountType: 'real',
            market: 'Volatility 100 (1s) Index',
            durationUnit: 'Hours',
            durationValue: '1h 30m',
            barrierType: 'Below spot',
            barrier: '5.00',
            stake: '10.00',
            currency: 'USD',
        });
    });
});
