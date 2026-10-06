import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

import { StandaloneChevronDownBoldIcon } from '@deriv/quill-icons';
import { ActionSheet, Text } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import useIsPhoneViewport from 'AppV2/Hooks/useIsPhoneViewport';
import { DISCOVERY_WINDOWS, TDiscoveryWindow } from 'AppV2/Utils/market-discovery-utils';

type TMarketChangesDropdown = {
    selected_window: TDiscoveryWindow;
    onSelect: (window: TDiscoveryWindow) => void;
    /** Disables the trigger — e.g. a closed market on the info screen, where the window can't change. */
    disabled?: boolean;
};

/**
 * "Changes ({window})" window selector. On mobile it opens a bottom ActionSheet; on desktop an
 * anchored popover (portalled above the market-selection popover). Used by the list header and the
 * info-screen chart.
 */
// Human-readable window labels (e.g. '1h' → "1 hour") for the trigger + options.
const OPTION_LABELS: Record<TDiscoveryWindow, React.ReactNode> = {
    '1m': <Localize i18n_default_text='1 minute' />,
    '5m': <Localize i18n_default_text='5 minutes' />,
    '15m': <Localize i18n_default_text='15 minutes' />,
    '1h': <Localize i18n_default_text='1 hour' />,
};
// Desktop spells out "Price changes"; mobile uses the shorter "Changes" to fit the narrower header.
const DESKTOP_TRIGGER_LABELS: Record<TDiscoveryWindow, React.ReactNode> = {
    '1m': <Localize i18n_default_text='Price changes (1 minute)' />,
    '5m': <Localize i18n_default_text='Price changes (5 minutes)' />,
    '15m': <Localize i18n_default_text='Price changes (15 minutes)' />,
    '1h': <Localize i18n_default_text='Price changes (1 hour)' />,
};
const MOBILE_TRIGGER_LABELS: Record<TDiscoveryWindow, React.ReactNode> = {
    '1m': <Localize i18n_default_text='Changes (1 minute)' />,
    '5m': <Localize i18n_default_text='Changes (5 minutes)' />,
    '15m': <Localize i18n_default_text='Changes (15 minutes)' />,
    '1h': <Localize i18n_default_text='Changes (1 hour)' />,
};

const MarketChangesDropdown = ({ selected_window, onSelect, disabled }: TMarketChangesDropdown) => {
    const { isMobile } = useDevice();
    const is_phone_viewport = useIsPhoneViewport();
    const [is_open, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const trigger_ref = useRef<HTMLButtonElement>(null);
    const popover_ref = useRef<HTMLDivElement>(null);

    // Outside-click close for the desktop popover only (the ActionSheet handles its own dismissal).
    useEffect(() => {
        if (!is_open || is_phone_viewport) return undefined;
        const handleOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (popover_ref.current?.contains(target) || trigger_ref.current?.contains(target)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [is_open, is_phone_viewport]);

    const toggleMenu = () => {
        if (disabled) return;
        if (!is_phone_viewport) {
            const rect = trigger_ref.current?.getBoundingClientRect();
            if (rect) setPosition({ top: rect.bottom + 4, left: rect.right });
        }
        setIsOpen(prev => !prev);
    };

    const handleSelect = (window: TDiscoveryWindow) => {
        onSelect(window);
        setIsOpen(false);
    };

    const options = DISCOVERY_WINDOWS.map(window => (
        <button
            key={window}
            type='button'
            role='option'
            aria-selected={window === selected_window}
            className={clsx('market-changes-dropdown__option', {
                'market-changes-dropdown__option--selected': window === selected_window,
            })}
            onClick={() => handleSelect(window)}
        >
            <Text size='md'>{OPTION_LABELS[window]}</Text>
        </button>
    ));

    return (
        <>
            <button
                ref={trigger_ref}
                type='button'
                className='market-changes-dropdown__trigger'
                aria-haspopup='listbox'
                aria-expanded={is_open}
                disabled={disabled}
                onClick={toggleMenu}
            >
                <Text size='sm'>{(isMobile ? MOBILE_TRIGGER_LABELS : DESKTOP_TRIGGER_LABELS)[selected_window]}</Text>
                <StandaloneChevronDownBoldIcon
                    iconSize='sm'
                    fill='var(--semantic-color-monochrome-surface-normal-high)'
                />
            </button>
            {is_phone_viewport ? (
                <ActionSheet.Root isOpen={is_open} onClose={() => setIsOpen(false)} position='left' expandable={false}>
                    <ActionSheet.Portal shouldCloseOnDrag>
                        <ActionSheet.Header
                            title={
                                <Text size='xl' bold className='market-changes-dropdown__sheet-title'>
                                    <Localize i18n_default_text='Change period' />
                                </Text>
                            }
                        />
                        <ActionSheet.Content className='market-changes-dropdown__sheet'>{options}</ActionSheet.Content>
                    </ActionSheet.Portal>
                </ActionSheet.Root>
            ) : (
                is_open &&
                createPortal(
                    <div
                        ref={popover_ref}
                        className='market-changes-dropdown__popover'
                        role='listbox'
                        style={{ top: position.top, left: position.left }}
                    >
                        {options}
                    </div>,
                    document.body
                )
            )}
        </>
    );
};

export default MarketChangesDropdown;
