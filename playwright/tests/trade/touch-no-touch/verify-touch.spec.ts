/**
 * @name     Touch/No Touch — Buy Touch → Verify
 * @id       flow-4.1
 * @flow     playwright/flows/trade/flow.md#flow-41--touchno-touch-buy-touch--close-contract
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string = undefined!;
let accountPassword: string = undefined!;

test.describe('Trade — Touch/No Touch', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_TOUCH_NO_TOUCH_MOBILE' : 'TEST_EMAIL_TOUCH_NO_TOUCH';
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

    /** Flow 4.1 — Touch/No Touch: verify Barrier + Duration params, buy Touch → verify closed contract */
    test('VERIFY Buy "Touch" Contract and Close (Demo Account)', async ({ tradeTouchNoTouchPage }) => {
        await tradeTouchNoTouchPage.buyTouchAndVerify({
            accountType: 'demo',
            market: 'Volatility 10 (1s) Index',
            durationUnit: 'Minutes',
            durationValue: '15 min',
            barrierType: 'Above spot',
            barrier: '8.60',
            stake: '5.01',
            currency: 'USD',
        });
    });

    test('VERIFY Buy "Touch" Contract and Close (Real Account)', async ({ tradeTouchNoTouchPage }) => {
        await tradeTouchNoTouchPage.buyTouchAndVerify({
            accountType: 'real',
            market: 'Volatility 10 (1s) Index',
            durationUnit: 'Minutes',
            durationValue: '15 min',
            barrierType: 'Above spot',
            barrier: '8.60',
            stake: '5.01',
            currency: 'USD',
        });
    });
});
