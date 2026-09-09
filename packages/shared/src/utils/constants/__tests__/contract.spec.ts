import {
    getCardLabels,
    getCardLabelsV2,
    getMarketNamesMap,
    getUnsupportedContracts,
    getSupportedContracts,
    getContractConfig,
    getContractTypeDisplay,
    getContractCategoriesConfig,
    getContractTypesConfig,
    getContractTypePosition,
    unsupported_contract_types_list,
    getCleanedUpCategories,
    getLocalizedBasis,
} from '../contract';
import { tradeTypeIcons } from '../trade-type-icons';
import { CONTRACT_TYPES, TRADE_TYPES } from '../../contract';

type TGetSupportedContractsKey = keyof ReturnType<typeof getSupportedContracts>;
const card_labels = {
    APPLY: 'Apply',
    MULTIPLIER: 'Multiplier:',
    TAKE_PROFIT_IS_NOT_AVAILABLE: "Take profit can't be adjusted for ongoing accumulator contracts.",
};
const dead_card_labels = ['BUY_PRICE', 'CURRENT_STAKE', 'DONT_SHOW_THIS_AGAIN', 'INITIAL_STAKE', 'LOST', 'WON'];
const markets_name = 'AUD/CAD';
const unsupported_contract = {
    name: 'Spread Up',
    position: 'top',
};
const supported_high_low_contract = {
    name: 'Higher',
    position: 'top',
};
const supported_non_high_low_contract = {
    name: 'Rise',
    position: 'top',
};

describe('getLocalizedBasis', () => {
    it('should return an object with localized basis', () => {
        expect(getLocalizedBasis().accumulator).toEqual('Accumulators');
    });
});

describe('getCardLabels', () => {
    it('should return an object with card labels, e.g. such as Apply or Multiplier', () => {
        expect(getCardLabels().APPLY).toEqual(card_labels.APPLY);
        expect(getCardLabels().MULTIPLIER).toEqual(card_labels.MULTIPLIER);
        expect(getCardLabels().TAKE_PROFIT_IS_NOT_AVAILABLE).toEqual(card_labels.TAKE_PROFIT_IS_NOT_AVAILABLE);
    });

    it('[DCR-011] should have dropped the six dead labels from both label maps', () => {
        expect.assertions(dead_card_labels.length * 2);
        dead_card_labels.forEach(label => {
            expect(getCardLabels()).not.toHaveProperty(label);
            expect(getCardLabelsV2()).not.toHaveProperty(label);
        });
    });

    it('[DCR-011] should keep the destructured and computed-key labels the contract cards read', () => {
        const labels = getCardLabels();
        expect(labels.PAYOUT).toEqual('Sell price:');
        expect(labels.INDICATIVE_PRICE).toEqual('Indicative price:');
        expect(labels.PROFIT_LOSS).toEqual('Profit/Loss:');
        expect(labels.POTENTIAL_PROFIT_LOSS).toEqual('Potential profit/loss:');
        expect(labels.PURCHASE_PRICE).toEqual('Buy price:');
        expect(labels.TAKE_PROFIT_IS_NOT_AVAILABLE).toEqual(card_labels.TAKE_PROFIT_IS_NOT_AVAILABLE);
        expect(labels.TAKE_PROFIT_LOSS_NOT_AVAILABLE).toEqual(
            'Take profit and/or stop loss are not available while deal cancellation is active.'
        );
    });
});

describe('getMarketNamesMap', () => {
    const symbols_translation_object = getMarketNamesMap();

    it('should return an object with symbols, e.g. such as AUD/CAD', () => {
        expect(symbols_translation_object.FRXAUDCAD).toEqual(markets_name);
    });
    it('should return an object with symbols, including Volatility 25 (1s) Index, Volatility 50 (1s) Index and Volatility 75 (1s) Index', () => {
        expect(symbols_translation_object['1HZ25V']).toEqual('Volatility 25 (1s) Index');
        expect(symbols_translation_object['1HZ50V']).toEqual('Volatility 50 (1s) Index');
        expect(symbols_translation_object['1HZ75V']).toEqual('Volatility 75 (1s) Index');
    });
    it('should name the new Crash/Boom symbols consistently with the existing ones (no N suffix in the display name)', () => {
        expect(symbols_translation_object.CRASH50).toEqual('Crash 50 Index');
        expect(symbols_translation_object.CRASH150N).toEqual('Crash 150 Index');
        expect(symbols_translation_object.BOOM50).toEqual('Boom 50 Index');
        expect(symbols_translation_object.BOOM150N).toEqual('Boom 150 Index');
    });
});

