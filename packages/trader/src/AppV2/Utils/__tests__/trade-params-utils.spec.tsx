import React from 'react';

import { CONTRACT_TYPES, dayjs, TRADE_TYPES } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TRADE_PARAMETER_PRESETS } from 'AppV2/Config/trade-parameter-presets';
import { getProposalInfo } from 'Stores/Modules/Trading/Helpers/proposal';

import {
    addUnit,
    clampTimeWheelSelection,
    DURATION_TAB,
    focusAndOpenKeyboard,
    getDatePickerStartDate,
    getDefaultDuration,
    getDerivedDefaultStake,
    getDurationFromTimeWheelSelection,
    getDurationTab,
    getPayoutInfo,
    getProposalRequestObject,
    getSmallestDuration,
    getSnackBarText,
    getStakeLadderValues,
    getTicksWheelOptions,
    getTickWheelRange,
    getTimeWheelColumnOptions,
    getTimeWheelColumnRange,
    getTimeWheelSelectionFromDuration,
    getTimeWheelVisibleUnits,
    getTradeParams,
    getTradeTypeTabsList,
    isDigitContractWinning,
    isSmallScreen,
    roundUpToRoundStake,
} from '../trade-params-utils';

describe('getTradeParams', () => {
    it('should return correct object with keys for Rise/Fall', () => {
        expect(getTradeParams()[TRADE_TYPES.RISE_FALL]).toEqual({
            trade_type_tabs: true,
            duration: true,
            stake: true,
            allow_equals: true,
        });
    });

    it('should return correct object with keys for Multipliers if symbol does not start with "cry"', () => {
        expect(getTradeParams()[TRADE_TYPES.MULTIPLIER]).toEqual({
            trade_type_tabs: true,
            multiplier: true,
            stake: true,
            risk_management: true,
            multipliers_info: true,
        });
    });

    it('should return correct object with keys for Multipliers if symbol starts with "cry"', () => {
        expect(getTradeParams('crypto')[TRADE_TYPES.MULTIPLIER]).toEqual({
            trade_type_tabs: true,
            multiplier: true,
            stake: true,
            risk_management: true,
            multipliers_info: true,
            expiration: true,
        });
    });
});

describe('isDigitContractWinning', () => {
    it('should return false if contract_type is not defined', () => {
        expect(isDigitContractWinning(undefined, null, null)).toBeFalsy();
    });

    it('should return false if contract_type is not digit type', () => {
        expect(isDigitContractWinning(CONTRACT_TYPES.TURBOS.LONG, null, null)).toBeFalsy();
    });

    it('should return true for Matches if current_digit === selected_digit and false if they are not equal', () => {
        expect(isDigitContractWinning(CONTRACT_TYPES.MATCH_DIFF.MATCH, 1, 1)).toBeTruthy();
        expect(isDigitContractWinning(CONTRACT_TYPES.MATCH_DIFF.MATCH, 1, 2)).toBeFalsy();
    });

    it('should return true for Differs if current_digit !== selected_digit and false if they are equal', () => {
        expect(isDigitContractWinning(CONTRACT_TYPES.MATCH_DIFF.DIFF, 1, 1)).toBeFalsy();
        expect(isDigitContractWinning(CONTRACT_TYPES.MATCH_DIFF.DIFF, 1, 2)).toBeTruthy();
    });

    it('should return true for Over if current_digit and selected_digit are not null and current_digit > selected_digit. In the rest cases should return false', () => {
        expect(isDigitContractWinning(CONTRACT_TYPES.OVER_UNDER.OVER, 1, 2)).toBeTruthy();
        expect(isDigitContractWinning(CONTRACT_TYPES.OVER_UNDER.OVER, null, null)).toBeFalsy();
        expect(isDigitContractWinning(CONTRACT_TYPES.OVER_UNDER.OVER, 0, 0)).toBeFalsy();
        expect(isDigitContractWinning(CONTRACT_TYPES.OVER_UNDER.OVER, 2, 1)).toBeFalsy();
        expect(isDigitContractWinning(CONTRACT_TYPES.OVER_UNDER.OVER, 2, 2)).toBeFalsy();
    });

    it('should return true for Under if current_digit and selected_digit are not null and current_digit < selected_digit. In the rest cases should return false', () => {
        expect(isDigitContractWinning(CONTRACT_TYPES.OVER_UNDER.UNDER, 2, 1)).toBeTruthy();
        expect(isDigitContractWinning(CONTRACT_TYPES.OVER_UNDER.UNDER, null, null)).toBeFalsy();
        expect(isDigitContractWinning(CONTRACT_TYPES.OVER_UNDER.UNDER, 0, 0)).toBeFalsy();
        expect(isDigitContractWinning(CONTRACT_TYPES.OVER_UNDER.UNDER, 1, 2)).toBeFalsy();
        expect(isDigitContractWinning(CONTRACT_TYPES.OVER_UNDER.UNDER, 2, 2)).toBeFalsy();
    });

    it('should return true for Odd if current_digit is not null and it has an odd value', () => {
        expect(isDigitContractWinning(CONTRACT_TYPES.EVEN_ODD.ODD, null, 1)).toBeTruthy();
        expect(isDigitContractWinning(CONTRACT_TYPES.EVEN_ODD.ODD, null, null)).toBeFalsy();
        expect(isDigitContractWinning(CONTRACT_TYPES.EVEN_ODD.ODD, null, 2)).toBeFalsy();
        expect(isDigitContractWinning(CONTRACT_TYPES.EVEN_ODD.ODD, null, 0)).toBeFalsy();
    });

    it('should return true for Even if current_digit is not null and it has an even value or 0', () => {
        expect(isDigitContractWinning(CONTRACT_TYPES.EVEN_ODD.EVEN, null, 2)).toBeTruthy();
        expect(isDigitContractWinning(CONTRACT_TYPES.EVEN_ODD.EVEN, null, 0)).toBeTruthy();
        expect(isDigitContractWinning(CONTRACT_TYPES.EVEN_ODD.EVEN, null, null)).toBeFalsy();
        expect(isDigitContractWinning(CONTRACT_TYPES.EVEN_ODD.EVEN, null, 1)).toBeFalsy();
    });
});

