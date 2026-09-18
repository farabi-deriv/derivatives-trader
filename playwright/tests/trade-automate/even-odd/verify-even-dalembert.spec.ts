/**
 * @name     Automate — Even/Odd trade type run (D'Alembert — Even)
 * @id       flow-13.1, flow-13.2
 * @flow     playwright/flows/trade-automate/flow.md#flow-13--evenodd-dalembert
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Trade Automate — Even/Odd', { tag: ['@automate', '@dalembert', '@desktop', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_EVEN_ODD_MOBILE' : 'TEST_EMAIL_AUTOMATE_EVEN_ODD';

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

    /** Flow 13.1 — Even/Odd D'Alembert: Even (demo) */
    test("VERIFY automated trade run - D'Alembert - Even (Demo)", async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runEvenOddAndVerify({
            accountType: 'demo',
            market: 'Volatility 10 Index',
            tradeType: 'Even',
            durationTicks: '10 ticks',
            stake: '2',
            automation: {
                strategy: "D'Alembert",
                stakeIncrement: 3,
                maxStake: '76',
                profitThreshold: '211',
                lossThreshold: '210',
            },
        });
    });

    /** Flow 13.2 — Even/Odd D'Alembert: Even (real) */
    test("VERIFY automated trade run - D'Alembert - Even (Real)", async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runEvenOddAndVerify({
            accountType: 'real',
            market: 'Volatility 10 Index',
            tradeType: 'Even',
            durationTicks: '9 ticks',
            stake: '5',
            automation: {
                strategy: "D'Alembert",
                stakeIncrement: 3,
                maxStake: '75',
                profitThreshold: '210',
                lossThreshold: '211',
            },
        });
    });
});
