/**
 * Capability matrices for Manual Trading negative validation.
 * Kept out of the spec so market/trade-type coverage stays data, not boilerplate.
 */

export type MarketCategory = 'Derived' | 'Forex' | 'Stocks & indices' | 'Commodities' | 'Cryptocurrencies';

export type StakeTradeType =
    | 'Accumulators'
    | 'Higher/Lower'
    | 'Touch/No Touch'
    | 'Matches/Differs'
    | 'Over/Under'
    | 'Even/Odd'
    | 'Multipliers'
    | 'Turbos'
    | 'Vanillas';

export type DurationTradeType = 'Higher/Lower' | 'Touch/No Touch' | 'Over/Under' | 'Turbos' | 'Vanillas';

/** One representative market per category for Rise/Fall-capable families. */
export const STAKE_MARKET_CATEGORIES: ReadonlyArray<{
    category: Exclude<MarketCategory, 'Cryptocurrencies'>;
    pattern: RegExp;
}> = [
    { category: 'Derived', pattern: /^Volatility 100 Index$/ },
    { category: 'Forex', pattern: /^EUR\/USD$/ },
    // Prefer US names first — EU indices are often CLOSED outside local hours.
    { category: 'Stocks & indices', pattern: /Wall Street|US Tech|US 500|Apple|Amazon|Germany|German|France|UK 100/i },
    { category: 'Commodities', pattern: /Gold/i },
];

export const DURATION_MARKET_CATEGORIES = STAKE_MARKET_CATEGORIES;

export const STAKE_TRADE_TYPE_CAPABILITIES: ReadonlyArray<{
    market: string;
    tradeType: StakeTradeType;
    verifyParams?: boolean;
}> = [
    { market: 'Volatility 100 Index', tradeType: 'Accumulators', verifyParams: false },
    { market: 'Volatility 100 (1s) Index', tradeType: 'Higher/Lower' },
    { market: 'Volatility 10 (1s) Index', tradeType: 'Touch/No Touch' },
    { market: 'Volatility 10 Index', tradeType: 'Matches/Differs' },
    { market: 'Volatility 10 Index', tradeType: 'Over/Under' },
    { market: 'Volatility 10 Index', tradeType: 'Even/Odd' },
    { market: 'Volatility 25 (1s) Index', tradeType: 'Multipliers' },
    { market: 'Volatility 100 (1s) Index', tradeType: 'Turbos' },
    { market: 'Volatility 100 Index', tradeType: 'Vanillas' },
];

export const DURATION_TRADE_TYPE_CAPABILITIES: ReadonlyArray<{
    market: string;
    tradeType: DurationTradeType;
}> = [
    { market: 'Volatility 100 (1s) Index', tradeType: 'Higher/Lower' },
    { market: 'Volatility 10 (1s) Index', tradeType: 'Touch/No Touch' },
    { market: 'Volatility 10 Index', tradeType: 'Over/Under' },
    { market: 'Volatility 100 (1s) Index', tradeType: 'Turbos' },
    { market: 'Volatility 100 Index', tradeType: 'Vanillas' },
];
