type TLadderBounds = {
    min: number;
    max: number;
    /** Value below which the ladder steps in quarters. Omitted, it is whole units throughout. */
    fine_limit?: number;
};

type TValueLadder = {
    last_index: number;
    valueAt: (index: number) => number;
    indexOf: (value: number) => number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Quarter steps, in the region where a whole unit is a coarse jump. */
const STEPS_PER_UNIT = 4;

/** Stake steps in quarters up to $10, then in whole units: 1, 1.25 … 9.75, 10, 11, 12. */
export const STAKE_FINE_LIMIT = 10;

/**
 * Value ladder for the landscape wheel — arithmetic, not a materialised array.
 *
 * Whole units by default; pass `fine_limit` for quarter steps below it. Both bounds round inward, so
 * the wheel can never offer a value the server would reject. Display formatting is unaffected.
 * Fiat-only — see docs/spec-to-pr/deferrals/landscape-crypto-stake-step.md.
 */
export const buildLadder = ({ min, max, fine_limit = 0 }: TLadderBounds): TValueLadder => {
    const has_fine = min < fine_limit;
    const floor = has_fine ? Math.ceil(min * STEPS_PER_UNIT) / STEPS_PER_UNIT : Math.ceil(min);
    const ceiling = max < fine_limit ? Math.floor(max * STEPS_PER_UNIT) / STEPS_PER_UNIT : Math.floor(max);

    // A window narrower than one step holds no rung (2.2–2.8 rounds to 3–2), so offer `min` itself.
    if (floor > ceiling) return { last_index: 0, valueAt: () => min, indexOf: () => 0 };

    // Last value still reached in quarters, and its index — the two regions meet here rather than
    // repeating it. Without a fine region this is the floor at index 0, so every step above is whole.
    const fine_ceiling = has_fine ? fine_limit : floor;
    const boundary_index = Math.round((fine_ceiling - floor) * STEPS_PER_UNIT);

    const valueAt = (index: number) =>
        index <= boundary_index
            ? (Math.round(floor * STEPS_PER_UNIT) + index) / STEPS_PER_UNIT
            : fine_ceiling + (index - boundary_index);

    // Unclamped, so `last_index` can be derived from the ceiling with the same mapping.
    const rawIndexOf = (value: number) =>
        value <= fine_ceiling
            ? Math.round((value - floor) * STEPS_PER_UNIT)
            : boundary_index + Math.round(value - fine_ceiling);

    const last_index = Math.max(0, rawIndexOf(ceiling));

    return {
        last_index,
        valueAt,
        indexOf: value => clamp(rawIndexOf(value), 0, last_index),
    };
};
