import { configure, reaction } from 'mobx';

import { TActiveSymbolsResponse } from '@deriv/api';
import { CONTRACT_TYPES, dayjs, findSymbolForTradeType, TRADE_TYPES, WS } from '@deriv/shared';
import { mockStore } from '@deriv/stores';

import { TRADE_PANEL_TABS } from 'AppV2/Components/AutomationPanel/automation-config';
import { getStakePresets } from 'AppV2/Config/trade-parameter-presets';
import { OPEN_MARKETS_STORAGE_KEYS, TOpenMarket } from 'AppV2/Utils/open-markets-utils';
import { getDerivedDefaultStake, getStakeLadderValues } from 'AppV2/Utils/trade-params-utils';
import { TRootStore } from 'Types';

import { processPurchase as buyContract } from '../Actions/purchase';
import { ContractType } from '../Helpers/contract-type';
import TradeStore from '../trade-store';

configure({ safeDescriptors: false });

// Mock ServerTime
jest.mock('_common/base/server_time', () => {
    const actualDayjs = jest.requireActual('dayjs');
    return {
        get: () => actualDayjs('2024-02-26T11:59:59.488Z'),
        timePromise: () => Promise.resolve(actualDayjs('2024-02-26T11:59:59.488Z')),
    };
});

// Mock shared utilities
jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    pickDefaultSymbol: jest.fn(() => Promise.resolve('1HZ100V')),
    isMarketClosed: jest.fn(() => false),
    findSymbolForTradeType: jest.fn(() => Promise.resolve('')),
    WS: {
        authorized: {
            activeSymbols: () =>
                Promise.resolve({
                    active_symbols: [
                        {
                            symbol: '1HZ100V',
                            exchange_is_open: 1,
                            market: 'synthetic_index',
                            display_name: 'Volatility 100 (1s) Index',
                        },
                    ],
                }),
        },
        contractsFor: () =>
            Promise.resolve({
                contracts_for: {
                    available: [],
                    non_available: [],
                },
            }),
        storage: {
            contractsFor: () =>
                Promise.resolve({
                    contracts_for: {
                        available: [],
                        non_available: [],
                    },
                }),
        },
        subscribeProposal: jest.fn(),
        forgetAll: jest.fn(),
        wait: jest.fn(() => Promise.resolve({})),
    },
}));

// Mock ContractType helper
jest.mock('../Helpers/contract-type', () => ({
    ContractType: {
        buildContractTypesConfig: jest.fn(() => Promise.resolve()),
        getContractCategories: () => ({
            contract_types_list: {},
            non_available_contract_types_list: {},
        }),
        getContractValues: () => ({}),
    },
}));

// Mock ContractType Actions
jest.mock('../Actions/contract-type', () => ({
    ContractType: {
        getContractType: jest.fn(() => ({ categories: [], contract_types: [] })),
    },
}));

// Mock the buy request so processPurchase never hits the real WebSocket
jest.mock('../Actions/purchase', () => ({
    processPurchase: jest.fn(() => new Promise(() => {})), // never settles unless a test overrides it
}));

// Mock process helpers
jest.mock('../Helpers/process', () => ({
    processContractsForApi: jest.fn(() => Promise.resolve()),
    processPurchase: jest.fn(() => Promise.resolve()),
    processProposal: jest.fn(() => Promise.resolve()),
    processTradeParams: jest.fn(() => Promise.resolve()),
}));

