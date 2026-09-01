/**
 * @name     Automate — pause and resume a running strategy
 * @id       flow-1
 * @flow     playwright/flows/trade-automate/flow.md#flow-1--pause-and-resume-a-running-automation
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../utils';

let accountEmail: string;
let accountPassword: string;

const MARKET = 'Volatility 100 Index';
const STAKE = '1';
const TRADE_TYPE = 'Rise/Fall';

test.describe('Automate — Pause/Resume', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_MOBILE' : 'TEST_EMAIL_AUTOMATE';

        // 'real' is intentional — on staging a 'real' account is a virtual/test account funded via top-up (no real money, no production).
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

    // Always stop any run left active so a leftover bot can't affect the next test.
    test.afterEach(async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.stopAutomateRunIfActive();
    });

    /**
     * Flow 1 — start → Running → Pause → Paused → Resume → Running → Stop
     */
    test('VERIFY pause and resume a running automation', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.goToAutomatedTrading();
        await tradeAutomatePage.selectMarketAndTradeType(MARKET, TRADE_TYPE, { mode: 'automate' });
        await tradeAutomatePage.setStake(STAKE);
        await tradeAutomatePage.startAutomateRun();
        await tradeAutomatePage.verifyAutomateBotIsRunning({ market: MARKET, stake: STAKE, tradeType: TRADE_TYPE });
        await tradeAutomatePage.pauseRun();
        await tradeAutomatePage.verifyPaused();
        await tradeAutomatePage.resumeRun();
        await tradeAutomatePage.verifyAutomateBotIsRunning({ market: MARKET, stake: STAKE, tradeType: TRADE_TYPE });
        await tradeAutomatePage.stopAutomateRun();
    });
});
