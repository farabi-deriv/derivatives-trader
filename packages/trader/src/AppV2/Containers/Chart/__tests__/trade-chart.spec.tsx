import { makeObservable, observable, runInAction } from 'mobx';

import { TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { act, render, screen, waitFor } from '@testing-library/react';

import useActiveSymbols from 'AppV2/Hooks/useActiveSymbols';
import useIsPhoneViewport from 'AppV2/Hooks/useIsPhoneViewport';
import { isDigitTradeType } from 'AppV2/Utils/digits';
import { useSmartChartsAdapter } from 'Modules/SmartChart/Hooks/useSmartChartsAdapter';

import TraderProviders from '../../../../trader-providers';
import TradeChart from '../trade-chart';

const mock_chart = 'Mocked Chart';
const mock_toolbar_widgets = 'Mocked Toolbar Widgets';

let mockSmartChartProps: Record<string, any> = {};
jest.mock('Modules/SmartChart', () => ({
    SmartChart: (props: Record<string, any>) => {
        mockSmartChartProps = props;
        return 'Mocked Chart';
    },
}));

let mockToolbarWidgetsProps: Record<string, any> = {};
jest.mock('Modules/SmartChart/Components/toolbar-widgets', () => ({
    __esModule: true,
    default: (props: Record<string, any>) => {
        mockToolbarWidgetsProps = props;
        return 'Mocked Toolbar Widgets';
    },
}));

jest.mock('Modules/SmartChart/Hooks/useSmartChartsAdapter', () => ({
    useSmartChartsAdapter: jest.fn(() => ({
        smartChartsAdapter: {},
        chartData: {
            activeSymbols: [{ symbol: 'EURUSD', display_name: 'EUR/USD', market: 'forex', exchange_is_open: 1 }],
            tradingTimes: { EURUSD: { isOpen: true, openTime: '00:00', closeTime: '23:59' } },
        },
        isLoading: false,
        error: null,
        getQuotes: jest.fn(),
        subscribeQuotes: jest.fn(),
        unsubscribeQuotes: jest.fn(),
        retryFetchChartData: jest.fn(),
        isValidGranularity: jest.fn(() => true),
        shouldUseCandlesOverride: false,
    })),
}));
jest.mock('react-router-dom', () => ({
    useLocation: jest.fn(() => ({
        pathname: '/',
    })),
    withRouter: jest.fn(children => children),
}));
jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: jest.fn(() => ({ isDesktop: true })),
}));
jest.mock('AppV2/Hooks/useActiveSymbols', () => ({
    ...jest.requireActual('AppV2/Hooks/useActiveSymbols'),
    __esModule: true,
    default: jest.fn(() => ({
        activeSymbols: [{ symbol: 'EURUSD', display_name: 'EUR/USD', exchange_is_open: 1 }],
    })),
}));
jest.mock('AppV2/Hooks/useIsPhoneViewport', () => ({ __esModule: true, default: jest.fn(() => false) }));

