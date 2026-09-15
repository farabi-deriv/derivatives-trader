/**
 * @name     Automate — Over/Under trade type run (Martingale — Under)
 * @id       flow-8.3, flow-8.4
 * @flow     playwright/flows/trade-automate/flow.md#flow-8--overunder
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe(
    'Automate — Over/Under — Under (Martingale)',
    { tag: ['@automate', '@martingale', '@desktop', '@mobile'] },
    () => {
        test.describe.configure({ mode: 'serial' });

        test.beforeAll(async ({}, testInfo) => {
            const isMobile = testInfo.project.name.includes('mobile');
            const backupEmailVar = isMobile
                ? 'TEST_EMAIL_AUTOMATE_OVER_UNDER_MOBILE'
                : 'TEST_EMAIL_AUTOMATE_OVER_UNDER';

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

        /** Flow 8.3 — Over/Under Martingale: Under (demo) */
        test('VERIFY automation run on Over/Under — Under (Demo Account)', async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runOverUnderAndVerify({
                accountType: 'demo',
                market: 'Volatility 10 Index',
                tradeType: 'Under',
                durationTicks: '10 ticks',
                digit: '5',
                stake: '1',
                automation: {
                    strategy: 'Martingale',
                    stakeMultiplier: 2,
                    maxStake: '72',
                    profitThreshold: '102',
                    lossThreshold: '102',
                },
            });
        });

        /** Flow 8.4 — Over/Under Martingale: Under (real) */
        test('VERIFY automation run on Over/Under — Under (Real Account)', async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runOverUnderAndVerify({
                accountType: 'real',
                market: 'Volatility 10 Index',
                tradeType: 'Under',
                durationTicks: '10 ticks',
                digit: '6',
                stake: '1',
                automation: {
                    strategy: 'Martingale',
                    stakeMultiplier: 2,
                    maxStake: '73',
                    profitThreshold: '101',
                    lossThreshold: '101',
                },
            });
        });
    }
);
