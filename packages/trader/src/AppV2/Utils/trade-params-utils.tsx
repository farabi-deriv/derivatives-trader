import React from 'react';

import {
    CONTRACT_TYPES,
    type Dayjs,
    isTimeValid,
    isTouchContract,
    isTurbosContract,
    isVanillaContract,
    shouldShowExpiration,
    TRADE_TYPES,
} from '@deriv/shared';
import { Localize, localize } from '@deriv-com/translations';

import { createProposalRequestForContract, getProposalInfo } from 'Stores/Modules/Trading/Helpers/proposal';
import { TTradeStore } from 'Types';

import { DEFAULT_DURATION } from '../Config/trade-parameter-presets';

import { mapContractTypeToDurationPresetKey } from './trade-params-preset-utils';

export const DURATION_UNIT = {
    DAYS: 'd',
    TICKS: 't',
    MINUTES: 'm',
    HOURS: 'h',
    SECONDS: 's',
};

export const getTradeParams = (symbol?: string, has_cancellation?: boolean) => ({
    [TRADE_TYPES.RISE_FALL]: {
        trade_type_tabs: true,
        duration: true,
        stake: true,
        allow_equals: true,
    },
    [TRADE_TYPES.RISE_FALL_EQUAL]: {
        trade_type_tabs: true,
        duration: true,
        stake: true,
        allow_equals: true,
    },
    [TRADE_TYPES.HIGH_LOW]: {
        trade_type_tabs: true,
        duration: true,
        barrier: true,
        stake: true,
    },
    [TRADE_TYPES.TOUCH]: {
        trade_type_tabs: true,
        duration: true,
        barrier: true,
        stake: true,
    },
    [TRADE_TYPES.MATCH_DIFF]: {
        trade_type_tabs: true,
        last_digit: true,
        duration: true,
        stake: true,
    },
    [TRADE_TYPES.EVEN_ODD]: {
        trade_type_tabs: true,
        duration: true,
        stake: true,
    },
    [TRADE_TYPES.OVER_UNDER]: {
        trade_type_tabs: true,
        last_digit: true,
        duration: true,
        stake: true,
    },
    [TRADE_TYPES.ACCUMULATOR]: {
        growth_rate: true,
        stake: true,
        take_profit: true,
        accu_info_display: true,
    },
    [TRADE_TYPES.MULTIPLIER]: {
        trade_type_tabs: true,
        multiplier: true,
        stake: true,
        risk_management: true,
        ...(has_cancellation ? { mult_info_display: true } : {}),
        ...(shouldShowExpiration(symbol) ? { expiration: true } : {}),
        multipliers_info: true,
    },
    [TRADE_TYPES.TURBOS.LONG]: {
        trade_type_tabs: true,
        duration: true,
        payout_per_point: true,
        stake: true,
        take_profit: true,
        barrier_info: true,
    },
    [TRADE_TYPES.TURBOS.SHORT]: {
        trade_type_tabs: true,
        duration: true,
        payout_per_point: true,
        stake: true,
        take_profit: true,
        barrier_info: true,
    },
    [TRADE_TYPES.VANILLA.CALL]: {
        trade_type_tabs: true,
        duration: true,
        strike: true,
        stake: true,
        payout_per_point_info: true,
    },
    [TRADE_TYPES.VANILLA.PUT]: {
        trade_type_tabs: true,
        duration: true,
        strike: true,
        stake: true,
        payout_per_point_info: true,
    },
});

export const isDigitContractWinning = (
    contract_type: string | undefined,
    selected_digit: number | null,
    current_digit: number | null
) => {
    const win_conditions = {
        [CONTRACT_TYPES.MATCH_DIFF.MATCH]: current_digit === selected_digit,
        [CONTRACT_TYPES.MATCH_DIFF.DIFF]: current_digit !== selected_digit,
        [CONTRACT_TYPES.OVER_UNDER.OVER]:
            !!((current_digit || current_digit === 0) && (selected_digit || selected_digit === 0)) &&
            current_digit > selected_digit,
        [CONTRACT_TYPES.OVER_UNDER.UNDER]:
            !!((current_digit || current_digit === 0) && (selected_digit || selected_digit === 0)) &&
            current_digit < selected_digit,
        [CONTRACT_TYPES.EVEN_ODD.ODD]: !!current_digit && Boolean(current_digit % 2),
        [CONTRACT_TYPES.EVEN_ODD.EVEN]: (!!current_digit && !(current_digit % 2)) || current_digit === 0,
    } as { [key: string]: boolean };
    if (!contract_type || !win_conditions[contract_type]) return false;
    return win_conditions[contract_type];
};

