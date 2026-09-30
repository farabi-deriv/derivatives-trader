/**
 * @name     Vanillas — validations (no purchase)
 * @id       flow-11.3
 * @flow     playwright/flows/trade/flow.md#flow-113--vanillas-duration-strike-and-stake-validation
 * @coverage playwright/flows/trade/coverage.md
 *
 * Shared-account Vanillas checks that do not buy a contract. Duration (offered units) + Strike
 * price (discrete barriers + Payout per point info) + Stake. Park future Vanillas validation
 * cases here as they are split out of `verify-manual-trade-negative-validation.spec.ts`.
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';

test.describe('Trade — Vanillas', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_VANILLAS_MOBILE' : 'TEST_EMAIL_VANILLAS';
        const email = process.env[emailVar];
        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    /**
     * Flow 11.3 — Vanillas trade-param validation (split from Flow 14): Duration, Strike price,
     * then Stake. Select once — no `*ForConfiguration` re-select. No Take profit on Vanillas.
     */
    test('VERIFY Vanillas Duration, Strike, and Stake validation', async ({ tradeValidationPage }) => {
        await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Vanillas');
        await tradeValidationPage.verifyDurationGuardrails('Vanillas');
        await tradeValidationPage.verifyStrikePriceGuardrails();
        await tradeValidationPage.verifyStakeGuardrails('Vanillas');
        await tradeValidationPage.verifyBuyButtonRemainsEnabled();
    });
});
