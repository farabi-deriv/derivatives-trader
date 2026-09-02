/**
 * @name     Automate — risk threshold auto-stop (loss threshold reached)
 * @id       flow-2
 * @flow     playwright/flows/trade-automate/flow.md#flow-2--risk-threshold-auto-stop-lossprofit-threshold-reached
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../utils';

// A deliberately small loss threshold so cumulative loss reaches it within a few live
// contracts — Martingale doubles the stake on each loss, so the auto-stop fires quickly.
const LOSS_THRESHOLD = '1';

// Short tick duration so each contract settles in seconds — dozens settle inside the
// auto-stop window, guaranteeing the small loss threshold is reached deterministically.
// (A longer default duration leaves too few settlements per minute and the run never
// reaches the threshold in time.)
const DURATION_UNIT = 'Ticks';
const DURATION_VALUE = '5 ticks';

// Profit threshold set intentionally high so the run CANNOT stop on profit — it can only stop
// on the loss threshold. This makes the loss auto-stop (and the resulting negative closed P/L)
// deterministic. With the default profit threshold, a run with a few early wins could
// occasionally trip the profit threshold instead, leaving a positive P/L and failing the
// loss-corroboration check.
const PROFIT_THRESHOLD = '1000';

const MARKET = 'Volatility 100 Index';
const STAKE = '1';
const TRADE_TYPE = 'Rise/Fall';

let accountEmail: string;
let accountPassword: string;

test.describe('Automation — Loss Threshold Auto-Stop', { tag: ['@trade', '@automate', '@desktop', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_MOBILE' : 'TEST_EMAIL_AUTOMATE';

        // 'real' is intentional — this suite validates the real-account experience, matching the
        // rest of the trade specs. On the default staging environment a 'real' account is a
        // virtual/test account funded via top-up (no real money, no production). Automation itself
        // is gated by EU status (useIsAutomationEnabled), not by real-vs-demo, so it runs on both.
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
     * Flow 2 — configure the run so the loss threshold is the ONLY reachable stop, then verify it
     * auto-stops on its own:
     *   1. Short tick duration so contracts settle in seconds (many settle inside the window).
     *   2. High profit threshold (unreachable) + tiny loss threshold → the run can only stop on
     *      the loss threshold, never on profit. This is what makes the auto-stop deterministically
     *      a LOSS stop, so the test faithfully exercises Flow 2's risk-control path.
     *   3. Run → Running → let it reach the threshold → assert it returns to idle by itself.
     *
     * Verification approach — why we assert the durable idle state, not the notification:
     * The app shows a transient "Loss threshold reached. Automation stopped." snackbar, but it is
     * rendered with `hasCloseButton: false` and auto-dismisses after a few seconds — asserting it
     * is inherently racy (it can appear and vanish between polls). Instead we assert the DURABLE
     * outcome: the controls return to the idle Run button with no manual Stop click
     * (see `verifyLossThresholdAutoStop`). Combined with the unreachable profit threshold above,
     * a self-triggered return to idle can only mean the loss threshold fired.
     */
    test('VERIFY run auto-stops when the loss threshold is reached', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.goToAutomatedTrading();
        await tradeAutomatePage.selectMarketAndTradeType(MARKET, TRADE_TYPE, { mode: 'automate' });
        await tradeAutomatePage.setStake(STAKE);
        await tradeAutomatePage.selectDuration(DURATION_UNIT, DURATION_VALUE);
        await tradeAutomatePage.setProfitThreshold(PROFIT_THRESHOLD);
        await tradeAutomatePage.setLossThreshold(LOSS_THRESHOLD);
        await tradeAutomatePage.startAutomateRun();
        await tradeAutomatePage.verifyAutomateBotIsRunning({
            market: MARKET,
            stake: STAKE,
            tradeType: TRADE_TYPE,
        });
        await tradeAutomatePage.verifyLossThresholdAutoStop();
    });
});
