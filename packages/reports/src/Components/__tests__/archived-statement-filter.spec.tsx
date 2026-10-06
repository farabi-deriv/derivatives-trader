import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ArchivedStatementFilter from '../archived-statement-filter';

const mockIsPhoneLandscape = jest.fn(() => false);
jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    isPhoneLandscape: () => mockIsPhoneLandscape(),
}));

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: () => ({ isMobile: false }),
}));

const mockProps = {
    accounts: [],
    handleDateChange: jest.fn(),
    handleLoginidChange: jest.fn(),
    selectedLoginid: '',
};

const openTimeFilter = async () => {
    render(<ArchivedStatementFilter {...mockProps} />);
    await userEvent.click(screen.getByTestId('dt_dropdown_display'));
};

describe('ArchivedStatementFilter time ranges', () => {
    beforeEach(() => mockIsPhoneLandscape.mockReturnValue(false));

    // RadioOption renders the label twice and the trigger echoes it.
    const isListed = (label: string) => screen.queryAllByText(label).length > 0;

    it('[ASF-001] offers Custom and Yesterday on desktop', async () => {
        await openTimeFilter();

        expect(isListed('Custom')).toBe(true);
        expect(isListed('Yesterday')).toBe(true);
    });

    it('[ASF-002] drops Custom in landscape — its two-month picker has no room there', async () => {
        mockIsPhoneLandscape.mockReturnValue(true);

        await openTimeFilter();

        expect(isListed('Custom')).toBe(false);
    });

    it('[ASF-003] lists exactly the ranges the landscape design shows', async () => {
        mockIsPhoneLandscape.mockReturnValue(true);

        await openTimeFilter();

        ['All time', 'Today', 'Last 7 days', 'Last 30 days', 'Last 60 days', 'Last 90 days'].forEach(label =>
            expect(isListed(label)).toBe(true)
        );
        expect(isListed('Yesterday')).toBe(false);
    });
});
