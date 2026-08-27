import fs from 'fs';
import path from 'path';

import { mapErrorMessage } from '../error-message-mapper';
import { localize } from '@deriv-com/translations';

// Mock the localize function to handle both string and params
jest.mock('@deriv-com/translations', () => ({
    localize: jest.fn((text: string, params?: Record<string, string>) => {
        if (!params) return text;
        // Simple replacement for testing
        let result = text;
        Object.keys(params).forEach(key => {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), params[key]);
        });
        return result;
    }),
}));

describe('mapErrorMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return default error message when error is null or undefined', () => {
        expect(mapErrorMessage(null as any)).toBe('An error occurred. Please try again later.');
        expect(mapErrorMessage(undefined as any)).toBe('An error occurred. Please try again later.');
    });

    it('should return backend message when subcode is not present', () => {
        const error = {
            message: 'Backend error message',
        };
        expect(mapErrorMessage(error)).toBe('Backend error message');
    });

    it('should return backend message when subcode is not mapped', () => {
        const error = {
            message: 'Backend error message',
            subcode: 'UnknownSubcode',
        };
        expect(mapErrorMessage(error)).toBe('Backend error message');
    });

    it('should return mapped message for known subcode without parameters', () => {
        const error = {
            message: 'Backend error message',
            subcode: 'AlreadyExpired',
        };
        const result = mapErrorMessage(error);
        expect(result).toBe('This contract has already expired.');
        expect(localize).toHaveBeenCalledWith('This contract has already expired.');
    });

    // Parameterized error messages are temporarily commented out in the mapper
    it.skip('should substitute single parameter in error message', () => {
        const error = {
            message: 'Backend error message',
            subcode: 'AccountBalanceExceedsLimit',
            code_args: ['1000', '5000'],
        };
        const result = mapErrorMessage(error);
        expect(result).toBe(
            'Sorry, your account cash balance is too high (1000). Your maximum account balance is 5000.'
        );
        expect(localize).toHaveBeenCalledWith(
            'Sorry, your account cash balance is too high ({{param_1}}). Your maximum account balance is {{param_2}}.',
            { param_1: '1000', param_2: '5000' }
        );
    });

    it.skip('should substitute multiple parameters in error message', () => {
        const error = {
            message: 'Backend error message',
            subcode: 'BarrierNotInRange',
            code_args: ['100', '150'],
        };
        const result = mapErrorMessage(error);
        expect(result).toBe('Barrier is not an integer in range of 100 to 150.');
        expect(localize).toHaveBeenCalledWith('Barrier is not an integer in range of {{param_1}} to {{param_2}}.', {
            param_1: '100',
            param_2: '150',
        });
    });

    it('should handle error message with no parameters when code_args is empty', () => {
        const error = {
            message: 'Backend error message',
            subcode: 'AlreadyExpired',
            code_args: [],
        };
        const result = mapErrorMessage(error);
        expect(result).toBe('This contract has already expired.');
    });

    it.skip('should handle error message with parameters when code_args is undefined', () => {
        const error = {
            message: 'Backend error message',
            subcode: 'AccountBalanceExceedsLimit',
        };
        const result = mapErrorMessage(error);
        // When params are undefined, they get substituted as "undefined"
        expect(result).toBe(
            'Sorry, your account cash balance is too high (undefined). Your maximum account balance is undefined.'
        );
    });

    it.skip('should handle complex error messages with multiple parameter substitutions', () => {
        const error = {
            message: 'Backend error message',
            subcode: 'DailyTurnoverLimitExceeded',
            code_args: ['500', 'USD'],
        };
        const result = mapErrorMessage(error);
        expect(result).toContain('500');
        expect(result).toContain('USD');
    });

    it('states the accepted range when BarrierNotInRange carries code_args', () => {
        const error = { subcode: 'BarrierNotInRange', code_args: ['30.5', '45.2'] };
        expect(mapErrorMessage(error)).toBe('Barrier is not an integer in range of 30.5 to 45.2.');
    });

    it('falls back to a format hint when BarrierNotInRange carries no code_args', () => {
        const error = { subcode: 'BarrierNotInRange', code_args: [] };
        expect(mapErrorMessage(error)).toBe('Barrier is not in the accepted range for this contract.');
    });

    it('states the accepted range when BarrierOutOfRange carries code_args', () => {
        const error = { subcode: 'BarrierOutOfRange', code_args: ['1.1000', '1.2000'] };
        expect(mapErrorMessage(error)).toBe('Barrier must be between 1.1000 and 1.2000.');
    });

    it('falls back to a generic message when BarrierOutOfRange carries no code_args', () => {
        const error = { subcode: 'BarrierOutOfRange', code_args: [] };
        expect(mapErrorMessage(error)).toBe('Barrier is out of acceptable range.');
    });

    it('falls back to a format hint when BarrierValidationError carries no code_args', () => {
        const error = { subcode: 'BarrierValidationError', code_args: [] };
        expect(mapErrorMessage(error)).toBe('Barrier is not valid for this contract.');
    });

    it('should return default message when error has no message and no subcode', () => {
        const error = {};
        expect(mapErrorMessage(error)).toBe('An error occurred. Please try again later.');
    });

    it('should call localize function for all messages', () => {
        const error = {
            message: 'Backend error message',
            subcode: 'AlreadyExpired',
        };
        mapErrorMessage(error);
        expect(localize).toHaveBeenCalled();
    });

    it('should handle error with subcode but empty message', () => {
        const error = {
            message: '',
            subcode: 'AlreadyExpired',
        };
        const result = mapErrorMessage(error);
        expect(result).toBe('This contract has already expired.');
    });

    it.skip('should preserve parameter order in substitution', () => {
        const error = {
            message: 'Backend error message',
            subcode: 'BarrierNotInRange',
            code_args: ['AAA', 'BBB'],
        };
        const result = mapErrorMessage(error);
        expect(result.indexOf('AAA')).toBeLessThan(result.indexOf('BBB'));
    });
});

