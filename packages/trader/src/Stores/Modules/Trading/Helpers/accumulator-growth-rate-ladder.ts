import { getGrowthRatePercentage } from '@deriv/shared';

export type TAccumulatorGrowthRateStep = {
    growthRate: number;
    barrierSpotDistance: number;
    barrierSpotDistanceDisplay?: string;
    growthRateDisplay?: string;
};

type TGetAccumulatorGrowthRateLadder = {
    /** `growth_rate_range` from contracts_for. */
    accumulator_range_list?: number[];
    /** `growth_rate_barrier_offsets` from contracts_for, parallel-indexed with the rates. */
    accumulator_barrier_offsets?: number[];
    /**
     * The spot the barriers are measured from.
     *
     * The spot the live proposal was priced against, not the newest tick. The two are
     * separate subscriptions and routinely a tick apart, and one tick is worth about a
     * unit in the last decimal of the label — so measuring from the newer of the two
     * produced a ladder that disagreed with the barriers the API had just quoted.
     */
    current_spot?: number;
    /**
     * `barrier_spot_distance` from the ACCU proposal: the exact distance the API priced
     * for [growth_rate], quoted with more decimals than the symbol's pip size. Used
     * verbatim for that rung, and for its precision on every other one.
     */
    barrier_spot_distance?: string;
    /**
     * The rate [barrier_spot_distance] was priced for, so that rung can be recognised.
     *
     * Read off the same proposal message as the distance, so the two cannot be paired
     * with each other wrongly.
     */
    growth_rate?: number;
    /** Decimals the symbol quotes with. Fallback when no proposal has arrived. */
    pip_size?: number;
};

/** Decimal places in a quoted value like `'0.5484'`. */
const getDecimals = (value?: string) => value?.split('.')[1]?.length;

/**
 * Builds the growth-rate ladder the chart snaps a barrier drag to.
 *
 * `contracts_for` returns `growth_rate_barrier_offsets` alongside `growth_rate_range`,
 * one offset per selectable rate in the same order, and the barrier sits at
 * `current_spot * offset` either side of the spot. So every rung is exact and available
 * before any proposal — this used to be approximated from the one rate a proposal had
 * priced, which was wrong by up to 163% at the far end of the ladder.
 *
 * Returns an empty ladder when the offsets are missing, so the caller can leave the
 * barriers read-only rather than render positions it cannot compute.
 */
export const getAccumulatorGrowthRateLadder = ({
    accumulator_range_list = [],
    accumulator_barrier_offsets = [],
    current_spot,
    barrier_spot_distance,
    growth_rate,
    pip_size,
}: TGetAccumulatorGrowthRateLadder): TAccumulatorGrowthRateStep[] => {
    if (!current_spot || !accumulator_range_list.length) {
        return [];
    }

    // The two arrays are positional: a length mismatch means we cannot trust which offset
    // belongs to which rate, and guessing would misplace every barrier.
    if (accumulator_barrier_offsets.length !== accumulator_range_list.length) {
        return [];
    }

    const decimals = getDecimals(barrier_spot_distance) ?? pip_size ?? 0;
    const priced_distance = Number(barrier_spot_distance);
    const has_priced_distance = Number.isFinite(priced_distance) && priced_distance > 0;

    return accumulator_range_list
        .map((growthRate, index) => ({ growthRate, offset: accumulator_barrier_offsets[index] }))
        .filter(({ growthRate, offset }) => growthRate > 0 && offset > 0)
        .map(({ growthRate, offset }) => {
            // The rung the API already priced is handed back its own number rather than
            // recomputed. The band is drawn from this ladder while a rate is previewed and
            // from the proposal when it is not, so any disagreement between the two — a
            // rounding path, a spot half a tick stale — showed up as the `±` label
            // flickering by one in its last decimal as the band was tapped open and shut.
            // Taken verbatim, the two states cannot disagree: it is the same string.
            const is_priced_rung = has_priced_distance && growthRate === growth_rate;
            const distance = is_priced_rung ? priced_distance : current_spot * offset;

            return {
                growthRate,
                barrierSpotDistance: distance,
                barrierSpotDistanceDisplay:
                    is_priced_rung && barrier_spot_distance ? barrier_spot_distance : distance.toFixed(decimals),
                growthRateDisplay: `${getGrowthRatePercentage(growthRate)}%`,
            };
        });
};
