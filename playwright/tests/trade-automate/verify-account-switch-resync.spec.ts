/**
 * @name     Automate — resync after account switch (run stays Running)
 * @id       flow-3
 * @flow     playwright/flows/trade-automate/flow.md#flow-3--resync-after-account-switch-run-stays-running
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';
import { createAccountV2viaJS } from '../../utils';

let accountEmail: string;
let accountPassword: string;

test.describe('Automate — Resync', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
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

    test('VERIFY automation run is re-adopted as Running after switching account', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.goToAutomatedTrading();
        await tradeAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', { mode: 'automate' });
        await tradeAutomatePage.verifyPanelDefaultState();
        // Low stake so the live bot cannot burn much before it is stopped.
        await tradeAutomatePage.setStake('1');
        await tradeAutomatePage.selectDuration('Ticks', '10 ticks');
        await tradeAutomatePage.startAutomateRun();
        await tradeAutomatePage.verifyAutomateBotIsRunning({
            market: 'Volatility 100 Index',
            stake: '1',
            tradeType: 'Rise/Fall',
        });

        // Switch to the demo account (Account B), then back to the real account (Account A).
        await tradeAutomatePage.switchToAccountType('demo');
        await tradeAutomatePage.goToAutomatedTrading();
        await tradeAutomatePage.verifyPanelDefaultState();
        await tradeAutomatePage.switchToAccountType('real');

        // The run on Account A must still be Running after the round-trip — the resync guard.
        await tradeAutomatePage.verifyAutomateBotIsRunning({
            market: 'Volatility 100 Index',
            stake: '1',
            tradeType: 'Rise/Fall',
        });

        await tradeAutomatePage.stopAutomateRun();
    });
});
