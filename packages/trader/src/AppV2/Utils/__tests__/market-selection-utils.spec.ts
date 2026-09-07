import { TActiveSymbolsResponse } from '@deriv/api';
import { getSymbolDisplayName } from '@deriv/shared';

import {
    filterSymbolsByCategory,
    filterSymbolsBySearch,
    getMarketCategories,
    getTradeTypeForContractType,
    groupSymbolsForList,
    SPECIAL_CATEGORIES,
} from '../market-selection-utils';
import { AVAILABLE_CONTRACTS } from '../trade-types-utils';

type ActiveSymbols = NonNullable<TActiveSymbolsResponse['active_symbols']>;

const makeSymbol = (underlying_symbol: string, market: string): ActiveSymbols[number] =>
    ({
        underlying_symbol,
        market,
        submarket: 'x',
        subgroup: 'x',
        exchange_is_open: 1,
        is_trading_suspended: 0,
        display_order: 0,
    }) as ActiveSymbols[number];

describe('market-selection-utils', () => {
    describe('getMarketCategories', () => {
        it('lists markets in curated order (Featured chip temporarily omitted, no Favourites chip)', () => {
            const symbols = [
                makeSymbol('frxEURUSD', 'forex'),
                makeSymbol('R_100', 'synthetic_index'),
                makeSymbol('OTC_SPC', 'indices'),
            ];
            const result = getMarketCategories(symbols);
            expect(result.map(c => c.id)).toEqual(['synthetic_index', 'forex', 'indices']);
        });

        it('supplies the raw market id as the fallback label', () => {
            const result = getMarketCategories([
                makeSymbol('R_100', 'synthetic_index'),
                makeSymbol('OTC_SPC', 'indices'),
            ]);
            const labels = Object.fromEntries(result.map(c => [c.id, c.label]));
            expect(labels.synthetic_index).toBe('synthetic_index');
            expect(labels.indices).toBe('indices');
        });
    });

    describe('filterSymbolsByCategory', () => {
        const symbols = [makeSymbol('frxEURUSD', 'forex'), makeSymbol('R_100', 'synthetic_index')];

        it('returns everything for Featured', () => {
            expect(filterSymbolsByCategory(symbols, SPECIAL_CATEGORIES.FEATURED)).toHaveLength(2);
        });

        it('filters by market for a market id', () => {
            const result = filterSymbolsByCategory(symbols, 'forex');
            expect(result.map(s => s.underlying_symbol)).toEqual(['frxEURUSD']);
        });
    });

    describe('filterSymbolsBySearch', () => {
        const symbol = makeSymbol('frxEURUSD', 'forex');
        const display_name = getSymbolDisplayName('frxEURUSD');

        it('returns all symbols for an empty query', () => {
            expect(filterSymbolsBySearch([symbol], '  ')).toHaveLength(1);
        });

        it('matches on display name, case-insensitively', () => {
            expect(filterSymbolsBySearch([symbol], display_name.slice(0, 2).toUpperCase())).toHaveLength(1);
        });

        it('returns nothing when there is no match', () => {
            expect(filterSymbolsBySearch([symbol], 'zzzzz')).toHaveLength(0);
        });
    });

    describe('getTradeTypeForContractType', () => {
        it('resolves the tab that owns a contract_type', () => {
            const first = AVAILABLE_CONTRACTS[0];
            expect(getTradeTypeForContractType(first.for[0])).toBe(first);
        });

        it('returns undefined for an unknown contract_type', () => {
            expect(getTradeTypeForContractType('nonexistent_contract_type')).toBeUndefined();
        });
    });

    describe('groupSymbolsForList', () => {
        const derived = (underlying_symbol: string, subgroup: string, submarket: string): ActiveSymbols[number] =>
            ({
                underlying_symbol,
                market: 'synthetic_index',
                subgroup,
                submarket,
                exchange_is_open: 1,
                is_trading_suspended: 0,
                display_order: 0,
            }) as ActiveSymbols[number];

        // Sections/groups carry only the raw taxonomy keys — display labels are localized reactively at
        // render (see market-selection-labels.spec), so these assert keys, not display strings.
        it('returns a single unlabelled section of submarket groups for non-Derived markets', () => {
            const sections = groupSymbolsForList([makeSymbol('frxEURUSD', 'forex'), makeSymbol('frxGBPUSD', 'forex')]);
            expect(sections).toHaveLength(1);
            expect(sections[0].subgroup).toBe('');
            expect(sections[0].market).toBe('');
            expect(sections[0].groups).toHaveLength(1);
            expect(sections[0].groups[0].items).toHaveLength(2);
        });

        it('[DMO-001] splits Derived into Synthetics then Baskets subgroup sections, each grouped by submarket', () => {
            const sections = groupSymbolsForList([
                derived('R_100', 'synthetics', 'random_index'),
                derived('WLDUSD', 'baskets', 'forex_basket'),
                derived('R_50', 'synthetics', 'random_index'),
                derived('BOOM500', 'synthetics', 'crash_boom'),
            ]);
            expect(sections.map(section => section.subgroup)).toEqual(['synthetics', 'baskets']);
            const [synthetics, baskets] = sections;
            expect(baskets.groups.map(group => group.submarket)).toEqual(['forex_basket']);
            // Two synthetic submarkets, preserving encounter order.
            expect(synthetics.groups.map(group => group.submarket)).toEqual(['random_index', 'crash_boom']);
            expect(synthetics.groups[0].items.map(item => item.underlying_symbol)).toEqual(['R_100', 'R_50']);
        });

        it('[DMO-001] orders the subgroup sections independently of the incoming symbol order', () => {
            const synthetics_first = groupSymbolsForList([
                derived('R_100', 'synthetics', 'random_index'),
                derived('WLDUSD', 'baskets', 'forex_basket'),
            ]);
            const baskets_first = groupSymbolsForList([
                derived('WLDUSD', 'baskets', 'forex_basket'),
                derived('R_100', 'synthetics', 'random_index'),
            ]);

            expect(synthetics_first.map(section => section.subgroup)).toEqual(['synthetics', 'baskets']);
            expect(baskets_first.map(section => section.subgroup)).toEqual(['synthetics', 'baskets']);
        });

        it('[DMO-004] keeps an uncurated Derived submarket at the end of its own subgroup section', () => {
            const [synthetics] = groupSymbolsForList([
                derived('R_100', 'synthetics', 'random_index'),
                derived('RDBULL', 'synthetics', 'random_daily'),
                derived('RB100', 'synthetics', 'range_index'),
                derived('WLDXAU', 'baskets', 'commodity_basket'),
            ]);

            expect(synthetics.groups.map(group => group.submarket)).toEqual([
                'random_index',
                'random_daily',
                'range_index',
            ]);
        });
    });
});
