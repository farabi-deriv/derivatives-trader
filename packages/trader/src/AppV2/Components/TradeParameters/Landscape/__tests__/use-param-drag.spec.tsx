import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';

import useParamDrag from '../use-param-drag';

type TStubEvent = {
    clientY: number;
    timeStamp: number;
    pointerId?: number;
};

const makeEvent = ({ clientY, timeStamp, pointerId = 1 }: TStubEvent) =>
    ({ clientY, timeStamp, pointerId }) as unknown as React.PointerEvent<HTMLElement>;

// The drag tracks on the document after pointerdown, so the panel can be left mid-gesture without the
// scroll dying. jsdom has no PointerEvent, so carry the coordinates on a plain Event.
const dispatch = (type: string, { clientY, timeStamp }: { clientY?: number; timeStamp?: number } = {}) => {
    const event = Object.assign(new Event(type, { bubbles: true }), { clientY });
    // `timeStamp` is a read-only getter on Event, so it cannot ride along with Object.assign.
    Object.defineProperty(event, 'timeStamp', { value: timeStamp ?? 0 });
    document.dispatchEvent(event);
};

const totalSteps = (onStep: jest.Mock) => onStep.mock.calls.reduce((sum, [delta]) => sum + delta, 0);

// jsdom's rAF is timer-backed; run the queue by hand so the coast is deterministic.
const runSpin = (frames = 200) => {
    for (let i = 0; i < frames; i++) act(() => jest.advanceTimersByTime(16));
};

