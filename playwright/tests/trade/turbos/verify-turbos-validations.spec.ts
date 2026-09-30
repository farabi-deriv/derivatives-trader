/**
 * @name     Turbos — validations (no purchase)
 * @id       flow-10.5
 * @flow     playwright/flows/trade/flow.md#flow-105--turbos-duration-payout-per-point-stake-and-take-profit-validation
 * @coverage playwright/flows/trade/coverage.md
 *
 * Shared-account Turbos checks that do not buy a contract. Duration (offered units) + Stake +
 * Payout per point + standalone Take profit. Park future Turbos validation cases here as they are
 * split out of `verify-manual-trade-negative-validation.spec.ts`.
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';

test.describe('Trade — Turbos', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_TURBOS_MOBILE' : 'TEST_EMAIL_TURBOS';
        const email = process.env[emailVar];
        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    /**
     * Flow 10.5 — Turbos trade-param validation (split from Flow 14): Duration, Stake, Payout per
     * point, then standalone Take profit. Select once — no `*ForConfiguration` re-select.
     */
    test('VERIFY Turbos Duration, Payout per point, Stake, and Take profit validation', async ({
        tradeValidationPage,
    }) => {
        await tradeValidationPage.selectMarketAndTradeType('Volatility 100 (1s) Index', 'Turbos');
        await tradeValidationPage.verifyDurationGuardrails('Turbos');
        await tradeValidationPage.verifyStakeGuardrails('Turbos');
        await tradeValidationPage.verifyPayoutPerPointGuardrails();
        await tradeValidationPage.verifyTakeProfitGuardrails();
        await tradeValidationPage.verifyBuyButtonRemainsEnabled();
    });
});
