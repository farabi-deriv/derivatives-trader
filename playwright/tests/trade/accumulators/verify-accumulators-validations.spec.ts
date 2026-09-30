/**
 * @name     Accumulators — validations (no purchase)
 * @id       flow-8.3
 * @flow     playwright/flows/trade/flow.md#flow-83--accumulators-growth-rate-stake-and-take-profit-validation
 * @coverage playwright/flows/trade/coverage.md
 *
 * Shared-account Accumulators checks that do not buy a contract. Accumulators expose Growth rate,
 * Stake, and Take profit (no Duration). Park future Accumulators validation cases here as they are
 * split out of `verify-manual-trade-negative-validation.spec.ts`.
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';

test.describe('Trade — Accumulators', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_ACCUMULATORS_MOBILE' : 'TEST_EMAIL_ACCUMULATORS';
        const email = process.env[emailVar];
        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    /**
     * Flow 8.3 — Accumulators trade-param validation (split from Flow 14): Growth rate options,
     * Stake Range, then standalone Take profit. Select once — no `*ForConfiguration` re-select.
     */
    test('VERIFY Accumulators Growth rate, Stake, and Take profit validation', async ({ tradeValidationPage }) => {
        await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Accumulators');
        await tradeValidationPage.verifyGrowthRateGuardrails();
        await tradeValidationPage.verifyStakeGuardrails('Accumulators');
        await tradeValidationPage.verifyTakeProfitGuardrails();
        await tradeValidationPage.verifyBuyButtonRemainsEnabled();
    });
});
