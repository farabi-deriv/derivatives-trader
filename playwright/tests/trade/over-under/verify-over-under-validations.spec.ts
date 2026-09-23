/**
 * @name     Over/Under — validations (no purchase)
 * @id       flow-21
 * @flow     playwright/flows/trade/flow.md#flow-21--higherlower--overunder-proposal-uses-last_digit
 * @coverage playwright/flows/trade/coverage.md
 *
 * Shared-account Over/Under checks that do not buy a contract. Park future OU validation
 * cases here (proposal, digit gating, trade-type switch side effects, etc.).
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
     * Flow 21 / issue #1384 — Higher/Lower seeds a price barrier; switching to Over/Under must
     * send the selected digit instead, or Buy never prices ("Barrier is not an integer…").
     */
    test('VERIFY Over/Under proposal prices after switching from Higher/Lower', async ({ tradeOverUnderPage }) => {
        await tradeOverUnderPage.verifyProposalAfterHigherLowerToOverUnder({
            market: 'Volatility 10 Index',
            digit: '7',
        });
    });
});
