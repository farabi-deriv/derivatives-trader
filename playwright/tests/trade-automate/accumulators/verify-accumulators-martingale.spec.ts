/**
 * @name     Automate — Accumulators trade type run (Martingale)
 * @id       flow-6.1, flow-6.2
 * @flow     playwright/flows/trade-automate/flow.md#flow-6--accumulators
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Trade Automate — Accumulators', { tag: ['@automate', '@martingale', '@desktop', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile
            ? 'TEST_EMAIL_AUTOMATE_ACCUMULATORS_MOBILE'
            : 'TEST_EMAIL_AUTOMATE_ACCUMULATORS';

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

    /** Flow 6.1 — Accumulators Martingale: demo lifecycle */
    test('VERIFY automated trade run - Martingale - Accumulators (Demo)', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runAccumulatorsAndVerify({
            accountType: 'demo',
            market: 'Volatility 100 (1s) Index',
            growthRate: '4%',
            stake: '1',
            automation: {
                strategy: 'Martingale',
                stakeMultiplier: 2,
                maxStake: '50',
                profitThreshold: '101',
                lossThreshold: '102',
            },
        });
    });

    /** Flow 6.2 — Accumulators Martingale: real lifecycle */
    test('VERIFY automated trade run - Martingale - Accumulators (Real)', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runAccumulatorsAndVerify({
            accountType: 'real',
            market: 'Volatility 100 (1s) Index',
            growthRate: '5%',
            stake: '2',
            automation: {
                strategy: 'Martingale',
                stakeMultiplier: 2,
                maxStake: '50',
                profitThreshold: '101',
                lossThreshold: '102',
            },
        });
    });
});
