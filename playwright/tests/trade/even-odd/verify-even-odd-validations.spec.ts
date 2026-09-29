/**
 * @name     Even/Odd — validations (no purchase)
 * @id       flow-7.3
 * @flow     playwright/flows/trade/flow.md#flow-73--evenodd-duration-and-stake-validation
 * @coverage playwright/flows/trade/coverage.md
 *
 * Shared-account Even/Odd checks that do not buy a contract. Even/Odd has no last-digit
 * prediction — Duration + Stake only. Park future EO validation cases here as they are
 * split out of `verify-manual-trade-negative-validation.spec.ts`.
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';

test.describe('Trade — Even/Odd', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_EVEN_ODD_MOBILE' : 'TEST_EMAIL_EVEN_ODD';
        const email = process.env[emailVar];
        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    /**
     * Flow 7.3 — Even/Odd trade-param validation (split from Flow 14): ticks-only Duration,
     * then Stake. No digit selector on this trade type. Select once — no `*ForConfiguration`.
     */
    test('VERIFY Even/Odd Duration and Stake validation', async ({ tradeValidationPage }) => {
        await tradeValidationPage.selectMarketAndTradeType('Volatility 10 Index', 'Even/Odd');
        await tradeValidationPage.verifyDurationGuardrails('Even/Odd');
        await tradeValidationPage.verifyStakeGuardrails('Even/Odd');
    });
});
