import React from 'react';

import {
    getContractTypePosition,
    getSupportedContracts,
    TRADE_TYPES,
    unsupported_contract_types_list,
} from '@deriv/shared';
import { Localize } from '@deriv-com/translations';

import { getAvailableContractTypes, getCategoriesSortedByKey } from 'AppV2/Utils/trading-contract-type-helpers';
import { useTraderStore } from 'Stores/useTraderStores';

import { getInitialTradeTypeTab, getTradeTypeTabsList } from './trade-params-utils';

type TContractType = {
    text?: string;
    value: string;
};

type TCategories = {
    id: string;
    title: string;
    icon?: React.ReactNode;
};

export type TAvailableContract = {
    tradeType: string;
    id: string;
    for: string[];
    is_popular?: boolean;
    show_fire_icon?: boolean;
    /** Small text badge shown next to the trade type (e.g. Multipliers' "x500"). */
    badge?: string;
    category: 'growth_based' | 'directional' | 'digit_based';
    tooltip?: React.ReactNode;
};

const getSortedIndex = (type: string) =>
    getContractTypePosition(type as keyof ReturnType<typeof getSupportedContracts>) === 'bottom' ? 1 : 0;

export const CONTRACT_LIST = {
    ACCUMULATORS: 'Accumulators',
    VANILLAS: 'Vanillas',
    TURBOS: 'Turbos',
    MULTIPLIERS: 'Multipliers',
    RISE_FALL: 'Rise/Fall',
    HIGHER_LOWER: 'Higher/Lower',
    TOUCH_NO_TOUCH: 'Touch/No Touch',
    MATCHES_DIFFERS: 'Matches/Differs',
    EVEN_ODD: 'Even/Odd',
    OVER_UNDER: 'Over/Under',
};

// PO-specified display order for the trade-type list. Order is flat (not category-grouped): the
// mobile market-selector tabs render this order directly; the desktop sidebar re-groups by category
// but honours this order within each group. Changing the array order also affects search-result
// grouping, the Guide, and the Positions filter, which all read this list.
export const AVAILABLE_CONTRACTS: TAvailableContract[] = [
    {
        tradeType: 'Rise/Fall',
        id: CONTRACT_LIST.RISE_FALL,
        for: [TRADE_TYPES.RISE_FALL, TRADE_TYPES.RISE_FALL_EQUAL],
        is_popular: true,
        show_fire_icon: true,
        category: 'directional',
        tooltip: <Localize i18n_default_text='Earn when exit price is higher or lower than entry price.' />,
    },
    {
        tradeType: 'Accumulators',
        id: CONTRACT_LIST.ACCUMULATORS,
        for: [TRADE_TYPES.ACCUMULATOR],
        is_popular: true,
        show_fire_icon: true,
        category: 'growth_based',
        tooltip: <Localize i18n_default_text='Grow your stake exponentially while price stays in range.' />,
    },
    // Digits
    {
        tradeType: 'Matches/Differs',
        id: CONTRACT_LIST.MATCHES_DIFFERS,
        for: [TRADE_TYPES.MATCH_DIFF],
        is_popular: true,
        category: 'digit_based',
        tooltip: <Localize i18n_default_text='Earn when final digit matches or differs.' />,
    },
    {
        tradeType: 'Over/Under',
        id: CONTRACT_LIST.OVER_UNDER,
        for: [TRADE_TYPES.OVER_UNDER],
        is_popular: true,
        category: 'digit_based',
        tooltip: <Localize i18n_default_text='Earn when final digit is over or under your number.' />,
    },
    {
        tradeType: 'Even/Odd',
        id: CONTRACT_LIST.EVEN_ODD,
        for: [TRADE_TYPES.EVEN_ODD],
        category: 'digit_based',
        tooltip: <Localize i18n_default_text='Earn when final digit is even or odd.' />,
    },
    {
        tradeType: 'Multipliers',
        id: CONTRACT_LIST.MULTIPLIERS,
        for: [TRADE_TYPES.MULTIPLIER],
        is_popular: true,
        category: 'growth_based',
        tooltip: <Localize i18n_default_text='Leveraged trading with risk controls.' />,
    },
    {
        tradeType: 'Touch/No Touch',
        id: CONTRACT_LIST.TOUCH_NO_TOUCH,
        for: [TRADE_TYPES.TOUCH],
        category: 'directional',
        tooltip: <Localize i18n_default_text='Earn if price touches or avoids your barrier before expiry.' />,
    },
    {
        tradeType: 'Higher/Lower',
        id: CONTRACT_LIST.HIGHER_LOWER,
        for: [TRADE_TYPES.HIGH_LOW],
        category: 'directional',
        tooltip: <Localize i18n_default_text='Earn when exit price is above or below barrier.' />,
    },
    {
        tradeType: 'Turbos',
        id: CONTRACT_LIST.TURBOS,
        for: [TRADE_TYPES.TURBOS.LONG, TRADE_TYPES.TURBOS.SHORT],
        category: 'growth_based',
        tooltip: <Localize i18n_default_text='Directional trade with barrier knockout.' />,
    },
    {
        tradeType: 'Vanillas',
        id: CONTRACT_LIST.VANILLAS,
        for: [TRADE_TYPES.VANILLA.CALL, TRADE_TYPES.VANILLA.PUT],
        category: 'growth_based',
        tooltip: <Localize i18n_default_text='Earn if price ends above or below strike price.' />,
    },
];

