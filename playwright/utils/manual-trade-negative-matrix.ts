/**
 * Capability matrices for Manual Trading negative validation.
 * Kept out of the spec so market/trade-type coverage stays data, not boilerplate.
 */

export type MarketCategory = 'Derived' | 'Forex' | 'Stocks & indices' | 'Commodities' | 'Cryptocurrencies';

/** Matches/Differs → 5.3; Over/Under → 6.3; Even/Odd → 7.3; Accumulators → 8.3.
 *  Rise/Fall Vol 100 duration+stake → Flow 2.5; Higher/Lower barrier+duration+stake → Flow 3.3;
 *  Touch/No Touch barrier+duration+stake → Flow 4.3; Multipliers multiplier+stake+RM → Flow 9.9;
 *  Turbos duration+PPP+stake+TP → Flow 10.5; Vanillas duration+strike+stake → Flow 11.3;
 *  cross-market RF sweeps stay in Flow 14.
 *  Dedicated stake/duration trade-type rows emptied — all splits live in their own specs. */

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
    tradeType: string;
    verifyParams?: boolean;
}> = [
    // Higher/Lower barrier+duration+stake → Flow 3.3 (`verify-higher-lower-validations.spec.ts`)
    // Touch/No Touch duration+stake → Flow 4.3 (`verify-touch-no-touch-validations.spec.ts`)
    // Matches/Differs stake+duration → Flow 5.3 (`verify-matches-differs-validations.spec.ts`)
    // Over/Under stake+duration → Flow 6.3 (`verify-over-under-validations.spec.ts`)
    // Even/Odd stake+duration → Flow 7.3 (`verify-even-odd-validations.spec.ts`)
    // Accumulators Growth rate + stake + TP → Flow 8.3 (`verify-accumulators-validations.spec.ts`)
    // Multipliers multiplier + stake + RM → Flow 9.9 (`verify-multipliers-validations.spec.ts`)
    // Turbos duration + PPP + stake + TP → Flow 10.5 (`verify-turbos-validations.spec.ts`)
    // Vanillas duration + strike + stake → Flow 11.3 (`verify-vanillas-validations.spec.ts`)
];

export const DURATION_TRADE_TYPE_CAPABILITIES: ReadonlyArray<{
    market: string;
    tradeType: string;
}> = [
    // Vanillas duration + strike + stake → Flow 11.3 (`verify-vanillas-validations.spec.ts`)
];
