/**
 * @name     Automate — Even/Odd trade type run (Martingale — Even)
 * @id       flow-9.1
 * @flow     playwright/flows/trade-automate/flow.md#flow-9--evenodd
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe(
    'Automate — Even/Odd — Even (Martingale)',
    { tag: ['@automate', '@martingale', '@smoke', '@desktop', '@mobile', '@production'] },
    () => {
        test.describe.configure({ mode: 'serial' });

        test.beforeAll(async ({}, testInfo) => {
            const isMobile = testInfo.project.name.includes('mobile');
            const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_EVEN_ODD_MOBILE' : 'TEST_EMAIL_AUTOMATE_EVEN_ODD';

            if (process.env.TEST_ENV === 'production') {
                const email = process.env[backupEmailVar];
                const password = process.env.TEST_PASSWORD;
                if (!email || !password)
                    throw new Error(`${backupEmailVar} and TEST_PASSWORD must be set in playwright/.env.production`);
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

        /** Flow 9.1 — Even/Odd Martingale: Even (real). Real uses minimal stake on production. */
        test('VERIFY automation run on Even/Odd — Even (Real Account)', async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runEvenOddAndVerify({
                accountType: 'real',
                market: 'Volatility 10 Index',
                tradeType: 'Even',
                durationTicks: '9 ticks',
                stake: process.env.TEST_ENV === 'production' ? '0.35' : '1',
                automation: {
                    strategy: 'Martingale',
                    stakeMultiplier: 5,
                    maxStake: '65',
                    profitThreshold: '200',
                    lossThreshold: '201',
                },
            });
        });

        /** Flow 9.1 — Even/Odd Martingale: Even (demo) */
        test('VERIFY automation run on Even/Odd — Even (Demo Account)', async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runEvenOddAndVerify({
                accountType: 'demo',
                market: 'Volatility 10 Index',
                tradeType: 'Even',
                durationTicks: '10 ticks',
                stake: '1',
                automation: {
                    strategy: 'Martingale',
                    stakeMultiplier: 5,
                    maxStake: '66',
                    profitThreshold: '201',
                    lossThreshold: '200',
                },
            });
        });
    }
);