/**
 * Gets the priority order for a trade type value based on AVAILABLE_CONTRACTS array order.
 * Lower numbers = higher priority (appear first).
 * @param value - The trade type value to look up
 * @returns The priority index, or 999 if not found (will appear last)
 */
const getTradeTypePriority = (value: string): number => {
    const index = AVAILABLE_CONTRACTS.findIndex(contract => contract.for.includes(value));
    return index === -1 ? 999 : index;
};

/**
 * Groups trade types by their category
 * @param contracts - Array of available contracts to group
 * @returns Object with categories as keys and arrays of contracts as values
 */
export const groupTradeTypesByCategory = (contracts: TAvailableContract[]) => {
    return contracts.reduce(
        (acc, contract) => {
            const category = contract.category;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(contract);
            return acc;
        },
        {} as Record<string, TAvailableContract[]>
    );
};

/**
 * Returns the localized label for a trade type category
 * @param category - Category key ('growth_based', 'directional', or 'digit_based')
 * @returns JSX element with localized label or null if category is unknown
 */
export const getCategoryLabel = (category: string): React.ReactNode => {
    switch (category) {
        case 'growth_based':
            return <Localize i18n_default_text='Growth based' />;
        case 'directional':
            return <Localize i18n_default_text='Directional' />;
        case 'digit_based':
            return <Localize i18n_default_text='Digit based' />;
        default:
            return null;
    }
};

// The trade-type display labels, keyed by contract id (which equals the English `tradeType`). Those
// `tradeType` strings are plain English used for logic/keys/ordering; render these instead wherever a
// heading is shown, so it re-localizes reactively on a language switch (via <Localize>) rather than
// staying frozen in the old language. Falls back to the raw id for anything unmapped.
const TRADE_TYPE_LABELS: Record<string, React.ReactNode> = {
    [CONTRACT_LIST.RISE_FALL]: <Localize i18n_default_text='Rise/Fall' />,
    [CONTRACT_LIST.ACCUMULATORS]: <Localize i18n_default_text='Accumulators' />,
    [CONTRACT_LIST.MATCHES_DIFFERS]: <Localize i18n_default_text='Matches/Differs' />,
    [CONTRACT_LIST.OVER_UNDER]: <Localize i18n_default_text='Over/Under' />,
    [CONTRACT_LIST.EVEN_ODD]: <Localize i18n_default_text='Even/Odd' />,
    [CONTRACT_LIST.MULTIPLIERS]: <Localize i18n_default_text='Multipliers' />,
    [CONTRACT_LIST.TOUCH_NO_TOUCH]: <Localize i18n_default_text='Touch/No Touch' />,
    [CONTRACT_LIST.HIGHER_LOWER]: <Localize i18n_default_text='Higher/Lower' />,
    [CONTRACT_LIST.TURBOS]: <Localize i18n_default_text='Turbos' />,
    [CONTRACT_LIST.VANILLAS]: <Localize i18n_default_text='Vanillas' />,
};

/** Reactive, localized label for a trade type (keyed by contract id). See TRADE_TYPE_LABELS. */
export const getTradeTypeLabel = (trade_type: string): React.ReactNode => TRADE_TYPE_LABELS[trade_type] ?? trade_type;

