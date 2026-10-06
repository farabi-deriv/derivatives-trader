import { getAccumulatorGrowthRateLadder } from '../accumulator-growth-rate-ladder';

// Real contracts_for payload for 1HZ15V, with the spot and label the chart showed for it.
const accumulator_range_list = [0.01, 0.02, 0.03, 0.04, 0.05];
const accumulator_barrier_offsets = [0.000064970949, 0.000060725407, 0.000056949789, 0.000054185412, 0.000051575021];
const current_spot = 9629.08;
const barrier_spot_distance = '0.5484';

const buildLadder = (overrides = {}) =>
    getAccumulatorGrowthRateLadder({
        accumulator_range_list,
        accumulator_barrier_offsets,
        current_spot,
        barrier_spot_distance,
        ...overrides,
    });

describe('getAccumulatorGrowthRateLadder', () => {
    it('places each barrier at current_spot * its offset', () => {
        expect(buildLadder().map(step => step.barrierSpotDistanceDisplay)).toEqual([
            '0.6256',
            '0.5847',
            '0.5484',
            '0.5218',
            '0.4966',
        ]);
    });

    it('agrees with the barrier the API priced for the selected rate', () => {
        // The chart rendered ±0.5484 while 3% was selected, so that rung must land on it.
        const selected = buildLadder().find(step => step.growthRate === 0.03);

        expect(selected?.barrierSpotDistanceDisplay).toBe(barrier_spot_distance);
    });

    it('keeps the rungs ordered widest-band-first', () => {
        const distances = buildLadder().map(step => step.barrierSpotDistance);

        expect(distances).toEqual([...distances].sort((a, b) => b - a));
    });

    it('formats the rate for display', () => {
        expect(buildLadder().map(step => step.growthRateDisplay)).toEqual(['1%', '2%', '3%', '4%', '5%']);
    });

    it('matches the proposal precision rather than the pip size', () => {
        // The symbol quotes at 3 decimals but the API quotes the distance at 4. Following
        // pip_size would make the label lose a digit the moment a drag commits.
        const [first] = buildLadder({ pip_size: 3 });

        expect(first.barrierSpotDistanceDisplay).toBe('0.6256');
    });

    it('falls back to pip_size before any proposal has arrived', () => {
        const [first] = buildLadder({ barrier_spot_distance: undefined, pip_size: 3 });

        expect(first.barrierSpotDistanceDisplay).toBe('0.626');
    });

    it('returns an empty ladder without a spot to measure from', () => {
        expect(buildLadder({ current_spot: undefined })).toEqual([]);
    });

    it('returns an empty ladder when the backend sends no offsets', () => {
        // Older backend or a symbol that omits the field: better to leave the barriers
        // read-only than to render positions we cannot compute.
        expect(buildLadder({ accumulator_barrier_offsets: [] })).toEqual([]);
        expect(buildLadder({ accumulator_barrier_offsets: undefined })).toEqual([]);
    });

    it('refuses a ladder whose offsets do not line up with the rates', () => {
        // The arrays are positional, so a length mismatch means we cannot tell which
        // offset belongs to which rate.
        expect(buildLadder({ accumulator_barrier_offsets: [0.00006, 0.00005] })).toEqual([]);
    });

    it('drops rungs with a non-positive rate or offset', () => {
        const ladder = buildLadder({
            accumulator_range_list: [0, 0.02, 0.03],
            accumulator_barrier_offsets: [0.00006, 0, 0.000056949789],
        });

        expect(ladder.map(step => step.growthRate)).toEqual([0.03]);
    });

    it('tracks the spot, so the band stays anchored as the market moves', () => {
        const doubled = buildLadder({ current_spot: current_spot * 2 });

        expect(doubled[0].barrierSpotDistance).toBeCloseTo(buildLadder()[0].barrierSpotDistance * 2, 10);
    });
});
