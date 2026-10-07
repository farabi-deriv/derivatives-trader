import { TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { act, renderHook } from '@testing-library/react-hooks';

import { ONBOARDING_DELAY_MS } from 'AppV2/Components/LandscapeOnboarding/landscape-onboarding';

import TraderProviders from '../../../trader-providers';
import useAccumulatorGrowthRatePicker, { GUIDE_TAPS } from '../useAccumulatorGrowthRatePicker';
import useIsPhoneLandscape from '../useIsPhoneLandscape';

jest.mock('../useIsPhoneLandscape', () => ({
    __esModule: true,
    default: jest.fn(() => true),
}));

const onChange = jest.fn();

type TTradeOverrides = Record<string, unknown>;
type TUiOverrides = Record<string, unknown>;

/**
 * Stands in for the persisted tally of taps on the band.
 *
 * Raises the count on the store it belongs to, the way the real MobX action
 * does. A mock that only recorded the call would hide the thing most worth
 * testing — that the hand goes away once the third tap lands, and not before.
 */
const markAccumulatorBarrierGuideTapped = jest.fn();

const buildStore = (trade_overrides: TTradeOverrides = {}, ui_overrides: TUiOverrides = {}) => {
    const store = {
        ...mockStore({
            ui: {
                accumulator_barrier_guide_tap_count: 0,
                // The landscape onboarding gates the band, and these tests are
                // about what the band does once it is out of the way. The gate
                // itself has its own describe block.
                has_seen_landscape_onboarding: true,
                markAccumulatorBarrierGuideTapped,
                ...ui_overrides,
            },
        }),
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
                // Shaped like the real ACCU proposal: the distance, the rate it was
                // priced for, and the spot it was measured from, all from one message.
                proposal_info: { ACCU: { barrier_spot_distance: '0.5484', growth_rate: 0.03, spot: 9629.08 } },
                tick_data: { quote: 9629.08, pip_size: 3 },
                ...trade_overrides,
            },
        },
    } as ReturnType<typeof mockStore>;

    markAccumulatorBarrierGuideTapped.mockImplementation(() => {
        store.ui.accumulator_barrier_guide_tap_count += 1;
    });

    return store;
};

// Owned by `useAutoHideChrome` in the app; set here by `onBarrierPress`.
const tap_claim_ref = { current: false };

const renderPicker = (trade_overrides: TTradeOverrides = {}, ui_overrides: TUiOverrides = {}) => {
    const store = buildStore(trade_overrides, ui_overrides);
    const wrapper = ({ children }: { children: JSX.Element }) => (
        <TraderProviders store={store}>{children}</TraderProviders>
    );

    return {
        store,
        ...renderHook(() => useAccumulatorGrowthRatePicker({ tap_claim_ref }), { wrapper }),
    };
};

/** A press-and-release somewhere other than the picker. */
const tapElsewhere = () => {
    document.dispatchEvent(new Event('pointerup', { bubbles: true }));
};

/**
 * A scroll of the wheel, as `useParamDrag` actually delivers one: it starts on
 * the panel, then follows the pointer on the document without capturing it, so
 * the release is reported against whatever the finger ended up over.
 */
const scrollWheelAndReleaseOutside = (container_ref: { current: HTMLDivElement | null }) => {
    const panel = document.createElement('div');
    document.body.appendChild(panel);
    // Stands in for the ref React would have attached to the rendered panel.
    container_ref.current = panel;

    panel.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    return {
        release: () => {
            document.dispatchEvent(new Event('pointerup', { bubbles: true }));
        },
        cleanUp: () => panel.remove(),
    };
};

/** The picker's ref, typed as the mutable object it is at runtime. */
const refOf = (picker: { container_ref: unknown }) => picker.container_ref as { current: HTMLDivElement | null };

