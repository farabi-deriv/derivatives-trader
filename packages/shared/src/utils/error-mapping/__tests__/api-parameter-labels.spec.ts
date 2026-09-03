import { localize } from '@deriv-com/translations';

import { getApiParameterLabels, hasRawApiParameterName, humanizeApiParameterNames } from '../api-parameter-labels';

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

describe('getApiParameterLabels', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('labels date_expiry with the wording of the duration picker End time tab', () => {
        expect(getApiParameterLabels().date_expiry).toBe('end time');
    });

    it('resolves labels on every call so they follow a language switch', () => {
        getApiParameterLabels();
        const calls_after_first = (localize as jest.Mock).mock.calls.length;
        expect(calls_after_first).toBeGreaterThan(0);

        getApiParameterLabels();
        expect((localize as jest.Mock).mock.calls).toHaveLength(calls_after_first * 2);
    });
});

describe('humanizeApiParameterNames', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('replaces a bare parameter name with its label', () => {
        expect(humanizeApiParameterNames('date_expiry')).toBe('end time');
    });

    it('replaces every name inside a comma-joined argument', () => {
        expect(humanizeApiParameterNames('take_profit, stop_loss')).toBe('take profit, stop loss');
    });

    it('replaces a parameter name inside prose and keeps the surrounding punctuation', () => {
        expect(humanizeApiParameterNames('Please specify either duration or date_expiry.')).toBe(
            'Please specify either duration or end time.'
        );
    });

    it.each(['1.2345', 'USD', '+207.90', '-207.60', 'R_100', '1HZ100V', 'MULTUP', '2'])(
        'leaves the value %s untouched',
        (value: string) => {
            expect(humanizeApiParameterNames(value)).toBe(value);
        }
    );

    it('matches the longest key first so barrier2 is not partially rewritten', () => {
        expect(humanizeApiParameterNames('barrier2')).toBe('second barrier');
    });

    it('does not rewrite a key that is only part of a longer identifier', () => {
        expect(humanizeApiParameterNames('trading_date_expiry_offset')).toBe('trading_date_expiry_offset');
    });

    it('returns an empty string unchanged', () => {
        expect(humanizeApiParameterNames('')).toBe('');
    });
});

describe('hasRawApiParameterName', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it.each(['date_expiry', 'take_profit', 'Invalid trading_period_start supplied.'])(
        'reports %s as still carrying a raw parameter name',
        (text: string) => {
            expect(hasRawApiParameterName(text)).toBe(true);
        }
    );

    it.each([
        'R_100',
        '1HZ100V',
        'MULTUP',
        'DIGITMATCH',
        'Barrier must be between 1.1 and 1.2.',
        'Please specify either duration or end time.',
        '',
    ])('exempts %s because it carries no lowercase snake_case identifier', (text: string) => {
        expect(hasRawApiParameterName(text)).toBe(false);
    });
});
