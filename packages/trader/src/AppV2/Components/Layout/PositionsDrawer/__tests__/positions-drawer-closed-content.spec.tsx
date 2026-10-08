import { mockStore, StoreProvider } from '@deriv/stores';
import { render, screen } from '@testing-library/react';

import { PositionsDrawerClosedContent } from '../positions-drawer-closed-content';

const mock_profit_table = {
    data: [] as unknown[],
    is_empty: true,
    is_loading: false,
    handleDateChange: jest.fn(),
    handleScroll: jest.fn(),
    onMount: jest.fn(),
    onUnmount: jest.fn(),
    clearTable: jest.fn(),
};
const mock_filters = { tradeModeFilter: '', timeFilter: '', customTimeRangeFilter: '' };

jest.mock('@deriv/reports/src/Stores/useReportsStores', () => ({
    useReportsStore: () => ({ profit_table: mock_profit_table }),
}));
jest.mock('AppV2/Hooks/useTradeModeFilter', () => () => ({ tradeModeFilter: mock_filters.tradeModeFilter }));
jest.mock('AppV2/Hooks/useTimeFilter', () => () => ({
    timeFilter: mock_filters.timeFilter,
    customTimeRangeFilter: mock_filters.customTimeRangeFilter,
}));
jest.mock('AppV2/Hooks/useIsAutomationEnabled', () => () => ({ is_enabled: true }));
// The trade-mode filter is the client-side one; stand it in as "removes every row when set".
jest.mock('AppV2/Utils/positions-utils', () => ({
    filterByTradeMode: (rows: unknown[], filter: string) => (filter ? [] : rows),
}));
jest.mock('AppV2/Components/ContractCard', () => ({
    ContractCardsSections: () => <div data-testid='contract-cards' />,
}));
jest.mock('../positions-drawer-time-filter', () => {
    const TimeFilter = () => <div />;
    return TimeFilter;
});
jest.mock('../positions-drawer-trade-mode-filter', () => {
    const TradeModeFilter = () => <div />;
    return TradeModeFilter;
});
jest.mock('../empty-portfolio-message', () => {
    const EmptyPortfolioMessage = ({ title }: { title: React.ReactNode }) => <div>{title}</div>;
    return EmptyPortfolioMessage;
});

const renderClosed = () =>
    render(
        <StoreProvider store={mockStore({})}>
            <PositionsDrawerClosedContent />
        </StoreProvider>
    );

describe('PositionsDrawerClosedContent', () => {
    beforeEach(() => {
        Object.assign(mock_profit_table, { data: [], is_empty: true, is_loading: false });
        Object.assign(mock_filters, { tradeModeFilter: '', timeFilter: '', customTimeRangeFilter: '' });
    });

    it('[PDC-001] says there are no closed positions yet when nothing is filtered', () => {
        renderClosed();
        expect(screen.getByText('No closed positions yet')).toBeInTheDocument();
    });

    it('[PDC-001] says no matches when the trade-mode filter removes every loaded row', () => {
        // The server returned rows, so `is_empty` is false — the list only empties client-side.
        Object.assign(mock_profit_table, { data: [{ contract_id: 1 }], is_empty: false });
        mock_filters.tradeModeFilter = 'automation';
        renderClosed();

        expect(screen.getByText('No matches found')).toBeInTheDocument();
        expect(screen.queryByTestId('contract-cards')).not.toBeInTheDocument();
    });

    it('[PDC-001] says no matches when a time range returns nothing', () => {
        mock_filters.timeFilter = 'last_7_days';
        renderClosed();

        expect(screen.getByText('No matches found')).toBeInTheDocument();
    });

    it('[PDC-001] shows neither message while loading', () => {
        Object.assign(mock_profit_table, { is_loading: true, is_empty: false });
        mock_filters.tradeModeFilter = 'automation';
        renderClosed();

        expect(screen.queryByText('No matches found')).not.toBeInTheDocument();
        expect(screen.queryByText('No closed positions yet')).not.toBeInTheDocument();
    });
});
