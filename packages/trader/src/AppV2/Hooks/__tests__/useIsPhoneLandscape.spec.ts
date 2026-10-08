import { PHONE_LANDSCAPE_MEDIA_QUERY } from '@deriv/shared';
import { renderHook } from '@testing-library/react-hooks';

import { createMatchMediaMock } from '../../test-utils/match-media';
import useIsPhoneLandscape from '../useIsPhoneLandscape';

const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const stubUserAgent = (userAgent: string) =>
    Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });

describe('useIsPhoneLandscape', () => {
    const original_match_media = window.matchMedia;

    afterEach(() => {
        window.matchMedia = original_match_media;
        jest.clearAllMocks();
    });

    it('[LTM-001] subscribes with the exact phone-landscape media query string', () => {
        const media = createMatchMediaMock();
        stubUserAgent(IPHONE_UA);

        renderHook(() => useIsPhoneLandscape());

        expect(media.matchMedia).toHaveBeenCalledWith(PHONE_LANDSCAPE_MEDIA_QUERY);
    });

    it('[LTM-001] returns false when isMobileOs() is false even if the query matches', () => {
        const media = createMatchMediaMock();
        media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, true);
        stubUserAgent(DESKTOP_UA);

        const { result } = renderHook(() => useIsPhoneLandscape());

        expect(result.current).toBe(false);
    });

    it('[LTM-001] re-renders when the media query flips while mounted', () => {
        const media = createMatchMediaMock();
        stubUserAgent(IPHONE_UA);

        const { result } = renderHook(() => useIsPhoneLandscape());
        expect(result.current).toBe(false);

        media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, true);
        media.fire(PHONE_LANDSCAPE_MEDIA_QUERY);

        expect(result.current).toBe(true);
    });

    it('[LTM-001] uses the addListener fallback when addEventListener is unavailable', () => {
        const media = createMatchMediaMock({ legacy: true });
        stubUserAgent(IPHONE_UA);

        const { result } = renderHook(() => useIsPhoneLandscape());
        expect(result.current).toBe(false);

        media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, true);
        media.fire(PHONE_LANDSCAPE_MEDIA_QUERY);

        expect(result.current).toBe(true);
    });

    it('[LTM-001] removes the change listener on unmount', () => {
        const media = createMatchMediaMock();
        stubUserAgent(IPHONE_UA);

        const { unmount } = renderHook(() => useIsPhoneLandscape());
        expect(media.listenerCount(PHONE_LANDSCAPE_MEDIA_QUERY)).toBe(1);

        unmount();
        expect(media.listenerCount(PHONE_LANDSCAPE_MEDIA_QUERY)).toBe(0);
    });

    it('[LTM-001] reads the live value on any re-render, before the change event has fired', () => {
        // On a rotate `useDevice` can re-render first. A value cached until the change event briefly said
        // "not a phone", long enough for AutomateSwitch to redirect off /automate.
        const media = createMatchMediaMock();
        stubUserAgent(IPHONE_UA);
        const { result, rerender } = renderHook(() => useIsPhoneLandscape());
        expect(result.current).toBe(false);

        media.setMatches(PHONE_LANDSCAPE_MEDIA_QUERY, true);
        rerender();

        expect(result.current).toBe(true);
    });
});
