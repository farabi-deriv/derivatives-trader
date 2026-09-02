import { configure, runInAction } from 'mobx';

import { mockStore } from '@deriv/stores';

import { TRootStore } from 'Types';

import { ContractType } from '../Helpers/contract-type';
import TradeStore from '../trade-store';

configure({ safeDescriptors: false });

const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    pickDefaultSymbol: jest.fn(() => Promise.resolve('1HZ50V')),
    isMarketClosed: jest.fn(() => false),
    WS: {
        authorized: { activeSymbols: () => Promise.resolve({ active_symbols: [] }) },
        contractsFor: () => Promise.resolve({ contracts_for: { available: [] } }),
        storage: { contractsFor: () => Promise.resolve({ contracts_for: { available: [] } }) },
        subscribeProposal: jest.fn(),
        forgetAll: jest.fn(),
        wait: jest.fn(() => Promise.resolve({})),
    },
}));

jest.mock('../Helpers/process', () => ({
    processContractsForApi: jest.fn(() => Promise.resolve()),
    processPurchase: jest.fn(() => Promise.resolve()),
    processProposal: jest.fn(() => Promise.resolve()),
    processTradeParams: jest.fn(() => Promise.resolve()),
}));

/**
 * The default barriers `contracts_for` returns for 1HZ50V, keyed by expiry_type exactly as
 * `buildBarriersConfig` stores them. `touchnotouch` is relative on tick/intraday and absolute on
 * daily; `turbos` is absolute at every expiry_type — the case that rules out a blanket
 * "ticks are always relative" rule.
 */
const CONTRACTS_FOR_BARRIERS = {
    touch: {
        config: {
            barriers: {
                count: 1,
                tick: { barrier: '+39.37' },
                intraday: { barrier: '+193.02' },
                daily: { barrier: '240225.42' },
            },
        },
    },
    turbos: {
        config: {
            barriers: {
                count: 1,
                tick: { barrier: '8993.83' },
                intraday: { barrier: '8993.83' },
                daily: { barrier: '8993.83' },
            },
        },
    },
};

// Pinned so the end-time comparisons below ('today' vs 'after today') are deterministic.
const SERVER_TIME = '2026-08-17T12:00:00Z' as never;
const TODAY = '2026-08-17';
const AFTER_TODAY = '2026-08-20';

