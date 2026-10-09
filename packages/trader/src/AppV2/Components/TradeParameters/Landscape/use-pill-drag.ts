import React from 'react';

// Travel before a press becomes a drag, so a tap on the pill never nudges it.
const DRAG_THRESHOLD_PX = 8;
// Gap kept between the pill and the chart's edges, matching its anchored inset.
const EDGE_INSET_PX = 16;
// The drag stops short of the fullscreen button.
const OBSTACLE_SELECTOR = '.landscape-fullscreen-button';
const OBSTACLE_GAP_PX = 8;

type TBounds = { min: number; max: number };

type TUsePillDrag = {
    /** The committed offset, from the store. */
    offset_x: number;
    /** Fired with the final clamped offset on release. Never fired for a transient re-clamp. */
    onCommit: (offset_x: number) => void;
    /** The element that actually moves; measured for clamping and written to during a drag. */
    wrapper_ref: React.RefObject<HTMLElement>;
};

const clamp = (value: number, { min, max }: TBounds) => Math.min(Math.max(value, min), max);

/**
 * Horizontal-only drag for the floating params pill, so it can be slid aside to uncover the chart.
 *
 * The whole pill is the drag surface, chips and Buy included. Those are tap targets, so the pointer is
 * captured only once the drag is claimed: capturing on press would retarget their click to the pill
 * and deaden them.
 *
 * The transform is written straight to the node while dragging. Going through React state instead
 * re-rendered an observer — re-running both parameter adapters and rebuilding their ladders — on every
 * pointermove, which is what made the drag stutter.
 */
const usePillDrag = ({ offset_x, onCommit, wrapper_ref }: TUsePillDrag) => {
    const [is_dragging, setIsDragging] = React.useState(false);
    const drag = React.useRef({
        active: false,
        is_moving: false,
        start_x: 0,
        // Painted offset at the press; starting from the stored one left a dead zone when clamped.
        origin: 0,
        offset: 0,
        bounds: null as TBounds | null,
    });
    // Read by the click guard: a drag must not also act on whatever it was released over.
    const was_drag = React.useRef(false);
    // What the node is currently painted at. This hook is the ONLY writer of the transform, so this
    // stays true — and `measureBounds` needs it to recover the untransformed origin.
    const painted = React.useRef(0);

    const applyTransform = React.useCallback(
        (offset: number) => {
            const wrapper = wrapper_ref.current;
            if (!wrapper) return;
            wrapper.style.transform = offset ? `translateX(${offset}px)` : '';
            painted.current = offset;
        },
        [wrapper_ref]
    );

    /**
     * The offsets at which the pill's edges meet the container's insets.
     *
     * Measured from the *untransformed* position: the rect carries whatever is painted, so subtracting
     * that recovers the origin. Subtracting the stored offset instead was wrong whenever the two
     * differed — the error compounded on every render and walked the pill off the screen.
     *
     * Derived from live rects rather than a signed range: the pill's anchored edge flips with reading
     * direction, so "outwards" has no fixed sign.
     */
    const measureBounds = React.useCallback((): TBounds | null => {
        const wrapper = wrapper_ref.current;
        const container = wrapper?.offsetParent as HTMLElement | null;
        if (!wrapper || !container) return null;
        const box = wrapper.getBoundingClientRect();
        const edges = container.getBoundingClientRect();

        const origin_left = box.left - painted.current;
        const origin_right = box.right - painted.current;
        let min = edges.left + EDGE_INSET_PX - origin_left;
        let max = edges.right - EDGE_INSET_PX - origin_right;
        // Too wide to sit between the limits: any clamp would fight itself, so leave it anchored.
        if (min > max) return null;

        // Fullscreen button: never past it, and no closer if it already leaves no room.
        const obstacle = container.querySelector(OBSTACLE_SELECTOR)?.getBoundingClientRect();
        if (obstacle && obstacle.top < box.bottom && obstacle.bottom > box.top) {
            if (obstacle.left + obstacle.width / 2 > edges.left + edges.width / 2) {
                max = Math.max(min, Math.min(max, obstacle.left - OBSTACLE_GAP_PX - origin_right));
            } else {
                min = Math.min(max, Math.max(min, obstacle.right + OBSTACLE_GAP_PX - origin_left));
            }
        }
        return { min, max };
    }, [wrapper_ref]);

    const onPointerDown = React.useCallback(
        (event: React.PointerEvent<HTMLElement>) => {
            // Cleared on every press, so a tap after a drag is not still swallowed by the click guard.
            was_drag.current = false;
            drag.current = {
                active: true,
                is_moving: false,
                start_x: event.clientX,
                origin: painted.current,
                offset: painted.current,
                // Measured once per gesture: the pill's size cannot change mid-drag, and re-measuring
                // per move would read back the transform this drag is applying.
                bounds: measureBounds(),
            };
        },
        [measureBounds]
    );

    const onPointerMove = React.useCallback(
        (event: React.PointerEvent<HTMLElement>) => {
            const d = drag.current;
            if (!d.active) return;
            const dx = event.clientX - d.start_x;
            if (!d.is_moving) {
                if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
                d.is_moving = true;
                was_drag.current = true;
                setIsDragging(true);
                // Claimed: capture now so the rest of the drag reports here even over a chip or Buy.
                // Best-effort — it throws for a pointer id the environment doesn't know.
                try {
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                } catch {
                    // no capture available
                }
            }
            const next = d.origin + dx;
            d.offset = d.bounds ? clamp(next, d.bounds) : next;
            applyTransform(d.offset);
        },
        [applyTransform]
    );

    const end = React.useCallback(
        (event?: React.PointerEvent<HTMLElement>) => {
            const d = drag.current;
            if (d.active && event) {
                try {
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                } catch {
                    // nothing was captured
                }
            }
            drag.current = { ...d, active: false, is_moving: false };
            if (!d.is_moving) return;
            setIsDragging(false);
            onCommit(d.offset);
        },
        [onCommit]
    );

    // Pointer capture retargets the release to the pill, so a drag let go over Buy would land a click
    // on it. Capture phase, so the click never reaches any control inside.
    const onClickCapture = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
        if (!was_drag.current) return;
        event.preventDefault();
        event.stopPropagation();
    }, []);

    // Clamps the paint only, never the stored offset, so the pill returns there once it fits again.
    const offset_ref = React.useRef(offset_x);
    offset_ref.current = offset_x;
    const reclamp = React.useCallback(() => {
        if (drag.current.active) return;
        const bounds = measureBounds();
        applyTransform(bounds ? clamp(offset_ref.current, bounds) : offset_ref.current);
    }, [applyTransform, measureBounds]);

    React.useLayoutEffect(reclamp, [reclamp, offset_x]);

    // Expand/collapse transitions and chart resizes; fires before paint, every frame.
    React.useEffect(() => {
        const wrapper = wrapper_ref.current;
        if (!wrapper || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(reclamp);
        observer.observe(wrapper);
        if (wrapper.offsetParent) observer.observe(wrapper.offsetParent);
        return () => observer.disconnect();
    }, [wrapper_ref, reclamp]);

    return {
        is_dragging,
        onPointerDown,
        onPointerMove,
        onPointerUp: end,
        onPointerCancel: end,
        onClickCapture,
    };
};

export default usePillDrag;
