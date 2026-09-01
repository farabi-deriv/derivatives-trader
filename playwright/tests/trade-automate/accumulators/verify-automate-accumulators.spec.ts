/**
 * @name     Automate — Accumulators trade type run
 * @id       flow-8
 * @flow     playwright/flows/trade-automate/flow.md#flow-8--verify-automate-accumulatorsspec
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Automate — Accumulators', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
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

    test('VERIFY automation run on Accumulators trade type (Demo Account)', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runAccumulatorsAndVerify({
            accountType: 'demo',
            market: 'Volatility 10 Index',
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

    test('VERIFY automation run on Accumulators trade type (Real Account)', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runAccumulatorsAndVerify({
            accountType: 'real',
            market: 'Volatility 10 Index',
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
