import React from 'react';
import { observer } from 'mobx-react-lite';

import { LabelPairedXmarkSmBoldIcon } from '@deriv/quill-icons';
import { useStore } from '@deriv/stores';
import { Button, IconButton, Text } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import './landscape-onboarding.scss';

// Matches the portrait tour, so the card doesn't land while the page is still settling.
export const ONBOARDING_DELAY_MS = 800;
const TITLE_ID = 'landscape-onboarding-title';

/**
 * One-time card for the landscape trade page (Figma `399:42116`, step 1). Non-blocking: the chart stays
 * live, so tapping it toggles the chrome as the card describes. The growth-rate step is the chart team's.
 */
const LandscapeOnboarding = observer(() => {
    const { localize } = useTranslations();
    const { ui } = useStore();
    const { has_seen_landscape_onboarding, setHasSeenLandscapeOnboarding } = ui;
    const [is_visible, setIsVisible] = React.useState(false);

    React.useEffect(() => {
        if (has_seen_landscape_onboarding) return undefined;
        const timer = setTimeout(() => setIsVisible(true), ONBOARDING_DELAY_MS);
        return () => clearTimeout(timer);
    }, [has_seen_landscape_onboarding]);

    if (!is_visible) return null;

    const finish = () => {
        setIsVisible(false);
        setHasSeenLandscapeOnboarding(true);
    };

    return (
        <div
            className='landscape-onboarding'
            role='dialog'
            aria-labelledby={TITLE_ID}
            data-testid='dt_landscape_onboarding'
        >
            <div className='landscape-onboarding__header'>
                <Text id={TITLE_ID} bold size='md'>
                    <Localize i18n_default_text='Tap to show or hide controls' />
                </Text>
                <IconButton
                    icon={<LabelPairedXmarkSmBoldIcon fill='var(--component-textIcon-normal-prominent)' />}
                    aria-label={localize('Close')}
                    data-testid='dt_landscape_onboarding_close'
                    size='sm'
                    color='black-white'
                    variant='tertiary'
                    onClick={finish}
                />
            </div>
            <Text size='sm' className='landscape-onboarding__content'>
                <Localize i18n_default_text='Tap on the chart to hide or reveal the controls.' />
            </Text>
            <Button
                color='black-white'
                size='sm'
                label={<Localize i18n_default_text='Done' />}
                data-testid='dt_landscape_onboarding_done'
                onClick={finish}
            />
        </div>
    );
});

export default LandscapeOnboarding;