export const focusAndOpenKeyboard = (focused_input?: HTMLInputElement | null, main_input?: HTMLInputElement | null) => {
    if (main_input && focused_input) {
        // Reveal a temporary input element and put focus on it
        focused_input.style.display = 'block';
        focused_input.focus({ preventScroll: true });

        // The keyboard is open, so now adding a delayed focus on the target element and hide the temporary input element
        return setTimeout(() => {
            main_input.focus();
            main_input.click();
            focused_input.style.display = 'none';
        }, 300);
    }
};

export const getTradeTypeTabsList = (contract_type = '') => {
    const is_turbos = isTurbosContract(contract_type);
    const is_vanilla = isVanillaContract(contract_type);
    const is_high_low = contract_type === TRADE_TYPES.HIGH_LOW;
    const is_touch = isTouchContract(contract_type);
    const is_rise_fall_equal = contract_type === TRADE_TYPES.RISE_FALL_EQUAL;
    const is_rise_fall = contract_type === TRADE_TYPES.RISE_FALL || is_rise_fall_equal;
    const tab_list = [
        {
            label: 'Up',
            value: TRADE_TYPES.TURBOS.LONG,
            contract_type: CONTRACT_TYPES.TURBOS.LONG,
            is_displayed: is_turbos,
        },
        {
            label: 'Down',
            value: TRADE_TYPES.TURBOS.SHORT,
            contract_type: CONTRACT_TYPES.TURBOS.SHORT,
            is_displayed: is_turbos,
        },
        {
            label: 'Call',
            value: TRADE_TYPES.VANILLA.CALL,
            contract_type: CONTRACT_TYPES.VANILLA.CALL,
            is_displayed: is_vanilla,
        },
        {
            label: 'Put',
            value: TRADE_TYPES.VANILLA.PUT,
            contract_type: CONTRACT_TYPES.VANILLA.PUT,
            is_displayed: is_vanilla,
        },
        {
            label: 'Higher',
            value: TRADE_TYPES.HIGH_LOW,
            contract_type: CONTRACT_TYPES.HIGHER,
            is_displayed: is_high_low,
        },
        { label: 'Lower', value: TRADE_TYPES.HIGH_LOW, contract_type: CONTRACT_TYPES.LOWER, is_displayed: is_high_low },
        {
            label: 'Touch',
            value: TRADE_TYPES.TOUCH,
            contract_type: CONTRACT_TYPES.TOUCH.ONE_TOUCH,
            is_displayed: is_touch,
        },
        {
            label: 'No Touch',
            value: TRADE_TYPES.TOUCH,
            contract_type: CONTRACT_TYPES.TOUCH.NO_TOUCH,
            is_displayed: is_touch,
        },
        {
            label: 'Rise',
            value: is_rise_fall_equal ? TRADE_TYPES.RISE_FALL_EQUAL : TRADE_TYPES.RISE_FALL,
            contract_type: is_rise_fall_equal ? CONTRACT_TYPES.CALLE : CONTRACT_TYPES.CALL,
            is_displayed: is_rise_fall,
        },
        {
            label: 'Fall',
            value: is_rise_fall_equal ? TRADE_TYPES.RISE_FALL_EQUAL : TRADE_TYPES.RISE_FALL,
            contract_type: is_rise_fall_equal ? CONTRACT_TYPES.PUTE : CONTRACT_TYPES.PUT,
            is_displayed: is_rise_fall,
        },
        {
            label: 'Matches',
            value: TRADE_TYPES.MATCH_DIFF,
            contract_type: CONTRACT_TYPES.MATCH_DIFF.MATCH,
            is_displayed: contract_type === TRADE_TYPES.MATCH_DIFF,
        },
        {
            label: 'Differs',
            value: TRADE_TYPES.MATCH_DIFF,
            contract_type: CONTRACT_TYPES.MATCH_DIFF.DIFF,
            is_displayed: contract_type === TRADE_TYPES.MATCH_DIFF,
        },
        {
            label: 'Even',
            value: TRADE_TYPES.EVEN_ODD,
            contract_type: CONTRACT_TYPES.EVEN_ODD.EVEN,
            is_displayed: contract_type === TRADE_TYPES.EVEN_ODD,
        },
        {
            label: 'Odd',
            value: TRADE_TYPES.EVEN_ODD,
            contract_type: CONTRACT_TYPES.EVEN_ODD.ODD,
            is_displayed: contract_type === TRADE_TYPES.EVEN_ODD,
        },
        {
            label: 'Over',
            value: TRADE_TYPES.OVER_UNDER,
            contract_type: CONTRACT_TYPES.OVER_UNDER.OVER,
            is_displayed: contract_type === TRADE_TYPES.OVER_UNDER,
        },
        {
            label: 'Under',
            value: TRADE_TYPES.OVER_UNDER,
            contract_type: CONTRACT_TYPES.OVER_UNDER.UNDER,
            is_displayed: contract_type === TRADE_TYPES.OVER_UNDER,
        },
        {
            label: 'Up',
            value: TRADE_TYPES.MULTIPLIER,
            contract_type: CONTRACT_TYPES.MULTIPLIER.UP,
            is_displayed: contract_type === TRADE_TYPES.MULTIPLIER,
        },
        {
            label: 'Down',
            value: TRADE_TYPES.MULTIPLIER,
            contract_type: CONTRACT_TYPES.MULTIPLIER.DOWN,
            is_displayed: contract_type === TRADE_TYPES.MULTIPLIER,
        },
    ];
    return tab_list.filter(({ is_displayed }) => is_displayed);
};