/**
 * The available contracts in the PO display order (the AVAILABLE_CONTRACTS array order), optionally
 * restricted to a supported set (e.g. Automate); an empty/absent set means "all". Used where a single
 * ordered trade-type list is needed — e.g. the search results grouped by trade type. Kept as a flat
 * pass-through (not re-grouped by category) so it honours the same order as everywhere else.
 */
export const getOrderedAvailableContracts = (supported_trade_types?: Set<string>): TAvailableContract[] =>
    supported_trade_types?.size
        ? AVAILABLE_CONTRACTS.filter(contract => contract.for.some(type => supported_trade_types.has(type)))
        : AVAILABLE_CONTRACTS;

/** Returns the full available contracts list in PO display order. */
export const getAvailableContracts = () => AVAILABLE_CONTRACTS;

export const getTradeTypesList = (contract_types_list: ReturnType<typeof useTraderStore>['contract_types_list']) => {
    const available_trade_types = getAvailableContractTypes(
        contract_types_list as unknown as Parameters<typeof getAvailableContractTypes>[0],
        unsupported_contract_types_list
    );

    const filtered_types = Object.values(getCategoriesSortedByKey(available_trade_types))
        .map(({ contract_types }) =>
            contract_types[0].value.startsWith('vanilla')
                ? contract_types.map(type => ({ ...type, text: 'Vanillas' }))
                : contract_types
        )
        .flat()
        .filter(
            ({ value }) =>
                ![TRADE_TYPES.VANILLA.PUT, TRADE_TYPES.TURBOS.SHORT, TRADE_TYPES.RISE_FALL_EQUAL].includes(value)
        );

    // Sort by manual order defined in AVAILABLE_CONTRACTS
    return filtered_types.sort((a, b) => getTradeTypePriority(a.value) - getTradeTypePriority(b.value));
};

/* Gets the array of sorted contract types that are used to display purchased buttons and other info based on a selected trade type tab if applicable. */
export const getDisplayedContractTypes = (
    trade_types: ReturnType<typeof useTraderStore>['trade_types'],
    contract_type: string,
    trade_type_tab: string
) => {
    const trade_type_tabs = getTradeTypeTabsList(contract_type);
    const available_types = Object.keys(trade_types);

    // If there are no trade type tabs, return all available types
    if (!trade_type_tabs.length) {
        return available_types.sort((a, b) => getSortedIndex(a) - getSortedIndex(b));
    }

    // If trade_types is empty but we have tabs, use contract_type directly
    // This ensures immediate rendering with the correct button type
    if (available_types.length === 0 && trade_type_tabs.length > 0) {
        // Return only the current contract_type, not all tab types
        return [contract_type];
    }

    // While trade_type_tab is still empty (before TradeTypeTabs mounts), default to the tab
    // it will select so we render one settled button instead of flashing one per type.
    const effective_tab = trade_type_tab || getInitialTradeTypeTab(contract_type);

    if (effective_tab) {
        const filtered_types = available_types.filter(type => type === effective_tab);
        // If filtering results in empty array but we have a valid tab, return it
        if (filtered_types.length === 0 && trade_type_tabs.some(tab => tab.contract_type === effective_tab)) {
            return [effective_tab];
        }
        return filtered_types.sort((a, b) => getSortedIndex(a) - getSortedIndex(b));
    }

    // Fallback (should be unreachable when tabs exist): return all available types
    return available_types.sort((a, b) => getSortedIndex(a) - getSortedIndex(b));
};

export const sortCategoriesInTradeTypeOrder = (trade_types: TContractType[], categories: TCategories[]) => {
    return categories
        .filter(category => trade_types.some(type => type.value === category.id))
        .sort((a, b) => getTradeTypePriority(a.id) - getTradeTypePriority(b.id));
};

/**
 * Checks if two contract types belong to the same trade type category.
 * For example, vanillalongcall and vanillalongput belong to the same "Vanillas" category,
 * turboslong and turbosshort belong to the same "Turbos" category.
 *
 * @param contract_type_1 - First contract type to compare
 * @param contract_type_2 - Second contract type to compare
 * @returns true if both contract types belong to the same category, false otherwise
 */
export const isSameTradeTypeCategory = (contract_type_1: string, contract_type_2: string): boolean => {
    // Find the category that contains the first contract type
    const category = AVAILABLE_CONTRACTS.find(contract => contract.for.includes(contract_type_1));

    // Check if the second contract type is also in the same category
    return category ? category.for.includes(contract_type_2) : contract_type_1 === contract_type_2;
};
