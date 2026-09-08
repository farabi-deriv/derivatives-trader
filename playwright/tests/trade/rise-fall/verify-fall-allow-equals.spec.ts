/**
 * @name     Rise/Fall — Allow Equals: Buy Fall → Close
 * @id       flow-2.4
 * @flow     playwright/flows/trade/flow.md#flow-24--risefall-allow-equals-buy-fall--close-contract
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Trade — Rise/Fall — Fall Allow Equals', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_RISE_FALL_MOBILE' : 'TEST_EMAIL_RISE_FALL';

        const account = await createAccountV2viaJS('real', {
            currency: 'USD',
            trading: true,
            backupAccount: process.env[emailVar],
        });
        accountEmail = account.email;
        accountPassword = account.password;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(accountEmail, accountPassword);
    });

    /**
     * Flow 2.4 — Rise/Fall with Allow Equals: buy Fall with Allow Equals enabled → verify positions → close.
     * Allow Equals submits the contract as Rise/Fall Equals (FALLEQUAL), paying out also when exit spot = entry spot.
     */
    test('VERIFY Buy "Fall" Contract with Allow Equals Enabled (Demo Account)', async ({ tradeRiseFallPage }) => {
        await tradeRiseFallPage.buyFallAndVerify({
            accountType: 'demo',
            market: 'Volatility 100 Index',
            durationUnit: 'Minutes',
            durationValue: '18 min',
            stake: '20.50',
            currency: 'USD',
            allowEquals: true,
        });
    });

    test('VERIFY Buy "Fall" Contract with Allow Equals Enabled (Real Account)', async ({ tradeRiseFallPage }) => {
        await tradeRiseFallPage.buyFallAndVerify({
            accountType: 'real',
            market: 'Volatility 100 Index',
            durationUnit: 'Minutes',
            durationValue: '18 min',
            stake: '20.50',
            currency: 'USD',
            allowEquals: true,
        });
    });
});
