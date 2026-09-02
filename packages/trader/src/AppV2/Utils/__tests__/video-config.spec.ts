import {
    DESCRIPTION_VIDEO_ID,
    getContractDescriptionAnimationSrc,
    getDescriptionVideoId,
    getVideoMp4Url,
} from '../video-config';

describe('getDescriptionVideoId', () => {
    it('should return an id for Vanillas description video in light theme', () => {
        expect(getDescriptionVideoId('vanilla', false)).toEqual(DESCRIPTION_VIDEO_ID.vanilla.light);
    });
    it('should return an id for Accumulator description video in light theme', () => {
        expect(getDescriptionVideoId('accumulator', false)).toEqual(DESCRIPTION_VIDEO_ID.accumulator.light);
    });
    it('should return an id for High/Low description video in light theme', () => {
        expect(getDescriptionVideoId('high_low', false)).toEqual(DESCRIPTION_VIDEO_ID.high_low.light);
    });
    it('should return an id for Matches/Differs description video in light theme', () => {
        expect(getDescriptionVideoId('match_diff', false)).toEqual(DESCRIPTION_VIDEO_ID.match_diff.light);
    });
    it('should return an id for Over/Under description video in light theme', () => {
        expect(getDescriptionVideoId('over_under', false)).toEqual(DESCRIPTION_VIDEO_ID.over_under.light);
    });
    it('should return an id for Rise/Fall description video in light theme', () => {
        expect(getDescriptionVideoId('rise_fall', false)).toEqual(DESCRIPTION_VIDEO_ID.rise_fall.light);
    });
    it('should return an id for Multipliers description video in dark theme', () => {
        expect(getDescriptionVideoId('multiplier', true)).toEqual(DESCRIPTION_VIDEO_ID.multiplier.dark);
    });
    it('should return an id for Touch/No Touch description video in light theme', () => {
        expect(getDescriptionVideoId('touch', false)).toEqual(DESCRIPTION_VIDEO_ID.touch.light);
    });
    it('should return an id for Even/Odd description video in dark theme', () => {
        expect(getDescriptionVideoId('even_odd', true)).toEqual(DESCRIPTION_VIDEO_ID.even_odd.dark);
    });
    it('should return an id for Turbos description video in dark theme', () => {
        expect(getDescriptionVideoId('turbos', true)).toEqual(DESCRIPTION_VIDEO_ID.turbos.dark);
    });
    it('should return undefined when called with empty arguments', () => {
        expect(getDescriptionVideoId()).toEqual(undefined);
    });
});

describe('getVideoMp4Url', () => {
    const originalLocation = window.location;

    const mockLocation = (overrides: Partial<Location>) => {
        Object.defineProperty(window, 'location', {
            value: { ...originalLocation, ...overrides },
            configurable: true,
            writable: true,
        });
    };

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            configurable: true,
            writable: true,
        });
    });

    it('[TGV-001] builds the R2 /stream/<id>.mp4 URL on a deriv.com hostname', () => {
        mockLocation({ hostname: 'dtrader.deriv.com' });

        expect(getVideoMp4Url('26d1401d2e3f6ae16913a21ec0579fc1')).toBe(
            'https://media.deriv.com/stream/26d1401d2e3f6ae16913a21ec0579fc1.mp4'
        );
    });

    it('[TGV-001] follows the brand TLD on a deriv.be hostname', () => {
        mockLocation({ hostname: 'dtrader.deriv.be' });

        expect(getVideoMp4Url('26d1401d2e3f6ae16913a21ec0579fc1')).toBe(
            'https://media.deriv.be/stream/26d1401d2e3f6ae16913a21ec0579fc1.mp4'
        );
    });

    it('[TGV-001] never references cloudflarestream.com', () => {
        mockLocation({ hostname: 'dtrader.deriv.com' });

        expect(getVideoMp4Url('26d1401d2e3f6ae16913a21ec0579fc1')).not.toContain('cloudflarestream.com');
    });
});

describe('getContractDescriptionAnimationSrc', () => {
    it('should return the light .lottie path when is_dark_theme is false', () => {
        expect(getContractDescriptionAnimationSrc('rise', false)).toEqual('/public/videos/rise_mobile.lottie');
    });
    it('should return the dark .lottie path when is_dark_theme is true', () => {
        expect(getContractDescriptionAnimationSrc('rise', true)).toEqual('/public/videos/rise_mobile_dark.lottie');
    });
    it('should lower-case a CONTRACT_LIST key and return the light path by default', () => {
        expect(getContractDescriptionAnimationSrc('Accumulators')).toEqual('/public/videos/accumulators_mobile.lottie');
    });
    it('should lower-case a CONTRACT_LIST key and return the dark path in dark theme', () => {
        expect(getContractDescriptionAnimationSrc('Accumulators', true)).toEqual(
            '/public/videos/accumulators_mobile_dark.lottie'
        );
    });
});