describe('focusAndOpenKeyboard', () => {
    it('should apply focus to the passed ReactElement', async () => {
        const user = userEvent.setup({ delay: null });
        jest.useFakeTimers();

        const MockComponent = () => {
            const input_ref = React.useRef<HTMLInputElement>(null);
            const focused_input_ref = React.useRef<HTMLInputElement>(null);

            return (
                <React.Fragment>
                    <input type='number' ref={input_ref} />
                    <button onClick={() => focusAndOpenKeyboard(focused_input_ref.current, input_ref.current)}>
                        Focus
                    </button>
                    <input ref={focused_input_ref} style={{ height: 0, opacity: 0, display: 'none' }} />
                </React.Fragment>
            );
        };

        render(<MockComponent />);

        const input = screen.getByRole('spinbutton');
        expect(input).not.toHaveFocus();

        await user.click(screen.getByText('Focus'));

        jest.runAllTimers();

        expect(input).toHaveFocus();
    });
});

describe('getTradeTypeTabsList', () => {
    it('should return correct tabs list for Turbos', () => {
        expect(getTradeTypeTabsList(TRADE_TYPES.TURBOS.SHORT)).toEqual([
            {
                label: 'Up',
                value: TRADE_TYPES.TURBOS.LONG,
                contract_type: CONTRACT_TYPES.TURBOS.LONG,
                is_displayed: true,
            },
            {
                label: 'Down',
                value: TRADE_TYPES.TURBOS.SHORT,
                contract_type: CONTRACT_TYPES.TURBOS.SHORT,
                is_displayed: true,
            },
        ]);
    });

    it('should return correct tabs list for Vanillas', () => {
        expect(getTradeTypeTabsList(TRADE_TYPES.VANILLA.CALL)).toEqual([
            {
                label: 'Call',
                value: TRADE_TYPES.VANILLA.CALL,
                contract_type: CONTRACT_TYPES.VANILLA.CALL,
                is_displayed: true,
            },
            {
                label: 'Put',
                value: TRADE_TYPES.VANILLA.PUT,
                contract_type: CONTRACT_TYPES.VANILLA.PUT,
                is_displayed: true,
            },
        ]);
    });

    it('should return correct tabs list for Higher/Lower', () => {
        expect(getTradeTypeTabsList(TRADE_TYPES.HIGH_LOW)).toEqual([
            {
                label: 'Higher',
                value: TRADE_TYPES.HIGH_LOW,
                contract_type: CONTRACT_TYPES.HIGHER,
                is_displayed: true,
            },
            {
                label: 'Lower',
                value: TRADE_TYPES.HIGH_LOW,
                contract_type: CONTRACT_TYPES.LOWER,
                is_displayed: true,
            },
        ]);
    });

    it('should return correct tabs list for Touch/No Touch', () => {
        expect(getTradeTypeTabsList(TRADE_TYPES.TOUCH)).toEqual([
            {
                label: 'Touch',
                value: TRADE_TYPES.TOUCH,
                contract_type: CONTRACT_TYPES.TOUCH.ONE_TOUCH,
                is_displayed: true,
            },
            {
                label: 'No Touch',
                value: TRADE_TYPES.TOUCH,
                contract_type: CONTRACT_TYPES.TOUCH.NO_TOUCH,
                is_displayed: true,
            },
        ]);
    });
});

describe('isSmallScreen', () => {
    const original_height = window.innerHeight;

    it('should return true if window.innerHeight is less or equal to 640', () => {
        window.innerHeight = 640;
        expect(isSmallScreen()).toBe(true);
    });

    it('should return false if window.innerHeight is more than 640', () => {
        window.innerHeight = 700;
        expect(isSmallScreen()).toBe(false);
    });

    window.innerHeight = original_height;
});

describe('addUnit', () => {
    it('should return correct string', () => {
        expect(addUnit({ value: 30 })).toBe('30 min');
        expect(addUnit({ value: '15' })).toBe('15 min');
        expect(addUnit({ value: '15', unit: 'minutes' })).toBe('15 minutes');
        expect(addUnit({ value: '15', unit: 'm', should_add_space: false })).toBe('15m');
    });
});

describe('getSnackBarText', () => {
    it('should return correct string if switching_cancellation, has_cancellation, has_take_profit and has_stop_loss are true', () => {
        render(
            <div>
                {getSnackBarText({
                    has_cancellation: true,
                    has_take_profit: true,
                    has_stop_loss: true,
                    switching_cancellation: true,
                })}
            </div>
        );

        expect(screen.getByText('TP and SL have been turned off.')).toBeInTheDocument();
    });

    it('should return correct string if switching_cancellation === true, has_cancellation === true, has_take_profit === true and has_stop_loss === false', () => {
        render(
            <div>
                {getSnackBarText({
                    has_cancellation: true,
                    has_take_profit: true,
                    has_stop_loss: false,
                    switching_cancellation: true,
                })}
            </div>
        );

        expect(screen.getByText('TP has been turned off.')).toBeInTheDocument();
    });

    it('should return correct string if switching_cancellation === true, has_cancellation === true, has_take_profit === false and has_stop_loss === true', () => {
        render(
            <div>
                {getSnackBarText({
                    has_cancellation: true,
                    has_take_profit: false,
                    has_stop_loss: true,
                    switching_cancellation: true,
                })}
            </div>
        );

        expect(screen.getByText('SL has been turned off.')).toBeInTheDocument();
    });

    it('should return correct string if switching_tp_sl === true, has_cancellation === true, has_take_profit === true and has_stop_loss === false', () => {
        render(
            <div>
                {getSnackBarText({
                    has_cancellation: true,
                    has_take_profit: true,
                    has_stop_loss: false,
                    switching_tp_sl: true,
                })}
            </div>
        );

        expect(screen.getByText('DC has been turned off.')).toBeInTheDocument();
    });

    it('should return correct string if switching_tp_sl === true, has_cancellation === true, has_take_profit === false and has_stop_loss === true', () => {
        render(
            <div>
                {getSnackBarText({
                    has_cancellation: true,
                    has_take_profit: false,
                    has_stop_loss: true,
                    switching_tp_sl: true,
                })}
            </div>
        );

        expect(screen.getByText('DC has been turned off.')).toBeInTheDocument();
    });
});

