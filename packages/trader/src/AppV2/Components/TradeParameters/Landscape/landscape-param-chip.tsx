import React from 'react';
import clsx from 'clsx';

import { TLandscapeParamAdapter } from './types';

type TLandscapeParamChip = {
    adapter: TLandscapeParamAdapter;
    /** Draft index while active, else the adapter's selected index. */
    index: number;
    is_active: boolean;
    onOpen: () => void;
    onStep: (delta: number) => void;
    onSettle: () => void;
    className?: string;
    /** Lets the pill measure this chip's centre so the panel can sit straight over it. */
    chip_ref?: (node: HTMLDivElement | null) => void;
};

// Label + value, and the control that opens the glass panel. The panel owns the scroll gesture, so
// there are no ghost neighbours here. Takes NO error/status prop, so it can never render red (LTP-008).
const LandscapeParamChip = ({
    adapter,
    index,
    is_active,
    onOpen,
    onStep,
    onSettle,
    className,
    chip_ref,
}: TLandscapeParamChip) => {
    // Off shows `-`; the switch itself lives in the panel this opens.
    const is_off = typeof adapter.toggle === 'function' && !adapter.is_on;

    const handleClick = () => {
        if (adapter.is_disabled) return;
        onOpen();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (adapter.is_disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
            return;
        }
        // The keyboard equivalent of scrolling the panel, so inert while off like the panel.
        if (is_off) return;
        const delta =
            event.key === 'ArrowUp' || event.key === 'ArrowRight'
                ? 1
                : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
                  ? -1
                  : 0;
        if (!delta) return;
        event.preventDefault();
        onOpen();
        onStep(delta);
        onSettle();
    };

    return (
        <div
            ref={chip_ref}
            role='spinbutton'
            tabIndex={adapter.is_disabled ? -1 : 0}
            aria-label={adapter.label}
            aria-valuemin={0}
            aria-valuemax={adapter.last_index}
            aria-valuenow={index}
            aria-valuetext={adapter.labelAt(index)}
            aria-disabled={adapter.is_disabled || undefined}
            data-testid={`dt_landscape_chip_${adapter.key}`}
            className={clsx('landscape-params__chip', className, {
                'landscape-params__chip--active': is_active,
                'landscape-params__chip--disabled': adapter.is_disabled,
            })}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            <span className='landscape-params__chip-label'>{adapter.label}</span>
            {/* While a panel is open the chip tracks its draft; otherwise it shows the committed value. */}
            <span className='landscape-params__chip-value'>
                {is_active && !is_off ? adapter.labelAt(index) : adapter.display_value}
            </span>
        </div>
    );
};

export default LandscapeParamChip;
