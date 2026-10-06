import React from 'react';

import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';

import usePillDrag from '../use-pill-drag';

/**
 * A real node so the hook's direct `style.transform` writes are observable, with the rects stubbed:
 * jsdom computes no layout, so `getBoundingClientRect` is all zeroes and `offsetParent` is null.
 *
 * Models the pill as the CSS does — left-anchored 72px in (clear of the chart toolbar) inside an 800px
 * container, so changing its width moves its right edge and leaves its left edge put. The rect reports
 * whatever transform is currently applied, as a real element would.
 */
const buildRef = ({ origin_left = 72, width = 200, container_width = 800 } = {}) => {
    let current_width = width;
    const wrapper = document.createElement('div');
    const container = document.createElement('div');
    container.appendChild(wrapper);
    container.getBoundingClientRect = () => ({ left: 0, right: container_width, width: container_width }) as DOMRect;
    wrapper.getBoundingClientRect = () => {
        const applied = Number(/-?\d+(\.\d+)?/.exec(wrapper.style.transform)?.[0] ?? 0);
        const left = origin_left + applied;
        return { left, right: left + current_width, width: current_width } as DOMRect;
    };
    Object.defineProperty(wrapper, 'offsetParent', { get: () => container });
    return {
        ref: { current: wrapper } as React.RefObject<HTMLElement>,
        wrapper,
        /** The take-profit chip dropping in or out changes only the width. */
        setWidth: (next: number) => {
            current_width = next;
        },
    };
};

/** Stands in for SmartCharts' floating toolbar, which the pill must not be dragged over. */
const mountToolbar = ({ left = 16, width = 40 } = {}) => {
    const toolbar = document.createElement('div');
    toolbar.className = 'sc-toolbar-widget';
    toolbar.getBoundingClientRect = () => ({ left, right: left + width, width }) as DOMRect;
    document.body.appendChild(toolbar);
    return () => toolbar.remove();
};

const buildTargets = () => {
    const pill = document.createElement('div');
    const chip = document.createElement('div');
    chip.setAttribute('role', 'spinbutton');
    const label = document.createElement('span'); // inside the chip — still not a drag surface
    chip.appendChild(label);
    const buy = document.createElement('button');
    const chrome = document.createElement('div'); // the pill's own padding band
    pill.append(chip, buy, chrome);
    return { chip, label, buy, chrome };
};

const pointer = (x: number, target: Element) =>
    ({
        clientX: x,
        target,
        pointerId: 1,
        currentTarget: { setPointerCapture: jest.fn(), releasePointerCapture: jest.fn() },
    }) as unknown as React.PointerEvent<HTMLElement>;

const clickEvent = () =>
    ({ preventDefault: jest.fn(), stopPropagation: jest.fn() }) as unknown as React.MouseEvent<HTMLElement>;

