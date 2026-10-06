import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AVAILABLE_CONTRACTS, CONTRACT_LIST } from 'AppV2/Utils/trade-types-utils';

import GuideDescriptionModal from '../guide-description-modal';

const mockProps = {
    contract_list: AVAILABLE_CONTRACTS,
    is_open: true,
    onChipSelect: jest.fn(),
    onClose: jest.fn(),
    onTermClick: jest.fn(),
    selected_contract_type: CONTRACT_LIST.ACCUMULATORS,
    show_guide_for_selected_contract: false,
};

jest.mock('@deriv/stores', () => ({
    ...jest.requireActual('@deriv/stores'),
    useStore: () => ({ ui: { is_dark_mode_on: false } }),
}));

jest.mock('@lottiefiles/dotlottie-react', () => ({
    DotLottieReact: jest.fn(() => <div>DotLottieReact</div>),
}));

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: () => ({ isMobile: true }),
}));

describe('DescriptionModal', () => {
    beforeAll(() => {
        HTMLDialogElement.prototype.show = jest.fn();
        HTMLDialogElement.prototype.showModal = jest.fn();
        HTMLDialogElement.prototype.close = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render component', () => {
        render(<GuideDescriptionModal {...mockProps} />);

        AVAILABLE_CONTRACTS.forEach(({ id }) => expect(screen.getByText(id)).toBeInTheDocument());
        expect(screen.getByText('Got it')).toBeInTheDocument();
    });

    it('should open video player if user clicked on video preview', async () => {
        render(<GuideDescriptionModal {...mockProps} />);

        expect(screen.queryByTestId('dt_video_player')).not.toBeInTheDocument();
        await userEvent.click(screen.getByTestId('dt_video_preview'));

        expect(screen.getByTestId('dt_video_player')).toBeInTheDocument();
    });

    it('renders the title in all three shells, including the inline one landscape uses', () => {
        const { rerender } = render(<GuideDescriptionModal {...mockProps} />);
        expect(screen.getByRole('heading', { name: 'Trade types' })).toBeInTheDocument();

        // `show_description_in_a_modal={false}` is the landscape guide page — it used to get no
        // heading, so the caller rendered its own.
        rerender(<GuideDescriptionModal {...mockProps} show_description_in_a_modal={false} />);
        expect(screen.getByRole('heading', { name: 'Trade types' })).toBeInTheDocument();
    });

    it('titles the guide after the trade type when showing just that one', () => {
        render(<GuideDescriptionModal {...mockProps} show_guide_for_selected_contract />);

        expect(screen.getByRole('heading', { name: CONTRACT_LIST.ACCUMULATORS })).toBeInTheDocument();
    });

    it('should render component with description for only for selected trade type if show_guide_for_selected_contract === true', () => {
        render(<GuideDescriptionModal {...mockProps} show_guide_for_selected_contract />);

        AVAILABLE_CONTRACTS.forEach(({ id }) =>
            id === CONTRACT_LIST.ACCUMULATORS
                ? expect(screen.getByText(id)).toBeInTheDocument()
                : expect(screen.queryByText(id)).not.toBeInTheDocument()
        );
    });
});