describe('getUnsupportedContracts', () => {
    it('should return an object with unsupported contracts, e.g. such as Spread Up', () => {
        expect(getUnsupportedContracts().CALLSPREAD).toEqual(unsupported_contract);
    });
    it('should not return High Tick contract type as a part of unsupported contracts', () => {
        expect(Object.keys(getUnsupportedContracts())).not.toContain(CONTRACT_TYPES.TICK_HIGH_LOW.HIGH);
    });
    it('should not return High-Close contract type as a part of unsupported contracts', () => {
        expect(Object.keys(getUnsupportedContracts())).not.toContain(CONTRACT_TYPES.LB_PUT);
    });
});

describe('getSupportedContracts', () => {
    it('should return an object with specific supported contracts if is_high_low === true', () => {
        expect(getSupportedContracts(true).CALL).toEqual(supported_high_low_contract);
    });

    it('should return an object with specific supported contracts if is_high_low === false', () => {
        expect(getSupportedContracts(false).CALL).toEqual(supported_non_high_low_contract);
    });

    it('should return TICKHIGH as a part of supported contracts', () => {
        expect(Object.keys(getSupportedContracts(false))).toContain('TICKHIGH');
    });
});

describe('getContractConfig', () => {
    it('should return an object with specific contracts if is_high_low === true', () => {
        expect(getContractConfig(true).CALL).toEqual(supported_high_low_contract);
    });

    it('should return object with specific contracts if is_high_low === false', () => {
        expect(getContractConfig(false).CALL).toEqual(supported_non_high_low_contract);
    });
});

describe('getContractTypeDisplay', () => {
    it('should return a specific button name if show_button_name === true and contract_config has a button_name field', () => {
        expect(getContractTypeDisplay(CONTRACT_TYPES.ACCUMULATOR, { showButtonName: true })).toEqual('Buy');
    });
    it('should return a specific contract name if show_button_name === false but contract_config has a button_name field', () => {
        expect(getContractTypeDisplay(CONTRACT_TYPES.ACCUMULATOR)).toEqual('Accumulators');
    });
    it('should return a specific contract name if show_button_name === true but contract_config has no button_name field', () => {
        expect(
            getContractTypeDisplay(CONTRACT_TYPES.MULTIPLIER.DOWN, { isHighLow: true, showButtonName: true })
        ).toEqual('Down');
    });
    it('should return an empty string if show_button_name === false and contract_config has no name field', () => {
        expect(getContractTypeDisplay('TEST', { isHighLow: true })).toBe('');
    });
    it('should return an empty string if show_button_name === true and contract_config has no name field and no button_name', () => {
        expect(getContractTypeDisplay('TEST', { isHighLow: true, showButtonName: true })).toBe('');
    });
    it('should return main title for contracts which have such field if show_main_title is true', () => {
        expect(
            getContractTypeDisplay(CONTRACT_TYPES.MULTIPLIER.DOWN, {
                isHighLow: true,
                showMainTitle: true,
            })
        ).toBe('Multipliers');
        expect(
            getContractTypeDisplay(CONTRACT_TYPES.TURBOS.LONG, {
                showMainTitle: true,
            })
        ).toBe('Turbos');
        expect(
            getContractTypeDisplay(CONTRACT_TYPES.VANILLA.CALL, {
                showMainTitle: true,
            })
        ).toBe('Vanillas');
    });
    it('should not return main title for contracts which have such field but show_main_title is false', () => {
        expect(getContractTypeDisplay(CONTRACT_TYPES.TURBOS.LONG)).not.toBe('Turbos');
        expect(getContractTypeDisplay(CONTRACT_TYPES.VANILLA.CALL)).not.toBe('Vanillas');
        expect(getContractTypeDisplay(CONTRACT_TYPES.MULTIPLIER.DOWN)).not.toBe('Multipliers');
    });
    it('should not return main title for contracts which have not such field if show_main_title is true', () => {
        expect(getContractTypeDisplay(CONTRACT_TYPES.FALL, { showMainTitle: true })).toBeFalsy();
    });
});

describe('getContractTypePosition', () => {
    it('should return a specific button position if such type exist', () => {
        expect(getContractTypePosition(CONTRACT_TYPES.TOUCH.NO_TOUCH)).toBe('bottom');
    });
    it('should return a top position if such type does not exist', () => {
        expect(getContractTypePosition('TEST' as TGetSupportedContractsKey)).toBe('top');
    });
});

