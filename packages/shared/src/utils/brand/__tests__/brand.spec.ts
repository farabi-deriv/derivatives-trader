import { getHelpCentreUrl, getMediaUrl } from '../brand';

describe('getHelpCentreUrl', () => {
    const originalLocation = window.location;

    const mockLocation = (overrides: Partial<Location>) => {
        delete (window as any).location;
        window.location = {
            ...originalLocation,
            ...overrides,
        } as Location;
    };

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
        });
    });

    it('should return the content-site help centre URL on a deriv.com hostname', () => {
        mockLocation({ hostname: 'dtrader.deriv.com' });

        expect(getHelpCentreUrl()).toBe('https://deriv.com/helpcentre/deriv-trader');
    });

    it('should substitute the brand TLD when the app runs on deriv.be', () => {
        mockLocation({ hostname: 'dtrader.deriv.be' });

        expect(getHelpCentreUrl()).toBe('https://deriv.be/helpcentre/deriv-trader');
    });

    it('should return the URL unchanged on an unrecognised hostname (e.g. localhost)', () => {
        mockLocation({ hostname: 'localhost' });

        expect(getHelpCentreUrl()).toBe('https://deriv.com/helpcentre/deriv-trader');
    });

    it('should not route through the trade.deriv.com hop or pin the EU help centre', () => {
        mockLocation({ hostname: 'dtrader.deriv.com' });

        const url = getHelpCentreUrl();

        expect(url).not.toContain('trade.deriv.com');
        expect(url).not.toContain('/eu/');
    });
});

describe('getMediaUrl', () => {
    const originalLocation = window.location;

    const mockLocation = (overrides: Partial<Location>) => {
        delete (window as any).location;
        window.location = {
            ...originalLocation,
            ...overrides,
        } as Location;
    };

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
        });
    });

    it('[BMH-001] should return media.deriv.com on a deriv.com hostname', () => {
        mockLocation({ hostname: 'dtrader.deriv.com' });

        expect(getMediaUrl()).toBe('https://media.deriv.com');
    });

    it('[BMH-001] should substitute the brand TLD when the app runs on deriv.be', () => {
        mockLocation({ hostname: 'dtrader.deriv.be' });

        expect(getMediaUrl()).toBe('https://media.deriv.be');
    });

    it('[BMH-001] should substitute the brand TLD when the app runs on deriv.me', () => {
        mockLocation({ hostname: 'dtrader.deriv.me' });

        expect(getMediaUrl()).toBe('https://media.deriv.me');
    });

    it('[BMH-001] should return media.deriv.com unchanged on an unrecognised hostname (e.g. localhost)', () => {
        mockLocation({ hostname: 'localhost' });

        expect(getMediaUrl()).toBe('https://media.deriv.com');
    });
});
