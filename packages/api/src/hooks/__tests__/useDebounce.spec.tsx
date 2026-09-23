import { act, renderHook } from '@testing-library/react-hooks';

import useDebounce from '../useDebounce';

jest.useFakeTimers();

describe('useDebounce', () => {
    it('returns the initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('initial', 300));

        expect(result.current).toBe('initial');
    });

    it('delays the update until the delay has elapsed', () => {
        const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
            initialProps: { value: 'a' },
        });

        rerender({ value: 'b' });
        expect(result.current).toBe('a');

        act(() => {
            jest.advanceTimersByTime(299);
        });
        expect(result.current).toBe('a');

        act(() => {
            jest.advanceTimersByTime(1);
        });
        expect(result.current).toBe('b');
    });
});
