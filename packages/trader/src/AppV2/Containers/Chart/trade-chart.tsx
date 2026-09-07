import React from 'react';

import { TTicksStreamResponse } from '@deriv/api';
import { ChartBarrierStore, getSymbolDisplayName, isAccumulatorContract } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';
import { useTranslations } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import useActiveSymbols from 'AppV2/Hooks/useActiveSymbols';
import { filterPositionsBySymbolAndTradeType } from 'AppV2/Utils/positions-utils';
import { SmartChart } from 'Modules/SmartChart';
import AccumulatorsChartElements from 'Modules/SmartChart/Components/Markers/accumulators-chart-elements';
import ToolbarWidgets from 'Modules/SmartChart/Components/toolbar-widgets';
import useBarrierTouchDrag from 'Modules/SmartChart/Hooks/useBarrierTouchDrag';
import { useSmartChartsAdapter } from 'Modules/SmartChart/Hooks/useSmartChartsAdapter';
import { CHART_CONSTANTS, getMarketsOrder, shouldIgnoreGranularityChange } from 'Modules/SmartChart/Utils/chart-utils';
import { useTraderStore } from 'Stores/useTraderStores';

type TickSpotData = NonNullable<TTicksStreamResponse['tick']>;

type TBottomWidgetsParams = {
    digits: number[];
    tick: TickSpotData | null;
};

