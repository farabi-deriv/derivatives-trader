import React from 'react';

import { useDevice } from '@deriv-com/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MAX_MOBILE_WIDTH } from '@deriv/shared';

import Popover from '../popover';

const blue_info_icon = 'IcInfoBlue';
const children = 'Children';
const relative_container_testid = 'dt_popover_relative_container';
const target_info_icon = 'IcInfoOutline';
const tooltip_message = 'Information about item.';

const default_mocked_props = {
    alignment: 'left',
    className: 'test-tooltip',
    classNameBubble: 'test-popover',
    icon: 'info',
    id: 'test_popover',
    is_bubble_hover_enabled: true,
    message: tooltip_message,
    onBubbleClose: jest.fn(),
} as React.ComponentProps<typeof Popover>;

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: jest.fn(() => ({ isDesktop: true })),
}));

jest.mock('@deriv/quill-icons', () => ({
    LegacyInformationIcon: () => <div>{blue_info_icon}</div>,
    LegacyInfo1pxIcon: () => <div>{target_info_icon}</div>,
    LabelPairedQuestionCaptionBoldIcon: () => <div>IcUnknown</div>,
    StandaloneCircleFillIcon: () => <div>IcCircle</div>,
}));

describe('<Popover/>', () => {
    const mockPopover = (mocked_props = default_mocked_props) => {
        return <Popover {...mocked_props}>{children}</Popover>;
    };
    it('should render an info icon, display tooltip on hover/click, hide only after unfocusing in desktop', async () => {
        render(mockPopover());
        const info_icon = screen.getByText(target_info_icon);
        expect(info_icon).toBeInTheDocument();
        expect(screen.queryByText(tooltip_message)).not.toBeInTheDocument();

        await userEvent.hover(info_icon);
        await waitFor(() => {
            expect(screen.getByText(blue_info_icon)).toBeInTheDocument();
            expect(screen.getByText(tooltip_message)).toBeInTheDocument();
        });

        await userEvent.click(info_icon);
        expect(screen.getByText(blue_info_icon)).toBeInTheDocument();
        expect(screen.getByText(tooltip_message)).toBeInTheDocument();

        await userEvent.unhover(info_icon);
        await waitFor(() => {
            expect(screen.queryByText(blue_info_icon)).not.toBeInTheDocument();
            expect(screen.queryByText(tooltip_message)).not.toBeInTheDocument();
        });
    });
    it('should render a question icon, display tooltip upon tap & hide it upon the second tap on mobile', async () => {
        (useDevice as jest.Mock).mockReturnValue({ isDesktop: false });
        render(mockPopover({ ...default_mocked_props, icon: 'question' }));
        const unknown_icon = screen.getByText('IcUnknown');
        expect(unknown_icon).toBeInTheDocument();
        expect(screen.queryByText(tooltip_message)).not.toBeInTheDocument();

        await userEvent.click(unknown_icon);
        await waitFor(() => {
            expect(screen.queryByText(blue_info_icon)).not.toBeInTheDocument();
            expect(screen.getByText(tooltip_message)).toBeInTheDocument();
        });

        await userEvent.click(unknown_icon);
        await waitFor(() => {
            expect(screen.queryByText(tooltip_message)).not.toBeInTheDocument();
        });
    });
    it('should hide the target icon when disable_target_icon === true', () => {
        render(mockPopover({ ...default_mocked_props, disable_target_icon: true }));
        expect(screen.queryByText(target_info_icon)).not.toBeInTheDocument();
        expect(screen.getByText(children)).toBeInTheDocument();
    });
    it('should not open tooltip when message is undefined', async () => {
        render(mockPopover({ ...default_mocked_props, message: undefined }));

        const info_icon = screen.getByText(target_info_icon);
        expect(info_icon).toBeInTheDocument();
        const message = screen.queryByText(tooltip_message);
        expect(message).not.toBeInTheDocument();

        await userEvent.hover(info_icon);
        await waitFor(() => {
            expect(screen.queryByText(blue_info_icon)).not.toBeInTheDocument();
            expect(message).not.toBeInTheDocument();
        });
    });
    it('[DCR-022] should call onBubbleClose when the bubble is unhovered in mobile', async () => {
        (useDevice as jest.Mock).mockReturnValue({ isDesktop: false });
        window.innerWidth = MAX_MOBILE_WIDTH;
        const onBubbleClose = jest.fn();
        render(mockPopover({ ...default_mocked_props, onBubbleClose }));
        const info_icon = screen.getByText(target_info_icon);

        await userEvent.click(info_icon);
        await waitFor(() => {
            expect(screen.getByText(tooltip_message)).toBeInTheDocument();
        });

        const message = screen.getByText(tooltip_message);
        await userEvent.hover(message);
        await userEvent.unhover(message);
        await waitFor(() => {
            expect(onBubbleClose).toBeCalled();
        });
    });
    it('[DCR-022] should render the bubble inside the relative container when relative_render === true', async () => {
        (useDevice as jest.Mock).mockReturnValue({ isDesktop: true });
        render(mockPopover({ ...default_mocked_props, relative_render: true }));

        await userEvent.hover(screen.getByText(target_info_icon));
        await waitFor(() => {
            const relative_container = screen.getByTestId(relative_container_testid);
            expect(within(relative_container).getByText(tooltip_message)).toBeInTheDocument();
        });
    });
});
