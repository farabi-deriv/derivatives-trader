import React from 'react';

type TBounds = { min: number; max: number };

type TUseRetainedBounds = {
    min?: string | number;
    max?: string | number;
    /** Used only before the first usable bounds arrive, so the ladder is never degenerate. */
    fallback_min: number;
    /** The current committed value, so the seed ladder always contains it. */
    fallback_value?: string | number;
};

/**
 * Keeps the last usable `{min, max}` while `validation_params` is transiently absent — a commit
 * triggers a proposal, and rebuilding the ladder mid-flight drops the live index out of range.
 */
const useRetainedBounds = ({ min, max, fallback_min, fallback_value }: TUseRetainedBounds): TBounds => {
    const next_min = Number(min);
    const next_max = Number(max);
    const is_usable = next_min > 0 && next_max > 0 && next_max >= next_min;

    const retained = React.useRef<TBounds | null>(null);
    if (is_usable) retained.current = { min: next_min, max: next_max };
    if (retained.current) return retained.current;

    // Before any proposal: seed a range containing the current value, never a single rung.
    const seed_min = fallback_min;
    const seed_value = Number(fallback_value) || seed_min;
    return { min: seed_min, max: Math.max(seed_min, seed_value) + 1 };
};

export default useRetainedBounds;
