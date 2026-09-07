import {
    CURATED_RANK_ABSENT,
    DERIVED_SECTION_ORDER,
    DERIVED_SUBGROUP_ORDER,
    getDerivedSubmarketRank,
} from '../market-ordering-utils';

const CURATED_SECTIONS = [
    ['random_index'],
    ['step_indices', 'step_index'],
    ['jump_indices', 'jump_index'],
    ['crash_boom', 'crash_index'],
    ['random_daily'],
    ['basket_forex', 'forex_basket'],
    ['basket_commodities', 'commodity_basket'],
];

describe('market-ordering-utils', () => {
    describe('DERIVED_SUBGROUP_ORDER', () => {
        it('[DMO-001] renders the Synthetics section before the Baskets section', () => {
            expect(DERIVED_SUBGROUP_ORDER).toEqual(['synthetics', 'baskets']);
        });
    });

    describe('getDerivedSubmarketRank', () => {
        it('[DMO-001] ranks the seven curated submarkets strictly in the curated order', () => {
            const ranks = CURATED_SECTIONS.map(([primary]) => getDerivedSubmarketRank(primary));

            expect(ranks).toEqual([0, 1, 2, 3, 4, 5, 6]);
        });

        it('[DMO-003] gives every alias spelling of a section the same rank', () => {
            CURATED_SECTIONS.forEach(aliases => {
                const ranks = aliases.map(alias => getDerivedSubmarketRank(alias));

                expect(new Set(ranks).size).toBe(1);
                expect(ranks[0]).toEqual(expect.any(Number));
            });
        });

        it('[DMO-004] returns undefined for an uncurated Derived submarket', () => {
            expect(getDerivedSubmarketRank('range_index')).toBeUndefined();
        });

        it('[DMO-006] returns undefined for every non-Derived submarket', () => {
            ['major_pairs', 'minor_pairs', 'metals', 'energy', 'non_stable_coin', 'americas_OTC'].forEach(submarket => {
                expect(getDerivedSubmarketRank(submarket)).toBeUndefined();
            });
        });

        it('[DMO-002] never consults a display name — no rank exists for a localized label', () => {
            ['Volatility indices', 'Forex basket', 'Commodities basket'].forEach(display_name => {
                expect(getDerivedSubmarketRank(display_name)).toBeUndefined();
            });
        });
    });

    describe('CURATED_RANK_ABSENT', () => {
        it('[DMO-004] sorts after every curated rank', () => {
            const curated_ranks = CURATED_SECTIONS.flat().map(alias => getDerivedSubmarketRank(alias) as number);

            expect(Math.max(...curated_ranks)).toBeLessThan(CURATED_RANK_ABSENT);
        });
    });

    describe('one ordering definition', () => {
        it('[DMO-007] derives the subgroup section order from the curated submarket order', () => {
            const implied_sequence = DERIVED_SECTION_ORDER.flatMap(section =>
                section.submarkets.map(() => section.subgroup)
            ).filter((subgroup, index, sequence) => subgroup !== sequence[index - 1]);

            expect(implied_sequence).toEqual(DERIVED_SUBGROUP_ORDER);
        });

        it('[DMO-007] lists every curated submarket exactly once across the sections', () => {
            const all_aliases = DERIVED_SECTION_ORDER.flatMap(section => section.submarkets.flat());

            expect(new Set(all_aliases).size).toBe(all_aliases.length);
            expect(all_aliases).toHaveLength(CURATED_SECTIONS.flat().length);
        });
    });
});
