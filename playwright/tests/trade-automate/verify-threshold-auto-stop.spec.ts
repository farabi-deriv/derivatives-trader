/**
 * @name     Automate — risk threshold auto-stop (loss and profit)
 * @id       flow-2.1, flow-2.2
 * @flow     playwright/flows/trade-automate/flow.md#flow-21--loss-threshold-auto-stop
 *           playwright/flows/trade-automate/flow.md#flow-22--profit-threshold-auto-stop
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Automate — Threshold Auto-Stop', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_MOBILE' : 'TEST_EMAIL_AUTOMATE';

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

    /** Flow 2.1 — loss threshold auto-stop (profit threshold set unreachable) */
    test('VERIFY loss threshold auto-stops the run', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.goToAutomatedTrading();
        await tradeAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', { mode: 'automate' });
        await tradeAutomatePage.verifyPanelDefaultState();
        await tradeAutomatePage.setStake('1');
        await tradeAutomatePage.selectDuration('Ticks', '10 ticks');
        await tradeAutomatePage.setProfitThreshold('1000');
        await tradeAutomatePage.setLossThreshold('1');
        await tradeAutomatePage.startAutomateRun();
        await tradeAutomatePage.verifyAutomateBotIsRunning({
            market: 'Volatility 100 Index',
            stake: '1',
            tradeType: 'Rise/Fall',
        });
        await tradeAutomatePage.verifyLossThresholdAutoStop();
    });

    /** Flow 2.2 — profit threshold auto-stop (loss threshold set unreachable) */
    test('VERIFY profit threshold auto-stops the run', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.goToAutomatedTrading();
        await tradeAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', { mode: 'automate' });
        await tradeAutomatePage.verifyPanelDefaultState();
        await tradeAutomatePage.setStake('1');
        await tradeAutomatePage.selectDuration('Ticks', '10 ticks');
        await tradeAutomatePage.setProfitThreshold('1');
        await tradeAutomatePage.setLossThreshold('1000');
        await tradeAutomatePage.startAutomateRun();
        await tradeAutomatePage.verifyAutomateBotIsRunning({
            market: 'Volatility 100 Index',
            stake: '1',
            tradeType: 'Rise/Fall',
        });
        await tradeAutomatePage.verifyProfitThresholdAutoStop();
    });
});
