import React from 'react';
import clsx from 'clsx';

import { TooltipPortal, useOnClickOutside } from '@deriv/components';
import { clickAndKeyEventHandler } from '@deriv/shared';
import { useDevice } from '@deriv-com/ui';

import CommissionFormula, { getCommissionPercentage } from './commission-formula';

import './commission-tooltip.scss';

type TCommissionValue = number | string | null | undefined;

type TCommissionTooltipProps = {
    commission: TCommissionValue;
    multiplier: TCommissionValue;
    amount: TCommissionValue;
    currency: string;
    // Horizontal anchor of the floating (mobile) bubble: 'center' (default) over the label, or 'start'
    // (left-aligned) for left-aligned labels (e.g. the stake breakdown row) so it doesn't overflow off-screen.
    align?: 'center' | 'start';
    children: React.ReactNode;
};

/**
 * Reveals the commission formula where the commission already sits inside an open sheet/panel
 * (multiplier wheel-picker, stake breakdown). Desktop reveals on hover via the shared portal tooltip
 * (matching Stop out / the params-row); mobile reveals on tap via a floating bubble dismissed by tapping
 * outside. Falls back to rendering the label as-is (non-interactive) when the percentage can't be derived.
 */
const CommissionTooltip = ({
    commission,
    multiplier,
    amount,
    currency,
    align = 'center',
    children,
}: TCommissionTooltipProps) => {
    const { isDesktop } = useDevice();
    const [is_open, setIsOpen] = React.useState(false);
    const ref = React.useRef<HTMLSpanElement>(null);
    const has_formula = getCommissionPercentage(commission, multiplier, amount) !== null;

    // Close the bubble if the formula stops being derivable, so it can't reopen on its own when it returns.
    React.useEffect(() => {
        if (!has_formula) setIsOpen(false);
    }, [has_formula]);

    // Dismiss the (mobile) bubble when tapping anywhere outside the label/bubble (only while it's open).
    useOnClickOutside(
        ref,
        () => setIsOpen(false),
        () => is_open
    );

    if (!has_formula) return <React.Fragment>{children}</React.Fragment>;

    const formula = (
        <CommissionFormula commission={commission} multiplier={multiplier} amount={amount} currency={currency} />
    );

    if (isDesktop) {
        return (
            <TooltipPortal message={formula} position='left' className='commission-tooltip__portal'>
                <span className='commission-tooltip__label'>{children}</span>
            </TooltipPortal>
        );
    }

    const toggle = (e?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) =>
        clickAndKeyEventHandler(() => setIsOpen(prev => !prev), e);

    return (
        <span className='commission-tooltip' ref={ref}>
            <span
                className='commission-tooltip__label'
                role='button'
                tabIndex={0}
                aria-expanded={is_open}
                onClick={toggle}
                onKeyDown={toggle}
            >
                {children}
            </span>
            {is_open && (
                <span
                    className={clsx('commission-tooltip__bubble', `commission-tooltip__bubble--${align}`)}
                    role='tooltip'
                    data-testid='dt_commission_formula'
                >
                    {formula}
                </span>
            )}
        </span>
    );
};

export default CommissionTooltip;