describe('getTickWheelRange', () => {
    it('should clamp the contract tick limits to the wheel bounds 1..10', () => {
        expect(getTickWheelRange({ tick: { min: 5, max: 10 } })).toEqual({ min: 5, max: 10 });
        expect(getTickWheelRange({ tick: { min: 0, max: 25 } })).toEqual({ min: 1, max: 10 });
    });

    it('should fall back to 1..10 when tick limits are missing', () => {
        expect(getTickWheelRange({})).toEqual({ min: 1, max: 10 });
    });
});

describe('getTicksWheelOptions', () => {
    it('should return labelled options across the full tick range', () => {
        const options = getTicksWheelOptions({ tick: { min: 1, max: 10 } });
        expect(options).toHaveLength(10);
        expect(options[0]).toEqual({ value: 1, label: '1 tick' });
        expect(options[9]).toEqual({ value: 10, label: '10 ticks' });
    });

    it('should start from the contract minimum', () => {
        const options = getTicksWheelOptions({ tick: { min: 5, max: 10 } });
        expect(options.map(({ label }) => label)).toEqual([
            '5 ticks',
            '6 ticks',
            '7 ticks',
            '8 ticks',
            '9 ticks',
            '10 ticks',
        ]);
    });
});

describe('getSmallestDuration', () => {
    const durationUnits = [
        { value: 's', text: 'Seconds' },
        { value: 'm', text: 'Minutes' },
        { value: 'h', text: 'Hours' },
        { value: 'd', text: 'Days' },
        { value: 't', text: 'Ticks' },
    ];

    it('should return tick duration when "tick" exists in object', () => {
        const obj = { tick: { min: 5 } };
        const result = getSmallestDuration(obj, durationUnits);
        expect(result).toEqual({ value: 5, unit: 't' });
    });

    it('should return the smallest intraday duration in minutes', () => {
        const obj = { intraday: { min: 300 } };
        const result = getSmallestDuration(obj, durationUnits);
        expect(result).toEqual({ value: 5, unit: 'm' });
    });

    it('should return the smallest intraday duration in hours', () => {
        const obj = { intraday: { min: 7200 } };
        const result = getSmallestDuration(obj, durationUnits);
        expect(result).toEqual({ value: 2, unit: 'h' });
    });

    it('should return the smallest daily duration', () => {
        const obj = { daily: { min: 86400 } };
        const result = getSmallestDuration(obj, durationUnits);
        expect(result).toEqual({ value: 1, unit: 'd' });
    });

    it('should return null if no valid smallest unit is found', () => {
        const obj = {};
        const result = getSmallestDuration(obj, durationUnits);
        expect(result).toBeNull();
    });

    it('should return seconds for a sub-minute intraday minimum when no tick unit exists', () => {
        const obj = { intraday: { min: 30 } };
        const no_tick_units = durationUnits.filter(({ value }) => value !== 't');
        const result = getSmallestDuration(obj, no_tick_units);
        expect(result).toEqual({ value: 30, unit: 's' });
    });

    it('should round a non-whole-unit minimum up so the integer duration stays valid', () => {
        // 90s min: 1.5m would be truncated to 1m (below minimum) by the proposal's parseInt.
        const obj = { intraday: { min: 90 } };
        const result = getSmallestDuration(
            obj,
            durationUnits.filter(({ value }) => value !== 't')
        );
        expect(result).toEqual({ value: 2, unit: 'm' });
    });
});

describe('getDefaultDuration', () => {
    const tick_units = [
        { value: 't', text: 'Ticks' },
        { value: 'm', text: 'Minutes' },
    ];
    const tick_min_max = { tick: { min: 1, max: 10 }, intraday: { min: 60, max: 86400 } };

    it('returns the configured tick default for Rise/Fall when the symbol supports it', () => {
        expect(getDefaultDuration(TRADE_TYPES.RISE_FALL, tick_min_max, tick_units)).toEqual({ value: 5, unit: 't' });
    });

    it('returns 10 ticks for Higher/Lower', () => {
        expect(getDefaultDuration(TRADE_TYPES.HIGH_LOW, tick_min_max, tick_units)).toEqual({ value: 10, unit: 't' });
    });

    it('returns 10 ticks for Touch/No Touch', () => {
        expect(getDefaultDuration(TRADE_TYPES.TOUCH, tick_min_max, tick_units)).toEqual({ value: 10, unit: 't' });
    });

    it('returns 2 ticks for all Digits sub-types', () => {
        expect(getDefaultDuration(TRADE_TYPES.MATCH_DIFF, tick_min_max, tick_units)).toEqual({ value: 2, unit: 't' });
        expect(getDefaultDuration(TRADE_TYPES.EVEN_ODD, tick_min_max, tick_units)).toEqual({ value: 2, unit: 't' });
        expect(getDefaultDuration(TRADE_TYPES.OVER_UNDER, tick_min_max, tick_units)).toEqual({ value: 2, unit: 't' });
    });

    it('returns 1 minute for Vanillas', () => {
        expect(getDefaultDuration(TRADE_TYPES.VANILLA.CALL, tick_min_max, tick_units)).toEqual({ value: 1, unit: 'm' });
    });

    it('returns 10 ticks for Turbos', () => {
        expect(getDefaultDuration(TRADE_TYPES.TURBOS.LONG, tick_min_max, tick_units)).toEqual({ value: 10, unit: 't' });
    });

    it('falls back to the smallest duration when the preferred unit is unavailable', () => {
        const no_tick_units = [{ value: 'm', text: 'Minutes' }];
        const min_max = { intraday: { min: 900, max: 86400 } }; // 15 min minimum, no ticks
        expect(getDefaultDuration(TRADE_TYPES.RISE_FALL, min_max, no_tick_units)).toEqual({ value: 15, unit: 'm' });
    });

    it('falls back to the smallest duration for an unmapped contract type', () => {
        expect(getDefaultDuration(TRADE_TYPES.ACCUMULATOR, tick_min_max, tick_units)).toEqual({ value: 1, unit: 't' });
    });
});

