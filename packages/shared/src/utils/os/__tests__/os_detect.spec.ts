import { isDesktopOs, isPhoneLandscape, OSDetect, PHONE_LANDSCAPE_MEDIA_QUERY } from '../os_detect';

const DESKTOP_UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const IPAD_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

type TDeviceStub = {
    platform?: string;
    userAgent?: string;
    maxTouchPoints?: number;
    /** Whether the primary pointer is coarse with no hover — i.e. a real tablet/phone. */
    touch_primary?: boolean;
};

const stubDevice = ({
    platform = '',
    userAgent = DESKTOP_UA,
    maxTouchPoints = 0,
    touch_primary = false,
}: TDeviceStub) => {
    Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true });
    Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
    Object.defineProperty(window.navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
    // The global test setup defines matchMedia as writable but not configurable,
    // so it has to be assigned rather than redefined.
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: query === '(pointer: coarse) and (hover: none)' ? touch_primary : false,
        media: query,
    })) as unknown as typeof window.matchMedia;
};

/**
 * `isTabletOs` is a module-level const evaluated at import time, so the device has to be
 * stubbed before the module is (re-)loaded.
 */
const loadIsTabletOs = (stub: TDeviceStub) => {
    stubDevice(stub);
    let is_tablet_os = false;
    jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        is_tablet_os = require('../os_detect').isTabletOs;
    });
    return is_tablet_os;
};

describe('OSDetect / isDesktopOs', () => {
    afterEach(() => {
        localStorage.removeItem('config.os');
        jest.clearAllMocks();
    });

    it('detects Linux desktop from the reduced platform string modern Chrome reports', () => {
        // Chrome freezes navigator.platform to 'Linux x86_64' on Linux under UA reduction.
        stubDevice({ platform: 'Linux x86_64' });

        expect(OSDetect()).toBe('linux');
        expect(isDesktopOs()).toBe(true);
    });

    it.each([['Linux'], ['Linux i686'], ['Linux amd64'], ['Linux x86_64 X11'], ['X11'], ['FreeBSD']])(
        'treats legacy/bare Linux platform "%s" as a desktop OS',
        platform => {
            stubDevice({ platform });

            expect(OSDetect()).toBe('linux');
            expect(isDesktopOs()).toBe(true);
        }
    );

    it.each([
        ['Win32', 'windows'],
        ['MacIntel', 'mac'],
    ])('treats %s as desktop OS "%s"', (platform, expected) => {
        stubDevice({ platform });

        expect(OSDetect()).toBe(expected);
        expect(isDesktopOs()).toBe(true);
    });

    it.each([['iPhone'], ['iPad'], ['Linux armv7l'], ['Android']])(
        'does not treat mobile platform "%s" as a desktop OS',
        platform => {
            stubDevice({ platform });

            expect(isDesktopOs()).toBe(false);
        }
    );

    it('does not treat an unrecognised platform as a desktop OS', () => {
        stubDevice({ platform: 'SomeFuturePlatform' });

        expect(isDesktopOs()).toBe(false);
    });

    it('honours the config.os override case-insensitively', () => {
        stubDevice({ platform: 'MacIntel' });
        // A human writing this override naturally capitalises the OS name.
        localStorage.setItem('config.os', 'Linux');

        expect(OSDetect()).toBe('Linux');
        expect(isDesktopOs()).toBe(true);
    });
});

describe('isTabletOs', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('is false for a Linux desktop whose input stack reports touch points', () => {
        // The regression behind issue #1122: a Linux desktop/Chromebook can report
        // maxTouchPoints > 0 while still being driven by a mouse.
        expect(loadIsTabletOs({ platform: 'Linux x86_64', maxTouchPoints: 5, touch_primary: false })).toBe(false);
    });

    it('is false for a touchscreen Mac/Linux laptop that still has a hover-capable pointer', () => {
        expect(loadIsTabletOs({ platform: 'MacIntel', maxTouchPoints: 1, touch_primary: false })).toBe(false);
    });

    it('is false for a plain Linux desktop with no touch at all', () => {
        expect(loadIsTabletOs({ platform: 'Linux x86_64', maxTouchPoints: 0 })).toBe(false);
    });

    it('is true for an iPadOS 13+ iPad, which reports the MacIntel platform', () => {
        expect(
            loadIsTabletOs({
                platform: 'MacIntel',
                userAgent: IPAD_UA,
                maxTouchPoints: 5,
                touch_primary: true,
            })
        ).toBe(true);
    });

    it('is true for a Linux-based tablet whose primary pointer is coarse', () => {
        expect(loadIsTabletOs({ platform: 'Linux x86_64', maxTouchPoints: 5, touch_primary: true })).toBe(true);
    });

    it('is true for an Android tablet, detected from the user agent', () => {
        expect(
            loadIsTabletOs({
                platform: 'Linux armv8l',
                userAgent:
                    'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            })
        ).toBe(true);
    });
});

describe('isPhoneLandscape', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const stubViewport = ({ userAgent, query_matches }: { userAgent: string; query_matches: boolean }) => {
        Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
        // matchMedia is writable-but-not-configurable in the global setup, so assign rather than redefine.
        window.matchMedia = jest.fn().mockImplementation((query: string) => ({
            matches: query === PHONE_LANDSCAPE_MEDIA_QUERY ? query_matches : false,
            media: query,
        })) as unknown as typeof window.matchMedia;
    };

    it('[LTM-001] is true only when the media query matches and isMobileOs() is true', () => {
        stubViewport({ userAgent: IPHONE_UA, query_matches: true });

        expect(isPhoneLandscape()).toBe(true);
    });

    it('[LTM-001] is false when isMobileOs() is false even though the media query matches', () => {
        stubViewport({ userAgent: DESKTOP_UA, query_matches: true });

        expect(isPhoneLandscape()).toBe(false);
    });

    it('[LTM-001] is false when the media query does not match (soft-keyboard portrait viewport)', () => {
        stubViewport({ userAgent: IPHONE_UA, query_matches: false });

        expect(isPhoneLandscape()).toBe(false);
    });
});
