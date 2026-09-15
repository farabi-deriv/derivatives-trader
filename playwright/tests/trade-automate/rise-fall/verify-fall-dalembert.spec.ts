/**
 * @name     Automate — Rise/Fall trade type run (D'Alembert — Fall)
 * @id       flow-10.3, flow-10.4
 * @flow     playwright/flows/trade-automate/flow.md#flow-10--risefall-dalembert
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe(
    "Automate — Rise/Fall — Fall (D'Alembert)",
    { tag: ['@automate', '@dalembert', '@desktop', '@mobile'] },
    () => {
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

        /** Flow 10.3 — Rise/Fall D'Alembert: Fall (demo) */
        test("VERIFY D'Alembert automation run on Rise/Fall — Fall (Demo Account)", async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runRiseFallAndVerify({
                accountType: 'demo',
                market: 'Volatility 100 Index',
                tradeType: 'Fall',
                durationUnit: 'Ticks',
                durationValue: '10 ticks',
                stake: '7',
                automation: {
                    strategy: "D'Alembert",
                    stakeIncrement: 3,
                    maxStake: '162',
                    profitThreshold: '162',
                    lossThreshold: '162',
                },
            });
        });

        /** Flow 10.4 — Rise/Fall D'Alembert: Fall (real) */
        test("VERIFY D'Alembert automation run on Rise/Fall — Fall (Real Account)", async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runRiseFallAndVerify({
                accountType: 'real',
                market: 'Volatility 100 Index',
                tradeType: 'Fall',
                durationUnit: 'Ticks',
                durationValue: '10 ticks',
                stake: '10',
                automation: {
                    strategy: "D'Alembert",
                    stakeIncrement: 3,
                    maxStake: '163',
                    profitThreshold: '163',
                    lossThreshold: '163',
                },
            });
        });
    }
);
