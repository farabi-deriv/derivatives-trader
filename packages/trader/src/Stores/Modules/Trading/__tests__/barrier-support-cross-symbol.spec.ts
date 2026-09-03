/** Classifying a symbol that is NOT the active one.
 *
 * `contracts_for` config is cached per symbol, so `getSymbolBarrierSupport` can be asked about a
 * PROSPECTIVE market (the cross-symbol reset comparison does exactly that, before `this.symbol`
 * moves). When that symbol publishes no barrier for the current expiry type, the derivation falls
 * back to the live `barrier_1` — which belongs to the ACTIVE symbol and must not leak across, or a
 * forex market inherits a synthetic's relative offset and the barrier reset silently stops firing.
 *
 * No other spec covers a non-active symbol: `barrier-support.spec.ts` always asks about the one it
 * just selected. */
import { mockStore } from '@deriv/stores';

import { ContractType } from '../Helpers/contract-type';
import TradeStore from '../trade-store';

describe('barrier support for a non-active symbol', () => {
    it('does not let the active symbol\u2019s live barrier classify another market', () => {
        const root = mockStore({});
        const store = new TradeStore({ root_store: root } as never);

        // Cache says: FOREX symbol publishes an ABSOLUTE barrier; active synthetic is RELATIVE.
        jest.spyOn(ContractType, 'getFullContractTypes').mockImplementation(symbol =>
            symbol === 'frxEURUSD'
                ? ({ touch: { config: { barriers: {} } } } as never) // publishes nothing at all
                : ({ touch: { config: { barriers: { intraday: { barrier: '+0.50' } } } } } as never)
        );
        store.setActiveSymbolsV2([
            { underlying_symbol: '1HZ50V', exchange_is_open: 1, market: 'synthetic_index' },
            { underlying_symbol: 'frxEURUSD', exchange_is_open: 1, market: 'forex' },
        ] as never);
        store.symbol = '1HZ50V';
        store.contract_type = 'touch';
        store.duration_unit = 'm';
        store.duration_units_list = [{ text: 'm', value: 'm' }] as never;
        // A live RELATIVE barrier belonging to the ACTIVE symbol.
        store.barrier_1 = '+0.50';

        // The prospective forex symbol publishes nothing, so the ACTIVE symbol's live relative
        // barrier must NOT leak into its answer — the forex heuristic decides: absolute.
        expect(store.getSymbolBarrierSupport('frxEURUSD')).toBe('absolute');
        // ...and the active symbol still answers relative.
        expect(store.getSymbolBarrierSupport('1HZ50V')).toBe('relative');
        // your feature: the reset comparison sees a real difference -> reset fires.
        expect(store.handleTradeParamsResetOnSymbolChange('1HZ50V', 'frxEURUSD')).not.toBeNull();
    });
});
