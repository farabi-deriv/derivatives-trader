import React from 'react';

import { isPhoneLandscape, PHONE_LANDSCAPE_MEDIA_QUERY } from '@deriv/shared';

/**
 * True on a phone-sized landscape viewport running a mobile OS. Re-renders on orientation change.
 * @returns whether the phone-landscape predicate currently holds.
 */
const useIsPhoneLandscape = () => {
    const [is_phone_landscape, setIsPhoneLandscape] = React.useState(() => isPhoneLandscape());

    React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

        const media = window.matchMedia(PHONE_LANDSCAPE_MEDIA_QUERY);
        const update = () => setIsPhoneLandscape(isPhoneLandscape());

        // Re-read on subscribe to close the mount race between the initial state and the first change.
        update();

        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', update);
            return () => media.removeEventListener('change', update);
        }
        // iOS Safari < 14 and older Android WebViews only expose the deprecated MediaQueryList API.
        media.addListener(update);
        return () => media.removeListener(update);
    }, []);

    return is_phone_landscape;
};

export default useIsPhoneLandscape;