// The tab TradeTypeTabs defaults to on mount (matching contract_type, else the first tab).
export const getInitialTradeTypeTab = (contract_type = '') => {
    const tab_list = getTradeTypeTabsList(contract_type);
    if (!tab_list.length) return '';
    const index = tab_list.findIndex(tab => tab.value === contract_type);
    return tab_list[index < 0 ? 0 : index]?.contract_type ?? '';
};

export const isSmallScreen = () => window.innerHeight <= 640;

export const addUnit = ({
    value,
    unit = localize('min'),
    should_add_space = true,
}: {
    value: string | number;
    unit?: string;
    should_add_space?: boolean;
}) => `${typeof value === 'number' ? value : parseInt(value)}${should_add_space ? ' ' : ''}${unit}`;

export const getSnackBarText = ({
    has_cancellation,
    has_take_profit,
    has_stop_loss,
    switching_cancellation,
    switching_tp_sl,
}: {
    has_cancellation?: boolean;
    has_take_profit?: boolean;
    has_stop_loss?: boolean;
    switching_cancellation?: boolean;
    switching_tp_sl?: boolean;
}) => {
    if (switching_cancellation && has_cancellation) {
        if (has_take_profit && has_stop_loss) return <Localize i18n_default_text='TP and SL have been turned off.' />;
        if (has_take_profit) return <Localize i18n_default_text='TP has been turned off.' />;
        if (has_stop_loss) return <Localize i18n_default_text='SL has been turned off.' />;
    }
    if (switching_tp_sl && (has_take_profit || has_stop_loss) && has_cancellation)
        return <Localize i18n_default_text='DC has been turned off.' />;
};

export const getClosestTimeToCurrentGMT = (interval: number): string => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);

    const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
    };
    const formattedTime = new Intl.DateTimeFormat('en-GB', options).format(now);

    const [hours, minutes] = formattedTime.split(':').map(Number);

    const date = new Date();
    date.setUTCHours(hours);
    date.setUTCMinutes(minutes);

    const roundedMinutes = Math.ceil(date.getUTCMinutes() / interval) * interval;

    if (roundedMinutes >= 60) {
        date.setUTCHours(date.getUTCHours() + 1);
        date.setUTCMinutes(0);
    } else {
        date.setUTCMinutes(roundedMinutes);
    }

    const newHours = String(date.getUTCHours()).padStart(2, '0');
    const newMinutes = String(date.getUTCMinutes()).padStart(2, '0');

    return `${newHours}:${newMinutes}`;
};

