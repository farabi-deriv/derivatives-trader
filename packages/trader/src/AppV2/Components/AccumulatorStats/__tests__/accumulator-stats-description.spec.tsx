import React from 'react';

import { mockStore } from '@deriv/stores';
import { TStores } from '@deriv/stores/types';
import { ActionSheet } from '@deriv-com/quill-ui';
import { render, screen } from '@testing-library/react';

import { getAccumulatorStatsVideoId, getVideoMp4Url } from '../../../Utils/video-config';

import TraderProviders from '../../../../trader-providers';
import AccumulatorStatsDescription from '../accumulator-stats-description';

const light_src = getVideoMp4Url(getAccumulatorStatsVideoId(false));
const dark_src = getVideoMp4Url(getAccumulatorStatsVideoId(true));

const Wrapper = ({ store }: { store: TStores }) => (
    <TraderProviders store={store}>
        <ActionSheet.Root isOpen onClose={jest.fn()} expandable={false}>
            <AccumulatorStatsDescription onActionSheetClose={jest.fn()} />
        </ActionSheet.Root>
    </TraderProviders>
);

const renderDescription = (store: TStores) => render(<Wrapper store={store} />);

const getVideoSrc = () => screen.getByTitle('accumulator_stats').getAttribute('src');

describe('AccumulatorStatsDescription', () => {
    it('[ASM-001] loads the dark Stats animation in dark mode', () => {
        const store = mockStore({ ui: { is_dark_mode_on: true } });
        renderDescription(store);

        expect(getVideoSrc()).toBe(dark_src);
    });

    it('[ASM-001] loads the light Stats animation in light mode', () => {
        const store = mockStore({ ui: { is_dark_mode_on: false } });
        renderDescription(store);

        expect(getVideoSrc()).toBe(light_src);
    });

    it('[ASM-002] swaps the animation source live when the theme is toggled', () => {
        const store = mockStore({ ui: { is_dark_mode_on: false } });
        const { rerender } = renderDescription(store);

        expect(getVideoSrc()).toBe(light_src);

        store.ui.is_dark_mode_on = true;
        rerender(<Wrapper store={store} />);

        expect(getVideoSrc()).toBe(dark_src);
    });
});
