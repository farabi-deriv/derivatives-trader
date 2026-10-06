import React from 'react';

// Base pixels of vertical travel per ladder step; tune on device with design.
const STEP_PX = 24;
// Release faster than this and the wheel keeps spinning, like the iOS picker; slower and it just stops.
const FLING_VELOCITY_PX_PER_MS = 0.25;
// Per-frame decay of that spin, and the speed at which it is considered stopped.
const FRICTION_PER_FRAME = 0.9;
const MIN_SPIN_VELOCITY_PX_PER_MS = 0.015;
// A thumb tops out around here. Clamping matters because two pointer events in the same millisecond
// yield an arbitrarily large sample, which would launch the wheel into a spin nothing asked for.
const MAX_VELOCITY_PX_PER_MS = 4;
// Assumed frame budget for the inertia integration; rAF does not report a delta.
const FRAME_MS = 16;
// Wheel delta per ladder step. One mouse notch is ~100, so a notch is exactly one step; a trackpad's
// many small deltas accumulate to the same rate. Deliberately coarser than STEP_PX — wheel deltas are
// an order of magnitude larger than drag pixels, so reusing STEP_PX would step ~4x per notch.
const WHEEL_STEP_DELTA = 100;
// Scrolling has no pointerup, so settle once the wheel has been quiet this long.
const WHEEL_SETTLE_MS = 120;

type TUseParamDrag = {
    /** Signed number of ladder steps for a pointermove (up = positive). */
    onStep: (delta: number) => void;
    /** The gesture ended — released, cancelled, or the flick's coast ran out. */
    onSettle?: () => void;
    step_px?: number;
};

/**
 * Turns a vertical pointer drag on the glass panel into ladder steps, modelled on the iOS clock
 * picker: the wheel tracks the finger 1:1 while held, and a flick keeps it spinning afterwards under
 * decaying friction until it settles. Touching again catches the wheel mid-spin.
 *
 * Travel converts as `trunc(dy / step_px)` with the sub-step remainder carried across moves, so the
 * value never drifts against the finger.
 */
