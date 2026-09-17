import React from 'react';

import { CONTRACT_TYPES, TRADE_TYPES } from '@deriv/shared';
import { render } from '@testing-library/react';

import {
    AVAILABLE_CONTRACTS,
    getAvailableContracts,
    getCategoryLabel,
    getDisplayedContractTypes,
    groupTradeTypesByCategory,
    isSameTradeTypeCategory,
    sortCategoriesInTradeTypeOrder,
} from '../trade-types-utils';

describe('trade-types-utils', () => {
    describe('groupTradeTypesByCategory', () => {
        it('should group contracts by category correctly', () => {
            const grouped = groupTradeTypesByCategory(AVAILABLE_CONTRACTS);

            expect(grouped).toHaveProperty('growth_based');
            expect(grouped).toHaveProperty('directional');
            expect(grouped).toHaveProperty('digit_based');

            // Growth based should contain Accumulators, Multipliers, Turbos, Vanillas
            expect(grouped.growth_based).toHaveLength(4);
            expect(grouped.growth_based.map(c => c.tradeType)).toContain('Accumulators');
            expect(grouped.growth_based.map(c => c.tradeType)).toContain('Multipliers');
            expect(grouped.growth_based.map(c => c.tradeType)).toContain('Turbos');
            expect(grouped.growth_based.map(c => c.tradeType)).toContain('Vanillas');

            // Directional should contain 3 contracts
            expect(grouped.directional).toHaveLength(3);
            expect(grouped.directional.map(c => c.tradeType)).toContain('Rise/Fall');
            expect(grouped.directional.map(c => c.tradeType)).toContain('Higher/Lower');
            expect(grouped.directional.map(c => c.tradeType)).toContain('Touch/No Touch');

            // Digit based should contain 3 contracts
            expect(grouped.digit_based).toHaveLength(3);
            expect(grouped.digit_based.map(c => c.tradeType)).toContain('Matches/Differs');
            expect(grouped.digit_based.map(c => c.tradeType)).toContain('Over/Under');
            expect(grouped.digit_based.map(c => c.tradeType)).toContain('Even/Odd');
        });

        it('should handle empty contracts array', () => {
            const grouped = groupTradeTypesByCategory([]);

            expect(grouped).toEqual({});
        });

        it('should maintain contract order within categories', () => {
            const grouped = groupTradeTypesByCategory(AVAILABLE_CONTRACTS);

            // Verify order matches AVAILABLE_CONTRACTS order
            const directionalTypes = grouped.directional.map(c => c.tradeType);
            expect(directionalTypes[0]).toBe('Rise/Fall');
            expect(directionalTypes[1]).toBe('Touch/No Touch');
            expect(directionalTypes[2]).toBe('Higher/Lower');

            const growthTypes = grouped.growth_based.map(c => c.tradeType);
            expect(growthTypes[0]).toBe('Accumulators');
            expect(growthTypes[1]).toBe('Multipliers');
            expect(growthTypes[2]).toBe('Turbos');
            expect(growthTypes[3]).toBe('Vanillas');
        });

        it('should group single contract correctly', () => {
            const singleContract = [AVAILABLE_CONTRACTS[0]];
            const grouped = groupTradeTypesByCategory(singleContract);

            expect(Object.keys(grouped)).toHaveLength(1);
            expect(grouped.directional).toHaveLength(1);
            expect(grouped.directional[0].tradeType).toBe('Rise/Fall');
        });
    });

    describe('isSameTradeTypeCategory', () => {
        it('should return true for vanillalongcall and vanillalongput', () => {
            const result = isSameTradeTypeCategory(TRADE_TYPES.VANILLA.CALL, TRADE_TYPES.VANILLA.PUT);
            expect(result).toBe(true);
        });

        it('should return true for turboslong and turbosshort', () => {
            const result = isSameTradeTypeCategory(TRADE_TYPES.TURBOS.LONG, TRADE_TYPES.TURBOS.SHORT);
            expect(result).toBe(true);
        });

        it('should return true for rise_fall and rise_fall_equal', () => {
            const result = isSameTradeTypeCategory(TRADE_TYPES.RISE_FALL, TRADE_TYPES.RISE_FALL_EQUAL);
            expect(result).toBe(true);
        });

        it('should return false for different categories', () => {
            const result = isSameTradeTypeCategory(TRADE_TYPES.ACCUMULATOR, TRADE_TYPES.MULTIPLIER);
            expect(result).toBe(false);
        });

        it('should return true when both types are identical', () => {
            const result = isSameTradeTypeCategory(TRADE_TYPES.ACCUMULATOR, TRADE_TYPES.ACCUMULATOR);
            expect(result).toBe(true);
        });

        it('should return false when first contract type is not found in AVAILABLE_CONTRACTS', () => {
            const result = isSameTradeTypeCategory('unknown_type', TRADE_TYPES.ACCUMULATOR);
            expect(result).toBe(false);
        });

        it('should return true for matching unknown types', () => {
            const result = isSameTradeTypeCategory('unknown_type', 'unknown_type');
            expect(result).toBe(true);
        });

        it('should handle case sensitivity', () => {
            // Trade types are case-insensitive (accumulator lowercase matches)
            const result = isSameTradeTypeCategory(TRADE_TYPES.ACCUMULATOR.toLowerCase(), TRADE_TYPES.ACCUMULATOR);
            // Should return true because TRADE_TYPES.ACCUMULATOR is already lowercase
            expect(result).toBe(true);
        });
    });

    describe('getCategoryLabel', () => {
        it('should return "Growth based" for growth_based', () => {
            const { container } = render(<>{getCategoryLabel('growth_based')}</>);
            expect(container).toHaveTextContent('Growth based');
        });

        it('should return "Directional" for directional', () => {
            const { container } = render(<>{getCategoryLabel('directional')}</>);
            expect(container).toHaveTextContent('Directional');
        });

        it('should return "Digit based" for digit_based', () => {
            const { container } = render(<>{getCategoryLabel('digit_based')}</>);
            expect(container).toHaveTextContent('Digit based');
        });

        it('should return null for unknown category', () => {
            const result = getCategoryLabel('unknown_category');
            expect(result).toBeNull();
        });

        it('should return null for empty string', () => {
            const result = getCategoryLabel('');
            expect(result).toBeNull();
        });

        it('should return React element with Localize component', () => {
            const result = getCategoryLabel('growth_based');
            expect(React.isValidElement(result)).toBe(true);
        });
    });

    describe('getAvailableContracts', () => {
        it('[MBR-004] should return the full contracts list in PO display order', () => {
            const contracts = getAvailableContracts();
            expect(contracts).toEqual(AVAILABLE_CONTRACTS);
            expect(contracts).toHaveLength(10);
        });
    });

    describe('sortCategoriesInTradeTypeOrder', () => {
        const mockTradeTypes = [
            { value: TRADE_TYPES.ACCUMULATOR, text: 'Accumulators' },
            { value: TRADE_TYPES.MULTIPLIER, text: 'Multipliers' },
            { value: TRADE_TYPES.RISE_FALL, text: 'Rise/Fall' },
            { value: TRADE_TYPES.TURBOS.LONG, text: 'Turbos' },
        ];

        const mockCategories = [
            { id: TRADE_TYPES.TURBOS.LONG, title: 'Turbos' },
            { id: TRADE_TYPES.ACCUMULATOR, title: 'Accumulators' },
            { id: TRADE_TYPES.MULTIPLIER, title: 'Multipliers' },
            { id: TRADE_TYPES.RISE_FALL, title: 'Rise/Fall' },
        ];

        it('should sort categories based on AVAILABLE_CONTRACTS order', () => {
            const sorted = sortCategoriesInTradeTypeOrder(mockTradeTypes, mockCategories);

            // Expected order based on AVAILABLE_CONTRACTS:
            // 1. Rise/Fall (index 0)
            // 2. Accumulators (index 1)
            // 3. Multipliers (index 2)
            // 4. Turbos (index 3)
            expect(sorted.map(c => c.title)).toEqual(['Rise/Fall', 'Accumulators', 'Multipliers', 'Turbos']);
        });

        it('should filter out categories not in trade_types', () => {
            const limitedTradeTypes = [
                { value: TRADE_TYPES.ACCUMULATOR, text: 'Accumulators' },
                { value: TRADE_TYPES.MULTIPLIER, text: 'Multipliers' },
            ];

            const sorted = sortCategoriesInTradeTypeOrder(limitedTradeTypes, mockCategories);

            expect(sorted).toHaveLength(2);
            expect(sorted.map(c => c.title)).toEqual(['Accumulators', 'Multipliers']);
        });

        it('should handle empty trade_types array', () => {
            const sorted = sortCategoriesInTradeTypeOrder([], mockCategories);
            expect(sorted).toEqual([]);
        });

        it('should handle empty categories array', () => {
            const sorted = sortCategoriesInTradeTypeOrder(mockTradeTypes, []);
            expect(sorted).toEqual([]);
        });

        it('should handle categories with no matching trade types', () => {
            const unmatchedCategories = [
                { id: 'unknown1', title: 'Unknown 1' },
                { id: 'unknown2', title: 'Unknown 2' },
            ];

            const sorted = sortCategoriesInTradeTypeOrder(mockTradeTypes, unmatchedCategories);
            expect(sorted).toEqual([]);
        });

        it('should maintain stable sort for categories not in AVAILABLE_CONTRACTS', () => {
            const categoriesWithUnknown = [...mockCategories, { id: 'unknown', title: 'Unknown' }];

            const tradeTypesWithUnknown = [...mockTradeTypes, { value: 'unknown', text: 'Unknown' }];

            const sorted = sortCategoriesInTradeTypeOrder(tradeTypesWithUnknown, categoriesWithUnknown);

            // Unknown should appear last (priority 999)
            expect(sorted[sorted.length - 1].title).toBe('Unknown');
        });

        it('should handle duplicate category IDs', () => {
            const duplicateCategories = [
                { id: TRADE_TYPES.ACCUMULATOR, title: 'Accumulators 1' },
                { id: TRADE_TYPES.ACCUMULATOR, title: 'Accumulators 2' },
                { id: TRADE_TYPES.MULTIPLIER, title: 'Multipliers' },
            ];

            const sorted = sortCategoriesInTradeTypeOrder(mockTradeTypes, duplicateCategories);

            // Both duplicates should be included and sorted
            expect(sorted).toHaveLength(3);
            expect(sorted[0].title).toBe('Accumulators 1');
            expect(sorted[1].title).toBe('Accumulators 2');
        });
    });

    describe('getDisplayedContractTypes', () => {
        const rise_fall_types = { [CONTRACT_TYPES.CALL]: 'Rise', [CONTRACT_TYPES.PUT]: 'Fall' };

        it('returns a single default tab for Rise/Fall when trade_type_tab is not set yet (no flash)', () => {
            // The load-window config that used to return [CALL, PUT] and flash two buttons.
            expect(getDisplayedContractTypes(rise_fall_types, TRADE_TYPES.RISE_FALL, '')).toEqual([
                CONTRACT_TYPES.CALL,
            ]);
        });

        it('returns the selected side when trade_type_tab is set', () => {
            expect(getDisplayedContractTypes(rise_fall_types, TRADE_TYPES.RISE_FALL, CONTRACT_TYPES.PUT)).toEqual([
                CONTRACT_TYPES.PUT,
            ]);
        });

        it('returns a single default tab for Multipliers when trade_type_tab is not set yet', () => {
            const multiplier_types = {
                [CONTRACT_TYPES.MULTIPLIER.UP]: 'Up',
                [CONTRACT_TYPES.MULTIPLIER.DOWN]: 'Down',
            };
            expect(getDisplayedContractTypes(multiplier_types, TRADE_TYPES.MULTIPLIER, '')).toEqual([
                CONTRACT_TYPES.MULTIPLIER.UP,
            ]);
        });

        it('returns the single available type for a tab-less contract (Accumulator)', () => {
            expect(
                getDisplayedContractTypes({ [CONTRACT_TYPES.ACCUMULATOR]: 'Accumulator' }, TRADE_TYPES.ACCUMULATOR, '')
            ).toEqual([CONTRACT_TYPES.ACCUMULATOR]);
        });

        it('falls back to the contract_type when trade_types have not loaded yet', () => {
            expect(getDisplayedContractTypes({}, TRADE_TYPES.RISE_FALL, '')).toEqual([TRADE_TYPES.RISE_FALL]);
        });
    });

    describe('AVAILABLE_CONTRACTS order', () => {
        it('follows the PO-specified trade-type display order', () => {
            expect(AVAILABLE_CONTRACTS.map(c => c.tradeType)).toEqual([
                'Rise/Fall',
                'Accumulators',
                'Matches/Differs',
                'Over/Under',
                'Even/Odd',
                'Multipliers',
                'Touch/No Touch',
                'Higher/Lower',
                'Turbos',
                'Vanillas',
            ]);
        });
    });

    describe('AVAILABLE_CONTRACTS badges', () => {
        it('does not show the x500 badge on Multipliers now that multiple leverage options exist', () => {
            const multipliers = AVAILABLE_CONTRACTS.find(c => c.tradeType === 'Multipliers');
            expect(multipliers?.badge).toBeUndefined();
        });

        it('defines no badge on any trade type', () => {
            expect(AVAILABLE_CONTRACTS.every(c => c.badge === undefined)).toBe(true);
        });
    });
});
