/**
 * @name     Automate — Rise/Fall trade type run (D'Alembert — Rise)
 * @id       flow-10.1, flow-10.2
 * @flow     playwright/flows/trade-automate/flow.md#flow-10--risefall-dalembert
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe(
    "Automate — Rise/Fall — Rise (D'Alembert)",
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

        /** Flow 10.1 — Rise/Fall D'Alembert: Rise (demo) */
        test("VERIFY D'Alembert automation run on Rise/Fall — Rise (Demo Account)", async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runRiseFallAndVerify({
                accountType: 'demo',
                market: 'Volatility 100 Index',
                tradeType: 'Rise',
                durationUnit: 'Ticks',
                durationValue: '10 ticks',
                stake: '2',
                automation: {
                    strategy: "D'Alembert",
                    stakeIncrement: 3,
                    maxStake: '160',
                    profitThreshold: '160',
                    lossThreshold: '160',
                },
            });
        });

        /** Flow 10.2 — Rise/Fall D'Alembert: Rise (real) */
        test("VERIFY D'Alembert automation run on Rise/Fall — Rise (Real Account)", async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runRiseFallAndVerify({
                accountType: 'real',
                market: 'Volatility 100 Index',
                tradeType: 'Rise',
                durationUnit: 'Ticks',
                durationValue: '10 ticks',
                stake: '4',
                automation: {
                    strategy: "D'Alembert",
                    stakeIncrement: 3,
                    maxStake: '161',
                    profitThreshold: '161',
                    lossThreshold: '161',
                },
            });
        });
    }
);
