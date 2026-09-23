import React from 'react';
import { toJS } from 'mobx';

import {
    createSmartChartsChampionAdapter,
    TGetQuotes,
    TGranularity,
    transformations,
    TSubscribeQuotes,
    TUnsubscribeQuotes,
} from '../Adapters';
import { enrichActiveSymbols } from '../Adapters/transformers';

interface AccumulatorBarriersData {
    current_spot?: number;
    current_spot_time?: number;
    tick_update_timestamp?: number;
    accumulators_high_barrier?: string;
    accumulators_low_barrier?: string;
    barrier_spot_distance?: string;
    previous_spot_time?: number;
    underlying?: string;
}

interface TickData {
    pip_size: number;
    quote: number;
}

// Using any[] for activeSymbols to avoid complex type conflicts with different symbol formats
// This is acceptable as the symbols are processed by the adapter which handles type validation
interface UseSmartChartsAdapterConfig {
    debug?: boolean;
    activeSymbols?: any[];
    granularity?: number;
    is_accumulator?: boolean;
    updateAccumulatorBarriersData?: (data: AccumulatorBarriersData) => void;
    setTickData?: (data: TickData) => void;
    current_language?: string;
    minStartEpoch?: number; // If tick data doesn't cover this epoch, switch to candles
    is_connection_opened?: boolean; // Gate the mount fetch until the WebSocket is open (undefined = open)
}

interface ChartData {
    activeSymbols: any[];
    tradingTimes?: Record<string, { isOpen: boolean; openTime: string; closeTime: string }>;
}

/**
 * Builds a fallback trading-times map from active symbols so every symbol the chart can
 * select has an entry, keyed exactly like the real map from the adapter's
 * toTradingTimesMap (underlying_symbol || symbol).
 *
 * SmartCharts reads per-symbol keys from this map without guarding (e.g.
 * `_tradingTimesMap?.[symbol].delay_amount` in TradingTimes), so a symbol missing from
 * the applied map throws an uncaught TypeError and leaves the chart stuck on its loader.
 * The open/closed state comes from the symbol's `exchange_is_open`; open/close times are
 * unknown ('--') until the real trading_times response backfills them.
 */
const buildFallbackTradingTimes = (symbols: any[]): NonNullable<ChartData['tradingTimes']> =>
    Object.fromEntries(
        (symbols || [])
            .filter(s => s && (s.underlying_symbol || s.symbol))
            .map(s => [
                s.underlying_symbol || s.symbol,
                { isOpen: !!s.exchange_is_open, openTime: '--', closeTime: '--' },
            ])
    );

interface UseSmartChartsAdapterReturn {
    smartChartsAdapter: ReturnType<typeof createSmartChartsChampionAdapter>;
    chartData: ChartData;
    isLoading: boolean;
    error: Error | null;
    getQuotes: TGetQuotes;
    subscribeQuotes: TSubscribeQuotes;
    unsubscribeQuotes: TUnsubscribeQuotes;
    retryFetchChartData: () => Promise<void>;
    isValidGranularity: (g: number) => g is TGranularity;
    shouldUseCandlesOverride: boolean; // True when tick data doesn't cover minStartEpoch
}

/**
 * Custom hook to manage SmartCharts Champion Adapter logic
 * Centralizes the common functionality used across all chart components
 */
