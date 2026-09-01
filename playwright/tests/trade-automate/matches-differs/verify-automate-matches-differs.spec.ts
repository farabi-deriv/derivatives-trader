/**
 * @name     Automate — Matches/Differs trade type run
 * @id       flow-9
 * @flow     playwright/flows/trade-automate/flow.md#flow-9--verify-automate-matches-differsspec
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Automate — Matches/Differs', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
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

    test('VERIFY automation run on Matches/Differs — Matches (Demo Account)', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runMatchesDiffersAndVerify({
            accountType: 'demo',
            market: 'Volatility 10 Index',
            tradeType: 'Matches',
            durationTicks: '10 ticks',
            digit: '1',
            stake: '3',
            automation: {
                strategy: 'Martingale',
                stakeMultiplier: 2,
                maxStake: '56',
                profitThreshold: '108',
                lossThreshold: '109',
            },
        });
    });

    test('VERIFY automation run on Matches/Differs — Matches (Real Account)', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runMatchesDiffersAndVerify({
            accountType: 'real',
            market: 'Volatility 10 Index',
            tradeType: 'Matches',
            durationTicks: '9 ticks',
            digit: '2',
            stake: '4',
            automation: {
                strategy: 'Martingale',
                stakeMultiplier: 2,
                maxStake: '55',
                profitThreshold: '106',
                lossThreshold: '107',
            },
        });
    });

    test('VERIFY automation run on Matches/Differs — Differs (Demo Account)', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runMatchesDiffersAndVerify({
            accountType: 'demo',
            market: 'Volatility 10 Index',
            tradeType: 'Differs',
            durationTicks: '9 ticks',
            digit: '8',
            stake: '5',
            automation: {
                strategy: 'Martingale',
                stakeMultiplier: 2,
                maxStake: '57',
                profitThreshold: '104',
                lossThreshold: '105',
            },
        });
    });

    test('VERIFY automation run on Matches/Differs — Differs (Real Account)', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.runMatchesDiffersAndVerify({
            accountType: 'real',
            market: 'Volatility 10 Index',
            tradeType: 'Differs',
            durationTicks: '10 ticks',
            digit: '9',
            stake: '6',
            automation: {
                strategy: 'Martingale',
                stakeMultiplier: 2,
                maxStake: '58',
                profitThreshold: '101',
                lossThreshold: '102',
            },
        });
    });
});
