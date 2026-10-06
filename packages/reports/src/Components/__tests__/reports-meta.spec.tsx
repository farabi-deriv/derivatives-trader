import React from 'react';
import { render, screen } from '@testing-library/react';
import { ReportsMeta } from '../reports-meta';

const mockIsPhoneLandscape = jest.fn(() => false);
jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    isPhoneLandscape: () => mockIsPhoneLandscape(),
}));

jest.mock('../reports-landscape-title', () => {
    const ReportsLandscapeTitle = () => <div data-testid='landscape_title' />;
    return ReportsLandscapeTitle;
});

beforeEach(() => mockIsPhoneLandscape.mockReturnValue(false));

const mockFilterComponent = 'mockFilterComponent';
const mockClassName = 'mockClassName';
const mockProps = {
    filter_component: mockFilterComponent,
    className: mockClassName,
};

describe('ReportsMeta', () => {
    it('should render passed filter_component inside of wrapper div with specific className if className was passed', () => {
        render(<ReportsMeta {...mockProps} />);

        expect(screen.getByTestId('dt_reports_meta_wrapper')).toHaveClass(mockClassName);
        expect(screen.getByText(mockFilterComponent)).toBeInTheDocument();
    });

    it('should render filter_component with specific className if is_statement === true', () => {
        render(<ReportsMeta {...mockProps} is_statement />);

        expect(screen.getByText(mockFilterComponent)).toHaveClass('reports__meta-filter--statement');
    });

    it('[RM-001] adds the heading and page chip in landscape, where they share this row', () => {
        mockIsPhoneLandscape.mockReturnValue(true);
        render(<ReportsMeta {...mockProps} />);

        expect(screen.getByTestId('landscape_title')).toBeInTheDocument();
        expect(screen.getByText(mockFilterComponent)).toBeInTheDocument();
    });

    it('[RM-001] leaves them out in portrait and on desktop, where the shell owns navigation', () => {
        render(<ReportsMeta {...mockProps} />);

        expect(screen.queryByTestId('landscape_title')).not.toBeInTheDocument();
    });
});
