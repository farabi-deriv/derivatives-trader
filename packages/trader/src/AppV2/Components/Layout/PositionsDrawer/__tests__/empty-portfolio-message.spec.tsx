import { render, screen } from '@testing-library/react';

import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';

import EmptyPortfolioMessage from '../empty-portfolio-message';

jest.mock('AppV2/Hooks/useIsPhoneLandscape', () => jest.fn(() => false));
jest.mock('@deriv/quill-icons', () => ({
    LegacyPositionIcon: () => <div data-testid='position-icon' />,
    StandaloneBriefcaseRegularIcon: () => <div data-testid='briefcase-icon' />,
}));

const mockUseIsPhoneLandscape = useIsPhoneLandscape as jest.Mock;

describe('EmptyPortfolioMessage', () => {
    beforeEach(() => mockUseIsPhoneLandscape.mockReturnValue(false));

    it('[EPM-001] renders the one-line message with the position icon outside landscape', () => {
        render(<EmptyPortfolioMessage />);

        expect(screen.getByText('You have no open positions.')).toBeInTheDocument();
        expect(screen.getByTestId('position-icon')).toBeInTheDocument();
        expect(screen.queryByTestId('briefcase-icon')).not.toBeInTheDocument();
    });

    it('[EPM-002] renders the briefcase, title and subtitle in landscape', () => {
        mockUseIsPhoneLandscape.mockReturnValue(true);

        render(<EmptyPortfolioMessage />);

        expect(screen.getByTestId('briefcase-icon')).toBeInTheDocument();
        expect(screen.getByText('No open positions yet')).toBeInTheDocument();
        expect(screen.getByText('Your open positions will appear here.')).toBeInTheDocument();
        expect(screen.queryByTestId('position-icon')).not.toBeInTheDocument();
    });

    it('[EPM-002] lets the tab supply its own wording', () => {
        mockUseIsPhoneLandscape.mockReturnValue(true);

        render(<EmptyPortfolioMessage title='No closed positions yet' description='They will appear here.' />);

        expect(screen.getByText('No closed positions yet')).toBeInTheDocument();
        expect(screen.queryByText('No open positions yet')).not.toBeInTheDocument();
    });

    it('[EPM-003] an error takes precedence over both layouts', () => {
        mockUseIsPhoneLandscape.mockReturnValue(true);

        render(<EmptyPortfolioMessage error='Something went wrong' />);

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.queryByTestId('briefcase-icon')).not.toBeInTheDocument();
    });
});
