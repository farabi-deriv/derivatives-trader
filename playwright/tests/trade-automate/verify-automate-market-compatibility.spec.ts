/**
 * @name     Automate — market compatibility when switching from Manual
 * @id       flow-16
 * @flow     playwright/flows/trade-automate/flow.md#flow-16--manual-to-automate-market-compatibility
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test, expect } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';

let testEmail: string = undefined!;

test.describe('Automate — Market compatibility', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
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

    /** Flow 16 — issue #916: switching from Range Break manual must not leave Automate trade-type loading forever */
    test('VERIFY Range Break Index loads Automate without an infinite trade-type spinner', async ({
        tradeAutomatePage,
    }) => {
        await tradeAutomatePage.selectMarketAndTradeType('Range Break 100 Index', 'Multipliers', { mode: 'manual' });
        await tradeAutomatePage.goToAutomatedTrading();
        await expect(
            tradeAutomatePage.strategyParametersHeader,
            'Strategy parameters should render after switching to Automate from Range Break (no infinite spinner)'
        ).toBeVisible();
    });

    /** Flow 16 — issue #917: Crash/Boom + Accumulators should stay on the selected symbol in Automate */
    test('VERIFY Crash/Boom with Accumulators remains on the selected market in Automate', async ({
        tradeAutomatePage,
    }) => {
        await tradeAutomatePage.verifyAutomateMarketCompatibility({
            market: 'Crash 500 Index',
            tradeType: 'Accumulators',
            expectAutomatable: true,
        });
    });
});
