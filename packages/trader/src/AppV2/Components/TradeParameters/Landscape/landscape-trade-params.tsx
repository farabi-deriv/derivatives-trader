import React from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';

import { LabelPairedGripDotsVerticalMdRegularIcon } from '@deriv/quill-icons';
import { useStore } from '@deriv/stores';

import PurchaseButton from 'AppV2/Components/PurchaseButton';

import useLandscapeStake from './adapters/use-landscape-stake';
import useLandscapeTakeProfit from './adapters/use-landscape-take-profit';
import LandscapeParamChip from './landscape-param-chip';
import LandscapeValuePanel from './landscape-value-panel';
import { TLandscapeParamKey } from './types';
import useLandscapeParamEditor from './use-landscape-param-editor';
import usePillDrag from './use-pill-drag';

import './landscape-trade-params.scss';

const IDLE_CLOSE_MS = 2000;

type TLandscapeTradeParams = {
    /** Fired when a parameter editor opens/closes, so the caller can pause the chrome auto-hide. */
    onOverlayOpenChange?: (is_open: boolean) => void;
};

// The floating pill: an observer that owns `active_param` (one wheel open at a time), renders the
// chips + the passive glass panel (a sibling of the pill, never a child) + the reused PurchaseButton.
// It never imports client.balance / the balance hint / useProposal — only the stake adapter may.
const LandscapeTradeParams = observer(({ onOverlayOpenChange }: TLandscapeTradeParams) => {
    const { ui } = useStore();
    const { is_landscape_chrome_hidden, landscape_params_offset_x, setLandscapeParamsOffsetX } = ui;

    const stake = useLandscapeStake();
    const take_profit = useLandscapeTakeProfit();
    const adapters = { stake, take_profit } as const;

    const [active_param, setActiveParam] = React.useState<TLandscapeParamKey | null>(null);
    const active_adapter = active_param ? adapters[active_param] : null;
    const {
        index: draft_index,
        open: openEditor,
        stepBy,
        settle: settleEditor,
        reset: resetEditor,
    } = useLandscapeParamEditor(active_adapter);
    const idle_ref = React.useRef<ReturnType<typeof setTimeout>>();
    const container_ref = React.useRef<HTMLDivElement>(null);
    const chip_refs = React.useRef<Partial<Record<TLandscapeParamKey, HTMLDivElement | null>>>({});
    const [panel_offset, setPanelOffset] = React.useState<number | null>(null);

    const { is_disabled: stake_disabled } = stake;
    const { is_disabled: tp_disabled, is_on: tp_is_on } = take_profit;

    // Latched at collapse, not read live: switching take profit off on the collapsed pill must not
    // pull the chip out under the finger. It goes on the next collapse.
    const [was_tp_on_at_collapse, setWasTpOnAtCollapse] = React.useState(tp_is_on);
    React.useEffect(() => {
        if (is_landscape_chrome_hidden) setWasTpOnAtCollapse(tp_is_on);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_landscape_chrome_hidden]);
    const show_take_profit = !is_landscape_chrome_hidden || was_tp_on_at_collapse;

    const clearIdle = () => {
        if (idle_ref.current) clearTimeout(idle_ref.current);
    };

    const close = React.useCallback(() => {
        clearIdle();
        setActiveParam(null);
        setPanelOffset(null);
        resetEditor();
        onOverlayOpenChange?.(false);
    }, [resetEditor, onOverlayOpenChange]);

    const armIdle = React.useCallback(() => {
        clearIdle();
        idle_ref.current = setTimeout(close, IDLE_CLOSE_MS);
    }, [close]);

    // Centre of a chip in px from the wrapper's left edge, so the panel can sit straight over the param
    // being adjusted rather than at a fixed corner. Measured on open — in the same batch as the state
    // change — so the panel's first paint is already positioned and never jumps.
    const measureChipCentre = (key: TLandscapeParamKey) => {
        const chip = chip_refs.current[key];
        const container = container_ref.current;
        if (!chip || !container) return null;
        const chip_rect = chip.getBoundingClientRect();
        return chip_rect.left - container.getBoundingClientRect().left + chip_rect.width / 2;
    };

    const open = (key: TLandscapeParamKey) => {
        const adapter = adapters[key];
        if (adapter.is_disabled) return;
        // Re-opening the param already being edited is just activity, so only hold. Running the rest
        // would blank the panel mid-edit and re-seed the draft from the store — which the last settle's
        // proposal has not written back yet — so a lift-and-retouch flashed the panel and snapped the
        // value backwards.
        if (active_param === key) {
            clearIdle();
            return;
        }
        setActiveParam(key);
        setPanelOffset(measureChipCentre(key));
        openEditor(adapter);
        onOverlayOpenChange?.(true);
        // Hold, don't arm: the idle countdown measures the gap *between* gestures, so it starts when one
        // ends. Arming here closed the panel under a slow drag that hadn't travelled a full step in 2s.
        clearIdle();
    };

    const step = (delta: number) => {
        stepBy(delta);
        clearIdle();
    };

    const settle = () => {
        settleEditor();
        armIdle();
    };

    // Clear the active param + un-pause when it becomes disabled (e.g. an accumulator contract opens).
    // Not when take profit is switched off: its panel holds the switch, so it has to stay open.
    React.useEffect(() => {
        if (active_param && adapters[active_param].is_disabled) close();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active_param, stake_disabled, tp_disabled]);

    // A press anywhere outside the pill dismisses the panel, rather than making the user wait out the
    // idle timer. Scoped to the whole wrapper, not the panel: a press on a chip is switching params or
    // continuing an edit, and a press on Buy is buying — neither is "outside".
    // Capture phase + passive, and never preventDefault, so the press still reaches its real target.
    React.useEffect(() => {
        if (!active_param) return undefined;
        const onOutsidePointerDown = (event: PointerEvent) => {
            if (container_ref.current?.contains(event.target as Node)) return;
            close();
        };
        document.addEventListener('pointerdown', onOutsidePointerDown, { capture: true, passive: true });
        return () => document.removeEventListener('pointerdown', onOutsidePointerDown, { capture: true });
    }, [active_param, close]);

    React.useEffect(() => () => clearIdle(), []);

    // Slide the whole wrapper, not the pill: the glass panel is a sibling, so moving the wrapper keeps
    // the panel over its chip for free. Chip offsets are measured against this same element, so the
    // transform cancels out of `measureChipCentre` and the panel needs no re-measure on drag.
    const pill_drag = usePillDrag({
        offset_x: landscape_params_offset_x,
        onCommit: setLandscapeParamsOffsetX,
        wrapper_ref: container_ref,
    });

    // The pill's width changes when the chrome un-hides (the take-profit chip is re-inserted) and the
    // pill is right-anchored, so every chip shifts. That un-hide is driven by the same pointerdown that
    // opens a param, so an offset measured in `open()` is already stale by the time the panel paints.
    // Re-measure after any layout-affecting change while a param is active.
    React.useLayoutEffect(() => {
        if (active_param) setPanelOffset(measureChipCentre(active_param));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active_param, is_landscape_chrome_hidden]);

    // The ladder can reshape under a live draft index (a commit's in-flight proposal briefly drops
    // `validation_params`), so clamp before rendering rather than trusting the index to stay in range.
    const chipIndex = (key: TLandscapeParamKey) => {
        const index = active_param === key ? draft_index : adapters[key].selected_index;
        return Math.min(Math.max(index, 0), adapters[key].last_index);
    };

    const renderChip = (key: TLandscapeParamKey, className?: string) => (
        <LandscapeParamChip
            adapter={adapters[key]}
            index={chipIndex(key)}
            is_active={active_param === key}
            onOpen={() => open(key)}
            onStep={step}
            onSettle={settle}
            className={className}
            chip_ref={node => {
                chip_refs.current[key] = node;
            }}
        />
    );

    return (
        <div
            className='landscape-params'
            data-testid='dt_landscape_params'
            ref={container_ref}
            style={landscape_params_offset_x ? { transform: `translateX(${landscape_params_offset_x}px)` } : undefined}
        >
            {active_adapter && (
                <LandscapeValuePanel
                    adapter={active_adapter}
                    index={chipIndex(active_param as TLandscapeParamKey)}
                    offset_x={panel_offset}
                    onStep={step}
                    onSettle={settle}
                />
            )}
            <div
                data-testid='dt_landscape_params_pill'
                className={clsx('landscape-params__pill', {
                    'landscape-params__pill--collapsed': is_landscape_chrome_hidden,
                    'landscape-params__pill--dragging': pill_drag.is_dragging,
                })}
                onPointerDown={pill_drag.onPointerDown}
                onPointerMove={pill_drag.onPointerMove}
                onPointerUp={pill_drag.onPointerUp}
                onPointerCancel={pill_drag.onPointerCancel}
                onClickCapture={pill_drag.onClickCapture}
            >
                {/* The drag affordance — decorative, since the whole pill is the drag surface. */}
                <LabelPairedGripDotsVerticalMdRegularIcon
                    aria-hidden
                    data-testid='dt_landscape_params_grip'
                    className='landscape-params__grip'
                    fill='var(--color-text-secondary)'
                />
                <div className='landscape-params__params'>
                    {/* An enabled take profit stays on the collapsed pill — it is a live contract term. Kept
                        mounted either way so it can animate out. */}
                    {renderChip('take_profit', clsx({ 'landscape-params__chip--collapsed': !show_take_profit }))}
                    {renderChip('stake', 'landscape-params__chip--stake')}
                </div>
                <PurchaseButton />
            </div>
        </div>
    );
});

export default LandscapeTradeParams;
