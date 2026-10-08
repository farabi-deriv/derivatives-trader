import React from 'react';

import { useStore } from '@deriv/stores';

import { CHART_MAXIMIZE_ANIMATION_MS } from 'AppV2/Utils/layout-utils';

const DEFAULT_DELAY_MS = 8000;
// Only a tap on the chart toggles the chrome ("Tap on the chart to hide or reveal the controls").
// Everything else — the chrome, and any overlay portalled to <body> (toasts, sheets, the selector) —
// is its own interaction, so a new overlay can never have its first tap eaten by the click guard.
const CHART_SELECTOR = '.trade-landscape__chart-tooltip';
// Controls over the chart that own their taps (`sc-dialog` sits on every chart dialog).
const CHART_CONTROLS_SELECTOR =
    '.landscape-params, .landscape-fullscreen-button, .sc-toolbar-widget, .sc-dialog, .scroll_to_recent';

const isChartTap = (target: Element | null) =>
    !!target?.closest?.(CHART_SELECTOR) && !target.closest(CHART_CONTROLS_SELECTOR);
// Travel above which a press is a pan, not a tap. Matches the ~10px slop browsers use to separate a
// click from a drag — tight enough to reject a chart pan, loose enough for a wobbly thumb.
const TAP_SLOP_PX = 10;

type TUseAutoHideChrome = {
    /** While true the timer never hides chrome (a parameter editor / virtual keyboard is open). */
    is_paused?: boolean;
    delay_ms?: number;
    /**
     * Set by something that owns the gesture already, to stop it also toggling the chrome.
     *
     * A ref rather than a prop because of when it has to be written. This hook decides what a
     * gesture means from a document listener in the CAPTURE phase, so it runs before the event
     * reaches whatever it is actually over — a React handler, or the chart's canvas. Anything that
     * wants to claim a gesture therefore has to do it between this hook's pointerdown and its
     * pointerup, which no amount of re-rendering can express. Cleared here at the start of every
     * gesture, so a claim can never outlive the one it was made for.
     */
    tap_claim_ref?: React.MutableRefObject<boolean>;
};

/**
 * Auto-hides the landscape chrome (nav rail, header, pill) after `delay_ms` of inactivity. A tap on
 * the chart toggles it either way; the event still reaches its real target.
 * @returns `is_animating`, true for the ~300ms flip so the chart transition can be neutralised.
 */
