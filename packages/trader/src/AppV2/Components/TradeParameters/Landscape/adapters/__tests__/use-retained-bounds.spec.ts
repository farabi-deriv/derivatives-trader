import { renderHook } from '@testing-library/react-hooks';

import useRetainedBounds from '../use-retained-bounds';

describe('useRetainedBounds', () => {
    it('[LTP-013] returns the live bounds while they are usable', () => {
        const { result } = renderHook(() => useRetainedBounds({ min: '1', max: '50', fallback_min: 0.4 }));

        expect(result.current).toEqual({ min: 1, max: 50 });
    });

    it('[LTP-013] retains the last usable bounds when validation_params drops mid-commit', () => {
        // The bug this exists for: committing a value triggers a proposal, `validation_params` is
        // briefly undefined, and a ladder rebuilt from it reshapes under the live index — blanking the
        // row below the selected value.
        const { result, rerender } = renderHook(
            ({ min, max }: { min?: string; max?: string }) => useRetainedBounds({ min, max, fallback_min: 0.4 }),
            { initialProps: { min: '1', max: '50' } as { min?: string; max?: string } }
        );

        expect(result.current).toEqual({ min: 1, max: 50 });

        rerender({ min: undefined, max: undefined });

        expect(result.current).toEqual({ min: 1, max: 50 });
    });

    it('[LTP-013] adopts new bounds once the proposal returns', () => {
        const { result, rerender } = renderHook(
            ({ min, max }: { min?: string; max?: string }) => useRetainedBounds({ min, max, fallback_min: 0.4 }),
            { initialProps: { min: '1', max: '50' } as { min?: string; max?: string } }
        );

        rerender({ min: undefined, max: undefined });
        rerender({ min: '2', max: '80' });

        expect(result.current).toEqual({ min: 2, max: 80 });
    });

    it('[LTP-013] seeds a range containing the current value before any bounds arrive', () => {
        // Never a single-rung ladder: the wheel must have somewhere to scroll from the outset.
        const { result } = renderHook(() =>
            useRetainedBounds({ min: undefined, max: undefined, fallback_min: 1, fallback_value: 10 })
        );

        expect(result.current.min).toBeLessThanOrEqual(10);
        expect(result.current.max).toBeGreaterThan(10);
    });

    it('[LTP-013] ignores unusable bounds (zero, negative, or inverted)', () => {
        const { result, rerender } = renderHook(
            ({ min, max }: { min?: string; max?: string }) => useRetainedBounds({ min, max, fallback_min: 0.4 }),
            { initialProps: { min: '1', max: '50' } as { min?: string; max?: string } }
        );

        rerender({ min: '0', max: '0' });
        expect(result.current).toEqual({ min: 1, max: 50 });

        rerender({ min: '90', max: '10' });
        expect(result.current).toEqual({ min: 1, max: 50 });
    });
});
