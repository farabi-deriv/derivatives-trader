import { getPreBuildDVRs, initFormErrorMessages } from '../declarative-validation-rules';
import { TFormErrorMessagesTypes } from '../form-error-messages-types';

const form_error_messages: TFormErrorMessagesTypes = {
    empty_barrier: () => 'Barrier is a required field.',
    barrier: () => 'Should be a valid number.',
    number: () => 'Should be a valid number.',
    decimalPlaces: decimals => `Up to ${decimals} decimal places are allowed.`,
    value: value => `Should be ${value}`,
    betweenMinMax: (min_value, max_value) => `Should be between ${min_value} and ${max_value}`,
    minNumber: min_value => `Should be more than ${min_value}`,
    maxNumber: max_value => `Should be less than ${max_value}`,
};

initFormErrorMessages(form_error_messages);

describe('getPreBuildDVRs', () => {
    it('[DCR-015] should only build the three rules a consumer still names', () => {
        expect(Object.keys(getPreBuildDVRs()).sort()).toEqual(['barrier', 'number', 'req']);
    });

    it('[DCR-015] should keep req rejecting empty values and accepting filled ones', () => {
        const { func } = getPreBuildDVRs().req;
        expect(func('')).toBe(false);
        expect(func('   ')).toBe(false);
        expect(func('1')).toBe(true);
    });

    it('[DCR-015] should keep number reporting the out-of-range message', () => {
        const { func } = getPreBuildDVRs().number;
        expect(func('abc', {}, {})).toEqual({ is_ok: false, message: 'Should be a valid number.' });
        expect(func('5', { min: 1, max: 3 }, {})).toEqual({
            is_ok: false,
            message: 'Should be between 1 and 3',
        });
        expect(func('2', { min: 1, max: 3 }, {})).toEqual({ is_ok: true, message: null });
    });

    it('[DCR-015] should keep barrier rejecting a lone sign and accepting a signed number', () => {
        const { func } = getPreBuildDVRs().barrier;
        expect(func('+')).toEqual({ is_ok: false, message: 'Barrier is a required field.' });
        expect(func('+1.5')).toEqual({ is_ok: true });
    });
});
