import React from 'react';

import { observer } from '@deriv/stores';
import { SegmentedControlSingleChoice, Tab } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';

import { PositionsDrawerClosedContent, PositionsDrawerClosedFooter } from './positions-drawer-closed-content';
import { PositionsDrawerContent, PositionsDrawerFooter } from './positions-drawer-content';

import './positions-drawer.scss';

/**
 * PositionsDrawerTabs - Tabbed positions component for the desktop flyout.
 * Renders Open and Closed tabs with their respective content and footers.
 * The flyout header ("Positions" + close button) is handled by the parent Flyout component.
 */
const PositionsDrawerTabs = observer(() => {
    const [activeTab, setActiveTab] = React.useState(0);
    // Landscape has no footer slot: Open renders its P/L summary above the list, and Closed shows none.
    const is_phone_landscape = useIsPhoneLandscape();
    const { localize } = useTranslations();

    return (
        <div className='positions-drawer-tabs'>
            <div className='positions-drawer-tabs__tab-bar'>
                {/* Figma's `segmented control / label` — the pill, not the underlined tabs the other
                    breakpoints use. `sm` is the size that matches: 40px container with 4px padding
                    over 32px items, where `md` is 56/8/40. `hasContainerWidth` spans the panel. */}
                {is_phone_landscape ? (
                    <SegmentedControlSingleChoice
                        hasContainerWidth
                        onChange={setActiveTab}
                        options={[{ label: localize('Open') }, { label: localize('Closed') }]}
                        selectedItemIndex={activeTab}
                        size='sm'
                    />
                ) : (
                    <Tab.Container
                        contentStyle='fill'
                        className='positions-drawer-tabs__tab-container'
                        size='md'
                        selectedTabIndex={activeTab}
                        onChangeTab={setActiveTab}
                    >
                        <Tab.List>
                            <Tab.Trigger>
                                <Localize i18n_default_text='Open' />
                            </Tab.Trigger>
                            <Tab.Trigger>
                                <Localize i18n_default_text='Closed' />
                            </Tab.Trigger>
                        </Tab.List>
                    </Tab.Container>
                )}
            </div>
            <div className='positions-drawer-tabs__body'>
                {activeTab === 0 ? <PositionsDrawerContent /> : <PositionsDrawerClosedContent />}
            </div>
            {!is_phone_landscape && (
                <div className='positions-drawer-tabs__footer'>
                    {activeTab === 0 ? <PositionsDrawerFooter /> : <PositionsDrawerClosedFooter />}
                </div>
            )}
        </div>
    );
});

export default PositionsDrawerTabs;
