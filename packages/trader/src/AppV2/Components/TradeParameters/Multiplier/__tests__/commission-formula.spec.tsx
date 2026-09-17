import { getCommissionPercentage } from '../commission-formula';

describe('getCommissionPercentage', () => {
    it('computes (commission * 100) / (multiplier * stake) to 4 decimal places', () => {
        expect(getCommissionPercentage(0.5, 100, 10)).toBe('0.0500');
        expect(getCommissionPercentage(1, 50, 20)).toBe('0.1000');
    });

    it('returns null when commission is missing', () => {
        expect(getCommissionPercentage(null, 100, 10)).toBeNull();
        expect(getCommissionPercentage(undefined, 100, 10)).toBeNull();
    });

    it('returns null when the divisor is zero or not finite', () => {
        expect(getCommissionPercentage(0.5, 0, 10)).toBeNull();
        expect(getCommissionPercentage(0.5, 100, 0)).toBeNull();
        expect(getCommissionPercentage(0.5, undefined, 10)).toBeNull();
        expect(getCommissionPercentage(0.5, 100, undefined)).toBeNull();
    });

    it('treats zero commission as 0.0000 rather than null', () => {
        expect(getCommissionPercentage(0, 100, 10)).toBe('0.0000');
    });

    it('accepts string inputs (proposal values can be strings)', () => {
        expect(getCommissionPercentage('0.5', '100', '10')).toBe('0.0500');
    });
});
