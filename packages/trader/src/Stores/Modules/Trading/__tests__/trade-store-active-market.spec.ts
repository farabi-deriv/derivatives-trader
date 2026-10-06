/** The market this store reports to the core contract-trade store.
 *
 * That store derives the Accumulators barriers and the chart markers against the
 * active market, and has no way to reach this one: the trader root store wraps
 * core, not the other way round, and core's own `modules` is never populated. It
 * used to read the market back out of BaseStore's sessionStorage snapshot, which
 * mobx cannot observe — so `accumulator_barriers_payload`, a computed, kept
 * serving the null it cached while the user sat on another trade type, and the
 * Accumulators barriers stayed gone after switching market tabs until the page
 * was reloaded. */
import { TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';

import TradeStore from '../trade-store';

describe('the active market reported to contract_trade', () => {
    const buildStore = () => {
        const root = mockStore({});
        const store = new TradeStore({ root_store: root } as never);
        (root.contract_trade.setActiveMarket as jest.Mock).mockClear();
        return { root, store };
    };

    it('reports a symbol change', () => {
        const { root, store } = buildStore();

        store.symbol = '1HZ75V';

        expect(root.contract_trade.setActiveMarket).toHaveBeenCalledWith(expect.objectContaining({ symbol: '1HZ75V' }));
    });

    it('reports a trade type change, which is what brings the barriers back', () => {
        const { root, store } = buildStore();
        store.symbol = '1HZ75V';
        store.contract_type = TRADE_TYPES.RISE_FALL;
        (root.contract_trade.setActiveMarket as jest.Mock).mockClear();

        store.contract_type = TRADE_TYPES.ACCUMULATOR;

        expect(root.contract_trade.setActiveMarket).toHaveBeenCalledWith({
            symbol: '1HZ75V',
            contract_type: TRADE_TYPES.ACCUMULATOR,
        });
    });

    it('says nothing when neither has actually moved', () => {
        const { root, store } = buildStore();
        store.symbol = '1HZ75V';
        (root.contract_trade.setActiveMarket as jest.Mock).mockClear();

        // Re-assigning the same pair must not churn the observable on the other
        // side, which every accumulators computed is keyed off.
        store.symbol = '1HZ75V';

        expect(root.contract_trade.setActiveMarket).not.toHaveBeenCalled();
    });
});
