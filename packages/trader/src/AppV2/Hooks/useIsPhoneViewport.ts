import { useDevice } from '@deriv-com/ui';

import useIsPhoneLandscape from './useIsPhoneLandscape';

/**
 * True on any phone-sized viewport — the width-based `isMobile` (portrait) OR a phone in landscape.
 * @returns whether the current viewport is phone-sized in either orientation.
 */
const useIsPhoneViewport = () => {
    const { isMobile } = useDevice();
    const is_phone_landscape = useIsPhoneLandscape();

    return isMobile || is_phone_landscape;
};

export default useIsPhoneViewport;
