import { localize } from '@deriv-com/translations';

/**
 * Identifiers for the two trade panel tabs. Lives in the automation-config
 * namespace because the `'automation'` tab is the only reason the
 * distinction exists at all and gives `TTradePanelTab` a single source of truth.
 */
export const TRADE_PANEL_TABS = {
    TRADE: 'trade',
    AUTOMATION: 'automation',
} as const;

export type TTradePanelTab = (typeof TRADE_PANEL_TABS)[keyof typeof TRADE_PANEL_TABS];

export type TStrategyOption = {
    value: string;
    label: string;
    description?: string;
};

export type TAutomationConfig = {
    /** Selected strategy ID (e.g. 'martingale'). */
    strategy: string;
    /** Dynamic key-value map of strategy parameter values, keyed by schema property names. */
    strategy_params: Record<string, string>;
};

export const MULTIPLIER_PRESETS = [2, 3, 4, 5, 6, 7];

export const MULTIPLIER_DECIMALS = 2;

/** Fallback exclusive lower bound; used before the schema resolves. */
const MULTIPLIER_MIN = 1;

/** Fallback inclusive upper bound; used before the schema resolves. */
const MULTIPLIER_MAX = 10;

/** Resolved bounds for a multiplier field. Upper is always inclusive (`maximum`). */
export type TStakeMultiplierBounds = {
    min: number;
    /** Inclusive: a value equal to this is valid. */
    max: number;
    /** When true the value must be strictly greater than `min`. */
    is_min_exclusive: boolean;
};

/** Client fallbacks, used when the server schema has not supplied bounds. */
export const DEFAULT_MULTIPLIER_BOUNDS: TStakeMultiplierBounds = {
    min: MULTIPLIER_MIN,
    max: MULTIPLIER_MAX,
    is_min_exclusive: true,
};

/** True when `num` satisfies both ends of `bounds`; the upper bound is inclusive. */
const isWithinBounds = (num: number, bounds: TStakeMultiplierBounds): boolean => {
    const above_min = bounds.is_min_exclusive ? num > bounds.min : num >= bounds.min;
    return above_min && num <= bounds.max;
};

/** Presets filtered to the resolved bounds (chips bypass validation). */
export const getStakeMultiplierPresets = (bounds: TStakeMultiplierBounds): number[] =>
    MULTIPLIER_PRESETS.filter(value => isWithinBounds(value, bounds));

/**
 * Parameter keys from the server JSON Schema that map to specialised UI components.
 * Any parameter key NOT in this set will render as a generic text input.
 */
export const KNOWN_PARAM_KEYS = {
    TAKE_PROFIT: 'take_profit',
    STOP_LOSS: 'stop_loss',
    MULTIPLIER: 'multiplier',
    UNIT: 'unit',
    MAX_STAKE: 'max_stake',
    INITIAL_STAKE: 'initial_stake',
} as const;

/** The two parameter keys the StakeMultiplier editor handles. */
export type TStakeMultiplierParamKey = typeof KNOWN_PARAM_KEYS.MULTIPLIER | typeof KNOWN_PARAM_KEYS.UNIT;

/** Range sentence for the multiplier hint and validation error. */
export const getStakeMultiplierRangeText = (
    bounds: TStakeMultiplierBounds,
    localize: (text: string, args?: Record<string, unknown>) => string
): string => {
    const values = { min: bounds.min, max: bounds.max };
    return bounds.is_min_exclusive
        ? localize('The value must be greater than {{min}} and no more than {{max}}.', values)
        : localize('The value must be between {{min}} and {{max}}.', values);
};

/**
 * Validates a multiplier/increment value. Returns a localized error or empty string.
 * Branches on `param_key`; `bounds` applies to the multiplier only (the schema gives
 * `unit` no bounds, so using the fallback would incorrectly cap the increment).
 */
export const getStakeMultiplierError = (
    value: string,
    param_key: TStakeMultiplierParamKey,
    localize: (text: string, args?: Record<string, unknown>) => string,
    bounds: TStakeMultiplierBounds = DEFAULT_MULTIPLIER_BOUNDS
): string => {
    const num = Number(value);
    const is_multiplier = param_key === KNOWN_PARAM_KEYS.MULTIPLIER;
    const is_blank = !value || isNaN(num);

    if (is_multiplier) {
        // One message covers a blank input, an under-shoot and an over-shoot alike.
        if (!is_blank && isWithinBounds(num, bounds)) return '';
        return getStakeMultiplierRangeText(bounds, localize);
    }

    return is_blank || num < 1 ? localize('Increment must be at least 1') : '';
};