const useParamDrag = ({ onStep, onSettle, step_px = STEP_PX }: TUseParamDrag) => {
    const drag = React.useRef({
        active: false,
        prev_y: 0,
        prev_t: 0,
        accumulated: 0, // displacement in px
        consumed: 0, // steps already emitted this drag
        velocity: 0, // px/ms at the last move, carried into the spin
    });
    const spin_frame = React.useRef<number | null>(null);
    const detach = React.useRef<(() => void) | null>(null);

    // Emits whatever whole steps the accumulated travel has crossed since the last emission.
    const emitSteps = React.useCallback(() => {
        const d = drag.current;
        const steps = Math.trunc(d.accumulated / step_px);
        const delta = steps - d.consumed;
        if (delta !== 0) {
            d.consumed = steps;
            onStep(delta);
        }
    }, [onStep, step_px]);

    const advance = React.useCallback(
        (client_y: number, time_stamp: number) => {
            const d = drag.current;
            if (!d.active) return;

            const raw_dy = d.prev_y - client_y; // drag up = positive = higher value
            const dt = Math.max(time_stamp - d.prev_t, 1);

            // 1:1 with the finger — no acceleration. The picker must not travel further than the
            // gesture, or the value slides out from under the fingertip that is aiming at it.
            d.accumulated += raw_dy;
            d.velocity = Math.max(-MAX_VELOCITY_PX_PER_MS, Math.min(raw_dy / dt, MAX_VELOCITY_PX_PER_MS));
            d.prev_y = client_y;
            d.prev_t = time_stamp;

            emitSteps();
        },
        [emitSteps]
    );

    const stopSpin = React.useCallback(() => {
        if (spin_frame.current !== null) cancelAnimationFrame(spin_frame.current);
        spin_frame.current = null;
    }, []);

    // The flick's coast: decay the release velocity frame by frame, emitting steps as it crosses them,
    // and settle once it is slow enough to read as stopped.
    const spin = React.useCallback(() => {
        const d = drag.current;
        d.velocity *= FRICTION_PER_FRAME;
        d.accumulated += d.velocity * FRAME_MS;
        emitSteps();

        if (Math.abs(d.velocity) < MIN_SPIN_VELOCITY_PX_PER_MS) {
            spin_frame.current = null;
            onSettle?.();
            return;
        }
        spin_frame.current = requestAnimationFrame(spin);
    }, [emitSteps, onSettle]);

    const settle = React.useCallback(
        (is_cancel: boolean) => {
            const d = drag.current;
            detach.current?.();
            detach.current = null;
            if (!d.active) return;
            d.active = false;

            // Released with speed: coast instead of stopping dead, and settle when the spin ends. A
            // tap has no velocity, so it falls straight through to the settle below.
            if (!is_cancel && Math.abs(d.velocity) >= FLING_VELOCITY_PX_PER_MS) {
                spin_frame.current = requestAnimationFrame(spin);
                return;
            }
            onSettle?.();
        },
        [spin, onSettle]
    );

    /**
     * Tracks the rest of the gesture on the document rather than on the panel.
     *
     * The panel is 136px tall, so a drag of any length leaves it almost immediately — and once it
     * does, an element-bound `pointermove` stops firing and the scroll dies mid-gesture.
     * `setPointerCapture` is meant to cover that, but it is unreliable across mobile browsers and
     * silently leaves the drag stuck. Document listeners have neither problem.
     */
    const onPointerDown = React.useCallback(
        (event: React.PointerEvent<HTMLElement>) => {
            // Touching a spinning wheel catches it, as on iOS.
            stopSpin();
            drag.current = {
                active: true,
                prev_y: event.clientY,
                prev_t: event.timeStamp,
                accumulated: 0,
                consumed: 0,
                velocity: 0,
            };

            const onMove = (e: PointerEvent) => advance(e.clientY, e.timeStamp);
            const onUp = () => settle(false);
            const onCancel = () => settle(true);

            detach.current?.();
            document.addEventListener('pointermove', onMove, { passive: true });
            document.addEventListener('pointerup', onUp, { passive: true });
            document.addEventListener('pointercancel', onCancel, { passive: true });
            detach.current = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                document.removeEventListener('pointercancel', onCancel);
            };
        },
        [advance, settle, stopSpin]
    );

    // A gesture in flight when this unmounts must not leave listeners or a frame loop behind.
    React.useEffect(
        () => () => {
            detach.current?.();
            stopSpin();
        },
        [stopSpin]
    );

    // Hovering and scrolling steps the value with no press at all — the design's "scroll over stake"
    // gesture, and the only one available to a mouse or trackpad, which never emit a pointer drag.
    const wheel = React.useRef<{ accumulated: number; timer: ReturnType<typeof setTimeout> | null }>({
        accumulated: 0,
        timer: null,
    });

    const onWheel = React.useCallback(
        (event: React.WheelEvent<HTMLElement>) => {
            const w = wheel.current;
            w.accumulated += -event.deltaY; // scroll up = higher value, matching the drag direction
            const steps = Math.trunc(w.accumulated / WHEEL_STEP_DELTA);
            if (steps !== 0) {
                w.accumulated -= steps * WHEEL_STEP_DELTA;
                onStep(steps);
            }
            if (w.timer) clearTimeout(w.timer);
            w.timer = setTimeout(() => {
                w.accumulated = 0;
                w.timer = null;
                onSettle?.();
            }, WHEEL_SETTLE_MS);
        },
        [onStep, onSettle]
    );

    React.useEffect(
        () => () => {
            if (wheel.current.timer) clearTimeout(wheel.current.timer);
        },
        []
    );

    return { onPointerDown, onWheel };
};

export default useParamDrag;
