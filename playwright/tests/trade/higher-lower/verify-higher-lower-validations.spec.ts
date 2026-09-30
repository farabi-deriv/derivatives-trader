/**
 * @name     Higher/Lower — validations (no purchase)
 * @id       flow-3.3
 * @flow     playwright/flows/trade/flow.md#flow-33--higherlower-barrier-duration-and-stake-validation
 * @coverage playwright/flows/trade/coverage.md
 *
 * Shared-account Higher/Lower checks that do not buy a contract. Barrier (zero/empty/too-far) +
 * Duration (all offered units) + Stake. Park future HL validation cases here as they are
 * split out of `verify-manual-trade-negative-validation.spec.ts`.
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';

test.describe('Trade — Higher/Lower', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_HIGHER_LOWER_MOBILE' : 'TEST_EMAIL_HIGHER_LOWER';
        const email = process.env[emailVar];
        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    /**
     * Flow 3.3 — Higher/Lower trade-param validation (split from Flow 14): Barrier zero/empty,
     * Duration across offered units, then Stake. Select once — no `*ForConfiguration` re-select.
     */
    test('VERIFY Higher/Lower Barrier, Duration and Stake validation', async ({ tradeValidationPage }) => {
        await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Higher/Lower');
        await tradeValidationPage.verifyDurationGuardrails('Higher/Lower');
        await tradeValidationPage.verifyBarrierGuardrails();
        await tradeValidationPage.verifyStakeGuardrails('Higher/Lower');
    });
});
