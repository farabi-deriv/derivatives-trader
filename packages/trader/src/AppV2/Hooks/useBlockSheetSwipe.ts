import React from 'react';

const WHEEL_ROW_SELECTOR = '.quill-wheel-picker__data-item';

const getWheelRow = (event: React.SyntheticEvent) => (event.target as Element).closest?.(WHEEL_ROW_SELECTOR) ?? null;

/**
 * Stops a drag that starts inside this element from reaching the action sheet.
 *
 * `shouldDetectSwipingOnContainer` binds quill's drag-to-close to the whole sheet via @use-gesture,
 * which listens through React props — so a gesture starting on a wheel picker bubbles up and
 * dismisses the sheet instead of scrolling the wheel. Only propagation is stopped, never the default,
 * so the wheel still scrolls.
 *
 * The sheet's `filterTaps` click guard cancels every click whose press it never saw, so a wheel row's
 * own `onClick` never runs; a press released on the same row is replayed the way that `onClick` does.
 *
 * Pointer and touch only. `mousedown` is redundant — browsers fire `pointerdown` for mouse input
 * too — and adding it breaks six tests, because jsdom implements no PointerEvent so @use-gesture
 * falls back to mouse events there.
 */
export const useBlockSheetSwipe = () => {
    const pressed_row_ref = React.useRef<Element | null>(null);

    const stopPropagation = React.useCallback((event: React.SyntheticEvent) => event.stopPropagation(), []);

    const onPointerDown = React.useCallback((event: React.PointerEvent) => {
        event.stopPropagation();
        pressed_row_ref.current = getWheelRow(event);
    }, []);

    const onPointerUp = React.useCallback((event: React.PointerEvent) => {
        const pressed_row = pressed_row_ref.current;
        pressed_row_ref.current = null;
        if (pressed_row && pressed_row === getWheelRow(event)) {
            pressed_row.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' });
        }
    }, []);

    const onPointerCancel = React.useCallback(() => {
        pressed_row_ref.current = null;
    }, []);

    return {
        onPointerDown,
        onPointerUp,
        onPointerCancel,
        onTouchStart: stopPropagation,
    };
};

export default useBlockSheetSwipe;
