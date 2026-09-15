/**
 * @name     Trade — manual parameter info icon descriptions
 * @id       flow-19
 * @flow     playwright/flows/trade/flow.md#flow-19--manual-trade-param-info-icons-reveal-descriptions
 * @coverage playwright/flows/trade/coverage.md
 */
import { test } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';
import { TradeParametersPage } from '../../pages/TradeParametersPage';

test.describe('Trade — parameter info icon', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(() => {
        const email = process.env.TEST_EMAIL;
        if (!email) throw new Error('TEST_EMAIL is not set in playwright/.env');
        testEmail = email;
    });

    test.beforeEach(async ({ page, loginPage, tradeParametersPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
        await tradeParametersPage.gotoTradePage();
    });

    /**
     * Issue #995 — desktop: hover-reveal icon + TooltipPortal copy; mobile: sheet info-icon button
     * tap + tooltip copy (`button.action-sheet-header-tooltip`).
     */
    test('VERIFY manual trade param info icons reveal authored descriptions', async ({
        tradeParametersPage,
    }, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');

        for (const {
            market,
            tradeType,
            desktopParams,
            mobileChecks,
        } of TradeParametersPage.TRADE_PARAM_INFO_ICON_CASES) {
            await test.step(`${tradeType} on ${market}`, async () => {
                await tradeParametersPage.selectMarketAndTradeType(market, tradeType, { verifyParams: false });

                if (isMobile) {
                    for (const { openField, icons } of mobileChecks ?? []) {
                        await test.step(openField, async () => {
                            await tradeParametersPage.verifyTradeParamInfoIconsInMobileEditor(openField, icons);
                        });
                    }
                    return;
                }

                for (const { label, descriptions } of desktopParams ?? []) {
                    await test.step(label, async () => {
                        await tradeParametersPage.verifyTradeParamInfoIconOnDesktop(label, descriptions);
                    });
                }
            });
        }
    });
});
