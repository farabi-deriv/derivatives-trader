import { renderHook } from '@testing-library/react-hooks';

import { useTraderStore } from 'Stores/useTraderStores';

import useLandscapeTakeProfit from '../use-landscape-take-profit';

jest.mock('Stores/useTraderStores', () => ({ useTraderStore: jest.fn() }));

const setStore = (overrides = {}) =>
    (useTraderStore as jest.Mock).mockReturnValue({
        currency: 'USD',
        validation_params: { ACCU: { take_profit: { min: '1', max: '10' } } },
        has_take_profit: false,
        take_profit: 0,
        onChangeMultiple: jest.fn(),
        is_market_closed: false,
        has_open_accu_contract: false,
        ...overrides,
    });

describe('useLandscapeTakeProfit', () => {
    afterEach(() => jest.clearAllMocks());

    it('[LTP-007] shows "-" and reports itself off while disabled', () => {
        setStore({ has_take_profit: false });
        const { result } = renderHook(() => useLandscapeTakeProfit());

        expect(result.current.is_on).toBe(false);
        expect(result.current.display_value).toBe('-');
    });

    it('[LTP-007] the ladder holds amounts only — "-" is never a rung, so it cannot be scrolled onto', () => {
        setStore({ has_take_profit: true, take_profit: 5 });
        const { result } = renderHook(() => useLandscapeTakeProfit());

        // min 1, max 10 → indices 0..9 map to $1.00..$10.00, with no sentinel at either end.
        expect(result.current.labelAt(0)).toBe('$1.00');
        expect(result.current.last_index).toBe(9);
        for (let i = 0; i <= result.current.last_index; i++) {
            expect(result.current.labelAt(i)).not.toBe('-');
        }
    });

    it('[LTP-007] committing an index sets that amount with has_cancellation false', () => {
        const onChangeMultiple = jest.fn();
        setStore({ has_take_profit: true, take_profit: 5, onChangeMultiple });
        const { result } = renderHook(() => useLandscapeTakeProfit());

        result.current.commit(0);

        expect(onChangeMultiple).toHaveBeenCalledWith({
            has_take_profit: true,
            take_profit: '1',
            has_cancellation: false,
        });
    });

    it('[LTP-007] toggling on without an index enables at the ladder minimum', () => {
        const onChangeMultiple = jest.fn();
        setStore({ has_take_profit: false, onChangeMultiple });
        const { result } = renderHook(() => useLandscapeTakeProfit());

        result.current.toggle?.();

        expect(onChangeMultiple).toHaveBeenCalledWith({
            has_take_profit: true,
            take_profit: '1',
            has_cancellation: false,
        });
    });

    it('[LTP-007] toggling on at an index enables at that amount, not the minimum', () => {
        // The panel keeps showing the last amount after switching off; switching back on from there
        // must restore it, rather than silently dropping to the ladder's floor.
        const onChangeMultiple = jest.fn();
        setStore({ has_take_profit: false, onChangeMultiple });
        const { result } = renderHook(() => useLandscapeTakeProfit());

        // The ladder runs 1–10, so index 5 is 6.
        result.current.toggle?.(5);

        expect(onChangeMultiple).toHaveBeenCalledWith({
            has_take_profit: true,
            take_profit: '6',
            has_cancellation: false,
        });
    });

    it('[LTP-007] reopens on the last amount after being switched off, not the floor', () => {
        // Switching off clears the store's amount, so the adapter has to remember it. The ladder runs
        // 1–10, so $8 is index 7.
        setStore({ has_take_profit: true, take_profit: '8' });
        const { result, rerender } = renderHook(() => useLandscapeTakeProfit());
        expect(result.current.selected_index).toBe(7);

        setStore({ has_take_profit: false, take_profit: '' });
        rerender();

        expect(result.current.is_on).toBe(false);
        expect(result.current.selected_index).toBe(7);
    });

    it('[LTP-007] starts on the floor when it was never on', () => {
        setStore({ has_take_profit: false, take_profit: '' });
        const { result } = renderHook(() => useLandscapeTakeProfit());

        expect(result.current.selected_index).toBe(0);
    });

    it('[LTP-007] toggling off clears the value', () => {
        const onChangeMultiple = jest.fn();
        setStore({ has_take_profit: true, take_profit: 5, onChangeMultiple });
        const { result } = renderHook(() => useLandscapeTakeProfit());

        result.current.toggle?.();

        expect(onChangeMultiple).toHaveBeenCalledWith({ has_take_profit: false, take_profit: '' });
    });
});
