import { TActiveSymbolsResponse, TTicksHistoryRequest, TTicksHistoryResponse } from '@deriv/api';

type TCandles = NonNullable<TTicksHistoryResponse['candles']>;
type THistory = NonNullable<TTicksHistoryResponse['history']>;
type TActiveSymbols = NonNullable<TActiveSymbolsResponse['active_symbols']>;
/** The discrete candle widths the API accepts (60s … 86400s). */
type TCandleGranularity = NonNullable<TTicksHistoryRequest['granularity']>;

/** Performance windows offered by the discovery filter. */
export type TDiscoveryWindow = '1m' | '5m' | '15m' | '1h';

export type TSymbolChange = {
    underlying_symbol: string;
    /** Percentage change over the window, or `null` when it can't be computed yet. */
    change_percentage: number | null;
};

export type TDiscoverySections = {
    gainers: TSymbolChange[];
    losers: TSymbolChange[];
};

/**
 * `ticks_history` request shape per window. The shorter windows (1m, 5m, 15m) use an exact
 * `range_seconds` tick range (start/end epochs, anchored to a bucketed "now" in the hook) for a
 * smooth worm. The 1-hour window uses 1-minute candles (`granularity * count` seconds spans it).
 */
export type TDiscoveryWindowConfig =
    | { style: 'candles'; granularity: TCandleGranularity; count: number }
    | { style: 'ticks'; range_seconds: number };

export const DISCOVERY_WINDOW_CONFIG: Record<TDiscoveryWindow, TDiscoveryWindowConfig> = {
    '1m': { style: 'ticks', range_seconds: 60 },
    '5m': { style: 'ticks', range_seconds: 300 },
    '15m': { style: 'ticks', range_seconds: 900 },
    '1h': { style: 'candles', granularity: 60, count: 60 }, // 60 x 1m
};

export const DEFAULT_DISCOVERY_WINDOW: TDiscoveryWindow = '5m';

/** Selectable windows, in display order, for the list's "Changes" dropdown. */
export const DISCOVERY_WINDOWS: TDiscoveryWindow[] = ['1m', '5m', '15m', '1h'];

/** Number of items shown per discovery section (Trending / Gainers / Losers). */
const DISCOVERY_SECTION_LIMIT = 5;

/** Formats a windowed change for display, e.g. `1.25` → `+1.25%`, `-2.4` → `-2.40%`, `null` → `–`. */
export const formatChangePercentage = (value: number | null): string => {
    if (value === null) return '–';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
};

/**
 * Percentage change across a candle series: (last close − first open) / first open × 100.
 * Returns `null` when the series is empty or the baseline is missing/zero.
 */
export const getCandleChangePercentage = (candles?: TCandles): number | null => {
    if (!candles?.length) return null;

    const first = candles[0];
    const last = candles[candles.length - 1];
    const baseline = first?.open;
    const latest = last?.close;

    if (typeof baseline !== 'number' || typeof latest !== 'number' || baseline === 0) return null;

    return ((latest - baseline) / baseline) * 100;
};

/**
 * Percentage change across a tick series: (last price − first price) / first price × 100.
 * Returns `null` when there are no ticks or the baseline is missing/zero.
 */
export const getTicksChangePercentage = (history?: THistory): number | null => {
    const prices = history?.prices;
    if (!prices?.length) return null;

    const baseline = prices[0];
    const latest = prices[prices.length - 1];

    if (typeof baseline !== 'number' || typeof latest !== 'number' || baseline === 0) return null;

    return ((latest - baseline) / baseline) * 100;
};

/**
 * Flattens a candle series into the price points for a sparkline (worm) chart: the first candle's
 * open followed by each candle's close, so the line starts at the window baseline. Returns an empty
 * array when there aren't enough usable points. Resolution is bounded by the window's candle count.
 */
export const getCandleSeries = (candles?: TCandles): number[] => {
    if (!candles?.length) return [];

    const series: number[] = [];
    const first_open = candles[0]?.open;
    if (typeof first_open === 'number') series.push(first_open);
    candles.forEach(candle => {
        if (typeof candle.close === 'number') series.push(candle.close);
    });

    return series;
};

/**
 * Ranks per-symbol changes into Gainers / Losers.
 * - Gainers: largest positive moves, descending.
 * - Losers: largest negative moves, ascending (most negative first).
 * Entries whose change couldn't be computed are excluded from ranking.
 * (Trending is ranked separately by trade volume — see `getTrendingSymbols`.)
 */
export const rankDiscoverySections = (
    changes: TSymbolChange[],
    limit: number = DISCOVERY_SECTION_LIMIT
): TDiscoverySections => {
    const valid = changes.filter(
        (entry): entry is TSymbolChange & { change_percentage: number } => entry.change_percentage !== null
    );

    const gainers = valid
        .filter(entry => entry.change_percentage > 0)
        .sort((a, b) => b.change_percentage - a.change_percentage)
        .slice(0, limit);

    const losers = valid
        .filter(entry => entry.change_percentage < 0)
        .sort((a, b) => a.change_percentage - b.change_percentage)
        .slice(0, limit);

    return { gainers, losers };
};

/**
 * Top symbols for the "Trending" section, ranked by trade volume via the active_symbols `trade_count`
 * field (not yet in the generated api-types, so read defensively). Symbols with no positive count are
 * excluded. Returns `underlying_symbol` codes in descending trade-count order, capped at `limit`.
 */
export const getTrendingSymbols = (symbols: TActiveSymbols, limit: number = DISCOVERY_SECTION_LIMIT): string[] =>
    symbols
        .map(symbol => ({
            underlying_symbol: symbol.underlying_symbol ?? '',
            trade_count: (symbol as { trade_count?: number }).trade_count ?? 0,
        }))
        .filter(entry => entry.underlying_symbol && entry.trade_count > 0)
        .sort((a, b) => b.trade_count - a.trade_count)
        .slice(0, limit)
        .map(entry => entry.underlying_symbol);
