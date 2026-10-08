import { renderHook } from '@testing-library/react-hooks';

import { useTraderStore } from 'Stores/useTraderStores';

import useLandscapeGrowthRate from '../use-landscape-growth-rate';

jest.mock('Stores/useTraderStores', () => ({ useTraderStore: jest.fn() }));

const onChange = jest.fn();

const setStore = (overrides = {}) =>
    (useTraderStore as jest.Mock).mockReturnValue({
        // Real `growth_rate_range` for an Accumulators symbol.
        accumulator_range_list: [0.01, 0.02, 0.03, 0.04, 0.05],
        growth_rate: 0.03,
        onChange,
        is_market_closed: false,
        has_open_accu_contract: false,
        ...overrides,
    });

describe('useLandscapeGrowthRate', () => {
    afterEach(() => jest.clearAllMocks());

    it('[LGR-001] shows the committed rate as a percentage', () => {
        setStore();
        const { result } = renderHook(() => useLandscapeGrowthRate());

        expect(result.current.display_value).toBe('3%');
    });

    it('[LGR-002] takes the rungs from the backend rather than deriving them', () => {
        setStore();
        const { result } = renderHook(() => useLandscapeGrowthRate());

        // `contracts_for` names exactly the rates the backend accepts, so there is nothing to build.
        expect(result.current.last_index).toBe(4);
        expect([0, 1, 2, 3, 4].map(result.current.labelAt)).toEqual(['1%', '2%', '3%', '4%', '5%']);
    });

    it('[LGR-003] orders the wheel low to high, whatever order the rates arrive in', () => {
        setStore({ accumulator_range_list: [0.05, 0.01, 0.03] });
        const { result } = renderHook(() => useLandscapeGrowthRate());

        // Scrolling up has to mean a higher rate — and the on-chart picker sorts the same way, so
        // the two controls have to agree about which rung is which.
        expect([0, 1, 2].map(result.current.labelAt)).toEqual(['1%', '3%', '5%']);
    });

    it('[LGR-004] opens on the rung the store is holding', () => {
        setStore({ growth_rate: 0.04 });
        const { result } = renderHook(() => useLandscapeGrowthRate());

        expect(result.current.selected_index).toBe(3);
    });

    it('[LGR-005] falls back to the floor when the store holds a rate the list has not got', () => {
        // Mid-switch between symbols the two can disagree for a frame. Opening above the wheel's own
        // first rung would be worse than opening at the bottom.
        setStore({ growth_rate: 0.07 });
        const { result } = renderHook(() => useLandscapeGrowthRate());

        expect(result.current.selected_index).toBe(0);
    });

    it('[LGR-006] commits the rate at an index', () => {
        setStore();
        const { result } = renderHook(() => useLandscapeGrowthRate());

        result.current.commit(4);

        expect(onChange).toHaveBeenCalledWith({ target: { name: 'growth_rate', value: 0.05 } });
    });

    it('[LGR-007] hands back the raw rate, which the chart draws the band at', () => {
        setStore();
        const { result } = renderHook(() => useLandscapeGrowthRate());

        // The label is for the wheel; the band needs the number.
        expect(result.current.valueAt?.(1)).toBe(0.02);
    });

    it.each([
        ['the market is closed', { is_market_closed: true }],
        ['a contract is open', { has_open_accu_contract: true }],
        ['there is only one rate to pick', { accumulator_range_list: [0.03] }],
        ['the backend sent no rates', { accumulator_range_list: undefined }],
    ])('[LGR-008] goes inert when %s', (_label, overrides) => {
        setStore(overrides);
        const { result } = renderHook(() => useLandscapeGrowthRate());

        expect(result.current.is_disabled).toBe(true);
    });

    it('[LGR-009] drops a non-positive rate rather than offering it', () => {
        setStore({ accumulator_range_list: [0, 0.02, 0.03] });
        const { result } = renderHook(() => useLandscapeGrowthRate());

        expect([0, 1].map(result.current.labelAt)).toEqual(['2%', '3%']);
        expect(result.current.last_index).toBe(1);
    });
});
