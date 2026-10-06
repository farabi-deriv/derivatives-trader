import React from 'react';
import classNames from 'classnames';
import { useHistory, useLocation } from 'react-router-dom';

import { LabelPairedArrowLeftSmBoldIcon, LabelPairedXmarkSmBoldIcon } from '@deriv/quill-icons';
import { isEmptyObject, routes } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';
import { IconButton, Text } from '@deriv-com/quill-ui';

import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';
import { Localize } from '@deriv-com/translations';

const ContractDetailsHeader = observer(() => {
    const { state } = useLocation();
    const is_phone_landscape = useIsPhoneLandscape();
    const history = useHistory();
    const { common, contract_replay } = useStore();
    const { routeBackInApp } = common;
    const contract_info = contract_replay?.contract_store?.contract_info;
    const is_automation_contract = !!(contract_info && 'auto_run_id' in contract_info && contract_info.auto_run_id);

    const handleBack = () => {
        const is_from_table_row = !isEmptyObject(state) ? state.from_table_row : false;
        if (is_from_table_row) return history.goBack();
        if (is_automation_contract) return history.push(routes.trader_automate);
        return routeBackInApp(history as unknown as Parameters<typeof routeBackInApp>[0]);
    };

    const title = (
        <Text size='md' bold color='quill-typography__color--prominent'>
            <Localize i18n_default_text='Contract details' />
        </Text>
    );

    // Landscape stacks the close above the title (Figma), but the press still routes back the same
    // way, so arriving from a positions row still returns there.
    const close = (
        <IconButton
            variant='tertiary'
            icon={<LabelPairedXmarkSmBoldIcon data-testid='close' key='close' />}
            className='close'
            color='black-white'
            onClick={handleBack}
        />
    );

    const back = (
        <IconButton
            variant='tertiary'
            icon={<LabelPairedArrowLeftSmBoldIcon height='22px' width='13px' data-testid='arrow' key='arrow' />}
            className='arrow'
            color='black-white'
            onClick={handleBack}
        />
    );

    return (
        <header
            className={classNames('header contract-details-header-v2', {
                'contract-details-header-v2--landscape': is_phone_landscape,
            })}
        >
            <React.Suspense fallback={<div />}>
                {is_phone_landscape ? (
                    <React.Fragment>
                        {close}
                        {title}
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        {back}
                        {title}
                    </React.Fragment>
                )}
            </React.Suspense>
        </header>
    );
});

export default ContractDetailsHeader;
