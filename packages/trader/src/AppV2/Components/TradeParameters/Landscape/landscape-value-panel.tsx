import clsx from 'clsx';

import { ToggleSwitch } from '@deriv-com/quill-ui';

import LandscapeValueRows from './landscape-value-rows';
import { TLandscapeParamAdapter } from './types';
import useParamDrag from './use-param-drag';

type TLandscapeValuePanel = {
    adapter: TLandscapeParamAdapter;
    index: number;
    /**
     * Centre of the active chip in px, so the panel sits over the param being adjusted. Applied as
     * physical `left` — the measurement already accounts for RTL, so a logical inset would mirror twice.
     */
    offset_x?: number | null;
    onStep: (delta: number) => void;
    onSettle: () => void;
};

// Frosted-glass value picker: three rows around the draft index, and the host of the drag/wheel
// gesture. A SIBLING of the pill, never a child — nested, the pill's box would clip it. Never commits.
const LandscapeValuePanel = ({ adapter, index, offset_x, onStep, onSettle }: TLandscapeValuePanel) => {
    const drag = useParamDrag({ onStep, onSettle });
    const is_switchable = typeof adapter.toggle === 'function';
    const is_off = is_switchable && !adapter.is_on;

    return (
        <div
            className={clsx('landscape-params__panel', { 'landscape-params__panel--switchable': is_switchable })}
            data-testid='dt_landscape_value_panel'
            style={offset_x == null ? undefined : { left: `${offset_x}px`, transform: 'translateX(-50%)' }}
            onPointerDown={is_off ? undefined : drag.onPointerDown}
            onWheel={is_off ? undefined : drag.onWheel}
        >
            {is_switchable && (
                // Off the drag surface, so tapping the switch never nudges the value; a label, so the
                // switch (an unnamed button) is announced by its text. The test id sits here because
                // quill's ToggleSwitch drops it.
                <label
                    className='landscape-params__panel-header'
                    data-testid={`dt_landscape_${adapter.key}_toggle`}
                    onPointerDown={event => event.stopPropagation()}
                >
                    <span className='landscape-params__panel-label'>{adapter.label}</span>
                    {/* quill paints from `defaultChecked` and adopts `checked` only after, so both, or it slides in. */}
                    <ToggleSwitch
                        checked={!!adapter.is_on}
                        defaultChecked={!!adapter.is_on}
                        onChange={() => adapter.toggle?.(index)}
                    />
                </label>
            )}
            <LandscapeValueRows
                last_index={adapter.last_index}
                index={index}
                labelAt={adapter.labelAt}
                className={clsx('landscape-value-rows--panel', { 'landscape-value-rows--off': is_off })}
            />
        </div>
    );
};

export default LandscapeValuePanel;
