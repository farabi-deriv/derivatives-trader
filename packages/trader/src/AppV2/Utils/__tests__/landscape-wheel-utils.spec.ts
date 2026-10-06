import { buildLadder, STAKE_FINE_LIMIT } from '../landscape-wheel-utils';

describe('landscape-wheel-utils', () => {
    describe('whole units (the default, used by take profit)', () => {
        it('[LTP-003] valueAt and indexOf are exact inverses across the range', () => {
            const { indexOf, valueAt, last_index } = buildLadder({ min: 1, max: 10 });

            for (let i = 0; i <= last_index; i++) {
                expect(indexOf(valueAt(i))).toBe(i);
            }
        });

        it('[LTP-003] every value is a whole number — the wheel never lands on a decimal', () => {
            const { valueAt, last_index } = buildLadder({ min: 0.4, max: 20 });

            for (let i = 0; i <= last_index; i++) {
                expect(Number.isInteger(valueAt(i))).toBe(true);
            }
        });

        it('[LTP-003] consecutive indices step by exactly 1', () => {
            const { valueAt } = buildLadder({ min: 1, max: 10 });

            expect([valueAt(0), valueAt(1), valueAt(2), valueAt(3)]).toEqual([1, 2, 3, 4]);
        });

        it('[LTP-003] a fractional min of 0.35 floors up to 1, never below the server minimum', () => {
            const { valueAt } = buildLadder({ min: 0.35, max: 5000 });

            expect(valueAt(0)).toBe(1);
        });

        it('[LTP-003] max is floored to a whole unit at or below max', () => {
            const { valueAt, last_index } = buildLadder({ min: 1, max: 10.07 });

            expect(valueAt(last_index)).toBe(10);
        });

        it('[LTP-003] indexOf clamps below min and above max', () => {
            const { indexOf, last_index } = buildLadder({ min: 1, max: 10 });

            expect(indexOf(0.1)).toBe(0);
            expect(indexOf(9999)).toBe(last_index);
        });

        it('[LTP-003] a degenerate range where no whole unit fits collapses to min, never a value outside it', () => {
            const { last_index, valueAt, indexOf } = buildLadder({ min: 2.2, max: 2.8 });

            expect(last_index).toBe(0);
            expect(valueAt(0)).toBe(2.2);
            expect(indexOf(2.5)).toBe(0);
        });
    });

    describe('quarter steps below fine_limit (the stake ladder)', () => {
        const buildStakeLadder = (bounds: { min: number; max: number }) =>
            buildLadder({ ...bounds, fine_limit: STAKE_FINE_LIMIT });

        it('[LTP-003] a window below the limit too narrow for a quarter collapses to min', () => {
            const { last_index, valueAt } = buildStakeLadder({ min: 2.3, max: 2.45 });

            expect(last_index).toBe(0);
            expect(valueAt(0)).toBe(2.3);
        });

        it.each([
            [0.35, 5000],
            [1, 10],
            [9.9, 10.4],
            [2.3, 2.45],
            [2.2, 2.8],
            [10.2, 10.9],
        ])('[LTP-003] never offers a value outside [%p, %p]', (min, max) => {
            const { last_index, valueAt } = buildStakeLadder({ min, max });

            for (let index = 0; index <= last_index; index++) {
                expect(valueAt(index)).toBeGreaterThanOrEqual(min);
                expect(valueAt(index)).toBeLessThanOrEqual(max);
            }
        });

        it('[LTP-012] steps by 0.25 from the floor', () => {
            const { valueAt } = buildStakeLadder({ min: 1, max: 5000 });

            expect([valueAt(0), valueAt(1), valueAt(2), valueAt(3), valueAt(4)]).toEqual([1, 1.25, 1.5, 1.75, 2]);
        });

        it('[LTP-012] switches to whole units at the limit, without repeating it', () => {
            const { valueAt, indexOf } = buildStakeLadder({ min: 1, max: 5000 });
            const boundary = indexOf(STAKE_FINE_LIMIT);

            // 1 -> 10 in quarters is 36 steps; the next index is the first whole-unit one.
            expect(boundary).toBe(36);
            expect([valueAt(boundary - 1), valueAt(boundary), valueAt(boundary + 1), valueAt(boundary + 2)]).toEqual([
                9.75, 10, 11, 12,
            ]);
        });

        it('[LTP-012] valueAt and indexOf stay exact inverses across both regions', () => {
            const { indexOf, valueAt } = buildStakeLadder({ min: 1, max: 60 });

            for (let i = 0; i <= indexOf(60); i++) {
                expect(indexOf(valueAt(i))).toBe(i);
            }
        });

        it('[LTP-012] no value carries float drift — every one is an exact quarter', () => {
            const { valueAt, last_index } = buildStakeLadder({ min: 1, max: 40 });

            for (let i = 0; i <= last_index; i++) {
                expect(Number.isInteger(valueAt(i) * 4)).toBe(true);
            }
        });

        it('[LTP-012] a fractional min rounds up to the next quarter, never below the server minimum', () => {
            const { valueAt } = buildStakeLadder({ min: 0.35, max: 5000 });

            expect(valueAt(0)).toBe(0.5);
        });

        it('[LTP-012] a max inside the fine region is floored to a quarter at or below it', () => {
            const { valueAt, last_index } = buildStakeLadder({ min: 1, max: 5.8 });

            expect(valueAt(last_index)).toBe(5.75);
        });

        it('[LTP-012] snaps an off-ladder value to the nearest quarter without committing it', () => {
            const { indexOf, valueAt } = buildStakeLadder({ min: 1, max: 5000 });

            expect(valueAt(indexOf(1.3))).toBe(1.25);
            expect(valueAt(indexOf(2.6))).toBe(2.5);
        });

        it('[LTP-012] a min above the limit is whole units throughout', () => {
            const { valueAt } = buildStakeLadder({ min: 12, max: 100 });

            expect([valueAt(0), valueAt(1), valueAt(2)]).toEqual([12, 13, 14]);
        });

        it('[LTP-012] indexOf clamps at both ends', () => {
            const { indexOf, last_index } = buildStakeLadder({ min: 1, max: 50 });

            expect(indexOf(0.1)).toBe(0);
            expect(indexOf(9999)).toBe(last_index);
        });
    });
});