describe('useParamDrag', () => {
    it('[LTP-004] a slow 48px drag at STEP_PX 24 emits exactly 2 steps', () => {
        const onStep = jest.fn();
        const { result } = renderHook(() => useParamDrag({ onStep }));

        act(() => result.current.onPointerDown(makeEvent({ clientY: 100, timeStamp: 0 })));
        // dt = 200ms → velocity 0.24 px/ms, below the flick threshold, so no acceleration.
        act(() => dispatch('pointermove', { clientY: 52, timeStamp: 200 }));

        expect(totalSteps(onStep)).toBe(2);
    });

    it('[LTP-004] a press with no real travel settles without stepping', () => {
        const onStep = jest.fn();
        const onSettle = jest.fn();
        const { result } = renderHook(() => useParamDrag({ onStep, onSettle }));

        act(() => result.current.onPointerDown(makeEvent({ clientY: 100, timeStamp: 0 })));
        act(() => dispatch('pointermove', { clientY: 98, timeStamp: 200 }));
        act(() => dispatch('pointerup'));

        expect(onStep).not.toHaveBeenCalled();
        expect(onSettle).toHaveBeenCalledTimes(1);
    });

    it('[LTP-004] the sub-step remainder carries into the next pointermove', () => {
        const onStep = jest.fn();
        const { result } = renderHook(() => useParamDrag({ onStep }));

        act(() => result.current.onPointerDown(makeEvent({ clientY: 100, timeStamp: 0 })));
        act(() => dispatch('pointermove', { clientY: 85, timeStamp: 200 }));
        expect(totalSteps(onStep)).toBe(0);

        act(() => dispatch('pointermove', { clientY: 70, timeStamp: 400 }));
        expect(totalSteps(onStep)).toBe(1);
    });

    it('[LTP-005] a flick keeps the wheel spinning after release, then settles', () => {
        jest.useFakeTimers();
        try {
            const onStep = jest.fn();
            const onSettle = jest.fn();
            const { result } = renderHook(() => useParamDrag({ onStep, onSettle }));

            // 60px in 30ms — 2 px/ms, well past the fling threshold.
            act(() => result.current.onPointerDown(makeEvent({ clientY: 300, timeStamp: 0 })));
            act(() => dispatch('pointermove', { clientY: 240, timeStamp: 30 }));
            const steps_on_release = totalSteps(onStep);
            act(() => dispatch('pointerup'));

            // The release itself must not settle — the wheel is still coasting.
            expect(onSettle).not.toHaveBeenCalled();

            runSpin();

            expect(totalSteps(onStep)).toBeGreaterThan(steps_on_release);
            expect(onSettle).toHaveBeenCalledTimes(1);
        } finally {
            jest.useRealTimers();
        }
    });

    it('[LTP-005] a slow release stops dead instead of coasting', () => {
        jest.useFakeTimers();
        try {
            const onStep = jest.fn();
            const onSettle = jest.fn();
            const { result } = renderHook(() => useParamDrag({ onStep, onSettle }));

            // 60px over 2s — a deliberate placement, not a flick.
            act(() => result.current.onPointerDown(makeEvent({ clientY: 300, timeStamp: 0 })));
            act(() => dispatch('pointermove', { clientY: 240, timeStamp: 2000 }));
            act(() => dispatch('pointerup'));

            expect(onSettle).toHaveBeenCalledTimes(1);
            const steps_at_release = totalSteps(onStep);

            runSpin();

            expect(totalSteps(onStep)).toBe(steps_at_release);
        } finally {
            jest.useRealTimers();
        }
    });

    it('[LTP-005] touching a spinning wheel catches it without settling mid-gesture', () => {
        jest.useFakeTimers();
        try {
            const onStep = jest.fn();
            const onSettle = jest.fn();
            const { result } = renderHook(() => useParamDrag({ onStep, onSettle }));

            act(() => result.current.onPointerDown(makeEvent({ clientY: 300, timeStamp: 0 })));
            act(() => dispatch('pointermove', { clientY: 240, timeStamp: 30 }));
            act(() => dispatch('pointerup'));
            act(() => jest.advanceTimersByTime(16)); // one frame of coast

            onSettle.mockClear();
            act(() => result.current.onPointerDown(makeEvent({ clientY: 240, timeStamp: 100 })));
            const steps_when_caught = totalSteps(onStep);

            // A frame left queued would run against the caught wheel and settle the editor under a
            // gesture that is still in progress.
            runSpin(8);

            expect(onSettle).not.toHaveBeenCalled();
            expect(totalSteps(onStep)).toBe(steps_when_caught);
        } finally {
            jest.useRealTimers();
        }
    });

    it('[LTP-004] pointercancel ends the drag and settles', () => {
        const onSettle = jest.fn();
        const { result } = renderHook(() => useParamDrag({ onStep: jest.fn(), onSettle }));

        act(() => result.current.onPointerDown(makeEvent({ clientY: 100, timeStamp: 0 })));
        act(() => dispatch('pointermove', { clientY: 40, timeStamp: 200 }));
        act(() => dispatch('pointercancel'));

        expect(onSettle).toHaveBeenCalledTimes(1);
    });

    it('[LTP-004] keeps stepping once the pointer has left the panel', () => {
        // The panel is only 136px tall, so any real drag leaves it almost at once. Tracking on the
        // document is what stops the scroll dying there.
        const onStep = jest.fn();
        const { result } = renderHook(() => useParamDrag({ onStep }));

        act(() => result.current.onPointerDown(makeEvent({ clientY: 300, timeStamp: 0 })));
        act(() => dispatch('pointermove', { clientY: 200, timeStamp: 400 }));
        act(() => dispatch('pointermove', { clientY: 100, timeStamp: 800 }));

        // 200px of travel at 24px a step, well past the panel's own height.
        expect(totalSteps(onStep)).toBe(8);
    });

    it('[LTP-004] stops tracking after the gesture ends', () => {
        const onStep = jest.fn();
        const { result } = renderHook(() => useParamDrag({ onStep }));

        act(() => result.current.onPointerDown(makeEvent({ clientY: 100, timeStamp: 0 })));
        act(() => dispatch('pointerup'));
        onStep.mockClear();

        act(() => dispatch('pointermove', { clientY: 20, timeStamp: 400 }));

        expect(onStep).not.toHaveBeenCalled();
    });
});