describe('TradeStore', () => {
    let tradeStore: TradeStore, mockRootStore: TRootStore;

    beforeEach(() => {
        mockRootStore = mockStore({
            common: {
                server_time: dayjs('2024-02-26T11:59:59.488Z'),
                setServicesError: jest.fn(),
                setSelectedContractType: jest.fn(),
                showError: jest.fn(),
                is_language_changing: false,
            },
            client: {
                currency: 'USD',
                default_currency: 'USD',
                is_logged_in: false,
                is_logging_in: false,
                selectCurrency: jest.fn(),
            },
            ui: {
                advanced_expiry_type: 'duration',
                advanced_duration_unit: 'm',
                simple_duration_unit: 'm',
                is_mobile: false,
                is_advanced_duration: false,
                toggleUrlUnavailableModal: jest.fn(),
                openPositionsDrawer: jest.fn(),
                resetPurchaseStates: jest.fn(),
                toggleServicesErrorModal: jest.fn(),
            },
            active_symbols: {
                setActiveSymbols: jest.fn(),
            },
            notifications: {
                removeTradeNotifications: jest.fn(),
                setShouldShowPopups: jest.fn(),
                addTradeNotification: jest.fn(),
                is_notifications_visible: false,
                toggleNotificationsModal: jest.fn(),
            },
            contract_trade: {
                contracts: [],
                clearAccumulatorBarriersData: jest.fn(),
                addContract: jest.fn(),
                chart_type: 'mountain',
                granularity: 0,
                updateChartType: jest.fn(),
                updateGranularity: jest.fn(),
                savePreviousChartMode: jest.fn(),
                onUnmount: jest.fn(),
                updateAccumulatorBarriersData: jest.fn(),
            },
            portfolio: {
                barriers: [],
                setContractType: jest.fn(),
                onBuyResponse: jest.fn(),
                open_accu_contract: null,
                active_positions: [],
            },
            gtm: {
                pushDataLayer: jest.fn(),
            },
        }) as unknown as TRootStore;

        tradeStore = new TradeStore({ root_store: mockRootStore });
        // onProposalResponse drops any response whose contract type has no outstanding request —
        // the trade-type staleness guard. Tests inject responses directly rather than through
        // requestProposal, so every contract type the suite prices is registered as outstanding;
        // staleness-guard tests override this with a narrower map.
        tradeStore.proposal_requests = Object.fromEntries(
            [
                'CALL',
                'PUT',
                'CALLE',
                'PUTE',
                'VANILLALONGCALL',
                'VANILLALONGPUT',
                'TURBOSLONG',
                'TURBOSSHORT',
                'MULTUP',
                'MULTDOWN',
                'ACCU',
            ].map(type => [type, {}])
        ) as typeof tradeStore.proposal_requests;
    });

    describe('Initialization', () => {
        it('should initialize with correct default values', () => {
            expect(tradeStore.amount).toBe(2);
            expect(tradeStore.duration).toBe(5);
            expect(tradeStore.is_trade_component_mounted).toBe(false);
            expect(tradeStore.is_purchase_enabled).toBe(false);
            expect(tradeStore.is_trade_enabled).toBe(false);
            expect(tradeStore.currency).toBe('');
            expect(tradeStore.basis).toBe('');
            expect(tradeStore.contract_type).toBe('');
            expect(tradeStore.symbol).toBe('');
        });

        it('should have MobX observable properties', () => {
            // Test that properties are observable by changing them
            const originalAmount = tradeStore.amount;
            tradeStore.amount = 50;
            expect(tradeStore.amount).toBe(50);
            expect(tradeStore.amount).not.toBe(originalAmount);
        });
    });

    describe('Contract Type Identification', () => {
        it('should identify accumulator contracts', () => {
            tradeStore.contract_type = TRADE_TYPES.ACCUMULATOR;
            expect(tradeStore.is_accumulator).toBe(true);
            expect(tradeStore.is_multiplier).toBe(false);
            expect(tradeStore.is_vanilla).toBe(false);
            expect(tradeStore.is_turbos).toBe(false);
        });

        it('should identify multiplier contracts', () => {
            tradeStore.contract_type = TRADE_TYPES.MULTIPLIER;
            expect(tradeStore.is_multiplier).toBe(true);
            expect(tradeStore.is_accumulator).toBe(false);
            expect(tradeStore.is_vanilla).toBe(false);
            expect(tradeStore.is_turbos).toBe(false);
        });

        it('should identify vanilla contracts', () => {
            tradeStore.contract_type = 'vanillalongcall';
            expect(tradeStore.is_vanilla).toBe(true);
            expect(tradeStore.is_accumulator).toBe(false);
            expect(tradeStore.is_multiplier).toBe(false);
            expect(tradeStore.is_turbos).toBe(false);
        });

        it('should identify turbos contracts', () => {
            tradeStore.contract_type = 'turboslong';
            expect(tradeStore.is_turbos).toBe(true);
            expect(tradeStore.is_accumulator).toBe(false);
            expect(tradeStore.is_multiplier).toBe(false);
            expect(tradeStore.is_vanilla).toBe(false);
        });

        it('should identify crypto multiplier contracts', () => {
            tradeStore.contract_type = TRADE_TYPES.MULTIPLIER;
            tradeStore.symbol = 'cryBTCUSD';
            expect(tradeStore.is_crypto_multiplier).toBe(true);

            tradeStore.symbol = '1HZ100V';
            expect(tradeStore.is_crypto_multiplier).toBe(false);
        });
    });

    describe('Basic Setters', () => {
        describe('setDigitStats', () => {
            it('should set digit stats array', () => {
                const stats = [120, 86, 105, 94, 85, 86, 124, 107, 90, 103];
                tradeStore.setDigitStats(stats);
                expect(tradeStore.digit_stats).toEqual(stats);
            });

            it('should handle empty array', () => {
                tradeStore.setDigitStats([]);
                expect(tradeStore.digit_stats).toEqual([]);
            });
        });

        describe('setTickData', () => {
            it('should set tick data', () => {
                const tickData = {
                    ask: 405.76,
                    bid: 405.56,
                    epoch: 1721636565,
                    id: 'test-id',
                    pip_size: 2,
                    quote: 405.66,
                    symbol: '1HZ100V',
                };

                tradeStore.setTickData(tickData);
                expect(tradeStore.tick_data).toEqual(tickData);
            });

            it('should handle null tick data', () => {
                tradeStore.setTickData(null);
                expect(tradeStore.tick_data).toBeNull();
            });
        });

        describe('setActiveSymbolsV2', () => {
            it('should set active symbols for V2', () => {
                const symbols: NonNullable<TActiveSymbolsResponse['active_symbols']> = [
                    {
                        underlying_symbol: 'R_100',
                        display_order: 1,
                        exchange_is_open: 1,
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        is_trading_suspended: 0,
                        subgroup: 'volatility',
                    },
                ];

                tradeStore.setActiveSymbolsV2(symbols);
                expect(tradeStore.active_symbols).toEqual(symbols);
                expect(tradeStore.has_symbols_for_v2).toBe(true);
            });

            it('should set has_symbols_for_v2 to false for empty array', () => {
                tradeStore.setActiveSymbolsV2([]);
                expect(tradeStore.has_symbols_for_v2).toBe(false);
            });
        });

        describe('setTradeTypeTab', () => {
            it('should set trade type tab', () => {
                tradeStore.setTradeTypeTab('rise_fall');
                expect(tradeStore.trade_type_tab).toBe('rise_fall');
            });

            it('should handle undefined parameter', () => {
                tradeStore.setTradeTypeTab();
                expect(tradeStore.trade_type_tab).toBe('');
            });
        });

        describe('setDefaultStake', () => {
            it('should set default stake', () => {
                tradeStore.setDefaultStake(25);
                expect(tradeStore.default_stake).toBe(25);
            });

            it('should handle undefined stake', () => {
                tradeStore.setDefaultStake(undefined);
                expect(tradeStore.default_stake).toBeUndefined();
            });
        });
    });

    describe('V2 Parameters Management', () => {
        beforeEach(() => {
            tradeStore.clearV2ParamsInitialValues();
        });

        it('should set growth rate in v2_params_initial_values', () => {
            tradeStore.setV2ParamsInitialValues({ name: 'growth_rate', value: 0.03 });
            expect(tradeStore.v2_params_initial_values.growth_rate).toBe(0.03);
        });

        it('should set strike price in v2_params_initial_values', () => {
            tradeStore.setV2ParamsInitialValues({ name: 'strike', value: '+1.30' });
            expect(tradeStore.v2_params_initial_values.strike).toBe('+1.30');
        });

        it('should set multiplier in v2_params_initial_values', () => {
            tradeStore.setV2ParamsInitialValues({ name: 'multiplier', value: 100 });
            expect(tradeStore.v2_params_initial_values.multiplier).toBe(100);
        });

        it('should update existing values', () => {
            tradeStore.setV2ParamsInitialValues({ name: 'growth_rate', value: 0.03 });
            tradeStore.setV2ParamsInitialValues({ name: 'growth_rate', value: 0.05 });
            expect(tradeStore.v2_params_initial_values.growth_rate).toBe(0.05);
        });

        it('should clear all values', () => {
            tradeStore.setV2ParamsInitialValues({ name: 'strike', value: '+1.00' });
            tradeStore.setV2ParamsInitialValues({ name: 'growth_rate', value: 0.05 });

            expect(tradeStore.v2_params_initial_values).toEqual({
                strike: '+1.00',
                growth_rate: 0.05,
            });

            tradeStore.clearV2ParamsInitialValues();
            expect(tradeStore.v2_params_initial_values).toEqual({});
        });
    });

    describe('Store State Management', () => {
        describe('Purchase Management', () => {
            it('should enable purchase', () => {
                tradeStore.is_purchase_enabled = false;
                tradeStore.enablePurchase();
                expect(tradeStore.is_purchase_enabled).toBe(true);
            });

            it('should clear purchase info', () => {
                tradeStore.purchase_info = { contract_id: 123 };
                tradeStore.proposal_requests = { CALL: {} };
                tradeStore.proposal_info = { CALL: {} as any };

                tradeStore.clearPurchaseInfo();

                expect(tradeStore.purchase_info).toEqual({});
                expect(tradeStore.proposal_requests).toEqual({});
                expect(tradeStore.proposal_info).toEqual({});
            });
        });

        describe('Market Status', () => {
            it('should set market status', () => {
                tradeStore.setMarketStatus(true);
                expect(tradeStore.is_market_closed).toBe(true);

                tradeStore.setMarketStatus(false);
                expect(tradeStore.is_market_closed).toBe(false);
            });
        });

        describe('Trade Status', () => {
            it('should set trade status', () => {
                tradeStore.setTradeStatus(true);
                expect(tradeStore.is_trade_enabled).toBe(true);

                tradeStore.setTradeStatus(false);
                expect(tradeStore.is_trade_enabled).toBe(false);
            });
        });

        describe('Store Refresh', () => {
            it('should refresh store state', () => {
                // Set up some state
                tradeStore.proposal_info = { CALL: {} as any };
                tradeStore.purchase_info = { contract_id: 123 };
                tradeStore.proposal_requests = { CALL: {} };

                // Refresh should clear everything
                tradeStore.refresh();

                expect(tradeStore.proposal_info).toEqual({});
                expect(tradeStore.purchase_info).toEqual({});
                expect(tradeStore.proposal_requests).toEqual({});
            });
        });
    });

    describe('Purchase button recovery (is_purchase_pending lifecycle)', () => {
        // The Buy button's loading state reads is_purchase_pending. The recovery fix requires every
        // exit path — a valid dispatch, an errored/dropped proposal, a disabled store, a failed buy,
        // an unmounted component, or a symbol switch — to leave the flag in the right state so the
        // button can never get stranded spinning.
        const flushMicrotasks = async () => {
            await Promise.resolve();
            await Promise.resolve();
        };

        beforeEach(() => {
            (buyContract as jest.Mock).mockReset();
            (buyContract as jest.Mock).mockImplementation(() => new Promise(() => {}));
        });

        it('starts disabled with no pending purchase', () => {
            expect(tradeStore.is_purchase_pending).toBe(false);
        });

        describe('endPurchaseAttempt', () => {
            it('clears the pending flag', () => {
                tradeStore.is_purchase_pending = true;
                tradeStore.endPurchaseAttempt();
                expect(tradeStore.is_purchase_pending).toBe(false);
            });
        });

        describe('processPurchase', () => {
            it('ends the attempt without sending a buy when purchasing is disabled', () => {
                tradeStore.is_purchase_enabled = false;
                tradeStore.is_purchase_pending = true;

                tradeStore.processPurchase('proposal-1', 10, 'CALL', false, undefined, true);

                expect(tradeStore.is_purchase_pending).toBe(false);
                expect(buyContract).not.toHaveBeenCalled();
            });

            it('ends the attempt without sending a buy when there is no proposal id', () => {
                tradeStore.is_purchase_enabled = true;
                tradeStore.is_purchase_pending = true;

                tradeStore.processPurchase('', 10, 'CALL', false, undefined, true);

                expect(tradeStore.is_purchase_pending).toBe(false);
                expect(buyContract).not.toHaveBeenCalled();
            });

            it('recovers the button after a failed buy: re-enables purchasing and clears pending', async () => {
                tradeStore.is_trade_component_mounted = true;
                tradeStore.is_purchase_enabled = true;
                tradeStore.is_purchase_pending = true;
                (buyContract as jest.Mock).mockResolvedValueOnce({
                    msg_type: 'buy',
                    error: { code: 'InsufficientBalance', message: 'Insufficient balance' },
                });

                tradeStore.processPurchase('proposal-1', 10, 'CALL', false, undefined, true);
                await flushMicrotasks();

                expect(tradeStore.is_purchase_pending).toBe(false);
                expect(tradeStore.is_purchase_enabled).toBe(true);
                expect(tradeStore.is_purchasing_contract).toBe(false);
                expect(mockRootStore.common.setServicesError).toHaveBeenCalled();
            });

            it('keeps purchasing LOCKED after a ConnectionLost buy — the trade may have executed server-side', async () => {
                tradeStore.is_trade_component_mounted = true;
                tradeStore.is_purchase_enabled = true;
                tradeStore.is_purchase_pending = true;
                (buyContract as jest.Mock).mockResolvedValueOnce({
                    msg_type: 'buy',
                    echo_req: { buy: 'proposal-1', price: 10 },
                    error: {
                        code: 'ConnectionLost',
                        message: 'The connection was lost before a response was received.',
                    },
                });

                tradeStore.processPurchase('proposal-1', 10, 'CALL', false, undefined, true);
                await flushMicrotasks();

                // Spinner cleared, rest of the UI live…
                expect(tradeStore.is_purchase_pending).toBe(false);
                expect(tradeStore.is_purchasing_contract).toBe(false);
                // …but the purchase button stays locked until reconnect surfaces the truth —
                // an immediate retry could double-purchase.
                expect(tradeStore.is_purchase_enabled).toBe(false);
                expect(mockRootStore.common.setServicesError).toHaveBeenCalledWith(
                    expect.objectContaining({
                        code: 'ConnectionLost',
                        message: expect.stringContaining('check your positions'),
                    }),
                    expect.anything()
                );
            });

            it('clears pending when the trade component has unmounted before the response arrives', async () => {
                tradeStore.is_trade_component_mounted = false;
                tradeStore.is_purchase_enabled = true;
                tradeStore.is_purchase_pending = true;
                (buyContract as jest.Mock).mockResolvedValueOnce({ msg_type: 'buy', buy: { contract_id: 1 } });

                tradeStore.processPurchase('proposal-1', 10, 'CALL', false, undefined, true);
                await flushMicrotasks();

                expect(tradeStore.is_purchase_pending).toBe(false);
                expect(tradeStore.is_purchase_enabled).toBe(true);
                expect(tradeStore.is_purchasing_contract).toBe(false);
            });
        });

        describe('onPurchaseV2', () => {
            it('marks the attempt pending and dispatches the buy for a usable proposal', async () => {
                tradeStore.proposal_info = { CALL: { id: 'abc', stake: '10', has_error: false } as any };
                tradeStore.proposal_requests = { CALL: {} };
                const onPurchaseSpy = jest.spyOn(tradeStore, 'onPurchase').mockImplementation(() => undefined);

                await tradeStore.onPurchaseV2('CALL', false);

                // Pending stays set — the real buy is now in flight and will clear it on settle.
                expect(tradeStore.is_purchase_pending).toBe(true);
                expect(onPurchaseSpy).toHaveBeenCalledWith('abc', '10', 'CALL', false, undefined, true);

                onPurchaseSpy.mockRestore();
            });

            it('ends the attempt for an errored proposal that carries no id', async () => {
                tradeStore.proposal_info = { CALL: { has_error: true } as any };
                tradeStore.proposal_requests = { CALL: {} };
                const onPurchaseSpy = jest.spyOn(tradeStore, 'onPurchase').mockImplementation(() => undefined);

                await tradeStore.onPurchaseV2('CALL', false);

                expect(onPurchaseSpy).not.toHaveBeenCalled();
                expect(tradeStore.is_purchase_pending).toBe(false);

                onPurchaseSpy.mockRestore();
            });

            it('releases the button when the wait for a proposal times out, and reports it', async () => {
                // An empty proposal_info alongside a live request map is what the requestProposal early
                // returns leave behind, and the wait requires proposal_info to be populated — so
                // without a timeout the attempt never settles and the button spins forever.
                jest.useFakeTimers();
                tradeStore.proposal_info = {};
                tradeStore.proposal_requests = { CALL: {} };
                const onPurchaseSpy = jest.spyOn(tradeStore, 'onPurchase').mockImplementation(() => undefined);

                const attempt = tradeStore.onPurchaseV2('CALL', false);
                expect(tradeStore.is_purchase_pending).toBe(true);

                jest.advanceTimersByTime(10000);
                // Must resolve, not reject: the Buy button invokes this without awaiting, so a
                // rejection would surface as an unhandled promise rejection.
                await expect(attempt).resolves.toBeUndefined();

                expect(tradeStore.is_purchase_pending).toBe(false);
                expect(onPurchaseSpy).not.toHaveBeenCalled();
                expect(mockRootStore.common.setServicesError).toHaveBeenCalled();

                onPurchaseSpy.mockRestore();
                jest.useRealTimers();
            });
        });

        describe('requestProposal', () => {
            // Each early return has to drop the request map along with the prices, or a later attempt
            // compares an empty proposal_info against a stale request map and can never proceed.
            beforeEach(() => {
                tradeStore.proposal_requests = { CALL: {} };
                tradeStore.proposal_info = { CALL: {} as any };
            });

            it('clears the request map when the market is closed', () => {
                tradeStore.is_market_closed = true;

                tradeStore.requestProposal();

                expect(tradeStore.proposal_info).toEqual({});
                expect(tradeStore.proposal_requests).toEqual({});
            });

            it("clears the request map while awaiting the symbol's contracts_for", () => {
                tradeStore.is_market_closed = false;
                tradeStore.is_awaiting_contracts_for = true;

                tradeStore.requestProposal();

                expect(tradeStore.proposal_info).toEqual({});
                expect(tradeStore.proposal_requests).toEqual({});
            });

            it('clears the request map when a validation error blocks the request', () => {
                tradeStore.is_market_closed = false;
                tradeStore.is_awaiting_contracts_for = false;
                tradeStore.validation_errors = { duration: ['Invalid duration'] } as any;

                tradeStore.requestProposal();

                expect(tradeStore.proposal_info).toEqual({});
                expect(tradeStore.proposal_requests).toEqual({});
            });
        });

        describe('symbol switch', () => {
            it('invalidates a pending attempt still waiting on a proposal', () => {
                tradeStore.is_purchase_pending = true;

                tradeStore.updateStore({ symbol: 'R_100' });

                expect(tradeStore.is_purchase_pending).toBe(false);
            });
        });
    });

    describe('Barrier Management', () => {
        describe('setBarrierChoices', () => {
            it('should set barrier choices', () => {
                const barriers = ['+0.1', '+0.2', '+0.3', '-0.1', '-0.2'];
                tradeStore.setBarrierChoices(barriers);
                expect(tradeStore.barrier_choices).toEqual(barriers);
            });

            it('should handle empty array', () => {
                tradeStore.setBarrierChoices([]);
                expect(tradeStore.barrier_choices).toEqual([]);
            });

            it('should handle null/undefined', () => {
                tradeStore.setBarrierChoices(null as any);
                expect(tradeStore.barrier_choices).toEqual([]);
            });

            it('should set strike price choices for vanilla contracts', () => {
                tradeStore.contract_type = 'vanillalongcall';
                const barriers = ['+0.1', '+0.2', '+0.3'];
                tradeStore.barrier_1 = '+0.1';

                tradeStore.setBarrierChoices(barriers);

                expect(tradeStore.barrier_choices).toEqual(barriers);
                expect(tradeStore.strike_price_choices).toEqual({
                    barrier: '+0.1',
                    barrier_choices: barriers,
                });
            });
        });

        describe('setPayoutChoices', () => {
            it('should set payout choices for long turbos', () => {
                tradeStore.contract_type = 'turboslong';
                const payouts = ['1', '2', '3', '4'];
                tradeStore.barrier_1 = '+0.1';

                tradeStore.setPayoutChoices(payouts);

                expect(tradeStore.payout_choices).toEqual(payouts);
                expect(tradeStore.long_barriers).toEqual({
                    barrier: '+0.1',
                    payout_choices: payouts,
                });
            });

            it('should set payout choices for short turbos', () => {
                tradeStore.contract_type = 'turbosshort';
                const payouts = ['1', '2', '3', '4'];
                tradeStore.barrier_1 = '-0.1';

                tradeStore.setPayoutChoices(payouts);

                expect(tradeStore.payout_choices).toEqual(payouts);
                expect(tradeStore.short_barriers).toEqual({
                    barrier: '-0.1',
                    payout_choices: payouts,
                });
            });
        });

        describe('findClosestBarrierValue', () => {
            it('should find exact match', () => {
                const choices = ['+0.1', '+0.2', '+0.5', '+1.0'];
                const result = tradeStore.findClosestBarrierValue('+0.5', choices);
                expect(result).toBe('+0.5');
            });

            it('should find closest relative barrier', () => {
                const choices = ['+0.1', '+0.2', '+0.5', '+1.0'];
                const result = tradeStore.findClosestBarrierValue('+0.3', choices);
                expect(result).toBe('+0.2');
            });

            it('should handle empty choices', () => {
                const result = tradeStore.findClosestBarrierValue('+0.3', []);
                expect(result).toBe('+0.3');
            });

            it('should return current value if already in choices', () => {
                const choices = ['+0.1', '+0.2', '+0.5'];
                const result = tradeStore.findClosestBarrierValue('+0.2', choices);
                expect(result).toBe('+0.2');
            });
        });
    });

    describe('Accumulator Methods', () => {
        describe('setDefaultGrowthRate', () => {
            it('should set growth rate when accumulator and rate not in range', () => {
                tradeStore.contract_type = TRADE_TYPES.ACCUMULATOR;
                tradeStore.accumulator_range_list = [0.01, 0.02, 0.03, 0.04, 0.05];
                tradeStore.growth_rate = 0.1; // Not in range

                tradeStore.setDefaultGrowthRate();

                expect(tradeStore.growth_rate).toBe(0.01); // First in range
            });

            it('should not change growth rate if already in range', () => {
                tradeStore.contract_type = TRADE_TYPES.ACCUMULATOR;
                tradeStore.accumulator_range_list = [0.01, 0.02, 0.03, 0.04, 0.05];
                tradeStore.growth_rate = 0.03; // In range

                tradeStore.setDefaultGrowthRate();

                expect(tradeStore.growth_rate).toBe(0.03); // Unchanged
            });

            it('should not change growth rate for non-accumulator contracts', () => {
                tradeStore.contract_type = TRADE_TYPES.MULTIPLIER;
                tradeStore.accumulator_range_list = [0.01, 0.02, 0.03];
                tradeStore.growth_rate = 0.1;

                tradeStore.setDefaultGrowthRate();

                expect(tradeStore.growth_rate).toBe(0.1); // Unchanged
            });
        });

        describe('resetAccumulatorData', () => {
            it('should call clearAccumulatorBarriersData', () => {
                tradeStore.resetAccumulatorData();
                expect(mockRootStore.contract_trade.clearAccumulatorBarriersData).toHaveBeenCalledWith(false, true);
            });
        });
    });

    describe('Mobile and UI State', () => {
        describe('setMobileDigitView', () => {
            it('should set mobile digit view', () => {
                tradeStore.setMobileDigitView(true);
                expect(tradeStore.is_mobile_digit_view_selected).toBe(true);

                tradeStore.setMobileDigitView(false);
                expect(tradeStore.is_mobile_digit_view_selected).toBe(false);
            });
        });

        describe('setIsTradeParamsExpanded', () => {
            it('should set trade params expanded state', () => {
                tradeStore.setIsTradeParamsExpanded(false);
                expect(tradeStore.is_trade_params_expanded).toBe(false);

                tradeStore.setIsTradeParamsExpanded(true);
                expect(tradeStore.is_trade_params_expanded).toBe(true);
            });
        });

        describe('setIsDigitsWidgetActive', () => {
            it('should set digits widget active state', () => {
                tradeStore.setIsDigitsWidgetActive(true);
                expect(tradeStore.is_digits_widget_active).toBe(true);

                tradeStore.setIsDigitsWidgetActive(false);
                expect(tradeStore.is_digits_widget_active).toBe(false);
            });
        });

        describe('togglePayoutWheelPicker', () => {
            it('should toggle payout wheel picker', () => {
                expect(tradeStore.open_payout_wheelpicker).toBe(false);

                tradeStore.togglePayoutWheelPicker();
                expect(tradeStore.open_payout_wheelpicker).toBe(true);

                tradeStore.togglePayoutWheelPicker();
                expect(tradeStore.open_payout_wheelpicker).toBe(false);
            });
        });

        describe('setPayoutPerPoint', () => {
            it('should set payout per point', () => {
                tradeStore.setPayoutPerPoint('10');
                expect(tradeStore.payout_per_point).toBe('10');
            });

            it('should not update if value is same', () => {
                tradeStore.payout_per_point = '10';
                const spy = jest.spyOn(tradeStore, 'onChange');

                tradeStore.setPayoutPerPoint('10');
                expect(spy).not.toHaveBeenCalled();

                spy.mockRestore();
            });

            it('should call onChange when value changes', () => {
                tradeStore.payout_per_point = '5';
                const spy = jest.spyOn(tradeStore, 'onChange');

                tradeStore.setPayoutPerPoint('10');
                expect(spy).toHaveBeenCalledWith({
                    target: {
                        name: 'payout_per_point',
                        value: '10',
                    },
                });

                spy.mockRestore();
            });
        });
    });

    describe('Chart and Status Methods', () => {
        describe('setChartStatus', () => {
            it('should set chart loading status directly', () => {
                tradeStore.setChartStatus(true);
                expect(tradeStore.is_chart_loading).toBe(true);

                tradeStore.setChartStatus(false);
                expect(tradeStore.is_chart_loading).toBe(false);
            });

            it('should use debounced method when called from chart', () => {
                const spy = jest.spyOn(tradeStore, 'debouncedSetChartStatus');

                tradeStore.setChartStatus(true, true);
                expect(spy).toHaveBeenCalledWith(true);

                spy.mockRestore();
            });

            it('should call ui.setIsChartLoading immediately when isFromChart is falsy', () => {
                const setIsChartLoadingMock = jest.fn();
                tradeStore.root_store.ui.setIsChartLoading = setIsChartLoadingMock;

                tradeStore.setChartStatus(true);
                expect(setIsChartLoadingMock).toHaveBeenCalledWith(true);
            });

            it('should NOT call ui.setIsChartLoading immediately when isFromChart is true (debounced)', () => {
                const setIsChartLoadingMock = jest.fn();
                tradeStore.root_store.ui.setIsChartLoading = setIsChartLoadingMock;

                tradeStore.setChartStatus(true, true);
                expect(setIsChartLoadingMock).not.toHaveBeenCalled();
            });
        });

        describe('setSkipPrePostLifecycle', () => {
            it('should set skip lifecycle flag', () => {
                tradeStore.setSkipPrePostLifecycle(true);
                expect(tradeStore.should_skip_prepost_lifecycle).toBe(true);

                tradeStore.setSkipPrePostLifecycle(false);
                expect(tradeStore.should_skip_prepost_lifecycle).toBe(false);
            });

            it('should not update if value is same', () => {
                tradeStore.should_skip_prepost_lifecycle = true;
                tradeStore.setSkipPrePostLifecycle(true);
                expect(tradeStore.should_skip_prepost_lifecycle).toBe(true);
            });
        });

        describe('onUnmount', () => {
            it('should reset is_chart_loading and ui.is_chart_loading', () => {
                const setIsChartLoadingMock = jest.fn();
                tradeStore.root_store.ui.setIsChartLoading = setIsChartLoadingMock;

                tradeStore.is_chart_loading = true;
                tradeStore.onUnmount();

                expect(tradeStore.is_chart_loading).toBe(false);
                expect(setIsChartLoadingMock).toHaveBeenCalledWith(false);
            });
        });
    });

    describe('Symbol and Previous Symbol Management', () => {
        describe('is_symbol_in_active_symbols', () => {
            beforeEach(() => {
                tradeStore.active_symbols = [
                    {
                        underlying_symbol: 'R_100',
                        display_order: 1,
                        exchange_is_open: 1,
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        is_trading_suspended: 0,
                        subgroup: 'volatility',
                    },
                    {
                        underlying_symbol: '1HZ100V',
                        display_order: 2,
                        exchange_is_open: 1,
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        is_trading_suspended: 0,
                        subgroup: 'volatility',
                    },
                ] as NonNullable<TActiveSymbolsResponse['active_symbols']>;
            });

            it('should return true for existing symbol', () => {
                tradeStore.symbol = 'R_100';
                expect(tradeStore.is_symbol_in_active_symbols).toBe(true);
            });

            it('should return false for non-existing symbol', () => {
                tradeStore.symbol = 'NON_EXISTENT';
                expect(tradeStore.is_symbol_in_active_symbols).toBe(false);
            });

            it('should return false when exchange is closed', () => {
                tradeStore.active_symbols = [
                    {
                        underlying_symbol: 'R_100',
                        display_order: 1,
                        exchange_is_open: 0, // Closed
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        is_trading_suspended: 0,
                        subgroup: 'volatility',
                    },
                ] as NonNullable<TActiveSymbolsResponse['active_symbols']>;
                tradeStore.symbol = 'R_100';
                expect(tradeStore.is_symbol_in_active_symbols).toBe(false);
            });
        });
    });

    describe('Computed Properties', () => {
        describe('show_digits_stats', () => {
            it('should return true for digit trade types', () => {
                // Mock the isDigitTradeType function to return true
                const mockIsDigitTradeType = jest.fn(() => true);
                jest.doMock('AppV2/Utils/digits', () => ({
                    isDigitTradeType: mockIsDigitTradeType,
                }));

                tradeStore.contract_type = 'even_odd';
                expect(tradeStore.show_digits_stats).toBe(true);
            });
        });

        describe('is_dtrader_v2', () => {
            it('should always return true', () => {
                mockRootStore.ui.is_mobile = true;
                expect(tradeStore.is_dtrader_v2).toBe(true);
                mockRootStore.ui.is_mobile = false;
                expect(tradeStore.is_dtrader_v2).toBe(true);
            });
        });

        describe('is_synthetics_available', () => {
            it('should return true when synthetics market exists', () => {
                tradeStore.active_symbols = [
                    {
                        market: 'synthetic_index',
                        underlying_symbol: 'R_100',
                        display_order: 1,
                        exchange_is_open: 1,
                        submarket: 'random_index',
                        is_trading_suspended: 0,
                        subgroup: 'volatility',
                    },
                ] as NonNullable<TActiveSymbolsResponse['active_symbols']>;
                expect(tradeStore.is_synthetics_available).toBe(true);
            });

            it('should return false when no synthetics market', () => {
                tradeStore.active_symbols = [
                    {
                        market: 'forex',
                        underlying_symbol: 'EURUSD',
                        display_order: 1,
                        exchange_is_open: 1,
                        submarket: 'major_pairs',
                        is_trading_suspended: 0,
                        subgroup: 'none',
                    },
                ] as NonNullable<TActiveSymbolsResponse['active_symbols']>;
                expect(tradeStore.is_synthetics_available).toBe(false);
            });
        });
    });

    describe('resolveInitialMarket (single owner of initial symbol + trade-type selection)', () => {
        const setUrl = (query: string) => window.history.pushState({}, '', `/${query}`);
        // The resolver awaits a macrotask up-front (BaseStore's deferred sessionStorage restore) and
        // then a chain of when()/promise hops — flush several full timer rounds so every hop settles.
        const flushPromises = async () => {
            const { setTimeout: realSetTimeout } = jest.requireActual<typeof import('timers')>('timers');
            for (let i = 0; i < 10; i++) {
                // eslint-disable-next-line no-await-in-loop -- rounds must run sequentially by design
                await new Promise(resolve => realSetTimeout(resolve, 0));
            }
        };

        // URL params are read when the resolver starts (store construction) — each test sets the URL
        // and any session-restored state FIRST, then builds its own store.
        const buildStore = () => {
            const store = new TradeStore({ root_store: mockRootStore });
            // Force manual mode so the tab-record phase isn't skipped by automation state leaked
            // into localStorage ('active_trade_panel_tab') by earlier tests.
            store.active_trade_panel_tab = TRADE_PANEL_TABS.TRADE;
            store.is_automation_page = false;
            const onChangeSpy = jest.spyOn(store, 'onChange').mockResolvedValue(undefined);
            return { store, onChangeSpy };
        };
        const feedSymbols = (store: TradeStore, symbols: string[]) => {
            store.setActiveSymbolsV2(
                symbols.map(underlying_symbol => ({ underlying_symbol, exchange_is_open: 1 })) as NonNullable<
                    TActiveSymbolsResponse['active_symbols']
                >
            );
        };
        const rise_fall_list = {
            'Ups & Downs': {
                name: 'Ups & Downs',
                categories: [{ value: TRADE_TYPES.RISE_FALL, text: 'Rise/Fall' }],
            },
        } as TradeStore['contract_types_list_v2'];
        const multipliers_only_list = {
            Multipliers: {
                name: 'Multipliers',
                categories: [{ value: TRADE_TYPES.MULTIPLIER, text: 'Multipliers' }],
            },
        } as unknown as TradeStore['contract_types_list_v2'];

        afterEach(() => {
            window.history.pushState({}, '', '/');
            (findSymbolForTradeType as jest.Mock).mockResolvedValue('');
            // The resolver persists symbol/contract_type via the store's session sync; clear it so a
            // later test's fresh store doesn't restore leaked state via retrieveFromStorage.
            sessionStorage.clear();
            Object.values(OPEN_MARKETS_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        });

        it('keeps a valid URL symbol and applies a URL trade type the market offers', async () => {
            setUrl(`?symbol=1HZ100V&trade_type=${TRADE_TYPES.RISE_FALL}`);
            const { store, onChangeSpy } = buildStore();
            feedSymbols(store, ['1HZ100V', 'BOOM1000']);
            store.contract_types_list_v2 = rise_fall_list;

            await flushPromises();

            // Symbol was URL-seeded synchronously in the constructor and is valid — no symbol change.
            expect(store.symbol).toBe('1HZ100V');
            expect(onChangeSpy).not.toHaveBeenCalledWith({ target: { name: 'symbol', value: expect.anything() } });
            expect(onChangeSpy).toHaveBeenCalledWith({
                target: { name: 'contract_type', value: TRADE_TYPES.RISE_FALL },
            });
            expect(store.url_trade_type).toBe(TRADE_TYPES.RISE_FALL);
            expect(mockRootStore.ui.toggleUrlUnavailableModal).not.toHaveBeenCalled();
        });

        it('falls back to the default symbol when nothing valid is restored or in the URL', async () => {
            const { store, onChangeSpy } = buildStore();
            feedSymbols(store, ['1HZ100V']);

            await flushPromises();

            // pickDefaultSymbol (mocked → 1HZ100V) provides the fallback, committed via the pipeline.
            expect(onChangeSpy).toHaveBeenCalledWith({ target: { name: 'symbol', value: '1HZ100V' } });
        });

        it('shows the URL-unavailable modal for an invalid URL symbol and falls back to default', async () => {
            setUrl('?symbol=NOT_A_SYMBOL');
            const { store, onChangeSpy } = buildStore();
            feedSymbols(store, ['1HZ100V']);

            await flushPromises();

            expect(mockRootStore.ui.toggleUrlUnavailableModal).toHaveBeenCalledWith(true, 'symbol');
            expect(onChangeSpy).toHaveBeenCalledWith({ target: { name: 'symbol', value: '1HZ100V' } });
        });

        it('shows the URL-unavailable modal for an unknown/invalid trade type', async () => {
            setUrl('?trade_type=not_a_real_trade_type');
            const { store } = buildStore();
            feedSymbols(store, ['1HZ100V']);
            store.contract_types_list_v2 = rise_fall_list;

            await flushPromises();

            expect(mockRootStore.ui.toggleUrlUnavailableModal).toHaveBeenCalledWith(true, 'trade_type');
        });

        it('switches to a compatible symbol and applies the URL trade type once the new market offers it', async () => {
            // e.g. arriving from Deriv Home with trade_type=rise_fall while the last-used market was
            // Boom 1000 (Multipliers only). The URL trade type wins: switch to a market that offers it,
            // then apply the trade type once the new market's list has loaded.
            (findSymbolForTradeType as jest.Mock).mockResolvedValue('1HZ100V');
            setUrl(`?trade_type=${TRADE_TYPES.RISE_FALL}`);
            sessionStorage.setItem('trade_store', JSON.stringify({ symbol: 'BOOM1000' }));
            const { store, onChangeSpy } = buildStore();
            feedSymbols(store, ['BOOM1000', '1HZ100V']);
            // Current market (Boom 1000) offers only Multipliers.
            store.contract_types_list_v2 = multipliers_only_list;

            await flushPromises();

            // The symbol switch is requested and the URL landing recorded, but the trade type isn't
            // applied yet because the new market's list hasn't arrived.
            expect(findSymbolForTradeType).toHaveBeenCalledWith(store.active_symbols, TRADE_TYPES.RISE_FALL);
            expect(store.url_trade_type).toBe(TRADE_TYPES.RISE_FALL);
            expect(onChangeSpy).toHaveBeenCalledWith({ target: { name: 'symbol', value: '1HZ100V' } });
            expect(onChangeSpy).not.toHaveBeenCalledWith({
                target: { name: 'contract_type', value: TRADE_TYPES.RISE_FALL },
            });
            // The loader flag stays set while the switch is in progress so the page keeps its loader.
            expect(store.is_reconciling_url_trade_type).toBe(true);

            // Simulate useContractsFor loading the new market's list (which offers Rise/Fall).
            store.contract_types_list_v2 = rise_fall_list;

            await flushPromises();

            expect(onChangeSpy).toHaveBeenCalledWith({
                target: { name: 'contract_type', value: TRADE_TYPES.RISE_FALL },
            });
            expect(mockRootStore.ui.toggleUrlUnavailableModal).not.toHaveBeenCalled();
            // Reconciliation finished — the loader flag is cleared so the page renders.
            expect(store.is_reconciling_url_trade_type).toBe(false);
        });

        it('shows the URL-unavailable modal when no open market offers the requested trade type', async () => {
            (findSymbolForTradeType as jest.Mock).mockResolvedValue('');
            setUrl(`?trade_type=${TRADE_TYPES.MATCH_DIFF}`);
            sessionStorage.setItem('trade_store', JSON.stringify({ symbol: '1HZ100V' }));
            const { store } = buildStore();
            feedSymbols(store, ['1HZ100V']);
            store.contract_types_list_v2 = rise_fall_list;

            await flushPromises();

            expect(mockRootStore.ui.toggleUrlUnavailableModal).toHaveBeenCalledWith(true, 'trade_type');
        });

        it('fails fast to the modal when the compatible symbol is already current but its V2 list lacks the type', async () => {
            // The search (raw contracts_for) resolves to the current symbol, but its processed V2 list
            // doesn't expose the trade type (e.g. native-app/region filtering). No symbol change means
            // nothing will refetch, so we must not wait out the timeout — show the modal immediately.
            (findSymbolForTradeType as jest.Mock).mockResolvedValue('1HZ100V');
            setUrl(`?trade_type=${TRADE_TYPES.RISE_FALL}`);
            sessionStorage.setItem('trade_store', JSON.stringify({ symbol: '1HZ100V' }));
            const { store, onChangeSpy } = buildStore();
            feedSymbols(store, ['1HZ100V']);
            store.contract_types_list_v2 = multipliers_only_list;

            await flushPromises();

            expect(mockRootStore.ui.toggleUrlUnavailableModal).toHaveBeenCalledWith(true, 'trade_type');
            expect(onChangeSpy).not.toHaveBeenCalled();
            // The loader flag is released rather than left blocking the page for the full timeout.
            expect(store.is_reconciling_url_trade_type).toBe(false);
        });

        it('records the resolved pair as the ONE initial tab (matched by category, never duplicated)', async () => {
            sessionStorage.setItem('trade_store', JSON.stringify({ symbol: '1HZ100V', contract_type: 'rise_fall' }));
            const { store } = buildStore();
            // With onChange spied, the restored pair stays as-is; the resolver must still record it.
            feedSymbols(store, ['1HZ100V']);

            await flushPromises();

            expect(store.open_markets).toEqual([{ symbol: '1HZ100V', contract_type: 'rise_fall' }]);
        });

        it('on a RESTORE, converges to the strip instead of materialising a never-committed pair', async () => {
            // Browser-restart field bug: the session/URL held a pair with no matching tab (hybrid
            // mirrors / half-loaded actives / default pick). A restore must never mint a tab — it
            // converges to the strip's most recent tab, the durable record of explicit intent.
            localStorage.setItem(
                OPEN_MARKETS_STORAGE_KEYS.manual,
                JSON.stringify([
                    { symbol: '1HZ100V', contract_type: 'rise_fall' },
                    { symbol: 'RDBULL', contract_type: 'match_diff' },
                    { symbol: 'WLDAUD', contract_type: 'multiplier' },
                ])
            );
            sessionStorage.setItem('trade_store', JSON.stringify({ symbol: 'RDBULL', contract_type: 'rise_fall' }));
            // Self-stamped URL (equals the session pair) → a restore, NOT a deep link.
            setUrl('?symbol=RDBULL&trade_type=rise_fall');
            const { store } = buildStore();
            const selectSpy = jest.spyOn(store, 'selectMarketAndTradeType').mockResolvedValue(undefined);
            feedSymbols(store, ['1HZ100V', 'RDBULL', 'WLDAUD']);

            await flushPromises();

            expect(selectSpy).toHaveBeenCalledWith('WLDAUD', 'multiplier');
            expect(store.open_markets).toHaveLength(3); // nothing minted
            expect(mockRootStore.ui.toggleUrlUnavailableModal).not.toHaveBeenCalled();
        });

        it('on a RESTORE with a half-loaded actives list, prefers an open-tab symbol and shows no modal', async () => {
            // e.g. the first active_symbols response after a browser restart is the pre-auth list
            // and lacks the restored symbol. That is not user error (no modal), and the fallback
            // must come from the user's own tabs — not pickDefaultSymbol (which can dredge up chart
            // favourites the user never traded).
            localStorage.setItem(
                OPEN_MARKETS_STORAGE_KEYS.manual,
                JSON.stringify([{ symbol: 'RDBULL', contract_type: 'match_diff' }])
            );
            sessionStorage.setItem('trade_store', JSON.stringify({ symbol: 'WLDAUD', contract_type: 'rise_fall' }));
            setUrl('?symbol=WLDAUD&trade_type=rise_fall');
            const { store, onChangeSpy } = buildStore();
            const selectSpy = jest.spyOn(store, 'selectMarketAndTradeType').mockResolvedValue(undefined);
            feedSymbols(store, ['RDBULL']); // WLDAUD missing from the half-loaded list

            await flushPromises();

            expect(mockRootStore.ui.toggleUrlUnavailableModal).not.toHaveBeenCalled();
            // Fallback = strip symbol, NOT the mocked pickDefaultSymbol ('1HZ100V').
            expect(onChangeSpy).toHaveBeenCalledWith({ target: { name: 'symbol', value: 'RDBULL' } });
            expect(onChangeSpy).not.toHaveBeenCalledWith({ target: { name: 'symbol', value: '1HZ100V' } });
            expect(selectSpy).toHaveBeenCalledWith('RDBULL', 'match_diff'); // converged, nothing minted
            expect(store.open_markets).toHaveLength(1);
        });

        it('a genuine DEEP LINK (URL ≠ session) still opens its own tab with a populated strip', async () => {
            localStorage.setItem(
                OPEN_MARKETS_STORAGE_KEYS.manual,
                JSON.stringify([{ symbol: '1HZ100V', contract_type: 'multiplier' }])
            );
            sessionStorage.setItem('trade_store', JSON.stringify({ symbol: '1HZ100V', contract_type: 'multiplier' }));
            setUrl('?symbol=RDBULL&trade_type=rise_fall'); // differs from session → external intent
            const { store, onChangeSpy } = buildStore();
            // Apply field writes so the resolver's committed pair is observable in phase 3.
            onChangeSpy.mockImplementation(async ({ target }) => {
                (store as unknown as Record<string, unknown>)[target.name as string] = target.value;
            });
            feedSymbols(store, ['1HZ100V', 'RDBULL']);
            store.contract_types_list_v2 = rise_fall_list;

            await flushPromises();

            expect(store.open_markets).toEqual([
                { symbol: '1HZ100V', contract_type: 'multiplier' },
                { symbol: 'RDBULL', contract_type: 'rise_fall' },
            ]);
            expect(mockRootStore.ui.toggleUrlUnavailableModal).not.toHaveBeenCalled();
        });

        it('does not duplicate a category-sibling tab at init (restored strip has rise_fall_equal)', async () => {
            localStorage.setItem(
                OPEN_MARKETS_STORAGE_KEYS.manual,
                JSON.stringify([{ symbol: '1HZ100V', contract_type: 'rise_fall_equal' }])
            );
            sessionStorage.setItem('trade_store', JSON.stringify({ symbol: '1HZ100V', contract_type: 'rise_fall' }));
            const { store } = buildStore();
            feedSymbols(store, ['1HZ100V']);

            await flushPromises();

            expect(store.open_markets).toEqual([{ symbol: '1HZ100V', contract_type: 'rise_fall_equal' }]);
        });

        it('clearUrlTradeType consumes the signal', () => {
            tradeStore.url_trade_type = TRADE_TYPES.RISE_FALL;
            tradeStore.clearUrlTradeType();
            expect(tradeStore.url_trade_type).toBeNull();
        });
    });

    describe('atomic trade URL sync (hybrid-URL phantom regression)', () => {
        beforeEach(() => {
            (tradeStore.root_store.ui as unknown as { is_mobile: boolean }).is_mobile = false;
            tradeStore.is_automation_page = false;
            tradeStore.active_trade_panel_tab = TRADE_PANEL_TABS.TRADE;
            jest.spyOn(tradeStore, 'validateAllProperties').mockImplementation(() => undefined);
            tradeStore.symbol = '1HZ100V';
            tradeStore.contract_type = 'rise_fall';
            window.history.pushState({}, '', '/?symbol=1HZ100V&trade_type=rise_fall');
        });

        afterEach(() => {
            window.history.pushState({}, '', '/');
            Object.values(OPEN_MARKETS_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
            localStorage.removeItem('active_trade_panel_tab');
        });

        it('stamps BOTH url params together only after the commit fully settles', async () => {
            await tradeStore.selectMarketAndTradeType('R_50', 'multiplier');
            const params = new URLSearchParams(window.location.search);
            expect(params.get('symbol')).toBe('R_50');
            expect(params.get('trade_type')).toBe('multiplier');
        });

        it('leaves the URL untouched when the commit dies mid-cascade (no hybrid URL)', async () => {
            // Reproduces the field bug: a commit whose symbol write landed but whose cascade then
            // failed (dead socket after machine wake). The old per-field reactions left the URL as
            // {new symbol, old trade type} — which resolveInitialMarket would resurrect on the next
            // refresh as a phantom pair + tab. The URL must keep the LAST COMMITTED pair instead.
            const { processTradeParams } = jest.requireMock('../Helpers/process');
            (processTradeParams as jest.Mock).mockRejectedValueOnce(new Error('socket dropped'));

            await expect(tradeStore.selectMarketAndTradeType('R_50', 'multiplier')).rejects.toThrow('socket dropped');

            const params = new URLSearchParams(window.location.search);
            expect(params.get('symbol')).toBe('1HZ100V');
            expect(params.get('trade_type')).toBe('rise_fall');
        });
    });

    describe('setTradeSubType (fenced same-category sub-toggle writer)', () => {
        beforeEach(() => {
            jest.spyOn(tradeStore, 'validateAllProperties').mockImplementation(() => undefined);
        });

        it('commits a same-category sub-type through the pipeline', async () => {
            tradeStore.contract_type = TRADE_TYPES.TURBOS.LONG;
            await tradeStore.setTradeSubType(TRADE_TYPES.TURBOS.SHORT);
            expect(tradeStore.contract_type).toBe(TRADE_TYPES.TURBOS.SHORT);
        });

        it('REJECTS a cross-category switch (tab identity may only change via selectMarketAndTradeType)', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            tradeStore.contract_type = TRADE_TYPES.TURBOS.LONG;
            await tradeStore.setTradeSubType(TRADE_TYPES.ACCUMULATOR);
            expect(tradeStore.contract_type).toBe(TRADE_TYPES.TURBOS.LONG);
            consoleSpy.mockRestore();
        });

        it('flips rise_fall ↔ rise_fall_equal when is_equal changes (Allow equals, pipeline step — no reaction)', async () => {
            tradeStore.contract_type = TRADE_TYPES.RISE_FALL;
            await tradeStore.onChange({ target: { name: 'is_equal', value: 1 } });
            expect(tradeStore.contract_type).toBe(TRADE_TYPES.RISE_FALL_EQUAL);
            await tradeStore.onChange({ target: { name: 'is_equal', value: 0 } });
            expect(tradeStore.contract_type).toBe(TRADE_TYPES.RISE_FALL);
        });

        it('does not touch the trade type when is_equal changes outside the Rise/Fall family', async () => {
            tradeStore.contract_type = TRADE_TYPES.ACCUMULATOR;
            await tradeStore.onChange({ target: { name: 'is_equal', value: 1 } });
            expect(tradeStore.contract_type).toBe(TRADE_TYPES.ACCUMULATOR);
        });

        it('preserves a user-set stake when Allow equals is toggled on (rise_fall → rise_fall_equal)', async () => {
            tradeStore.default_stake = 10;
            tradeStore.contract_type = TRADE_TYPES.RISE_FALL;
            tradeStore.amount = 50; // user-customised, different from default_stake

            await tradeStore.onChange({ target: { name: 'is_equal', value: 1 } });

            expect(tradeStore.contract_type).toBe(TRADE_TYPES.RISE_FALL_EQUAL);
            expect(tradeStore.amount).toBe(50);
        });

        it('preserves the stake across an Allow equals on→off toggle and returns to rise_fall', async () => {
            tradeStore.default_stake = 10;
            tradeStore.contract_type = TRADE_TYPES.RISE_FALL;
            tradeStore.amount = 50;

            await tradeStore.onChange({ target: { name: 'is_equal', value: 1 } });
            await tradeStore.onChange({ target: { name: 'is_equal', value: 0 } });

            expect(tradeStore.contract_type).toBe(TRADE_TYPES.RISE_FALL);
            expect(tradeStore.amount).toBe(50);
        });

        it('still resets the stake to default_stake on a genuine trade-type switch (different group)', async () => {
            tradeStore.default_stake = 10;
            tradeStore.contract_type = TRADE_TYPES.RISE_FALL;
            tradeStore.amount = 50;

            await tradeStore.onChange({ target: { name: 'contract_type', value: TRADE_TYPES.MATCH_DIFF } });

            expect(tradeStore.contract_type).toBe(TRADE_TYPES.MATCH_DIFF);
            expect(tradeStore.amount).toBe(10);
        });
    });

    describe('processContractsForV2 duration reconciliation', () => {
        // State right after a new symbol's contracts_for is applied, with a duration
        // retained from the previous symbol that is out of range for the new one.
        const setStaleDurationState = (duration: number, duration_unit: string) => {
            tradeStore.contract_type = TRADE_TYPES.RISE_FALL;
            tradeStore.duration = duration;
            tradeStore.duration_unit = duration_unit;
            tradeStore.duration_min_max = {
                intraday: { min: 900, max: 86400 }, // 15 minutes to 1 day
                daily: { min: 86400, max: 8640000 },
            };
            tradeStore.duration_units_list = [
                { value: 'm', text: 'Minutes' },
                { value: 'h', text: 'Hours' },
                { value: 'd', text: 'Days' },
            ];
        };

        it('resets a retained duration that is out of range for the new symbol to the smallest supported one', async () => {
            setStaleDurationState(2, 'm'); // 2 minutes < intraday minimum of 15 minutes

            await tradeStore.processContractsForV2();

            expect(tradeStore.duration).toBe(15);
            expect(tradeStore.duration_unit).toBe('m');
            expect(tradeStore.expiry_type).toBe('duration');
        });

        it('applies the configured per-trade-type default when the symbol supports it', async () => {
            tradeStore.contract_type = TRADE_TYPES.RISE_FALL; // configured default: 5 ticks
            tradeStore.duration = 2;
            tradeStore.duration_unit = 'm'; // 2 min < 15 min intraday minimum -> invalid
            tradeStore.duration_min_max = {
                tick: { min: 1, max: 10 },
                intraday: { min: 900, max: 86400 },
            };
            tradeStore.duration_units_list = [
                { value: 't', text: 'Ticks' },
                { value: 'm', text: 'Minutes' },
            ];

            await tradeStore.processContractsForV2();

            expect(tradeStore.duration).toBe(5);
            expect(tradeStore.duration_unit).toBe('t');
        });

        it('applies the configured default on first activation even when the retained duration is valid', async () => {
            tradeStore.contract_type = TRADE_TYPES.RISE_FALL; // configured default: 5 ticks
            tradeStore.duration = 8; // valid tick duration, but not the configured default
            tradeStore.duration_unit = 't';
            tradeStore.duration_min_max = { tick: { min: 1, max: 10 }, intraday: { min: 900, max: 86400 } };
            tradeStore.duration_units_list = [
                { value: 't', text: 'Ticks' },
                { value: 'm', text: 'Minutes' },
            ];
            // duration_default_applied_for starts '' -> this is the first time the type is active.

            await tradeStore.processContractsForV2();

            expect(tradeStore.duration).toBe(5);
            expect(tradeStore.duration_unit).toBe('t');
            expect(tradeStore.duration_default_applied_for).toBe(TRADE_TYPES.RISE_FALL);
        });

        it('leaves a valid manual duration unchanged on a later symbol change for the same type', async () => {
            tradeStore.contract_type = TRADE_TYPES.RISE_FALL;
            tradeStore.duration = 8; // manually chosen, valid for the tick range
            tradeStore.duration_unit = 't';
            tradeStore.duration_min_max = { tick: { min: 1, max: 10 } };
            tradeStore.duration_units_list = [{ value: 't', text: 'Ticks' }];
            // The default was already applied for this type on an earlier run.
            tradeStore.duration_default_applied_for = TRADE_TYPES.RISE_FALL;

            await tradeStore.processContractsForV2();

            expect(tradeStore.duration).toBe(8);
            expect(tradeStore.duration_unit).toBe('t');
        });

        it('leaves a retained duration unchanged when it is valid for the new symbol', async () => {
            setStaleDurationState(30, 'm'); // 30 minutes is within [15 minutes, 1 day]
            // Default already applied for this type -> a valid retained value is preserved.
            tradeStore.duration_default_applied_for = TRADE_TYPES.RISE_FALL;

            await tradeStore.processContractsForV2();

            expect(tradeStore.duration).toBe(30);
            expect(tradeStore.duration_unit).toBe('m');
        });

        it('does not reconcile the duration before a contract type is set', async () => {
            setStaleDurationState(2, 'm');
            tradeStore.contract_type = '';

            await tradeStore.processContractsForV2();

            expect(tradeStore.duration).toBe(2);
            expect(tradeStore.duration_unit).toBe('m');
        });

        it('releases the proposal hold once contract values are applied', async () => {
            setStaleDurationState(2, 'm');
            expect(tradeStore.is_awaiting_contracts_for).toBe(true);

            await tradeStore.processContractsForV2();

            expect(tradeStore.is_awaiting_contracts_for).toBe(false);
        });

        it('re-validates the corrected duration so a stale validation error cannot block the proposal', async () => {
            setStaleDurationState(2, 'm');
            tradeStore.contract_expiry_type = 'intraday';
            tradeStore.form_components = ['duration', 'amount'];
            tradeStore.validation_rules = {
                duration: { rules: [['number', { min: 15, max: 1440 }]] },
            } as unknown as typeof tradeStore.validation_rules;
            // The shared Validator isn't initialised in this unit context — spy instead.
            const validate_spy = jest.spyOn(tradeStore, 'validateProperty').mockImplementation(() => undefined);

            await tradeStore.processContractsForV2();

            expect(tradeStore.duration).toBe(15);
            expect(validate_spy).toHaveBeenCalledWith('duration', 15);
        });
    });

    describe('applyDefaultDuration', () => {
        it('applies the configured default for the current type and records its group', async () => {
            tradeStore.contract_type = TRADE_TYPES.HIGH_LOW; // configured default: 10 ticks
            tradeStore.duration_min_max = { tick: { min: 1, max: 10 } };
            tradeStore.duration_units_list = [{ value: 't', text: 'Ticks' }];
            const on_change_multiple_spy = jest
                .spyOn(tradeStore, 'onChangeMultiple')
                .mockResolvedValue(undefined as never);

            await tradeStore.applyDefaultDuration();

            expect(on_change_multiple_spy).toHaveBeenCalledWith({
                duration_unit: 't',
                duration: 10,
                expiry_time: null,
                expiry_type: 'duration',
            });
            // Tracked by trade-type group key, not the raw contract type.
            expect(tradeStore.duration_default_applied_for).toBe('higher_lower');
        });

        it('records the shared group for Up/Down turbos sub-types', async () => {
            tradeStore.contract_type = TRADE_TYPES.TURBOS.SHORT; // configured default: 10 ticks
            tradeStore.duration_min_max = { tick: { min: 5, max: 10 } };
            tradeStore.duration_units_list = [{ value: 't', text: 'Ticks' }];
            jest.spyOn(tradeStore, 'onChangeMultiple').mockResolvedValue(undefined as never);

            await tradeStore.applyDefaultDuration();

            expect(tradeStore.duration_default_applied_for).toBe('turbos');
        });

        it('does nothing when no contract type is set', async () => {
            tradeStore.contract_type = '';
            const on_change_multiple_spy = jest
                .spyOn(tradeStore, 'onChangeMultiple')
                .mockResolvedValue(undefined as never);

            await tradeStore.applyDefaultDuration();

            expect(on_change_multiple_spy).not.toHaveBeenCalled();
            expect(tradeStore.duration_default_applied_for).toBe('');
        });
    });

    describe('onChange trade-type switch applies the default duration', () => {
        beforeEach(() => {
            // Isolate the switch logic: let processNewValuesAsync just commit the incoming value.
            jest.spyOn(tradeStore, 'processNewValuesAsync').mockImplementation(async values => {
                Object.assign(tradeStore, values);
            });
            jest.spyOn(tradeStore, 'validateAllProperties').mockImplementation(() => undefined);
        });

        it('applies the default when switching to a different trade-type group', async () => {
            tradeStore.contract_type = TRADE_TYPES.RISE_FALL;
            const apply_spy = jest.spyOn(tradeStore, 'applyDefaultDuration').mockResolvedValue(undefined);

            await tradeStore.onChange({ target: { name: 'contract_type', value: TRADE_TYPES.HIGH_LOW } });

            expect(apply_spy).toHaveBeenCalled();
        });

        it('does not re-apply the default on an Up/Down sub-toggle within the same group', async () => {
            tradeStore.contract_type = TRADE_TYPES.TURBOS.LONG;
            const apply_spy = jest.spyOn(tradeStore, 'applyDefaultDuration').mockResolvedValue(undefined);

            await tradeStore.onChange({ target: { name: 'contract_type', value: TRADE_TYPES.TURBOS.SHORT } });

            expect(apply_spy).not.toHaveBeenCalled();
        });
    });

    describe('proposal hold until contracts_for is applied', () => {
        const subscribe_mock = WS.subscribeProposal as jest.Mock;

        const setProposalReadyState = () => {
            tradeStore.symbol = 'frxXAUUSD';
            tradeStore.currency = 'USD';
            tradeStore.trade_types = { CALL: 'Higher' } as unknown as typeof tradeStore.trade_types;
        };

        beforeEach(() => {
            subscribe_mock.mockClear();
        });

        it('does not send proposals while awaiting contracts_for values for the symbol', () => {
            setProposalReadyState();

            tradeStore.requestProposal();

            expect(subscribe_mock).not.toHaveBeenCalled();
        });

        it('sends proposals once processContractsForV2 has applied the contract values', async () => {
            setProposalReadyState();
            await tradeStore.processContractsForV2();

            tradeStore.requestProposal();

            expect(subscribe_mock).toHaveBeenCalled();
        });

        it('re-arms the hold when the symbol changes', async () => {
            setProposalReadyState();
            await tradeStore.processContractsForV2();
            expect(tradeStore.is_awaiting_contracts_for).toBe(false);

            tradeStore.updateStore({ symbol: '1HZ100V' } as Partial<TradeStore>);

            expect(tradeStore.is_awaiting_contracts_for).toBe(true);
            tradeStore.requestProposal();
            expect(subscribe_mock).not.toHaveBeenCalled();
        });

        it('re-arms the hold when the symbol is assigned directly, bypassing updateStore', async () => {
            // The URL when-block and loadActiveSymbols assign this.symbol directly —
            // the symbol reaction must re-arm or a stale-config proposal goes out.
            setProposalReadyState();
            await tradeStore.processContractsForV2();
            expect(tradeStore.is_awaiting_contracts_for).toBe(false);

            tradeStore.symbol = '1HZ100V';

            expect(tradeStore.is_awaiting_contracts_for).toBe(true);
            tradeStore.requestProposal();
            expect(subscribe_mock).not.toHaveBeenCalled();
        });

        it('setIsAwaitingContractsFor(false) releases the hold when contracts_for fails', () => {
            // Called by useContractsFor on failure so errors surface instead of a dead page.
            setProposalReadyState();
            tradeStore.setIsAwaitingContractsFor(false);

            tradeStore.requestProposal();

            expect(subscribe_mock).toHaveBeenCalled();
        });

        it('keeps holding when the symbol changes mid-processContractsForV2', async () => {
            setProposalReadyState();
            const values_spy = jest.spyOn(ContractType, 'getContractValues').mockImplementation(() => {
                // Simulate the user switching symbols while the old symbol's run is in flight.
                tradeStore.symbol = '1HZ100V';
                return {};
            });

            await tradeStore.processContractsForV2();

            expect(tradeStore.is_awaiting_contracts_for).toBe(true);
            tradeStore.requestProposal();
            expect(subscribe_mock).not.toHaveBeenCalled();
            values_spy.mockRestore();
        });
    });

    describe('stake minimum reconciliation', () => {
        // min/max stake are absent from contracts_for and arrive only on a proposal, so the first
        // proposal for a (symbol, contract type) is what reveals a minimum above the default stake.
        const setVanillasState = (symbol = '1HZ25V', contract_type: string = TRADE_TYPES.VANILLA.CALL) => {
            tradeStore.symbol = symbol;
            tradeStore.currency = 'USD';
            tradeStore.contract_type = contract_type;
            tradeStore.trade_types = { VANILLALONGCALL: 'Call' } as unknown as typeof tradeStore.trade_types;
            tradeStore.default_stake = 2;
            tradeStore.amount = 2;
        };

        type TResponseOverrides = {
            contract_type?: string;
            underlying_symbol?: string;
            amount?: number;
            min_stake?: number;
            max_stake?: number;
            details?: { field: string; min_stake?: number; max_stake?: number };
        };

        const stakeErrorResponse = ({
            contract_type = CONTRACT_TYPES.VANILLA.CALL,
            underlying_symbol = '1HZ25V',
            amount = 2,
            details = { field: 'amount', min_stake: 9, max_stake: 5000 },
        }: TResponseOverrides = {}) =>
            ({
                echo_req: { contract_type, underlying_symbol, amount },
                error: {
                    code: 'ContractCreationFailure',
                    message: 'Invalid stake.',
                    details,
                },
            }) as unknown as Parameters<typeof tradeStore.onProposalResponse>[0];

        const successResponse = ({
            contract_type = CONTRACT_TYPES.VANILLA.CALL,
            underlying_symbol = '1HZ25V',
            amount = 2,
            min_stake = 1,
            max_stake = 5000,
        }: TResponseOverrides = {}) =>
            ({
                echo_req: { contract_type, underlying_symbol, amount },
                proposal: { id: 'proposal-id', ask_price: amount, payout: 0, min_stake, max_stake },
            }) as unknown as Parameters<typeof tradeStore.onProposalResponse>[0];

        beforeEach(() => {
            jest.spyOn(tradeStore, 'validateAllProperties').mockImplementation(() => undefined);
        });

        it('raises the stake to the derived default and surfaces no error when the market minimum exceeds it', async () => {
            setVanillasState();

            await tradeStore.onProposalResponse(stakeErrorResponse());

            expect(tradeStore.amount).toBe(10);
            expect(tradeStore.stake_boundary[`1HZ25V:${CONTRACT_TYPES.VANILLA.CALL}`]).toEqual({
                min_stake: 9,
                max_stake: 5000,
            });
            expect(tradeStore.proposal_info[CONTRACT_TYPES.VANILLA.CALL]?.has_error).toBeFalsy();
            expect(tradeStore.validation_errors.amount ?? []).toEqual([]);
        });

        it('re-prices the corrected stake so the panel does not sit without a price', async () => {
            // processNewValuesAsync with is_changed_by_user=false does not reach its own
            // debouncedProposal() call (its key-regex gate only matches symbol/contract_types_list),
            // so absorbing the probe must request the proposal explicitly — otherwise the corrected
            // stake is never priced and Buy stays disabled with no error to explain why.
            setVanillasState();
            const proposal_spy = jest.spyOn(tradeStore, 'debouncedProposal').mockImplementation(() => undefined);

            await tradeStore.onProposalResponse(stakeErrorResponse());

            expect(tradeStore.amount).toBe(10);
            expect(proposal_spy).toHaveBeenCalled();
        });

        it('INTEGRATION: the corrected Turbos stake reaches the wire with real validation', async () => {
            // No validateAllProperties mock: this is the end-to-end shape of the reported stall —
            // probe rejected, correction applied, and the re-price must actually SEND. If any
            // validation error survives the correction, requestProposal sends forget_all and bails,
            // which is exactly the trace QA captured (probe, forget_all, silence).
            (tradeStore.validateAllProperties as jest.Mock).mockRestore();
            setVanillasState('1HZ50V', TRADE_TYPES.TURBOS.LONG);
            tradeStore.trade_types = { TURBOSLONG: 'Up' } as unknown as typeof tradeStore.trade_types;
            tradeStore.is_awaiting_contracts_for = false;
            tradeStore.duration = 10;
            tradeStore.duration_unit = 't';
            // The app initialises the declarative validation rules at boot (core/app.jsx); without
            // this, validateAllProperties throws instead of validating and the test proves nothing.
            // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
            const { initFormErrorMessages } = jest.requireActual('@deriv/shared');
            // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
            const { FORM_ERROR_MESSAGES } = require('@deriv/core/src/Constants/form-error-messages');
            initFormErrorMessages(FORM_ERROR_MESSAGES);
            // The store validated the entry stake against the market's rules at some point before
            // the probe answered — the real-world state the mocked tests never reproduced.
            tradeStore.validateAllProperties();

            await tradeStore.onProposalResponse({
                echo_req: { contract_type: CONTRACT_TYPES.TURBOS.LONG, underlying_symbol: '1HZ50V', amount: 2 },
                error: {
                    code: 'ContractCreationFailure',
                    details: {
                        field: 'amount',
                        min_stake: 25,
                        max_stake: 5000,
                        payout_per_point_choices: [0.05, 0.06, 0.07],
                    },
                },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);

            expect(tradeStore.amount).toBe(25);

            const subscribe_mock = WS.subscribeProposal as jest.Mock;
            subscribe_mock.mockClear();
            // Bypass the 500ms debounce: this is what debouncedProposal invokes.
            tradeStore.requestProposal();

            const standing_errors = Object.entries(tradeStore.validation_errors)
                .filter(([, errors]) => (errors as string[]).length)
                .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`);
            expect(standing_errors).toEqual([]);
            expect(subscribe_mock).toHaveBeenCalled();
        });

        it('clears a stale stake error so the corrected stake is actually re-priced', async () => {
            // The Network trace for a stalled Turbos market shows the probe going out at amount:2, a
            // forget_all, and then NO second proposal. requestProposal bails while validation_errors
            // holds anything, and processNewValuesAsync only re-validates on contract_type/currency
            // — so the error left by the rejected $2 survives the corrected write and blocks the
            // re-price that would have priced the market.
            setVanillasState('1HZ50V', TRADE_TYPES.TURBOS.LONG);
            tradeStore.trade_types = { TURBOSLONG: 'Up' } as unknown as typeof tradeStore.trade_types;
            (tradeStore.validateAllProperties as jest.Mock).mockRestore?.();
            tradeStore.validation_errors.amount = ['Minimum stake is 25.00'];

            await tradeStore.onProposalResponse({
                echo_req: { contract_type: CONTRACT_TYPES.TURBOS.LONG, underlying_symbol: '1HZ50V', amount: 2 },
                error: {
                    code: 'ContractCreationFailure',
                    details: { field: 'amount', min_stake: 25, max_stake: 5000 },
                },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);

            expect(tradeStore.amount).toBe(25);
            // Nothing may be left standing that would make requestProposal bail before sending.
            expect(tradeStore.validation_errors.amount ?? []).toHaveLength(0);
        });

        it('keeps the limits resolvable for a tab after another tab is opened and priced', async () => {
            // The probe fence and the boundary are per-market, while the store is one.
            // Opening a second tab moves the fence to it, so returning to the first finds the fence
            // naming a different market and rejects its boundary — the quick picks fall back to a
            // skeleton on a tab that was working a moment ago.
            setVanillasState('R_100', TRADE_TYPES.TURBOS.LONG);
            tradeStore.trade_types = { TURBOSLONG: 'Up' } as unknown as typeof tradeStore.trade_types;
            await tradeStore.onProposalResponse({
                echo_req: { contract_type: CONTRACT_TYPES.TURBOS.LONG, underlying_symbol: 'R_100', amount: 2 },
                error: { code: 'ContractCreationFailure', details: { field: 'amount', min_stake: 3, max_stake: 5000 } },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);
            expect(tradeStore.stake_preset_limits).toEqual({ floor: 3, max: 5000 });

            // Second tab, different market — prices and takes the fence.
            tradeStore.symbol = '1HZ50V';
            tradeStore.validation_params = {};
            await tradeStore.onProposalResponse({
                echo_req: { contract_type: CONTRACT_TYPES.TURBOS.LONG, underlying_symbol: '1HZ50V', amount: 2 },
                error: {
                    code: 'ContractCreationFailure',
                    details: { field: 'amount', min_stake: 25, max_stake: 5000 },
                },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);
            expect(tradeStore.stake_preset_limits).toEqual({ floor: 25, max: 5000 });

            // Back to the first tab. Its boundary is still recorded, and validation_params is empty
            // until it re-prices — the quick picks must not vanish in the meantime.
            tradeStore.symbol = 'R_100';
            tradeStore.validation_params = {};

            expect(tradeStore.stake_preset_limits).toEqual({ floor: 3, max: 5000 });
        });

        it('does not read a previous market boundary after a new tab clears validation_params', async () => {
            // A new tab commits a new (symbol, trade type). validation_params is cleared by that
            // commit, so the computed falls through to stake_boundary — which is never cleared. The
            // fence must reject the entry left by the market being left behind, or the new tab shows
            // the PREVIOUS market's ladder.
            setVanillasState('R_100', TRADE_TYPES.TURBOS.LONG);
            tradeStore.trade_types = { TURBOSLONG: 'Up' } as unknown as typeof tradeStore.trade_types;
            await tradeStore.onProposalResponse({
                echo_req: {
                    contract_type: CONTRACT_TYPES.TURBOS.LONG,
                    underlying_symbol: 'R_100',
                    amount: 2,
                },
                error: { code: 'ContractCreationFailure', details: { field: 'amount', min_stake: 3, max_stake: 5000 } },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);
            expect(tradeStore.stake_preset_limits).toEqual({ floor: 3, max: 5000 });

            // New tab on a different market, same trade type. Nothing has priced it yet.
            tradeStore.symbol = '1HZ50V';
            tradeStore.validation_params = {};

            expect(tradeStore.stake_preset_limits).toBeUndefined();
        });

        it('resolves the limits when Turbos prices both sub-types and the OTHER one answers first', async () => {
            // Turbos subscribes a proposal per displayed sub-type, so with Up selected the store
            // receives responses for BOTH TURBOSLONG and TURBOSSHORT. The fence is written from the
            // responding echo_req contract type, but the computed reads the key of the SELECTED
            // sub-type — so a response for the other one arriving first sets the fence to a key the
            // computed never reads, and the quick picks stay empty.
            setVanillasState('1HZ50V', TRADE_TYPES.TURBOS.LONG);
            tradeStore.trade_types = {
                TURBOSLONG: 'Up',
                TURBOSSHORT: 'Down',
            } as unknown as typeof tradeStore.trade_types;

            // The Down proposal answers first.
            await tradeStore.onProposalResponse({
                echo_req: {
                    contract_type: CONTRACT_TYPES.TURBOS.SHORT,
                    underlying_symbol: '1HZ50V',
                    amount: 2,
                },
                error: {
                    code: 'ContractCreationFailure',
                    details: { field: 'amount', min_stake: 25, max_stake: 5000 },
                },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);

            // Up is the selected sub-type, and it is what the quick picks are read for.
            expect(tradeStore.stake_preset_limits).toEqual({ floor: 25, max: 5000 });
        });

        it('resolves stake_preset_limits for Turbos Down, not only Turbos Up', async () => {
            // stake_boundary is keyed by the echo_req contract type (TURBOSSHORT), while the
            // computed derives its key from contract_type via getInitialTradeTypeTab. If those two
            // disagree for a sub-type, the limits are recorded under one key and read from another
            // — quick picks stay empty forever even though the boundary is populated.
            setVanillasState('1HZ50V', TRADE_TYPES.TURBOS.SHORT);
            tradeStore.trade_types = { TURBOSSHORT: 'Down' } as unknown as typeof tradeStore.trade_types;

            await tradeStore.onProposalResponse({
                echo_req: {
                    contract_type: CONTRACT_TYPES.TURBOS.SHORT,
                    underlying_symbol: '1HZ50V',
                    amount: 2,
                },
                error: {
                    code: 'ContractCreationFailure',
                    details: { field: 'amount', min_stake: 25, max_stake: 5000 },
                },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);

            expect(tradeStore.stake_boundary[`1HZ50V:${CONTRACT_TYPES.TURBOS.SHORT}`]).toEqual({
                min_stake: 25,
                max_stake: 5000,
            });
            expect(tradeStore.stake_preset_limits).toEqual({ floor: 25, max: 5000 });
        });

        it('re-prices after absorbing a Turbos rejection instead of leaving the panel unpriced', async () => {
            // End-to-end shape of the reported Turbos stall: the corrected stake must actually go
            // back out. If validateAllProperties leaves a stake error standing, requestProposal
            // bails before sending anything and the panel never prices.
            setVanillasState('1HZ50V', TRADE_TYPES.TURBOS.LONG);
            tradeStore.trade_types = { TURBOSLONG: 'Up' } as unknown as typeof tradeStore.trade_types;
            const proposal_spy = jest.spyOn(tradeStore, 'debouncedProposal').mockImplementation(() => undefined);

            await tradeStore.onProposalResponse({
                echo_req: {
                    contract_type: CONTRACT_TYPES.TURBOS.LONG,
                    underlying_symbol: '1HZ50V',
                    amount: 2,
                },
                error: {
                    code: 'ContractCreationFailure',
                    details: {
                        field: 'amount',
                        min_stake: 25,
                        max_stake: 5000,
                        payout_per_point_choices: [0.05, 0.06, 0.07],
                    },
                },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);

            expect(tradeStore.amount).toBe(25);
            expect(proposal_spy).toHaveBeenCalled();
            // The corrected stake is valid for the recorded band, so nothing may be left blocking
            // the re-price.
            expect(tradeStore.validation_errors.amount ?? []).toHaveLength(0);
            proposal_spy.mockRestore();
        });

        it('still applies the Turbos payout choices carried on the absorbed response', async () => {
            // A Turbos stake rejection carries payout_per_point_choices on the SAME payload as the
            // limits. The absorb block returns early, so the branch that would apply those choices
            // never runs — leaving payout_per_point unset and the panel unable to price, which is
            // the stalled Turbos state.
            setVanillasState('1HZ50V', TRADE_TYPES.TURBOS.LONG);
            tradeStore.trade_types = { TURBOSLONG: 'Up' } as unknown as typeof tradeStore.trade_types;
            tradeStore.payout_per_point = '';

            await tradeStore.onProposalResponse({
                echo_req: {
                    contract_type: CONTRACT_TYPES.TURBOS.LONG,
                    underlying_symbol: '1HZ50V',
                    amount: 2,
                },
                error: {
                    code: 'ContractCreationFailure',
                    details: {
                        field: 'amount',
                        min_stake: 25,
                        max_stake: 5000,
                        payout_per_point_choices: [0.05, 0.06, 0.07],
                    },
                },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);

            expect(tradeStore.stake_boundary[`1HZ50V:${CONTRACT_TYPES.TURBOS.LONG}`]).toEqual({
                min_stake: 25,
                max_stake: 5000,
            });
            // The choices on that same payload must not be lost to the early return.
            expect(tradeStore.payout_choices).toEqual(['0.05', '0.06', '0.07']);
            expect(tradeStore.payout_per_point).toBe('0.06');
        });

        it('reads the limits from the error when a rejection also carries a proposal object', async () => {
            // Turbos prices the contract and rejects the stake in the same payload, so the response
            // has BOTH a proposal object and an error. `proposal ?? error.details` resolved to the
            // proposal — which carries no limits — so the minimum was never read and the market
            // stalled exactly as a min-only response did.
            setVanillasState('1HZ50V', TRADE_TYPES.TURBOS.LONG);
            tradeStore.trade_types = { TURBOSLONG: 'Up' } as unknown as typeof tradeStore.trade_types;

            await tradeStore.onProposalResponse({
                echo_req: {
                    contract_type: CONTRACT_TYPES.TURBOS.LONG,
                    underlying_symbol: '1HZ50V',
                    amount: 2,
                },
                proposal: { id: 'proposal-id', ask_price: 2, payout: 0 },
                error: { code: 'ContractCreationFailure', details: { field: 'amount', min_stake: 25 } },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);

            expect(tradeStore.stake_boundary[`1HZ50V:${CONTRACT_TYPES.TURBOS.LONG}`]).toEqual({
                min_stake: 25,
                max_stake: undefined,
            });
            expect(tradeStore.stake_preset_limits).toEqual({ floor: 25, max: undefined });
            expect(tradeStore.amount).toBe(25);
        });

        it('reads the minimum from code_args when InvalidMinStake carries it nowhere else', async () => {
            // The InvalidMinStake payload as the live API actually sends it (captured by QA):
            // details is `{ field: "amount" }` with NO min_stake key — the number exists only in
            // code_args and the human message. This is the rejection a request valid in every other
            // field earns, on any trade type, and it was invisible to the whole recovery machinery:
            // the stake stayed on the rejected value and the quick picks never updated.
            setVanillasState('R_75');

            await tradeStore.onProposalResponse({
                echo_req: {
                    amount: 2,
                    barrier: '+0.0250',
                    basis: 'stake',
                    contract_type: CONTRACT_TYPES.VANILLA.CALL,
                    underlying_symbol: 'R_75',
                },
                error: {
                    code: 'ContractBuyValidationError',
                    code_args: ['8.00'],
                    details: { field: 'amount' },
                    message: "Please enter a stake amount that's at least 8.00.",
                    subcode: 'InvalidMinStake',
                },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);

            expect(tradeStore.stake_boundary[`R_75:${CONTRACT_TYPES.VANILLA.CALL}`]).toEqual({
                min_stake: 8,
                max_stake: undefined,
            });
            expect(tradeStore.stake_preset_limits).toEqual({ floor: 8, max: undefined });
            expect(tradeStore.amount).toBe(8);
            // Absorbed, so the platform's own rejected stake never surfaces as the user's error.
            expect(tradeStore.proposal_info[CONTRACT_TYPES.VANILLA.CALL]?.has_error).toBeFalsy();
        });

        it('ignores code_args on rejections that are not InvalidMinStake', async () => {
            // code_args is just the message's fill-in values — on other subcodes it can hold
            // anything (the barrier rejection carries the barrier list there), so it must never be
            // mistaken for a stake limit.
            setVanillasState('R_75');

            await tradeStore.onProposalResponse({
                echo_req: {
                    amount: 2,
                    barrier: '+0.10',
                    basis: 'stake',
                    contract_type: CONTRACT_TYPES.VANILLA.CALL,
                    underlying_symbol: 'R_75',
                },
                error: {
                    code: 'ContractBuyValidationError',
                    code_args: ['+63.9380, +33.6530, +0.0250, -33.5790, -63.8040'],
                    details: { barrier_choices: ['+63.9380', '+0.0250'], field: 'barrier' },
                    message: 'Barriers available are +63.9380, +33.6530, +0.0250, -33.5790, -63.8040.',
                    subcode: 'InvalidBarrierPredefined',
                },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);

            expect(tradeStore.stake_boundary[`R_75:${CONTRACT_TYPES.VANILLA.CALL}`]).toBeUndefined();
            expect(tradeStore.amount).toBe(2);
        });

        it('resolves the limits for a trade type without sub-type tabs (Accumulators)', async () => {
            // stake_preset_limits derives its key from the trade-type tabs, and Accumulators is the
            // one trade type with none — getInitialTradeTypeTab returns '' for it. The limits were
            // recorded under `symbol:ACCU` by the probe but read under a key nothing ever wrote, so
            // the quick picks stayed in their skeleton forever on Accumulators.
            tradeStore.symbol = '1HZ100V';
            tradeStore.currency = 'USD';
            tradeStore.contract_type = TRADE_TYPES.ACCUMULATOR;
            tradeStore.trade_types = { ACCU: 'Accumulators' } as unknown as typeof tradeStore.trade_types;
            tradeStore.default_stake = 2;
            tradeStore.amount = 2;

            await tradeStore.onProposalResponse({
                echo_req: { contract_type: 'ACCU', underlying_symbol: '1HZ100V', amount: 2 },
                proposal: { id: 'proposal-id', ask_price: 2, payout: 0, min_stake: 1, max_stake: 2000 },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);

            expect(tradeStore.stake_preset_limits).toEqual({ floor: 2, max: 2000 });
        });

        it('drops a straggling response for a trade type the user has left (same symbol)', async () => {
            // Subscriptions are forgotten on a trade-type switch, but a response already in flight
            // still lands. proposal_requests holds the open tab's own contract types, so a response
            // for anything else is a straggler and must not settle the stake or snap choices for a
            // contract shape no longer on screen.
            setVanillasState('1HZ50V', TRADE_TYPES.TURBOS.LONG);
            tradeStore.trade_types = { TURBOSLONG: 'Up' } as unknown as typeof tradeStore.trade_types;
            // The open tab prices Turbos only; the arriving response is for Vanillas, just left.
            tradeStore.proposal_requests = { TURBOSLONG: {} } as typeof tradeStore.proposal_requests;

            await tradeStore.onProposalResponse(
                stakeErrorResponse({
                    contract_type: CONTRACT_TYPES.VANILLA.CALL,
                    underlying_symbol: '1HZ50V',
                    details: { field: 'amount', min_stake: 25, max_stake: 5000 },
                })
            );

            expect(tradeStore.amount).toBe(2);
            expect(tradeStore.stake_boundary[`1HZ50V:${CONTRACT_TYPES.VANILLA.CALL}`]).toBeUndefined();
            expect(tradeStore.probed_stake_keys.size).toBe(0);
        });

        it('swallows a probe rejection answering a stake the user replaced, without side effects', async () => {
            // The user edits the stake while the first response for a fresh key is in flight. That
            // response answers a stake no longer held: their own value has its own proposal coming,
            // so this one is dropped — but its choices were priced against the OLD stake and any
            // standing validation error belongs to the NEW draft, so neither may be touched.
            setVanillasState('R_75');
            tradeStore.barrier_1 = '+0.10';
            tradeStore.validation_errors.amount = ['Minimum stake is 8.00'];
            tradeStore.amount = 500; // the user's edit, in flight with its own proposal

            await tradeStore.onProposalResponse(
                stakeErrorResponse({
                    underlying_symbol: 'R_75',
                    // Priced against the platform's 2, not the user's 500.
                    amount: 2,
                    details: {
                        field: 'amount',
                        min_stake: 8,
                        max_stake: 5000,
                        barrier_choices: ['+63.9380', '+0.0250'],
                    } as unknown as { field: string },
                })
            );

            // Limits recorded and the fence closed (the user's stake is theirs now)…
            expect(tradeStore.stake_preset_limits).toEqual({ floor: 8, max: 5000 });
            expect(tradeStore.probed_stake_keys.has(`R_75:${CONTRACT_TYPES.VANILLA.CALL}`)).toBe(true);
            // …but nothing else was touched: no stake overwrite, no barrier snap from a stale
            // response, no clearing of an error that belongs to the new draft.
            expect(tradeStore.amount).toBe(500);
            expect(tradeStore.barrier_1).toBe('+0.10');
            expect(tradeStore.validation_errors.amount).toEqual(['Minimum stake is 8.00']);
            // Swallowed: the stale rejection never becomes user-visible state.
            expect(tradeStore.proposal_info[CONTRACT_TYPES.VANILLA.CALL]?.has_error).toBeFalsy();
        });

        it('records a minimum reported without a maximum, and resolves the limits from it', async () => {
            // The reported Volatility 75 failure. A stake rejection carries the minimum that
            // rejected it and no maximum at all; requiring both dropped the whole payload, so the
            // limits never resolved — quick picks stuck in their skeleton, the stake stuck on the
            // rejected default in an error state, and the per-key fence blocking any retry.
            setVanillasState('R_75');

            await tradeStore.onProposalResponse(
                stakeErrorResponse({
                    underlying_symbol: 'R_75',
                    details: { field: 'amount', min_stake: 6.5 },
                })
            );

            expect(tradeStore.stake_boundary[`R_75:${CONTRACT_TYPES.VANILLA.CALL}`]).toEqual({
                min_stake: 6.5,
                max_stake: undefined,
            });
            // 6.5 rounds up to 8, so the quick picks have a floor to build from.
            expect(tradeStore.stake_preset_limits).toEqual({ floor: 8, max: undefined });
            expect(tradeStore.amount).toBe(8);
            expect(tradeStore.proposal_info[CONTRACT_TYPES.VANILLA.CALL]?.has_error).toBeFalsy();
        });

        it('keeps a maximum already known when a later response reports only a minimum', async () => {
            setVanillasState();
            await tradeStore.onProposalResponse(stakeErrorResponse());
            expect(tradeStore.stake_boundary[`1HZ25V:${CONTRACT_TYPES.VANILLA.CALL}`]).toEqual({
                min_stake: 9,
                max_stake: 5000,
            });

            tradeStore.setStakeBoundary(CONTRACT_TYPES.VANILLA.CALL, 12, undefined);

            // A band learned in full is never narrowed back to a half by a later rejection.
            expect(tradeStore.stake_boundary[`1HZ25V:${CONTRACT_TYPES.VANILLA.CALL}`]).toEqual({
                min_stake: 12,
                max_stake: 5000,
            });
        });

        it('does not reconcile twice for the same symbol and contract type (re-entrancy fence)', async () => {
            setVanillasState();

            await tradeStore.onProposalResponse(stakeErrorResponse());
            expect(tradeStore.amount).toBe(10);

            // The corrected stake re-prices, so a second response for the same key arrives; it must
            // not be absorbed again or the reconciliation would loop.
            await tradeStore.onProposalResponse(stakeErrorResponse({ amount: 10 }));

            expect(tradeStore.amount).toBe(10);
            expect(tradeStore.proposal_info[CONTRACT_TYPES.VANILLA.CALL]?.has_error).toBe(true);
        });

        it('keeps the contracts_for default when the market minimum is already below it', async () => {
            setVanillasState();

            await tradeStore.onProposalResponse(successResponse({ min_stake: 1 }));

            expect(tradeStore.amount).toBe(2);
            expect(tradeStore.stake_boundary[`1HZ25V:${CONTRACT_TYPES.VANILLA.CALL}`]).toEqual({
                min_stake: 1,
                max_stake: 5000,
            });
        });

        it('re-arms the probe on a Vanilla Call to Vanilla Put flip and keeps a boundary per sub-type', async () => {
            setVanillasState();
            await tradeStore.onProposalResponse(stakeErrorResponse());
            expect(tradeStore.amount).toBe(10);

            // A within-group flip does not reset the stake, so the probe is the only thing that can
            // raise it to the Put sub-type's higher minimum.
            tradeStore.contract_type = TRADE_TYPES.VANILLA.PUT;
            tradeStore.trade_types = { VANILLALONGPUT: 'Put' } as unknown as typeof tradeStore.trade_types;

            await tradeStore.onProposalResponse(
                stakeErrorResponse({
                    contract_type: CONTRACT_TYPES.VANILLA.PUT,
                    amount: 10,
                    details: { field: 'amount', min_stake: 34.06, max_stake: 5000 },
                })
            );

            expect(tradeStore.amount).toBe(40);
            expect(tradeStore.stake_boundary[`1HZ25V:${CONTRACT_TYPES.VANILLA.CALL}`]).toEqual({
                min_stake: 9,
                max_stake: 5000,
            });
            expect(tradeStore.stake_boundary[`1HZ25V:${CONTRACT_TYPES.VANILLA.PUT}`]).toEqual({
                min_stake: 34.06,
                max_stake: 5000,
            });
        });

        it('re-arms the probe on a symbol switch within Vanillas and does not retain the previous market stake', async () => {
            setVanillasState('1HZ25V');
            await tradeStore.onProposalResponse(stakeErrorResponse({ underlying_symbol: '1HZ25V' }));
            expect(tradeStore.amount).toBe(10);

            tradeStore.symbol = '1HZ50V';

            await tradeStore.onProposalResponse(
                stakeErrorResponse({
                    underlying_symbol: '1HZ50V',
                    amount: 10,
                    details: { field: 'amount', min_stake: 20, max_stake: 5000 },
                })
            );

            expect(tradeStore.amount).toBe(20);
        });

        it('applies the strike choices carried on the absorbed response and snaps the barrier', async () => {
            // The limits and the barrier reconciliation arrive on the same payload. Absorbing the
            // response returns before the error branch that normally applies the choices, so the
            // probe has to apply them itself — otherwise barrier_1 stays on a strike the market has
            // already rejected and the re-priced (visible) response errors on the barrier instead.
            setVanillasState();
            tradeStore.barrier_1 = '+0.1';
            jest.spyOn(tradeStore, 'debouncedProposal').mockImplementation(() => undefined);

            await tradeStore.onProposalResponse({
                echo_req: { contract_type: CONTRACT_TYPES.VANILLA.CALL, underlying_symbol: '1HZ25V', amount: 2 },
                error: {
                    code: 'ContractCreationFailure',
                    message: 'Invalid stake.',
                    details: {
                        field: 'amount',
                        min_stake: 9,
                        max_stake: 5000,
                        barrier_choices: ['+1.0', '+2.0', '+3.0'],
                    },
                },
            } as unknown as Parameters<typeof tradeStore.onProposalResponse>[0]);

            expect(tradeStore.amount).toBe(10);
            expect(tradeStore.barrier_choices).toEqual(['+1.0', '+2.0', '+3.0']);
            expect(tradeStore.barrier_1).toBe('+1.0');
        });

        it('leaves the stake and the error untouched when a Vanillas error carries no minimum', async () => {
            setVanillasState();

            await tradeStore.onProposalResponse(stakeErrorResponse({ details: { field: 'amount' } }));

            expect(tradeStore.amount).toBe(2);
            expect(tradeStore.probed_stake_keys.size).toBe(0);
            expect(tradeStore.proposal_info[CONTRACT_TYPES.VANILLA.CALL]?.has_error).toBe(true);
        });

        it('does not overwrite a stake the user set above the minimum while the same market stays active', async () => {
            setVanillasState();
            await tradeStore.onProposalResponse(stakeErrorResponse());
            expect(tradeStore.amount).toBe(10);

            // Reconciliation happens once per (symbol, sub-type); a stake set afterwards on the same
            // market is the user's own and is priced as they typed it.
            tradeStore.amount = 50;
            await tradeStore.onProposalResponse(successResponse({ amount: 50, min_stake: 9 }));

            expect(tradeStore.amount).toBe(50);
            expect(tradeStore.stake_boundary[`1HZ25V:${CONTRACT_TYPES.VANILLA.CALL}`]).toEqual({
                min_stake: 9,
                max_stake: 5000,
            });
        });

        describe('entering a market always lands on its first quick pick', () => {
            // The derived default IS the first quick pick (getStakeLadderValues leads with it),
            // so "the stake on entry equals the derived default" and "the stake on entry equals the
            // lowest quick pick offered" are the same assertion.
            const firstQuickPick = (min_stake: number, max_stake = 5000) => {
                const derived_default = getDerivedDefaultStake(tradeStore.default_stake, min_stake, max_stake);
                return getStakeLadderValues(getStakePresets('vanillas') as number[], derived_default, max_stake)[0];
            };

            it('lowers a stake carried in from a higher-minimum market to the entered market’s first quick pick', async () => {
                setVanillasState('1HZ25V');
                await tradeStore.onProposalResponse(
                    stakeErrorResponse({
                        underlying_symbol: '1HZ25V',
                        details: { field: 'amount', min_stake: 34.06, max_stake: 5000 },
                    })
                );
                expect(tradeStore.amount).toBe(40);

                // R_100 accepts 40, so nothing about it is invalid — but 40 is not this market's
                // first quick pick, which is what the user is shown as the starting stake. The
                // priced amount has to be the one the store is actually holding, or the staleness
                // check treats the response as answering a stake the user has since changed.
                tradeStore.symbol = 'R_100';
                await tradeStore.onProposalResponse(
                    successResponse({ underlying_symbol: 'R_100', amount: 40, min_stake: 1 })
                );

                expect(tradeStore.amount).toBe(firstQuickPick(1));
                expect(tradeStore.amount).toBe(2);
            });

            it('does not carry a quick pick the user tapped on one market into the next one', async () => {
                setVanillasState('1HZ25V');
                await tradeStore.onProposalResponse(
                    stakeErrorResponse({
                        underlying_symbol: '1HZ25V',
                        details: { field: 'amount', min_stake: 34.06, max_stake: 5000 },
                    })
                );
                // 500 is one of the quick picks offered on a market with a minimum of 34.06.
                tradeStore.amount = 500;

                tradeStore.symbol = 'R_100';
                await tradeStore.onProposalResponse(
                    successResponse({ underlying_symbol: 'R_100', amount: 500, min_stake: 1 })
                );

                expect(tradeStore.amount).toBe(firstQuickPick(1));
            });

            it('lowers the stake on a Vanilla Call to Vanilla Put flip when the Put minimum is lower', async () => {
                setVanillasState();
                await tradeStore.onProposalResponse(
                    stakeErrorResponse({ details: { field: 'amount', min_stake: 34.06, max_stake: 5000 } })
                );
                expect(tradeStore.amount).toBe(40);

                // A within-group flip does not reset the stake, so the probe is the only thing that
                // can bring it back down to the Put sub-type's own first quick pick.
                tradeStore.contract_type = TRADE_TYPES.VANILLA.PUT;
                tradeStore.trade_types = { VANILLALONGPUT: 'Put' } as unknown as typeof tradeStore.trade_types;

                await tradeStore.onProposalResponse(
                    successResponse({ contract_type: CONTRACT_TYPES.VANILLA.PUT, amount: 40, min_stake: 9 })
                );

                expect(tradeStore.amount).toBe(firstQuickPick(9));
                expect(tradeStore.amount).toBe(10);
            });

            it('does not retain a user-customised stake across a Vanillas symbol switch', async () => {
                setVanillasState('1HZ25V');
                tradeStore.amount = 500; // customised away from the account default

                await tradeStore.processNewValuesAsync({ symbol: 'R_100' }, false, {
                    contract_type: TRADE_TYPES.VANILLA.CALL,
                });

                // The switch itself drops back to the account default; the first proposal for R_100
                // then reconciles it against that market's own minimum.
                expect(tradeStore.amount).toBe(2);
            });
        });

        it('leaves a stake the user typed while the first response was in flight alone', async () => {
            // The fence on its own cannot tell the platform's entry stake from a value the user
            // typed in the window before the first response for a fresh key landed. echo_req.amount
            // can: a response priced against a stake that is no longer the one in the store was
            // priced against the entry stake, not against what the user has since typed.
            setVanillasState();
            tradeStore.amount = 3; // typed before the response for the entry stake (2) arrived

            await tradeStore.onProposalResponse(stakeErrorResponse({ amount: 2 }));

            expect(tradeStore.amount).toBe(3);
            // The boundary is still recorded — only the overwrite is withheld.
            expect(tradeStore.stake_boundary[`1HZ25V:${CONTRACT_TYPES.VANILLA.CALL}`]).toEqual({
                min_stake: 9,
                max_stake: 5000,
            });

            // The response for the stake the user typed then errors as their own.
            await tradeStore.onProposalResponse(stakeErrorResponse({ amount: 3 }));

            expect(tradeStore.amount).toBe(3);
            expect(tradeStore.proposal_info[CONTRACT_TYPES.VANILLA.CALL]?.has_error).toBe(true);
        });

        it('surfaces a below-minimum stake the user typed themselves as their own error', async () => {
            // Only the first response per (symbol, sub-type) — the platform's own default on load —
            // may be absorbed. Once that fence is burned, a stake the user types below the minimum
            // must reach proposal_info as an error rather than being silently rewritten.
            setVanillasState();
            await tradeStore.onProposalResponse(stakeErrorResponse());
            expect(tradeStore.amount).toBe(10);

            tradeStore.amount = 3; // typed by the user, still below the market minimum of 8
            await tradeStore.onProposalResponse(stakeErrorResponse({ amount: 3 }));

            expect(tradeStore.amount).toBe(3);
            expect(tradeStore.proposal_info[CONTRACT_TYPES.VANILLA.CALL]?.has_error).toBe(true);
        });

        describe('stake_preset_limits (the limits both stake surfaces read)', () => {
            // The limits come from the priced proposal's validation_params, so the settled state is
            // an error response (absorbed, stake corrected) followed by the successful re-price.
            const pricedResponse = (contract_type: string, min: string, max = '5000.00') =>
                ({
                    echo_req: { contract_type, underlying_symbol: '1HZ25V', amount: 10 },
                    proposal: {
                        id: 'proposal-id',
                        ask_price: 10,
                        payout: 0,
                        validation_params: { stake: { min, max } },
                    },
                }) as unknown as Parameters<typeof tradeStore.onProposalResponse>[0];

            it('is the derived floor and the market maximum, resolved per Call and Put', async () => {
                setVanillasState();
                await tradeStore.onProposalResponse(stakeErrorResponse());
                await tradeStore.onProposalResponse(pricedResponse(CONTRACT_TYPES.VANILLA.CALL, '8.00'));

                expect(tradeStore.stake_preset_limits).toEqual({ floor: 8, max: 5000 });

                // The key is derived from contract_type alone, so the Put floor is the Put minimum
                // even while the Call entry is still present.
                tradeStore.contract_type = TRADE_TYPES.VANILLA.PUT;
                await tradeStore.onProposalResponse(pricedResponse(CONTRACT_TYPES.VANILLA.PUT, '34.06'));

                expect(tradeStore.stake_preset_limits).toEqual({ floor: 40, max: 5000 });
            });

            it('resolves from the absorbed response, before validation_params repopulates', async () => {
                // The response that first reveals a market's minimum is absorbed to correct the
                // stake, so validation_params stays empty for the whole round trip the re-price
                // takes. The limits that response carried are already recorded, and they are this
                // market's own — so the quick picks resolve now rather than a round trip later.
                setVanillasState();

                await tradeStore.onProposalResponse(stakeErrorResponse());

                expect(tradeStore.validation_params[CONTRACT_TYPES.VANILLA.CALL]).toBeUndefined();
                expect(tradeStore.stake_preset_limits).toEqual({ floor: 10, max: 5000 });
            });

            it('is undefined on a market the recorded limits do not belong to', async () => {
                setVanillasState();
                await tradeStore.onProposalResponse(stakeErrorResponse());

                // The boundary is keyed by contract type alone and is never cleared, so switching
                // market leaves 1HZ25V's minimum behind under the same key. Only the (symbol,
                // sub-type) whose proposal wrote it may read it.
                tradeStore.symbol = '1HZ75V';

                expect(tradeStore.stake_preset_limits).toBeUndefined();
            });

            it('is undefined before any response for the market, and resolves for non-Vanillas too', async () => {
                setVanillasState();
                expect(tradeStore.stake_preset_limits).toBeUndefined();

                // Turbos resolves its limits the same way Vanillas does: the ladder is derived per
                // trade type, so both stake surfaces get a floor here rather than only on Vanillas.
                tradeStore.contract_type = TRADE_TYPES.TURBOS.LONG;
                await tradeStore.onProposalResponse(pricedResponse(CONTRACT_TYPES.TURBOS.LONG, '8.00'));

                expect(tradeStore.stake_preset_limits).toEqual({ floor: 8, max: 5000 });
            });

            it('falls back to the raw minimum when the rounded floor would exceed the maximum', async () => {
                setVanillasState();
                await tradeStore.onProposalResponse(pricedResponse(CONTRACT_TYPES.VANILLA.CALL, '8.00', '9.00'));

                expect(tradeStore.stake_preset_limits).toEqual({ floor: 8, max: 9 });
            });

            it('does not re-publish the same limits on every proposal tick', async () => {
                // validation_params is reassigned by each streaming response, so a fresh object per
                // tick would re-render both stake surfaces for an identical ladder.
                setVanillasState();
                await tradeStore.onProposalResponse(pricedResponse(CONTRACT_TYPES.VANILLA.CALL, '8.00'));

                const published: unknown[] = [];
                const dispose = reaction(
                    () => tradeStore.stake_preset_limits,
                    limits => published.push(limits)
                );
                await tradeStore.onProposalResponse(pricedResponse(CONTRACT_TYPES.VANILLA.CALL, '8.00'));
                dispose();

                expect(published).toHaveLength(0);
            });
        });

        describe('entering Vanillas from another trade type', () => {
            // The stake reset runs before any proposal for the market being entered, so it can only
            // use a boundary recorded earlier. stake_boundary is keyed by contract type alone and is
            // never cleared, so which market that boundary belongs to has to be checked.
            const leaveVanillasForTurbos = () => {
                tradeStore.contract_type = TRADE_TYPES.TURBOS.LONG;
                tradeStore.trade_types = { TURBOSLONG: 'Long' } as unknown as typeof tradeStore.trade_types;
                tradeStore.amount = 2; // the reset on the way out restores the account default
            };

            const returnToVanillas = () =>
                tradeStore.processNewValuesAsync({ contract_type: TRADE_TYPES.VANILLA.CALL }, false, {
                    contract_type: TRADE_TYPES.TURBOS.LONG,
                });

            it('re-applies the derived default on the market the boundary was recorded for', async () => {
                setVanillasState('1HZ25V');
                await tradeStore.onProposalResponse(stakeErrorResponse({ underlying_symbol: '1HZ25V' }));
                expect(tradeStore.amount).toBe(10);

                leaveVanillasForTurbos();
                await returnToVanillas();

                // The probe is fenced off for a key it has already reconciled, so on the way back
                // this reset is the only thing that can lift the stake off the account default of 2,
                // which sits below this market's minimum of 8.
                expect(tradeStore.amount).toBe(10);
            });

            it('does not apply another market’s minimum when the boundary is not the entered market’s', async () => {
                setVanillasState('1HZ25V');
                await tradeStore.onProposalResponse(stakeErrorResponse({ underlying_symbol: '1HZ25V' }));
                expect(tradeStore.stake_boundary[`1HZ25V:${CONTRACT_TYPES.VANILLA.CALL}`]).toEqual({
                    min_stake: 9,
                    max_stake: 5000,
                });

                leaveVanillasForTurbos();
                // Move to a market whose Vanillas minimum is below the account default while off
                // Vanillas, so nothing re-prices Vanillas and the 1HZ25V boundary is still the only
                // one recorded under VANILLALONGCALL.
                tradeStore.symbol = 'R_100';

                await returnToVanillas();

                // R_100 accepts the account default, so raising it to 1HZ25V's derived 10 would hand
                // the user a 5x stake the market never asked for — and the probe cannot undo it,
                // since it only ever raises a stake that is below the minimum.
                expect(tradeStore.amount).toBe(2);
            });
        });

        describe('every trade type reconciles the stake, not only Vanillas', () => {
            it.each<[string, string, string, Record<string, string>]>([
                ['Turbos', TRADE_TYPES.TURBOS.LONG, CONTRACT_TYPES.TURBOS.LONG, { TURBOSLONG: 'Long' }],
                ['Rise/Fall', TRADE_TYPES.RISE_FALL, CONTRACT_TYPES.CALL, { CALL: 'Rise', PUT: 'Fall' }],
                ['Multipliers', TRADE_TYPES.MULTIPLIER, CONTRACT_TYPES.MULTIPLIER.UP, { MULTUP: 'Up' }],
            ])(
                'settles the stake on the derived default for %s instead of surfacing the error',
                async (_label, trade_type, contract_type, trade_types) => {
                    setVanillasState('1HZ25V', trade_type);
                    tradeStore.trade_types = trade_types as unknown as typeof tradeStore.trade_types;

                    // The response reports a minimum of 8 against a stake of 2: the platform picked
                    // that stake on entry, so it is corrected to the derived default (8 -> 10) and
                    // re-priced rather than shown to the user as their own error.
                    await tradeStore.onProposalResponse(stakeErrorResponse({ contract_type }));

                    expect(tradeStore.amount).toBe(10);
                    expect(tradeStore.probed_stake_keys.has(`1HZ25V:${contract_type}`)).toBe(true);
                    // The probe is absorbed, so the rejection never reaches proposal_info.
                    expect(tradeStore.proposal_info[contract_type]?.has_error).toBeFalsy();
                }
            );

            it('does not derive the Vanillas default from another trade type’s minimum', async () => {
                // On a Turbos -> Vanillas switch the store still holds the Turbos trade_types/tab when
                // the stake is reset, so resolving the boundary from those would read the Turbos
                // minimum and start Vanillas far above its own default.
                tradeStore.currency = 'USD';
                tradeStore.symbol = '1HZ25V';
                tradeStore.contract_type = TRADE_TYPES.TURBOS.LONG;
                tradeStore.trade_types = { TURBOSLONG: 'Long' } as unknown as typeof tradeStore.trade_types;
                tradeStore.trade_type_tab = CONTRACT_TYPES.TURBOS.LONG;
                tradeStore.default_stake = 2;
                tradeStore.amount = 2;
                tradeStore.setStakeBoundary(CONTRACT_TYPES.TURBOS.LONG, 34.06, 5000);

                await tradeStore.processNewValuesAsync({ contract_type: TRADE_TYPES.VANILLA.CALL }, false, {
                    contract_type: TRADE_TYPES.TURBOS.LONG,
                });

                expect(tradeStore.amount).toBe(2);
            });

            it('derives a high-minimum Turbos symbol from its own limits, with no curated table', async () => {
                // 1HZ25V (min 34.06) used to be served by a hand-written [35, 40, 45, 50, 55, 60]
                // table. That table is gone: the switch itself lands on the contracts_for default,
                // and the market's own first proposal is what reconciles it — the same path every
                // other market takes.
                tradeStore.currency = 'USD';
                tradeStore.symbol = '1HZ100V';
                tradeStore.contract_type = TRADE_TYPES.TURBOS.LONG;
                tradeStore.default_stake = 2;
                tradeStore.amount = 2;

                await tradeStore.processNewValuesAsync({ symbol: '1HZ25V' }, false, {
                    contract_type: TRADE_TYPES.TURBOS.LONG,
                });

                expect(tradeStore.amount).toBe(2);

                // The switch cleanup cleared the outstanding-request map; a real response is always
                // preceded by its own subscribe, which repopulates it.
                tradeStore.proposal_requests = { TURBOSLONG: {} } as typeof tradeStore.proposal_requests;

                // The proposal for 1HZ25V reports the real minimum, which settles the stake on the
                // derived default — 40, against the 35 the deleted table opened with.
                await tradeStore.onProposalResponse(
                    stakeErrorResponse({
                        contract_type: CONTRACT_TYPES.TURBOS.LONG,
                        underlying_symbol: '1HZ25V',
                        details: { field: 'amount', min_stake: 34.06, max_stake: 5000 },
                    })
                );

                expect(tradeStore.amount).toBe(40);
            });
        });
    });

    describe('is_automation_params_locked', () => {
        const setRunActive = (is_active: boolean) => {
            const root = tradeStore.root_store as unknown as { modules: { automation?: { is_active: boolean } } };
            root.modules = { ...root.modules, automation: { is_active } };
        };
        const setMobile = (is_mobile: boolean) => {
            (tradeStore.root_store.ui as unknown as { is_mobile: boolean }).is_mobile = is_mobile;
        };

        it('is false in manual trading even while a run is active (desktop)', () => {
            setRunActive(true);
            setMobile(false);
            tradeStore.setActiveTradePanelTab(TRADE_PANEL_TABS.TRADE);
            tradeStore.setIsAutomationPage(false);
            expect(tradeStore.is_automation_params_locked).toBe(false);
        });

        it('is true on the desktop automation tab while a run is active', () => {
            setRunActive(true);
            setMobile(false);
            tradeStore.setActiveTradePanelTab(TRADE_PANEL_TABS.AUTOMATION);
            expect(tradeStore.is_automation_params_locked).toBe(true);
        });

        it('is true in the mobile automation view while a run is active', () => {
            setRunActive(true);
            setMobile(true);
            tradeStore.setIsAutomationPage(true);
            expect(tradeStore.is_automation_params_locked).toBe(true);
        });

        it('is false on the mobile manual page even when the panel tab persisted as automation', () => {
            // Regression: the desktop-only panel tab must not leak onto mobile (no switcher resets it).
            setRunActive(true);
            setMobile(true);
            tradeStore.setActiveTradePanelTab(TRADE_PANEL_TABS.AUTOMATION);
            tradeStore.setIsAutomationPage(false);
            expect(tradeStore.is_automation_params_locked).toBe(false);
        });

        it('ignores the mobile view flag on desktop', () => {
            setRunActive(true);
            setMobile(false);
            tradeStore.setActiveTradePanelTab(TRADE_PANEL_TABS.TRADE);
            tradeStore.setIsAutomationPage(true);
            expect(tradeStore.is_automation_params_locked).toBe(false);
        });

        it('is false in the automation view when no run is active', () => {
            setRunActive(false);
            setMobile(true);
            tradeStore.setIsAutomationPage(true);
            expect(tradeStore.is_automation_params_locked).toBe(false);
        });

        describe('non-automatable symbol', () => {
            const AUTOMATABLE = 'R_100';
            const NON_AUTOMATABLE = 'cryBTCUSD';
            beforeEach(() => {
                tradeStore.active_symbols = [
                    {
                        underlying_symbol: AUTOMATABLE,
                        display_order: 1,
                        exchange_is_open: 1,
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        is_trading_suspended: 0,
                        subgroup: 'volatility',
                    },
                    {
                        underlying_symbol: NON_AUTOMATABLE,
                        display_order: 2,
                        exchange_is_open: 1,
                        market: 'cryptocurrency',
                        submarket: 'non_stable_coin',
                        is_trading_suspended: 0,
                        subgroup: 'none',
                    },
                ] as NonNullable<TActiveSymbolsResponse['active_symbols']>;
                setRunActive(false);
                setMobile(false);
                tradeStore.setActiveTradePanelTab(TRADE_PANEL_TABS.AUTOMATION);
            });

            it('flags is_symbol_automatable false for a Crypto/Crash-Boom symbol', () => {
                tradeStore.symbol = NON_AUTOMATABLE;
                expect(tradeStore.is_symbol_automatable).toBe(false);
                tradeStore.symbol = AUTOMATABLE;
                expect(tradeStore.is_symbol_automatable).toBe(true);
            });

            it('locks the params (is_automation_params_locked) for a non-automatable symbol with no run', () => {
                tradeStore.symbol = NON_AUTOMATABLE;
                expect(tradeStore.is_automation_params_locked).toBe(true);
                // ...but the RUN-only lock stays false, so market/tab switching isn't blocked.
                expect(tradeStore.is_automation_market_locked).toBe(false);
            });

            it('does not lock params for a non-automatable symbol in manual mode', () => {
                tradeStore.setActiveTradePanelTab(TRADE_PANEL_TABS.TRADE);
                tradeStore.symbol = NON_AUTOMATABLE;
                expect(tradeStore.is_automation_params_locked).toBe(false);
            });

            it('is_automation_market_locked reflects only a live run', () => {
                tradeStore.symbol = NON_AUTOMATABLE;
                expect(tradeStore.is_automation_market_locked).toBe(false);
                setRunActive(true);
                expect(tradeStore.is_automation_market_locked).toBe(true);
            });
        });
    });

    describe('automation open-markets guard', () => {
        const rise_market: TOpenMarket = { symbol: 'R_100', contract_type: 'rise_fall' };
        const turbos_market: TOpenMarket = { symbol: 'R_100', contract_type: 'turboslong' };
        // Set the mode flags directly (not via setIsAutomationPage) so we exercise the guard in
        // isolation, without the reconcile-on-mode-switch cascade. `is_automation_mode` is
        // `is_mobile ? is_automation_page : is_automation_tab`.
        const setAutomationMode = (on: boolean) => {
            (tradeStore.root_store.ui as unknown as { is_mobile: boolean }).is_mobile = true;
            tradeStore.is_automation_page = on;
        };
        // setActiveOpenMarkets persists to localStorage — clear it so a written collection can't leak
        // into a later test's store construction.
        afterEach(() => {
            Object.values(OPEN_MARKETS_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        });

        it('setActiveOpenMarkets drops unsupported trade types once the supported set is known', () => {
            setAutomationMode(true);
            tradeStore.automation_supported_trade_types = new Set(['rise_fall']);
            tradeStore.setActiveOpenMarkets([rise_market, turbos_market]);
            expect(tradeStore.open_markets_automation).toEqual([rise_market]);
        });

        it('setActiveOpenMarkets passes through unfiltered while the supported set is empty (loading)', () => {
            setAutomationMode(true);
            tradeStore.automation_supported_trade_types = new Set();
            tradeStore.setActiveOpenMarkets([rise_market, turbos_market]);
            expect(tradeStore.open_markets_automation).toEqual([rise_market, turbos_market]);
        });

        it('matches on contract_type, not symbol (guards against a wrong-field regression)', () => {
            setAutomationMode(true);
            // Both tabs share a symbol; only the supported contract_type must survive.
            tradeStore.automation_supported_trade_types = new Set(['rise_fall']);
            tradeStore.setActiveOpenMarkets([turbos_market, rise_market]);
            expect(tradeStore.open_markets_automation).toEqual([rise_market]);
        });

        it('setAutomationSupportedTradeTypes flushes existing unsupported tabs in automation mode', () => {
            setAutomationMode(true);
            tradeStore.open_markets_automation = [rise_market, turbos_market];
            tradeStore.setAutomationSupportedTradeTypes(new Set(['rise_fall']));
            expect(tradeStore.open_markets_automation).toEqual([rise_market]);
        });

        it('setAutomationSupportedTradeTypes does not flush the strip outside automation mode', () => {
            setAutomationMode(false);
            tradeStore.open_markets_automation = [rise_market, turbos_market];
            tradeStore.setAutomationSupportedTradeTypes(new Set(['rise_fall']));
            expect(tradeStore.open_markets_automation).toEqual([rise_market, turbos_market]);
        });

        it('setAutomationSupportedTradeTypes is a no-op when the same Set reference is passed', () => {
            setAutomationMode(true);
            const set = new Set(['rise_fall']);
            tradeStore.automation_supported_trade_types = set;
            const spy = jest.spyOn(tradeStore, 'setActiveOpenMarkets');
            tradeStore.setAutomationSupportedTradeTypes(set);
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('market selection supersession (phantom-tab races)', () => {
        const flushAsync = () => new Promise(resolve => setTimeout(resolve, 0));

        beforeEach(() => {
            // Force manual mode (earlier tests persist 'active_trade_panel_tab' to localStorage,
            // which would silently point `open_markets` at the automation collection).
            (tradeStore.root_store.ui as unknown as { is_mobile: boolean }).is_mobile = false;
            tradeStore.is_automation_page = false;
            tradeStore.active_trade_panel_tab = TRADE_PANEL_TABS.TRADE;
            // The full validation pipeline needs prebuild DVRs unavailable in this harness; it's not
            // what these tests exercise.
            jest.spyOn(tradeStore, 'validateAllProperties').mockImplementation(() => undefined);
        });

        afterEach(() => {
            Object.values(OPEN_MARKETS_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
            localStorage.removeItem('active_trade_panel_tab');
        });

        it('a newer selectMarketAndTradeType supersedes an in-flight one (no stale trade-type write)', async () => {
            tradeStore.symbol = '1HZ100V';
            // First selection changes the symbol, so its trade-type write only happens after an
            // await; the second selection (same symbol, already written by the first's synchronous
            // prefix) commits its trade type immediately. Without epoch supersession the FIRST
            // cascade would resume afterwards and overwrite the newer choice with 'rise_fall'.
            const first = tradeStore.selectMarketAndTradeType('R_50', 'rise_fall');
            const second = tradeStore.selectMarketAndTradeType('R_50', 'multiplier');
            await Promise.all([first, second]);
            await flushAsync();
            expect(tradeStore.symbol).toBe('R_50');
            expect(tradeStore.contract_type).toBe('multiplier');
            // Both explicit intents are recorded as tabs — and nothing else.
            expect(tradeStore.open_markets).toEqual([
                { symbol: 'R_50', contract_type: 'rise_fall' },
                { symbol: 'R_50', contract_type: 'multiplier' },
            ]);
            // The guard is a counter: it must only release once BOTH cascades have settled.
            expect(tradeStore.is_selecting_market).toBe(false);
        });

        it('keeps the seed-effect guard up while any of two overlapping commits is still in flight', () => {
            tradeStore.startSelectingMarket();
            tradeStore.startSelectingMarket();
            tradeStore.stopSelectingMarket();
            // A boolean flag would already read false here and let the tab strip's seed effect
            // observe the second cascade's transient pair.
            expect(tradeStore.is_selecting_market).toBe(true);
            tradeStore.stopSelectingMarket();
            expect(tradeStore.is_selecting_market).toBe(false);
        });
    });

    describe('selectMarketAndTradeType replace-flow (already-open-market de-duplication, #1240)', () => {
        const gold_market = { symbol: 'GDAXI', contract_type: 'rise_fall' };
        const vol_market = { symbol: '1HZ100V', contract_type: 'rise_fall' };

        beforeEach(() => {
            // Force manual mode (see the supersession describe above for why).
            (tradeStore.root_store.ui as unknown as { is_mobile: boolean }).is_mobile = false;
            tradeStore.is_automation_page = false;
            tradeStore.active_trade_panel_tab = TRADE_PANEL_TABS.TRADE;
            jest.spyOn(tradeStore, 'validateAllProperties').mockImplementation(() => undefined);
            // Two tabs open; tab 2 (vol_market) is the active one about to be tapped.
            tradeStore.open_markets_manual = [gold_market, vol_market];
            tradeStore.symbol = vol_market.symbol;
            tradeStore.contract_type = vol_market.contract_type;
        });

        afterEach(() => {
            Object.values(OPEN_MARKETS_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
            localStorage.removeItem('active_trade_panel_tab');
        });

        it('keeps both tabs when the tap-to-replace target is already open as another tab', async () => {
            tradeStore.setReplacingMarket(vol_market); // tapped the active tab (tab 2)

            await tradeStore.selectMarketAndTradeType(gold_market.symbol, gold_market.contract_type);

            expect(tradeStore.open_markets).toHaveLength(2);
            expect(tradeStore.open_markets).toEqual(expect.arrayContaining([gold_market, vol_market]));
        });

        it('activates the pre-existing tab in place and clears the replace intent', async () => {
            tradeStore.setReplacingMarket(vol_market);

            await tradeStore.selectMarketAndTradeType(gold_market.symbol, gold_market.contract_type);

            expect(tradeStore.symbol).toBe(gold_market.symbol);
            expect(tradeStore.contract_type).toBe(gold_market.contract_type);
            expect(tradeStore.replacing_market).toBeNull();
        });

        it('preserves every other tab and its position, regardless of which tab was tapped', async () => {
            const jpy_market = { symbol: 'frxUSDJPY', contract_type: 'rise_fall' };
            tradeStore.open_markets_manual = [gold_market, jpy_market, vol_market];
            tradeStore.setReplacingMarket(vol_market);

            await tradeStore.selectMarketAndTradeType(gold_market.symbol, gold_market.contract_type);

            expect(tradeStore.open_markets).toHaveLength(3);
            expect(tradeStore.open_markets).toEqual([gold_market, jpy_market, vol_market]);
        });

        it('still swaps the tapped tab in place for a target that is not already open elsewhere', async () => {
            tradeStore.setReplacingMarket(vol_market);

            await tradeStore.selectMarketAndTradeType('R_50', 'multiplier');

            expect(tradeStore.open_markets).toEqual([gold_market, { symbol: 'R_50', contract_type: 'multiplier' }]);
            expect(tradeStore.symbol).toBe('R_50');
            expect(tradeStore.contract_type).toBe('multiplier');
        });

        it('a same-category sibling commit (Allow equals) still updates the tapped tab itself in place', async () => {
            tradeStore.setReplacingMarket(vol_market);

            await tradeStore.selectMarketAndTradeType(vol_market.symbol, 'rise_fall_equal');

            expect(tradeStore.open_markets).toEqual([
                gold_market,
                { symbol: vol_market.symbol, contract_type: 'rise_fall_equal' },
            ]);
        });

        it('a failed commit whose replace was skipped leaves the strip untouched', async () => {
            const { processTradeParams } = jest.requireMock('../Helpers/process');
            (processTradeParams as jest.Mock).mockRejectedValueOnce(new Error('socket dropped'));
            tradeStore.setReplacingMarket(vol_market);

            await expect(
                tradeStore.selectMarketAndTradeType(gold_market.symbol, gold_market.contract_type)
            ).rejects.toThrow('socket dropped');

            // Nothing was added, removed, or replaced — the strip is exactly as before the attempt.
            expect(tradeStore.open_markets).toEqual([gold_market, vol_market]);
        });

        it('a failed genuine in-place replace restores the tapped tab at its original position', async () => {
            const { processTradeParams } = jest.requireMock('../Helpers/process');
            (processTradeParams as jest.Mock).mockRejectedValueOnce(new Error('socket dropped'));
            tradeStore.setReplacingMarket(vol_market);

            await expect(tradeStore.selectMarketAndTradeType('R_50', 'multiplier')).rejects.toThrow('socket dropped');

            // The optimistic replace is reversed; the attempted new pair is not present.
            expect(tradeStore.open_markets).toEqual([gold_market, vol_market]);
        });
    });

    describe('resolveContractTypeAvailability', () => {
        const flushAsync = () => new Promise(resolve => setTimeout(resolve, 0));

        beforeEach(() => {
            // Force manual mode (see the supersession describe above for why).
            (tradeStore.root_store.ui as unknown as { is_mobile: boolean }).is_mobile = false;
            tradeStore.is_automation_page = false;
            tradeStore.active_trade_panel_tab = TRADE_PANEL_TABS.TRADE;
            jest.spyOn(tradeStore, 'validateAllProperties').mockImplementation(() => undefined);
            tradeStore.symbol = 'R_50';
            tradeStore.contract_type = 'multiplier';
        });

        afterEach(() => {
            Object.values(OPEN_MARKETS_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
            localStorage.removeItem('active_trade_panel_tab');
        });

        it('keeps the current type (and its tab) when the response offers it', () => {
            tradeStore.open_markets_manual = [{ symbol: 'R_50', contract_type: 'multiplier' }];
            tradeStore.resolveContractTypeAvailability('R_50', ['multiplier', 'rise_fall']);
            expect(tradeStore.contract_type).toBe('multiplier');
            expect(tradeStore.open_markets).toEqual([{ symbol: 'R_50', contract_type: 'multiplier' }]);
        });

        it('treats a same-category sibling as available (rise_fall_equal vs rise_fall)', () => {
            tradeStore.contract_type = 'rise_fall_equal';
            tradeStore.resolveContractTypeAvailability('R_50', ['rise_fall']);
            expect(tradeStore.contract_type).toBe('rise_fall_equal');
        });

        it('ignores a response for a symbol that is no longer active', () => {
            tradeStore.resolveContractTypeAvailability('1HZ100V', ['rise_fall']);
            expect(tradeStore.contract_type).toBe('multiplier');
        });

        it('swaps an unavailable type to the first available one and replaces the dead tab IN PLACE', async () => {
            tradeStore.open_markets_manual = [
                { symbol: '1HZ100V', contract_type: 'rise_fall' },
                { symbol: 'R_50', contract_type: 'multiplier' },
            ];
            tradeStore.resolveContractTypeAvailability('R_50', ['accumulator', 'high_low']);
            // The store write is synchronous (useContractsFor reads the corrected type right after).
            expect(tradeStore.contract_type).toBe('accumulator');
            // The dead (R_50, multiplier) tab is replaced in its position — never appended, so the
            // strip can't grow a phantom tab out of an availability correction.
            expect(tradeStore.open_markets).toEqual([
                { symbol: '1HZ100V', contract_type: 'rise_fall' },
                { symbol: 'R_50', contract_type: 'accumulator' },
            ]);
            await flushAsync();
            expect(tradeStore.is_selecting_market).toBe(false);
        });

        it('removes the dead tab instead of duplicating when a fallback-category tab already exists', async () => {
            tradeStore.open_markets_manual = [
                { symbol: 'R_50', contract_type: 'multiplier' },
                { symbol: 'R_50', contract_type: 'accumulator' },
            ];
            tradeStore.resolveContractTypeAvailability('R_50', ['accumulator']);
            expect(tradeStore.contract_type).toBe('accumulator');
            // Two tabs must never share a (symbol, trade-type category) pair.
            expect(tradeStore.open_markets).toEqual([{ symbol: 'R_50', contract_type: 'accumulator' }]);
            await flushAsync();
        });

        it('defers while a selection is committing, then re-evaluates against the settled state', async () => {
            tradeStore.startSelectingMarket();
            tradeStore.resolveContractTypeAvailability('R_50', ['rise_fall']);
            // Mid-commit: nothing may change — the in-flight selection owns the state.
            expect(tradeStore.contract_type).toBe('multiplier');
            // The in-flight selection commits a type the response DOES offer…
            tradeStore.contract_type = 'rise_fall';
            tradeStore.stopSelectingMarket();
            await flushAsync();
            // …so the deferred re-evaluation finds it available and leaves everything alone.
            expect(tradeStore.contract_type).toBe('rise_fall');
            expect(tradeStore.open_markets).toEqual([]);
        });
    });

    describe('automation_run_market', () => {
        const setRun = (is_active: boolean, contract_template: unknown, analytics: unknown = null) => {
            const root = tradeStore.root_store as unknown as { modules: { automation?: unknown } };
            root.modules = {
                ...root.modules,
                automation: {
                    is_active,
                    active_run: contract_template ? { contract_template } : null,
                    active_run_analytics: analytics,
                },
            };
        };

        it('returns the run market (symbol + app-format trade type) while a run is active', () => {
            setRun(true, { underlying_symbol: 'R_100', contract_type: 'CALL' }, { trade_type: 'rise_fall' });
            expect(tradeStore.automation_run_market).toEqual({ symbol: 'R_100', contract_type: 'rise_fall' });
        });

        it('has a null trade type for a recovered run (no analytics payload)', () => {
            setRun(true, { underlying_symbol: 'R_100', contract_type: 'CALL' }, null);
            expect(tradeStore.automation_run_market).toEqual({ symbol: 'R_100', contract_type: null });
        });

        it('is null when no run is active', () => {
            setRun(false, { underlying_symbol: 'R_100', contract_type: 'CALL' }, { trade_type: 'rise_fall' });
            expect(tradeStore.automation_run_market).toBeNull();
        });

        it('is null when the active run has no contract template', () => {
            setRun(true, null, { trade_type: 'rise_fall' });
            expect(tradeStore.automation_run_market).toBeNull();
        });
    });
});
