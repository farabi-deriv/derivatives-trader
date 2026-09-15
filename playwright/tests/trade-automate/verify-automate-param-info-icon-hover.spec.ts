/**
 * @name     Automate — parameter info icon descriptions
 * @id       flow-17
 * @flow     playwright/flows/trade-automate/flow.md#flow-17--automate-param-info-icons-reveal-descriptions
 * @coverage playwright/flows/trade-automate/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeAutomatePage } from '../../pages/TradeAutomatePage';
import { TradeBasePage } from '../../pages/TradeBasePage';

test.describe('Automate — parameter info icon', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const emailVar = testInfo.project.name.includes('mobile')
            ? 'TEST_EMAIL_AUTOMATE_MOBILE'
            : 'TEST_EMAIL_AUTOMATE';
        const email = process.env[emailVar];

        if (!email) {
            throw new Error(`${emailVar} is not set in playwright/.env.staging`);
        }

        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage, tradeAutomatePage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
        await tradeAutomatePage.goToAutomatedTrading();
    });

    /**
     * Issue #995 — automation panel + Accumulators trade-form params share TradeParameterPopover
     * info icons (desktop hover-reveal; mobile action-sheet header tooltip).
     */
    test('VERIFY automate param info icons reveal authored descriptions', async ({ tradeAutomatePage }, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');

        for (const {
            market,
            tradeType,
            strategyDesktopParams,
            strategyMobileChecks,
            tradeFormDesktopParams,
            tradeFormMobileChecks,
        } of TradeAutomatePage.AUTOMATE_PARAM_INFO_ICON_CASES) {
            await test.step(`${tradeType} on ${market}`, async () => {
                await tradeAutomatePage.selectMarketAndTradeType(market, tradeType, {
                    mode: 'automate',
                    verifyParams: false,
                });

                if (isMobile) {
                    for (const { openField, icons } of strategyMobileChecks) {
                        await test.step(`strategy — ${openField}`, async () => {
                            await tradeAutomatePage.verifyTradeParamInfoIconsInMobileEditor(openField, icons);
                        });
                    }
                    for (const { openField, icons } of tradeFormMobileChecks ?? []) {
                        await test.step(`trade form — ${openField}`, async () => {
                            await tradeAutomatePage.verifyTradeParamInfoIconsInMobileEditor(openField, icons);
                        });
                    }
                    return;
                }

                for (const { label, descriptions } of strategyDesktopParams) {
                    await test.step(`strategy — ${label}`, async () => {
                        await tradeAutomatePage.verifyAutomateParamInfoIconOnDesktop(label, descriptions);
                    });
                }
                for (const { label, descriptions } of tradeFormDesktopParams ?? []) {
                    await test.step(`trade form — ${label}`, async () => {
                        await tradeAutomatePage.verifyTradeParamInfoIconOnDesktop(label, descriptions);
                    });
                }
            });
        }
    });
});
