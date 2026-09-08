/**
 * @name     Over/Under — Buy Under → Verify
 * @id       flow-6.2
 * @flow     playwright/flows/trade/flow.md#overunder
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string = undefined!;
let accountPassword: string = undefined!;

test.describe('Trade — Over/Under — Under', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_OVER_UNDER_MOBILE' : 'TEST_EMAIL_OVER_UNDER';
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

    /** Flow 6.2 — Over/Under: set last digit → buy Under → settle in place → verify closed */
    test('VERIFY Buy "Under" Contract (Demo Account)', async ({ tradeOverUnderPage }) => {
        await tradeOverUnderPage.buyUnderAndVerify({
            accountType: 'demo',
            market: 'Volatility 10 Index',
            durationValue: '10 ticks',
            stake: '10.00',
            currency: 'USD',
            digit: '9',
        });
    });

    test('VERIFY Buy "Under" Contract (Real Account)', async ({ tradeOverUnderPage }) => {
        await tradeOverUnderPage.buyUnderAndVerify({
            accountType: 'real',
            market: 'Volatility 10 Index',
            durationValue: '10 ticks',
            stake: '10.00',
            currency: 'USD',
            digit: '7',
        });
    });
});
