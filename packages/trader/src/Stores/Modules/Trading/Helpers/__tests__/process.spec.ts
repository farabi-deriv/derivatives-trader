import { mockStore } from '@deriv/stores';

import { processTradeParams } from '../process';

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    getExpiryType: () => 'tick',
}));

jest.mock('Stores/Modules/Trading/Helpers/contract-type', () => ({
    ContractType: {
        getContractCategories: jest.fn(() => ({ contract_types_list: {}, non_available_contract_types_list: {} })),
        getContractValues: jest.fn(() => ({ form_components: ['duration', 'amount'] })),
        getContractType: jest.fn(() => ({ contract_type: 'rise_fall' })),
        getStartTime: jest.fn(() => ({})),
        getDurationUnitsList: jest.fn(() => ({ duration_units_list: [] })),
        getDurationUnit: jest.fn(() => ({ duration_unit: 't' })),
        getExpiryType: jest.fn(() => ({ expiry_type: 'duration' })),
        getExpiryDate: jest.fn(() => ({})),
        getDurationMinMax: jest.fn(() => ({ duration_min_max: {} })),
        getBarriers: jest.fn(() => ({})),
        getTradingTimes: jest.fn(() => Promise.resolve({ open: [], close: [] })),
        getExpiryTime: jest.fn(() => ({})),
    },
}));

describe('processTradeParams', () => {
    const new_state = {
        is_equal: 1,
    };
    const mock_store = mockStore({}).modules.trade;
    const trade_store = {
        ...mock_store,
        updateStore: jest.fn(),
        getSnapshot: jest.fn(() => ({ ...mock_store })),
    };

    it('updates the trade parameters correctly', async () => {
        await processTradeParams(trade_store, new_state);
        expect(trade_store.updateStore).toHaveBeenCalled();
        expect(trade_store.is_trade_enabled).toBe(true);
        expect(trade_store.is_trade_enabled_v2).toBe(true);
    });

    it('NEVER writes market identity (symbol/contract_type) — params processors do not own it', async () => {
        // Field-traced bug: a process function re-derived contract_type from a stale (previous
        // symbol's) category list and silently swapped the user's committed trade type, producing
        // phantom tabs / wrong-tab activation. Even if a future process function returns identity
        // keys, the choke point must strip them before updateStore.
        const { ContractType } = jest.requireMock('Stores/Modules/Trading/Helpers/contract-type');
        (ContractType.getContractValues as jest.Mock).mockReturnValueOnce({
            form_components: ['duration'],
            contract_type: 'hijacked_type',
            symbol: 'HIJACKED',
        });
        const store = {
            ...mock_store,
            contract_type: '', // forces onChangeContractType (getContractValues) into the sequence
            updateStore: jest.fn(),
            getSnapshot: jest.fn(() => ({ ...mock_store, contract_type: '' })),
        };

        await processTradeParams(store, { contract_type: 'match_diff' });

        (store.updateStore as jest.Mock).mock.calls.forEach(call => {
            expect(call[0]).not.toHaveProperty('contract_type');
            expect(call[0]).not.toHaveProperty('symbol');
        });
    });
});

describe('processInSequence (via processTradeParams)', () => {
    const mock_store = mockStore({}).modules.trade;

    it('should only pass function return values to updateStore, not stale snapshot properties', async () => {
        // Simulate the EU race condition: snapshot has form_components: [] but no function
        // in the sequence returns form_components (onChangeContractType is excluded when
        // contract_type is already set and new_state has no symbol/contract_type/is_equal).
        const stale_form_components: string[] = [];
        const trade_store = {
            ...mock_store,
            contract_type: 'rise_fall', // already set → onChangeContractType excluded from functions list
            form_components: stale_form_components,
            updateStore: jest.fn(),
            getSnapshot: jest.fn(() => ({
                ...mock_store,
                form_components: stale_form_components,
            })),
        };

        await processTradeParams(trade_store, {}); // no symbol/contract_type/is_equal → onChangeContractType not included

        // None of the updateStore calls (from processInSequence or the final is_trade_enabled call)
        // should include form_components — it was only in the snapshot, not returned by any function.
        const calls_with_form_components = trade_store.updateStore.mock.calls.filter(
            ([arg]: [Record<string, unknown>]) => 'form_components' in arg
        );
        expect(calls_with_form_components).toHaveLength(0);
    });

    it('should pass function return values to updateStore when functions explicitly return them', async () => {
        const trade_store = {
            ...mock_store,
            contract_type: '', // not set → onChangeContractType IS included → form_components will be returned
            updateStore: jest.fn(),
            getSnapshot: jest.fn(() => ({ ...mock_store, contract_type: '' })),
        };

        await processTradeParams(trade_store, { contract_type: 'rise_fall' });

        // onChangeContractType is included (contract_type in new_state) and returns form_components,
        // so at least one updateStore call should include it.
        const calls_with_form_components = trade_store.updateStore.mock.calls.filter(
            ([arg]: [Record<string, unknown>]) => 'form_components' in arg
        );
        expect(calls_with_form_components.length).toBeGreaterThan(0);
    });
});
