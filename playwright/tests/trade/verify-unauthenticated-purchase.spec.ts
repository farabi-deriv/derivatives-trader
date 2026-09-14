/**
 * @name     Unauthenticated Purchase
 * @id       flow-16
 * @flow     playwright/flows/trade/flow.md#flow-16--unauthenticated-purchase--login-prompt-sheet
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../fixtures/fixtures';

test.describe('Trade — Unauthenticated Purchase', { tag: ['@trade', '@desktop', '@mobile'] }, () => {
    test.beforeEach(async ({ tradeParametersPage }) => {
        await tradeParametersPage.gotoTradePage();
        await tradeParametersPage.verifyDTraderLandingPageLoggedOut();
        await tradeParametersPage.clickBuyLoggedOut();
        await tradeParametersPage.verifyAuthorizationRequiredSheet();
    });

    test('VERIFY Login button on authorization sheet navigates to login page', async ({ tradeParametersPage }) => {
        await tradeParametersPage.clickAuthorizationLoginButton();
        await tradeParametersPage.verifyNavigatedToLoginPage();
    });

    test('VERIFY Create free account button navigates to signup page', async ({ tradeParametersPage }) => {
        await tradeParametersPage.clickAuthorizationCreateFreeAccountButton();
        await tradeParametersPage.verifyNavigatedToSignupPage();
    });
});
