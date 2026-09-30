import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { mockStore } from '@deriv/stores';
import { useDevice } from '@deriv-com/ui';
import { act, render, screen, waitFor } from '@testing-library/react';

import ReportsProviders from '../../reports-providers';
import ArchivedStatement from '../archived-statement';

jest.mock('@deriv-com/ui', () => ({
    useDevice: jest.fn(() => ({
        isDesktop: true,
        isMobile: false,
        isTablet: false,
    })),
}));

jest.mock('react-virtualized', () => {
    const actual = jest.requireActual('react-virtualized');
    return {
        ...actual,
        AutoSizer: ({ children }: { children: (dimensions: { width: number; height: number }) => React.ReactNode }) =>
            children({ width: 800, height: 600 }),
    };
});

jest.mock('@deriv/components', () => ({
    ...jest.requireActual('@deriv/components'),
    DataList: jest.fn(() => <div data-testid='dt_data_list'>DataList</div>),
    DataTable: jest.fn(() => <div data-testid='dt_data_table'>DataTable</div>),
    Loading: jest.fn(() => <div data-testid='dt_loading_component'>Loading</div>),
}));

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    trackAnalyticsEvent: jest.fn(),
}));

const mockFetchArchivedStatement = jest.fn();
const mockFetchArchivedStatementAccounts = jest.fn();
jest.mock('../../Services/archived-statement', () => ({
    fetchArchivedStatement: (...args: unknown[]) => mockFetchArchivedStatement(...args),
    fetchArchivedStatementAccounts: (...args: unknown[]) => mockFetchArchivedStatementAccounts(...args),
}));

const mockStatementData = {
    transactions: [
        {
            transaction_id: 123456712004,
            account_id: 1,
            loginid: 'ROT12345678',
            action_type: 'sell',
            amount: '-10.00',
            balance_after: '990.00',
            transaction_time: 1609459200,
            contract_id: 100,
            currency: 'USD',
            shortcode: 'CALL_frxEURUSD_100',
            bet_class: null,
            bet_type: null,
            symbol: 'frxEURUSD',
            app_id: 1001,
        },
    ],
    count: 1,
};

const mockAccountsData = {
    loginids: {
        ROT12345678: [{ account_id: 1, currency: 'USD' }],
    },
};

describe('ArchivedStatement', () => {
    let store = mockStore({});
    const emptyMessage = 'You have no previous trade history.';
    const headerText = 'Previous trade history before the system upgrade.';
    const dataList = 'dt_data_list';
    const dataTable = 'dt_data_table';

    const renderArchivedStatement = async () => {
        await act(async () => {
            render(
                <ReportsProviders store={store}>
                    <MemoryRouter>
                        <ArchivedStatement component_icon={<div>IcStatement</div>} />
                    </MemoryRouter>
                </ReportsProviders>
            );
        });
    };

    beforeEach(() => {
        store = mockStore({ client: { is_logged_in: true } });
        mockFetchArchivedStatement.mockReset();
        mockFetchArchivedStatementAccounts.mockReset();
        mockFetchArchivedStatementAccounts.mockResolvedValue(mockAccountsData);
        (useDevice as jest.Mock).mockReturnValue({
            isDesktop: true,
            isMobile: false,
        });
    });

    test('renders empty state message when API returns empty transactions', async () => {
        mockFetchArchivedStatement.mockResolvedValue({ transactions: [], count: 0 });
        await renderArchivedStatement();
        await waitFor(() => {
            expect(screen.getByText(emptyMessage)).toBeInTheDocument();
        });
    });

    test('renders error message on fetch failure', async () => {
        mockFetchArchivedStatement.mockResolvedValue({
            error: { code: 500, status: 'Internal Server Error' },
        });
        await renderArchivedStatement();
        await waitFor(() => {
            expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
        });
    });

    test('renders DataTable on desktop when data is available', async () => {
        mockFetchArchivedStatement.mockResolvedValue(mockStatementData);
        await renderArchivedStatement();
        await waitFor(() => {
            expect(screen.getByTestId(dataTable)).toBeInTheDocument();
        });
    });

    test('renders DataList on mobile when data is available', async () => {
        (useDevice as jest.Mock).mockReturnValue({ isMobile: true });
        mockFetchArchivedStatement.mockResolvedValue(mockStatementData);
        await renderArchivedStatement();
        await waitFor(() => {
            expect(screen.getByTestId(dataList)).toBeInTheDocument();
        });
    });

    test('renders header text', async () => {
        mockFetchArchivedStatement.mockResolvedValue(mockStatementData);
        await renderArchivedStatement();
        await waitFor(() => {
            expect(screen.getByText(headerText)).toBeInTheDocument();
        });
    });

    test('fetches accounts on mount', async () => {
        mockFetchArchivedStatement.mockResolvedValue({ transactions: [], count: 0 });
        await renderArchivedStatement();
        expect(mockFetchArchivedStatementAccounts).toHaveBeenCalled();
    });

    test('passes selected loginid to statement fetch', async () => {
        mockFetchArchivedStatement.mockResolvedValue({ transactions: [], count: 0 });
        await renderArchivedStatement();
        await waitFor(() => {
            expect(mockFetchArchivedStatement).toHaveBeenCalledWith(
                expect.objectContaining({ loginid: 'ROT12345678' })
            );
        });
    });
});
