import { TRADE_TYPES } from '@deriv/shared';
import { renderHook } from '@testing-library/react-hooks';

import { CONTRACT_LIST } from 'AppV2/Utils/trade-types-utils';

import useAvailableContracts from '../useAvailableContracts';
import useTradeTypeAvailability from '../useTradeTypeAvailability';

jest.mock('../useTradeTypeAvailability', () => ({
    __esModule: true,
    default: jest.fn(),
}));

/**
 * Server availability: a trade type is offered iff it is in the available set. The result is cached
 * so repeated renders get the same reference, matching the real hook — which memoizes its set — so
 * callers' own memoization can be asserted.
 */
const mockAvailability = ({ available_ids, isLoading = false }: { available_ids?: string[]; isLoading?: boolean }) => {
    let cached: { available_trade_type_ids: Set<string>; isLoading: boolean } | undefined;

    (useTradeTypeAvailability as jest.Mock).mockImplementation((trade_types: { id: string }[]) => {
        cached ??= {
            available_trade_type_ids: new Set(
                trade_types.filter(({ id }) => !available_ids || available_ids.includes(id)).map(({ id }) => id)
            ),
            isLoading,
        };
        return cached;
    });
};

describe('useAvailableContracts', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Everything tradeable by default.
        mockAvailability({});
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Full web set (no native-app filtering)', () => {
        it('[MBR-004] returns every available contract with no remote-config allow-list applied', () => {
            const { result } = renderHook(() => useAvailableContracts());

            expect(result.current).toHaveLength(10);
            expect(result.current).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ id: CONTRACT_LIST.ACCUMULATORS }),
                    expect.objectContaining({ id: CONTRACT_LIST.VANILLAS }),
                    expect.objectContaining({ id: CONTRACT_LIST.TURBOS }),
                    expect.objectContaining({ id: CONTRACT_LIST.MULTIPLIERS }),
                    expect.objectContaining({ id: CONTRACT_LIST.RISE_FALL }),
                    expect.objectContaining({ id: CONTRACT_LIST.HIGHER_LOWER }),
                    expect.objectContaining({ id: CONTRACT_LIST.TOUCH_NO_TOUCH }),
                    expect.objectContaining({ id: CONTRACT_LIST.MATCHES_DIFFERS }),
                    expect.objectContaining({ id: CONTRACT_LIST.EVEN_ODD }),
                    expect.objectContaining({ id: CONTRACT_LIST.OVER_UNDER }),
                ])
            );
        });

        it('[MBR-004] returns contracts with the correct structure', () => {
            const { result } = renderHook(() => useAvailableContracts());

            const firstContract = result.current[0];
            expect(firstContract).toHaveProperty('tradeType');
            expect(firstContract).toHaveProperty('id');
            expect(firstContract).toHaveProperty('for');
            expect(Array.isArray(firstContract.for)).toBe(true);
        });

        it('[MBR-004] includes correct trade type values in the "for" array', () => {
            const { result } = renderHook(() => useAvailableContracts());

            const accumulatorContract = result.current.find(c => c.id === CONTRACT_LIST.ACCUMULATORS);
            expect(accumulatorContract?.for).toEqual([TRADE_TYPES.ACCUMULATOR]);

            const vanillasContract = result.current.find(c => c.id === CONTRACT_LIST.VANILLAS);
            expect(vanillasContract?.for).toEqual([TRADE_TYPES.VANILLA.CALL, TRADE_TYPES.VANILLA.PUT]);

            const riseFallContract = result.current.find(c => c.id === CONTRACT_LIST.RISE_FALL);
            expect(riseFallContract?.for).toEqual([TRADE_TYPES.RISE_FALL, TRADE_TYPES.RISE_FALL_EQUAL]);
        });
    });

    describe('Memoization', () => {
        it('should memoize result when dependencies do not change', () => {
            const { result, rerender } = renderHook(() => useAvailableContracts());

            const firstResult = result.current;
            rerender();
            const secondResult = result.current;

            // Should return the same reference if dependencies haven't changed
            expect(firstResult).toBe(secondResult);
        });
    });

    describe('Server availability', () => {
        it('[MBR-004] drops trade types the server returns no symbols for (e.g. EU: Multipliers only)', () => {
            mockAvailability({ available_ids: [CONTRACT_LIST.MULTIPLIERS] });

            const { result } = renderHook(() => useAvailableContracts());

            expect(result.current).toHaveLength(1);
            expect(result.current[0].id).toBe(CONTRACT_LIST.MULTIPLIERS);
        });

        it('[MBR-004] keeps every trade type the server returns symbols for', () => {
            mockAvailability({ available_ids: [CONTRACT_LIST.MULTIPLIERS, CONTRACT_LIST.RISE_FALL] });

            const { result } = renderHook(() => useAvailableContracts());

            expect(result.current.map(contract => contract.id)).toEqual([
                CONTRACT_LIST.RISE_FALL,
                CONTRACT_LIST.MULTIPLIERS,
            ]);
        });

        it('[TTA-001] fails open while the availability lookup is still loading', () => {
            mockAvailability({ available_ids: [], isLoading: true });

            const { result } = renderHook(() => useAvailableContracts());

            expect(result.current).toHaveLength(10);
        });

        it('[TTA-001] fails open when the lookup returns nothing at all, rather than showing an empty list', () => {
            mockAvailability({ available_ids: [] });

            const { result } = renderHook(() => useAvailableContracts());

            expect(result.current).toHaveLength(10);
        });
    });
});
