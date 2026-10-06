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
    /** Latest spot the barriers are measured from. */
    current_spot?: number;
    /**
     * `barrier_spot_distance` from the ACCU proposal, used only for its precision: it is
     * what the committed band's `±` label is rendered with, and the API quotes it with
     * more decimals than the symbol's pip size. Matching it keeps the preview label from
     * changing precision the moment the drag commits.
     */
    barrier_spot_distance?: string;
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

    return accumulator_range_list
        .map((growthRate, index) => ({ growthRate, offset: accumulator_barrier_offsets[index] }))
        .filter(({ growthRate, offset }) => growthRate > 0 && offset > 0)
        .map(({ growthRate, offset }) => {
            const distance = current_spot * offset;

            return {
                growthRate,
                barrierSpotDistance: distance,
                barrierSpotDistanceDisplay: distance.toFixed(decimals),
                growthRateDisplay: `${getGrowthRatePercentage(growthRate)}%`,
            };
        });
};
