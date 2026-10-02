/**
 * @name     Cross-tab deep link — URL trade type resolves over the inherited session market
 * @id       flow-21
 * @flow     playwright/flows/trade/flow.md#flow-21--cross-tab-deep-link--url-trade-type-resolves-over-the-inherited-session
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../utils';

// Issue-faithful deep links (home-app Top Markets cards): Rise/Fall on the (1s) volatility markets.
const DEEP_LINK_RISE_FALL_1HZ25V = 'trade_type=rise_fall&symbol=1HZ25V&chart_type=area&interval=1t';
const DEEP_LINK_RISE_FALL_1HZ100V = 'trade_type=rise_fall&symbol=1HZ100V&chart_type=area&interval=1t';
// Genuinely invalid trade type — the modal must still fire (Flow 18's control query).
const DEEP_LINK_INVALID_TRADE_TYPE = 'trade_type=high_lowsd&symbol=1HZ100V&chart_type=area&interval=1t';

let accountEmail: string = undefined!;
let accountPassword: string = undefined!;

// Regression for #1524: a deep link opened in a new tab after a Crash 500 Accumulators session
// landed on the default market or showed the "Invalid trade type" popup, because Chrome clones
// sessionStorage into a `target="_blank"` tab — the new tab's trade store restores the outgoing
// market (Crash 500 + Accumulators) before the URL trade type resolves, and the pre-#1528
// availability decision judged the URL trade type against that inherited contract-type list.
// `context.newPage()` cannot reproduce this (a fresh page starts with an empty session) — which is
// why Flow 18 only covers the plain same-tab modal paths — so the popup is opened via a real
// `target="_blank"` anchor (`openTradeQueryInNewTab`).
//
// A DEDICATED account is created per run (accumulators-spec pattern) instead of the shared
// TEST_EMAIL: CI and other local suites log in with the shared account, and a concurrent login
// can invalidate this run's session mid-flight. That is also why no `backupAccount` is passed —
// falling back to a shared account would reintroduce exactly that session-invalidation risk.
test.describe('Trade — Cross-tab deep link', { tag: ['@desktop', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async () => {
        if (!process.env.BASE_URL) {
            throw new Error('BASE_URL is not set — add it to playwright/.env.staging');
        }
        const account = await createAccountV2viaJS('real', { currency: 'USD', trading: true });
        accountEmail = account.email;
        accountPassword = account.password;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(accountEmail, accountPassword);
    });

    /**
     * Flow 21 — step 3: deep link to another market opens in a new tab (inheriting the Crash 500
     * sessionStorage) and lands on the linked Volatility 25 (1s) Rise/Fall, not the inherited
     * market or the account default.
     */
    test('VERIFY deep link to another market lands on the linked market after a Crash 500 Accumulators session', async ({
        tradeParametersPage,
    }) => {
        // Precondition from the issue: Accumulators active on Crash 500 Index.
        await tradeParametersPage.selectMarketAndTradeType('Crash 500 Index', 'Accumulators', {
            verifyParams: false,
        });
        await tradeParametersPage.verifySessionOwnsMarket('CRASH500');

        // The popup inherits the Crash 500 session — pre-fix this silently substituted the default market.
        const popup = await tradeParametersPage.openTradeQueryInNewTab(DEEP_LINK_RISE_FALL_1HZ25V);
        try {
            await tradeParametersPage.verifyDeepLinkLandedOnMarket(popup, {
                market: 'Volatility 25 (1s)',
                tradeType: 'Rise/Fall',
                symbol: '1HZ25V',
            });
        } finally {
            // Release the popup tab promptly (verify-already-running.spec.ts convention) — the serial
            // suite would otherwise accumulate open pages across the file.
            await popup.close();
        }
    });

    /**
     * Flow 21 — step 4: the issue reporter's default-market card (Volatility 100 (1s) Rise/Fall)
     * loads with no "Invalid trade type" popup — pre-fix this variant showed the popup.
     */
    test('VERIFY default-market deep link loads Rise/Fall with no invalid-trade-type popup after a Crash 500 Accumulators session', async ({
        tradeParametersPage,
    }) => {
        await tradeParametersPage.selectMarketAndTradeType('Crash 500 Index', 'Accumulators', {
            verifyParams: false,
        });
        await tradeParametersPage.verifySessionOwnsMarket('CRASH500');

        // Pre-fix this variant (the issue reporter's default card) showed "Invalid trade type".
        const popup = await tradeParametersPage.openTradeQueryInNewTab(DEEP_LINK_RISE_FALL_1HZ100V);
        try {
            await tradeParametersPage.verifyDeepLinkLandedOnMarket(popup, {
                market: 'Volatility 100 (1s)',
                tradeType: 'Rise/Fall',
                symbol: '1HZ100V',
            });
        } finally {
            // Release the popup tab promptly (verify-already-running.spec.ts convention) — the serial
            // suite would otherwise accumulate open pages across the file.
            await popup.close();
        }
    });

    /**
     * Flow 21 — step 5: a genuinely invalid trade type still shows the "Unsupported trade type"
     * modal on the popup — the fix resolves valid links without silencing the legitimate modal.
     */
    test('VERIFY genuinely invalid trade type deep link still shows the Unsupported trade type modal', async ({
        tradeParametersPage,
    }) => {
        await tradeParametersPage.selectMarketAndTradeType('Crash 500 Index', 'Accumulators', {
            verifyParams: false,
        });
        await tradeParametersPage.verifySessionOwnsMarket('CRASH500');

        // The fix must not silence the legitimate modal (the issue's card resolution is not a
        // blanket suppression).
        const popup = await tradeParametersPage.openTradeQueryInNewTab(DEEP_LINK_INVALID_TRADE_TYPE);
        try {
            await tradeParametersPage.verifyUnsupportedTradeTypeModalOnPopup(popup);
        } finally {
            // Release the popup tab promptly (verify-already-running.spec.ts convention) — the serial
            // suite would otherwise accumulate open pages across the file.
            await popup.close();
        }
    });
});