// Single owner of the tick wheel's bounds — both the rendered options and the clamp applied when
// restoring a stored selection must agree on this range
export const getTickWheelRange = (duration_min_max: Record<string, { min: number; max: number }>) => ({
    min: Math.max(1, duration_min_max?.tick?.min ?? 1),
    max: Math.min(10, duration_min_max?.tick?.max ?? 10),
});

export const getTicksWheelOptions = (duration_min_max: Record<string, { min: number; max: number }>) => {
    const { min, max } = getTickWheelRange(duration_min_max);
    return Array.from({ length: max - min + 1 }, (_, index) => {
        const value = min + index;
        return { value, label: `${value} ${value === 1 ? localize('tick') : localize('ticks')}` };
    });
};

export const DURATION_TAB = {
    TICKS: DURATION_UNIT.TICKS,
    TIME: 'time',
    END_TIME: DURATION_UNIT.DAYS,
} as const;

// 3 rows. quill derives the selected index from `scrollTop / 48`, so keep this a multiple of 48.
export const WHEEL_PICKER_HEIGHT = '144px';

// Ordered coarse → fine; index in this array is the index in a [hours, minutes, seconds] selection
export const TIME_WHEEL_UNITS = [DURATION_UNIT.HOURS, DURATION_UNIT.MINUTES, DURATION_UNIT.SECONDS];

const TIME_WHEEL_UNIT_SECONDS: Record<string, number> = { h: 3600, m: 60, s: 1 };

export const getDurationTab = (duration_unit: string, has_expiry_time?: boolean) => {
    if (has_expiry_time || duration_unit === DURATION_UNIT.DAYS) return DURATION_TAB.END_TIME;
    if (duration_unit === DURATION_UNIT.TICKS) return DURATION_TAB.TICKS;
    return DURATION_TAB.TIME;
};

export const getTimeWheelVisibleUnits = (duration_units_list: { value: string }[] = []) => {
    const available_units = duration_units_list.map(({ value }) => value);
    return TIME_WHEEL_UNITS.filter(unit => available_units.includes(unit));
};

/**
 * Valid range for one column of the merged hr/min/sec wheel, given the values selected in the
 * coarser columns. The combined total (h*3600 + m*60 + s) always stays within intraday min/max:
 * finer columns can still reach the minimum (their max capacity counts towards it), and the
 * coarser prefix is subtracted from both bounds.
 */
export const getTimeWheelColumnRange = (
    unit: string,
    visible_units: string[],
    intraday: { min: number; max: number },
    selected: number[]
) => {
    const unit_seconds = TIME_WHEEL_UNIT_SECONDS[unit];
    const prefix_seconds = visible_units
        .filter(u => TIME_WHEEL_UNIT_SECONDS[u] > unit_seconds)
        .reduce((total, u) => total + (selected[TIME_WHEEL_UNITS.indexOf(u)] || 0) * TIME_WHEEL_UNIT_SECONDS[u], 0);
    const finer_capacity_seconds = visible_units
        .filter(u => TIME_WHEEL_UNIT_SECONDS[u] < unit_seconds)
        .reduce((total, u) => total + 59 * TIME_WHEEL_UNIT_SECONDS[u], 0);
    const natural_cap = unit === DURATION_UNIT.HOURS ? Math.floor(intraday.max / 3600) : 59;
    const min = Math.max(0, Math.ceil((intraday.min - prefix_seconds - finer_capacity_seconds) / unit_seconds));
    const max = Math.min(natural_cap, Math.floor((intraday.max - prefix_seconds) / unit_seconds));
    return { min, max: Math.max(min, max) };
};

/**
 * Full set of values rendered on one column of the merged hr/min/sec wheel. Bounds are static
 * (independent of the other columns' selections) so column identities stay stable while
 * scrolling: a value is rendered when it appears in at least one valid combination, e.g. seconds
 * render from 0 even when the intraday minimum is 15s. Combinations that end up below the
 * minimum (or above the maximum) snap back to the valid range once scrolling settles.
 */
