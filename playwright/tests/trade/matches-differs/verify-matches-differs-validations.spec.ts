/**
 * @name     Matches/Differs — validations (no purchase)
 * @id       flow-5.3
 * @flow     playwright/flows/trade/flow.md#flow-53--matchesdiffers-digit-duration-and-stake-validation
 * @coverage playwright/flows/trade/coverage.md
 *
 * Shared-account Matches/Differs checks that do not buy a contract. Park future MD validation
 * cases here as they are split out of `verify-manual-trade-negative-validation.spec.ts`.
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';

test.describe('Trade — Matches/Differs', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_MATCHES_DIFFERS_MOBILE' : 'TEST_EMAIL_MATCHES_DIFFERS';
        const email = process.env[emailVar];
        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    /**
     * Flow 5.3 — Matches/Differs trade-param validation (split from Flow 14): digit choices
     * for both subtypes, then ticks-only Duration, then Stake. Select once — no
     * `*ForConfiguration` re-select.
     */
    test('VERIFY Matches/Differs Digit, Duration, and Stake validation', async ({ tradeValidationPage }) => {
        await tradeValidationPage.selectMarketAndTradeType('Volatility 10 Index', 'Matches/Differs');
        await tradeValidationPage.verifyMatchesDiffersDigitChoiceAvailability();
        await tradeValidationPage.verifyDurationGuardrails('Matches/Differs');
        await tradeValidationPage.verifyStakeGuardrails('Matches/Differs');
    });
});
