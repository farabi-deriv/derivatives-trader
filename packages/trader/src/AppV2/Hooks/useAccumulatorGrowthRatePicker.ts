import React from 'react';

import { isAccumulatorContract } from '@deriv/shared';
import { useStore } from '@deriv/stores';

import { ONBOARDING_DELAY_MS } from 'AppV2/Components/LandscapeOnboarding/landscape-onboarding';
import { IDLE_CLOSE_MS } from 'AppV2/Components/TradeParameters/Landscape/landscape-trade-params';
import { getAccumulatorGrowthRateLadder } from 'Stores/Modules/Trading/Helpers/accumulator-growth-rate-ladder';
import { useTraderStore } from 'Stores/useTraderStores';

import useIsPhoneLandscape from './useIsPhoneLandscape';

/** What the on-chart picker needs to draw itself and be scrolled. */
export type TAccumulatorGrowthRatePicker = {
    /** Index of the rate being shown, into the ladder ordered low to high. */
    index: number;
    /** Highest index the ladder holds. */
    last_index: number;
    /** The rate at an index, as a percentage. */
    labelAt: (index: number) => string;
    /** Moves the draft by a signed number of rungs. */
    onStep: (delta: number) => void;
    /**
     * The gesture ended: the rate is committed here, and the idle countdown to
     * close starts. Committing on release rather than on close is what the other
     * landscape params do, so the proposal goes out as soon as the user lets go.
     */
    onSettle: () => void;
    /**
     * Attached by the picker to its own element, so a press on it is not mistaken
     * for the press-anywhere-else that dismisses it.
     */
    container_ref: React.RefObject<HTMLDivElement>;
};

/**
 * Which layouts get the interactive Accumulators barriers.
 *
 * Landscape only, matching where `TradeLandscape` itself renders
 * (`trade.tsx`: `is_phone_landscape && is_accumulator`). The band is a touch
 * target sized for a thumb, and the picker it opens sits in the middle of the
 * chart — neither earns its place on desktop or in portrait, where the trade
 * params are on screen already.
 */
const isEnabledForLayout = (is_phone_landscape: boolean) => is_phone_landscape;

/**
 * How many times the band has to be tapped open before the hint retires.
 *
 * Doing something once is easy to forget by the next session, so the hand stays
 * until the user has actually used the band three times — at which point it is a
 * habit rather than a discovery. Counted on the tap rather than on the showing
 * because only the tap proves the hint was read.
 */
export const GUIDE_TAPS = 3;

/**
 * Whether the landscape onboarding has had its turn.
 *
 * That card says "tap on the chart to hide or reveal the controls" — and while
 * it is up, a tap on the band does no such thing: the band claims the gesture
 * and opens the picker, directly under the card that is still explaining
 * something else. Two hands pointing at two things at once, and the card's own
 * instruction untrue over the one part of the chart it overlaps. So the band
 * waits: onboarding first, then the growth-rate hint.
 *
 * Gated on the persisted flag rather than on the card being mounted, so a user
 * who dismissed it in an earlier session is never made to wait again — the
 * delay covers only the handover, giving the card a beat to clear before the
 * hint starts pulsing, instead of swapping one for the other in a single frame.
 */
const useLandscapeOnboardingSettled = (has_seen_landscape_onboarding: boolean) => {
    const [is_settled, setIsSettled] = React.useState(has_seen_landscape_onboarding);

    React.useEffect(() => {
        if (is_settled === has_seen_landscape_onboarding) return undefined;
        // Only a logged-out store reset goes the other way, and that should take
        // the band away at once rather than after a beat.
        if (!has_seen_landscape_onboarding) {
            setIsSettled(false);
            return undefined;
        }
        const timer = setTimeout(() => setIsSettled(true), ONBOARDING_DELAY_MS);
        return () => clearTimeout(timer);
    }, [is_settled, has_seen_landscape_onboarding]);

    return is_settled;
};

/**
 * The growth-rate picker the Accumulators band opens.
 *
 * The band is a tap target, not a control: tapping it opens this picker, and
 * scrolling the picker is what moves the rate. The chart previews the band at
 * the draft rate so it keeps up with the wheel, and the rate is written to the
 * store when the picker settles — one commit per visit rather than one per rung,
 * so a scroll through the ladder does not fire a proposal per step.
 */
type TUseAccumulatorGrowthRatePicker = {
    /**
     * Set while a gesture is on the band, by `onBarrierPress`.
     *
     * Shared with `useAutoHideChrome`, which owns it: a tap on the band must not
     * also maximize the view, and the dismiss-on-outside-press below must not
     * fire for the very press that is toggling the picker.
     */
    tap_claim_ref?: React.MutableRefObject<boolean>;
};

