/**
 * @name     Automate — invalid trade and automation param validation
 * @id       flow-15
 * @flow     playwright/flows/trade-automate/flow.md#flow-15--invalid-trade-and-automation-param-validation
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';

let testEmail: string = undefined!;

test.describe('Automate — Trade Param Validation', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_MOBILE' : 'TEST_EMAIL_AUTOMATE';
        const email = process.env[emailVar];

        if (!email) {
            throw new Error(`${emailVar} is not set in playwright/.env.staging`);
        }

        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    test.afterEach(async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.stopAutomateRunIfActive();
    });

    /** Flow 15.1 — trade-form stake + Martingale automation panel negative validation */
    test('VERIFY automate trade params reject invalid drafts — Martingale', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.goToAutomatedTrading();
        await tradeAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', { mode: 'automate' });
        await tradeAutomatePage.verifyPanelDefaultState();
        await tradeAutomatePage.setStake('1');
        await tradeAutomatePage.selectDuration('Ticks', '10 ticks');

        await tradeAutomatePage.verifyInitialStakeRejectsInvalidAmount();
        await tradeAutomatePage.verifyStakeMultiplierRejectsInvalidAmount();
        await tradeAutomatePage.verifyMaxStakeRejectsInvalidAmount();
        await tradeAutomatePage.verifyAutomationThresholdsRejectInvalidAmount();

        await tradeAutomatePage.verifyAutomatePanelIdleAfterParamValidation();
    });

    /** Flow 15.2 — D'Alembert stake increment negative validation (shared thresholds/max stake covered in 15.1) */
    test("VERIFY automate trade params reject invalid drafts — D'Alembert", async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.goToAutomatedTrading();
        await tradeAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', { mode: 'automate' });
        await tradeAutomatePage.verifyPanelDefaultState();
        await tradeAutomatePage.setStake('1');
        await tradeAutomatePage.selectDuration('Ticks', '10 ticks');
        await tradeAutomatePage.selectStrategy({ strategy: "D'Alembert", stakeIncrement: 2 });

        await tradeAutomatePage.verifyStakeIncrementRejectsInvalidAmount();
        await tradeAutomatePage.verifyAutomatePanelIdleAfterParamValidation();
    });
});