describe('getCleanedUpCategories', () => {
    it('[DCR-013] should return only those trade categories that are objects containing value & text', () => {
        const initial_categories = {
            'Ups & Downs': {
                name: 'Ups & Downs',
                categories: [
                    {
                        value: TRADE_TYPES.RISE_FALL,
                        text: 'Rise/Fall',
                    },
                    TRADE_TYPES.RISE_FALL_EQUAL,
                    TRADE_TYPES.RUN_HIGH_LOW,
                    TRADE_TYPES.RESET,
                    TRADE_TYPES.ASIAN,
                    TRADE_TYPES.CALL_PUT_SPREAD,
                ],
            },
            Vanillas: {
                name: 'Vanillas',
                categories: [TRADE_TYPES.VANILLA.CALL, TRADE_TYPES.VANILLA.PUT],
            },
        };
        const resulting_categories = {
            'Ups & Downs': {
                name: 'Ups & Downs',
                categories: [
                    {
                        value: TRADE_TYPES.RISE_FALL,
                        text: 'Rise/Fall',
                    },
                ],
            },
        };
        expect(getCleanedUpCategories(initial_categories)).toEqual(resulting_categories);
    });
    it('[DCR-013] should return all trade categories when every entry is an object', () => {
        const initial_categories = {
            Multipliers: {
                name: 'Multipliers',
                categories: [
                    {
                        value: TRADE_TYPES.MULTIPLIER,
                        text: 'Multipliers',
                    },
                ],
            },
            Turbos: {
                name: 'Turbos',
                categories: [
                    {
                        value: TRADE_TYPES.TURBOS.LONG,
                        text: 'Turbos Long',
                    },
                ],
            },
        };
        const resulting_categories = {
            Multipliers: {
                name: 'Multipliers',
                categories: [
                    {
                        value: TRADE_TYPES.MULTIPLIER,
                        text: 'Multipliers',
                    },
                ],
            },
            Turbos: {
                name: 'Turbos',
                categories: [
                    {
                        value: TRADE_TYPES.TURBOS.LONG,
                        text: 'Turbos Long',
                    },
                ],
            },
        };
        expect(getCleanedUpCategories(initial_categories)).toEqual(resulting_categories);
    });
});

describe('getContractCategoriesConfig', () => {
    it('[DCR-016] should return object with categories', () => {
        const categories = {
            Turbos: { name: 'Turbos', categories: [TRADE_TYPES.TURBOS.LONG, TRADE_TYPES.TURBOS.SHORT] },
            Multipliers: { name: 'Multipliers', categories: [TRADE_TYPES.MULTIPLIER] },
            'Ups & Downs': {
                name: 'Ups & Downs',
                categories: [TRADE_TYPES.RISE_FALL, TRADE_TYPES.RISE_FALL_EQUAL, TRADE_TYPES.HIGH_LOW],
            },
            'Touch & No Touch': {
                name: 'Touch & No Touch',
                categories: [TRADE_TYPES.TOUCH],
            },
            Digits: {
                name: 'Digits',
                categories: [TRADE_TYPES.MATCH_DIFF, TRADE_TYPES.EVEN_ODD, TRADE_TYPES.OVER_UNDER],
            },
            Vanillas: { name: 'Vanillas', categories: [TRADE_TYPES.VANILLA.CALL, TRADE_TYPES.VANILLA.PUT] },
            Accumulators: { name: 'Accumulators', categories: [TRADE_TYPES.ACCUMULATOR] },
        };

        expect(getContractCategoriesConfig()).toEqual(categories);
    });

    it('[DCR-016] should reference only trade types that still have a config entry', () => {
        const config = getContractTypesConfig();
        Object.values(getContractCategoriesConfig()).forEach(({ categories }) => {
            categories.forEach(trade_type => expect(config).toHaveProperty(trade_type));
        });
    });

    it('[DCR-016] should have dropped every permanently-unsupported trade type from the config', () => {
        const config = getContractTypesConfig();
        unsupported_contract_types_list.forEach(trade_type => expect(config).not.toHaveProperty(trade_type));
    });

    it('[DCR-016] should keep the guard list and the icon map intact', () => {
        expect(unsupported_contract_types_list).toHaveLength(10);
        expect(Object.keys(tradeTypeIcons)).toHaveLength(37);
    });

    it('[DCR-016] should still name a historical contract of a removed type', () => {
        expect(getContractTypeDisplay(CONTRACT_TYPES.ASIAN.UP)).toBe('Asian Up');
        expect(getContractTypeDisplay(CONTRACT_TYPES.LB_CALL)).toBe('Close-Low');
    });
});