const useAccumulatorGrowthRatePicker = ({ tap_claim_ref }: TUseAccumulatorGrowthRatePicker = {}) => {
    const {
        accumulator_range_list,
        accumulator_barrier_offsets,
        contract_type,
        growth_rate,
        has_open_accu_contract,
        is_market_closed,
        is_automation_params_locked,
        onChange,
        proposal_info,
        tick_data,
    } = useTraderStore();

    // Every rung comes from contracts_for, so the ladder does not need a proposal to be
    // exact. Enablement still waits for one, so the band only becomes interactive once
    // the committed barriers are on the chart.
    //
    // All four of these are read off the one `ACCU` snapshot, and the ladder relies on
    // that: the distance belongs to the rate it was priced for, measured from the spot it
    // was priced against. `tick_data` is the live tick stream and is routinely a tick
    // ahead of the proposal, which is a whole unit in the label's last decimal — so it is
    // a fallback for the anchor and nothing more.
    const accu_proposal = proposal_info?.ACCU;
    const has_proposal = Boolean(accu_proposal);
    const barrier_spot_distance = accu_proposal?.barrier_spot_distance;
    const priced_growth_rate = accu_proposal?.growth_rate;
    const anchor_spot = accu_proposal?.spot ?? tick_data?.quote;
    const is_phone_landscape = useIsPhoneLandscape();
    const { ui } = useStore();
    const { accumulator_barrier_guide_tap_count, has_seen_landscape_onboarding, markAccumulatorBarrierGuideTapped } =
        ui;
    const is_landscape_onboarding_done = useLandscapeOnboardingSettled(has_seen_landscape_onboarding);

    /** Draft rung while the picker is open; null when it is closed. */
    const [draft_index, setDraftIndex] = React.useState<number | null>(null);
    /**
     * The draft, readable synchronously.
     *
     * Every writer below sets this *and* the state, in that order, and nothing
     * mirrors the state back onto it. That ordering is what makes it safe to
     * read from a handler: the chart's callbacks and the document listeners run
     * outside React, and a release can follow its last move inside one batch —
     * so a ref written in the state updater, which React only runs at render,
     * would still hold the pre-move rung when the release asks what to commit,
     * and the proposal for the rate the user actually chose would never go out.
     */
    const draft_ref = React.useRef<number | null>(null);
    const idle_timer = React.useRef<ReturnType<typeof setTimeout>>();
    const container_ref = React.useRef<HTMLDivElement>(null);
    /** The rung last written to the store, so a settle never commits twice. */
    const committed_ref = React.useRef<number | null>(null);
    /** Whether the gesture in flight began on the picker. See the dismiss effect. */
    const press_inside_ref = React.useRef(false);

    const is_accumulator = isAccumulatorContract(contract_type);
    /**
     * Whether the band is a control here at all.
     *
     * Deliberately free of anything that merely says whether the backend data
     * has landed yet: everything here is user-facing state that only changes
     * because the user or the market changed it, so closing the picker on it is
     * always right. See [latest_steps] for why that distinction matters.
     *
     * One condition gates the tap target and the hint together, which is the
     * whole point of putting the onboarding handover here: there is no state in
     * which the band invites a tap it will not answer.
     */
    const is_available =
        is_accumulator &&
        isEnabledForLayout(is_phone_landscape) &&
        is_landscape_onboarding_done &&
        !has_open_accu_contract &&
        !is_market_closed &&
        !is_automation_params_locked;

    const fresh_steps = React.useMemo(
        () =>
            is_available && has_proposal
                ? getAccumulatorGrowthRateLadder({
                      accumulator_range_list,
                      accumulator_barrier_offsets,
                      current_spot: anchor_spot,
                      barrier_spot_distance,
                      growth_rate: priced_growth_rate,
                      pip_size: tick_data?.pip_size,
                  })
                : [],
        [
            is_available,
            has_proposal,
            accumulator_range_list,
            accumulator_barrier_offsets,
            anchor_spot,
            tick_data?.pip_size,
            barrier_spot_distance,
            priced_growth_rate,
        ]
    );

    /**
     * The last ladder the backend was able to give us, held across a gap in the
     * data rather than collapsing to nothing.
     *
     * Committing a rate re-requests the proposal, and the store drops
     * `proposal_info` while that is in flight whenever the new rate puts the
     * current stake outside the limits the *old* proposal reported — the stake
     * limits arrive per-proposal, so a rate change can briefly invalidate them.
     * Reading the ladder straight from the proposal therefore emptied it at the
     * exact moment the user let go of the wheel, and the picker was torn down
     * on its own commit. The rungs come from `contracts_for` and do not change
     * between proposals, so there is nothing to be gained by dropping them.
     */
    const latest_steps = React.useRef<ReturnType<typeof getAccumulatorGrowthRateLadder>>([]);
    const steps = React.useMemo(() => {
        // A real change, not a gap: forget the ladder so nothing stale outlives it.
        if (!is_available) latest_steps.current = [];
        else if (fresh_steps.length > 1) latest_steps.current = fresh_steps;
        return latest_steps.current;
    }, [is_available, fresh_steps]);

    /**
     * The ladder's rates, low to high.
     *
     * Sorted rather than trusting the order `growth_rate_range` arrives in, so
     * scrolling up always means a higher rate.
     */
    const rates = React.useMemo(() => steps.map(step => step.growthRate).sort((a, b) => a - b), [steps]);

    const selected_index = rates.indexOf(growth_rate);

    // One rung is not a ladder: there is nowhere to scroll to, and a band that
    // opens a picker holding a single value is worse than an inert band.
    const is_interactive = rates.length > 1;

    // SmartCharts caches the callbacks it is handed, so everything reactive the
    // handlers read goes through a ref rather than the closure.
    const on_change_ref = React.useRef(onChange);
    on_change_ref.current = onChange;
    const rates_ref = React.useRef(rates);
    rates_ref.current = rates;
    const growth_rate_ref = React.useRef(growth_rate);
    growth_rate_ref.current = growth_rate;
    const mark_guide_tapped_ref = React.useRef(markAccumulatorBarrierGuideTapped);
    mark_guide_tapped_ref.current = markAccumulatorBarrierGuideTapped;
    const guide_tap_count_ref = React.useRef(accumulator_barrier_guide_tap_count);
    guide_tap_count_ref.current = accumulator_barrier_guide_tap_count;

    const close = React.useCallback(() => {
        clearTimeout(idle_timer.current);
        draft_ref.current = null;
        committed_ref.current = null;
        setDraftIndex(null);
    }, []);

    const armIdle = React.useCallback(() => {
        clearTimeout(idle_timer.current);
        idle_timer.current = setTimeout(close, IDLE_CLOSE_MS);
    }, [close]);

    const open = React.useCallback(() => {
        // Hold, don't arm — the same rule the landscape trade params follow. The
        // idle countdown measures the gap *between* gestures, so it starts when
        // one ends, not when the picker appears. Arming here took the card away
        // from a user who had only just looked at it, two seconds after a tap
        // they made deliberately. A picker nobody has touched is not idle; it is
        // waiting, and it waits until the band, or anywhere else, is pressed.
        clearTimeout(idle_timer.current);
        // Seeds from the store rather than from the last draft: the picker is
        // a fresh view of the committed rate every time it opens.
        const index = rates_ref.current.indexOf(growth_rate_ref.current);
        draft_ref.current = index;
        // Opening is not a change, so the first settle has nothing to commit.
        committed_ref.current = index;
        setDraftIndex(index);
    }, []);

    /** Tells the host this gesture is the band's, before it is known to be a tap. */
    const onBarrierPress = React.useCallback(() => {
        if (tap_claim_ref) tap_claim_ref.current = true;
    }, [tap_claim_ref]);

    const onBarrierTap = React.useCallback(() => {
        // The band is the switch: tapping it again puts the picker away.
        if (draft_ref.current != null) {
            close();
            return;
        }

        // Only the tap that opens the picker answers the hand. The one that
        // closes it again is the same gesture finishing, not a second use of
        // the band, and counting it would spend two of the three in one sitting.
        // Capped rather than left to climb: this is written to local storage on
        // every change, and nothing above the cap means anything.
        if (guide_tap_count_ref.current < GUIDE_TAPS) mark_guide_tapped_ref.current();
        open();
    }, [close, open]);

    const onStep = React.useCallback((delta: number) => {
        clearTimeout(idle_timer.current);
        const current = draft_ref.current;
        if (current == null) return;

        const last = rates_ref.current.length - 1;
        const next = Math.min(Math.max(current + delta, 0), last);
        // Ref first: the release that follows reads it, and may do so before
        // React has rendered this step.
        draft_ref.current = next;
        setDraftIndex(next);
    }, []);

    /**
     * Commits on release, not on close.
     *
     * The other landscape params commit the moment the wheel is let go, so the
     * proposal for the new rate is already in flight while the picker is still
     * on screen. Waiting for the close would hold it back for the whole idle
     * window. Idempotent: a settle that has not moved the rung writes nothing,
     * so a flick that lands back where it started fires no proposal.
     */
    const onSettle = React.useCallback(() => {
        const index = draft_ref.current;
        if (index != null && index !== committed_ref.current) {
            committed_ref.current = index;
            on_change_ref.current({ target: { name: 'growth_rate', value: rates_ref.current[index] } });
        }
        armIdle();
    }, [armIdle]);

    const labelAt = React.useCallback((index: number) => `${Math.round((rates_ref.current[index] ?? 0) * 100)}%`, []);

    // Drop the picker the moment the feature switches off — a contract being
    // bought mid-gesture, say — instead of leaving it stranded on screen.
    React.useEffect(() => {
        if (is_available && is_interactive) return;
        close();
    }, [is_available, is_interactive, close]);

    React.useEffect(() => () => clearTimeout(idle_timer.current), []);

    const is_open = draft_index != null && is_available && is_interactive;

    /**
     * A press anywhere else puts the picker away, rather than making the user
     * wait out the idle window.
     *
     * On pointerUP, unlike the trade params panel's equivalent, because the
     * band has to be excluded and it only announces itself once the press has
     * reached the chart — after every capture-phase pointerdown has run. The
     * listeners are passive and never preventDefault, so the press still does
     * whatever it was going to do.
     *
     * What counts as "elsewhere" is decided at the pointerDOWN, not at the
     * release: `useParamDrag` follows the gesture on the document rather than
     * capturing the pointer, so a scroll of the wheel reports its pointerup
     * against whatever happens to be under the finger — the chart, almost
     * always, since the card is only 128px tall. Judged on the release, every
     * scroll would dismiss the picker the instant it ended.
     */
    React.useEffect(() => {
        if (!is_open) return undefined;

        const onPointerDown = (event: PointerEvent) => {
            press_inside_ref.current = container_ref.current?.contains(event.target as Node) ?? false;
            // A finger on the wheel is not idle. The countdown restarts on release.
            if (press_inside_ref.current) clearTimeout(idle_timer.current);
        };

        const onPointerUp = () => {
            const was_inside = press_inside_ref.current;
            press_inside_ref.current = false;
            // Re-armed here rather than left to `onSettle` so the picker cannot be
            // stranded open by a press that reaches it without becoming a scroll.
            if (was_inside) {
                armIdle();
                return;
            }
            // The band is the switch, and `onBarrierTap` is already closing it.
            if (tap_claim_ref?.current) return;
            close();
        };

        // No `pointercancel` handler needed: the claim is reassigned on every
        // press, so a cancelled gesture cannot leave a stale one behind, and
        // `useParamDrag` re-arms the countdown through `onSettle` either way.
        document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
        document.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, { capture: true });
            document.removeEventListener('pointerup', onPointerUp, { capture: true });
        };
    }, [is_open, close, armIdle, tap_claim_ref]);

    return {
        /** Handed to the chart: the ladder, and the rate to show the band at. */
        interaction_config: React.useMemo(
            () =>
                is_interactive
                    ? {
                          enabled: true,
                          steps,
                          // Stays until the band has been used three times, so
                          // a user who taps it once and forgets by tomorrow is
                          // reminded again. Never while the picker is up, where
                          // it would sit over the control the tap just opened.
                          showTapGuide: accumulator_barrier_guide_tap_count < GUIDE_TAPS && !is_open,
                          // The band follows the wheel instead of waiting a
                          // proposal round-trip for the committed barriers.
                          previewGrowthRate: is_open && draft_index != null ? rates[draft_index] : null,
                      }
                    : null,
            [is_interactive, steps, is_open, draft_index, rates, accumulator_barrier_guide_tap_count]
        ),
        onBarrierTap,
        onBarrierPress,
        /** Whether the picker is on screen, so the host can pause its own gestures. */
        is_open,
        /** Non-null while the picker should be on screen. */
        picker: React.useMemo<TAccumulatorGrowthRatePicker | null>(
            () =>
                is_open && draft_index != null
                    ? {
                          index: draft_index,
                          last_index: rates.length - 1,
                          labelAt,
                          onStep,
                          onSettle,
                          container_ref,
                      }
                    : null,
            [is_open, draft_index, rates.length, labelAt, onStep, onSettle]
        ),
        /** The rate the store holds, for anything that needs the committed value. */
        selected_index,
    };
};

export default useAccumulatorGrowthRatePicker;
