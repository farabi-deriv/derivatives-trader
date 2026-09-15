/**
 * @name     Automate — Over/Under trade type run (D'Alembert — Over)
 * @id       flow-12.1, flow-12.2
 * @flow     playwright/flows/trade-automate/flow.md#flow-12--overunder-dalembert
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe(
    "Automate — Over/Under — Over (D'Alembert)",
    { tag: ['@automate', '@dalembert', '@smoke', '@desktop', '@mobile', '@production'] },
    () => {
        test.describe.configure({ mode: 'serial' });

        test.beforeAll(async ({}, testInfo) => {
            const isMobile = testInfo.project.name.includes('mobile');
            const backupEmailVar = isMobile
                ? 'TEST_EMAIL_AUTOMATE_OVER_UNDER_MOBILE'
                : 'TEST_EMAIL_AUTOMATE_OVER_UNDER';

            if (process.env.TEST_ENV === 'production') {
                const email = process.env[backupEmailVar];
                const password = process.env.TEST_PASSWORD;
                if (!email || !password) {
                    throw new Error(`${backupEmailVar} and TEST_PASSWORD must be set in playwright/.env.production`);
                }
                accountEmail = email;
                accountPassword = password;
            } else {
                const account = await createAccountV2viaJS('real', {
                    currency: 'USD',
                    trading: true,
                    backupAccount: process.env[backupEmailVar],
                });
                accountEmail = account.email;
                accountPassword = account.password;
            }
        });

        test.beforeEach(async ({ page, loginPage }) => {
            await TradeBasePage.seedLocalStorageOnOrigin(page);
            await loginPage.login(accountEmail, accountPassword);
        });

        test.afterEach(async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.stopAutomateRunIfActive();
        });

        /** Flow 12.1 — Over/Under D'Alembert: Over (demo) */
        test("VERIFY D'Alembert automation run on Over/Under — Over (Demo Account)", async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runOverUnderAndVerify({
                accountType: 'demo',
                market: 'Volatility 10 Index',
                tradeType: 'Over',
                durationTicks: '10 ticks',
                digit: '2',
                stake: '2',
                automation: {
                    strategy: "D'Alembert",
                    stakeIncrement: 3,
                    maxStake: '80',
                    profitThreshold: '114',
                    lossThreshold: '114',
                },
            });
        });

        /** Flow 12.2 — Over/Under D'Alembert: Over (real) */
        test("VERIFY D'Alembert automation run on Over/Under — Over (Real Account)", async ({ tradeAutomatePage }) => {
            const isProduction = process.env.TEST_ENV === 'production';
            await tradeAutomatePage.runOverUnderAndVerify({
                accountType: 'real',
                market: 'Volatility 10 Index',
                tradeType: 'Over',
                durationTicks: '10 ticks',
                digit: '1',
                stake: isProduction ? '0.35' : '2',
                automation: {
                    strategy: "D'Alembert",
                    stakeIncrement: isProduction ? 1 : 3,
                    maxStake: isProduction ? '5' : '81',
                    profitThreshold: isProduction ? '5' : '113',
                    lossThreshold: isProduction ? '6' : '113',
                },
            });
        });
    }
);