describe('TradeStore - barrier support derived from the API default barrier', () => {
    let trade_store: TradeStore;

    beforeEach(() => {
        jest.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);

        const root_store = mockStore({
            ui: { is_mobile: true },
            client: { currency: 'USD', default_currency: 'USD' },
            common: {
                current_language: 'en',
                showError: jest.fn(),
                setSelectedContractType: jest.fn(),
                server_time: SERVER_TIME,
            },
            portfolio: { setContractType: jest.fn(), barriers: [] },
            notifications: { removeTradeNotifications: jest.fn() },
            contract_trade: { clearAccumulatorBarriersData: jest.fn() },
            active_symbols: { setActiveSymbols: jest.fn() },
        }) as unknown as TRootStore;

        trade_store = new TradeStore({ root_store });
        trade_store.active_symbols = [
            {
                symbol: '1HZ50V',
                underlying_symbol: '1HZ50V',
                display_name: 'Volatility 50 (1s) Index',
                market: 'synthetic_index',
            },
        ] as never;

        jest.spyOn(ContractType, 'getFullContractTypes').mockReturnValue(CONTRACTS_FOR_BARRIERS as never);
    });

    const selectTrade = ({
        contract_type,
        duration_unit,
        expiry_type = 'duration',
        expiry_date = null,
        duration_units_list,
    }: {
        contract_type: string;
        duration_unit: string;
        expiry_type?: string;
        expiry_date?: string | null;
        duration_units_list?: string[];
    }) =>
        runInAction(() => {
            trade_store.symbol = '1HZ50V';
            trade_store.contract_type = contract_type;
            trade_store.duration_units_list = (duration_units_list ?? [duration_unit]).map(value => ({
                text: value,
                value,
            })) as never;
            trade_store.duration_unit = duration_unit;
            trade_store.expiry_type = expiry_type;
            trade_store.expiry_date = expiry_date;
        });

    it('is relative on a tick duration, where the API default barrier is a signed offset', () => {
        selectTrade({ contract_type: 'touch', duration_unit: 't' });

        expect(trade_store.getSymbolBarrierSupport('1HZ50V')).toBe('relative');
    });

    it('is relative on an intraday duration', () => {
        selectTrade({ contract_type: 'touch', duration_unit: 'm' });

        expect(trade_store.getSymbolBarrierSupport('1HZ50V')).toBe('relative');
    });

    it('is absolute on a days duration, where the API default barrier is a bare price', () => {
        // Regression guard: `contract_expiry_type` is overwritten by a reaction that only ever
        // writes 'tick'/'intraday', so resolving the barrier against it reported 'relative' here
        // and offered a +/- offset control where an absolute price is required.
        selectTrade({ contract_type: 'touch', duration_unit: 'd' });

        expect(trade_store.getSymbolBarrierSupport('1HZ50V')).toBe('absolute');
    });

    it('is absolute for Turbos even on a tick duration', () => {
        // Turbos returns an absolute barrier at every expiry_type, so a blanket
        // "hide the fixed barrier on ticks" rule would be wrong.
        selectTrade({ contract_type: 'turbos', duration_unit: 't' });

        expect(trade_store.getSymbolBarrierSupport('1HZ50V')).toBe('absolute');
    });

    it('falls back to the market heuristic when contracts_for has no entry for the contract type', () => {
        jest.spyOn(ContractType, 'getFullContractTypes').mockReturnValue({} as never);
        selectTrade({ contract_type: 'touch', duration_unit: 't' });

        // synthetic_index -> relative
        expect(trade_store.getSymbolBarrierSupport('1HZ50V')).toBe('relative');
    });
    describe('barrier re-seed when the expiry type changes', () => {
        // Crossing an expiry boundary changes which default barrier applies — and on
        // intraday -> daily it also flips relative to absolute. The value has to follow, or the
        // field keeps an offset like +193.02 where an absolute price is now required.
        beforeEach(() => {
            jest.spyOn(ContractType, 'getBarriers').mockImplementation(
                (_symbol: string | null, _contract_type: string, expiry_type: string) =>
                    ({
                        barrier_count: 1,
                        barrier_1: { tick: '+39.37', intraday: '+193.02', daily: '240225.42' }[expiry_type] ?? '',
                        barrier_2: '',
                    }) as never
            );
        });

        it('re-seeds the barrier for each expiry type the duration moves through', () => {
            // Establish a starting expiry type; the very first resolve is seeded by the pipeline,
            // so the transitions below are what this covers.
            selectTrade({ contract_type: 'touch', duration_unit: 'm' });
            runInAction(() => {
                trade_store.barrier_1 = '+193.02';
            });
            expect(trade_store.contract_expiry_type).toBe('intraday');

            // intraday -> daily also flips relative to absolute.
            selectTrade({ contract_type: 'touch', duration_unit: 'd' });
            expect(trade_store.contract_expiry_type).toBe('daily');
            expect(trade_store.barrier_1).toBe('240225.42');

            selectTrade({ contract_type: 'touch', duration_unit: 't' });
            expect(trade_store.contract_expiry_type).toBe('tick');
            expect(trade_store.barrier_1).toBe('+39.37');

            selectTrade({ contract_type: 'touch', duration_unit: 'm' });
            expect(trade_store.contract_expiry_type).toBe('intraday');
            expect(trade_store.barrier_1).toBe('+193.02');
        });

        it('leaves the existing barrier alone when the new expiry type offers none', () => {
            selectTrade({ contract_type: 'touch', duration_unit: 'm' });
            runInAction(() => {
                trade_store.barrier_1 = '+193.02';
            });

            // A daily-only contract reached via an intraday duration has no barrier configured for
            // the new expiry type; blanking the field would be worse than keeping the value.
            jest.spyOn(ContractType, 'getBarriers').mockReturnValue({
                barrier_count: 0,
                barrier_1: '',
                barrier_2: '',
            } as never);

            selectTrade({ contract_type: 'touch', duration_unit: 'd' });

            expect(trade_store.contract_expiry_type).toBe('daily');
            expect(trade_store.barrier_1).toBe('+193.02');
        });
    });

    describe('End time', () => {
        // The old rule forced an absolute barrier for *any* end time
        // (`duration_unit === 'd' || expiry_type === 'endtime'`). That was wrong for a same-day
        // end time, which is an intraday contract and therefore takes a relative offset. These
        // pin the corrected split so the blanket rule is not reinstated as a "fix".
        it('is relative for an end time today on a contract with intraday durations', () => {
            selectTrade({
                contract_type: 'touch',
                duration_unit: 'm',
                expiry_type: 'endtime',
                expiry_date: TODAY,
                duration_units_list: ['m', 'h'],
            });

            expect(trade_store.contract_expiry_type).toBe('intraday');
            expect(trade_store.getSymbolBarrierSupport('1HZ50V')).toBe('relative');
        });

        it('is absolute for an end time after today', () => {
            selectTrade({
                contract_type: 'touch',
                duration_unit: 'm',
                expiry_type: 'endtime',
                expiry_date: AFTER_TODAY,
                duration_units_list: ['m', 'h'],
            });

            expect(trade_store.contract_expiry_type).toBe('daily');
            expect(trade_store.getSymbolBarrierSupport('1HZ50V')).toBe('absolute');
        });
    });
});
