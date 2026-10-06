import { autorun, configure, runInAction } from 'mobx';

import { CONTRACT_TYPES, TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';

import ContractTradeStore from '../contract-trade-store';

configure({ safeDescriptors: false });

describe('ContractTradeStore.markers_array trade_store parsing', () => {
    beforeEach(() => {
        sessionStorage.setItem('trade_store', JSON.stringify({ contract_type: 'rise_fall', symbol: 'R_100' }));
    });

    afterEach(() => {
        sessionStorage.removeItem('trade_store');
        jest.restoreAllMocks();
    });

    it('[ABF-014] parses sessionStorage trade_store once per markers_array evaluation and preserves output', () => {
        const store = new ContractTradeStore(mockStore({}));
        runInAction(() => {
            store.contracts = [
                {
                    contract_info: { underlying_symbol: 'R_100', contract_type: 'CALL', date_start: 1 },
                    marker: { x: 1 },
                },
                {
                    contract_info: { underlying_symbol: 'OTHER', contract_type: 'CALL', date_start: 2 },
                    marker: { x: 2 },
                },
            ];
        });

        const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');

        const markers = store.markers_array;

        const trade_store_reads = getItemSpy.mock.calls.filter(([key]) => key === 'trade_store');
        expect(trade_store_reads).toHaveLength(1);
        // Output is unchanged: only the contract on the active symbol contributes its marker.
        expect(markers).toEqual([{ x: 1 }]);
    });
});

/**
 * The store resolves the active market through `sessionStorage`, which mobx cannot
 * observe. Anything that caches a value derived from it keeps serving the market
 * the user just left, because switching tabs touches no tracked observable — that
 * put a finished contract's band and profit label on the next market's chart.
 */
describe('ContractTradeStore accumulator market resolution', () => {
    const selectMarket = (symbol: string) =>
        sessionStorage.setItem('trade_store', JSON.stringify({ symbol, contract_type: TRADE_TYPES.ACCUMULATOR }));

    const finishedContract = (underlying_symbol: string, date_start: number) => ({
        contract_info: {
            contract_type: CONTRACT_TYPES.ACCUMULATOR,
            underlying_symbol,
            date_start,
            current_spot_time: date_start + 5,
            high_barrier: '101',
            low_barrier: '99',
            exit_spot: '100',
            exit_spot_time: date_start + 10,
            profit: '0.06',
            currency: 'USD',
            tick_stream: [{ epoch: date_start + 5 }, { epoch: date_start + 10 }],
        },
    });

    const buildStore = () => {
        const store = new (ContractTradeStore as any)({ portfolio: { active_positions: [] }, ui: {} });
        runInAction(() => {
            store.contracts = [finishedContract('1HZ75V', 100)];
        });
        return store;
    };

    afterEach(() => sessionStorage.removeItem('trade_store'));

    it('returns the contract belonging to the selected market', () => {
        selectMarket('1HZ75V');
        expect(buildStore().getAccumulatorContractInfo()?.underlying_symbol).toBe('1HZ75V');
    });

    it('returns null for a market that has no accumulator contract', () => {
        selectMarket('1HZ50V');
        expect(buildStore().getAccumulatorContractInfo()).toBeNull();
    });

    it('brings the barriers back when the user returns to the accumulators market', () => {
        const store = buildStore();
        store.setActiveMarket({ symbol: '1HZ75V', contract_type: TRADE_TYPES.ACCUMULATOR });
        runInAction(() =>
            store.setNewAccumulatorBarriersData({
                accumulators_high_barrier: '101',
                accumulators_low_barrier: '99',
                proposal_prev_spot_time: 100,
                current_spot: 100,
                current_spot_time: 100,
            })
        );

        let payload: any;
        const dispose = autorun(() => {
            payload = store.accumulator_barriers_payload;
        });
        expect(payload?.live).toBeTruthy();

        // Away to another market on a trade type that is not accumulators.
        store.setActiveMarket({ symbol: '1HZ50V', contract_type: TRADE_TYPES.RISE_FALL });
        expect(payload).toBeNull();

        // ...and back again, with no barriers data arriving in between. The market has
        // to be enough on its own: while it was read out of sessionStorage the payload
        // computed observed nothing that switching tabs changed, so it kept serving the
        // null it cached on the other trade type and the barriers stayed gone until the
        // page was reloaded.
        store.setActiveMarket({ symbol: '1HZ75V', contract_type: TRADE_TYPES.ACCUMULATOR });

        expect(payload?.live).toBeTruthy();
        expect(payload.symbol).toBe('1HZ75V');

        dispose();
    });

    it('reads the market off sessionStorage until the trade store reports one', () => {
        // Cold load: the trade store's reaction has not run yet, and BaseStore's
        // snapshot is all there is to go on.
        selectMarket('1HZ75V');
        const store = buildStore();

        expect(store.getAccumulatorContractInfo()?.underlying_symbol).toBe('1HZ75V');
    });

    // The regression. `accumulator_barriers_payload` is a computed, and mobx only
    // memoises a computed while it is OBSERVED — which it is in the app, because
    // TradeChart is an observer. The autorun here reproduces that; without it the
    // payload would recompute on every read and the bug would not show.
    it('drops the previous market closed band when the payload recomputes after a switch', () => {
        selectMarket('1HZ75V');
        const store = buildStore();

        let payload: any;
        const dispose = autorun(() => {
            payload = store.accumulator_barriers_payload;
        });

        expect(payload.symbol).toBe('1HZ75V');
        expect(payload.closed).not.toBeNull();

        // Switching a market tab moves the symbol but leaves `contracts` alone; the
        // new market's first proposal is what invalidates the payload computed.
        selectMarket('1HZ50V');
        runInAction(() => store.setNewAccumulatorBarriersData({ proposal_prev_spot_time: 999 }));

        expect(payload?.symbol ?? '1HZ50V').toBe('1HZ50V');
        expect(payload?.closed ?? null).toBeNull();

        dispose();
    });
});
