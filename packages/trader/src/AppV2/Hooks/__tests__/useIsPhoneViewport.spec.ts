import { useDevice } from '@deriv-com/ui';
import { renderHook } from '@testing-library/react-hooks';

import useIsPhoneLandscape from '../useIsPhoneLandscape';
import useIsPhoneViewport from '../useIsPhoneViewport';

jest.mock('@deriv-com/ui', () => ({ useDevice: jest.fn() }));
jest.mock('../useIsPhoneLandscape', () => jest.fn());

describe('useIsPhoneViewport', () => {
    afterEach(() => jest.clearAllMocks());

    it.each([
        [true, false, true],
        [false, true, true],
        [false, false, false],
        [true, true, true],
    ])('[LTM-007] isMobile=%s || isPhoneLandscape=%s → %s', (isMobile, is_landscape, expected) => {
        (useDevice as jest.Mock).mockReturnValue({ isMobile });
        (useIsPhoneLandscape as jest.Mock).mockReturnValue(is_landscape);

        const { result } = renderHook(() => useIsPhoneViewport());

        expect(result.current).toBe(expected);
    });
});
