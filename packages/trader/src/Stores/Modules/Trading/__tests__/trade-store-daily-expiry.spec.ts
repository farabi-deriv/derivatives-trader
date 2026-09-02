import { configure } from 'mobx';

import { convertToUnix, dayjs, WS } from '@deriv/shared';
import { mockStore } from '@deriv/stores';

import { TRootStore } from 'Types';

import { createProposalRequests } from '../Helpers/proposal';
import TradeStore from '../trade-store';

// Trade-store.spec.ts mocks `../Helpers/contract-type` and `../Helpers/process` wholesale, which
// would also stub out the real StartDate.onChangeExpiry -> ContractType.getExpiryTime chain this
// suite exercises. Kept as a separate file so that global mocking doesn't have to be reconciled
// between the two specs.
configure({ safeDescriptors: false });

const FIXED_NOW = '2024-02-28T10:00:00.000Z'; // Wednesday
const DAILY_ONLY_UNITS = [{ value: 'd', text: 'days' }];
const DAILY_MIN_MAX = { daily: { min: 86400, max: 31536000 } };

jest.mock('_common/base/server_time', () => {
    const actualDayjs = jest.requireActual('dayjs');
    return {
        get: () => actualDayjs('2024-02-28T10:00:00.000Z'),
        timePromise: () => Promise.resolve(actualDayjs('2024-02-28T10:00:00.000Z')),
    };
});

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    pickDefaultSymbol: jest.fn(() => Promise.resolve('frxUSDJPY')),
    isMarketClosed: jest.fn(() => false),
    findSymbolForTradeType: jest.fn(() => Promise.resolve('')),
    WS: {
        authorized: {
            activeSymbols: () => Promise.resolve({ active_symbols: [] }),
        },
        contractsFor: () => Promise.resolve({ contracts_for: { available: [], non_available: [] } }),
        storage: {
            contractsFor: () => Promise.resolve({ contracts_for: { available: [], non_available: [] } }),
        },
        // Every candidate date is a trading day at 23:59:59 close — the Friday-skip path is
        // covered at the ContractType.getNextTradingDayDate level (contract-type.spec.ts).
        tradingTimes: jest.fn((date: string) =>
            Promise.resolve({
                trading_times: {
                    markets: [
                        {
                            name: 'Forex',
                            submarkets: [
                                {
                                    name: 'Major Pairs',
                                    symbols: [
                                        {
                                            underlying_symbol: 'frxUSDJPY',
                                            times: { open: ['00:00:00'], close: ['23:59:59'] },
                                            trading_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                echo_req: { trading_times: date },
            })
        ),
        subscribeProposal: jest.fn(),
        forgetAll: jest.fn(),
        wait: jest.fn(() => Promise.resolve({})),
    },
}));

// Keep the real date/time derivation (getNextTradingDayDate, getTradingTimes, getExpiryTime,
// getExpiryDate, getExpiryType, getSessions, getStartTime) — that's what this suite verifies.
// Only the contracts_for-derived config lookups are stubbed, since building a real
// `available_contract_types` config is orthogonal to the daily-expiry seed under test.
jest.mock('../Helpers/contract-type', () => {
    const actual = jest.requireActual('../Helpers/contract-type');
    return {
        ContractType: {
            ...actual.ContractType,
            buildContractTypesConfig: jest.fn(() => Promise.resolve()),
            getContractCategories: () => ({ contract_types_list: {}, non_available_contract_types_list: {} }),
            getContractValues: () => ({}),
            getDurationUnitsList: jest.fn(() => ({ duration_units_list: DAILY_ONLY_UNITS })),
            getDurationMinMax: jest.fn(() => ({ duration_min_max: DAILY_MIN_MAX })),
        },
    };
});

jest.mock('../Actions/purchase', () => ({
    processPurchase: jest.fn(() => new Promise(() => {})),
}));

describe('TradeStore — daily-only expiry seed (DCE-001, DCE-002)', () => {
    let tradeStore: TradeStore, mockRootStore: TRootStore;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(FIXED_NOW));

        mockRootStore = mockStore({
            common: {
                server_time: dayjs(FIXED_NOW),
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
        tradeStore.symbol = 'frxUSDJPY';
        tradeStore.contract_type = 'touchnotouch';
        tradeStore.duration_units_list = DAILY_ONLY_UNITS;
        tradeStore.duration_min_max = DAILY_MIN_MAX;
        tradeStore.trade_types = { ONETOUCH: 'ONETOUCH', NOTOUCH: 'NOTOUCH' };
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('[DCE-001] converts a persisted daily duration to an endtime expiry on a cold load', async () => {
        // The cold-load path: storage restores duration 10 'd' with expiry_type 'duration'. That is a
        // perfectly valid duration, so the default-duration gate stays shut — nothing else would seed
        // the expiry, and the proposal went out as duration/duration_unit with no date_expiry.
        tradeStore.expiry_type = 'duration';
        tradeStore.expiry_date = null;
        tradeStore.duration = 10;
        tradeStore.duration_unit = 'd';

        await tradeStore.processContractsForV2();

        expect(tradeStore.expiry_type).toBe('endtime');
        expect(tradeStore.expiry_time).toBe('23:59:59');
        expect(tradeStore.expiry_date).toBeTruthy();
    });

    it('[DCE-001] converts preset residue to the next trading day, not N days out', async () => {
        // duration 10 on a daily-only contract is tick-preset residue (touch_no_touch: 10 ticks)
        // left behind when the unit became 'd' — never a user's choice of days. Converting it to
        // "10 days out" put the end date 10 days ahead on every reload.
        tradeStore.expiry_type = 'duration';
        tradeStore.expiry_date = null;
        tradeStore.duration = 10;
        tradeStore.duration_unit = 'd';

        await tradeStore.processContractsForV2();

        expect(tradeStore.expiry_type).toBe('endtime');
        expect(tradeStore.expiry_date).toBe('2024-02-29'); // next trading day after FIXED_NOW
    });

    it('[DCE-001] keeps a persisted future end date when converting to endtime', async () => {
        // The user's prior choice lives in expiry_date; conversion must not replace it.
        tradeStore.expiry_type = 'duration';
        tradeStore.expiry_date = '2024-03-06';
        tradeStore.duration = 10;
        tradeStore.duration_unit = 'd';

        await tradeStore.processContractsForV2();

        expect(tradeStore.expiry_type).toBe('endtime');
        expect(tradeStore.expiry_date).toBe('2024-03-06');
    });

    it('[DCE-001] leaves an intraday-capable symbol on a duration expiry', async () => {
        // A contract that also offers intraday units may legitimately sit on a 'd' duration or a
        // same-day end date. Only daily-only symbols are forced to an end time — forcing these
        // overrode a deliberate choice and sent date_expiry where duration was wanted.
        const INTRADAY_UNITS = [
            { value: 'm', text: 'Minutes' },
            { value: 'h', text: 'Hours' },
            { value: 'd', text: 'Days' },
        ];
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ContractType } = require('../Helpers/contract-type');
        (ContractType.getDurationUnitsList as jest.Mock).mockReturnValue({ duration_units_list: INTRADAY_UNITS });
        tradeStore.duration_units_list = INTRADAY_UNITS;
        tradeStore.expiry_type = 'duration';
        tradeStore.expiry_date = null;
        tradeStore.duration = 1;
        tradeStore.duration_unit = 'd';

        await tradeStore.processContractsForV2();

        expect(tradeStore.expiry_type).toBe('duration');
        expect(tradeStore.duration_unit).toBe('d');
    });

    it('[DCE-003] advances a carried-over expiry_date that the new symbol does not trade', async () => {
        // The expiry now survives a symbol switch, so it can be a date the *previous* symbol traded
        // and this one does not (different holiday calendars, or getExpiryDate's naive +1 landing on
        // a weekend). getExpiryDate only checks it is not in the past.
        const closed = '2024-03-02'; // Saturday
        (WS.tradingTimes as jest.Mock).mockImplementation((date: string) =>
            Promise.resolve({
                trading_times: {
                    markets: [
                        {
                            submarkets: [
                                {
                                    symbols: [
                                        {
                                            underlying_symbol: 'frxUSDJPY',
                                            times: { close: [date === closed ? '--' : '23:59:59'], open: ['00:00:00'] },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                echo_req: { trading_times: date },
            })
        );
        tradeStore.expiry_type = 'endtime';
        tradeStore.expiry_date = closed;

        await tradeStore.processContractsForV2();

        expect(tradeStore.expiry_date).not.toBe(closed);
    });

    it('[DCE-001] a symbol change with different duration support leaves the endtime expiry intact', async () => {
        // The regression: handleTradeParamsResetOnSymbolChange guessed duration/expiry from a
        // market-name heuristic before contracts_for was known, wiping expiry_type/expiry_date. A
        // daily-only contract then priced by duration with no date_expiry. It now writes neither.
        await tradeStore.processContractsForV2();
        expect(tradeStore.expiry_type).toBe('endtime');

        const reset = tradeStore.handleTradeParamsResetOnSymbolChange('frxUSDJPY', '1HZ100V');

        expect(reset ?? {}).not.toHaveProperty('expiry_type');
        expect(reset ?? {}).not.toHaveProperty('expiry_date');
        expect(reset ?? {}).not.toHaveProperty('duration');
        expect(tradeStore.expiry_type).toBe('endtime');
    });

    it('[DCE-001][DCE-002] resolves expiry_type and expiry_time before releasing the proposal hold', async () => {
        expect(tradeStore.is_awaiting_contracts_for).toBe(true);

        await tradeStore.processContractsForV2();

        expect(tradeStore.is_awaiting_contracts_for).toBe(false);
        expect(tradeStore.expiry_type).toBe('endtime');
        expect(tradeStore.expiry_time).toBe('23:59:59');
    });

    it('[DCE-001] sends a date_expiry built from the resolved close time, not an intermediate value', async () => {
        await tradeStore.processContractsForV2();

        const requests = createProposalRequests(tradeStore);
        const expected_date_expiry = convertToUnix(tradeStore.expiry_date as string, '23:59:59');

        expect(requests.ONETOUCH).toHaveProperty('date_expiry', expected_date_expiry);
        expect(requests.NOTOUCH).toHaveProperty('date_expiry', expected_date_expiry);
    });
});
