/**
 * @name     Automate — Matches/Differs trade type run (D'Alembert — Matches)
 * @id       flow-12.1
 * @flow     playwright/flows/trade-automate/flow.md#flow-12--matchesdiffers-dalembert
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe(
    "Automate — Matches/Differs — Matches (D'Alembert)",
    { tag: ['@automate', '@dalembert', '@desktop', '@mobile'] },
    () => {
        test.describe.configure({ mode: 'serial' });

        test.beforeAll(async ({}, testInfo) => {
            const isMobile = testInfo.project.name.includes('mobile');
            const backupEmailVar = isMobile
                ? 'TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS_MOBILE'
                : 'TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS';

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

        /** Flow 12.1 — Matches/Differs D'Alembert: Matches (demo) */
        test("VERIFY D'Alembert automation run on Matches/Differs — Matches (Demo Account)", async ({
            tradeAutomatePage,
        }) => {
            await tradeAutomatePage.runMatchesDiffersAndVerify({
                accountType: 'demo',
                market: 'Volatility 10 Index',
                tradeType: 'Matches',
                durationTicks: '10 ticks',
                digit: '0',
                stake: '2',
                automation: {
                    strategy: "D'Alembert",
                    stakeIncrement: 3,
                    maxStake: '66',
                    profitThreshold: '118',
                    lossThreshold: '119',
                },
            });
        });

        /** Flow 12.1 — Matches/Differs D'Alembert: Matches (real) */
        test("VERIFY D'Alembert automation run on Matches/Differs — Matches (Real Account)", async ({
            tradeAutomatePage,
        }) => {
            await tradeAutomatePage.runMatchesDiffersAndVerify({
                accountType: 'real',
                market: 'Volatility 10 Index',
                tradeType: 'Matches',
                durationTicks: '9 ticks',
                digit: '3',
                stake: '3',
                automation: {
                    strategy: "D'Alembert",
                    stakeIncrement: 3,
                    maxStake: '65',
                    profitThreshold: '116',
                    lossThreshold: '117',
                },
            });
        });
    }
);
