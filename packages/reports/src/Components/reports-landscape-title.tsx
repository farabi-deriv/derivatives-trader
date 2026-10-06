import React from 'react';
import { useHistory, useLocation } from 'react-router-dom';

import { Dropdown } from '@deriv/components';
import { routes } from '@deriv/shared';
import { Heading } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

// Landscape's stand-in for the VerticalTab sidebar; Open positions lives in the nav rail.
const ReportsLandscapeTitle = () => {
    const history = useHistory();
    const { pathname } = useLocation();
    const { localize } = useTranslations();

    const list = [
        { value: routes.profit, text: localize('Trade table') },
        { value: routes.statement, text: localize('Statement') },
    ];

    return (
        <React.Fragment>
            <Heading.H4 className='reports__landscape-heading'>
                <Localize i18n_default_text='Reports' />
            </Heading.H4>
            <Dropdown
                list={list}
                value={pathname}
                onChange={(e: { target: { value: string } }) => history.push(e.target.value)}
            />
        </React.Fragment>
    );
};

export default ReportsLandscapeTitle;
