import React from 'react';

import { mockStore } from '@deriv/stores';
import { render, screen } from '@testing-library/react';

import TraderProviders from '../../../../trader-providers';
import ReplayChart from '../replay-chart';

jest.mock('Modules/SmartChart', () => ({
    SmartChart: () => <div data-testid='dt_mock_chart'>Mocked Chart</div>,
}));

jest.mock('Modules/SmartChart/Components/Markers/marker', () => ({
    __esModule: true,
    default: () => <div>Mocked Marker</div>,
}));

jest.mock('Modules/SmartChart/Components/Markers/reset-contract-chart-elements', () => ({
    __esModule: true,
    default: () => <div>Mocked Reset Elements</div>,
}));

// Mock the adapter hook so it mirrors the real connection gate: while `is_connection_opened`
// is false, the reference-data fetch is deferred (no tradingTimes, isLoading stays true), which
// is what makes ReplayChart show its loader instead of a blank chart.
const mockUseSmartChartsAdapter = jest.fn(({ is_connection_opened }: { is_connection_opened?: boolean } = {}) => {
    const is_gate_closed = is_connection_opened === false;
    return {
        chartData: is_gate_closed
            ? { activeSymbols: [] } // tradingTimes withheld until the connection opens
            : { activeSymbols: [], tradingTimes: {} },
        isLoading: is_gate_closed,
        error: null,
        getQuotes: jest.fn(),
        subscribeQuotes: jest.fn(),
        unsubscribeQuotes: jest.fn(),
        retryFetchChartData: jest.fn(),
        shouldUseCandlesOverride: false,
    };
});

jest.mock('Modules/SmartChart/Hooks/useSmartChartsAdapter', () => ({
    useSmartChartsAdapter: (...args: unknown[]) => (mockUseSmartChartsAdapter as (...a: unknown[]) => unknown)(...args),
}));

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: jest.fn(() => ({ isMobile: false, isDesktop: true, isTablet: false })),
}));

describe('<ReplayChart>', () => {
    const props = {
        is_dark_theme_prop: true,
        is_accumulator_contract: true,
        is_reset_contract: false,
    };

    const getStore = (is_socket_opened: boolean) =>
        mockStore({
            contract_replay: {
                contract_store: {
                    contract_config: {
                        end_epoch: 1234567890,
                        chart_type: 'line',
                        start_epoch: 1234567880,
                        granularity: 60,
                    },
                    is_digit_contract: false,
                    barriers_array: [],
                    getContractsArray: () => [],
                    markers_array: [],
                    contract_info: {
                        underlying_symbol: 'R_50',
                        audit_details: { all_ticks: [] },
                        barrier_count: 1,
                        contract_id: 12345,
                        contract_type: 'CALL',
                    },
                },
                chart_state: 'READY',
                chartStateChange: jest.fn(),
                margin: 0,
            },
            common: {
                app_routing_history: [],
                current_language: 'en',
                is_socket_opened,
            },
            ui: {
                is_dark_mode_on: false,
            },
        });

    beforeEach(() => {
        mockUseSmartChartsAdapter.mockClear();
    });

    it('renders SmartChart component with correct props', () => {
        render(
            <TraderProviders store={getStore(true)}>
                <ReplayChart {...props} />
            </TraderProviders>
        );

        const mockChartElement = screen.getByTestId('dt_mock_chart');
        expect(mockChartElement).toBeInTheDocument();
        expect(screen.getByText('Mocked Chart')).toBeInTheDocument();
    });

    it('passes is_socket_opened as is_connection_opened into the adapter hook', () => {
        render(
            <TraderProviders store={getStore(true)}>
                <ReplayChart {...props} />
            </TraderProviders>
        );

        expect(mockUseSmartChartsAdapter).toHaveBeenCalledWith(expect.objectContaining({ is_connection_opened: true }));
    });

    it('shows the loader and does not render the chart while the socket is closed', () => {
        render(
            <TraderProviders store={getStore(false)}>
                <ReplayChart {...props} />
            </TraderProviders>
        );

        // Gate closed: adapter received is_connection_opened=false, so no chart — loader instead.
        expect(mockUseSmartChartsAdapter).toHaveBeenCalledWith(
            expect.objectContaining({ is_connection_opened: false })
        );
        expect(screen.queryByTestId('dt_mock_chart')).not.toBeInTheDocument();
    });

    it('renders the chart once the socket is open and reference data resolves', () => {
        render(
            <TraderProviders store={getStore(true)}>
                <ReplayChart {...props} />
            </TraderProviders>
        );

        expect(screen.getByTestId('dt_mock_chart')).toBeInTheDocument();
    });
});
