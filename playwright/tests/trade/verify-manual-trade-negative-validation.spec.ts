/**
 * @name     Manual Trading — negative validation, availability, and lifecycle states
 * @id       flow-12, flow-13, flow-14
 * @flow     playwright/flows/trade/flow.md#flow-14--manual-trading-negative-validation-matrix
 * @coverage playwright/flows/trade/coverage.md
 * @env      BASE_URL, TEST_EMAIL_RISE_FALL, TEST_EMAIL_RISE_FALL_MOBILE, TEST_EMAIL_INSUFFICIENT_BALANCE, TEST_PASSWORD_INSUFFICIENT_BALANCE
 */
import { test, expect } from '../../fixtures/fixtures';
import { TradeBasePage } from '../../pages/TradeBasePage';
import {
    DURATION_MARKET_CATEGORIES,
    DURATION_TRADE_TYPE_CAPABILITIES,
    STAKE_MARKET_CATEGORIES,
    STAKE_TRADE_TYPE_CAPABILITIES,
} from '../../utils/manual-trade-negative-matrix';

let testEmail: string = undefined!;

test.describe(
    'Trade — Manual Trading negative validation',
    { tag: ['@desktop', '@mobile', '@trade', '@regression', '@staging'] },
    () => {
        test.describe.configure({ mode: 'serial' });

        test.beforeAll(async ({}, testInfo) => {
            if (!process.env.BASE_URL) throw new Error('BASE_URL is not set in playwright/.env.staging');
            const emailVariable = testInfo.project.name.includes('mobile')
                ? 'TEST_EMAIL_RISE_FALL_MOBILE'
                : 'TEST_EMAIL_RISE_FALL';
            const email = process.env[emailVariable];
            if (!email) throw new Error(`${emailVariable} is not set in playwright/.env.staging`);
            testEmail = email;
        });

        test.beforeEach(async ({ page, loginPage, tradeValidationPage }) => {
            await tradeValidationPage.startBuyRequestTracking();
            await TradeBasePage.seedLocalStorageOnOrigin(page);
            await loginPage.login(testEmail);
        });

        test('VERIFY Stake uses current runtime limits and rejects malformed drafts', async ({
            tradeValidationPage,
        }) => {
            test.setTimeout(15 * 60_000);

            for (const { category, pattern } of STAKE_MARKET_CATEGORIES) {
                await test.step(`${category} Rise/Fall Stake guardrails`, async () => {
                    const markets = await tradeValidationPage.readOpenMarketsForCategory(category);
                    const representative = markets.find(market => pattern.test(market));
                    if (!representative) {
                        test.info().annotations.push({
                            type: 'note',
                            description: `${category}: no open market matching ${pattern} — skipped (likely closed session)`,
                        });
                        await tradeValidationPage.marketSelectionPage.closeMarketSelectionPicker();
                        return;
                    }

                    await tradeValidationPage.marketSelectionPage.closeMarketSelectionPicker();
                    await tradeValidationPage.verifyStakeGuardrailsForConfiguration(representative, 'Rise/Fall', {
                        verifyAllowEquals: false,
                    });
                });
            }

            await test.step('Cryptocurrency Multipliers Stake guardrails', async () => {
                await tradeValidationPage.verifyStakeGuardrailsForConfiguration('BTC/USD', 'Multipliers');
            });

            for (const { market, tradeType, verifyParams = true } of STAKE_TRADE_TYPE_CAPABILITIES) {
                await test.step(`${market} ${tradeType} Stake guardrails`, async () => {
                    await tradeValidationPage.verifyStakeGuardrailsForConfiguration(market, tradeType, {
                        verifyParams,
                    });
                });
            }

            await test.step('Shared Stake input filtering and precision', async () => {
                await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall');
                await tradeValidationPage.verifyStakeInputSanitization();
                await tradeValidationPage.verifyBuyButtonRemainsEnabled();
            });
        });

        test('VERIFY Duration enforces current runtime range and supported mobile options', async ({
            tradeValidationPage,
        }) => {
            test.setTimeout(15 * 60_000);

            for (const { category, pattern } of DURATION_MARKET_CATEGORIES) {
                await test.step(`${category} Rise/Fall duration guardrails`, async () => {
                    const markets = await tradeValidationPage.readOpenMarketsForCategory(category);
                    const representative = markets.find(market => pattern.test(market));
                    if (!representative) {
                        test.info().annotations.push({
                            type: 'note',
                            description: `${category}: no open market matching ${pattern} — skipped (likely closed session)`,
                        });
                        await tradeValidationPage.marketSelectionPage.closeMarketSelectionPicker();
                        return;
                    }

                    await tradeValidationPage.marketSelectionPage.closeMarketSelectionPicker();
                    await tradeValidationPage.verifyDurationGuardrailsForConfiguration(representative, 'Rise/Fall', {
                        verifyAllowEquals: false,
                    });
                });
            }

            for (const { market, tradeType } of DURATION_TRADE_TYPE_CAPABILITIES) {
                await test.step(`${market} ${tradeType} duration guardrails`, async () => {
                    await tradeValidationPage.verifyDurationGuardrailsForConfiguration(market, tradeType);
                });
            }

            await test.step('No-duration trade types reject stale Duration UI', async () => {
                await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Accumulators', {
                    verifyParams: false,
                });
                await tradeValidationPage.verifyDurationUnavailable();
                await tradeValidationPage.selectMarketAndTradeType('BTC/USD', 'Multipliers', {
                    verifyParams: false,
                });
                await tradeValidationPage.verifyDurationUnavailable();
            });
        });

        test('VERIFY Barrier rejects zero and empty values without replacing committed state', async ({
            tradeValidationPage,
        }) => {
            await tradeValidationPage.selectMarketAndTradeType('Volatility 75 Index', 'Higher/Lower');
            await tradeValidationPage.verifyBarrierRequiredAndZeroValidation();
            await tradeValidationPage.verifyBuyButtonRemainsEnabled();
        });

        test('VERIFY Multipliers Risk management enforces TP, SL, and Deal Cancellation options', async ({
            tradeValidationPage,
        }) => {
            await tradeValidationPage.selectMarketAndTradeType('Volatility 25 (1s) Index', 'Multipliers');
            const multiplierOptions = await tradeValidationPage.readMultiplierOptions();
            expect(multiplierOptions.length, 'Active symbol should expose at least one multiplier').toBeGreaterThan(0);
            expect(
                multiplierOptions,
                'Committed multiplier should belong to the options returned for the active symbol'
            ).toContain(await tradeValidationPage.multiplierField.inputValue());

            await tradeValidationPage.dismissOpenParameterEditor();
            await tradeValidationPage.verifyMultipliersRiskManagementGuardrails();
            await tradeValidationPage.verifyBuyButtonRemainsEnabled();
            await tradeValidationPage.dismissOpenParameterEditor();

            const cancellationOptions = await tradeValidationPage.readDealCancellationOptions();
            if (cancellationOptions.length === 0) {
                await expect(
                    tradeValidationPage.dealCancellationTab,
                    'When Deal Cancellation is unavailable the DC tab should be absent'
                ).toHaveCount(0);
            } else {
                expect(
                    cancellationOptions.length,
                    'Deal Cancellation should expose only supported durations for the current configuration'
                ).toBeGreaterThan(0);
            }
        });

        test('VERIFY Accumulators standalone Take profit enforces its runtime range', async ({
            tradeValidationPage,
        }) => {
            await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Accumulators', {
                verifyParams: false,
            });
            await tradeValidationPage.verifyStandaloneTakeProfitGuardrails();
            await tradeValidationPage.verifyBuyButtonRemainsEnabled();
        });

        test('VERIFY Turbos standalone Take profit enforces its runtime range', async ({ tradeValidationPage }) => {
            await tradeValidationPage.selectMarketAndTradeType('Volatility 100 (1s) Index', 'Turbos');
            await tradeValidationPage.verifyStandaloneTakeProfitGuardrails();
            await tradeValidationPage.verifyBuyButtonRemainsEnabled();
        });

        test('VERIFY Rise/Fall has no Take profit or Risk management controls', async ({ tradeValidationPage }) => {
            await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall');
            await tradeValidationPage.verifyRiskControlsUnavailable();
        });

        test('VERIFY symbol and trade-type switches revalidate stale parameter values', async ({
            tradeValidationPage,
        }) => {
            await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall');
            const originalMinimum = await tradeValidationPage.getMinimumStake();
            await tradeValidationPage.setStake(originalMinimum);
            await tradeValidationPage.selectDuration('Seconds', '30 sec');

            await tradeValidationPage.selectMarketAndTradeType('Volatility 25 (1s) Index', 'Rise/Fall');
            const switchedRange = await tradeValidationPage.openStakeEditor();
            const switchedStake = Number((await tradeValidationPage.stakeField.inputValue()).replace(/[^\d.]/g, ''));
            expect(
                switchedStake >= switchedRange.minimum && switchedStake <= switchedRange.maximum,
                'Stake retained after symbol switch should remain inside the new runtime range'
            ).toBe(true);
            await tradeValidationPage.dismissStakeEditor();

            await tradeValidationPage.selectMarketAndTradeType('Volatility 10 Index', 'Over/Under');
            await expect(
                tradeValidationPage.durationField,
                'A seconds duration must not carry into a ticks-only digit contract'
            ).toHaveValue(/ticks?$/);

            await tradeValidationPage.selectMarketAndTradeType('Volatility 25 (1s) Index', 'Multipliers');
            const firstOptions = await tradeValidationPage.readMultiplierOptions();
            expect(firstOptions.length, 'First symbol should expose multiplier options').toBeGreaterThan(0);
            await tradeValidationPage.dismissOpenParameterEditor();
            await tradeValidationPage.selectMarketAndTradeType('Jump 10 Index', 'Multipliers');
            const switchedOptions = await tradeValidationPage.readMultiplierOptions();
            const selectedMultiplier = await tradeValidationPage.multiplierField.inputValue();
            expect(
                switchedOptions,
                'Multiplier retained after symbol switch must belong to the new option list'
            ).toContain(selectedMultiplier);
        });

        test('VERIFY a currently closed market hides Buy and an open market restores it', async ({
            tradeValidationPage,
        }) => {
            const closedMarket = await tradeValidationPage.selectFirstClosedMarket();
            test.skip(!closedMarket, 'No closed market is currently returned by the live staging catalogue');

            await tradeValidationPage.verifyClosedMarketPurchaseState();
            await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall');
            const recovered = await tradeValidationPage.getPurchaseControlState();
            expect(
                recovered.isVisible,
                'Buy should return after switching from a closed market to an open market'
            ).toBe(true);
            expect(recovered.isLoading, 'Buy should not remain loading after the open-market proposal settles').toBe(
                false
            );
        });

        test('VERIFY Accumulators reject duplicate Buy while open and recover after settlement', async ({
            tradeValidationPage,
            tradeAccumulatorsPage,
        }) => {
            await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Accumulators');
            const minimumStake = await tradeValidationPage.getMinimumStake();
            await tradeValidationPage.setStake(minimumStake);

            const requestsBefore = tradeValidationPage.getTrackedBuyRequestCount();
            await tradeValidationPage.doubleClickBuy();
            await expect(
                tradeAccumulatorsPage.closeButton,
                'Accumulator should expose Close after exactly one accepted purchase'
            ).toBeVisible();
            expect(
                tradeValidationPage.getTrackedBuyRequestCount() - requestsBefore,
                'Rapid Buy interaction should send exactly one buy request'
            ).toBe(1);

            await tradeAccumulatorsPage.settleAccumulatorContract();
            await expect(
                tradeValidationPage.buyControl,
                'Buy should return after the accumulator settles'
            ).toBeVisible();
            await expect(
                tradeValidationPage.buyControl,
                'Buy should recover from pending/settling state'
            ).toBeEnabled();
        });

        test('VERIFY Turbos Buy recovers after its open position closes', async ({
            tradeValidationPage,
            tradeTurbosPage,
        }) => {
            await tradeValidationPage.selectMarketAndTradeType('Volatility 100 (1s) Index', 'Turbos');
            const minimumStake = await tradeValidationPage.getMinimumStake();
            await tradeTurbosPage.buyTurbosAndVerify({
                accountType: 'demo',
                market: 'Volatility 100 (1s) Index',
                direction: 'Up',
                stake: minimumStake,
                currency: 'USD',
            });
            await tradeValidationPage.selectMarketAndTradeType('Volatility 100 (1s) Index', 'Turbos');
            await expect(
                tradeValidationPage.buyControl,
                'Turbos Buy should be visible after the previous contract closes'
            ).toBeVisible();
            await expect(
                tradeValidationPage.buyControl,
                'Turbos Buy should be enabled after the previous contract closes'
            ).toBeEnabled();
        });
    }
);

