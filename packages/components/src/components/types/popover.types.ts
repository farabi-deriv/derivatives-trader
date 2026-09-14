import React from 'react';
import { PopoverPosition } from 'react-tiny-popover';

export type TPopoverProps = {
    alignment: PopoverPosition;
    className?: string;
    classNameBubble?: string;
    classNameTarget?: string;
    classNameTargetIcon?: string;
    disable_target_icon?: boolean;
    icon?: 'info' | 'question' | 'dot';
    id?: string;
    is_bubble_hover_enabled?: boolean;
    relative_render?: boolean;
    margin?: number;
    message: React.ReactNode;
    onBubbleClose?: () => void;
    should_disable_pointer_events?: boolean;
    should_show_cursor?: boolean;
    zIndex?: string;
};