export const getTimeWheelColumnOptions = (
    unit: string,
    visible_units: string[],
    intraday: { min: number; max: number }
) => {
    const getNaturalCap = (u: string) =>
        u === DURATION_UNIT.HOURS
            ? Math.floor(intraday.max / 3600)
            : Math.min(59, Math.floor(intraday.max / TIME_WHEEL_UNIT_SECONDS[u]));
    const others_capacity = visible_units
        .filter(u => u !== unit)
        .reduce((total, u) => total + getNaturalCap(u) * TIME_WHEEL_UNIT_SECONDS[u], 0);
    const min = Math.max(0, Math.ceil((intraday.min - others_capacity) / TIME_WHEEL_UNIT_SECONDS[unit]));
    const max = Math.max(min, getNaturalCap(unit));
    const unit_label = {
        [DURATION_UNIT.HOURS]: localize('hr'),
        [DURATION_UNIT.MINUTES]: localize('min'),
        [DURATION_UNIT.SECONDS]: localize('sec'),
    }[unit];
    return Array.from({ length: max - min + 1 }, (_, index) => {
        const value = min + index;
        return { value, label: `${value} ${unit_label}` };
    });
};

// Clamps coarse → fine so each finer range is computed against already-clamped coarser values
export const clampTimeWheelSelection = (
    visible_units: string[],
    intraday: { min: number; max: number },
    selected: number[]
) =>
    TIME_WHEEL_UNITS.reduce(
        (clamped, unit, index) => {
            if (!visible_units.includes(unit)) {
                clamped[index] = 0;
                return clamped;
            }
            const { min, max } = getTimeWheelColumnRange(unit, visible_units, intraday, clamped);
            clamped[index] = Math.min(max, Math.max(min, clamped[index] || 0));
            return clamped;
        },
        [...selected]
    );

/**
 * A selection with seconds can only be expressed in seconds; anything else is sent in minutes,
 * matching how production has always submitted hour-based durations (hours * 60 as minutes).
 * When minutes are not an offered unit (hours-only contracts), whole hours are sent as hours —
 * otherwise the validity check against duration_units_list would reject the commit.
 */
export const getDurationFromTimeWheelSelection = (
    [hours = 0, minutes = 0, seconds = 0]: number[],
    duration_units_list: { value: string }[] = []
) => {
    if (seconds > 0) {
        return { duration: hours * 3600 + minutes * 60 + seconds, duration_unit: DURATION_UNIT.SECONDS };
    }
    const available_units = duration_units_list.map(({ value }) => value);
    if (
        minutes === 0 &&
        hours > 0 &&
        !available_units.includes(DURATION_UNIT.MINUTES) &&
        available_units.includes(DURATION_UNIT.HOURS)
    ) {
        return { duration: hours, duration_unit: DURATION_UNIT.HOURS };
    }
    return { duration: hours * 60 + minutes, duration_unit: DURATION_UNIT.MINUTES };
};

export const getTimeWheelSelectionFromDuration = (duration: number, duration_unit: string): number[] => {
    if (duration_unit === DURATION_UNIT.SECONDS)
        return [Math.floor(duration / 3600), Math.floor((duration % 3600) / 60), duration % 60];
    if (duration_unit === DURATION_UNIT.MINUTES) return [Math.floor(duration / 60), duration % 60, 0];
    if (duration_unit === DURATION_UNIT.HOURS) return [duration, 0, 0];
    return [0, 0, 0];
};

/** Floor multiples used to top a short quick-pick row up to STAKE_PRESET_COUNT. Each rung is
 * rounded onto ROUND_STAKE_LADDER, so the list runs long to survive de-duplication. */
const STAKE_LADDER_MULTIPLIERS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20];

/** Round stake values per decade; dense so a rounded minimum stays near the raw one (34.06 -> 40). */
const ROUND_STAKE_LADDER = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Rounds a market minimum UP to the nearest round stake (6.5 -> 8); never below the input. */
export const roundUpToRoundStake = (min: number): number => {
    if (!Number.isFinite(min) || min <= 0) return min;

    const step = 10 ** Math.floor(Math.log10(min));
    // The fallback only guards against log10 float dust putting the step a decade too low.
    return ROUND_STAKE_LADDER.map(multiplier => step * multiplier).find(value => value >= min) ?? min;
};

/**
 * Default stake for a market: max(contracts_for default, rounded minimum) — valid markets keep
 * their default; a narrow [min, max] band the rounded value overshoots falls back to the raw min.
 * Returns undefined without a usable minimum. Also the quick-pick floor, so the default is always
 * the lowest chip offered.
 */
