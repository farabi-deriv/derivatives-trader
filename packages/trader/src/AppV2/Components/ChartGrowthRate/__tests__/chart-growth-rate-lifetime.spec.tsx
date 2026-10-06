import { TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { act, fireEvent, render, screen } from '@testing-library/react';

import useAccumulatorGrowthRatePicker from 'AppV2/Hooks/useAccumulatorGrowthRatePicker';

import TraderProviders from '../../../../trader-providers';
import ChartGrowthRate from '../chart-growth-rate';

jest.mock('AppV2/Hooks/useIsPhoneLandscape', () => ({
    __esModule: true,
    default: jest.fn(() => true),
}));

/**
 * How long the picker stays up, wired together the way the app wires it: the
 * real hook, the real component, and real pointer events on the real node.
 *
 * The hook's own spec drives its callbacks directly, so it cannot catch a
 * mismatch between the two — a ref that never gets attached, or a gesture that
 * reaches the DOM differently from how the spec simulates it.
 */
const onChange = jest.fn();

type TTradeOverrides = Record<string, unknown>;

const buildStore = (trade_overrides: TTradeOverrides = {}) =>
    ({
        // The band only becomes a tap target once the landscape onboarding is
        // out of the way; that handover is the hook spec's to cover.
        ...mockStore({ ui: { has_seen_landscape_onboarding: true } }),
        modules: {
            trade: {
                accumulator_range_list: [0.01, 0.02, 0.03, 0.04, 0.05],
                accumulator_barrier_offsets: [
                    0.000064970949, 0.000060725407, 0.000056949789, 0.000054185412, 0.000051575021,
                ],
                contract_type: TRADE_TYPES.ACCUMULATOR,
                growth_rate: 0.03,
                has_open_accu_contract: false,
                is_market_closed: false,
                is_automation_params_locked: false,
                onChange,
                proposal_info: { ACCU: { barrier_spot_distance: '0.5484' } },
                tick_data: { quote: 9629.08, pip_size: 3 },
                ...trade_overrides,
            },
        },
    }) as unknown as ReturnType<typeof mockStore>;

/** Stands in for `TradeChart`: the hook and the component, as the app pairs them. */
const Host = ({ onReady }: { onReady: (tap: () => void) => void }) => {
    const { picker, onBarrierTap } = useAccumulatorGrowthRatePicker();
    onReady(onBarrierTap);
    return <ChartGrowthRate picker={picker} />;
};

// A real MouseEvent: jsdom's synthetic pointer events carry no coordinates, and
// the drag maths reads them. `timeStamp` is set explicitly too — events built
// back-to-back are microseconds apart, which the drag reads as a flick and
// answers with an inertial spin that outlives the assertions.
const pointer = (target: Element | Document, type: string, clientY: number, timeStamp: number) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
    Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    fireEvent(target, event);
};

/**
 * A deliberate scroll of the wheel: one rung up over 300ms, released over the
 * chart rather than over the card.
 */
const dragOneRungAndReleaseOutside = () => {
    pointer(screen.getByTestId('dt_chart_growth_rate'), 'pointerdown', 200, 1000);
    pointer(document, 'pointermove', 160, 1300);
    act(() => {
        pointer(document, 'pointerup', 160, 1300);
    });
};

describe('ChartGrowthRate lifetime', () => {
    let tapBand: () => void;

    /** Mounts the pair and opens the picker, as tapping the band does. */
    const openPicker = () => {
        const { rerender } = render(
            <TraderProviders store={buildStore()}>
                <Host onReady={tap => (tapBand = tap)} />
            </TraderProviders>
        );
        act(() => tapBand());

        /** Pushes new store values through, the way a MobX update would. */
        const applyStore = (trade_overrides: TTradeOverrides) =>
            rerender(
                <TraderProviders store={buildStore(trade_overrides)}>
                    <Host onReady={tap => (tapBand = tap)} />
                </TraderProviders>
            );

        return { applyStore };
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('opens when the band is tapped', () => {
        openPicker();

        expect(screen.getByTestId('dt_chart_growth_rate')).toBeInTheDocument();
    });

    it('stays up when a drag of the wheel ends off the panel', () => {
        openPicker();

        // The wheel is tracked on the document without pointer capture, so a
        // drag of any length releases over the chart, not over the 128px card.
        dragOneRungAndReleaseOutside();

        expect(screen.getByTestId('dt_chart_growth_rate')).toBeInTheDocument();
    });

    it('goes 2s after that drag, not before', () => {
        openPicker();

        dragOneRungAndReleaseOutside();

        act(() => jest.advanceTimersByTime(1900));
        expect(screen.getByTestId('dt_chart_growth_rate')).toBeInTheDocument();

        act(() => jest.advanceTimersByTime(100));
        expect(screen.queryByTestId('dt_chart_growth_rate')).not.toBeInTheDocument();
    });

    it('commits the new rate on release, while still on screen', () => {
        openPicker();

        dragOneRungAndReleaseOutside();

        expect(onChange).toHaveBeenCalledWith({ target: { name: 'growth_rate', value: 0.04 } });
        expect(screen.getByTestId('dt_chart_growth_rate')).toBeInTheDocument();
    });

    it('commits even when the release follows its last move in one batch', () => {
        openPicker();

        // No render between the two, which is what a quick flick looks like.
        // The draft has to be readable synchronously for the proposal to go out.
        pointer(screen.getByTestId('dt_chart_growth_rate'), 'pointerdown', 200, 1000);
        act(() => {
            pointer(document, 'pointermove', 160, 1300);
            pointer(document, 'pointerup', 160, 1300);
        });

        expect(onChange).toHaveBeenCalledWith({ target: { name: 'growth_rate', value: 0.04 } });
    });

    it('still dismisses after a gesture the browser cancels', () => {
        openPicker();

        act(() => {
            pointer(screen.getByTestId('dt_chart_growth_rate'), 'pointerdown', 200, 1000);
            pointer(document, 'pointercancel', 200, 1100);
        });
        // The claim is per-press, so a cancelled one cannot be left behind.
        act(() => {
            pointer(document.body, 'pointerdown', 400, 2000);
            pointer(document.body, 'pointerup', 400, 2050);
        });

        expect(screen.queryByTestId('dt_chart_growth_rate')).not.toBeInTheDocument();
    });

    it('rides out the proposal round-trip its own commit triggers', () => {
        const { applyStore } = openPicker();

        dragOneRungAndReleaseOutside();
        expect(onChange).toHaveBeenCalled();

        // Committing re-requests the proposal, and the store drops `proposal_info`
        // while that is in flight — a new growth rate can put the current stake
        // outside the limits the old proposal reported, and that branch of
        // `requestProposal` clears it. The ladder itself is unchanged, so this
        // must not take the picker away at the exact moment the user let go.
        applyStore({ proposal_info: {} });

        expect(screen.getByTestId('dt_chart_growth_rate')).toBeInTheDocument();
    });

    it('still goes the moment the feature genuinely switches off', () => {
        const { applyStore } = openPicker();

        // A contract bought mid-gesture is a real change, not a blink.
        applyStore({ has_open_accu_contract: true });

        expect(screen.queryByTestId('dt_chart_growth_rate')).not.toBeInTheDocument();
    });

    it('goes when a press lands anywhere else', () => {
        openPicker();

        act(() => {
            pointer(document.body, 'pointerdown', 400, 1000);
            pointer(document.body, 'pointerup', 400, 1050);
        });

        expect(screen.queryByTestId('dt_chart_growth_rate')).not.toBeInTheDocument();
    });
});
