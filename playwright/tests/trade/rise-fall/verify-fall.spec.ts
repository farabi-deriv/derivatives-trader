/**
 * @name     Rise/Fall — Buy Fall → Close
 * @id       flow-2.2
 * @flow     playwright/flows/trade/flow.md#flow-22--risefall-buy-fall--close-contract
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Trade — Rise/Fall', { tag: ['@desktop', '@mobile', '@trade', '@smoke'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_RISE_FALL_MOBILE' : 'TEST_EMAIL_RISE_FALL';

        if (process.env.TEST_ENV === 'production') {
            const email = process.env[emailVar];
            const password = process.env.TEST_PASSWORD;
            if (!email || !password)
                throw new Error(`${emailVar} and TEST_PASSWORD must be set in playwright/.env.production`);
            accountEmail = email;
            accountPassword = password;
        } else {
            const account = await createAccountV2viaJS('real', {
                currency: 'USD',
                trading: true,
                backupAccount: process.env[emailVar],
            });
            accountEmail = account.email;
            accountPassword = account.password;
        }
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(accountEmail, accountPassword);
    });

    /** Flow 2.2 — Rise/Fall: buy Fall → navigate to positions → open contract → close */
    test('VERIFY Buy "Fall" Contract and Close (Demo Account)', async ({ tradeRiseFallPage }) => {
        await tradeRiseFallPage.buyFallAndVerify({
            accountType: 'demo',
            market: 'Volatility 100 Index',
            durationUnit: 'Minutes',
            durationValue: '18 min',
            stake: '20.50',
            currency: 'USD',
        });
    });

    test('VERIFY Buy "Fall" Contract and Close (Real Account)', async ({ tradeRiseFallPage }) => {
        await tradeRiseFallPage.buyFallAndVerify({
            accountType: 'real',
            market: 'Volatility 100 Index',
            durationUnit: 'Minutes',
            durationValue: '18 min',
            stake: '20.50',
            currency: 'USD',
        });
    });
});
