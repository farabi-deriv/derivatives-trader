import { TActiveSymbolsResponse } from '@deriv/api';

type ActiveSymbols = NonNullable<TActiveSymbolsResponse['active_symbols']>;

/**
 * Orders markets with synthetic_index first if it exists, then alphabetically by underlying_symbol
 * @param active_symbols - Array of active symbols from the API
 * @returns Array of market names in the desired order
 */
export const getMarketsOrder = (active_symbols: ActiveSymbols): string[] => {
    const synthetic_index = 'synthetic_index';
    const has_synthetic_index = active_symbols.some(s => s.market === synthetic_index);

    return active_symbols
        .slice()
        .sort((a, b) => ((a.underlying_symbol || '') < (b.underlying_symbol || '') ? -1 : 1))
        .map(s => s.market)
        .reduce(
            (arr: string[], market: string) => {
                if (arr.indexOf(market) === -1) arr.push(market);
                return arr;
            },
            has_synthetic_index ? [synthetic_index] : []
        );
};

/**
 * Decides whether a granularity coming from the chart's Time interval list must be dropped.
 *
 * SmartCharts renders every non-tick interval as disabled while only the tick chart type is
 * allowed, but still fires `onGranularity` for those items (issue #1037), which would otherwise
 * write a candle granularity to the store, LocalStore and the `interval` URL parameter while the
 * chart keeps rendering ticks.
 *
 * @param granularity - Granularity from the chart; `0` is the tick granularity, values above 0 are
 * candle intervals in seconds (see `Modules/SmartChart/Adapters/types.ts`)
 * @param is_tick_chart_type_only - Whether the current trade type allows the tick chart type only
 * @returns `true` when the granularity should be ignored
 */
export const shouldIgnoreGranularityChange = (granularity: number, is_tick_chart_type_only: boolean): boolean =>
    is_tick_chart_type_only && granularity !== 0;

// Chart configuration constants
export const CHART_CONSTANTS = {
    // Timeout values
    WEBSOCKET_TIMEOUT: 30000, // 30 seconds

    // Chart spacing
    ACCUMULATOR_WHITESPACE: 190,
    BARRIER_WHITESPACE: 110,

    // Max ticks for mobile
    MAX_TICKS_MOBILE_TICK: 8,
    MAX_TICKS_MOBILE_CANDLE: 24,

    // Auto-remove timeout for closed positions
    CLOSED_POSITION_REMOVE_TIMEOUT: 8000, // 8 seconds

    // Chart margins
    LEFT_MARGIN_WITH_DRAWER: 328,
    LEFT_MARGIN_DEFAULT: 80,

    // Mobile chart positioning
    MOBILE_DRAWING_TOOL_POSITION: { x: 100, y: 100 },
    DESKTOP_DRAWING_TOOL_POSITION: { x: 400, y: 200 },

    // Y-axis margins
    Y_AXIS_MARGIN_MOBILE: 76,
    Y_AXIS_MARGIN_DESKTOP: 106,

    // Minimum left bars for accumulator on mobile
    ACCUMULATOR_MIN_LEFT_BARS_MOBILE: 3,

    /**
     * Y-axis zoom for Accumulators: the chart's own maximum, i.e. the least
     * padding a drag on the quote labels can reach (`BasicChartState`'s
     * `minVerticalPaddingFraction` in deriv_chart).
     *
     * Accumulators is the one trade type whose barriers are a control. Zoomed
     * out, the band collapses to a few pixels and is neither readable nor
     * draggable, so it opens as tall as the chart allows. The user can still
     * drag the axis from there.
     */
    ACCUMULATOR_VERTICAL_PADDING_FRACTION: 0.05,
} as const;
