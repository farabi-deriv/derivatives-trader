/**
 * @name     Even/Odd — Buy Even → Verify
 * @id       flow-7.1
 * @flow     playwright/flows/trade/flow.md#evenodd
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string = undefined!;
let accountPassword: string = undefined!;

test.describe('Trade — Even/Odd', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_EVEN_ODD_MOBILE' : 'TEST_EMAIL_EVEN_ODD';
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

    /** Flow 7.1 — Even/Odd: buy Even → open details → settle in place → verify closed */
    test('VERIFY Buy "Even" Contract (Demo Account)', async ({ tradeEvenOddPage }) => {
        await tradeEvenOddPage.buyEvenAndVerify({
            accountType: 'demo',
            market: 'Volatility 10 Index',
            durationValue: '10 ticks',
            stake: '10.00',
            currency: 'USD',
        });
    });

    test('VERIFY Buy "Even" Contract (Real Account)', async ({ tradeEvenOddPage }) => {
        await tradeEvenOddPage.buyEvenAndVerify({
            accountType: 'real',
            market: 'Volatility 10 Index',
            durationValue: '10 ticks',
            stake: '10.00',
            currency: 'USD',
        });
    });
});
