import React from 'react';

import { Popover } from '@deriv/components';
import { LegacyHelpCentreIcon } from '@deriv/quill-icons';
import { getHelpCentreUrl } from '@deriv/shared';
import { useTranslations } from '@deriv-com/translations';

export const HelpCentre = ({ showPopover }) => {
    const { localize } = useTranslations();
    return (
        <a
            href={getHelpCentreUrl()}
            id='dt_help_centre'
            aria-label={localize('Help centre')}
            className='footer__link'
            target='_blank'
            rel='noopener noreferrer'
        >
            {showPopover ? (
                <Popover
                    classNameBubble='help-centre__tooltip'
                    alignment='top'
                    message={localize('Help centre')}
                    zIndex={9999}
                >
                    <LegacyHelpCentreIcon className='footer__icon' iconSize='xs' />
                </Popover>
            ) : (
                <LegacyHelpCentreIcon className='footer__icon' iconSize='xs' />
            )}
        </a>
    );
};
