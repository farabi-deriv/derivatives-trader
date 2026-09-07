import { TActiveSymbolsResponse } from '@deriv/api';
import { localize } from '@deriv-com/translations';

import { CURATED_RANK_ABSENT, getDerivedSubmarketRank } from 'AppV2/Utils/market-ordering-utils';

type ActiveSymbols = NonNullable<TActiveSymbolsResponse['active_symbols']>;

type MarketOrderMap = {
    [key: string]: number;
};

// Static curated market order. Language-independent, so it is safe to build once at module scope
// and freeze — unknown markets fall back to a rank past this list (see `market_order` below).
const marketSortingOrder = ['synthetic_index', 'forex', 'indices', 'cryptocurrency', 'commodities'];
const marketOrderMap: MarketOrderMap = marketSortingOrder.reduce(
    (acc: MarketOrderMap, market: string, index: number) => {
        acc[market] = index;
        return acc;
    },
    {}
);

const sortSymbols = (symbolsList: ActiveSymbols) => {
    // A 0- or 1-element list is already sorted; skip the map build and decoration entirely.
    if (symbolsList.length < 2) return symbolsList.slice();

    // Build the localized submarket display-name map ONCE per call. It MUST NOT be hoisted to module
    // scope: `localize()` resolves against the runtime-active language, and the user can switch
    // language at runtime — a module-scope map would freeze the labels to whatever locale was active
    // when this module first loaded.
    const submarket_display_names: Record<string, string> = {
        major_pairs: localize('Major pairs'),
        minor_pairs: localize('Minor pairs'),
        smart_fx: localize('Smart FX'),
        random_index: localize('Volatility indices'),
        random_daily: localize('Daily reset indices'),
        crash_boom: localize('Crash/Boom'),
        crash_index: localize('Crash/Boom'),
        step_indices: localize('Step indices'),
        step_index: localize('Step indices'),
        range_index: localize('Range break indices'),
        jump_indices: localize('Jump indices'),
        jump_index: localize('Jump indices'),
        cryptocurrency: localize('Cryptocurrencies'),
        non_stable_coin: localize('Cryptocurrencies'),
        metals: localize('Metals'),
        energy: localize('Energy'),
        americas: localize('Americas'),
        americas_OTC: localize('American indices'),
        asia_oceania: localize('Asia/Oceania'),
        asia_oceania_OTC: localize('Asian indices'),
        europe_africa: localize('Europe/Africa'),
        europe_OTC: localize('European indices'),
        otc_index: localize('OTC indices'),
        basket_forex: localize('Forex basket'),
        forex_basket: localize('Forex basket'),
        basket_commodities: localize('Commodities basket'),
        commodity_basket: localize('Commodities basket'),
        basket_cryptocurrency: localize('Cryptocurrency basket'),
    };

    // Decorate each symbol with its precomputed sort keys so the comparator does no work per
    // comparison. Ordering runs market rank → curated submarket rank → localized-name comparison:
    // `market_order` preserves the exact "unknown market sorts after curated markets" fallback
    // (rank = list length); `submarket_rank` orders the curated Derived submarkets by key, so it is
    // language-independent, and every uncurated submarket shares `CURATED_RANK_ABSENT` and falls
    // through to `submarket_name`, which falls back to the raw submarket key.
    return symbolsList
        .map(symbol => ({
            symbol,
            market_order: marketOrderMap[symbol.market] ?? symbolsList.length,
            submarket_rank: getDerivedSubmarketRank(symbol.submarket) ?? CURATED_RANK_ABSENT,
            submarket_name: submarket_display_names[symbol.submarket] || symbol.submarket,
        }))
        .sort((a, b) => {
            if (a.market_order !== b.market_order) {
                return a.market_order - b.market_order;
            }
            if (a.submarket_rank !== b.submarket_rank) {
                return a.submarket_rank - b.submarket_rank;
            }
            return a.submarket_name.localeCompare(b.submarket_name);
        })
        .map(({ symbol }) => symbol);
};

export default sortSymbols;