describe('getDatePickerStartDate', () => {
    const duration_min_max = {
        daily: { min: 86400, max: 172800 },
    };

    const durationUnits = [
        { value: 'm', text: 'Minutes' },
        { value: 'h', text: 'Hours' },
        { value: 'd', text: 'Days' },
    ];

    beforeAll(() => {
        // dayjs calls `new Date()` internally rather than `Date.now()`, so a `Date.now` spy
        // alone won't freeze its clock. `jest.useFakeTimers().setSystemTime(...)` freezes both.
        jest.useFakeTimers().setSystemTime(new Date('2024-10-08T08:00:00Z'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it('should return the minimum date considering intraday duration', () => {
        const start_time = null;
        const result = getDatePickerStartDate(durationUnits, dayjs(), start_time, duration_min_max);
        expect(result).toBeInstanceOf(Date);
        expect(result.toISOString()).toContain('2024-10-08');
    });

    it('should set the correct time when a start time is provided', () => {
        const start_time = '12:30:00';
        const result = getDatePickerStartDate(durationUnits, dayjs(), start_time, duration_min_max);
        expect(result).toBeInstanceOf(Date);
        expect(result.getHours()).toBe(12);
        expect(result.getMinutes()).toBe(30);
    });

    it('should add min duration to the current time when no intraday duration exists', () => {
        const nonIntradayUnits = [{ value: 'd', text: 'Days' }];
        const result = getDatePickerStartDate(nonIntradayUnits, dayjs(), null, duration_min_max);
        expect(result).toBeInstanceOf(Date);
        expect(result.toISOString()).toContain('2024-10-09');
    });
});

describe('getProposalRequestObject', () => {
    const trade = mockStore({}).modules.trade;

    const trade_store = {
        ...trade,
        onChange: jest.fn(),
        duration: 30,
        duration_unit: 'm',
        expiry_type: 'duration',
        symbol: 'R_100',
    };

    const new_values = {
        duration: '10t',
        amount: 20,
    };

    it('should merge new values into trade_store and create a proposal request object', () => {
        const result = getProposalRequestObject({
            new_values,
            trade_store,
            trade_type: 'CALL',
        });
        expect(result).toEqual(
            expect.objectContaining({
                amount: 20,
                basis: '',
                contract_type: 'CALL',
                currency: '',
                duration: 10,
                duration_unit: 'm',
                limit_order: undefined,
                proposal: 1,
                underlying_symbol: 'R_100',
            })
        );
    });

    it('should include subscribe field when should_subscribe is true', () => {
        const result = getProposalRequestObject({
            new_values,
            should_subscribe: true,
            trade_store,
            trade_type: 'CALL',
        });
        expect(result.subscribe).toBe(1);
    });

    it('should not include subscribe field when should_subscribe is false', () => {
        const result = getProposalRequestObject({
            new_values,
            should_subscribe: false,
            trade_store,
            trade_type: 'CALL',
        });
        expect(result.subscribe).toBeUndefined();
    });
});

describe('getProposalRequestObject', () => {
    let default_mock_store: ReturnType<typeof mockStore>, mocked_args: Parameters<typeof getProposalRequestObject>[0];

    beforeEach(() => {
        default_mock_store = mockStore({
            modules: {
                trade: {
                    ...mockStore({}).modules.trade,
                    amount: '10',
                    basis: 'stake',
                    currency: 'USD',
                    contract_type: TRADE_TYPES.TURBOS.LONG,
                    symbol: '1HZ100V',
                    duration: 5,
                    duration_unit: 'm',
                    expiry_type: 'duration',
                    payout_per_point: 5,
                },
            },
        });
        mocked_args = {
            new_values: {
                has_take_profit: true,
                take_profit: '5',
            },
            trade_store: default_mock_store.modules.trade,
            trade_type: TRADE_TYPES.TURBOS.LONG,
        };
    });

    it('should return correct object for proposal for Turbos with TP', () => {
        expect(getProposalRequestObject(mocked_args)).toEqual({
            proposal: 1,
            amount: 10,
            basis: 'stake',
            contract_type: TRADE_TYPES.TURBOS.LONG,
            currency: 'USD',
            underlying_symbol: '1HZ100V',
            duration: 5,
            duration_unit: 'm',
            payout_per_point: 5,
            limit_order: { take_profit: 5 },
        });
    });

    it('should return correct object for proposal for Turbos without TP', () => {
        mocked_args.new_values.has_take_profit = false;
        mocked_args.new_values.take_profit = '';

        expect(getProposalRequestObject(mocked_args)).toEqual({
            proposal: 1,
            amount: 10,
            basis: 'stake',
            contract_type: TRADE_TYPES.TURBOS.LONG,
            currency: 'USD',
            underlying_symbol: '1HZ100V',
            duration: 5,
            duration_unit: 'm',
            payout_per_point: 5,
            limit_order: undefined,
        });
    });

    it('should return correct object for proposal for Multipliers with SL', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.MULTIPLIER;
        mocked_args = {
            new_values: {
                has_stop_loss: true,
                stop_loss: '5',
            },
            trade_store: default_mock_store.modules.trade,
            trade_type: TRADE_TYPES.MULTIPLIER,
        };

        expect(getProposalRequestObject(mocked_args)).toEqual({
            proposal: 1,
            amount: 10,
            basis: 'stake',
            contract_type: 'multiplier',
            currency: 'USD',
            underlying_symbol: '1HZ100V',
            limit_order: { stop_loss: 5 },
            multiplier: 0,
            cancellation: undefined,
        });
    });

    it('should return correct object for proposal for Multipliers with SL if user have not typed anything', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.MULTIPLIER;
        mocked_args = {
            new_values: {
                has_stop_loss: true,
                stop_loss: '1',
            },
            trade_store: default_mock_store.modules.trade,
            trade_type: TRADE_TYPES.MULTIPLIER,
        };

        expect(getProposalRequestObject(mocked_args)).toEqual({
            proposal: 1,
            amount: 10,
            basis: 'stake',
            contract_type: 'multiplier',
            currency: 'USD',
            underlying_symbol: '1HZ100V',
            limit_order: { stop_loss: 1 },
            multiplier: 0,
            cancellation: undefined,
        });
    });

    it('should return correct object for proposal for Multipliers with SL if should_subscribe === true', () => {
        default_mock_store.modules.trade.contract_type = TRADE_TYPES.MULTIPLIER;
        mocked_args = {
            new_values: {
                has_stop_loss: true,
                stop_loss: '5',
            },
            should_subscribe: true,
            trade_store: default_mock_store.modules.trade,
            trade_type: TRADE_TYPES.MULTIPLIER,
        };

        expect(getProposalRequestObject(mocked_args)).toEqual({
            proposal: 1,
            subscribe: 1,
            amount: 10,
            basis: 'stake',
            contract_type: 'multiplier',
            currency: 'USD',
            underlying_symbol: '1HZ100V',
            limit_order: { stop_loss: 5 },
            multiplier: 0,
            cancellation: undefined,
        });
    });
});

describe('getPayoutInfo', () => {
    it('returns contract payout, max payout and empty string instead of error if proposal does not contain error', () => {
        const proposal_info = {
            has_error: false,
            has_error_details: false,
            payout: 19.53,
            profit: '9.53',
            stake: '10.00',
            validation_params: {
                payout: {
                    max: '80000.00',
                },
                stake: {
                    min: '0.50',
                },
            },
        } as ReturnType<typeof getProposalInfo>;

        expect(getPayoutInfo(proposal_info)).toEqual({ contract_payout: 19.53, max_payout: '80000.00', error: '' });
    });

    it('returns contract payout, max payout equal to 0 if proposal_info was empty', () => {
        expect(getPayoutInfo({} as ReturnType<typeof getProposalInfo>)).toEqual({
            contract_payout: 0,
            max_payout: 0,
            error: '',
        });
    });

    it('returns contract payout, max payout equal to 0 if proposal_info was not defined', () => {
        expect(getPayoutInfo(undefined as unknown as ReturnType<typeof getProposalInfo>)).toEqual({
            contract_payout: 0,
            max_payout: 0,
            error: '',
        });
    });

    it('returns contract payout and max payout values, extracted from error text if it is in proposal_info and has amount field', () => {
        const proposal_info = {
            id: '',
            has_error: true,
            has_error_details: true,
            error_code: 'ContractBuyValidationError',
            error_field: 'amount',
            message: 'Minimum stake of 0.35 and maximum payout of 5000.00. Current payout is 31263.39.',
        };

        expect(getPayoutInfo(proposal_info as ReturnType<typeof getProposalInfo>)).toEqual({
            contract_payout: 31263.39,
            max_payout: 5000,
            error: 'Minimum stake of 0.35 and maximum payout of 5000.00. Current payout is 31263.39.',
        });
    });

    it('returns contract payout and max payout values, extracted from error text if it is in proposal_info and has stake field', () => {
        const proposal_info = {
            id: '',
            has_error: true,
            has_error_details: true,
            error_code: 'ContractBuyValidationError',
            error_field: 'stake',
            message: 'Minimum stake of 0.35 and maximum payout of 5000.00. Current payout is 31263.39.',
        };

        expect(getPayoutInfo(proposal_info as ReturnType<typeof getProposalInfo>)).toEqual({
            contract_payout: 31263.39,
            max_payout: 5000,
            error: 'Minimum stake of 0.35 and maximum payout of 5000.00. Current payout is 31263.39.',
        });
    });
});

describe('getDurationTab', () => {
    it('should return the End time tab when an expiry time is set', () => {
        expect(getDurationTab('s', true)).toBe(DURATION_TAB.END_TIME);
    });

    it('should return the End time tab for the days unit', () => {
        expect(getDurationTab('d')).toBe(DURATION_TAB.END_TIME);
    });

    it('should return the Ticks tab for the ticks unit', () => {
        expect(getDurationTab('t')).toBe(DURATION_TAB.TICKS);
    });

    it('should return the Time tab for intraday units', () => {
        expect(getDurationTab('s')).toBe(DURATION_TAB.TIME);
        expect(getDurationTab('m')).toBe(DURATION_TAB.TIME);
        expect(getDurationTab('h')).toBe(DURATION_TAB.TIME);
    });
});

describe('getTimeWheelVisibleUnits', () => {
    it('should return h, m and s in coarse-to-fine order when all are available', () => {
        expect(
            getTimeWheelVisibleUnits([{ value: 's' }, { value: 't' }, { value: 'm' }, { value: 'h' }, { value: 'd' }])
        ).toEqual(['h', 'm', 's']);
    });

    it('should exclude units that are not available', () => {
        expect(getTimeWheelVisibleUnits([{ value: 'm' }, { value: 'h' }, { value: 'd' }])).toEqual(['h', 'm']);
        expect(getTimeWheelVisibleUnits([{ value: 't' }, { value: 'd' }])).toEqual([]);
    });

    it('should return an empty array for an empty or missing list', () => {
        expect(getTimeWheelVisibleUnits([])).toEqual([]);
        expect(getTimeWheelVisibleUnits()).toEqual([]);
    });
});

describe('getTimeWheelColumnRange', () => {
    const all_units = ['h', 'm', 's'];
    const intraday = { min: 15, max: 86400 };

    it('should allow the full hour range since finer columns can reach the minimum', () => {
        expect(getTimeWheelColumnRange('h', all_units, intraday, [0, 0, 15])).toEqual({ min: 0, max: 24 });
    });

    it('should restrict seconds to the intraday minimum when hours and minutes are 0', () => {
        expect(getTimeWheelColumnRange('s', all_units, intraday, [0, 0, 15])).toEqual({ min: 15, max: 59 });
    });

    it('should allow all seconds once a coarser column already covers the minimum', () => {
        expect(getTimeWheelColumnRange('s', all_units, intraday, [0, 1, 0])).toEqual({ min: 0, max: 59 });
        expect(getTimeWheelColumnRange('s', all_units, intraday, [1, 0, 0])).toEqual({ min: 0, max: 59 });
    });

    it('should collapse minutes and seconds to 0 at the maximum hour', () => {
        expect(getTimeWheelColumnRange('m', all_units, intraday, [24, 0, 0])).toEqual({ min: 0, max: 0 });
        expect(getTimeWheelColumnRange('s', all_units, intraday, [24, 0, 0])).toEqual({ min: 0, max: 0 });
    });

    it('should raise the minimum hour when finer columns cannot reach the intraday minimum', () => {
        // 1 hr 59 min 59 sec = 7199s < 7200s, so 2 hours is the lowest reachable hour
        expect(getTimeWheelColumnRange('h', all_units, { min: 7200, max: 86400 }, [0, 0, 0])).toEqual({
            min: 2,
            max: 24,
        });
    });

    it('should restrict minutes to the intraday minimum when seconds are unavailable', () => {
        const units = ['h', 'm'];
        expect(getTimeWheelColumnRange('m', units, { min: 900, max: 86400 }, [0, 15])).toEqual({ min: 15, max: 59 });
        expect(getTimeWheelColumnRange('m', units, { min: 900, max: 86400 }, [1, 0])).toEqual({ min: 0, max: 59 });
    });

    it('should cap minutes by the intraday maximum for sub-hour contracts', () => {
        expect(getTimeWheelColumnRange('h', all_units, { min: 15, max: 3600 }, [0, 0, 15])).toEqual({ min: 0, max: 1 });
        expect(getTimeWheelColumnRange('m', all_units, { min: 15, max: 3600 }, [1, 0, 0])).toEqual({ min: 0, max: 0 });
        expect(getTimeWheelColumnRange('m', all_units, { min: 15, max: 3600 }, [0, 0, 15])).toEqual({
            min: 0,
            max: 59,
        });
    });
});

describe('getTimeWheelColumnOptions', () => {
    const all_units = ['h', 'm', 's'];
    const intraday = { min: 15, max: 3600 };

    it('[DTW-001] restricts seconds to the intraday minimum when hours and minutes are both 0', () => {
        const options = getTimeWheelColumnOptions('s', all_units, intraday, [0, 0, 0]);
        expect(options[0].value).toBe(15);
        expect(options[options.length - 1].value).toBe(59);
        expect(options.some(option => option.value < 15)).toBe(false);
    });

    it('[DTW-001] renders seconds from 0 once minutes alone already covers the intraday minimum', () => {
        const options = getTimeWheelColumnOptions('s', all_units, intraday, [0, 1, 0]);
        expect(options[0].value).toBe(0);
        expect(options[options.length - 1].value).toBe(59);
    });

    it('[DTW-001] restricts seconds to the intraday minimum for a seconds-only contract', () => {
        const options = getTimeWheelColumnOptions('s', ['s'], intraday, [0, 0, 0]);
        expect(options[0].value).toBe(15);
        expect(options[options.length - 1].value).toBe(59);
    });

    it('[DTW-001] leaves the hours column range unaffected by this change', () => {
        const options = getTimeWheelColumnOptions('h', all_units, intraday, [0, 0, 0]);
        expect(options[0].value).toBe(0);
        expect(options[options.length - 1].value).toBe(1);
    });
});

describe('clampTimeWheelSelection', () => {
    const all_units = ['h', 'm', 's'];
    const intraday = { min: 15, max: 86400 };

    it('should snap a selection below the minimum up to the smallest valid combination', () => {
        expect(clampTimeWheelSelection(all_units, intraday, [0, 0, 0])).toEqual([0, 0, 15]);
    });

    it('should snap a selection above the maximum down to the largest valid combination', () => {
        expect(clampTimeWheelSelection(all_units, intraday, [25, 30, 30])).toEqual([24, 0, 0]);
    });

    it('should keep a valid selection unchanged', () => {
        expect(clampTimeWheelSelection(all_units, intraday, [1, 30, 45])).toEqual([1, 30, 45]);
    });

    it('should zero out hidden units', () => {
        expect(clampTimeWheelSelection(['m', 's'], { min: 15, max: 3540 }, [2, 30, 45])).toEqual([0, 30, 45]);
    });
});

describe('getDurationFromTimeWheelSelection', () => {
    it('should map selections with seconds to a seconds duration', () => {
        expect(getDurationFromTimeWheelSelection([0, 0, 45])).toEqual({ duration: 45, duration_unit: 's' });
        expect(getDurationFromTimeWheelSelection([0, 2, 15])).toEqual({ duration: 135, duration_unit: 's' });
        expect(getDurationFromTimeWheelSelection([1, 0, 30])).toEqual({ duration: 3630, duration_unit: 's' });
    });

    it('should map selections without seconds to a minutes duration, including whole hours', () => {
        expect(getDurationFromTimeWheelSelection([0, 30, 0])).toEqual({ duration: 30, duration_unit: 'm' });
        expect(getDurationFromTimeWheelSelection([1, 30, 0])).toEqual({ duration: 90, duration_unit: 'm' });
        expect(getDurationFromTimeWheelSelection([2, 0, 0])).toEqual({ duration: 120, duration_unit: 'm' });
    });

    it('should send whole hours as hours when minutes are not an offered unit', () => {
        const hours_only = [{ value: 'h' }, { value: 'd' }];
        expect(getDurationFromTimeWheelSelection([3, 0, 0], hours_only)).toEqual({ duration: 3, duration_unit: 'h' });

        const with_minutes = [{ value: 'm' }, { value: 'h' }, { value: 'd' }];
        expect(getDurationFromTimeWheelSelection([3, 0, 0], with_minutes)).toEqual({
            duration: 180,
            duration_unit: 'm',
        });
    });
});

describe('getTimeWheelSelectionFromDuration', () => {
    it('should split a seconds duration into hours, minutes and seconds', () => {
        expect(getTimeWheelSelectionFromDuration(45, 's')).toEqual([0, 0, 45]);
        expect(getTimeWheelSelectionFromDuration(5445, 's')).toEqual([1, 30, 45]);
    });

    it('should split a minutes duration into hours and minutes', () => {
        expect(getTimeWheelSelectionFromDuration(30, 'm')).toEqual([0, 30, 0]);
        expect(getTimeWheelSelectionFromDuration(90, 'm')).toEqual([1, 30, 0]);
    });

    it('should map an hours duration to whole hours', () => {
        expect(getTimeWheelSelectionFromDuration(2, 'h')).toEqual([2, 0, 0]);
    });

    it('should fall back to zeros for non-time units', () => {
        expect(getTimeWheelSelectionFromDuration(5, 't')).toEqual([0, 0, 0]);
        expect(getTimeWheelSelectionFromDuration(1, 'd')).toEqual([0, 0, 0]);
    });
});

describe('roundUpToRoundStake', () => {
    it('should round a market minimum up to the next value on the 1-2-5 decade ladder', () => {
        expect(roundUpToRoundStake(8)).toBe(8);
        expect(roundUpToRoundStake(6.5)).toBe(8);
        expect(roundUpToRoundStake(11)).toBe(15);
        expect(roundUpToRoundStake(34.06)).toBe(40);
    });

    it('should leave a minimum that already sits on the ladder unchanged', () => {
        expect(roundUpToRoundStake(1)).toBe(1);
        expect(roundUpToRoundStake(2)).toBe(2);
        expect(roundUpToRoundStake(5)).toBe(5);
        expect(roundUpToRoundStake(10)).toBe(10);
        expect(roundUpToRoundStake(100)).toBe(100);
    });

    it('should scale below 1 for low-unit currencies', () => {
        expect(roundUpToRoundStake(0.35)).toBe(0.4);
        expect(roundUpToRoundStake(0.05)).toBe(0.05);
        expect(roundUpToRoundStake(0.6)).toBeCloseTo(0.6);
    });

    it('should scale above one decade without a per-magnitude table', () => {
        expect(roundUpToRoundStake(120)).toBe(150);
        expect(roundUpToRoundStake(3400)).toBe(4000);
    });

    it('should never return a value below the minimum it was given', () => {
        const inputs = [0.01, 0.07, 0.35, 0.99, 1, 1.01, 2, 3, 6.5, 8, 10, 11, 34.06, 99, 120, 501, 3400, 12345];
        inputs.forEach(min => {
            expect(roundUpToRoundStake(min)).toBeGreaterThanOrEqual(min);
        });
    });

    it('should return non-finite or non-positive input unchanged', () => {
        expect(roundUpToRoundStake(0)).toBe(0);
        expect(roundUpToRoundStake(-5)).toBe(-5);
        expect(roundUpToRoundStake(NaN)).toBeNaN();
        expect(roundUpToRoundStake(Infinity)).toBe(Infinity);
    });
});

describe('getDerivedDefaultStake', () => {
    it('should keep the contracts_for default when it is already at or above the minimum', () => {
        expect(getDerivedDefaultStake(2, 1)).toBe(2);
        expect(getDerivedDefaultStake(2, 2)).toBe(2);
    });

    it('should raise the default to the rounded minimum when the minimum exceeds it', () => {
        expect(getDerivedDefaultStake(2, 8)).toBe(8);
        expect(getDerivedDefaultStake(2, 34.06)).toBe(40);
        expect(getDerivedDefaultStake(2, 11)).toBe(15);
    });

    it('should never return a value below the minimum', () => {
        [1, 2, 6.5, 8, 11, 34.06, 120].forEach(min_stake => {
            expect(getDerivedDefaultStake(2, min_stake)).toBeGreaterThanOrEqual(min_stake);
        });
    });

    it('should fall back to the API default alone when the minimum is unusable', () => {
        expect(getDerivedDefaultStake(2, undefined)).toBeUndefined();
        expect(getDerivedDefaultStake(2, NaN)).toBeUndefined();
        expect(getDerivedDefaultStake(undefined, undefined)).toBeUndefined();
    });

    it('should still derive a stake when the API default is missing', () => {
        expect(getDerivedDefaultStake(undefined, 8)).toBe(8);
    });

    it('should fall back to the raw minimum when rounding up would exceed the maximum', () => {
        // 11 rounds up to 15, which a maximum of 12 cannot accommodate — so the raw minimum, the
        // only value guaranteed to sit inside the band, is used instead.
        expect(getDerivedDefaultStake(2, 11, 12)).toBe(11);
        expect(getDerivedDefaultStake(2, 11, 15)).toBe(15);
        expect(getDerivedDefaultStake(2, 11, 5000)).toBe(15);
    });

    it('should ignore an unusable maximum', () => {
        expect(getDerivedDefaultStake(2, 8, NaN)).toBe(8);
        expect(getDerivedDefaultStake(2, 8, undefined)).toBe(8);
    });
});

describe('getStakeLadderValues', () => {
    const vanillas_base = TRADE_PARAMETER_PRESETS.stake.vanillas;

    it('should start the quick picks at the derived default on a high-minimum market', () => {
        const derived_default = getDerivedDefaultStake(2, 8);
        const presets = getStakeLadderValues(vanillas_base, derived_default, 5000);

        expect(presets[0]).toBe(8);
        expect(presets).toEqual([8, 10, 20, 50, 75, 80]);
        expect(presets.every(value => value >= 8)).toBe(true);
    });

    it('should only move the leading chip on an ordinary minimum-2 market', () => {
        const derived_default = getDerivedDefaultStake(2, 2);

        expect(getStakeLadderValues(vanillas_base, derived_default, 5000)).toEqual([2, 5, 10, 20, 50, 75]);
    });

    it('should top up with multiples of the derived floor when the minimum invalidates most of the base', () => {
        const derived_default = getDerivedDefaultStake(2, 34.06);
        const presets = getStakeLadderValues(vanillas_base, derived_default, 5000);

        expect(derived_default).toBe(40);
        expect(presets).toEqual([40, 50, 75, 80, 100, 150]);
        expect(presets.every(value => value >= 34.06 && value <= 5000)).toBe(true);
    });

    it('should always offer a full row of six quick picks', () => {
        // A row that is 6 wide on one market and 3 wide on the next reads as chips being missing.
        // Whatever the floor, the base presets above it are topped up from multiples of the floor
        // until the row is full, so the surface always offers the same number of quick picks.
        // Every minimum a Vanillas market reports today is covered here.
        const max_stake = 5000;
        [0.35, 0.5, 1, 2, 3, 6.5, 8, 10, 11, 20, 34.06, 80, 120, 200].forEach(min_stake => {
            const derived_default = getDerivedDefaultStake(2, min_stake, max_stake);
            const presets = getStakeLadderValues(vanillas_base, derived_default, max_stake);

            expect(presets).toHaveLength(6);
            // Strictly ascending, so the top-up never repeats or undercuts a value already offered.
            expect(presets.every((value, index) => index === 0 || value > presets[index - 1])).toBe(true);
        });
    });

    it('should never offer a quick pick above the maximum', () => {
        // The maximum outranks the full row: a band with no room for six ascending values offers the
        // ones that fit rather than a value the market would reject.
        expect(getStakeLadderValues(vanillas_base, 10, 60)).toEqual([10, 20, 50, 60]);
        // The tighter top-up rungs reach 250 here, which the maximum allows — a band that fits two
        // ascending values offers both rather than stopping at the floor.
        expect(getStakeLadderValues(vanillas_base, 200, 250)).toEqual([200, 250]);
    });

    it('should offer no quick pick at all until a floor is available', () => {
        // Every value on the ladder is derived from the floor, so before the active market's limits
        // are known there is nothing to offer. Falling back to the unfiltered base put a lower first
        // chip on screen and replaced the whole row a moment later — the flicker QA saw on mobile.
        expect(getStakeLadderValues(vanillas_base, undefined, 5000)).toEqual([]);
        expect(getStakeLadderValues(vanillas_base, NaN, 5000)).toEqual([]);
        expect(getStakeLadderValues(vanillas_base, 0, 5000)).toEqual([]);
    });

    it('should still lead with the floor and fill the row when the maximum is not known yet', () => {
        expect(getStakeLadderValues(vanillas_base, 10)).toEqual([10, 20, 50, 75, 80, 100]);
        expect(getStakeLadderValues(vanillas_base, 50)[0]).toBe(50);
        expect(getStakeLadderValues(vanillas_base, 50)).toHaveLength(6);
    });

    it('should offer the derived default as the first quick pick for every minimum', () => {
        // The one invariant the two stake surfaces and the store's default all rest on: whatever the
        // market minimum is, the stake the platform applies is the lowest quick pick it offers. A
        // starting stake above the first chip is what the user reports as "it picked a larger amount".
        const max_stake = 5000;
        [0.35, 0.5, 1, 2, 3, 6.5, 8, 10, 11, 20, 34.06, 80, 120, 400].forEach(min_stake => {
            const derived_default = getDerivedDefaultStake(2, min_stake, max_stake);
            const presets = getStakeLadderValues(vanillas_base, derived_default, max_stake);

            expect(presets[0]).toBe(derived_default);
            expect(presets.every(value => value >= min_stake && value <= max_stake)).toBe(true);
        });
    });
});
