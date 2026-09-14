import {
    getStakeMultiplierError,
    getStakeMultiplierPresets,
    getStakeMultiplierRangeText,
    KNOWN_PARAM_KEYS,
} from '../automation-config';

// Minimal interpolating stub so assertions read as the rendered copy.
const localize = (text: string, args?: Record<string, unknown>) =>
    args ? text.replace(/\{\{(\w+)\}\}/g, (_match, key) => String(args[key])) : text;

describe('getStakeMultiplierError branches on the parameter, not the strategy', () => {
    describe('multiplier parameter', () => {
        const RANGE_ERROR = 'The value must be greater than 1 and no more than 10.';

        // The lower bound is exclusive; the upper (maximum) is inclusive, so only
        // values at/below min or strictly above max are rejected.
        it.each(['1', '0', '0.5', '10.01', '11', '5000'])('rejects %s as outside the range', value => {
            expect(getStakeMultiplierError(value, KNOWN_PARAM_KEYS.MULTIPLIER, localize)).toBe(RANGE_ERROR);
        });

        // The upper bound is inclusive (schema `maximum: 10`), so 10 itself is valid.
        it.each(['1.01', '1.5', '2', '5', '9.99', '10'])('accepts %s as inside the range', value => {
            expect(getStakeMultiplierError(value, KNOWN_PARAM_KEYS.MULTIPLIER, localize)).toBe('');
        });
    });

    describe('unit (increment) parameter', () => {
        // Regression: the increment floor is 1 and must not inherit the multiplier's
        // bounds, no matter which strategy happens to be selected. Before the param-key
        // switch the increment inherited the multiplier rule whenever the strategy was
        // Martingale — which it is on a cold load, before `auto_list_strategies`
        // resolves and `schema_keys` narrows the visible fields.
        it('accepts 1, the documented increment minimum, which the multiplier rejects', () => {
            expect(getStakeMultiplierError('1', KNOWN_PARAM_KEYS.UNIT, localize)).toBe('');
            expect(getStakeMultiplierError('1', KNOWN_PARAM_KEYS.MULTIPLIER, localize)).not.toBe('');
        });

        it('rejects a value below 1 with the increment copy', () => {
            expect(getStakeMultiplierError('0', KNOWN_PARAM_KEYS.UNIT, localize)).toBe('Increment must be at least 1');
        });

        // Regression guard, not an oversight: the increment must NOT inherit the
        // multiplier's cap. `unit` has no bounds in the schema, so applying the
        // multiplier's fallback here would reject values the server accepts.
        it('deliberately does not apply the multiplier cap to the increment', () => {
            expect(getStakeMultiplierError('5000', KNOWN_PARAM_KEYS.UNIT, localize)).toBe('');
        });
    });

    describe('shared invalid input', () => {
        it.each([
            ['', KNOWN_PARAM_KEYS.MULTIPLIER, 'The value must be greater than 1 and no more than 10.'],
            ['', KNOWN_PARAM_KEYS.UNIT, 'Increment must be at least 1'],
            ['abc', KNOWN_PARAM_KEYS.MULTIPLIER, 'The value must be greater than 1 and no more than 10.'],
            ['abc', KNOWN_PARAM_KEYS.UNIT, 'Increment must be at least 1'],
        ] as const)('rejects %p for %s', (value, param_key, expected) => {
            expect(getStakeMultiplierError(value, param_key, localize)).toBe(expected);
        });
    });

    describe('bounds resolved from the strategy schema', () => {
        // What auto_list_strategies now sends for `multiplier`:
        // exclusiveMinimum: 1, maximum: 10 (inclusive), i.e. "> 1 and <= 10".
        const schema_bounds = { min: 1, max: 10, is_min_exclusive: true };

        it('accepts the inclusive upper bound itself', () => {
            expect(getStakeMultiplierError('10', KNOWN_PARAM_KEYS.MULTIPLIER, localize, schema_bounds)).toBe('');
        });

        it('rejects the exclusive lower bound itself', () => {
            expect(getStakeMultiplierError('1', KNOWN_PARAM_KEYS.MULTIPLIER, localize, schema_bounds)).toBe(
                'The value must be greater than 1 and no more than 10.'
            );
        });

        it('rejects just above the inclusive maximum', () => {
            expect(getStakeMultiplierError('10.01', KNOWN_PARAM_KEYS.MULTIPLIER, localize, schema_bounds)).not.toBe('');
        });

        it('honours a wider range supplied by the schema', () => {
            const wide = { min: 1.5, max: 20, is_min_exclusive: true };
            expect(getStakeMultiplierError('20', KNOWN_PARAM_KEYS.MULTIPLIER, localize, wide)).toBe('');
            expect(getStakeMultiplierError('1.5', KNOWN_PARAM_KEYS.MULTIPLIER, localize, wide)).toBe(
                'The value must be greater than 1.5 and no more than 20.'
            );
        });

        it('phrases the sentence from the lower bound inclusivity', () => {
            expect(getStakeMultiplierRangeText({ min: 1, max: 10, is_min_exclusive: true }, localize)).toBe(
                'The value must be greater than 1 and no more than 10.'
            );
            expect(getStakeMultiplierRangeText({ min: 1, max: 10, is_min_exclusive: false }, localize)).toBe(
                'The value must be between 1 and 10.'
            );
        });
    });
});

describe('getStakeMultiplierPresets', () => {
    // Chips commit without going through the validator, so the offered values must
    // already sit inside the schema's range.
    it('offers every preset when the range covers them all', () => {
        expect(getStakeMultiplierPresets({ min: 1, max: 10, is_min_exclusive: true })).toEqual([2, 3, 4, 5, 6, 7]);
    });

    it('drops presets above an inclusive maximum', () => {
        expect(getStakeMultiplierPresets({ min: 1, max: 5, is_min_exclusive: true })).toEqual([2, 3, 4, 5]);
    });

    it('drops presets at or below an exclusive minimum', () => {
        expect(getStakeMultiplierPresets({ min: 4, max: 10, is_min_exclusive: true })).toEqual([5, 6, 7]);
    });

    it('keeps a preset equal to an inclusive minimum', () => {
        expect(getStakeMultiplierPresets({ min: 4, max: 10, is_min_exclusive: false })).toEqual([4, 5, 6, 7]);
    });

    it('returns an empty list when no preset fits, leaving the Custom tab as the way in', () => {
        expect(getStakeMultiplierPresets({ min: 90, max: 99, is_min_exclusive: true })).toEqual([]);
    });
});
