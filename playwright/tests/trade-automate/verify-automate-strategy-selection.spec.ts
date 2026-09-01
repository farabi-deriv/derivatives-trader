/**
 * @name     Automate — strategy selection and parameters
 * @id       flow-3
 * @flow     playwright/flows/trade-automate/flow.md#flow-3--strategy-selection-and-parameters
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

test.describe('Automate — Strategy selection', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
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
     * Flow 3 — default (Martingale) → open strategy list → select D'Alembert → set Stake increment
     *          → Run → Running → Stop, so the run executes with the chosen strategy.
     */
    test("VERIFY select D'Alembert strategy, set its parameter, then run and stop", async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.goToAutomatedTrading();
        await tradeAutomatePage.selectMarketAndTradeType(MARKET, TRADE_TYPE, { mode: 'automate' });
        await tradeAutomatePage.setStake(STAKE);
        // Confirm the default state (Martingale) before switching strategy.
        await tradeAutomatePage.verifyPanelDefaultState();
        // Open the selector, confirm both strategies are offered, and switch to D'Alembert.
        await tradeAutomatePage.selectStrategy("D'Alembert");
        // D'Alembert exposes a Stake increment param — set it via a preset chip and confirm it persists.
        await tradeAutomatePage.setStakeIncrement(3);
        // The run must execute with the newly selected strategy.
        await tradeAutomatePage.startAutomateRun();
        await tradeAutomatePage.verifyAutomateBotIsRunning({ market: MARKET, stake: STAKE, tradeType: TRADE_TYPE });
        await tradeAutomatePage.stopAutomateRun();
    });
});