export const DEFAULT_STRATEGY_PARAMS: Record<string, string> = {
    [KNOWN_PARAM_KEYS.INITIAL_STAKE]: '1',
    [KNOWN_PARAM_KEYS.MULTIPLIER]: '2',
    [KNOWN_PARAM_KEYS.UNIT]: '2',
    [KNOWN_PARAM_KEYS.TAKE_PROFIT]: '10',
    [KNOWN_PARAM_KEYS.STOP_LOSS]: '10',
    [KNOWN_PARAM_KEYS.MAX_STAKE]: '',
};

export const DEFAULT_AUTOMATION_CONFIG: TAutomationConfig = {
    strategy: 'martingale',
    strategy_params: { ...DEFAULT_STRATEGY_PARAMS },
};

/** Fallback display names for known strategy IDs when server data is unavailable. */
const STRATEGY_DISPLAY_NAMES: Record<string, string> = {
    martingale: 'Martingale',
    dalembert: "D'Alembert",
};

/**
 * Preferred display order for the strategy selector — the BE order isn't stable.
 * Strategies not listed here keep their BE order after these.
 */
const STRATEGY_ORDER = ['martingale', 'dalembert'];

export const getStrategyOrderIndex = (strategy_id: string): number => {
    const index = STRATEGY_ORDER.indexOf(strategy_id);
    return index === -1 ? STRATEGY_ORDER.length : index;
};

export const getStrategyLabel = (strategy: string, options: TStrategyOption[] = []) =>
    options.find(opt => opt.value === strategy)?.label ?? STRATEGY_DISPLAY_NAMES[strategy] ?? strategy;

/**
 * Localized strategy descriptions, mirroring the BE copy (English-only) so they
 * translate. Unknown strategies return undefined so callers can fall back to the
 * BE text.
 */
export const getStrategyDescription = (strategy_id: string): string | undefined => {
    const descriptions: Record<string, string> = {
        martingale: localize(
            'Multiplies the stake by a configurable factor after each loss and resets to the initial stake after a win.'
        ),
        dalembert: localize(
            'Increases the stake by one unit after each loss and decreases it by one unit after each win, never going below the initial stake.'
        ),
    };

    return descriptions[strategy_id];
};

/**
 * Localized tooltip copy for strategy parameters, mirroring the BE schema
 * descriptions (which are English-only) so they can be translated. `initial_stake`
 * and `max_stake` differ per strategy; the rest are shared. Unknown keys return
 * undefined so callers can fall back to the BE text.
 *
 * `bounds` are the resolved multiplier bounds so the copy states the range
 * actually enforced.
 */
export const getParamDescription = (
    strategy_id: string,
    key: string,
    bounds: TStakeMultiplierBounds = DEFAULT_MULTIPLIER_BOUNDS
): string | undefined => {
    const shared: Record<string, string> = {
        [KNOWN_PARAM_KEYS.MULTIPLIER]: `${localize(
            'Factor applied to the stake after each loss.'
        )} ${getStakeMultiplierRangeText(bounds, localize)} ${localize('Defaults to 2.')}`,
        [KNOWN_PARAM_KEYS.UNIT]: localize(
            'Amount added to the stake after a loss and subtracted after a win. Must be > 0.'
        ),
        [KNOWN_PARAM_KEYS.TAKE_PROFIT]: localize(
            'Stop when total payout minus total stake reaches or exceeds this value. Must be > 0.'
        ),
        [KNOWN_PARAM_KEYS.STOP_LOSS]: localize(
            'Stop when total stake minus total payout reaches or exceeds this value. Must be > 0.'
        ),
    };

    const per_strategy: Record<string, Record<string, string>> = {
        martingale: {
            [KNOWN_PARAM_KEYS.INITIAL_STAKE]: localize('Stake used for the first contract and after a win.'),
            [KNOWN_PARAM_KEYS.MAX_STAKE]: localize(
                'Upper limit for stake multiplying. Must be at least your stake amount. If empty, there is no upper limit.'
            ),
        },
        dalembert: {
            [KNOWN_PARAM_KEYS.INITIAL_STAKE]: localize(
                'Stake used for the first contract. The stake never falls below this value.'
            ),
            [KNOWN_PARAM_KEYS.MAX_STAKE]: localize(
                'Upper limit for the stake. Must be at least your stake amount. If the next stake would exceed it, the stake resets to your stake amount.'
            ),
        },
    };

    return per_strategy[strategy_id]?.[key] ?? shared[key];
};
