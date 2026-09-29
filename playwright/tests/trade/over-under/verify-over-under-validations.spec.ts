/**
 * @name     Over/Under — validations (no purchase)
 * @id       flow-6.3, flow-6.4
 * @flow     playwright/flows/trade/flow.md#flow-63--overunder-digit-duration-and-stake-validation
 * @coverage playwright/flows/trade/coverage.md
 *
 * Shared-account Over/Under checks that do not buy a contract. Park future OU validation
 * cases here as they are split out of `verify-manual-trade-negative-validation.spec.ts`.
 */
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';

test.describe('Trade — Over/Under', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_OVER_UNDER_MOBILE' : 'TEST_EMAIL_OVER_UNDER';
        const email = process.env[emailVar];
        if (!email) throw new Error(`${emailVar} is not set in playwright/.env`);
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    /**
     * Flow 6.3 — Over/Under trade-param validation (split from Flow 14): digit subtype
     * boundaries, then ticks-only Duration, then Stake. Select once — no `*ForConfiguration` re-select.
     */
    test('VERIFY Over/Under Digit, Duration, and Stake validation', async ({ tradeValidationPage }) => {
        await tradeValidationPage.selectMarketAndTradeType('Volatility 10 Index', 'Over/Under');
        await tradeValidationPage.verifyLastDigitPredictionChoiceAvailability();
        await tradeValidationPage.verifyDurationGuardrails('Over/Under');
        await tradeValidationPage.verifyStakeGuardrails('Over/Under');
    });

    /**
     * Flow 6.4 / issue #1384 — Higher/Lower seeds a price barrier; switching to Over/Under must
     * send the selected digit instead, or Buy never prices ("Barrier is not an integer…").
     */
    test('VERIFY Over/Under proposal prices after switching from Higher/Lower', async ({ tradeOverUnderPage }) => {
        await tradeOverUnderPage.verifyProposalAfterHigherLowerToOverUnder({
            market: 'Volatility 10 Index',
            digit: '7',
        });
    });
});