export const useSmartChartsAdapter = (config: UseSmartChartsAdapterConfig = {}): UseSmartChartsAdapterReturn => {
    const {
        debug = false,
        activeSymbols,
        granularity,
        is_accumulator,
        updateAccumulatorBarriersData,
        setTickData,
        current_language,
        minStartEpoch,
        is_connection_opened,
    } = config;

    // Store raw data for re-enrichment on language change
    const rawDataRef = React.useRef<{
        rawActiveSymbols: any[];
        rawTradingTimes: any;
    }>({
        rawActiveSymbols: [],
        rawTradingTimes: {},
    });

    // Initialize SmartCharts Champion Adapter
    const smartChartsAdapter = React.useMemo(() => {
        return createSmartChartsChampionAdapter({
            debug,
        });
    }, [debug]);

    // Chart data state — transform symbols immediately so SmartChart always gets the right shape.
    // When activeSymbols are pre-fetched (trade chart): seed tradingTimes with a fallback map
    // (one entry per active symbol, never {}) so the chart renders immediately AND SmartCharts'
    // unguarded per-symbol reads (e.g. delay_amount) can't throw if the user switches symbol
    // before the real trading_times response arrives.
    // When activeSymbols are empty (replay chart): leave tradingTimes undefined so the guard blocks
    // until fetchChartData provides real symbol data (SmartChart needs symbolMap to render).
    const [chartData, setChartData] = React.useState<ChartData>(() => ({
        activeSymbols: activeSymbols?.length ? transformations.toActiveSymbols(toJS(activeSymbols)) : [],
        ...(activeSymbols?.length ? { tradingTimes: buildFallbackTradingTimes(toJS(activeSymbols)) } : {}),
    }));
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);
    const [shouldUseCandlesOverride, setShouldUseCandlesOverride] = React.useState(false);

    // Type guard for granularity validation
    const isValidGranularity = React.useCallback((g: number): g is TGranularity => {
        return [0, 60, 120, 180, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 86400].includes(g);
    }, []);

    // One-shot retry guard + timer for a failed trading_times fetch (see fetchChartData).
    const hasRetriedEmptyTradingTimesRef = React.useRef(false);
    const retryTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Fetch trading times and enrich active symbols.
    // active_symbols comes from React Query (via the activeSymbols prop) —
    // we only fetch trading_times here to avoid duplicating the active_symbols WS call.
    const fetchChartData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await smartChartsAdapter.getChartData(activeSymbols);
            const { rawData, activeSymbols: enrichedSymbols, tradingTimes } = data;
            rawDataRef.current = {
                rawActiveSymbols: rawData.activeSymbols,
                rawTradingTimes: rawData.tradingTimes,
            };

            setChartData({
                activeSymbols: enrichedSymbols,
                // Backfill: any symbol missing from the trading_times response (or the whole
                // map, if the WS call failed and the adapter settled on {}) keeps a fallback
                // entry so SmartCharts' unguarded per-symbol reads can't throw.
                tradingTimes: { ...buildFallbackTradingTimes(enrichedSymbols), ...tradingTimes },
            });

            // The adapter swallows trading_times WS errors and resolves with an empty map,
            // so an empty map alongside non-empty symbols means the fetch failed. Retry once
            // so the session isn't stuck on fallback entries permanently.
            if (
                enrichedSymbols?.length &&
                !Object.keys(tradingTimes || {}).length &&
                !hasRetriedEmptyTradingTimesRef.current
            ) {
                hasRetriedEmptyTradingTimesRef.current = true;
                retryTimeoutRef.current = setTimeout(() => fetchChartDataRef.current(), 10000);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error fetching chart data:', error);
            setError(error instanceof Error ? error : new Error('Failed to fetch chart data'));
        } finally {
            setIsLoading(false);
        }
    }, [smartChartsAdapter, activeSymbols]);

    // Keep a ref to the latest fetchChartData so the delayed retry never runs a stale
    // closure (activeSymbols may change during the retry window).
    const fetchChartDataRef = React.useRef(fetchChartData);
    React.useEffect(() => {
        fetchChartDataRef.current = fetchChartData;
    }, [fetchChartData]);

    // Allow a fresh retry when the symbol universe changes (one retry per symbol set).
    // No-op on initial mount: the guard starts out false.
    React.useEffect(() => {
        hasRetriedEmptyTradingTimesRef.current = false;
    }, [activeSymbols]);

    // Retry function for error recovery
    const retryFetchChartData = React.useCallback(async () => {
        await fetchChartData();
    }, [fetchChartData]);

    // Immediately sync activeSymbols into chartData so SmartChart can render
    // and start ticks_history subscription before trading_times arrives.
    // Enriched data replaces this when fetchChartData finishes.
    React.useEffect(() => {
        if (activeSymbols?.length) {
            setChartData(prev => ({
                ...prev,
                activeSymbols: transformations.toActiveSymbols(toJS(activeSymbols)),
            }));
        }
    }, [activeSymbols]);

    // Fetch trading times (non-blocking) and enrich symbols when ready.
    // The early sync effect above already makes the chart renderable with activeSymbols,
    // so this fetch only adds enrichment — it doesn't block ticks_history.
    const hasFetchedRef = React.useRef(false);
    const previousLanguageRef = React.useRef(current_language);
    const languageChangeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        // Fetch once on mount. For trade chart, uses pre-fetched activeSymbols.
        // For replay chart (activeSymbols: []), getChartData falls back to fetching from API.
        if (!hasFetchedRef.current) {
            // Defer the reference-data fetch until the socket is open; only explicit `false` defers (isLoading stays true).
            if (is_connection_opened === false) {
                return;
            }
            hasFetchedRef.current = true;
            fetchChartData();
            return;
        }

        // Language changed: re-enrich existing data after 2 second delay
        if (previousLanguageRef.current !== current_language) {
            previousLanguageRef.current = current_language;

            // Clear any existing timeout
            if (languageChangeTimeoutRef.current) {
                clearTimeout(languageChangeTimeoutRef.current);
            }

            // Add 2 second delay before re-enriching
            languageChangeTimeoutRef.current = setTimeout(() => {
                // Re-enrich the raw active symbols with updated language
                const { rawActiveSymbols, rawTradingTimes } = rawDataRef.current;
                const enrichedSymbols = enrichActiveSymbols(rawActiveSymbols, rawTradingTimes);

                setChartData(prev => ({
                    ...prev,
                    activeSymbols: enrichedSymbols,
                }));
            }, 2000);
        }

        // Cleanup timeout on unmount
        return () => {
            if (languageChangeTimeoutRef.current) {
                clearTimeout(languageChangeTimeoutRef.current);
            }
        };
    }, [fetchChartData, current_language, is_connection_opened]);

    // Memoized getQuotes function
    const getQuotes = React.useCallback<TGetQuotes>(
        async params => {
            if (!smartChartsAdapter) {
                throw new Error('Adapter not initialized');
            }

            // Validate granularity with type guard
            let validatedGranularity = isValidGranularity(params.granularity) ? params.granularity : 0;

            let result = await smartChartsAdapter.getQuotes({
                symbol: params.symbol,
                granularity: validatedGranularity,
                count: params.count,
                start: params.start,
                end: params.end,
            });

            // If requesting ticks and minStartEpoch is set, check if data covers it
            // If not, re-fetch with candles instead
            if (minStartEpoch && validatedGranularity === 0 && result.quotes.length > 0) {
                const earliestTimestamp = parseInt(result.quotes[0].Date);

                if (earliestTimestamp > minStartEpoch) {
                    // Tick data doesn't cover minStartEpoch, switch to candles (2-minute granularity)
                    validatedGranularity = 60;
                    setShouldUseCandlesOverride(true);
                    result = await smartChartsAdapter.getQuotes({
                        symbol: params.symbol,
                        granularity: validatedGranularity,
                        count: params.count,
                        start: params.start,
                        end: params.end,
                    });
                }
            }

            // Transform adapter result to SmartCharts Champion format
            if (validatedGranularity === 0) {
                // For ticks, return history format
                return {
                    history: {
                        prices: result.quotes.map(q => q.Close),
                        times: result.quotes.map(q => parseInt(q.Date)),
                    },
                };
            }
            // For candles, return candles format
            return {
                candles: result.quotes.map(q => ({
                    open: q.Open || q.Close,
                    high: q.High || q.Close,
                    low: q.Low || q.Close,
                    close: q.Close,
                    epoch: parseInt(q.Date),
                })),
            };
        },
        [smartChartsAdapter, isValidGranularity, minStartEpoch]
    );

    // Use refs to avoid stale closure issues in subscription callbacks
    const granularityRef = React.useRef(granularity);
    const isAccumulatorRef = React.useRef(is_accumulator);
    const updateAccumulatorBarriersDataRef = React.useRef(updateAccumulatorBarriersData);
    const setTickDataRef = React.useRef(setTickData);

    // Update refs when values change
    React.useEffect(() => {
        granularityRef.current = granularity;
        isAccumulatorRef.current = is_accumulator;
        updateAccumulatorBarriersDataRef.current = updateAccumulatorBarriersData;
        setTickDataRef.current = setTickData;
    }, [granularity, is_accumulator, updateAccumulatorBarriersData, setTickData]);

    // Memoized subscribeQuotes function
    const subscribeQuotes = React.useCallback<TSubscribeQuotes>(
        (params, callback) => {
            if (!smartChartsAdapter) {
                return () => {};
            }

            const passthrough_callback = (...args: [any]) => {
                callback(...args);

                // Handle tick data for non-tick granularities
                if ('ohlc' in args[0] && granularityRef.current !== 0 && setTickDataRef.current) {
                    const { close, pip_size } = args[0].ohlc as { close: string; pip_size: number };
                    if (close && pip_size) setTickDataRef.current({ pip_size, quote: Number(close) });
                }

                // Handle accumulator barriers data
                if (isAccumulatorRef.current && updateAccumulatorBarriersDataRef.current) {
                    let current_spot_data: AccumulatorBarriersData = {};

                    if ('tick' in args[0]) {
                        const { epoch, quote, symbol } = args[0].tick as any;
                        current_spot_data = {
                            current_spot: quote,
                            current_spot_time: epoch,
                            underlying: symbol,
                        };
                    } else if ('history' in args[0]) {
                        const { prices, times } = args[0].history as any;
                        const symbol = args[0].echo_req?.ticks_history;
                        current_spot_data = {
                            current_spot: prices?.[prices?.length - 1],
                            current_spot_time: times?.[times?.length - 1],
                            previous_spot_time: times?.[times?.length - 2],
                            underlying: symbol,
                        };
                    } else {
                        return;
                    }

                    updateAccumulatorBarriersDataRef.current(current_spot_data);
                }
            };

            // Validate granularity with type guard
            const validatedGranularity = isValidGranularity(params.granularity) ? params.granularity : 0;

            return smartChartsAdapter.subscribeQuotes(
                {
                    symbol: params.symbol,
                    granularity: validatedGranularity,
                },
                quote => {
                    passthrough_callback(quote);
                }
            );
        },
        [smartChartsAdapter, isValidGranularity]
    );

    // Memoized unsubscribeQuotes function
    const unsubscribeQuotes = React.useCallback<TUnsubscribeQuotes>(
        request => {
            if (smartChartsAdapter) {
                // SmartCharts' createGetQuotesRequest omits `granularity` when it is 0, so a
                // teardown request with a symbol and no granularity means ticks.
                if (request?.symbol) {
                    const validatedGranularity = isValidGranularity(request.granularity) ? request.granularity : 0;
                    smartChartsAdapter.unsubscribeQuotes({
                        symbol: request.symbol,
                        granularity: validatedGranularity,
                    });
                } else {
                    smartChartsAdapter.unsubscribeAllQuotes();
                }
            }
        },
        [smartChartsAdapter, isValidGranularity]
    );

    // Cleanup effect to prevent memory leaks from subscriptions
    React.useEffect(() => {
        return () => {
            // Cleanup all subscriptions on unmount or when adapter changes
            if (smartChartsAdapter) {
                smartChartsAdapter.unsubscribeAllQuotes();
            }
            // Cancel any pending trading_times retry
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, [smartChartsAdapter]);

    return {
        smartChartsAdapter,
        chartData,
        isLoading,
        error,
        getQuotes,
        subscribeQuotes,
        unsubscribeQuotes,
        retryFetchChartData,
        isValidGranularity,
        shouldUseCandlesOverride,
    };
};

export default useSmartChartsAdapter;
