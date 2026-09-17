import { configure, runInAction } from 'mobx';

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
