// The ONLY place the Derived section order is defined. Both consumers read it: `sortSymbols` ranks
// submarkets by it and `groupSymbolsForList` takes its subgroup section order from it, so the two
// cannot drift. Each entry's `submarkets` lists the alias spellings of ONE section — aliases share a
// rank, so it does not matter which key `active_symbols` sends. Keys only, never display names: the
// order must not depend on the active language.

/** One Derived subgroup and its submarket sections in order; each inner array is one section's aliases. */
type TDerivedSection = { subgroup: string; submarkets: readonly (readonly string[])[] };

export const DERIVED_SECTION_ORDER: readonly TDerivedSection[] = [
    {
        subgroup: 'synthetics',
        submarkets: [
            ['random_index'],
            ['step_indices', 'step_index'],
            ['jump_indices', 'jump_index'],
            ['crash_boom', 'crash_index'],
            ['random_daily'],
        ],
    },
    {
        subgroup: 'baskets',
        submarkets: [
            ['basket_forex', 'forex_basket'],
            ['basket_commodities', 'commodity_basket'],
        ],
    },
];

/** Rank for a submarket the table does not curate, so it sorts after every curated one. */
export const CURATED_RANK_ABSENT = Number.MAX_SAFE_INTEGER;

/** Derived subgroup sections in render order, taken from the same table as the submarket ranks. */
export const DERIVED_SUBGROUP_ORDER: string[] = DERIVED_SECTION_ORDER.map(section => section.subgroup);

const rank_by_submarket = new Map<string, number>(
    DERIVED_SECTION_ORDER.flatMap(section => section.submarkets).flatMap((aliases, rank) =>
        aliases.map((alias): [string, number] => [alias, rank])
    )
);

/** Curated rank of a Derived submarket key (either alias spelling), or `undefined` if uncurated. */
export const getDerivedSubmarketRank = (submarket: string): number | undefined => rank_by_submarket.get(submarket);