export const getDerivedDefaultStake = (
    api_default_stake?: number,
    min_stake?: number,
    max_stake?: number
): number | undefined => {
    if (!min_stake || !Number.isFinite(min_stake)) return undefined;

    const derived = Math.max(api_default_stake ?? 0, roundUpToRoundStake(min_stake));

    // A narrow min/max band can put the rounded value above the maximum, in which case the raw
    // minimum is the only value guaranteed to sit inside the band.
    if (max_stake && Number.isFinite(max_stake) && derived > max_stake) return min_stake;

    return derived;
};

/** Quick picks per row, on every market. */
export const STAKE_PRESET_COUNT = 6;

/**
 * Quick picks for a market: led by the derived-default floor, shared presets above it, capped at
 * the maximum, topped up with rounded floor multiples to STAKE_PRESET_COUNT. Ascending, no
 * repeats; the cap outranks the width. No floor -> no chips (callers hold the row with a
 * skeleton) — showing unfiltered presets first would rebuild the row when the limits land.
 */
export const getStakeLadderValues = (
    base_presets: number[],
    floor?: string | number,
    max_stake?: string | number
): number[] => {
    const min = Number(floor);
    if (!floor || !Number.isFinite(min) || min <= 0) return [];

    const max = Number(max_stake);
    const has_max = !!max_stake && Number.isFinite(max);
    const is_within_max = (value: number) => !has_max || value <= max;

    // Strictly above the floor, so a floor that is itself a preset is not offered twice.
    const with_floor = [min, ...base_presets.filter(preset => preset > min && is_within_max(preset))];

    // Top up from above with the spaced multiples of the floor, so the row keeps its width without
    // reordering or repeating any value the base presets already contributed. Each multiple is
    // rounded onto the round-stake ladder first — a raw multiple of an already-rounded floor is not
    // itself round (1.25 x 25 is 31.25), and a quick pick has to be a value a person would pick.
    const topped_up = STAKE_LADDER_MULTIPLIERS.reduce((ladder, multiplier) => {
        if (ladder.length >= STAKE_PRESET_COUNT) return ladder;

        const value = roundUpToRoundStake(min * multiplier);
        const is_above_offered = value > ladder[ladder.length - 1];
        return is_above_offered && is_within_max(value) ? [...ladder, value] : ladder;
    }, with_floor);

    return topped_up.slice(0, STAKE_PRESET_COUNT);
};

