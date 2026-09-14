import { renderHook } from '@testing-library/react-hooks';

import { getTradeTypesList } from 'AppV2/Utils/trade-types-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import useGuideContractTypes from '../useGuideContractTypes';
import useNativeAppAllowedTradeTypes from '../useNativeAppAllowedTradeTypes';

jest.mock('../useNativeAppAllowedTradeTypes', () => ({
    __esModule: true,
    default: jest.fn(() => undefined),
}));

jest.mock('Stores/useTraderStores', () => ({
    useTraderStore: jest.fn(() => ({
        contract_types_list_v2: {},
    })),
}));

jest.mock('AppV2/Utils/trade-types-utils', () => ({
    getTradeTypesList: jest.fn(() => []),
}));

describe('useGuideContractTypes', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset to default mocks
        (useNativeAppAllowedTradeTypes as jest.Mock).mockReturnValue(undefined);

        (getTradeTypesList as jest.Mock).mockReturnValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Contract List Selection', () => {
        it('[SMC-011] always uses contract_types_list_v2', () => {
            const mockContractListV2 = {
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
            };

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractListV2,
            });

            (getTradeTypesList as jest.Mock).mockReturnValue([{ value: 'type_1', text: 'Type 1' }]);

            const { result } = renderHook(() => useGuideContractTypes());

            expect(getTradeTypesList).toHaveBeenCalledWith(mockContractListV2, undefined);
            expect(result.current.trade_types).toEqual([{ value: 'type_1', text: 'Type 1' }]);
        });
    });

    describe('Empty Contract List Handling', () => {
        it('should return empty array when contract list is empty object', () => {
            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: {},
            });

            const { result } = renderHook(() => useGuideContractTypes());

            expect(result.current.trade_types).toEqual([]);
            expect(getTradeTypesList).not.toHaveBeenCalled();
        });

        it('should return empty array when contract list is null', () => {
            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: null,
            });

            const { result } = renderHook(() => useGuideContractTypes());

            expect(result.current.trade_types).toEqual([]);
            expect(getTradeTypesList).not.toHaveBeenCalled();
        });

        it('should return empty array when contract list is undefined', () => {
            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: undefined,
            });

            const { result } = renderHook(() => useGuideContractTypes());

            expect(result.current.trade_types).toEqual([]);
            expect(getTradeTypesList).not.toHaveBeenCalled();
        });
    });

    describe('Native Mobile App Filtering', () => {
        it('should not apply native app filtering when bridge is not available', () => {
            const mockContractList = {
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
            };

            (useNativeAppAllowedTradeTypes as jest.Mock).mockReturnValue(undefined);

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList,
            });

            (getTradeTypesList as jest.Mock).mockReturnValue([
                { value: 'type_1', text: 'Type 1' },
                { value: 'type_2', text: 'Type 2' },
            ]);

            const { result } = renderHook(() => useGuideContractTypes());

            // Should be called with undefined for nativeAppAllowedTradeTypes
            expect(getTradeTypesList).toHaveBeenCalledWith(mockContractList, undefined);
            expect(result.current.trade_types).toEqual([
                { value: 'type_1', text: 'Type 1' },
                { value: 'type_2', text: 'Type 2' },
            ]);
        });

        it('should apply native app filtering when bridge is available', () => {
            const mockContractList = {
                category_1: { categories: [{ value: 'accumulator', text: 'Accumulators' }] },
            };

            (useNativeAppAllowedTradeTypes as jest.Mock).mockReturnValue(['Accumulators', 'Multipliers']);

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList,
            });

            (getTradeTypesList as jest.Mock).mockReturnValue([{ value: 'accumulator', text: 'Accumulators' }]);

            const { result } = renderHook(() => useGuideContractTypes());

            // Should be called with array of allowed trade types
            expect(getTradeTypesList).toHaveBeenCalledWith(mockContractList, ['Accumulators', 'Multipliers']);
            expect(result.current.trade_types).toEqual([{ value: 'accumulator', text: 'Accumulators' }]);
        });

        it('should handle remote config with all available trade types', () => {
            const mockContractList = {
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
            };

            (useNativeAppAllowedTradeTypes as jest.Mock).mockReturnValue([
                'Accumulators',
                'Vanillas',
                'Turbos',
                'Multipliers',
            ]);

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList,
            });

            renderHook(() => useGuideContractTypes());

            expect(getTradeTypesList).toHaveBeenCalledWith(mockContractList, [
                'Accumulators',
                'Vanillas',
                'Turbos',
                'Multipliers',
            ]);
        });
    });

    describe('Memoization', () => {
        it('should memoize trade_types when dependencies do not change', () => {
            const mockContractList = {
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
            };

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList,
            });

            (getTradeTypesList as jest.Mock).mockReturnValue([{ value: 'type_1', text: 'Type 1' }]);

            const { result, rerender } = renderHook(() => useGuideContractTypes());

            const firstResult = result.current.trade_types;

            // Rerender without changing dependencies
            rerender();

            const secondResult = result.current.trade_types;

            // Should return the same reference
            expect(firstResult).toBe(secondResult);
            // getTradeTypesList should only be called once
            expect(getTradeTypesList).toHaveBeenCalledTimes(1);
        });

        it('should recompute trade_types when contract_types_list_v2 changes', () => {
            const mockContractList1 = {
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
            };

            const mockContractList2 = {
                category_2: { categories: [{ value: 'type_2', text: 'Type 2' }] },
            };

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList1,
            });

            (getTradeTypesList as jest.Mock).mockReturnValue([{ value: 'type_1', text: 'Type 1' }]);

            const { result, rerender } = renderHook(() => useGuideContractTypes());

            expect(result.current.trade_types).toEqual([{ value: 'type_1', text: 'Type 1' }]);

            // Change the contract list
            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList2,
            });

            (getTradeTypesList as jest.Mock).mockReturnValue([{ value: 'type_2', text: 'Type 2' }]);

            rerender();

            expect(result.current.trade_types).toEqual([{ value: 'type_2', text: 'Type 2' }]);
            expect(getTradeTypesList).toHaveBeenCalledTimes(2);
        });

        it('should recompute nativeAppAllowedTradeTypes when bridge availability changes', () => {
            const mockContractList = {
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
            };

            (useNativeAppAllowedTradeTypes as jest.Mock).mockReturnValue(undefined);

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList,
            });

            const { rerender } = renderHook(() => useGuideContractTypes());

            expect(getTradeTypesList).toHaveBeenCalledWith(mockContractList, undefined);

            // Change bridge availability
            (useNativeAppAllowedTradeTypes as jest.Mock).mockReturnValue([
                'Accumulators',
                'Vanillas',
                'Turbos',
                'Multipliers',
            ]);

            rerender();

            expect(getTradeTypesList).toHaveBeenLastCalledWith(mockContractList, [
                'Accumulators',
                'Vanillas',
                'Turbos',
                'Multipliers',
            ]);
        });
    });

    describe('Return Value', () => {
        it('should return object with trade_types property', () => {
            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: {},
            });

            const { result } = renderHook(() => useGuideContractTypes());

            expect(result.current).toHaveProperty('trade_types');
            expect(Array.isArray(result.current.trade_types)).toBe(true);
        });

        it('should return the result from getTradeTypesList', () => {
            const mockTradeTypes = [
                { value: 'accumulator', text: 'Accumulators' },
                { value: 'multiplier', text: 'Multipliers' },
                { value: 'vanillalongcall', text: 'Vanillas' },
            ];

            const mockContractList = {
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
            };

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList,
            });

            (getTradeTypesList as jest.Mock).mockReturnValue(mockTradeTypes);

            const { result } = renderHook(() => useGuideContractTypes());

            expect(result.current.trade_types).toEqual(mockTradeTypes);
        });
    });

    describe('Edge Cases', () => {
        it('should handle when getTradeTypesList returns empty array', () => {
            const mockContractList = {
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
            };

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList,
            });

            (getTradeTypesList as jest.Mock).mockReturnValue([]);

            const { result } = renderHook(() => useGuideContractTypes());

            expect(result.current.trade_types).toEqual([]);
        });

        it('should handle empty native_app_allowed_trade_types in remote config', () => {
            const mockContractList = {
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
            };

            (useNativeAppAllowedTradeTypes as jest.Mock).mockReturnValue([]);

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList,
            });

            renderHook(() => useGuideContractTypes());

            // Should be called with empty array
            expect(getTradeTypesList).toHaveBeenCalledWith(mockContractList, []);
        });

        it('should block all trade types when native_app_allowed_trade_types is missing (fail-safe)', () => {
            const mockContractList = {
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
            };

            // Simulate corrupted remote config - missing native_app_allowed_trade_types
            (useNativeAppAllowedTradeTypes as jest.Mock).mockReturnValue([]);

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList,
            });

            (getTradeTypesList as jest.Mock).mockReturnValue([]);

            const { result } = renderHook(() => useGuideContractTypes());

            // Should be called with empty array (blocks all trade types as fail-safe)
            expect(getTradeTypesList).toHaveBeenCalledWith(mockContractList, []);
            expect(result.current.trade_types).toEqual([]);
        });

        it('should block all trade types when remoteConfigData is null (fail-safe)', () => {
            const mockContractList = {
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
            };

            // Simulate null remote config data
            (useNativeAppAllowedTradeTypes as jest.Mock).mockReturnValue([]);

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList,
            });

            (getTradeTypesList as jest.Mock).mockReturnValue([]);

            const { result } = renderHook(() => useGuideContractTypes());

            // Should be called with empty array (blocks all trade types as fail-safe)
            expect(getTradeTypesList).toHaveBeenCalledWith(mockContractList, []);
            expect(result.current.trade_types).toEqual([]);
        });
    });

    describe('Integration with Remote Config', () => {
        it('should use remote config data for native app filtering', () => {
            const mockContractList = {
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
            };

            (useNativeAppAllowedTradeTypes as jest.Mock).mockReturnValue(['Accumulators', 'Vanillas']);

            (useTraderStore as jest.Mock).mockReturnValue({
                contract_types_list_v2: mockContractList,
            });

            renderHook(() => useGuideContractTypes());

            expect(getTradeTypesList).toHaveBeenCalledWith(mockContractList, ['Accumulators', 'Vanillas']);
        });
    });
});
