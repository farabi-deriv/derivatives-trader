import { render, screen } from '@testing-library/react';

import useIsPhoneLandscape from 'AppV2/Hooks/useIsPhoneLandscape';

import PositionsDrawerTabs from '../positions-drawer-tabs';

jest.mock('AppV2/Hooks/useIsPhoneLandscape', () => jest.fn(() => false));

jest.mock('@deriv-com/quill-ui', () => ({
    SegmentedControlSingleChoice: ({ options }: { options: { label: string }[] }) => (
        <div data-testid='segmented-control'>{options.map(o => o.label).join('|')}</div>
    ),
    Tab: {
        Container: ({ children }: { children: React.ReactNode }) => <div data-testid='tabs'>{children}</div>,
        List: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Trigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    },
}));

jest.mock('../positions-drawer-content', () => ({
    PositionsDrawerContent: () => <div data-testid='open-content' />,
    PositionsDrawerFooter: () => <div data-testid='open-footer' />,
}));
jest.mock('../positions-drawer-closed-content', () => ({
    PositionsDrawerClosedContent: () => <div data-testid='closed-content' />,
    PositionsDrawerClosedFooter: () => <div data-testid='closed-footer' />,
}));

const mockUseIsPhoneLandscape = useIsPhoneLandscape as jest.Mock;

describe('PositionsDrawerTabs', () => {
    beforeEach(() => mockUseIsPhoneLandscape.mockReturnValue(false));

    it('[PDT-001] uses the segmented control in landscape', () => {
        mockUseIsPhoneLandscape.mockReturnValue(true);

        render(<PositionsDrawerTabs />);

        expect(screen.getByTestId('segmented-control')).toHaveTextContent('Open|Closed');
        expect(screen.queryByTestId('tabs')).not.toBeInTheDocument();
    });

    it('[PDT-001] keeps the underlined tabs elsewhere', () => {
        render(<PositionsDrawerTabs />);

        expect(screen.getByTestId('tabs')).toBeInTheDocument();
        expect(screen.queryByTestId('segmented-control')).not.toBeInTheDocument();
    });

    it('[PDT-002] drops the footer slot in landscape — the summary moves above the list', () => {
        mockUseIsPhoneLandscape.mockReturnValue(true);

        render(<PositionsDrawerTabs />);

        expect(screen.queryByTestId('open-footer')).not.toBeInTheDocument();
    });

    it('[PDT-002] keeps the footer slot elsewhere', () => {
        render(<PositionsDrawerTabs />);

        expect(screen.getByTestId('open-footer')).toBeInTheDocument();
    });
});
