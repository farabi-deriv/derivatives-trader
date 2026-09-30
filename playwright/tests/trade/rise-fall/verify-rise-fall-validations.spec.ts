/**
 * @name     Rise/Fall — validations (no purchase)
 * @id       flow-2.5
 * @flow     playwright/flows/trade/flow.md#flow-25--risefall-duration-and-stake-validation
 * @coverage playwright/flows/trade/coverage.md
 *
 * Shared-account Rise/Fall checks that do not buy a contract. Duration (all offered units) + Stake.
 * Park future RF validation cases here as they are split out of
 * `verify-manual-trade-negative-validation.spec.ts`. Cross-market Rise/Fall stake/duration sweeps
 * stay in Flow 14.
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';

test.describe('Trade — Rise/Fall', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_RISE_FALL_MOBILE' : 'TEST_EMAIL_RISE_FALL';
        const email = process.env[emailVar];
        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    /**
     * Flow 2.5 — Rise/Fall trade-param validation (split from Flow 14): Duration across offered
     * units, then Stake. Select once — no `*ForConfiguration` re-select.
     */
    test('VERIFY Rise/Fall Duration and Stake validation', async ({ tradeValidationPage }) => {
        await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall');
        await tradeValidationPage.verifyDurationGuardrails('Rise/Fall');
        await tradeValidationPage.verifyStakeGuardrails('Rise/Fall');
    });
});