describe('TradeChart', () => {
    const mockedTradeChart = (store_override?: ReturnType<typeof mockStore>) => {
        const store = store_override || mockStore({});
        render(
            <TraderProviders store={store}>
                <TradeChart />
            </TraderProviders>
        );
    };

    // SmartChart is mocked, so the toolbarWidget render prop is never invoked by the chart itself.
    // Rendering the element it returns lets the mocked ToolbarWidgets capture the callbacks it is given.
    const renderToolbarWidgets = (
        store: ReturnType<typeof mockStore>,
        toolbar_widget: () => React.ReactNode = mockSmartChartProps.toolbarWidget
    ) => {
        mockToolbarWidgetsProps = {};
        render(<TraderProviders store={store}>{toolbar_widget()}</TraderProviders>);
    };

    it('does not render the chart if active_symbols array is empty', () => {
        (useActiveSymbols as jest.Mock).mockReturnValueOnce({
            activeSymbols: [],
        });
        mockedTradeChart();

        expect(screen.queryByText(mock_chart)).not.toBeInTheDocument();
    });

    it('does not render the chart if there is no symbol', () => {
        const store = mockStore({});
        store.modules.trade.symbol = '';
        mockedTradeChart(store);

        expect(screen.queryByText(mock_chart)).not.toBeInTheDocument();
    });

    it('renders the chart', async () => {
        const store = mockStore({});
        store.modules.trade.symbol = 'EURUSD';
        mockedTradeChart(store);
        // Wait for async chartData effect
        expect(await screen.findByText(mock_chart)).toBeInTheDocument();
    });

    it('wires is_socket_opened to the chart data adapter and SmartChart connection props', async () => {
        const store = mockStore({});
        store.modules.trade.symbol = 'EURUSD';
        store.common.is_socket_opened = true;
        mockedTradeChart(store);

        expect(await screen.findByText(mock_chart)).toBeInTheDocument();
        expect(useSmartChartsAdapter).toHaveBeenCalledWith(expect.objectContaining({ is_connection_opened: true }));
        expect(mockSmartChartProps.isConnectionOpened).toBe(true);
    });

    // The chart is a canvas: it reads nothing from the app's CSS, so `settings.theme` is the only
    // thing that keeps it in the same theme as the page.
    describe('chart theme', () => {
        it.each([
            [true, 'dark'],
            [false, 'light'],
        ])('passes the resolved theme to the chart when is_dark_mode_on is %s', async (is_dark_mode_on, theme) => {
            const store = mockStore({});
            store.modules.trade.symbol = 'EURUSD';
            store.ui.is_dark_mode_on = is_dark_mode_on;
            mockedTradeChart(store);

            expect(await screen.findByText(mock_chart)).toBeInTheDocument();
            expect(mockSmartChartProps.settings.theme).toBe(theme);
        });

        it('re-themes the chart without a reload when the theme changes', async () => {
            const store = mockStore({});
            store.modules.trade.symbol = 'EURUSD';
            // The mock store is a plain object; make the flag observable so flipping it re-renders the
            // observer component the way the real ui-store does on a system or selector theme change.
            makeObservable(store.ui, { is_dark_mode_on: observable });
            mockedTradeChart(store);

            expect(await screen.findByText(mock_chart)).toBeInTheDocument();
            expect(mockSmartChartProps.settings.theme).toBe('light');

            act(() => {
                runInAction(() => {
                    store.ui.is_dark_mode_on = true;
                });
            });

            await waitFor(() => expect(mockSmartChartProps.settings.theme).toBe('dark'));
        });
    });

    describe('granularity changes coming from the chart', () => {
        const mockedTradeChartWithToolbar = async (contract_type: string) => {
            const store = mockStore({});
            store.modules.trade.symbol = 'EURUSD';
            store.modules.trade.contract_type = contract_type;
            // The mock store has no computed properties; mirror the real trade-store, where
            // show_digits_stats is derived from the trade type.
            store.modules.trade.show_digits_stats = isDigitTradeType(contract_type);
            mockedTradeChart(store);

            expect(await screen.findByText(mock_chart)).toBeInTheDocument();
            renderToolbarWidgets(store);
            expect(screen.getByText(mock_toolbar_widgets)).toBeInTheDocument();

            return store;
        };

        it('ignores a candle granularity while only the tick chart type is allowed', async () => {
            const store = await mockedTradeChartWithToolbar(TRADE_TYPES.ACCUMULATOR);

            expect(mockSmartChartProps.allowTickChartTypeOnly).toBe(true);
            expect(mockSmartChartProps.granularity).toBe(0);

            mockToolbarWidgetsProps.updateGranularity(60);

            expect(store.contract_trade.updateGranularity).not.toHaveBeenCalled();
        });

        it('applies the tick granularity while only the tick chart type is allowed', async () => {
            const store = await mockedTradeChartWithToolbar(TRADE_TYPES.ACCUMULATOR);

            mockToolbarWidgetsProps.updateGranularity(0);

            expect(store.contract_trade.updateGranularity).toHaveBeenCalledWith(0);
        });

        // is_tick_chart_type_only is an OR of show_digits_stats and is_accumulator; the cases above
        // only reach it through Accumulators, so these pin the Digits disjunct as well.
        it('ignores a candle granularity for a Digits trade type', async () => {
            const store = await mockedTradeChartWithToolbar(TRADE_TYPES.MATCH_DIFF);

            expect(mockSmartChartProps.allowTickChartTypeOnly).toBe(true);
            expect(mockSmartChartProps.granularity).toBe(0);

            mockToolbarWidgetsProps.updateGranularity(60);

            expect(store.contract_trade.updateGranularity).not.toHaveBeenCalled();
        });

        it('applies the tick granularity for a Digits trade type', async () => {
            const store = await mockedTradeChartWithToolbar(TRADE_TYPES.MATCH_DIFF);

            mockToolbarWidgetsProps.updateGranularity(0);

            expect(store.contract_trade.updateGranularity).toHaveBeenCalledWith(0);
        });

        it('applies a candle granularity for a candle-capable trade type', async () => {
            const store = await mockedTradeChartWithToolbar(TRADE_TYPES.RISE_FALL);

            expect(mockSmartChartProps.allowTickChartTypeOnly).toBe(false);

            mockToolbarWidgetsProps.updateGranularity(60);

            expect(store.contract_trade.updateGranularity).toHaveBeenCalledWith(60);
        });
    });

    // SmartCharts memoises the `toolbarWidget` render prop once (`React.useCallback(toolbarWidget, [t.lang])`
    // in its Chart component) and stores the resulting `onGranularity` callback in its Timeperiod store, so
    // the toolbar keeps invoking the callback instance built on the chart's first render. These tests pin the
    // guard to the *current* trade type by capturing the render prop before the trade type changes and
    // invoking it afterwards, the way the mounted chart does.
    describe('granularity changes after the trade type changed', () => {
        const mountedTradeChart = async (contract_type: string) => {
            const store = mockStore({});
            store.modules.trade.symbol = 'EURUSD';
            store.modules.trade.contract_type = contract_type;
            // The mock store is a plain object; make the trade type observable so switching it re-renders
            // the observer component exactly as the real store does.
            makeObservable(store.modules.trade, { contract_type: observable });
            mockedTradeChart(store);

            expect(await screen.findByText(mock_chart)).toBeInTheDocument();

            return store;
        };

        const switchTradeType = async (store: ReturnType<typeof mockStore>, contract_type: string) => {
            act(() => {
                runInAction(() => {
                    store.modules.trade.contract_type = contract_type;
                });
            });
            await waitFor(() =>
                expect(mockSmartChartProps.allowTickChartTypeOnly).toBe(contract_type === TRADE_TYPES.ACCUMULATOR)
            );
        };

        it('applies a candle granularity after leaving a tick-only trade type', async () => {
            const store = await mountedTradeChart(TRADE_TYPES.ACCUMULATOR);
            const toolbar_widget = mockSmartChartProps.toolbarWidget;

            await switchTradeType(store, TRADE_TYPES.RISE_FALL);
            renderToolbarWidgets(store, toolbar_widget);
            mockToolbarWidgetsProps.updateGranularity(60);

            expect(store.contract_trade.updateGranularity).toHaveBeenCalledWith(60);
        });

        it('ignores a candle granularity after switching to a tick-only trade type', async () => {
            const store = await mountedTradeChart(TRADE_TYPES.RISE_FALL);
            const toolbar_widget = mockSmartChartProps.toolbarWidget;

            await switchTradeType(store, TRADE_TYPES.ACCUMULATOR);
            renderToolbarWidgets(store, toolbar_widget);
            mockToolbarWidgetsProps.updateGranularity(60);

            expect(store.contract_trade.updateGranularity).not.toHaveBeenCalled();
        });
    });

    describe('phone-landscape chart props', () => {
        afterEach(() => (useIsPhoneViewport as jest.Mock).mockReturnValue(false));

        it('[LTM-007] gives the chart the touch-modality/accumulator-geometry values in landscape', async () => {
            (useIsPhoneViewport as jest.Mock).mockReturnValue(true);
            const store = mockStore({});
            store.modules.trade.symbol = 'EURUSD';
            // is_accumulator is derived from contract_type via isAccumulatorContract.
            store.modules.trade.contract_type = TRADE_TYPES.ACCUMULATOR;
            mockedTradeChart(store);

            await screen.findByText(mock_chart);

            expect(mockSmartChartProps.isMobile).toBe(true);
            expect(mockSmartChartProps.isVerticalScrollEnabled).toBe(false);
            expect(mockSmartChartProps.enabledNavigationWidget).toBe(false);
            expect(mockSmartChartProps.settings.minimumLeftBars).toBe(3);
            expect(mockSmartChartProps.yAxisMargin.top).toBe(76);
            expect(mockSmartChartProps.leftMargin).toBe(80);
            expect(mockSmartChartProps.drawingToolFloatingMenuPosition).toEqual({ x: 100, y: 100 });
        });

        it('[LTM-007] keeps maxTick bounded at 8 in landscape, never undefined', async () => {
            (useIsPhoneViewport as jest.Mock).mockReturnValue(true);
            const store = mockStore({});
            store.modules.trade.symbol = 'EURUSD';
            mockedTradeChart(store);

            await screen.findByText(mock_chart);

            expect(mockSmartChartProps.maxTick).toBe(8);
            expect(mockSmartChartProps.maxTick).not.toBeUndefined();
        });
    });
});
