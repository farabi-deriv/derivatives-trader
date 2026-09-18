/**
 * @name     Rise/Fall — Allow Equals: Buy Rise → Close
 * @id       flow-2.3
 * @flow     playwright/flows/trade/flow.md#flow-23--risefall-allow-equals-buy-rise--close-contract
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Trade — Rise/Fall', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
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
     * Flow 2.3 — Rise/Fall with Allow Equals: buy Rise with Allow Equals enabled → verify positions → close.
     * Allow Equals submits the contract as Rise/Fall Equals (RISEEQUAL), paying out also when exit spot = entry spot.
     */
    test('VERIFY Buy "Rise" Contract with Allow Equals Enabled (Demo Account)', async ({ tradeRiseFallPage }) => {
        await tradeRiseFallPage.buyRiseAndVerify({
            accountType: 'demo',
            market: 'Volatility 100 Index',
            durationUnit: 'Minutes',
            durationValue: '15 min',
            stake: '10.50',
            currency: 'USD',
            allowEquals: true,
        });
    });

    test('VERIFY Buy "Rise" Contract with Allow Equals Enabled (Real Account)', async ({ tradeRiseFallPage }) => {
        await tradeRiseFallPage.buyRiseAndVerify({
            accountType: 'real',
            market: 'Volatility 100 Index',
            durationUnit: 'Minutes',
            durationValue: '15 min',
            stake: '10.50',
            currency: 'USD',
            allowEquals: true,
        });
    });
});
