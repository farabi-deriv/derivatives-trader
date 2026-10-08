import React from 'react';

import { mockStore, StoreProvider } from '@deriv/stores';
import { act, render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';

import useAutoHideChrome from '../useAutoHideChrome';

// Mirrors the hook's own default; the two must move together.
const DEFAULT_DELAY_MS = 8000;

// jsdom has no PointerEvent constructor, so carry the coordinates on a plain Event.
const pointerEvent = (type: string, x: number, y: number) =>
    Object.assign(new Event(type, { bubbles: true, cancelable: true }), { clientX: x, clientY: y });

// The only surface whose taps toggle the chrome.
const CHART_CLASS = 'trade-landscape__chart-tooltip';
// A plain node, created on first use: taps happen inside `act`, where a render would not commit in time.
const chart = () => {
    const existing = screen.queryByTestId('chart');
    if (existing) return existing;
    const node = document.createElement('div');
    node.className = CHART_CLASS;
    node.dataset.testid = 'chart';
    document.body.appendChild(node);
    return node;
};

const buildWrapper = ({ is_hidden = false }: { is_hidden?: boolean } = {}) => {
    const store = mockStore({ ui: { is_landscape_chrome_hidden: is_hidden } });
    // `is_paused` is declared (optional) so the wrapper also satisfies the typed-props `renderHook`
    // call below: `PropsWithChildren<unknown>` is `{ children?: ReactNode }`, a weak type that TS
    // refuses to assign to `WrapperComponent<{ is_paused: boolean }>` for sharing no properties.
    const wrapper = ({ children }: React.PropsWithChildren<{ is_paused?: boolean }>) => (
        <StoreProvider store={store}>{children}</StoreProvider>
    );
    return { store, wrapper };
};

describe('useAutoHideChrome', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        screen.queryByTestId('chart')?.remove();
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('[LAH-001] hides chrome after the default delay', () => {
        const { store, wrapper } = buildWrapper({ is_hidden: false });

        renderHook(() => useAutoHideChrome({ is_paused: false }), { wrapper });

        act(() => jest.advanceTimersByTime(DEFAULT_DELAY_MS - 1));
        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalledWith(true);

        act(() => jest.advanceTimersByTime(1));
        expect(store.ui.setLandscapeChromeHidden).toHaveBeenCalledWith(true);
    });

    it('[LAH-002] a tap restores chrome and still reaches its target', () => {
        const { store, wrapper } = buildWrapper({ is_hidden: true });
        renderHook(() => useAutoHideChrome({ is_paused: false }), { wrapper });

        const inner_handler = jest.fn();
        render(
            <div className={CHART_CLASS}>
                <button onPointerDown={inner_handler}>chart</button>
            </div>
        );
        const button = screen.getByRole('button');

        const down = pointerEvent('pointerdown', 100, 100);
        act(() => {
            button.dispatchEvent(down);
            button.dispatchEvent(pointerEvent('pointerup', 100, 100));
        });

        expect(store.ui.setLandscapeChromeHidden).toHaveBeenCalledWith(false);
        expect(inner_handler).toHaveBeenCalled();
        expect(down.defaultPrevented).toBe(false);
    });

    it('[LAH-002] the tap that restores chrome does not also press what it revealed', () => {
        // The click is hit-tested after the rail is back, so it landed on whichever nav item appeared
        // under the finger — opening positions, or routing home from Trade.
        const { wrapper } = buildWrapper({ is_hidden: true });
        renderHook(() => useAutoHideChrome({ is_paused: false }), { wrapper });

        const nav_item = jest.fn();
        render(<button onClick={nav_item}>positions</button>);
        const button = screen.getByRole('button');

        // Pressed on the chart; by the time the click is hit-tested the rail is back under the finger.
        act(() => {
            chart().dispatchEvent(pointerEvent('pointerdown', 100, 100));
            chart().dispatchEvent(pointerEvent('pointerup', 100, 100));
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });

        expect(nav_item).not.toHaveBeenCalled();
    });

    it('[LAH-002] only that one click is swallowed, so the rail works from then on', () => {
        const { wrapper } = buildWrapper({ is_hidden: true });
        renderHook(() => useAutoHideChrome({ is_paused: false }), { wrapper });

        const nav_item = jest.fn();
        render(<button onClick={nav_item}>positions</button>);
        const button = screen.getByRole('button');

        act(() => {
            chart().dispatchEvent(pointerEvent('pointerdown', 100, 100));
            chart().dispatchEvent(pointerEvent('pointerup', 100, 100));
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });

        act(() => {
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });

        expect(nav_item).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['the market selector', 'market-selection__modal'],
        // The contract-result toast is a link to the contract; quill gives it only the --mobile class.
        ['a notification toast', 'quill-notification__banners--mobile'],
    ])('[LAH-002] a tap on %s, portalled outside the chart, acts on the first tap', (_name, class_name) => {
        // Read as a chart tap, it restored the chrome and the guard above ate its click.
        const { store, wrapper } = buildWrapper({ is_hidden: true });
        renderHook(() => useAutoHideChrome({ is_paused: false }), { wrapper });

        const onTap = jest.fn();
        render(
            <div className={class_name}>
                <button onClick={onTap}>target</button>
            </div>
        );
        const target = screen.getByRole('button', { name: 'target' });

        act(() => {
            target.dispatchEvent(pointerEvent('pointerdown', 100, 100));
            target.dispatchEvent(pointerEvent('pointerup', 100, 100));
            target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });

        expect(onTap).toHaveBeenCalled();
        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalled();
    });

    it('[LAH-002] a tap inside the market selector picks on the first tap, not the second', () => {
        // It portals to <body>, outside the chart, so it is not a chart tap.
        const { wrapper } = buildWrapper({ is_hidden: true });
        renderHook(() => useAutoHideChrome({ is_paused: false }), { wrapper });

        const onSelect = jest.fn();
        render(
            <div className='market-selection__modal'>
                <button onClick={onSelect}>Volatility 25 Index</button>
            </div>
        );
        const row = screen.getByRole('button');

        act(() => {
            row.dispatchEvent(pointerEvent('pointerdown', 100, 100));
            row.dispatchEvent(pointerEvent('pointerup', 100, 100));
            row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });

        expect(onSelect).toHaveBeenCalled();
    });

    it('[LAH-005] a tap while chrome is visible collapses it', () => {
        const { store, wrapper } = buildWrapper({ is_hidden: false });
        renderHook(() => useAutoHideChrome({ is_paused: false }), { wrapper });

        act(() => {
            chart().dispatchEvent(pointerEvent('pointerdown', 100, 100));
            chart().dispatchEvent(pointerEvent('pointerup', 104, 102));
        });

        expect(store.ui.setLandscapeChromeHidden).toHaveBeenCalledWith(true);
    });

    it('[LAH-006] dragging the chart does not toggle', () => {
        // Panning emits the same pointerdown as a tap. Toggling on it made the chrome flicker in and
        // out for the whole drag.
        const { store, wrapper } = buildWrapper({ is_hidden: false });
        renderHook(() => useAutoHideChrome({ is_paused: false }), { wrapper });

        act(() => {
            chart().dispatchEvent(pointerEvent('pointerdown', 100, 100));
            chart().dispatchEvent(pointerEvent('pointerup', 260, 104));
        });

        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalled();
    });

    describe('a gesture claimed by what it landed on', () => {
        // The Accumulators band is the case: tapping it opens the chart's own growth-rate
        // control, and that tap is not also a request to maximize the view. The claim is
        // written between this hook's pointerdown and its pointerup, because the hook
        // listens in the capture phase and so decides before the event reaches the chart.
        const claimDuringGesture = (claim: React.MutableRefObject<boolean>) => {
            chart().dispatchEvent(pointerEvent('pointerdown', 100, 100));
            claim.current = true;
            chart().dispatchEvent(pointerEvent('pointerup', 100, 100));
        };

        it('does not collapse visible chrome', () => {
            const { store, wrapper } = buildWrapper({ is_hidden: false });
            const tap_claim_ref = { current: false };
            renderHook(() => useAutoHideChrome({ is_paused: false, tap_claim_ref }), { wrapper });

            act(() => claimDuringGesture(tap_claim_ref));

            expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalled();
        });

        it('does not restore hidden chrome either', () => {
            const { store, wrapper } = buildWrapper({ is_hidden: true });
            const tap_claim_ref = { current: false };
            renderHook(() => useAutoHideChrome({ is_paused: false, tap_claim_ref }), { wrapper });

            act(() => claimDuringGesture(tap_claim_ref));

            expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalled();
        });

        it('still counts as activity, so the countdown restarts', () => {
            const { store, wrapper } = buildWrapper({ is_hidden: false });
            const tap_claim_ref = { current: false };
            renderHook(() => useAutoHideChrome({ is_paused: false, tap_claim_ref }), { wrapper });

            act(() => jest.advanceTimersByTime(DEFAULT_DELAY_MS - 1000));
            act(() => claimDuringGesture(tap_claim_ref));

            // Would have hidden by now had the claim not re-armed the timer.
            act(() => jest.advanceTimersByTime(1000));
            expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalled();

            act(() => jest.advanceTimersByTime(DEFAULT_DELAY_MS));
            expect(store.ui.setLandscapeChromeHidden).toHaveBeenCalledWith(true);
        });

        it('cannot leak into the next gesture', () => {
            const { store, wrapper } = buildWrapper({ is_hidden: false });
            const tap_claim_ref = { current: false };
            renderHook(() => useAutoHideChrome({ is_paused: false, tap_claim_ref }), { wrapper });

            act(() => claimDuringGesture(tap_claim_ref));
            expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalled();

            // A plain tap on the screen afterwards toggles as it always did: the claim is
            // cleared at the start of every gesture, not when it is honoured.
            act(() => {
                chart().dispatchEvent(pointerEvent('pointerdown', 100, 100));
                chart().dispatchEvent(pointerEvent('pointerup', 100, 100));
            });

            expect(store.ui.setLandscapeChromeHidden).toHaveBeenCalledWith(true);
        });

        it('leaves the toggle alone when nothing claims the gesture', () => {
            const { store, wrapper } = buildWrapper({ is_hidden: false });
            const tap_claim_ref = { current: false };
            renderHook(() => useAutoHideChrome({ is_paused: false, tap_claim_ref }), { wrapper });

            act(() => {
                chart().dispatchEvent(pointerEvent('pointerdown', 100, 100));
                chart().dispatchEvent(pointerEvent('pointerup', 100, 100));
            });

            expect(store.ui.setLandscapeChromeHidden).toHaveBeenCalledWith(true);
        });
    });

    it('[LAH-006] a cancelled gesture does not toggle', () => {
        const { store, wrapper } = buildWrapper({ is_hidden: false });
        renderHook(() => useAutoHideChrome({ is_paused: false }), { wrapper });

        act(() => {
            chart().dispatchEvent(pointerEvent('pointerdown', 100, 100));
            chart().dispatchEvent(pointerEvent('pointercancel', 100, 100));
            chart().dispatchEvent(pointerEvent('pointerup', 100, 100));
        });

        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalled();
    });

    // Collapsing on a control tap would drop the take-profit chip mid-scroll or, for the chart's own
    // toolbar, flip the chrome while picking an indicator.
    it.each([
        ['the params pill', 'landscape-params'],
        ['the chart toolbar', 'sc-toolbar-widget'],
        ['a chart dialog', 'sc-dialog'],
        ['the fullscreen button', 'landscape-fullscreen-button'],
        ['scroll to recent', 'scroll_to_recent'],
    ])('[LAH-005] a tap on %s, over the chart, does not toggle', (_name, class_name) => {
        const { store, wrapper } = buildWrapper({ is_hidden: false });
        renderHook(() => useAutoHideChrome({ is_paused: false }), { wrapper });

        render(
            <div className={CHART_CLASS}>
                <div className={class_name}>
                    <button>control</button>
                </div>
            </div>
        );
        const control = screen.getByRole('button');

        // A full tap: the toggle decision is made on pointerup, so a pointerdown alone proves nothing.
        act(() => {
            control.dispatchEvent(pointerEvent('pointerdown', 100, 100));
            control.dispatchEvent(pointerEvent('pointerup', 100, 100));
        });

        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalled();
    });

    // Not a chart tap, so nothing to list per surface: anything new is excluded by default.
    it.each([
        ['the landscape header', 'trade-landscape__header'],
        ['the nav rail', 'sidebar'],
        ['the accumulator stats strip', 'accumulators-stats-v2'],
        ['an action sheet', 'quill-action-sheet--portal'],
        ['the onboarding card', 'landscape-onboarding'],
        ['the guide video player', 'modal-player'],
        ['a snackbar', 'quill-snackbar'],
    ])('[LAH-005] a tap on %s, outside the chart, does not toggle', (_name, class_name) => {
        const { store, wrapper } = buildWrapper({ is_hidden: false });
        renderHook(() => useAutoHideChrome({ is_paused: false }), { wrapper });

        render(
            <div className={class_name}>
                <button>control</button>
            </div>
        );
        const control = screen.getByRole('button');

        act(() => {
            control.dispatchEvent(pointerEvent('pointerdown', 100, 100));
            control.dispatchEvent(pointerEvent('pointerup', 100, 100));
        });

        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalled();
    });

    it('[LAH-005] a pointerdown while paused does not collapse', () => {
        const { store, wrapper } = buildWrapper({ is_hidden: false });
        renderHook(() => useAutoHideChrome({ is_paused: true }), { wrapper });

        act(() => {
            chart().dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
        });

        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalledWith(true);
    });

    it('[LAH-007] a press that began while paused dismisses only — it never toggles chrome', () => {
        const { store, wrapper } = buildWrapper({ is_hidden: false });
        const { rerender } = renderHook((props: { is_paused: boolean }) => useAutoHideChrome(props), {
            wrapper,
            initialProps: { is_paused: true },
        });

        act(() => chart().dispatchEvent(pointerEvent('pointerdown', 100, 100)));
        // Closing the panel releases the pause on that same pointerdown, so pointerup arrives unpaused.
        rerender({ is_paused: false });
        act(() => chart().dispatchEvent(pointerEvent('pointerup', 100, 100)));

        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalled();
    });

    it('[LAH-007] a press that began while paused does not restore hidden chrome either', () => {
        const { store, wrapper } = buildWrapper({ is_hidden: true });
        const { rerender } = renderHook((props: { is_paused: boolean }) => useAutoHideChrome(props), {
            wrapper,
            initialProps: { is_paused: true },
        });
        (store.ui.setLandscapeChromeHidden as jest.Mock).mockClear();

        act(() => chart().dispatchEvent(pointerEvent('pointerdown', 100, 100)));
        rerender({ is_paused: false });
        act(() => chart().dispatchEvent(pointerEvent('pointerup', 100, 100)));

        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalled();
    });

    it('[LAH-003] never hides while paused', () => {
        const { store, wrapper } = buildWrapper({ is_hidden: false });

        renderHook(() => useAutoHideChrome({ is_paused: true }), { wrapper });

        act(() => jest.advanceTimersByTime(DEFAULT_DELAY_MS));
        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalledWith(true);
    });

    it('[LAH-003] re-arms the timer once pause is released', () => {
        const { store, wrapper } = buildWrapper({ is_hidden: false });
        const { rerender } = renderHook((props: { is_paused: boolean }) => useAutoHideChrome(props), {
            wrapper,
            initialProps: { is_paused: true },
        });

        act(() => jest.advanceTimersByTime(DEFAULT_DELAY_MS));
        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalledWith(true);

        rerender({ is_paused: false });
        act(() => jest.advanceTimersByTime(DEFAULT_DELAY_MS));
        expect(store.ui.setLandscapeChromeHidden).toHaveBeenCalledWith(true);
    });

    it('[LAH-004] cleanup clears the timer, removes the listener and resets the flag', () => {
        const { store, wrapper } = buildWrapper({ is_hidden: false });
        const remove_spy = jest.spyOn(document, 'removeEventListener');

        const { unmount } = renderHook(() => useAutoHideChrome({ is_paused: false }), { wrapper });

        unmount();

        expect(store.ui.setLandscapeChromeHidden).toHaveBeenCalledWith(false);
        expect(remove_spy).toHaveBeenCalledWith('pointerdown', expect.any(Function), { capture: true });

        // A timer that was pending must not fire hide after unmount.
        (store.ui.setLandscapeChromeHidden as jest.Mock).mockClear();
        act(() => jest.advanceTimersByTime(DEFAULT_DELAY_MS));
        expect(store.ui.setLandscapeChromeHidden).not.toHaveBeenCalledWith(true);

        remove_spy.mockRestore();
    });
});