export const getSmallestDuration = (
    obj: { [x: string]: { min: number; max: number } | { min: number } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    durationUnits: any[]
) => {
    const keysPriority = ['tick', 'intraday', 'daily'];
    let smallestValueInSeconds = Infinity;
    let smallestUnit: 's' | 'm' | 'h' | 'd' | null = null;

    // eslint-disable-next-line no-restricted-syntax
    for (const key of keysPriority) {
        if (obj[key]) {
            if (key === 'tick') {
                const tickUnit = durationUnits.find((item: { value: string }) => item.value === 't');
                if (tickUnit) {
                    return { value: obj[key].min, unit: 't' };
                }
            }

            if (obj[key].min < smallestValueInSeconds) {
                smallestValueInSeconds = obj[key].min;

                if (key === 'intraday') {
                    if (smallestValueInSeconds < 60) {
                        smallestUnit = 's';
                    } else if (smallestValueInSeconds < 3600) {
                        smallestUnit = 'm';
                    } else if (smallestValueInSeconds < 86400) {
                        smallestUnit = 'h';
                    }
                } else if (key === 'daily') {
                    smallestUnit = 'd';
                }
            }
        }
    }

    if (smallestUnit) {
        const validUnit = durationUnits.find((item: { value: string; text: string }) => item.value === smallestUnit);
        if (validUnit) {
            let convertedValue;
            // Round up: durations are sent as integers, so 1.5m would truncate below the minimum.
            switch (smallestUnit) {
                case 's':
                    convertedValue = smallestValueInSeconds;
                    break;
                case 'm':
                    convertedValue = Math.ceil(smallestValueInSeconds / 60);
                    break;
                case 'h':
                    convertedValue = Math.ceil(smallestValueInSeconds / 3600);
                    break;
                case 'd':
                    convertedValue = Math.ceil(smallestValueInSeconds / 86400);
                    break;
                default:
                    convertedValue = 1;
            }
            return { value: convertedValue, unit: smallestUnit };
        }
    }

    return null;
};

/**
 * Returns the configured per-trade-type default duration if the current symbol supports it,
 * otherwise falls back to the smallest valid duration. Used on trade-type switch and as the
 * reset target when a persisted duration is invalid for the current contract constraints.
 */
export const getDefaultDuration = (
    contract_type: string,
    duration_min_max: Record<string, { min: number; max: number }>,
    duration_units_list: { value: string }[]
) => {
    const key = mapContractTypeToDurationPresetKey(contract_type);
    const preferred = key ? DEFAULT_DURATION[key] : undefined;

    if (preferred && isValidPersistedDuration(preferred.value, preferred.unit, duration_min_max, duration_units_list)) {
        return { value: preferred.value, unit: preferred.unit };
    }

    return getSmallestDuration(duration_min_max, duration_units_list);
};

export const getDatePickerStartDate = (
    duration_units_list: { value: string }[],
    server_time: Dayjs,
    start_time: string | null,
    duration_min_max: Record<string, { min: number; max: number }>
) => {
    const hasIntradayDurationUnit = (duration_units_list: { value: string }[]) => {
        return duration_units_list.some((unit: { value: string }) => ['m', 'h'].indexOf(unit.value) !== -1);
    };

    const setMinTime = (dateObj: Date, time?: string) => {
        const [hour, minute, second] = time ? time.split(':') : [0, 0, 0];
        dateObj?.setHours(Number(hour));
        dateObj?.setMinutes(Number(minute) || 0);
        dateObj?.setSeconds(Number(second) || 0);
        return dateObj;
    };

    const toDate = (value: string | number | Date | Dayjs): Date => {
        if (!value) return new Date();

        if (value instanceof Date && !isNaN(value.getTime())) {
            return value;
        }

        if (typeof value === 'number') {
            return new Date(value * 1000);
        }

        const parsedDate = new Date(value as Date);
        if (isNaN(parsedDate.getTime())) {
            const today = new Date();
            const daysInMonth = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, 0).getDate();
            const valueAsNumber = Date.parse(value as string) / (1000 * 60 * 60 * 24);
            return valueAsNumber > daysInMonth
                ? new Date(today.setUTCDate(today.getUTCDate() + Number(value)))
                : new Date(value as Date);
        }

        return parsedDate;
    };

    const getMinDuration = (server_time: string | number | Date | Dayjs, duration_units_list: { value: string }[]) => {
        const server_date = toDate(server_time);
        return hasIntradayDurationUnit(duration_units_list)
            ? new Date(server_date)
            : new Date(server_date.getTime() + (duration_min_max?.daily?.min || 0) * 1000);
    };

    const getDayjsContractStartDateTime = () => {
        const minDurationDate = getMinDuration(server_time, duration_units_list);
        const time = isTimeValid(start_time ?? '') ? start_time : (server_time?.toISOString().substr(11, 8) ?? '');
        return setMinTime(minDurationDate, time ?? '');
    };

    const min_date = new Date(getDayjsContractStartDateTime());
    return min_date;
};

/** `YYYY-MM-DD` in local terms — the shape the End time tab keeps its date in. */
export const toExpiryDateString = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const getProposalRequestObject = ({
    new_values = {},
    should_subscribe = false,
    trade_store,
    trade_type,
}: {
    new_values: Record<string, unknown>;
    should_subscribe?: boolean;
    trade_store: TTradeStore;
    trade_type: string;
}) => {
    const store = {
        ...trade_store,
        ...new_values,
    };

    const request = createProposalRequestForContract(
        store as Parameters<typeof createProposalRequestForContract>[0],
        trade_type
    ) as Omit<ReturnType<typeof createProposalRequestForContract>, 'subscribe'> & {
        subscribe?: number;
        limit_order:
            | {
                  take_profit?: number;
                  stop_loss?: number;
              }
            | undefined;
    };

    if (!should_subscribe) delete request.subscribe;

    return request;
};

