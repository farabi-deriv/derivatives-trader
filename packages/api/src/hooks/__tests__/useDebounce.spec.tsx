import { act, renderHook } from '@testing-library/react-hooks';

import useDebounce from '../useDebounce';

jest.useFakeTimers();

describe('useDebounce', () => {
    it('[DCR-002] returns the initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('initial', 300));

        expect(result.current).toBe('initial');
    });

    it('[DCR-002] delays the update until the delay has elapsed', () => {
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

    it('[DCR-001] is exported from the @deriv/api hooks barrel after the api-v2 move', () => {
        // Characterization: confirms the moved unit is live at its new home before api-v2 was deleted.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const hooks = require('../index');

        expect(typeof hooks.useDebounce).toBe('function');
    });
});
