/**
 * @name     Automate — Rise/Fall trade type run (Martingale — Rise)
 * @id       flow-5.1, flow-5.2
 * @flow     playwright/flows/trade-automate/flow.md#flow-5--risefall
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe(
    'Automate — Rise/Fall — Rise (Martingale)',
    { tag: ['@automate', '@martingale', '@desktop', '@mobile'] },
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

        /** Flow 5.1 — Rise/Fall Martingale: Rise (demo) */
        test('VERIFY automation run on Rise/Fall — Rise (Demo Account)', async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runRiseFallAndVerify({
                accountType: 'demo',
                market: 'Volatility 100 Index',
                tradeType: 'Rise',
                durationUnit: 'Ticks',
                durationValue: '10 ticks',
                stake: '1',
                automation: {
                    strategy: 'Martingale',
                    stakeMultiplier: 2,
                    maxStake: '150',
                    profitThreshold: '150',
                    lossThreshold: '150',
                },
            });
        });

        /** Flow 5.2 — Rise/Fall Martingale: Rise (real) */
        test('VERIFY automation run on Rise/Fall — Rise (Real Account)', async ({ tradeAutomatePage }) => {
            await tradeAutomatePage.runRiseFallAndVerify({
                accountType: 'real',
                market: 'Volatility 100 Index',
                tradeType: 'Rise',
                durationUnit: 'Ticks',
                durationValue: '10 ticks',
                stake: '3',
                automation: {
                    strategy: 'Martingale',
                    stakeMultiplier: 2,
                    maxStake: '151',
                    profitThreshold: '151',
                    lossThreshold: '151',
                },
            });
        });
    }
);
