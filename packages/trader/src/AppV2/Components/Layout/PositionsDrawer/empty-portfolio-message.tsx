import React from 'react';

import { Text } from '@deriv/components';
import { LegacyPositionIcon, StandaloneBriefcaseRegularIcon } from '@deriv/quill-icons';
import { Localize } from '@deriv-com/translations';

import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';

type TEmptyPortfolioMessage = {
    error?: string;
    /** Landscape's two-line empty state; the tab supplies its own wording. */
    title?: React.ReactNode;
    description?: React.ReactNode;
    /** Landscape's glyph above the title; the briefcase unless the tab has its own (e.g. no matches). */
    icon?: React.ReactNode;
};

const EmptyPortfolioMessage = ({ error, title, description, icon }: TEmptyPortfolioMessage) => {
    const is_phone_landscape = useIsPhoneLandscape();

    if (error) {
        return (
            <div className='portfolio-empty'>
                <div className='portfolio-empty__wrapper'>
                    <Text color='disabled' size='xs'>
                        {error}
                    </Text>
                </div>
            </div>
        );
    }

    // Figma `landscape - open positions`: a 48px briefcase over a bold title and a regular subtitle,
    // centred in the space left under the tabs. The portrait/desktop drawer keeps its one-line message.
    if (is_phone_landscape) {
        return (
            <div className='portfolio-empty portfolio-empty--landscape'>
                <span className='portfolio-empty__landscape-icon'>
                    {icon ?? <StandaloneBriefcaseRegularIcon iconSize='xl' fill='var(--color-text-primary)' />}
                </span>
                <span className='portfolio-empty__landscape-title'>
                    {title ?? <Localize i18n_default_text='No open positions yet' />}
                </span>
                <span className='portfolio-empty__landscape-description'>
                    {description ?? <Localize i18n_default_text='Your open positions will appear here.' />}
                </span>
            </div>
        );
    }

    return (
        <div className='portfolio-empty'>
            <div className='portfolio-empty__wrapper'>
                <LegacyPositionIcon
                    className='portfolio-empty__icon'
                    iconSize='2xl'
                    fill='var(--color-text-disabled)'
                />
                <Text align='center' className='portfolio-empty__text' color='disabled' size='xs'>
                    {title ?? <Localize i18n_default_text='You have no open positions.' />}
                </Text>
            </div>
        </div>
    );
};

export default EmptyPortfolioMessage;
