/**
 * @name     Automate — Even/Odd trade type run (Martingale — Odd)
 * @id       flow-9.3, flow-9.4
 * @flow     playwright/flows/trade-automate/flow.md#flow-9--evenodd
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe(
    'Trade Automate — Even/Odd',
    { tag: ['@automate', '@martingale', '@smoke', '@desktop', '@mobile'] },
    () => {
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

        /** Flow 9.3 — Even/Odd Martingale: Odd (demo) */
        test('VERIFY automated trade run - Martingale - Odd (Demo)', async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runEvenOddAndVerify({
                accountType: 'demo',
                market: 'Volatility 10 Index',
                tradeType: 'Odd',
                durationTicks: '9 ticks',
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

        /** Flow 9.4 — Even/Odd Martingale: Odd (real) */
        test('VERIFY automated trade run - Martingale - Odd (Real)', async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runEvenOddAndVerify({
                accountType: 'real',
                market: 'Volatility 10 Index',
                tradeType: 'Odd',
                durationTicks: '8 ticks',
                stake: '4',
                automation: {
                    strategy: 'Martingale',
                    stakeMultiplier: 10,
                    maxStake: '65',
                    profitThreshold: '200',
                    lossThreshold: '201',
                },
            });
        });
    }
);
