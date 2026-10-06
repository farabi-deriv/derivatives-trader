import React from 'react';
import clsx from 'clsx';

// Matches the 0.3s slide in market-selection.scss.
export const SLIDE_MS = 300;

type TSlideUpPresence = React.HTMLAttributes<HTMLDivElement> & {
    is_open: boolean;
    children: React.ReactNode;
};

/**
 * Slides up on open and back down on close, unmounting once the close ends. Closing replays the last
 * open frame: the selector resets its state the moment it closes, which would otherwise swap the page
 * mid-slide.
 */
const SlideUpPresence = ({ is_open, className, children, ...rest }: TSlideUpPresence) => {
    const [is_mounted, setIsMounted] = React.useState(is_open);
    const last_children = React.useRef(children);
    if (is_open) last_children.current = children;
    if (is_open && !is_mounted) setIsMounted(true);

    React.useEffect(() => {
        if (is_open) return undefined;
        const timer = setTimeout(() => setIsMounted(false), SLIDE_MS);
        return () => clearTimeout(timer);
    }, [is_open]);

    if (!is_mounted) return null;

    return (
        <div {...rest} className={clsx(className, { 'market-selection--closing': !is_open })}>
            {is_open ? children : last_children.current}
        </div>
    );
};

export default SlideUpPresence;
