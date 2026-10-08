import { isPhoneLandscape } from '@deriv/shared';

import { cancelPortraitRedirect, redirectOnPortrait } from '../portrait-redirect-utils';

jest.mock('@deriv/shared', () => ({ ...jest.requireActual('@deriv/shared'), isPhoneLandscape: jest.fn(() => true) }));

const mockIsPhoneLandscape = isPhoneLandscape as jest.Mock;

describe('portrait-redirect-utils', () => {
    const original_location = window.location;
    const original_match_media = window.matchMedia;
    let listeners: Array<() => void>;

    const rotate = (to_landscape: boolean) => {
        mockIsPhoneLandscape.mockReturnValue(to_landscape);
        [...listeners].forEach(listener => listener());
    };

    beforeEach(() => {
        listeners = [];
        window.matchMedia = jest.fn(() => ({
            addEventListener: (_: string, listener: () => void) => listeners.push(listener),
            removeEventListener: (_: string, listener: () => void) => {
                listeners = listeners.filter(l => l !== listener);
            },
        })) as unknown as typeof window.matchMedia;
        Object.defineProperty(window, 'location', { value: { href: '' }, writable: true, configurable: true });
    });

    afterEach(() => {
        cancelPortraitRedirect();
        window.matchMedia = original_match_media;
        Object.defineProperty(window, 'location', { value: original_location, writable: true, configurable: true });
        mockIsPhoneLandscape.mockReturnValue(true);
    });

    it('opens the url once the phone leaves landscape, and only once', () => {
        redirectOnPortrait('https://deriv.com/home');
        rotate(true);
        expect(window.location.href).toBe('');

        rotate(false);

        expect(window.location.href).toBe('https://deriv.com/home');
        expect(listeners).toHaveLength(0);
    });

    it('does nothing after it is cancelled', () => {
        redirectOnPortrait('https://deriv.com/home');
        cancelPortraitRedirect();

        rotate(false);

        expect(window.location.href).toBe('');
    });

    it('keeps only the latest destination', () => {
        redirectOnPortrait('https://deriv.com/home');
        redirectOnPortrait('https://deriv.com/transfer');

        rotate(false);

        expect(listeners).toHaveLength(0);
        expect(window.location.href).toBe('https://deriv.com/transfer');
    });
});