const BottomWidgetsMobile = observer(({ digits, tick }: TBottomWidgetsParams) => {
    const { setDigitStats, setTickData } = useTraderStore();

    // Using bottom widgets in V2 to get tick data for all trade types and to get digit stats for Digit trade types
    React.useEffect(() => {
        setTickData(tick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tick]);

    React.useEffect(() => {
        setDigitStats(digits);
        // For digits array, which is coming from SmartChart, reference is not always changing.
        // As it is the same, this useEffect was not triggered on every array update.
        // Computing digits.join('-') directly in deps (not via useMemo) ensures React catches
        // in-place array mutations where the reference stays the same.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [digits.join('-')]);

    // render no bottom widgets on chart
    return null;
});

const TradeChart = observer(() => {
    const { ui, common, contract_trade, portfolio, client } = useStore();
    const { isMobile } = useDevice();
    const { is_logged_in } = client;
    const {
        accumulator_barriers_data,
        accumulator_contract_barriers_data,
        chart_type,
        granularity,
        has_crossed_accu_barriers,
        markers_array,
        updateChartType,
        updateGranularity,
        updateAccumulatorBarriersData,
    } = contract_trade;
    const ref = React.useRef<{ hasPredictionIndicators(): void; triggerPopup(arg: () => void): void }>(null);
    const { all_positions, removePositionById: onClickRemove } = portfolio;
    const { is_chart_countdown_visible, is_chart_layout_default, is_dark_mode_on, active_sidebar_flyout } = ui;
    const { current_language, is_socket_opened } = common;
    const { activeSymbols: raw_active_symbols } = useActiveSymbols();
    const active_symbols = React.useMemo(
        () =>
            raw_active_symbols.map((s: any) => ({
                ...s,
                display_name: getSymbolDisplayName(s.underlying_symbol || s.symbol) || s.display_name,
            })),
        [raw_active_symbols]
    );
    const {
        barriers_flattened: extra_barriers,
        chartStateChange,
        chart_layout,
        contract_type,
        exportLayout,
        has_alternative_source,
        has_barrier,
        main_barrier_flattened: main_barrier,
        setChartStatus,
        show_digits_stats,
        symbol,
        selectMarketAndTradeType,
        setTickData,
        prev_contract_type,
    } = useTraderStore();
    const is_accumulator = isAccumulatorContract(contract_type);
    // Single source of truth for "the chart may only show ticks": it drives the granularity and
    // allowTickChartTypeOnly props below as well as the granularity guard, so the guard cannot
    // drift from the intervals the chart renders as disabled.
    const is_tick_chart_type_only = show_digits_stats || is_accumulator;
    const timeoutsMapRef = React.useRef<Map<number, NodeJS.Timeout>>(new Map());
    const { localize } = useTranslations();

    // Accumulators support only the Area chart on the 1-tick interval. Handing the chart the
    // allow-lists plus the copy lets it disable everything else and explain why on hover, instead
    // of the chart inferring a rule it has no way to name. Memoised because new array identities
    // on every render would churn the chart's props.
    const accumulator_restrictions = React.useMemo(
        () =>
            is_accumulator
                ? {
                    allowedChartTypes: ['line'],
                    allowedGranularities: [0],
                    restrictionMessage: localize(
                        'Only "Area" chart and "1 tick" interval are available for Accumulator.'
                    ),
                }
                : {},
        [is_accumulator, localize]
    );

    // SmartCharts memoises the `toolbarWidget` render prop on the chart's first render and keeps the
    // `onGranularity` callback it receives in its Timeperiod store, so the toolbar goes on calling the
    // callback instance built at mount. A trade-type flag captured in that closure would therefore
    // freeze at its mount value — blocking enabled intervals after leaving Digits/Accumulators and
    // letting disabled ones through after switching to them. Holding the flag in a ref lets the
    // callback read the current value on every invocation.
    const is_tick_chart_type_only_ref = React.useRef(is_tick_chart_type_only);
    is_tick_chart_type_only_ref.current = is_tick_chart_type_only;

    // SmartCharts marks non-tick intervals as disabled while only the tick chart type is allowed,
    // but its Timeperiod.onIntervalClick has no early return for that branch and still fires
    // onGranularity (issue #1037). Dropping the value here keeps the store, LocalStore and the
    // `interval` URL parameter in step with what the chart renders.
    const handleGranularityChange = React.useCallback(
        (new_granularity: number) => {
            if (shouldIgnoreGranularityChange(new_granularity, is_tick_chart_type_only_ref.current)) return;
            updateGranularity(new_granularity);
        },
        [updateGranularity]
    );

    // SmartCharts only binds barrier dragging to mouse events, so touch devices need a bridge.
    useBarrierTouchDrag();

    // Memoize settings object to prevent chart re-initialization
    const settings = React.useMemo(
        () => ({
            countdown: is_chart_countdown_visible,
            isHighestLowestMarkerEnabled: false, // TODO: Pending UI,
            language: current_language.toLowerCase(),
            position: is_chart_layout_default ? 'bottom' : 'left',
            theme: is_dark_mode_on ? 'dark' : 'light',
            ...(is_accumulator
                ? {
                    whitespace: CHART_CONSTANTS.ACCUMULATOR_WHITESPACE,
                    minimumLeftBars: isMobile ? CHART_CONSTANTS.ACCUMULATOR_MIN_LEFT_BARS_MOBILE : undefined,
                }
                : {}),
            ...(has_barrier ? { whitespace: CHART_CONSTANTS.BARRIER_WHITESPACE } : {}),
        }),
        [
            is_chart_countdown_visible,
            current_language,
            is_chart_layout_default,
            is_dark_mode_on,
            is_accumulator,
            isMobile,
            has_barrier,
        ]
    );

    const { current_spot, current_spot_time } = accumulator_barriers_data || {};

    // Use centralized SmartCharts adapter hook
    const { chartData, error, getQuotes, subscribeQuotes, unsubscribeQuotes, retryFetchChartData } =
        useSmartChartsAdapter({
            debug: false,
            activeSymbols: active_symbols,
            is_accumulator,
            updateAccumulatorBarriersData,
            setTickData,
            current_language,
            is_connection_opened: is_socket_opened, // Defer the reference-data fetch until the socket is open
        });

    React.useEffect(() => {
        if ((is_accumulator || show_digits_stats) && ref.current?.hasPredictionIndicators()) {
            const cancelCallback = () => selectMarketAndTradeType(symbol, prev_contract_type);
            ref.current?.triggerPopup(cancelCallback);
        }
    }, [is_accumulator, selectMarketAndTradeType, symbol, prev_contract_type, show_digits_stats]);

    // Memoize barriers array to prevent unnecessary recalculations
    const barriers: ChartBarrierStore[] = React.useMemo(
        () => (main_barrier ? [main_barrier, ...extra_barriers] : extra_barriers),
        [main_barrier, extra_barriers]
    );

    // max ticks to display for mobile view for tick chart
    const max_ticks =
        granularity === 0 ? CHART_CONSTANTS.MAX_TICKS_MOBILE_TICK : CHART_CONSTANTS.MAX_TICKS_MOBILE_CANDLE;

    // Filter positions based on current symbol and contract type
    const filtered_positions = filterPositionsBySymbolAndTradeType(all_positions, symbol, contract_type);

    // Get IDs of closed positions to auto-remove
    const closed_positions_ids =
        filtered_positions &&
        filtered_positions.filter(position => position.contract_info?.is_sold).map(p => p.contract_info.contract_id);

    // Automatically remove closed positions after 8 seconds
    React.useEffect(() => {
        const timeoutsMap = timeoutsMapRef.current;
        const currentClosedIds = new Set(closed_positions_ids);

        // Start timers for newly closed positions
        closed_positions_ids.forEach(positionId => {
            if (!timeoutsMap.has(Number(positionId))) {
                const timeout = setTimeout(() => {
                    onClickRemove(positionId);
                    timeoutsMap.delete(Number(positionId));
                }, CHART_CONSTANTS.CLOSED_POSITION_REMOVE_TIMEOUT);
                timeoutsMap.set(Number(positionId), timeout);
            }
        });

        // Clear timers for positions that are no longer in the closed list
        timeoutsMap.forEach((timeout, positionId) => {
            if (!currentClosedIds.has(positionId)) {
                clearTimeout(timeout);
                timeoutsMap.delete(positionId);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [closed_positions_ids]);

    // Cleanup all timeouts on unmount
    React.useEffect(() => {
        const timeoutsMap = timeoutsMapRef.current;
        return () => {
            timeoutsMap.forEach(timeout => clearTimeout(timeout));
            timeoutsMap.clear();
        };
    }, []);

    // Memoize yAxisMargin to prevent object recreation
    const yAxisMargin = React.useMemo(
        () => ({
            top: isMobile ? CHART_CONSTANTS.Y_AXIS_MARGIN_MOBILE : CHART_CONSTANTS.Y_AXIS_MARGIN_DESKTOP,
        }),
        [isMobile]
    );

    if (!symbol || !active_symbols.length) return null;

    if (error) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '400px',
                    gap: '16px',
                }}
            >
                <div>Error loading chart data: {error.message}</div>
                <button onClick={retryFetchChartData} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                    Retry
                </button>
            </div>
        );
    }

    if (!chartData || !chartData.tradingTimes) return null;

    return (
        <>
            <SmartChart
                key='trade-chart'
                drawingToolFloatingMenuPosition={
                    isMobile
                        ? CHART_CONSTANTS.MOBILE_DRAWING_TOOL_POSITION
                        : CHART_CONSTANTS.DESKTOP_DRAWING_TOOL_POSITION
                }
                ref={ref}
                barriers={barriers}
                contracts_array={markers_array}
                bottomWidgets={BottomWidgetsMobile}
                showLastDigitStats
                chartControlsWidgets={null}
                chartStatusListener={(v: boolean) => setChartStatus(!v, true)}
                chartType={chart_type}
                chartData={chartData}
                getQuotes={getQuotes}
                subscribeQuotes={subscribeQuotes}
                unsubscribeQuotes={unsubscribeQuotes}
                enabledNavigationWidget={!isMobile}
                enabledChartFooter={false}
                id='trade'
                isMobile={isMobile}
                isVerticalScrollEnabled={!isMobile}
                maxTick={isMobile ? max_ticks : undefined}
                granularity={is_tick_chart_type_only ? 0 : granularity}
                settings={settings}
                allowTickChartTypeOnly={is_tick_chart_type_only}
                {...accumulator_restrictions}
                stateChangeListener={chartStateChange}
                symbol={symbol}
                // The redesigned market selector (MarketTabs) replaces the chart's native selector on
                // every device, so the chart top widgets stay empty.
                topWidgets={() => <div />}
                isConnectionOpened={is_socket_opened}
                clearChart={false}
                toolbarWidget={() => {
                    return (
                        <ToolbarWidgets updateChartType={updateChartType} updateGranularity={handleGranularityChange} />
                    );
                }}
                importedLayout={chart_layout}
                onExportLayout={exportLayout}
                shouldFetchTradingTimes={false}
                hasAlternativeSource={has_alternative_source}
                getMarketsOrder={getMarketsOrder}
                should_zoom_out_on_yaxis={is_accumulator}
                yAxisMargin={yAxisMargin}
                isLive
                leftMargin={
                    !isMobile && active_sidebar_flyout
                        ? CHART_CONSTANTS.LEFT_MARGIN_WITH_DRAWER
                        : CHART_CONSTANTS.LEFT_MARGIN_DEFAULT
                }
            >
                {is_accumulator && (
                    <AccumulatorsChartElements
                        all_positions={all_positions}
                        current_spot={current_spot}
                        current_spot_time={current_spot_time}
                        has_crossed_accu_barriers={has_crossed_accu_barriers}
                        should_show_profit_text={!!accumulator_contract_barriers_data.accumulators_high_barrier}
                        symbol={symbol}
                        is_mobile={isMobile}
                    />
                )}
            </SmartChart>
        </>
    );
});
export default TradeChart;
