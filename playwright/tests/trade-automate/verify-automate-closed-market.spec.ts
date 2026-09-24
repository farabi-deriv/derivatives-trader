/**
 * @name     Automate — Strategy/Risk params disabled when market closed
 * @id       flow-18
 * @flow     playwright/flows/trade-automate/flow.md#flow-18--automate-params-disabled-when-market-closed
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';

let testEmail: string = undefined!;

test.describe('Automate — Closed market params', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
    test.beforeAll(async ({}, testInfo) => {
        const emailVar = testInfo.project.name.includes('mobile')
            ? 'TEST_EMAIL_AUTOMATE_MOBILE'
            : 'TEST_EMAIL_AUTOMATE';
        const email = process.env[emailVar];

        if (!email) {
            throw new Error(`${emailVar} is not set in playwright/.env.staging`);
        }

        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    /** Flow 18 — issue #1426: Strategy parameters + Risk management disabled while market is closed */
    test('VERIFY Automate strategy and risk params are disabled when the market is closed', async ({
        tradeAutomatePage,
    }) => {
        // Select CLOSED from the Trade picker first — Automate mobile search filters some session-gated
        // symbols (e.g. BTC/USD) and can miss CLOSED candidates the Trade picker finds.
        await tradeAutomatePage.gotoTradePage();
        const selection = await tradeAutomatePage.selectClosedMarketFromPicker();
        if (!selection) {
            test.skip(true, 'No session-gated market is CLOSED right now — rerun outside exchange hours');
            return;
        }

        await tradeAutomatePage.goToAutomatedTrading();
        await tradeAutomatePage.verifyClosedMarketAutomateParamsDisabled(selection.tradeType);
    });
});
