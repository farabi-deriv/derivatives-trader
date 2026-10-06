import React from 'react';
import { observer } from 'mobx-react-lite';

import { useStore } from '@deriv/stores';
import { ActionSheet, Text } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';

import { getAccumulatorStatsVideoId } from 'AppV2/Utils/video-config';

import StreamIframe from '../StreamIframe';

// Shared with the landscape tooltip on the Stats heading, so the copy is translated once.
export const StatsDescriptionText = () => (
    <Localize i18n_default_text='Stats show the history of consecutive tick counts, i.e. the number of ticks the price remained within range continuously.' />
);

const AccumulatorStatsDescription = observer(({ onActionSheetClose }: { onActionSheetClose: () => void }) => {
    const {
        ui: { is_dark_mode_on },
    } = useStore();

    return (
        <ActionSheet.Portal showHandlebar shouldCloseOnDrag handleBarPosition='absolute'>
            <div className='stats-description'>
                <StreamIframe src={getAccumulatorStatsVideoId(is_dark_mode_on)} title='accumulator_stats' />
                <div className='stats-description__content'>
                    <div className='stats-description__content__title'>
                        <Text size='lg' bold color='quill-typography__color--prominent'>
                            <Localize i18n_default_text='Stats' />
                        </Text>
                    </div>
                    <div className='stats-description__content__description'>
                        <Text>
                            <StatsDescriptionText />
                        </Text>
                    </div>
                </div>
            </div>
            <ActionSheet.Footer
                alignment='vertical'
                primaryAction={{
                    content: <Localize i18n_default_text='Got it' />,
                    onAction: onActionSheetClose,
                }}
            />
        </ActionSheet.Portal>
    );
});

export default AccumulatorStatsDescription;