export const getPayoutInfo = (proposal_info: ReturnType<typeof getProposalInfo>) => {
    // getting current payout
    const { has_error, message = '', payout = 0, error_field } = proposal_info ?? {};
    const float_number_search_regex = /\d+(\.\d+)?/g;
    const is_error_matching = has_error && (error_field === 'amount' || error_field === 'stake');
    const proposal_error_message = is_error_matching ? message : '';
    /* TODO: stop using error text for getting the payout value, need API changes */
    // Extracting the value of exceeded payout from error text
    const error_payout = proposal_error_message
        ? Number(proposal_error_message.match(float_number_search_regex)?.[2])
        : 0;
    const contract_payout = payout || error_payout;

    // getting max allowed payout
    const { payout: validation_payout } = (proposal_info?.validation_params || proposal_info?.validation_params) ?? {};
    const { max } = validation_payout ?? {};
    /* TODO: stop using error text for getting the max payout value, need API changes */
    // Extracting the value of max payout from error text
    const error_max_payout = is_error_matching && message ? Number(message.match(float_number_search_regex)?.[1]) : 0;
    const max_payout = max || error_max_payout;

    return { contract_payout, max_payout, error: proposal_error_message };
};

/**
 * Gets the correct proposal info key for accessing payout data based on contract type and trade type tab
 * For Higher/Lower contracts, maps CALL→HIGHER and PUT→LOWER
 * For other contracts, returns the trade_type_tab directly
 * @param proposal_info - The proposal info object containing contract data
 * @param trade_type_tab - The current trade type tab (CALL, PUT, etc.)
 * @param contract_type - The contract type (HIGH_LOW, RISE_FALL, etc.)
 * @returns The correct key to access proposal_info data
 */
export const getProposalInfoKey = (
    proposal_info: Record<string, any>,
    trade_type_tab: string,
    contract_type: string
): string => {
    const proposal_info_keys = Object.keys(proposal_info);
    const hasHigherLowerKeys = proposal_info_keys.includes('HIGHER') && proposal_info_keys.includes('LOWER');
    const hasCallPutKeys = proposal_info_keys.includes('CALL') && proposal_info_keys.includes('PUT');

    // For Higher/Lower contracts, map CALL→HIGHER and PUT→LOWER when API returns HIGHER/LOWER keys
    if (contract_type === TRADE_TYPES.HIGH_LOW && hasHigherLowerKeys && !hasCallPutKeys) {
        if (trade_type_tab === 'CALL') return 'HIGHER';
        if (trade_type_tab === 'PUT') return 'LOWER';
    }

    // For all other cases, return the trade_type_tab directly
    return trade_type_tab;
};

/**
 * Validates if persisted duration values are compatible with current contract constraints
 * @param duration - The persisted duration value
 * @param duration_unit - The persisted duration unit
 * @param duration_min_max - Current contract duration constraints
 * @param duration_units_list - Available duration units for current contract
 * @returns boolean indicating if persisted values are valid and compatible
 */
export const isValidPersistedDuration = (
    duration: number | null | undefined,
    duration_unit: string | null | undefined,
    duration_min_max: Record<string, { min: number; max: number }> | undefined,
    duration_units_list: { value: string }[] | undefined
): boolean => {
    // Check if basic values exist
    if (!duration || !duration_unit || !duration_min_max || !duration_units_list) {
        return false;
    }

    // Check if the duration unit is available for current contract
    const isUnitAvailable = duration_units_list.some(unit => unit.value === duration_unit);
    if (!isUnitAvailable) {
        return false;
    }

    // Validate against appropriate constraint category based on duration unit
    if (duration_unit === 't') {
        // For ticks, validate directly against tick constraints
        if (duration_min_max.tick) {
            return duration >= duration_min_max.tick.min && duration <= duration_min_max.tick.max;
        }
        return false;
    }

    // Convert duration to seconds for time-based units
    let durationInSeconds: number;
    switch (duration_unit) {
        case 's': // seconds
            durationInSeconds = duration;
            break;
        case 'm': // minutes
            durationInSeconds = duration * 60;
            break;
        case 'h': // hours
            durationInSeconds = duration * 3600;
            break;
        case 'd': // days
            durationInSeconds = duration * 86400;
            break;
        default:
            return false;
    }

    // Validate time-based durations against appropriate constraints
    if (['s', 'm', 'h'].includes(duration_unit) && duration_min_max.intraday) {
        return durationInSeconds >= duration_min_max.intraday.min && durationInSeconds <= duration_min_max.intraday.max;
    } else if (duration_unit === 'd' && duration_min_max.daily) {
        return durationInSeconds >= duration_min_max.daily.min && durationInSeconds <= duration_min_max.daily.max;
    }

    return false;
};
