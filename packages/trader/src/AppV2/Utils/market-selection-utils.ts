import { TActiveSymbolsResponse } from '@deriv/api';
import { getSymbolDisplayName } from '@deriv/shared';

import { DERIVED_SUBGROUP_ORDER } from 'AppV2/Utils/market-ordering-utils';
import { AVAILABLE_CONTRACTS, TAvailableContract } from 'AppV2/Utils/trade-types-utils';
import { type TFavouriteMarket } from 'Stores/Modules/Markets/markets-store';

type ActiveSymbols = NonNullable<TActiveSymbolsResponse['active_symbols']>;

/** A favourited {symbol, trade-type-tab} combo. Sourced from the markets store to avoid divergence. */
export type { TFavouriteMarket };

/** Non-market category chips that are always present in the redesigned selector. */
export const SPECIAL_CATEGORIES = {
    FEATURED: 'featured',
} as const;

export type TMarketCategory = { id: string; label: string };

// Curated market display order for the category chips (mirrors sort-symbols-utils market order).
const MARKET_CATEGORY_ORDER = ['synthetic_index', 'forex', 'indices', 'stock_index', 'cryptocurrency', 'commodities'];

/**
 * Builds the ordered category-chip list for a set of symbols: always Featured, then one chip per
 * market present in the set, in curated order. Favourites is a top-level tab, not a chip.
 */
export const getMarketCategories = (symbols: ActiveSymbols): TMarketCategory[] => {
    const markets_present = Array.from(new Set(symbols.map(symbol => symbol.market).filter(Boolean)));

    const ordered_markets = markets_present.sort((a, b) => {
        const index_a = MARKET_CATEGORY_ORDER.indexOf(a);
        const index_b = MARKET_CATEGORY_ORDER.indexOf(b);
        return (index_a === -1 ? Infinity : index_a) - (index_b === -1 ? Infinity : index_b);
    });

    return [...ordered_markets.map(market => ({ id: market, label: market }))];
};

/**
 * Filters symbols for the selected category chip. Featured shows everything (discovery sections
 * handle the curation within it); any other id is treated as a market key.
 */
export const filterSymbolsByCategory = (symbols: ActiveSymbols, category_id: string): ActiveSymbols => {
    if (category_id === SPECIAL_CATEGORIES.FEATURED) return symbols;
    return symbols.filter(symbol => symbol.market === category_id);
};

/** Case-insensitive filter of symbols by their display name (scoped to the current set). */
export const filterSymbolsBySearch = (symbols: ActiveSymbols, query: string): ActiveSymbols => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return symbols;
    return symbols.filter(symbol =>
        getSymbolDisplayName(symbol.underlying_symbol ?? '')
            .toLowerCase()
            .includes(trimmed)
    );
};

/** Resolves the trade-type tab that owns a given store `contract_type` (e.g. `rise_fall` → Rise/Fall). */
export const getTradeTypeForContractType = (contract_type: string): TAvailableContract | undefined =>
    AVAILABLE_CONTRACTS.find(contract => contract.for.includes(contract_type));

// A submarket section of the list view. The `submarket` key drives the reactive title at render time
// (via getSubmarketLabel in market-selection-labels) — no display string is baked in here.
export type TSubmarketGroup = { submarket: string; items: ActiveSymbols };

/**
 * Groups a symbol list into submarket sections (e.g. "Continuous indices"), preserving the incoming
 * order, for the titled list view.
 */
export const groupSymbolsBySubmarket = (symbols: ActiveSymbols): TSubmarketGroup[] => {
    const groups: TSubmarketGroup[] = [];
    const index_by_submarket = new Map<string, number>();

    symbols.forEach(symbol => {
        const submarket = symbol.submarket ?? '';
        const existing_index = index_by_submarket.get(submarket);
        if (existing_index === undefined) {
            index_by_submarket.set(submarket, groups.length);
            groups.push({ submarket, items: [symbol] });
        } else {
            groups[existing_index].items.push(symbol);
        }
    });

    return groups;
};

// A titled section of the category list. The `subgroup` + `market` keys drive the reactive section
// heading at render (via getSubgroupLabel); both are empty for a market shown as a flat submarket list.
export type TListSection = { subgroup: string; market: string; groups: TSubmarketGroup[] };

// Derived (Synthetics + Baskets) is the only market split into subgroup sections; everything else is
// a flat submarket list. The section order comes from `DERIVED_SUBGROUP_ORDER` in
// market-ordering-utils — the same table that ranks the submarkets, so the two cannot disagree; any
// other subgroup follows in order.
const DERIVED_MARKET = 'synthetic_index';

