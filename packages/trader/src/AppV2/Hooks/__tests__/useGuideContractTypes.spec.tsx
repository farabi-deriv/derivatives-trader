import { renderHook } from '@testing-library/react-hooks';

import { getTradeTypesList } from 'AppV2/Utils/trade-types-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import useGuideContractTypes from '../useGuideContractTypes';

jest.mock('Stores/useTraderStores', () => ({
    useTraderStore: jest.fn(),
}));

jest.mock('AppV2/Utils/trade-types-utils', () => ({
    getTradeTypesList: jest.fn(),
}));

const mockUseTraderStore = useTraderStore as jest.Mock;
const mockGetTradeTypesList = getTradeTypesList as jest.Mock;

const contract_list = { category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] } };
const next_contract_list = { category_2: { categories: [{ value: 'type_2', text: 'Type 2' }] } };
const trade_types = [{ value: 'type_1', text: 'Type 1' }];
const next_trade_types = [{ value: 'type_2', text: 'Type 2' }];

describe('useGuideContractTypes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetTradeTypesList.mockReturnValue([]);
    });

    it('[SMC-011] reads contract_types_list_v2 only, ignoring a legacy contract_types_list', () => {
        mockUseTraderStore.mockReturnValue({
            contract_types_list_v2: contract_list,
            contract_types_list: next_contract_list,
        });
        mockGetTradeTypesList.mockReturnValue(trade_types);

        const { result } = renderHook(() => useGuideContractTypes());

        expect(mockGetTradeTypesList).toHaveBeenCalledWith(contract_list);
        expect(result.current.trade_types).toEqual(trade_types);
    });

    it.each([[{}], [null], [undefined]])(
        'returns an empty list without calling getTradeTypesList when contract_types_list_v2 is %p',
        contract_types_list_v2 => {
            mockUseTraderStore.mockReturnValue({ contract_types_list_v2 });

            const { result } = renderHook(() => useGuideContractTypes());

            expect(result.current.trade_types).toEqual([]);
            expect(mockGetTradeTypesList).not.toHaveBeenCalled();
        }
    );

    it('memoizes trade_types while contract_types_list_v2 is unchanged', () => {
        mockUseTraderStore.mockReturnValue({ contract_types_list_v2: contract_list });
        mockGetTradeTypesList.mockReturnValue(trade_types);

        const { result, rerender } = renderHook(() => useGuideContractTypes());
        const first_result = result.current.trade_types;

        rerender();

        expect(result.current.trade_types).toBe(first_result);
        expect(mockGetTradeTypesList).toHaveBeenCalledTimes(1);
    });

    it('recomputes trade_types when contract_types_list_v2 changes', () => {
        mockUseTraderStore.mockReturnValue({ contract_types_list_v2: contract_list });
        mockGetTradeTypesList.mockReturnValue(trade_types);

        const { result, rerender } = renderHook(() => useGuideContractTypes());

        expect(result.current.trade_types).toEqual(trade_types);

        mockUseTraderStore.mockReturnValue({ contract_types_list_v2: next_contract_list });
        mockGetTradeTypesList.mockReturnValue(next_trade_types);

        rerender();

        expect(result.current.trade_types).toEqual(next_trade_types);
        expect(mockGetTradeTypesList).toHaveBeenCalledTimes(2);
    });
});
