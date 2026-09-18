/**
 * @name     Automate — Over/Under trade type run (Martingale — Over)
 * @id       flow-8.1, flow-8.2
 * @flow     playwright/flows/trade-automate/flow.md#flow-8--overunder
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Trade Automate — Over/Under', { tag: ['@automate', '@martingale', '@desktop', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_OVER_UNDER_MOBILE' : 'TEST_EMAIL_AUTOMATE_OVER_UNDER';

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

    test.afterEach(async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.stopAutomateRunIfActive();
    });

    /** Flow 8.1 — Over/Under Martingale: Over (demo) */
    test('VERIFY automated trade run - Martingale - Over (Demo)', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runOverUnderAndVerify({
            accountType: 'demo',
            market: 'Volatility 10 Index',
            tradeType: 'Over',
            durationTicks: '10 ticks',
            digit: '3',
            stake: '1',
            automation: {
                strategy: 'Martingale',
                stakeMultiplier: 2,
                maxStake: '70',
                profitThreshold: '104',
                lossThreshold: '104',
            },
        });
    });

    /** Flow 8.2 — Over/Under Martingale: Over (real) */
    test('VERIFY automated trade run - Martingale - Over (Real)', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runOverUnderAndVerify({
            accountType: 'real',
            market: 'Volatility 10 Index',
            tradeType: 'Over',
            durationTicks: '10 ticks',
            digit: '4',
            stake: '1',
            automation: {
                strategy: 'Martingale',
                stakeMultiplier: 2,
                maxStake: '71',
                profitThreshold: '103',
                lossThreshold: '103',
            },
        });
    });
});
