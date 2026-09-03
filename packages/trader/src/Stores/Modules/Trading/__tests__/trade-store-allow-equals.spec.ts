import { configure } from 'mobx';

import { dayjs, TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';

import { OPEN_MARKETS_STORAGE_KEYS } from 'AppV2/Utils/open-markets-utils';
import { TRootStore } from 'Types';

import { ContractType } from '../Helpers/contract-type';
import TradeStore from '../trade-store';

configure({ safeDescriptors: false });

jest.mock('_common/base/server_time', () => {
    const actualDayjs = jest.requireActual('dayjs');
    return {
        get: () => actualDayjs('2024-02-26T11:59:59.488Z'),
        timePromise: () => Promise.resolve(actualDayjs('2024-02-26T11:59:59.488Z')),
    };
});

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    pickDefaultSymbol: jest.fn(() => Promise.resolve('1HZ100V')),
    isMarketClosed: jest.fn(() => false),
    findSymbolForTradeType: jest.fn(() => Promise.resolve('')),
    WS: {
        authorized: { activeSymbols: () => Promise.resolve({ active_symbols: [] }) },
        subscribeProposal: jest.fn(),
        forgetAll: jest.fn(() => Promise.resolve({})),
        wait: jest.fn(() => Promise.resolve({})),
        setOnReconnect: jest.fn(),
        removeOnReconnect: jest.fn(),
    },
}));

const SYMBOL = '1HZ100V';
const rise_fall_tab = { symbol: SYMBOL, contract_type: TRADE_TYPES.RISE_FALL };

/** contracts_for rows for Rise/Fall (CALL/PUT) and its Allow-equals variant (CALLE/PUTE). */
const buildRows = (expiry_type: string, min: string, max: string, types: string[]) =>
    types.map(contract_type => ({
        contract_type,
        contract_category: contract_type.endsWith('E') ? 'callputequal' : 'callput',
        barriers: 0,
        barrier: '',
        expiry_type,
        start_type: 'spot',
        min_contract_duration: min,
        max_contract_duration: max,
        default_stake: 10,
    }));

const seedContractsFor = (available: ReturnType<typeof buildRows>) => {
    ContractType.processContractsForResponse(
        {
            contracts_for: { available, non_available: [] },
        } as unknown as Parameters<typeof ContractType.processContractsForResponse>[0],
        SYMBOL
    );
};

/** Toggling Allow equals reprices the same tab as `rise_fall_equal` — it is not a trade-type
 * switch, and the user's duration/expiry selections must survive the flip in both directions,
 * even when the equals variant's published durations differ from Rise/Fall's own. */
