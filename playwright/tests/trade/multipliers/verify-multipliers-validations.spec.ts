/**
 * @name     Multipliers — validations (no purchase)
 * @id       flow-9.9
 * @flow     playwright/flows/trade/flow.md#flow-99--multipliers-multiplier-stake-and-risk-management-validation
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';

test.describe('Trade — Multipliers', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_MULTIPLIERS_MOBILE' : 'TEST_EMAIL_MULTIPLIERS';
        const email = process.env[emailVar];
        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    /**
     * Flow 9.9 — Multipliers trade-param validation (split from Flow 14): no Duration, Multiplier
     * options, Stake, Risk management TP/SL + Deal Cancellation. Select once.
     */
    test('VERIFY Multipliers Multiplier, Stake, and Risk management validation', async ({ tradeValidationPage }) => {
        await tradeValidationPage.selectMarketAndTradeType('Volatility 25 (1s) Index', 'Multipliers');
        await tradeValidationPage.verifyMultiplierGuardrails();
        await tradeValidationPage.verifyDurationGuardrails('Multipliers');
        await tradeValidationPage.verifyStakeGuardrails('Multipliers');
        await tradeValidationPage.verifyMultipliersRiskManagementGuardrails();
        await tradeValidationPage.verifyBuyButtonRemainsEnabled();
    });
});
