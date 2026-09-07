import { TActiveSymbolsResponse } from '@deriv/api';
import { localize } from '@deriv-com/translations';

import sortSymbols from '../sort-symbols-utils';

jest.mock('@deriv-com/translations', () => ({
    localize: jest.fn((text: string) => text),
}));

describe('sortSymbols', () => {
    it('should sort symbols correctly according to market order', () => {
        const symbolsList = [
            {
                underlying_symbol: 'BTCUSD',
                display_order: 1,
                exchange_is_open: 1,
                market: 'cryptocurrency',
                submarket: 'non_stable_coin',
                is_trading_suspended: 0,
                subgroup: 'crypto',
            },
            {
                underlying_symbol: 'EURUSD',
                display_order: 2,
                exchange_is_open: 1,
                market: 'forex',
                submarket: 'major_pairs',
                is_trading_suspended: 0,
                subgroup: 'major',
            },
            {
                underlying_symbol: 'OTC_N225',
                display_order: 3,
                exchange_is_open: 1,
                market: 'indices',
                submarket: 'asia_oceania_OTC',
                is_trading_suspended: 0,
                subgroup: 'asia',
            },
            {
                underlying_symbol: 'GOLD',
                display_order: 4,
                exchange_is_open: 1,
                market: 'commodities',
                submarket: 'metals',
                is_trading_suspended: 0,
                subgroup: 'metals',
            },
            {
                underlying_symbol: '1HZ100V',
                display_order: 5,
                exchange_is_open: 1,
                market: 'synthetic_index',
                submarket: 'random_index',
                is_trading_suspended: 0,
                subgroup: 'volatility',
            },
        ];
        const sortedSymbols = sortSymbols(symbolsList as NonNullable<TActiveSymbolsResponse['active_symbols']>);
        expect(sortedSymbols).toEqual([
            {
                underlying_symbol: '1HZ100V',
                display_order: 5,
                exchange_is_open: 1,
                market: 'synthetic_index',
                submarket: 'random_index',
                is_trading_suspended: 0,
                subgroup: 'volatility',
            },
            {
                underlying_symbol: 'EURUSD',
                display_order: 2,
                exchange_is_open: 1,
                market: 'forex',
                submarket: 'major_pairs',
                is_trading_suspended: 0,
                subgroup: 'major',
            },
            {
                underlying_symbol: 'OTC_N225',
                display_order: 3,
                exchange_is_open: 1,
                market: 'indices',
                submarket: 'asia_oceania_OTC',
                is_trading_suspended: 0,
                subgroup: 'asia',
            },
            {
                underlying_symbol: 'BTCUSD',
                display_order: 1,
                exchange_is_open: 1,
                market: 'cryptocurrency',
                submarket: 'non_stable_coin',
                is_trading_suspended: 0,
                subgroup: 'crypto',
            },
            {
                underlying_symbol: 'GOLD',
                display_order: 4,
                exchange_is_open: 1,
                market: 'commodities',
                submarket: 'metals',
                is_trading_suspended: 0,
                subgroup: 'metals',
            },
        ]);
    });
    it('should handle symbols with same market correctly', () => {
        const symbolsList = [
            {
                underlying_symbol: 'GBPUSD',
                display_order: 1,
                exchange_is_open: 1,
                market: 'forex',
                submarket: 'major_pairs',
                is_trading_suspended: 0,
                subgroup: 'major',
            },
            {
                underlying_symbol: 'EURUSD',
                display_order: 2,
                exchange_is_open: 1,
                market: 'forex',
                submarket: 'major_pairs',
                is_trading_suspended: 0,
                subgroup: 'major',
            },
            {
                underlying_symbol: 'ETHUSD',
                display_order: 3,
                exchange_is_open: 1,
                market: 'cryptocurrency',
                submarket: 'non_stable_coin',
                is_trading_suspended: 0,
                subgroup: 'crypto',
            },
            {
                underlying_symbol: 'BTCUSD',
                display_order: 4,
                exchange_is_open: 1,
                market: 'cryptocurrency',
                submarket: 'non_stable_coin',
                is_trading_suspended: 0,
                subgroup: 'crypto',
            },
        ];

        const sortedSymbols = sortSymbols(symbolsList as NonNullable<TActiveSymbolsResponse['active_symbols']>);
        expect(sortedSymbols).toEqual([
            {
                underlying_symbol: 'GBPUSD',
                display_order: 1,
                exchange_is_open: 1,
                market: 'forex',
                submarket: 'major_pairs',
                is_trading_suspended: 0,
                subgroup: 'major',
            },
            {
                underlying_symbol: 'EURUSD',
                display_order: 2,
                exchange_is_open: 1,
                market: 'forex',
                submarket: 'major_pairs',
                is_trading_suspended: 0,
                subgroup: 'major',
            },
            {
                underlying_symbol: 'ETHUSD',
                display_order: 3,
                exchange_is_open: 1,
                market: 'cryptocurrency',
                submarket: 'non_stable_coin',
                is_trading_suspended: 0,
                subgroup: 'crypto',
            },
            {
                underlying_symbol: 'BTCUSD',
                display_order: 4,
                exchange_is_open: 1,
                market: 'cryptocurrency',
                submarket: 'non_stable_coin',
                is_trading_suspended: 0,
                subgroup: 'crypto',
            },
        ]);
    });

    it('resolves the localized submarket map once per call, not once per comparison', () => {
        // Regression guard for the INP regression: the old implementation resolved the 28-entry
        // localized map inside the comparator (twice per comparison), so an O(n log n) sort dragged
        // ~84,000 `localize()` calls along for a ~200-symbol list. The rewrite builds it once per
        // call, so `localize` must be invoked at most once per map entry (28) regardless of size.
        (localize as jest.Mock).mockClear();

        const markets = ['synthetic_index', 'forex', 'indices', 'cryptocurrency', 'commodities'];
        const submarkets = ['random_index', 'major_pairs', 'asia_oceania_OTC', 'non_stable_coin', 'metals'];
        const largeSymbolsList = Array.from({ length: 200 }, (_, i) => ({
            underlying_symbol: `SYM_${i}`,
            display_order: i,
            exchange_is_open: 1,
            market: markets[i % markets.length],
            submarket: submarkets[i % submarkets.length],
            is_trading_suspended: 0,
            subgroup: 'group',
        }));

        sortSymbols(largeSymbolsList as NonNullable<TActiveSymbolsResponse['active_symbols']>);

        expect((localize as jest.Mock).mock.calls.length).toBeLessThanOrEqual(28);
    });

    describe('Derived submarket ordering', () => {
        type ActiveSymbols = NonNullable<TActiveSymbolsResponse['active_symbols']>;

        const derived = (underlying_symbol: string, submarket: string, subgroup = 'synthetics') =>
            ({
                underlying_symbol,
                submarket,
                subgroup,
                market: 'synthetic_index',
                display_order: 0,
                exchange_is_open: 1,
                is_trading_suspended: 0,
            }) as ActiveSymbols[number];

        const submarketsOf = (symbols: ActiveSymbols) => symbols.map(symbol => symbol.submarket);

        // Verified against a live `active_symbols` response (wss://api-core.deriv.com/options/v1/ws/public):
        // the API sends the alias spellings — `step_index`, `jump_index`, `crash_index`, `forex_basket`,
        // `commodity_basket` — and `range_index` carries `subgroup: 'synthetics'`.
        const CURATED_ORDER_PRIMARY = [
            'random_index',
            'step_indices',
            'jump_indices',
            'crash_boom',
            'random_daily',
            'basket_forex',
            'basket_commodities',
        ];
        const CURATED_ORDER_ALIAS = [
            'random_index',
            'step_index',
            'jump_index',
            'crash_index',
            'random_daily',
            'forex_basket',
            'commodity_basket',
        ];

        const basketsOf = (keys: string[]) => keys.slice(5);

        const buildShuffled = (keys: string[]) =>
            [keys[6], keys[3], keys[0], keys[5], keys[4], keys[1], keys[2]].map((submarket, index) =>
                derived(`SYM_${index}`, submarket, basketsOf(keys).includes(submarket) ? 'baskets' : 'synthetics')
            );

        afterEach(() => {
            (localize as jest.Mock).mockImplementation((text: string) => text);
        });

        it('[DMO-001] orders the seven curated Derived submarkets by rank, whatever order they arrive in', () => {
            const sorted = sortSymbols(buildShuffled(CURATED_ORDER_PRIMARY));

            expect(submarketsOf(sorted)).toEqual(CURATED_ORDER_PRIMARY);
        });

        it('[DMO-001] places every synthetics submarket ahead of every baskets submarket', () => {
            const sorted = sortSymbols(buildShuffled(CURATED_ORDER_PRIMARY));
            const subgroups = sorted.map(symbol => symbol.subgroup);

            expect(subgroups).toEqual([
                'synthetics',
                'synthetics',
                'synthetics',
                'synthetics',
                'synthetics',
                'baskets',
                'baskets',
            ]);
        });

        it('[DMO-001] keeps the curated relative order when only a subset of the submarkets is tradeable', () => {
            const sorted = sortSymbols([
                derived('WLDUSD', 'basket_forex', 'baskets'),
                derived('BOOM1000', 'crash_boom'),
                derived('R_100', 'random_index'),
            ]);

            expect(submarketsOf(sorted)).toEqual(['random_index', 'crash_boom', 'basket_forex']);
        });

        it('[DMO-003] ranks alias submarket keys identically to their primary spellings', () => {
            const sorted = sortSymbols(buildShuffled(CURATED_ORDER_ALIAS));

            expect(submarketsOf(sorted)).toEqual(CURATED_ORDER_ALIAS);
        });

        it('[DMO-003] ranks both spellings of one submarket at the same position within a mixed list', () => {
            const sorted = sortSymbols([
                derived('WLDXAU', 'commodity_basket', 'baskets'),
                derived('BOOM1000', 'crash_index'),
                derived('CRASH500', 'crash_boom'),
                derived('RDBULL', 'random_daily'),
                derived('R_100', 'random_index'),
            ]);

            expect(submarketsOf(sorted)).toEqual([
                'random_index',
                'crash_index',
                'crash_boom',
                'random_daily',
                'commodity_basket',
            ]);
        });

        it('[DMO-004] keeps an uncurated Derived submarket and places it after every curated one', () => {
            const sorted = sortSymbols([
                derived('RB100', 'range_index'),
                derived('WLDXAU', 'commodity_basket', 'baskets'),
                derived('RDBULL', 'random_daily'),
                derived('R_100', 'random_index'),
            ]);

            expect(submarketsOf(sorted)).toEqual(['random_index', 'random_daily', 'commodity_basket', 'range_index']);
            expect(submarketsOf(sorted).indexOf('range_index')).toBeGreaterThan(
                submarketsOf(sorted).indexOf('random_daily')
            );
        });

        it('[DMO-004] drops no symbol and duplicates none while ordering', () => {
            const input = [...buildShuffled(CURATED_ORDER_ALIAS), derived('RB100', 'range_index')];

            const sorted = sortSymbols(input);

            expect(sorted).toHaveLength(input.length);
            expect(new Set(sorted.map(symbol => symbol.underlying_symbol))).toEqual(
                new Set(input.map(symbol => symbol.underlying_symbol))
            );
        });

        it('[DMO-002] orders Derived identically under a locale whose translations collate the other way', () => {
            // Translations chosen so locale-aware comparison of the display names yields the exact
            // reverse of the curated order — an ordering that consulted them could not pass.
            const translations: Record<string, string> = {
                'Volatility indices': 'Zzz Volatilitaetsindizes',
                'Step indices': 'Yyy Stufenindizes',
                'Jump indices': 'Xxx Sprungindizes',
                'Crash/Boom': 'Www Crash/Boom',
                'Daily reset indices': 'Vvv Taegliche Indizes',
                'Forex basket': 'Uuu Forex-Korb',
                'Commodities basket': 'Ttt Rohstoff-Korb',
                'Range break indices': 'Sss Bereichsindizes',
            };
            (localize as jest.Mock).mockImplementation((text: string) => translations[text] ?? text);

            const sorted = sortSymbols([...buildShuffled(CURATED_ORDER_ALIAS), derived('RB100', 'range_index')]);

            expect(submarketsOf(sorted)).toEqual([...CURATED_ORDER_ALIAS, 'range_index']);
        });

        it('[DMO-006] leaves the submarket order of every non-Derived market untouched', () => {
            const symbol = (underlying_symbol: string, market: string, submarket: string) =>
                ({
                    underlying_symbol,
                    market,
                    submarket,
                    subgroup: 'none',
                    display_order: 0,
                    exchange_is_open: 1,
                    is_trading_suspended: 0,
                }) as ActiveSymbols[number];

            const sorted = sortSymbols([
                symbol('frxXAUUSD', 'commodities', 'metals'),
                symbol('OTC_SPC', 'indices', 'americas_OTC'),
                symbol('WTI_OIL', 'commodities', 'energy'),
                symbol('frxEURUSD', 'forex', 'major_pairs'),
                symbol('OTC_AEX', 'indices', 'europe_OTC'),
                symbol('cryBTCUSD', 'cryptocurrency', 'non_stable_coin'),
                symbol('frxAUDCAD', 'forex', 'minor_pairs'),
                symbol('OTC_N225', 'indices', 'asia_oceania_OTC'),
            ]);

            expect(sorted.map(item => item.underlying_symbol)).toEqual([
                'frxEURUSD',
                'frxAUDCAD',
                'OTC_SPC',
                'OTC_N225',
                'OTC_AEX',
                'cryBTCUSD',
                'WTI_OIL',
                'frxXAUUSD',
            ]);
        });
    });
});
