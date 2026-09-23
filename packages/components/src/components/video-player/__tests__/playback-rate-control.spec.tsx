import React from 'react';

import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PlaybackRateControl from '../playback-rate-control';

const mocked_props = {
    onPlaybackRateChange: jest.fn(),
    playback_rate: 1,
};

const default_selected_item = 'Normal';
const playback_rate_list = ['0.25x', '0.5x', '0.75x', default_selected_item, '1.5x', '2.0x'];

describe('<PlaybackRateControl />', () => {
    it('should render the component', () => {
        const { container } = render(<PlaybackRateControl {...mocked_props} />);

        expect(container).not.toBeEmptyDOMElement();
    });

    it('[PBRC-002] should render all available options of playback rate if user clicked on default one', async () => {
        render(<PlaybackRateControl {...mocked_props} />);

        playback_rate_list.forEach(item =>
            item === default_selected_item
                ? expect(screen.getByText(item)).toBeInTheDocument()
                : expect(screen.queryByText(item)).not.toBeInTheDocument()
        );
        await userEvent.click(screen.getByText(default_selected_item));

        playback_rate_list.forEach(item =>
            item === default_selected_item
                ? expect(screen.getAllByText(item)).toHaveLength(2)
                : expect(screen.getByText(item)).toBeInTheDocument()
        );
    });

    it('[PBRC-002] should close the options list when the control is clicked again', async () => {
        render(<PlaybackRateControl {...mocked_props} />);

        await userEvent.click(screen.getByText(default_selected_item));
        expect(screen.getByText(playback_rate_list[0])).toBeInTheDocument();

        await userEvent.click(screen.getAllByText(default_selected_item)[0]);
        await waitForElementToBeRemoved(() => screen.queryByText(playback_rate_list[0]));
    });

    it('[PBRC-002] should call onPlaybackRateChange and close the list if user chooses another option', async () => {
        render(<PlaybackRateControl {...mocked_props} />);

        expect(mocked_props.onPlaybackRateChange).not.toBeCalled();
        await userEvent.click(screen.getByText(default_selected_item));
        await userEvent.click(screen.getByText(playback_rate_list[0]));

        expect(mocked_props.onPlaybackRateChange).toBeCalled();
        await waitForElementToBeRemoved(() => screen.queryByText(playback_rate_list[0]));
    });

    it('[PBRC-001] should not open the options list on hover', async () => {
        render(<PlaybackRateControl {...mocked_props} />);

        await userEvent.hover(screen.getByText(default_selected_item));

        expect(screen.queryByText(playback_rate_list[0])).not.toBeInTheDocument();
    });

    it('[PBRC-001] should keep the options list open when the pointer leaves after opening via click', async () => {
        render(<PlaybackRateControl {...mocked_props} />);

        await userEvent.click(screen.getByText(default_selected_item));
        expect(screen.getByText(playback_rate_list[0])).toBeInTheDocument();

        await userEvent.unhover(screen.getAllByText(default_selected_item)[0]);

        expect(screen.getByText(playback_rate_list[0])).toBeInTheDocument();
    });
});
