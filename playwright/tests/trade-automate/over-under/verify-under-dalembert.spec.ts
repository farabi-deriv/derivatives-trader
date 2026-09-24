/**
 * @name     Automate — Over/Under trade type run (D'Alembert — Under)
 * @id       flow-12.3, flow-12.4
 * @flow     playwright/flows/trade-automate/flow.md#flow-12--overunder-dalembert
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Trade Automate — Over/Under', { tag: ['@automate', '@dalembert', '@desktop', '@mobile'] }, () => {
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

    /** Flow 12.3 — Over/Under D'Alembert: Under (demo) */
    test("VERIFY automated trade run - D'Alembert - Under (Demo)", async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runOverUnderAndVerify({
            accountType: 'demo',
            market: 'Volatility 10 Index',
            tradeType: 'Under',
            durationTicks: '8 ticks',
            digit: '1',
            stake: '2',
            automation: {
                strategy: "D'Alembert",
                stakeIncrement: 3,
                maxStake: '82',
                profitThreshold: '112',
                lossThreshold: '112',
            },
        });
    });

    /** Flow 12.4 — Over/Under D'Alembert: Under (real) */
    test("VERIFY automated trade run - D'Alembert - Under (Real)", async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runOverUnderAndVerify({
            accountType: 'real',
            market: 'Volatility 10 Index',
            tradeType: 'Under',
            durationTicks: '9 ticks',
            digit: '8',
            stake: '2',
            automation: {
                strategy: "D'Alembert",
                stakeIncrement: 3,
                maxStake: '83',
                profitThreshold: '111',
                lossThreshold: '111',
            },
        });
    });
});
