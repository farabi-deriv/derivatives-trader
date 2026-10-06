import { unzipSync } from 'fflate';
import fs from 'fs';
import path from 'path';

import { getContractDescriptionAnimationSrc } from '../video-config';

// The trade-type guide keys that render a looping `.lottie` animation. Each has
// a committed light asset (`<key>_mobile.lottie`) and, for this fix, a dark
// sibling (`<key>_mobile_dark.lottie`).
const GUIDE_ANIMATION_KEYS = [
    'accumulators',
    'differs',
    'even',
    'fall',
    'higher',
    'lower',
    'matches',
    'multipliers_down',
    'multipliers_up',
    'no_touch',
    'odd',
    'over',
    'rise',
    'touch',
    'turbos_down',
    'turbos_up',
    'under',
    'vanillas_call',
    'vanillas_put',
];

// Assets are served by the app shell from @deriv/core; the guide references them
// under `/public/videos/`.
const VIDEOS_DIR = path.resolve(__dirname, '../../../../../core/src/public/videos');

// Strip the runtime URL prefix the helper adds so we can read the file from disk.
const toBasename = (src: string) => src.replace('/public/videos/', '');

const readLottieEntries = (file: string) => {
    const buffer = fs.readFileSync(path.join(VIDEOS_DIR, file));
    return unzipSync(new Uint8Array(buffer));
};

type TManifest = { version?: string; animations?: { id?: string }[] };

// A `.lottie` archive is only renderable by the installed
// `@lottiefiles/dotlottie-web` player when its manifest points at animation
// entries that actually exist under `animations/<id>.json`. Dark assets exported
// in the newer dotLottie layout (`a/animation.json`, manifest version "2") fail
// to parse and leave the guide stuck on the skeleton loader, so every dark asset
// must match the same loadable layout as its working light sibling.
const readManifest = (entries: Record<string, Uint8Array>): TManifest => {
    expect(Object.keys(entries)).toContain('manifest.json');
    return JSON.parse(Buffer.from(entries['manifest.json']).toString('utf8'));
};

const assertLoadableLayout = (entries: Record<string, Uint8Array>) => {
    const names = Object.keys(entries);
    const manifest = readManifest(entries);
    const ids = (manifest.animations ?? []).map(animation => animation.id);

    expect(ids.length).toBeGreaterThan(0);
    ids.forEach(id => expect(names).toContain(`animations/${id}.json`));
};

describe('trade-type guide animation assets', () => {
    it.each(GUIDE_ANIMATION_KEYS)('has a dark asset for "%s" that loads like its light sibling', key => {
        const dark_file = toBasename(getContractDescriptionAnimationSrc(key, true));
        const light_file = toBasename(getContractDescriptionAnimationSrc(key, false));

        const dark_entries = readLottieEntries(dark_file);
        const light_entries = readLottieEntries(light_file);

        // The dark archive must be a renderable dotLottie on its own terms...
        assertLoadableLayout(dark_entries);
        // ...and packaged in the same format the app already loads for light mode.
        expect(readManifest(dark_entries).version).toBe(readManifest(light_entries).version);
    });
});
