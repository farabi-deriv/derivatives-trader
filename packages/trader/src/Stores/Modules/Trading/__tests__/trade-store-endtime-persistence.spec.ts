import { configure } from 'mobx';

import { dayjs, TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';

import { OPEN_MARKETS_STORAGE_KEYS } from 'AppV2/Utils/open-markets-utils';
import { getMarketKey, readTabTradeParams, TAB_TRADE_PARAMS_STORAGE_KEYS } from 'AppV2/Utils/tab-trade-params-utils';
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
const high_low_tab = { symbol: SYMBOL, contract_type: TRADE_TYPES.HIGH_LOW };
const rise_fall_tab = { symbol: SYMBOL, contract_type: TRADE_TYPES.RISE_FALL };

/** What the user saved: End Time tomorrow at 23:59 with a customised barrier. */
const SAVED_ENDTIME_PARAMS = {
    expiry_type: 'endtime',
    expiry_time: '23:59',
    expiry_date: '2024-02-27',
    saved_expiry_date_v2: '2024-02-27',
    duration: 5,
    duration_unit: 'm',
    barrier_1: '+0.50',
};

/** A trimmed `contracts_for` publishing per-expiry-type barriers for `tick` and `intraday` ONLY —
 * exactly like the real payload, which has no `daily` barrier entry for these contracts. That gap is
 * what made the End Time case a WIPE rather than a reset: an end time on a later date derives
 * `contract_expiry_type` as `daily`, and `getBarriers` returns `''` for a key it cannot find. */
const seedContractsFor = () => {
    const build = (expiry_type: string, min: string, max: string, barrier: string, types: string[]) =>
        types.map(contract_type => ({
            contract_type,
            contract_category: (() => {
                if (contract_type === 'CALL' || contract_type === 'PUT') return 'callput';
                if (contract_type === 'ONETOUCH' || contract_type === 'NOTOUCH') return 'touchnotouch';
                return 'higherLower';
            })(),
            barriers: contract_type === 'CALL' || contract_type === 'PUT' ? 0 : 1,
            barrier,
            expiry_type,
            start_type: 'spot',
            min_contract_duration: min,
            max_contract_duration: max,
            default_stake: 10,
        }));
    ContractType.processContractsForResponse(
        {
            contracts_for: {
                available: [
                    ...build('tick', '1t', '10t', '+0.10', ['HIGHER', 'LOWER']),
                    ...build('intraday', '1m', '1d', '+0.20', ['HIGHER', 'LOWER']),
                    // Touch/No Touch: tick + intraday only, NO daily entry — the gap that made an
                    // End Time tab fall through to the market heuristic.
                    ...build('tick', '1t', '10t', '+2.00', ['ONETOUCH', 'NOTOUCH']),
                    ...build('intraday', '1m', '1d', '+3.00', ['ONETOUCH', 'NOTOUCH']),
                    ...build('tick', '1t', '10t', '', ['CALL', 'PUT']),
                    ...build('intraday', '1m', '1d', '', ['CALL', 'PUT']),
                ],
                non_available: [],
            },
        } as unknown as Parameters<typeof ContractType.processContractsForResponse>[0],
        SYMBOL
    );
};

describe('per-tab End Time persistence', () => {
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
        seedContractsFor();
        // The End Time path resolves market open/close through this; an always-open day keeps the
        // restore on its real code path without a WS round trip.
        jest.spyOn(ContractType, 'getTradingTimes').mockResolvedValue({
            open: ['00:00:00'],
            close: ['23:59:59'],
        } as never);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        window.history.pushState({}, '', '/');
        sessionStorage.clear();
        localStorage.removeItem('trade_store');
    });

    const seedRefresh = (
        tabs: { symbol: string; contract_type: string }[] = [high_low_tab],
        params: Record<string, unknown> = SAVED_ENDTIME_PARAMS
    ) => {
        sessionStorage.setItem(OPEN_MARKETS_STORAGE_KEYS.manual, JSON.stringify(tabs));
        sessionStorage.setItem('trade_store', JSON.stringify(high_low_tab));
        sessionStorage.setItem(
            TAB_TRADE_PARAMS_STORAGE_KEYS.manual,
            JSON.stringify({ [getMarketKey(high_low_tab)]: params })
        );
    };

    const buildStore = () => {
        const store = new TradeStore({ root_store });
        store.currency = 'USD';
        store.default_stake = 10;
        store.setActiveSymbolsV2([{ underlying_symbol: SYMBOL, exchange_is_open: 1 }] as never);
        jest.spyOn(store, 'validateAllProperties').mockImplementation(() => undefined);
        jest.spyOn(store, 'validateProperty').mockImplementation(() => undefined);
        return store;
    };

    it('keeps the barrier when contracts_for is re-delivered for an End Time tab', async () => {
        seedRefresh();
        const store = buildStore();

        await flushPromises();
        await store.processContractsForV2();
        await flushPromises();

        expect(store.expiry_type).toBe('endtime');
        expect(store.barrier_1).toBe('+0.50');
        // `daily` is the expiry type an end time on a later date derives — the one with no barrier
        // published, which is why the re-delivery below used to blank the field outright.
        expect(store.contract_expiry_type).toBe('daily');

        // React Query re-emits `contracts_for` on refetch/reconnect; the hook's effect re-runs.
        await store.processContractsForV2();
        await flushPromises();

        expect(store.barrier_1).toBe('+0.50');
        expect(store.expiry_type).toBe('endtime');
        // …and the saved entry was not overwritten either — that is what made the loss permanent.
        expect(readTabTradeParams('manual')[getMarketKey(high_low_tab)].barrier_1).toBe('+0.50');
    });

    it('keeps End Time and the barrier across an internal (same-symbol) tab switch', async () => {
        seedRefresh([high_low_tab, rise_fall_tab]);
        const store = buildStore();

        await flushPromises();
        await store.processContractsForV2();
        await flushPromises();
        expect(store.expiry_type).toBe('endtime');

        // Switch to the sibling tab and back — same symbol, so no new contracts_for is fetched, but
        // the cached one is re-delivered.
        await store.selectMarketAndTradeType(SYMBOL, TRADE_TYPES.RISE_FALL);
        await flushPromises();
        await store.selectMarketAndTradeType(SYMBOL, TRADE_TYPES.HIGH_LOW);
        await flushPromises();
        await store.processContractsForV2();
        await flushPromises();

        // The reported symptom was duration_unit reverting to ticks and the barrier changing.
        expect(store.expiry_type).toBe('endtime');
        expect(store.duration_unit).not.toBe('t');
        expect(store.barrier_1).toBe('+0.50');
    });

    it('degrades a saved End Time wholly in the past to the duration fields', async () => {
        // The browser tab survived overnight: the saved end time now names a past date. Restoring
        // it verbatim would send a dead date_expiry and stick the tab on a rejected proposal — the
        // stale tuple is dropped and the restore degrades to the (valid) saved duration instead.
        seedRefresh([high_low_tab], {
            ...SAVED_ENDTIME_PARAMS,
            expiry_date: '2024-02-20',
            saved_expiry_date_v2: '2024-02-20',
        });
        const store = buildStore();

        await flushPromises();
        await store.processContractsForV2();
        await flushPromises();

        expect(store.expiry_type).toBe('duration');
        expect(store.expiry_date).not.toBe('2024-02-20');
        expect(store.duration).toBe(5);
        expect(store.duration_unit).toBe('m');
    });

    it('keeps End Time mode when the saved dormant duration fails the range check', async () => {
        // An End Time tab still carries a leftover duration/duration_unit pair. When that pair is
        // invalid for the incoming pair (here: seconds, a unit the offering never lists), the
        // restore used to report "duration not restored" and both fallback sites ran
        // applyDefaultDuration(), which force-writes expiry_type 'duration' — silently flipping
        // the tab out of End Time mode.
        seedRefresh([high_low_tab], { ...SAVED_ENDTIME_PARAMS, duration: 3, duration_unit: 's' });
        const store = buildStore();

        await flushPromises();
        await store.processContractsForV2();
        await flushPromises();

        expect(store.expiry_type).toBe('endtime');
        expect(store.expiry_date).toBe('2024-02-27');
        expect(store.barrier_1).toBe('+0.50');

        // Re-delivery evaluates the retained (still invalid) dormant duration via the
        // out-of-range operand — the End Time exemption must hold there too.
        await store.processContractsForV2();
        await flushPromises();

        expect(store.expiry_type).toBe('endtime');
        expect(store.expiry_date).toBe('2024-02-27');
    });

    it('keeps a restored barrier when the restored duration flips the expiry type to one with a published default', async () => {
        // Duration params (not End Time): restoring 5 minutes flips the seeded tick expiry type to
        // intraday, whose published default (+0.20) used to overwrite the saved barrier mid-restore.
        seedRefresh([high_low_tab], {
            duration: 5,
            duration_unit: 'm',
            expiry_type: 'duration',
            barrier_1: '+0.50',
        });
        const store = buildStore();

        await flushPromises();
        await store.processContractsForV2();
        await flushPromises();

        expect(store.contract_expiry_type).toBe('intraday');
        expect(store.duration_unit).toBe('m');
        expect(store.barrier_1).toBe('+0.50');
    });

    it('re-seeds the barrier when the user moves the duration across an expiry boundary', async () => {
        // No barrier saved for the tab: the platform owns it. A user-driven duration change that
        // crosses tick -> intraday must adopt the new expiry type's published default.
        seedRefresh([high_low_tab], {});
        const store = buildStore();

        await flushPromises();
        await store.processContractsForV2();
        await flushPromises();
        expect(store.contract_expiry_type).toBe('tick');

        store.onChange({ target: { name: 'duration_unit', value: 'm' } } as never);
        await flushPromises();

        expect(store.contract_expiry_type).toBe('intraday');
        expect(store.barrier_1).toBe('+0.20');
    });

    /** The payout spinner: with `saved_expiry_date_v2` unsaved, the restored tab re-derived
     * `expiry_date` from the real "today" instead of the date the user picked, producing a
     * `date_expiry` the server rejects — so no proposal ever resolved. */
    it('restores the End Time picker date so the proposal carries the chosen date_expiry', async () => {
        seedRefresh();
        const store = buildStore();

        await flushPromises();
        await store.processContractsForV2();
        await flushPromises();

        expect(store.saved_expiry_date_v2).toBe('2024-02-27');
        expect(store.expiry_date).toBe('2024-02-27');

        const { createProposalRequests } = jest.requireActual('../Helpers/proposal');
        const requests = createProposalRequests(store) as Record<string, { date_expiry?: number }>;
        // 2024-02-27T23:59:59Z — the date the user picked, not today's.
        expect(requests.HIGHER.date_expiry).toBe(1709078399);
        expect(requests.LOWER.date_expiry).toBe(1709078399);
    });

    it('persists the End Time picker date when the user edits it', async () => {
        seedRefresh([high_low_tab], { ...SAVED_ENDTIME_PARAMS, saved_expiry_date_v2: '2024-02-27' });
        const store = buildStore();
        await flushPromises();
        await store.processContractsForV2();
        await flushPromises();

        // What the End Time action sheet commits on Save.
        store.setSavedExpiryDateV2('2024-02-28');
        await flushPromises();

        expect(readTabTradeParams('manual')[getMarketKey(high_low_tab)].saved_expiry_date_v2).toBe('2024-02-28');
    });
    /** Touch/No Touch with an ABSOLUTE barrier (a bare price, e.g. 9847.42) and an End Time on a
     * later date. `contract_expiry_type` derives as `daily`, and Touch publishes barriers only for
     * `tick` and `intraday` — so `getApiDefaultBarrier` finds nothing, and the old code fell through
     * to the market heuristic, which answers `relative` for a synthetic index. The barrier input then
     * rendered the relative (+/- sign) control against an absolute price, and the payout never
     * resolved: the Buy button sat on a loading bar until the user switched tabs and came back. */
    it('derives ABSOLUTE barrier support for an End Time tab whose expiry type has no default', () => {
        const store = buildStore();
        store.symbol = SYMBOL;
        store.contract_type = TRADE_TYPES.TOUCH;
        // `contract_expiry_type` is derived, not assignable — an End Time on a later day than the
        // mocked server time (2024-02-26) is what makes it read `daily`.
        store.expiry_type = 'endtime';
        store.expiry_date = '2024-02-28';
        store.barrier_1 = '9847.42';

        // The offering publishes nothing for `daily` …
        expect(store.getBarrierSupportFromApiDefault(TRADE_TYPES.TOUCH, 'daily')).toBe('absolute');
        // … and the symbol-level answer must agree, since that is what the input renders from.
        expect(store.getSymbolBarrierSupport(SYMBOL)).toBe('absolute');
    });

    it('still prefers the published default over the live barrier when one exists', () => {
        const store = buildStore();
        store.symbol = SYMBOL;
        store.contract_type = TRADE_TYPES.TOUCH;
        // A stale absolute value in the store must NOT override an offering that says relative.
        store.barrier_1 = '9847.42';

        expect(store.getBarrierSupportFromApiDefault(TRADE_TYPES.TOUCH, 'intraday')).toBe('relative');
    });

    it('falls back to another expiry type when nothing else is known', () => {
        const store = buildStore();
        store.symbol = SYMBOL;
        store.contract_type = TRADE_TYPES.TOUCH;
        store.barrier_1 = '';

        // No daily default and no live barrier — the offering's intraday entry still answers, because
        // barrier KIND does not vary by expiry_type within a contract.
        expect(store.getBarrierSupportFromApiDefault(TRADE_TYPES.TOUCH, 'daily')).toBe('relative');
    });
});