describe('Allow equals keeps the trade parameters', () => {
    let root_store: TRootStore;

    const flushPromises = async () => {
        const { setTimeout: realSetTimeout } = jest.requireActual<typeof import('timers')>('timers');
        for (let i = 0; i < 12; i++) {
            // eslint-disable-next-line no-await-in-loop -- rounds must run sequentially by design
            await new Promise(resolve => realSetTimeout(resolve, 0));
        }
    };

    beforeEach(() => {
        root_store = mockStore({
            common: {
                server_time: dayjs('2024-02-26T11:59:59.488Z'),
                setSelectedContractType: jest.fn(),
                setServicesError: jest.fn(),
                showError: jest.fn(),
            },
            client: { currency: 'USD', default_currency: 'USD', is_logging_in: false },
            ui: { is_mobile: false, is_advanced_duration: false, toggleUrlUnavailableModal: jest.fn() },
            contract_trade: {
                chart_type: 'mountain',
                granularity: 0,
                updateChartType: jest.fn(),
                updateGranularity: jest.fn(),
                savePreviousChartMode: jest.fn(),
                clearAccumulatorBarriersData: jest.fn(),
            },
            portfolio: { setContractType: jest.fn() },
            notifications: { removeTradeNotifications: jest.fn(), setShouldShowPopups: jest.fn() },
        }) as unknown as TRootStore;
        window.history.pushState({}, '', '/');
        sessionStorage.clear();
        localStorage.removeItem('trade_store');
        sessionStorage.setItem(OPEN_MARKETS_STORAGE_KEYS.manual, JSON.stringify([rise_fall_tab]));
        sessionStorage.setItem('trade_store', JSON.stringify(rise_fall_tab));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        window.history.pushState({}, '', '/');
        sessionStorage.clear();
        localStorage.removeItem('trade_store');
    });

    const buildStore = async () => {
        const store = new TradeStore({ root_store });
        store.currency = 'USD';
        store.default_stake = 10;
        store.setActiveSymbolsV2([{ underlying_symbol: SYMBOL, exchange_is_open: 1 }] as never);
        jest.spyOn(store, 'validateAllProperties').mockImplementation(() => undefined);
        jest.spyOn(store, 'validateProperty').mockImplementation(() => undefined);
        await flushPromises();
        await store.processContractsForV2();
        await flushPromises();
        return store;
    };

    it('keeps the duration across an on/off toggle when both variants offer the same durations', async () => {
        seedContractsFor([
            ...buildRows('tick', '1t', '10t', ['CALL', 'PUT']),
            ...buildRows('intraday', '1m', '1d', ['CALL', 'PUT']),
            ...buildRows('tick', '1t', '10t', ['CALLE', 'PUTE']),
            ...buildRows('intraday', '1m', '1d', ['CALLE', 'PUTE']),
        ]);
        const store = await buildStore();

        await store.onChange({ target: { name: 'duration_unit', value: 'm' } } as never);
        await store.onChange({ target: { name: 'duration', value: 3 } } as never);
        await flushPromises();

        await store.onChange({ target: { name: 'is_equal', value: 1 } } as never);
        await flushPromises();

        expect(store.contract_type).toBe(TRADE_TYPES.RISE_FALL_EQUAL);
        expect(store.duration).toBe(3);
        expect(store.duration_unit).toBe('m');

        await store.onChange({ target: { name: 'is_equal', value: 0 } } as never);
        await flushPromises();

        expect(store.contract_type).toBe(TRADE_TYPES.RISE_FALL);
        expect(store.duration).toBe(3);
        expect(store.duration_unit).toBe('m');
    });

    it('keeps a tick duration even when the equals variant publishes no tick durations', async () => {
        // The asymmetric offering that made the toggle rewrite the unit: getDurationUnit's
        // fallback turned 8 ticks into "8 minutes" because CALLE/PUTE list no tick durations.
        seedContractsFor([
            ...buildRows('tick', '1t', '10t', ['CALL', 'PUT']),
            ...buildRows('intraday', '1m', '1d', ['CALL', 'PUT']),
            ...buildRows('intraday', '2m', '1d', ['CALLE', 'PUTE']),
        ]);
        const store = await buildStore();

        await store.onChange({ target: { name: 'duration', value: 8 } } as never);
        await flushPromises();
        expect(store.duration_unit).toBe('t');

        await store.onChange({ target: { name: 'is_equal', value: 1 } } as never);
        await flushPromises();

        expect(store.contract_type).toBe(TRADE_TYPES.RISE_FALL_EQUAL);
        expect(store.duration).toBe(8);
        expect(store.duration_unit).toBe('t');
    });

    it('keeps an End Time selection across the toggle', async () => {
        seedContractsFor([
            ...buildRows('tick', '1t', '10t', ['CALL', 'PUT']),
            ...buildRows('intraday', '1m', '1d', ['CALL', 'PUT']),
            ...buildRows('tick', '1t', '10t', ['CALLE', 'PUTE']),
            ...buildRows('intraday', '1m', '1d', ['CALLE', 'PUTE']),
        ]);
        jest.spyOn(ContractType, 'getTradingTimes').mockResolvedValue({
            open: ['00:00:00'],
            close: ['23:59:59'],
        } as never);
        const store = await buildStore();

        await store.onChange({ target: { name: 'expiry_type', value: 'endtime' } } as never);
        await store.onChange({ target: { name: 'expiry_date', value: '2024-02-27' } } as never);
        await store.onChange({ target: { name: 'expiry_time', value: '23:59' } } as never);
        await flushPromises();

        await store.onChange({ target: { name: 'is_equal', value: 1 } } as never);
        await flushPromises();

        expect(store.contract_type).toBe(TRADE_TYPES.RISE_FALL_EQUAL);
        expect(store.expiry_type).toBe('endtime');
        expect(store.expiry_date).toBe('2024-02-27');
        expect(store.expiry_time).toBe('23:59:59');
    });
});