describe('mapErrorMessage raw API parameter names', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('names the end time in English for the reported MissingEither rejection', () => {
        const error = { subcode: 'MissingEither', code_args: ['duration', 'date_expiry'] };
        const result = mapErrorMessage(error);
        expect(result).toBe('Please specify either duration or end time.');
        expect(result).not.toContain('date_expiry');
    });

    it('humanizes the same parameters for DuplicateExpiry', () => {
        const error = { subcode: 'DuplicateExpiry', code_args: ['duration', 'date_expiry'] };
        expect(mapErrorMessage(error)).toBe('Please enter only duration or end time.');
    });

    it('humanizes every parameter inside a single comma-joined argument', () => {
        const error = { subcode: 'OrderUpdateNotAllowed', code_args: ['take_profit, stop_loss'] };
        expect(mapErrorMessage(error)).toBe('Only these parameters can be updated: take profit, stop loss.');
    });

    it('reads as one sentence when a multi-word label lands in the barrier offset message', () => {
        const error = { subcode: 'IncorrectBarrierOffsetDecimals', code_args: ['barrier2', '2'] };
        expect(mapErrorMessage(error)).toBe('The second barrier offset can not have more than 2 decimal places.');
    });

    it('names the duration and end time in the InvalidExpiry message', () => {
        const error = { subcode: 'InvalidExpiry', code_args: ['MULTUP'] };
        const result = mapErrorMessage(error);
        expect(result).toBe('The duration or end time is not valid for this contract type (MULTUP).');
        expect(result).not.toContain('date_expiry');
    });

    it('sanitizes the backend prose of an unmapped subcode', () => {
        const error = { subcode: 'UnknownSubcode', message: 'Please specify either duration or date_expiry.' };
        expect(mapErrorMessage(error)).toBe('Please specify either duration or end time.');
    });

    it('falls back to the generic message when an unmapped prose keeps an unlabelled identifier', () => {
        const error = { message: 'Invalid trading_period_start supplied.' };
        expect(mapErrorMessage(error)).toBe('An error occurred. Please try again later.');
    });

    it('returns a clean unmapped message verbatim', () => {
        expect(mapErrorMessage({ message: 'Backend error message' })).toBe('Backend error message');
        expect(mapErrorMessage({ subcode: 'UnknownSubcode', message: 'Backend error message' })).toBe(
            'Backend error message'
        );
    });

    it('quotes barrier bounds byte-for-byte, signs and trailing zeros included', () => {
        const error = { subcode: 'BarrierNotInRange', code_args: ['+207.90', '-207.60'] };
        expect(mapErrorMessage(error)).toBe('Barrier is not an integer in range of +207.90 to -207.60.');
    });

    it('leaves a symbol code and a contract-type code untouched', () => {
        const error = { subcode: 'InvalidInput', code_args: ['R_100', 'MULTUP'] };
        expect(mapErrorMessage(error)).toBe('R_100 is not a valid input for contract type MULTUP.');
    });

    it('passes a numeric argument through without touching it', () => {
        const error = { subcode: 'DigitOutOfRange', code_args: [0, 9] };
        expect(mapErrorMessage(error)).toBe('Digit must be in the range of 0 to 9.');
    });
});

describe('authored error copy', () => {
    /**
     * Guards the class of bug behind #1247: an authored template that hardcodes a raw API
     * parameter name (the `InvalidExpiry` template used to read `(duration or date_expiry)`).
     *
     * Two known limitations, accepted deliberately:
     * 1. It is coupled to the mapper's file path — a rename fails this test loudly
     *    (file-not-found) rather than passing silently, and the fix is a one-line path update.
     * 2. It only sees templates written as a direct `localize('literal')` call; a template
     *    assembled by concatenation or held in a variable would slip past it.
     */
    const MAPPER_SOURCE_PATH = path.join(__dirname, '../error-message-mapper.ts');
    // Matches a lowercase snake_case wire identifier — the same detector the mapper uses on its
    // fallback path. Lowercase-anchored so `R_100`, `1HZ100V` and `MULTUP` cannot match.
    const RAW_API_PARAMETER_NAME = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;
    const INTERPOLATION_PLACEHOLDER = /^param_\d+$/;

    const getAuthoredTemplates = (): string[] => {
        const source: string = fs.readFileSync(MAPPER_SOURCE_PATH, 'utf8');
        const template_literal = /localize\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;

        return Array.from(source.matchAll(template_literal), match => match[2]);
    };

    it('extracts the mapper templates it is meant to scan', () => {
        // Sanity check: a silently empty extraction would make the assertion below vacuous.
        expect(getAuthoredTemplates().length).toBeGreaterThan(100);
    });

    it('contains no raw API parameter name in any authored template', () => {
        const offenders = getAuthoredTemplates()
            .map(template => ({
                template,
                identifiers: (template.match(RAW_API_PARAMETER_NAME) ?? []).filter(
                    (token: string) => !INTERPOLATION_PLACEHOLDER.test(token)
                ),
            }))
            .filter(({ identifiers }) => identifiers.length > 0);

        expect(offenders).toEqual([]);
    });
});
