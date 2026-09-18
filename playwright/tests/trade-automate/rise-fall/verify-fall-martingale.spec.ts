/**
 * @name     Automate — Rise/Fall trade type run (Martingale — Fall)
 * @id       flow-5.3, flow-5.4
 * @flow     playwright/flows/trade-automate/flow.md#flow-5--risefall
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Trade Automate — Rise/Fall', { tag: ['@automate', '@martingale', '@desktop', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_RISE_FALL_MOBILE' : 'TEST_EMAIL_AUTOMATE_RISE_FALL';

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

    /** Flow 5.3 — Rise/Fall Martingale: Fall (demo) */
    test('VERIFY automated trade run - Martingale - Fall (Demo)', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runRiseFallAndVerify({
            accountType: 'demo',
            market: 'Volatility 100 Index',
            tradeType: 'Fall',
            durationUnit: 'Ticks',
            durationValue: '10 ticks',
            stake: '6',
            automation: {
                strategy: 'Martingale',
                stakeMultiplier: 2,
                maxStake: '152',
                profitThreshold: '152',
                lossThreshold: '152',
            },
        });
    });

    /** Flow 5.4 — Rise/Fall Martingale: Fall (real) */
    test('VERIFY automated trade run - Martingale - Fall (Real)', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runRiseFallAndVerify({
            accountType: 'real',
            market: 'Volatility 100 Index',
            tradeType: 'Fall',
            durationUnit: 'Ticks',
            durationValue: '10 ticks',
            stake: '9',
            automation: {
                strategy: 'Martingale',
                stakeMultiplier: 2,
                maxStake: '153',
                profitThreshold: '153',
                lossThreshold: '153',
            },
        });
    });
});
