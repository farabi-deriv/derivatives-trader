/**
 * @name     Touch/No Touch — validations (no purchase)
 * @id       flow-4.3
 * @flow     playwright/flows/trade/flow.md#flow-43--touchno-touch-barrier-duration-and-stake-validation
 * @coverage playwright/flows/trade/coverage.md
 *
 * Shared-account Touch/No Touch checks that do not buy a contract. Duration (all offered units) +
 * Barrier (zero/empty) + Stake. Park future TNT validation cases here as they are
 * split out of `verify-manual-trade-negative-validation.spec.ts`.
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';

test.describe('Trade — Touch/No Touch', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_TOUCH_NO_TOUCH_MOBILE' : 'TEST_EMAIL_TOUCH_NO_TOUCH';
        const email = process.env[emailVar];
        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    /**
     * Flow 4.3 — Touch/No Touch trade-param validation (split from Flow 14): Duration across offered
     * units, Barrier zero/empty, then Stake. Select once — no `*ForConfiguration` re-select.
     */
    test('VERIFY Touch/No Touch Barrier, Duration and Stake validation', async ({ tradeValidationPage }) => {
        await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Touch/No Touch');
        await tradeValidationPage.verifyDurationGuardrails('Touch/No Touch');
        await tradeValidationPage.verifyBarrierGuardrails();
        await tradeValidationPage.verifyStakeGuardrails('Touch/No Touch');
    });
});
