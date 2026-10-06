import { createRef } from 'react';

import { useDevice } from '@deriv-com/ui';
import { render, screen } from '@testing-library/react';

import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';

import MarketSelection from '../market-selection';

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: jest.fn(),
}));

jest.mock('AppV2/Hooks/useIsPhoneLandscape', () => jest.fn(() => false));

jest.mock('../market-selection-desktop', () => jest.fn(() => 'MockedDesktop'));
jest.mock('../market-selection-mobile', () =>
    jest.fn(({ is_landscape }: { is_landscape?: boolean }) => (is_landscape ? 'MockedLandscape' : 'MockedMobile'))
);

const mockUseDevice = useDevice as jest.Mock;
const mockUseIsPhoneLandscape = useIsPhoneLandscape as jest.Mock;

describe('MarketSelection device dispatcher', () => {
    const setIsOpen = jest.fn();
    const triggerRef = createRef<HTMLElement>();

    beforeEach(() => mockUseIsPhoneLandscape.mockReturnValue(false));

    it('renders the desktop shell on desktop when a triggerRef is provided', () => {
        mockUseDevice.mockReturnValue({ isMobile: false });
        render(<MarketSelection isOpen setIsOpen={setIsOpen} triggerRef={triggerRef} />);
        expect(screen.getByText('MockedDesktop')).toBeInTheDocument();
    });

    it('falls back to the mobile shell on desktop when no triggerRef is provided', () => {
        mockUseDevice.mockReturnValue({ isMobile: false });
        render(<MarketSelection isOpen setIsOpen={setIsOpen} />);
        expect(screen.getByText('MockedMobile')).toBeInTheDocument();
    });

    it('renders the mobile shell on mobile', () => {
        mockUseDevice.mockReturnValue({ isMobile: true });
        render(<MarketSelection isOpen setIsOpen={setIsOpen} triggerRef={triggerRef} />);
        expect(screen.getByText('MockedMobile')).toBeInTheDocument();
    });

    it('renders the full-page landscape shell in phone landscape, not the popover', () => {
        // Landscape reports isMobile: false and supplies a triggerRef, so without the orientation
        // check it would take the desktop branch and open a 900px popover in a 390px-tall viewport.
        mockUseDevice.mockReturnValue({ isMobile: false });
        mockUseIsPhoneLandscape.mockReturnValue(true);

        render(<MarketSelection isOpen setIsOpen={setIsOpen} triggerRef={triggerRef} />);

        expect(screen.getByText('MockedLandscape')).toBeInTheDocument();
        expect(screen.queryByText('MockedDesktop')).not.toBeInTheDocument();
    });
});
