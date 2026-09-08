/**
 * @name     Touch/No Touch — Buy No Touch → Verify
 * @id       flow-4.2
 * @flow     playwright/flows/trade/flow.md#flow-42--touchno-touch-buy-no-touch--close-contract
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string = undefined!;
let accountPassword: string = undefined!;

test.describe('Trade — Touch/No Touch — No Touch', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
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

    /** Flow 4.2 — Touch/No Touch: buy No Touch → verify positions, reports, contract details, balance, closed */
    test('VERIFY Buy "No Touch" Contract and Close (Demo Account)', async ({ tradeTouchNoTouchPage }) => {
        await tradeTouchNoTouchPage.buyNoTouchAndVerify({
            accountType: 'demo',
            market: 'Volatility 10 (1s) Index',
            durationUnit: 'Minutes',
            durationValue: '5 min',
            barrierType: 'Below spot',
            barrier: '6.05',
            stake: '6.09',
            currency: 'USD',
        });
    });

    test('VERIFY Buy "No Touch" Contract and Close (Real Account)', async ({ tradeTouchNoTouchPage }) => {
        await tradeTouchNoTouchPage.buyNoTouchAndVerify({
            accountType: 'real',
            market: 'Volatility 10 (1s) Index',
            durationUnit: 'Minutes',
            durationValue: '5 min',
            barrierType: 'Below spot',
            barrier: '6.05',
            stake: '6.09',
            currency: 'USD',
        });
    });
});