describe('usePillDrag', () => {
    it('[LPD-001] a drag from the pill chrome moves it and commits on release', () => {
        const onCommit = jest.fn();
        const { chrome } = buildTargets();
        const { ref, wrapper } = buildRef();
        const { result } = renderHook(() => usePillDrag({ offset_x: 0, onCommit, wrapper_ref: ref }));

        act(() => result.current.onPointerDown(pointer(700, chrome)));
        act(() => result.current.onPointerMove(pointer(800, chrome)));

        expect(wrapper).toHaveStyle({ transform: 'translateX(100px)' });
        expect(result.current.is_dragging).toBe(true);

        act(() => result.current.onPointerUp(pointer(800, chrome)));

        expect(onCommit).toHaveBeenCalledWith(100);
    });

    it('[LPD-001] tracks the pointer 1:1 across successive moves rather than compounding', () => {
        const { chrome } = buildTargets();
        const { ref, wrapper } = buildRef();
        const { result } = renderHook(() => usePillDrag({ offset_x: 0, onCommit: jest.fn(), wrapper_ref: ref }));

        act(() => result.current.onPointerDown(pointer(700, chrome)));
        // Each move reports an absolute position, so the offset must equal total travel from the start.
        // Re-measuring the (already transformed) rect per move double-counted it and made this drift.
        act(() => result.current.onPointerMove(pointer(680, chrome)));
        expect(wrapper).toHaveStyle({ transform: 'translateX(-20px)' });
        act(() => result.current.onPointerMove(pointer(660, chrome)));
        expect(wrapper).toHaveStyle({ transform: 'translateX(-40px)' });
        act(() => result.current.onPointerMove(pointer(700, chrome)));
        expect(wrapper).toHaveStyle({ transform: '' });
    });

    it.each([
        ['a param chip', 'chip'],
        ['a chip’s inner label', 'label'],
        ['the Buy button', 'buy'],
    ] as const)('[LPD-002] a sideways drag from %s moves the pill — the whole pill is the surface', (_name, key) => {
        const onCommit = jest.fn();
        const targets = buildTargets();
        const { ref, wrapper } = buildRef();
        const { result } = renderHook(() => usePillDrag({ offset_x: 0, onCommit, wrapper_ref: ref }));

        act(() => result.current.onPointerDown(pointer(700, targets[key])));
        act(() => result.current.onPointerMove(pointer(660, targets[key])));

        expect(wrapper).toHaveStyle({ transform: 'translateX(-40px)' });

        act(() => result.current.onPointerUp(pointer(660, targets[key])));

        expect(onCommit).toHaveBeenCalledWith(-40);
    });

    it('[LPD-002] does not capture the pointer on a press, so a chip tap still reaches the chip', () => {
        // Capture retargets the click to the capturing element, so capturing on pointerdown — as this
        // did while controls were cut out of the drag surface — would deaden every chip and Buy tap.
        const { chip } = buildTargets();
        const { ref } = buildRef();
        const { result } = renderHook(() => usePillDrag({ offset_x: 0, onCommit: jest.fn(), wrapper_ref: ref }));

        const press = pointer(700, chip);
        act(() => result.current.onPointerDown(press));

        expect(press.currentTarget.setPointerCapture).not.toHaveBeenCalled();

        // Only once the press becomes a drag, so the rest of it reports here even over a chip or Buy.
        const move = pointer(660, chip);
        act(() => result.current.onPointerMove(move));

        expect(move.currentTarget.setPointerCapture).toHaveBeenCalledWith(1);
    });

    it('[LPD-003] stops at the chart toolbar rather than covering its controls', () => {
        // The toolbar ends at 56px, so the pill may come no closer than 72 — exactly where it rests.
        const unmount_toolbar = mountToolbar();
        try {
            const { chrome } = buildTargets();
            const { ref, wrapper } = buildRef();
            const { result } = renderHook(() => usePillDrag({ offset_x: 0, onCommit: jest.fn(), wrapper_ref: ref }));

            act(() => result.current.onPointerDown(pointer(700, chrome)));
            act(() => result.current.onPointerMove(pointer(0, chrome)));

            // Without the toolbar it could travel to the 16px container inset, 56px further left.
            expect(wrapper).toHaveStyle({ transform: '' });
        } finally {
            unmount_toolbar();
        }
    });

    it('[LPD-003] clamps at the container edge rather than sliding off', () => {
        const { chrome } = buildTargets();
        const { ref, wrapper } = buildRef();
        const { result } = renderHook(() => usePillDrag({ offset_x: 0, onCommit: jest.fn(), wrapper_ref: ref }));

        // The wrapper starts 72px in, so it can travel 72 - 16 = 56 left before meeting the inset.
        act(() => result.current.onPointerDown(pointer(700, chrome)));
        act(() => result.current.onPointerMove(pointer(0, chrome)));

        expect(wrapper).toHaveStyle({ transform: 'translateX(-56px)' });
    });

    it('[LPD-003] stays clamped, then follows the pointer again on the way back', () => {
        const { chrome } = buildTargets();
        const { ref, wrapper } = buildRef();
        const { result } = renderHook(() => usePillDrag({ offset_x: 0, onCommit: jest.fn(), wrapper_ref: ref }));

        act(() => result.current.onPointerDown(pointer(700, chrome)));
        act(() => result.current.onPointerMove(pointer(0, chrome))); // hard against the edge
        act(() => result.current.onPointerMove(pointer(100, chrome))); // still past it
        expect(wrapper).toHaveStyle({ transform: 'translateX(-56px)' });

        act(() => result.current.onPointerMove(pointer(680, chrome))); // back inside the range
        expect(wrapper).toHaveStyle({ transform: 'translateX(-20px)' });
    });

    it('[LPD-004] a press that never crosses the threshold commits nothing', () => {
        const onCommit = jest.fn();
        const { chrome } = buildTargets();
        const { ref, wrapper } = buildRef();
        const { result } = renderHook(() => usePillDrag({ offset_x: 0, onCommit, wrapper_ref: ref }));

        act(() => result.current.onPointerDown(pointer(700, chrome)));
        act(() => result.current.onPointerMove(pointer(704, chrome)));
        act(() => result.current.onPointerUp(pointer(704, chrome)));

        expect(onCommit).not.toHaveBeenCalled();
        expect(wrapper).toHaveStyle({ transform: '' });
        expect(result.current.is_dragging).toBe(false);
    });

    it('[LPD-005] suppresses the click after a drag, so releasing over Buy cannot purchase', () => {
        const { chrome } = buildTargets();
        const { ref } = buildRef();
        const { result } = renderHook(() => usePillDrag({ offset_x: 0, onCommit: jest.fn(), wrapper_ref: ref }));

        // Pointer capture retargets the release to the pill, so the drag can legitimately end over Buy.
        act(() => result.current.onPointerDown(pointer(700, chrome)));
        act(() => result.current.onPointerMove(pointer(600, chrome)));
        act(() => result.current.onPointerUp(pointer(600, chrome)));

        const click = clickEvent();
        act(() => result.current.onClickCapture(click));

        expect(click.stopPropagation).toHaveBeenCalled();
    });

    it('[LPD-005] lets a later tap on a chip through, so a drag does not deaden the controls', () => {
        const { chrome, chip } = buildTargets();
        const { ref } = buildRef();
        const { result } = renderHook(() => usePillDrag({ offset_x: 0, onCommit: jest.fn(), wrapper_ref: ref }));

        act(() => result.current.onPointerDown(pointer(700, chrome)));
        act(() => result.current.onPointerMove(pointer(600, chrome)));
        act(() => result.current.onPointerUp(pointer(600, chrome)));

        // A press on a control is by definition not a drag, so it has to clear the guard — otherwise
        // every tap on stake / take profit / Buy stays swallowed until the chrome is pressed again.
        act(() => result.current.onPointerDown(pointer(600, chip)));
        const click = clickEvent();
        act(() => result.current.onClickCapture(click));

        expect(click.stopPropagation).not.toHaveBeenCalled();
    });

    it('[LPD-005] lets a plain tap through', () => {
        const { chrome } = buildTargets();
        const { ref } = buildRef();
        const { result } = renderHook(() => usePillDrag({ offset_x: 0, onCommit: jest.fn(), wrapper_ref: ref }));

        act(() => result.current.onPointerDown(pointer(700, chrome)));
        act(() => result.current.onPointerUp(pointer(700, chrome)));

        const click = clickEvent();
        act(() => result.current.onClickCapture(click));

        expect(click.stopPropagation).not.toHaveBeenCalled();
    });

    it('[LPD-006] paints a no-longer-fitting offset inside the edge without overwriting it', () => {
        const onCommit = jest.fn();
        // 300px wide, so +500 would push the right edge past the container's inset.
        const { ref, wrapper } = buildRef({ width: 300 });
        renderHook(() => usePillDrag({ offset_x: 500, onCommit, wrapper_ref: ref }));

        // Painted at the furthest offset that still keeps a 16px inset...
        expect(wrapper).toHaveStyle({ transform: 'translateX(412px)' });
        // ...but the user's own position is untouched, so it can return when the pill narrows.
        // Committing here is what stranded the pill mid-screen after the chrome collapsed.
        expect(onCommit).not.toHaveBeenCalled();
    });

    it('[LPD-006] restores the dragged position once the pill fits again', () => {
        const onCommit = jest.fn();
        const { ref, wrapper, setWidth } = buildRef({ width: 300 });
        const { rerender } = renderHook(() => usePillDrag({ offset_x: 500, onCommit, wrapper_ref: ref }));

        expect(wrapper).toHaveStyle({ transform: 'translateX(412px)' });

        // The take-profit chip drops out: the pill narrows and +500 fits again.
        setWidth(100);
        rerender();

        expect(wrapper).toHaveStyle({ transform: 'translateX(500px)' });
        expect(onCommit).not.toHaveBeenCalled();
    });

    it('[LPD-006] leaves an offset that still fits alone', () => {
        const onCommit = jest.fn();
        const { ref, wrapper } = buildRef();
        renderHook(() => usePillDrag({ offset_x: 100, onCommit, wrapper_ref: ref }));

        expect(wrapper).toHaveStyle({ transform: 'translateX(100px)' });
        expect(onCommit).not.toHaveBeenCalled();
    });
});