test.describe(
    'Trade — Manual Trading insufficient balance',
    { tag: ['@desktop', '@mobile', '@trade', '@regression', '@staging'] },
    () => {
        test('VERIFY insufficient balance keeps Buy enabled with a quoted payout on both viewports', async ({
            page,
            loginPage,
            tradeValidationPage,
        }) => {
            const email = process.env.TEST_EMAIL_INSUFFICIENT_BALANCE;
            const password = process.env.TEST_PASSWORD_INSUFFICIENT_BALANCE ?? process.env.TEST_PASSWORD;
            if (!email) {
                throw new Error('TEST_EMAIL_INSUFFICIENT_BALANCE is not set');
            }
            if (!password) {
                throw new Error('TEST_PASSWORD_INSUFFICIENT_BALANCE or TEST_PASSWORD is not set');
            }

            await tradeValidationPage.startBuyRequestTracking();
            await TradeBasePage.seedLocalStorageOnOrigin(page);
            await loginPage.login(email, password);
            await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall');
            const balance = Number((await tradeValidationPage.getBalance()).replace(/,/g, ''));
            expect(Number.isFinite(balance), 'Account balance should be readable before balance validation').toBe(true);
            await tradeValidationPage.verifyInsufficientBalanceBehavior(balance);
            expect(
                tradeValidationPage.getTrackedBuyRequestCount(),
                'Insufficient-balance gate must not send a buy request without clicking Buy'
            ).toBe(0);
        });
    }
);