const useAutoHideChrome = ({
    is_paused = false,
    delay_ms = DEFAULT_DELAY_MS,
    tap_claim_ref,
}: TUseAutoHideChrome = {}) => {
    const { ui } = useStore();
    const { is_landscape_chrome_hidden, setLandscapeChromeHidden } = ui;
    const [is_animating, setIsAnimating] = React.useState(false);

    const hide_timer = React.useRef<ReturnType<typeof setTimeout>>();
    const animate_timer = React.useRef<ReturnType<typeof setTimeout>>();
    // Where the press started, whether it can still become a toggle, and what was open when it began.
    const tap = React.useRef({ x: 0, y: 0, is_candidate: false, was_paused: false });
    // Armed when a tap restores the chrome. The click that follows is hit-tested after the rail is back,
    // so without this the same tap also presses whatever it revealed — positions, or Trade routing home.
    const swallow_click = React.useRef(false);

    // The document listener is registered once, so read the latest pause/hidden state through refs.
    const is_paused_ref = React.useRef(is_paused);
    const is_hidden_ref = React.useRef(is_landscape_chrome_hidden);
    is_paused_ref.current = is_paused;
    is_hidden_ref.current = is_landscape_chrome_hidden;
    const tap_claim = React.useRef(tap_claim_ref);
    tap_claim.current = tap_claim_ref;

    const armAnimation = React.useCallback(() => {
        setIsAnimating(true);
        if (animate_timer.current) clearTimeout(animate_timer.current);
        animate_timer.current = setTimeout(() => setIsAnimating(false), CHART_MAXIMIZE_ANIMATION_MS);
    }, []);

    const hide = React.useCallback(() => {
        if (is_paused_ref.current || is_hidden_ref.current) return;
        armAnimation();
        setLandscapeChromeHidden(true);
    }, [armAnimation, setLandscapeChromeHidden]);

    const armTimer = React.useCallback(() => {
        if (hide_timer.current) clearTimeout(hide_timer.current);
        if (is_paused_ref.current) return;
        hide_timer.current = setTimeout(hide, delay_ms);
    }, [hide, delay_ms]);

    React.useEffect(() => {
        // Capture + passive, never preventDefault, so the gesture still reaches its target. Decided on
        // pointerUP so travel can be measured — a chart pan emits the same pointerdown as a tap.
        const onPointerDown = (event: PointerEvent) => {
            // Cleared per gesture, so a restore whose click never arrived cannot eat a later one.
            swallow_click.current = false;
            // Cleared here, in the capture phase, so whatever claims this gesture does so after —
            // and so last gesture's claim cannot leak into this one.
            if (tap_claim.current) tap_claim.current.current = false;
            tap.current = {
                x: event.clientX,
                y: event.clientY,
                is_candidate: isChartTap(event.target as Element | null),
                // Read the pause HERE: dismissing a panel releases it on this same pointerdown, so by
                // pointerup the gesture would look like a plain chart tap.
                was_paused: is_paused_ref.current,
            };
        };

        const onPointerUp = (event: PointerEvent) => {
            const start = tap.current;
            tap.current = { ...start, is_candidate: false };
            if (!start.is_candidate) return;

            // Any real travel means a pan, not a tap. It still counts as activity, so re-arm the timer
            // rather than letting the chrome hide out from under an active gesture.
            if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP_PX) {
                armTimer();
                return;
            }

            // Spent on dismissing what was open: no toggle either way, but still activity.
            if (start.was_paused) {
                armTimer();
                return;
            }

            // Claimed by whatever it landed on — the Accumulators band, say, which opens its own
            // control. Still the user being active, so the countdown restarts; just not a toggle.
            if (tap_claim.current?.current) {
                armTimer();
                return;
            }

            armAnimation();
            if (is_hidden_ref.current) {
                swallow_click.current = true;
                setLandscapeChromeHidden(false);
                armTimer();
                return;
            }
            if (is_paused_ref.current) return;
            if (hide_timer.current) clearTimeout(hide_timer.current);
            setLandscapeChromeHidden(true);
        };

        const onPointerCancel = () => {
            tap.current = { ...tap.current, is_candidate: false };
        };

        // Capture on the document, so it runs before React's own listeners on the root container.
        const onClickCapture = (event: MouseEvent) => {
            if (!swallow_click.current) return;
            swallow_click.current = false;
            event.preventDefault();
            event.stopPropagation();
        };

        document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
        document.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
        document.addEventListener('pointercancel', onPointerCancel, { capture: true, passive: true });
        document.addEventListener('click', onClickCapture, { capture: true });
        armTimer();

        return () => {
            document.removeEventListener('pointerdown', onPointerDown, { capture: true });
            document.removeEventListener('pointerup', onPointerUp, { capture: true });
            document.removeEventListener('pointercancel', onPointerCancel, { capture: true });
            document.removeEventListener('click', onClickCapture, { capture: true });
            if (hide_timer.current) clearTimeout(hide_timer.current);
            if (animate_timer.current) clearTimeout(animate_timer.current);
            // Reset so the rail can never be left hidden on another page (rotate-back, navigate away).
            setLandscapeChromeHidden(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Pause clears the timer; releasing it re-arms from that moment.
    React.useEffect(() => {
        armTimer();
    }, [is_paused, armTimer]);

    return { is_animating };
};

export default useAutoHideChrome;