describe('useAccumulatorGrowthRatePicker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        tap_claim_ref.current = false;
        (useIsPhoneLandscape as jest.Mock).mockReturnValue(true);
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('hands the chart an enabled ladder for a pre-trade accumulator', () => {
        const { result } = renderPicker();

        expect(result.current.interaction_config?.enabled).toBe(true);
        expect(result.current.interaction_config?.steps.map(step => step.growthRate)).toEqual([
            0.01, 0.02, 0.03, 0.04, 0.05,
        ]);
    });

    it('measures the ladder from the spot the proposal was priced against', () => {
        // The tick stream and the proposal stream are separate subscriptions and run a
        // tick apart, which at these magnitudes is a whole unit in the label's last
        // decimal. Measuring from the newer of the two made the `±` label change as the
        // band was tapped open and shut, because the chart draws it from this ladder
        // while a rate is previewed and from the proposal when it is not.
        const { result } = renderPicker({ tick_data: { quote: 9634.2, pip_size: 3 } });

        expect(result.current.interaction_config?.steps.map(step => step.barrierSpotDistanceDisplay)).toEqual([
            '0.6256',
            '0.5847',
            '0.5484',
            '0.5218',
            '0.4966',
        ]);
    });

    it('hands back the API number for the rate it priced, over its own arithmetic', () => {
        // `spot * offset` would give 0.5484 here. We do not control the arithmetic behind
        // the API's number and cannot see it — it quotes a decimal the symbol itself does
        // not — so there is no replicating it, only deferring to it. The committed band is
        // drawn from *its* number, and the previewed one has to read the same.
        const { result } = renderPicker({
            proposal_info: { ACCU: { barrier_spot_distance: '0.5485', growth_rate: 0.03, spot: 9629.08 } },
        });
        const priced = result.current.interaction_config?.steps.find(step => step.growthRate === 0.03);

        expect(priced?.barrierSpotDistanceDisplay).toBe('0.5485');
        expect(priced?.barrierSpotDistance).toBe(0.5485);
    });

    it('builds the ladder from the backend offsets, not from the proposal', () => {
        const { result } = renderPicker();

        expect(result.current.interaction_config?.steps.map(step => step.barrierSpotDistanceDisplay)).toEqual([
            '0.6256',
            '0.5847',
            '0.5484',
            '0.5218',
            '0.4966',
        ]);
    });

    it.each([
        ['a contract is open', { has_open_accu_contract: true }],
        ['the market is closed', { is_market_closed: true }],
        ['trade params are locked', { is_automation_params_locked: true }],
        ['the trade type is not accumulators', { contract_type: TRADE_TYPES.RISE_FALL }],
        ['no proposal has arrived yet', { proposal_info: {} }],
        ['the backend sent no barrier offsets', { accumulator_barrier_offsets: [] }],
        [
            'there is only one growth rate to pick',
            { accumulator_range_list: [0.03], accumulator_barrier_offsets: [0.000056949789] },
        ],
        [
            'there is no spot to measure the ladder from',
            { tick_data: null, proposal_info: { ACCU: { barrier_spot_distance: '0.5484', growth_rate: 0.03 } } },
        ],
    ])('sends no ladder when %s', (_label, overrides) => {
        const { result } = renderPicker(overrides);

        expect(result.current.interaction_config).toBeNull();
    });

    it('still builds a ladder before the tick stream has caught up', () => {
        // The proposal carries the spot it was priced against, so the band does not have
        // to wait on a separate subscription to become interactive.
        const { result } = renderPicker({ tick_data: null });

        expect(result.current.interaction_config?.steps).toHaveLength(5);
    });

    it('stays closed until the band is tapped', () => {
        const { result } = renderPicker();

        expect(result.current.picker).toBeNull();
    });

    it('opens on the committed rate when the band is tapped', () => {
        const { result } = renderPicker();

        act(() => result.current.onBarrierTap());

        // 3% is the third of five rungs, ordered low to high.
        expect(result.current.picker?.index).toBe(2);
        expect(result.current.picker?.last_index).toBe(4);
        expect(result.current.picker?.labelAt(2)).toBe('3%');
    });

    it('previews the band at the rate being scrolled to, before any commit', () => {
        const { result } = renderPicker();

        act(() => result.current.onBarrierTap());
        act(() => result.current.picker?.onStep(1));

        // The band keeps up with the wheel; the store is untouched until settle.
        expect(result.current.interaction_config?.previewGrowthRate).toBe(0.04);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('stops at the ends of the ladder', () => {
        const { result } = renderPicker();

        act(() => result.current.onBarrierTap());
        act(() => result.current.picker?.onStep(10));
        expect(result.current.picker?.index).toBe(4);

        act(() => result.current.picker?.onStep(-10));
        expect(result.current.picker?.index).toBe(0);
    });

    it('commits the moment the wheel is released, not when it closes', () => {
        const { result } = renderPicker();

        act(() => result.current.onBarrierTap());
        act(() => result.current.picker?.onStep(1));
        act(() => result.current.picker?.onSettle());

        // The proposal for the new rate goes out while the picker is still up,
        // rather than being held back for the whole idle window.
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({ target: { name: 'growth_rate', value: 0.04 } });
        expect(result.current.picker).not.toBeNull();
    });

    it('closes on its own after the idle window, committing nothing more', () => {
        const { result } = renderPicker();

        act(() => result.current.onBarrierTap());
        act(() => result.current.picker?.onStep(1));
        act(() => result.current.picker?.onSettle());
        act(() => jest.advanceTimersByTime(2000));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(result.current.picker).toBeNull();
        expect(result.current.interaction_config?.previewGrowthRate).toBeNull();
    });

    it('commits once per rung settled on, not once per step', () => {
        const { result } = renderPicker();

        act(() => result.current.onBarrierTap());
        act(() => result.current.picker?.onStep(1));
        act(() => result.current.picker?.onStep(1));
        act(() => result.current.picker?.onSettle());
        // Settling again without moving writes nothing.
        act(() => result.current.picker?.onSettle());

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({ target: { name: 'growth_rate', value: 0.05 } });
    });

    it('keeps the picker up while it is still being scrolled', () => {
        const { result } = renderPicker();

        act(() => result.current.onBarrierTap());
        act(() => jest.advanceTimersByTime(1900));
        act(() => result.current.picker?.onStep(1));
        act(() => jest.advanceTimersByTime(1900));

        expect(result.current.picker).not.toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('waits indefinitely for a wheel that is never touched', () => {
        const { result } = renderPicker();

        act(() => result.current.onBarrierTap());
        act(() => jest.advanceTimersByTime(60000));

        // The idle countdown measures the gap between gestures, so it starts
        // when one ends — matching the landscape trade params, which hold open
        // until the wheel is used. A picker nobody has touched is not idle; it
        // is waiting, and the user asked for it with a deliberate tap.
        expect(result.current.picker).not.toBeNull();
        // Tapping the band to look at the rate is not a change.
        expect(onChange).not.toHaveBeenCalled();
    });

    it('starts the countdown once the wheel has been used', () => {
        const { result } = renderPicker();

        act(() => result.current.onBarrierTap());
        act(() => jest.advanceTimersByTime(60000));
        act(() => result.current.picker?.onStep(1));
        act(() => result.current.picker?.onSettle());

        act(() => jest.advanceTimersByTime(1900));
        expect(result.current.picker).not.toBeNull();

        act(() => jest.advanceTimersByTime(100));
        expect(result.current.picker).toBeNull();
    });

    it('commits nothing when the scroll lands back where it started', () => {
        const { result } = renderPicker();

        act(() => result.current.onBarrierTap());
        act(() => result.current.picker?.onStep(2));
        act(() => result.current.picker?.onStep(-2));
        act(() => result.current.picker?.onSettle());

        expect(onChange).not.toHaveBeenCalled();
    });

    describe('dismissal', () => {
        it('closes when the band is tapped again', () => {
            const { result } = renderPicker();

            act(() => result.current.onBarrierTap());
            expect(result.current.picker).not.toBeNull();

            act(() => result.current.onBarrierTap());

            expect(result.current.picker).toBeNull();
        });

        it('closes on a press anywhere else', () => {
            const { result } = renderPicker();

            act(() => result.current.onBarrierTap());
            act(() => tapElsewhere());

            expect(result.current.picker).toBeNull();
        });

        it('is not dismissed by the press that is toggling it', () => {
            const { result } = renderPicker();

            act(() => result.current.onBarrierTap());

            // The band announces itself on the press; the dismiss listener must
            // leave that gesture to `onBarrierTap`, or opening and closing would
            // fight over the same tap.
            act(() => {
                result.current.onBarrierPress();
                tapElsewhere();
            });

            expect(result.current.picker).not.toBeNull();
        });

        it('survives a wheel scroll that releases off the panel', () => {
            const { result } = renderPicker();

            act(() => result.current.onBarrierTap());
            const gesture = scrollWheelAndReleaseOutside(refOf(result.current.picker!));
            act(() => result.current.picker?.onStep(1));
            act(() => gesture.release());

            // The release lands on the chart, not the card — the card is 128px
            // tall and the gesture is a vertical drag. Dismissing on it would
            // take the picker away the instant the user let go.
            expect(result.current.picker).not.toBeNull();

            gesture.cleanUp();
        });

        it('closes 2s after that scroll, not instantly', () => {
            const { result } = renderPicker();

            act(() => result.current.onBarrierTap());
            const gesture = scrollWheelAndReleaseOutside(refOf(result.current.picker!));
            act(() => gesture.release());

            act(() => jest.advanceTimersByTime(1900));
            expect(result.current.picker).not.toBeNull();

            act(() => jest.advanceTimersByTime(100));
            expect(result.current.picker).toBeNull();

            gesture.cleanUp();
        });

        it('does not count a finger resting on the wheel as idle', () => {
            const { result } = renderPicker();

            act(() => result.current.onBarrierTap());
            const gesture = scrollWheelAndReleaseOutside(refOf(result.current.picker!));

            act(() => jest.advanceTimersByTime(5000));

            expect(result.current.picker).not.toBeNull();

            gesture.cleanUp();
        });

        it('reports its open state, so the host can pause its own gestures', () => {
            const { result } = renderPicker();

            expect(result.current.is_open).toBe(false);
            act(() => result.current.onBarrierTap());
            expect(result.current.is_open).toBe(true);
            act(() => tapElsewhere());
            expect(result.current.is_open).toBe(false);
        });
    });

    describe('the tap hint', () => {
        /** The band already tapped open `taps` times, in this session or an earlier one. */
        const afterTaps = (taps: number) => renderPicker({}, { accumulator_barrier_guide_tap_count: taps });

        /** One full use of the band: tapped open, then tapped shut again. */
        const tapOpenThenShut = (result: { current: { onBarrierTap: () => void } }) => {
            act(() => result.current.onBarrierTap());
            act(() => result.current.onBarrierTap());
        };

        it('runs before the band has ever been tapped', () => {
            const { result } = renderPicker();

            expect(result.current.interaction_config?.showTapGuide).toBe(true);
        });

        it('is hidden while the picker it asked for is up', () => {
            const { result } = renderPicker();

            act(() => result.current.onBarrierTap());

            // It would sit over the control the tap just opened.
            expect(result.current.interaction_config?.showTapGuide).toBe(false);
        });

        it('comes back when the picker closes', () => {
            const { result } = renderPicker();

            act(() => result.current.onBarrierTap());
            act(() => tapElsewhere());

            // One use is not a habit. The hand is owed two more.
            expect(result.current.picker).toBeNull();
            expect(result.current.interaction_config?.showTapGuide).toBe(true);
        });

        it('counts the tap that opens the picker', () => {
            const { result, store } = renderPicker();

            act(() => result.current.onBarrierTap());

            expect(store.ui.accumulator_barrier_guide_tap_count).toBe(1);
        });

        it('does not count the tap that closes it again', () => {
            const { result, store } = renderPicker();

            tapOpenThenShut(result);

            // The same gesture finishing, not a second use of the band —
            // counting it would spend two of the three in one sitting.
            expect(store.ui.accumulator_barrier_guide_tap_count).toBe(1);
        });

        it('still runs on the last tap it is owed', () => {
            const { result } = afterTaps(GUIDE_TAPS - 1);

            expect(result.current.interaction_config?.showTapGuide).toBe(true);
        });

        it('is done once the band has been tapped three times', () => {
            const { result } = afterTaps(GUIDE_TAPS);

            expect(result.current.interaction_config?.showTapGuide).toBe(false);
        });

        it('goes after the third tap and does not return', () => {
            const { result, store } = renderPicker();

            tapOpenThenShut(result);
            expect(result.current.interaction_config?.showTapGuide).toBe(true);
            tapOpenThenShut(result);
            expect(result.current.interaction_config?.showTapGuide).toBe(true);
            tapOpenThenShut(result);

            expect(store.ui.accumulator_barrier_guide_tap_count).toBe(GUIDE_TAPS);
            expect(result.current.interaction_config?.showTapGuide).toBe(false);
        });

        it('stops counting once it is done', () => {
            const { result, store } = afterTaps(GUIDE_TAPS);

            tapOpenThenShut(result);

            // Written to local storage on every change, and nothing above the
            // cap means anything.
            expect(markAccumulatorBarrierGuideTapped).not.toHaveBeenCalled();
            expect(store.ui.accumulator_barrier_guide_tap_count).toBe(GUIDE_TAPS);
        });
    });

    describe('the landscape onboarding gate', () => {
        const duringOnboarding = (trade_overrides: TTradeOverrides = {}) =>
            renderPicker(trade_overrides, { has_seen_landscape_onboarding: false });

        it('leaves the band alone while the onboarding card is up', () => {
            const { result } = duringOnboarding();

            // The card tells the user to tap the chart to hide the controls. A
            // band that claimed that tap would open the picker underneath it.
            expect(result.current.interaction_config).toBeNull();

            act(() => result.current.onBarrierTap());
            expect(result.current.picker).toBeNull();
        });

        it('takes the hint away with the tap target', () => {
            const { result } = duringOnboarding();

            // One gate for both: no hand pointing at a band that will not answer.
            expect(result.current.interaction_config?.showTapGuide).toBeUndefined();
        });

        it('hands over a beat after the onboarding is dismissed', () => {
            const { result, rerender, store } = duringOnboarding();

            store.ui.has_seen_landscape_onboarding = true;
            rerender();

            // The card has gone, but the hint does not take its place in the
            // same frame — the two steps are paced, not swapped.
            expect(result.current.interaction_config).toBeNull();

            act(() => jest.advanceTimersByTime(ONBOARDING_DELAY_MS));

            expect(result.current.interaction_config?.enabled).toBe(true);
            expect(result.current.interaction_config?.showTapGuide).toBe(true);
        });

        it('does not make a returning user wait', () => {
            // Already dismissed in an earlier session: the handover happened
            // then, so there is nothing to pace against now.
            const { result } = renderPicker();

            expect(result.current.interaction_config?.enabled).toBe(true);
        });
    });

    describe('layout', () => {
        it('is off anywhere but phone landscape', () => {
            (useIsPhoneLandscape as jest.Mock).mockReturnValue(false);
            const { result } = renderPicker();

            // Matches where TradeLandscape itself renders; desktop and portrait
            // have the trade params on screen already.
            expect(result.current.interaction_config).toBeNull();

            act(() => result.current.onBarrierTap());
            expect(result.current.picker).toBeNull();
        });
    });

    it('drops the picker the moment the feature switches off', () => {
        const { result, rerender, store } = renderPicker();

        act(() => result.current.onBarrierTap());
        act(() => result.current.picker?.onStep(1));
        expect(result.current.picker).not.toBeNull();

        // A contract bought mid-gesture. The store is a plain object, so the
        // hook picks the change up on the next render rather than reactively.
        store.modules.trade.has_open_accu_contract = true;
        rerender();

        expect(result.current.picker).toBeNull();
        expect(result.current.interaction_config).toBeNull();
        // Dropped, not committed: the gesture never settled.
        expect(onChange).not.toHaveBeenCalled();
    });
});