/**
 * Groups a single-market symbol list for the category list view. For Derived, symbols split into
 * "Synthetics" and "Baskets" subgroup sections (each a set of submarket groups) — matching the
 * two-level layout of the search/favourites lists. Every other market is one unlabelled section
 * holding its submarket groups (the flat list). Preserves the incoming symbol order within each group.
 */
export const groupSymbolsForList = (symbols: ActiveSymbols): TListSection[] => {
    if (symbols[0]?.market !== DERIVED_MARKET) {
        return [{ subgroup: '', market: '', groups: groupSymbolsBySubmarket(symbols) }];
    }

    const symbols_by_subgroup = new Map<string, ActiveSymbols>();
    symbols.forEach(symbol => {
        const subgroup = symbol.subgroup ?? '';
        const bucket = symbols_by_subgroup.get(subgroup);
        if (bucket) bucket.push(symbol);
        else symbols_by_subgroup.set(subgroup, [symbol]);
    });

    const rank = (subgroup: string) => {
        const index = DERIVED_SUBGROUP_ORDER.indexOf(subgroup);
        return index === -1 ? DERIVED_SUBGROUP_ORDER.length : index;
    };

    return Array.from(symbols_by_subgroup.keys())
        .sort((a, b) => rank(a) - rank(b))
        .map(subgroup => ({
            subgroup,
            market: DERIVED_MARKET,
            groups: groupSymbolsBySubmarket(symbols_by_subgroup.get(subgroup) ?? []),
        }));
};

/** Maps a trade-type tab id (e.g. "Rise/Fall") to the store `contract_type` to commit for it. */
export const getContractTypeForTradeType = (trade_type: string): string =>
    AVAILABLE_CONTRACTS.find(contract => contract.id === trade_type)?.for[0] ?? '';

// The `subgroup`/`submarket`/`market` keys drive the reactive "Subgroup (Submarket)" title at render
// (via FavouriteSubgroupTitle in market-selection-labels); `key` is the stable grouping/React key.
export type TFavouriteSubgroup = {
    key: string;
    subgroup: string;
    submarket: string;
    market: string;
    items: ActiveSymbols;
};
export type TFavouriteGroup = { trade_type: string; subgroups: TFavouriteSubgroup[] };

// Groups symbols by "subgroup + submarket"; the display title is rendered reactively from these keys.
const groupBySubgroupSubmarket = (symbols: ActiveSymbols): TFavouriteSubgroup[] => {
    const groups: TFavouriteSubgroup[] = [];
    const index_by_key = new Map<string, number>();

    symbols.forEach(symbol => {
        const subgroup = symbol.subgroup ?? '';
        const submarket = symbol.submarket ?? '';
        const key = `${subgroup}|${submarket}`;
        const existing_index = index_by_key.get(key);
        if (existing_index === undefined) {
            index_by_key.set(key, groups.length);
            groups.push({ key, subgroup, submarket, market: symbol.market ?? '', items: [symbol] });
        } else {
            groups[existing_index].items.push(symbol);
        }
    });

    return groups;
};

/**
 * Groups favourite {symbol, trade_type} combos into trade-type sections (ordered by the trade-type
 * list), each split into "Subgroup (Submarket)" groups — for the Favourites tab. Favourites whose
 * symbol isn't in `active_symbols` (region-locked etc.) are dropped.
 */
export const groupFavourites = (favourites: TFavouriteMarket[], active_symbols: ActiveSymbols): TFavouriteGroup[] => {
    const symbol_by_key = new Map(active_symbols.map(symbol => [symbol.underlying_symbol ?? '', symbol]));
    const symbols_by_trade_type = new Map<string, ActiveSymbols>();

    favourites.forEach(({ symbol, trade_type }) => {
        const item = symbol_by_key.get(symbol);
        if (!item) return;
        const list = symbols_by_trade_type.get(trade_type) ?? [];
        list.push(item);
        symbols_by_trade_type.set(trade_type, list);
    });

    const order = new Map(AVAILABLE_CONTRACTS.map((contract, index) => [contract.id, index]));

    return Array.from(symbols_by_trade_type.keys())
        .sort((a, b) => (order.get(a) ?? Number.POSITIVE_INFINITY) - (order.get(b) ?? Number.POSITIVE_INFINITY))
        .map(trade_type => ({
            trade_type,
            subgroups: groupBySubgroupSubmarket(symbols_by_trade_type.get(trade_type) ?? []),
        }));
};
