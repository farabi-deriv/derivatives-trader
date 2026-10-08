import React from 'react';

import { isPhoneLandscape, PHONE_LANDSCAPE_MEDIA_QUERY } from '@deriv/shared';

const subscribe = (onChange: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;

    const media = window.matchMedia(PHONE_LANDSCAPE_MEDIA_QUERY);
    if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }
    // iOS Safari < 14 and older Android WebViews only expose the deprecated MediaQueryList API.
    media.addListener(onChange);
    return () => media.removeListener(onChange);
};

/**
 * True on a phone-sized landscape viewport running a mobile OS. Re-renders on orientation change.
 *
 * Read live on every render (`useSyncExternalStore`), not cached in state: on a rotate, `useDevice`
 * can re-render first, and a cached value would briefly say "not a phone" — long enough for an
 * effect to take a desktop path (e.g. AutomateSwitch redirecting off /automate).
 * @returns whether the phone-landscape predicate currently holds.
 */
const useIsPhoneLandscape = () => React.useSyncExternalStore(subscribe, isPhoneLandscape, () => false);

export default useIsPhoneLandscape;
