import { configure } from 'mobx';

import { TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';

import { TRootStore } from 'Types';

import { ContractType } from '../Helpers/contract-type';
import TradeStore from '../trade-store';

configure({ safeDescriptors: false });

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

// Mock shared utilities
jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    pickDefaultSymbol: jest.fn(() => Promise.resolve('1HZ100V')),
    isMarketClosed: jest.fn(() => false),
    WS: {
        authorized: {
            activeSymbols: () => Promise.resolve({ active_symbols: [] }),
        },
        contractsFor: () => Promise.resolve({ contracts_for: { available: [], non_available: [] } }),
        storage: {
            contractsFor: () => Promise.resolve({ contracts_for: { available: [], non_available: [] } }),
        },
        subscribeProposal: jest.fn(),
        forgetAll: jest.fn(),
        wait: jest.fn(() => Promise.resolve({})),
    },
}));

// Mock process helpers
jest.mock('../Helpers/process', () => ({
    processContractsForApi: jest.fn(() => Promise.resolve()),
    processPurchase: jest.fn(() => Promise.resolve()),
    processProposal: jest.fn(() => Promise.resolve()),
    processTradeParams: jest.fn(() => Promise.resolve()),
}));

describe('TradeStore - Barrier Reset on Symbol Change', () => {
    let trade_store: TradeStore, mockRootStore: TRootStore;

    beforeEach(() => {
        jest.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);

        mockRootStore = mockStore({
            ui: {
                is_mobile: true,
                advanced_expiry_type: 'duration',
                simple_duration_unit: 'm',
                advanced_duration_unit: 'm',
                is_advanced_duration: false,
            },
            client: {
                currency: 'USD',
                default_currency: 'USD',
                is_logged_in: false,
                is_logging_in: false,
            },
            common: {
                current_language: 'en',
                showError: jest.fn(),
                setSelectedContractType: jest.fn(),
            },
            portfolio: {
                setContractType: jest.fn(),
                barriers: [],
            },
            notifications: {
                removeTradeNotifications: jest.fn(),
            },
            contract_trade: {
                clearAccumulatorBarriersData: jest.fn(),
            },
            active_symbols: {
                setActiveSymbols: jest.fn(),
            },
        }) as unknown as TRootStore;

        trade_store = new TradeStore({ root_store: mockRootStore });

        // Mock active symbols with forex and synthetic symbols
        trade_store.active_symbols = [
            {
                symbol: 'EURUSD',
                underlying_symbol: 'EURUSD',
                display_name: 'EUR/USD',
                market: 'forex',
                underlying_symbol_type: 'forex',
                exchange_is_open: 1,
            },
            {
                symbol: '1HZ100V',
                underlying_symbol: '1HZ100V',
                display_name: 'Volatility 100 (1s) Index',
                market: 'synthetic_index',
                underlying_symbol_type: 'synthetic_index',
                exchange_is_open: 1,
            },
        ] as any;

        // Set up initial state using actions to avoid MobX warnings
        trade_store.updateStore({ symbol: '1HZ100V', barrier_1: '+1.17' });
    });

    describe('getSymbolBarrierSupport', () => {
        it('should return "absolute" for forex symbols', () => {
            const result = trade_store.getSymbolBarrierSupport('EURUSD');
            expect(result).toBe('absolute');
        });

        it('should return "relative" for synthetic symbols', () => {
            const result = trade_store.getSymbolBarrierSupport('1HZ100V');
            expect(result).toBe('relative');
        });

        it('should return "relative" for symbols it cannot resolve yet', () => {
            // The barrier field renders before active_symbols arrives, and most barrier symbols
            // are synthetics, so an unresolved symbol reports relative rather than flashing a
            // fixed-price field that then switches.
            expect(trade_store.getSymbolBarrierSupport('UNKNOWN')).toBe('relative');
        });

        it('should be accessible as public method for component usage', () => {
            // Test that the method is now public and accessible from components
            expect(typeof trade_store.getSymbolBarrierSupport).toBe('function');

            // Test that it works correctly when called from external components
            expect(trade_store.getSymbolBarrierSupport('EURUSD')).toBe('absolute');
            expect(trade_store.getSymbolBarrierSupport('1HZ100V')).toBe('relative');
            expect(trade_store.getSymbolBarrierSupport('')).toBe('relative');
        });
    });

    describe('getBarrierSupportFromApiDefault', () => {
        beforeEach(() => {
            // Populate contracts_for-derived config for a few contract types + expiry_types,
            // mirroring what `contracts_for` returns per contract type/duration.
            ContractType.processContractsForResponse(
                {
                    contracts_for: {
                        available: [
                            {
                                contract_type: 'ONETOUCH',
                                barriers: 1,
                                expiry_type: 'tick',
                                barrier: '+39.37',
                                min_contract_duration: '5t',
                                max_contract_duration: '10t',
                            },
                            {
                                contract_type: 'NOTOUCH',
                                barriers: 1,
                                expiry_type: 'tick',
                                barrier: '+39.37',
                                min_contract_duration: '5t',
                                max_contract_duration: '10t',
                            },
                            {
                                contract_type: 'TURBOSLONG',
                                barriers: 1,
                                expiry_type: 'tick',
                                barrier: '963.4521',
                                min_contract_duration: '5t',
                                max_contract_duration: '10t',
                            },
                            {
                                contract_type: 'TURBOSSHORT',
                                barriers: 1,
                                expiry_type: 'tick',
                                barrier: '963.4521',
                                min_contract_duration: '5t',
                                max_contract_duration: '10t',
                            },
                            {
                                contract_type: 'HIGHER',
                                barriers: 1,
                                expiry_type: 'intraday',
                                barrier: '1.23450',
                                min_contract_duration: '1m',
                                max_contract_duration: '1d',
                            },
                            {
                                contract_type: 'LOWER',
                                barriers: 1,
                                expiry_type: 'intraday',
                                barrier: '1.23450',
                                min_contract_duration: '1m',
                                max_contract_duration: '1d',
                            },
                        ],
                        non_available: [],
                    },
                } as any,
                '1HZ50V'
            );
        });

        it('derives relative support for Touch/No Touch from a tick default barrier of +39.37', () => {
            trade_store.updateStore({ symbol: '1HZ50V', contract_type: TRADE_TYPES.TOUCH });
            // contract_expiry_type is derived from the selection now, so name the bucket explicitly.
            expect(trade_store.getBarrierSupportFromApiDefault(TRADE_TYPES.TOUCH, 'tick')).toBe('relative');
        });

        it('derives absolute support for Turbos from a bare-number tick default barrier', () => {
            trade_store.updateStore({ symbol: '1HZ50V', contract_type: TRADE_TYPES.TURBOS.LONG });
            expect(trade_store.getBarrierSupportFromApiDefault(TRADE_TYPES.TURBOS.LONG, 'tick')).toBe('absolute');
        });

        it('derives absolute support for a forex barrier contract from the default-barrier sign', () => {
            trade_store.updateStore({ symbol: '1HZ50V', contract_type: TRADE_TYPES.HIGH_LOW });
            expect(trade_store.getBarrierSupportFromApiDefault(TRADE_TYPES.HIGH_LOW, 'intraday')).toBe('absolute');
        });

        it('returns null when no API default barrier is available for the contract type + expiry_type', () => {
            trade_store.updateStore({ contract_type: TRADE_TYPES.TOUCH });
            expect(trade_store.getBarrierSupportFromApiDefault(TRADE_TYPES.TOUCH, 'daily')).toBeNull();
        });
    });

    describe('getSymbolDurationSupport', () => {
        it('should return "endtime" for forex symbols', () => {
            const result = (trade_store as any).getSymbolDurationSupport('EURUSD');
            expect(result).toBe('endtime');
        });

        it('should return "ticks" for synthetic symbols', () => {
            const result = (trade_store as any).getSymbolDurationSupport('1HZ100V');
            expect(result).toBe('ticks');
        });

        it('should return "endtime" for unknown symbols', () => {
            const result = (trade_store as any).getSymbolDurationSupport('UNKNOWN');
            expect(result).toBe('endtime');
        });
    });

    describe('handleTradeParamsResetOnSymbolChange', () => {
        it('should reset barriers when switching from synthetic to forex', () => {
            const result = trade_store.handleTradeParamsResetOnSymbolChange('1HZ100V', 'EURUSD');

            // Should return barrier and duration reset values for forex
            expect(result).toEqual({
                barrier_1: '1.0000', // Default when no tick data available
                barrier_2: '',
            });

            // Should clear localStorage
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_spot_barrier_value');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_fixed_barrier_value');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_barrier_type_selection');
        });

        it('should reset barriers with spot-based value when tick data is available', () => {
            // Set up tick data
            trade_store.setTickData({ quote: 1.2345, pip_size: 5 });

            const result = trade_store.handleTradeParamsResetOnSymbolChange('1HZ100V', 'EURUSD');

            // Should return barrier and duration reset values with spot-based barrier
            expect(result).toEqual({
                barrier_1: '1.23460', // spot + pip_size increment
                barrier_2: '',
            });
        });

        it("seeds the barrier from the INCOMING symbol's contracts_for, not the outgoing one", () => {
            // The reset runs before `this.symbol` is updated, so defaulting the lookup to
            // `this.symbol` read the market being left. With two tabs open the incoming symbol's
            // contracts_for is already cached, so its own default barrier is available.
            ContractType.processContractsForResponse(
                {
                    contracts_for: {
                        available: [
                            {
                                barrier: '+39.37', // synthetics use relative barriers
                                barriers: 1,
                                contract_category: 'touchnotouch',
                                contract_type: 'ONETOUCH',
                                expiry_type: 'daily',
                                max_contract_duration: '365d',
                                min_contract_duration: '1d',
                                sentiment: 'high_vol',
                                underlying_symbol: '1HZ100V',
                            },
                        ],
                        non_available: [],
                    },
                } as never,
                '1HZ100V'
            );
            trade_store.updateStore({ contract_type: TRADE_TYPES.TOUCH, duration_unit: 'd', expiry_type: 'duration' });

            const result = trade_store.handleTradeParamsResetOnSymbolChange('EURUSD', '1HZ100V');

            expect(result?.barrier_1).toBe('+39.37');
        });

        it('writes no duration or expiry values, because it cannot know them yet', () => {
            const result = trade_store.handleTradeParamsResetOnSymbolChange('EURUSD', '1HZ100V');

            expect(result).not.toHaveProperty('duration');
            expect(result).not.toHaveProperty('duration_unit');
            expect(result).not.toHaveProperty('expiry_type');
            // Critically the seeded expiry survives: wiping it left daily-only contracts pricing by
            // duration with no date_expiry. onChangeExpiry re-derives the time for the new symbol.
            expect(result).not.toHaveProperty('expiry_date');
            expect(result).not.toHaveProperty('expiry_time');
        });

        it('should reset barriers when switching from forex to synthetic', () => {
            const result = trade_store.handleTradeParamsResetOnSymbolChange('EURUSD', '1HZ100V');

            expect(result).toEqual({
                barrier_1: '+0.1',
                barrier_2: '',
            });

            // Should clear localStorage
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_spot_barrier_value');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_fixed_barrier_value');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_barrier_type_selection');
        });

        it('should not reset barriers when switching between symbols with same barrier support', () => {
            // Add another synthetic symbol to active_symbols for this test
            trade_store.active_symbols.push({
                symbol: '1HZ200V',
                underlying_symbol: '1HZ200V',
                display_name: 'Volatility 200 (1s) Index',
                market: 'synthetic_index',
                underlying_symbol_type: 'synthetic_index',
                exchange_is_open: 1,
            } as any);

            const result = trade_store.handleTradeParamsResetOnSymbolChange('1HZ100V', '1HZ200V');

            expect(result).toBeNull();
            expect(localStorageMock.removeItem).not.toHaveBeenCalled();
        });

        it('should return null for same symbol', () => {
            const result = trade_store.handleTradeParamsResetOnSymbolChange('EURUSD', 'EURUSD');

            expect(result).toBeNull();
            expect(localStorageMock.removeItem).not.toHaveBeenCalled();
        });

        it('should return null for empty symbols', () => {
            const result = trade_store.handleTradeParamsResetOnSymbolChange('', 'EURUSD');

            expect(result).toBeNull();
            expect(localStorageMock.removeItem).not.toHaveBeenCalled();
        });

        // The UI-store duration-unit writes were removed with the rest of the market-name guessing:
        // 'forex -> minutes' is wrong for a daily-only pair, they were written before contracts_for
        // was known, and nothing in the monorepo reads advanced_duration_unit / simple_duration_unit.
        it('should clear all localStorage keys when switching markets', () => {
            trade_store.handleTradeParamsResetOnSymbolChange('1HZ100V', 'EURUSD');

            // Should clear all barrier-related localStorage keys
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_spot_barrier_value');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_fixed_barrier_value');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_barrier_type_selection');

            // Verify that localStorage.removeItem was called multiple times (for all the keys)
            expect(localStorageMock.removeItem).toHaveBeenCalledTimes(11);
        });
    });

    describe('processNewValuesAsync integration', () => {
        it('should apply barrier reset when symbol changes in processNewValuesAsync (mobile)', async () => {
            // Set up initial state with synthetic symbol and relative barrier using actions
            trade_store.updateStore({ symbol: '1HZ100V', barrier_1: '+1.17' });

            // Mock the is_dtrader_v2 getter to return true by modifying the root store
            mockRootStore.ui.is_mobile = true;

            // Spy on the barrier reset method
            const handleTradeParamsResetSpy = jest.spyOn(trade_store, 'handleTradeParamsResetOnSymbolChange');

            // Process symbol change to forex
            await trade_store.processNewValuesAsync({ symbol: 'EURUSD' }, true);

            // Should have called the barrier reset method
            expect(handleTradeParamsResetSpy).toHaveBeenCalledWith('1HZ100V', 'EURUSD');

            // Should have cleared localStorage
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_spot_barrier_value');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_fixed_barrier_value');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_barrier_type_selection');
        });

        it('should apply barrier and duration reset when symbol changes on desktop (non-V2)', async () => {
            // Set up initial state with synthetic symbol and tick-based duration
            trade_store.updateStore({
                symbol: '1HZ100V',
                barrier_1: '+1.17',
                duration: 25,
                duration_unit: 's',
            });

            // Set is_mobile to false to simulate desktop
            mockRootStore.ui.is_mobile = false;

            // Spy on the reset method
            const handleTradeParamsResetSpy = jest.spyOn(trade_store, 'handleTradeParamsResetOnSymbolChange');

            // Process symbol change to forex
            await trade_store.processNewValuesAsync({ symbol: 'EURUSD' }, true);

            // Should have called the reset method even on desktop
            expect(handleTradeParamsResetSpy).toHaveBeenCalledWith('1HZ100V', 'EURUSD');

            // Should have cleared localStorage for both duration and barrier keys
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_duration');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_duration_unit');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_spot_barrier_value');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_fixed_barrier_value');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('deriv_barrier_type_selection');
        });
    });
});
