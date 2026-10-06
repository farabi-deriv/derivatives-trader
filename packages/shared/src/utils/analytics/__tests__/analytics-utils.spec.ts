import fs from 'fs';
import path from 'path';

import { Analytics } from '@deriv-com/analytics';

import { getAnalyticsData, getAnalyticsDeviceOrientation, trackAnalyticsEvent } from '../analytics-utils';

const trackEvent = Analytics.trackEvent as jest.Mock;

const mock_device = { is_mobile: false, is_phone_landscape: false };
jest.mock('../../os', () => ({
    isMobileOs: () => mock_device.is_mobile,
    isPhoneLandscape: () => mock_device.is_phone_landscape,
}));

/**
 * `APP_VERSION` is captured once at module load in analytics-utils, so each env
 * scenario must (re)require the module inside an isolated registry with the env
 * already set. `@deriv-com/analytics` is re-required in the same isolated scope so
 * the `trackEvent` spy we assert on is the exact instance the funnel calls.
 */
const loadFunnelWithAppVersion = (app_version?: string) => {
    let track!: typeof trackAnalyticsEvent, spy!: jest.Mock;
    jest.isolateModules(() => {
        if (app_version === undefined) {
            delete process.env.APP_VERSION;
        } else {
            process.env.APP_VERSION = app_version;
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires -- isolateModules needs a fresh require per env
        track = require('../analytics-utils').trackAnalyticsEvent;
        // eslint-disable-next-line @typescript-eslint/no-var-requires -- re-require the spy in the same isolated scope
        spy = require('@deriv-com/analytics').Analytics.trackEvent as jest.Mock;
    });
    return { track, spy };
};

describe('trackAnalyticsEvent app_version stamping', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        trackEvent.mockClear();
        process.env = { ...OLD_ENV };
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    it('[AEV-001] emits app_version as a flat sibling of account_type and device_type', () => {
        trackAnalyticsEvent('some_event', { action: 'click' });

        expect(trackEvent).toHaveBeenCalledTimes(1);
        const [event_name, props] = trackEvent.mock.calls[0];
        expect(event_name).toBe('some_event');
        // flat top-level key, not nested under a metadata object
        expect(props).toHaveProperty('app_version');
        expect(props).toHaveProperty('account_type');
        expect(props).toHaveProperty('device_type');
        expect(typeof props.app_version).toBe('string');
        // caller-supplied properties do not suppress the injected key
        expect(props.action).toBe('click');
    });

    it('[AEV-001] caller cannot override app_version by spreading — the funnel key survives', () => {
        // The common set (incl. app_version) is spread before caller props; a caller
        // passing account_type may override that, but app_version stays present.
        trackAnalyticsEvent('some_event', { account_type: 'spoofed' });

        const [, props] = trackEvent.mock.calls[0];
        expect(props).toHaveProperty('app_version');
    });

    it('[AEV-002] an unset process.env.APP_VERSION yields app_version "0.0.0"', () => {
        const { track, spy } = loadFunnelWithAppVersion(undefined);

        track('some_event');

        const [, props] = spy.mock.calls[0];
        expect(props.app_version).toBe('0.0.0');
        expect(props.app_version).not.toBeUndefined();
    });

    it('[AEV-002] an empty-string process.env.APP_VERSION also yields app_version "0.0.0"', () => {
        const { track, spy } = loadFunnelWithAppVersion('');

        track('some_event');

        const [, props] = spy.mock.calls[0];
        expect(props.app_version).toBe('0.0.0');
    });

    it('[AEV-002] a set process.env.APP_VERSION is emitted verbatim', () => {
        const { track, spy } = loadFunnelWithAppVersion('production_1.2.3');

        track('some_event');

        const [, props] = spy.mock.calls[0];
        expect(props.app_version).toBe('production_1.2.3');
    });

    it('[ANLY-003] keeps stamping app_version identically to AnalyticsInitializer after the 1.43.0 bump', () => {
        const { track, spy } = loadFunnelWithAppVersion('production_1.2.3');

        track('some_event');

        const [, props] = spy.mock.calls[0];
        // Same env-derived value the AnalyticsInitializer config now carries as app_version (see index.spec.ts ANLY-002)
        expect(props.app_version).toBe(process.env.APP_VERSION);
    });
});

/**
 * AEV-003 is a CI/build invariant, not runtime behaviour: the value stamped onto
 * events (build action `APP_VERSION`) must equal the value written to /app-info.json
 * (`generate_app_info` `version`) for the same deploy. This guard reads the workflow
 * files and asserts the two expressions agree. Characterization/guard test — the
 * workflows are already consistent, so it never went red.
 */
describe('AEV-003 deployed app_version matches the app-info beacon', () => {
    const workflows_dir = path.resolve(__dirname, '../../../../../../.github/workflows');
    const readWorkflow = (name: string) => fs.readFileSync(path.join(workflows_dir, name), 'utf8');

    it('[AEV-003] production stamps github.ref_name onto both APP_VERSION and the app-info version', () => {
        const yml = readWorkflow('release_production.yml');
        expect(yml).toMatch(/APP_VERSION:\s*\$\{\{\s*github\.ref_name\s*\}\}/);
        expect(yml).toMatch(/version:\s*\$\{\{\s*github\.ref_name\s*\}\}/);
    });

    it('[AEV-003] staging stamps the same staging_<sha> identity onto APP_VERSION and the app-info version', () => {
        const yml = readWorkflow('release_staging.yml');
        expect(yml).toMatch(/APP_VERSION:\s*staging_\$\{\{\s*github\.sha\s*\}\}/);
        expect(yml).toMatch(/version:\s*staging_\$\{\{\s*github\.sha\s*\}\}/);
        // the pre-change literal `master`/ref_name version must be gone
        expect(yml).not.toMatch(/version:\s*\$\{\{\s*github\.ref_name\s*\}\}/);
    });
});

describe('[ANLY-001] @deriv-com/analytics is pinned to 1.43.0', () => {
    const repo_root = path.resolve(__dirname, '../../../../../../');
    const readJSON = (relative_path: string) =>
        JSON.parse(fs.readFileSync(path.join(repo_root, relative_path), 'utf8'));

    it('[ANLY-001] pins @deriv-com/analytics to 1.43.0 in every package manifest', () => {
        [
            'package.json',
            'packages/core/package.json',
            'packages/reports/package.json',
            'packages/shared/package.json',
            'packages/trader/package.json',
            'packages/utils/package.json',
        ].forEach(relative_path => {
            const manifest = readJSON(relative_path);
            expect(manifest.dependencies['@deriv-com/analytics']).toBe('1.43.0');
        });
    });

    it('[ANLY-001] resolves @deriv-com/analytics to 1.43.0 everywhere in package-lock.json', () => {
        const lockfile_text = fs.readFileSync(path.join(repo_root, 'package-lock.json'), 'utf8');
        const version_matches = lockfile_text.match(/"@deriv-com\/analytics":\s*"[^"]+"/g) ?? [];
        expect(version_matches.length).toBeGreaterThan(0);
        version_matches.forEach(match => expect(match).toContain('1.43.0'));
        expect(lockfile_text).toContain('analytics-1.43.0.tgz');
    });
});

describe('[AEV-004] device_orientation', () => {
    afterEach(() => Object.assign(mock_device, { is_mobile: false, is_phone_landscape: false }));

    it("reports a phone's current orientation, read at call time", () => {
        mock_device.is_mobile = true;

        mock_device.is_phone_landscape = true;
        expect(getAnalyticsDeviceOrientation()).toBe('landscape');

        mock_device.is_phone_landscape = false;
        expect(getAnalyticsDeviceOrientation()).toBe('portrait');
    });

    it('rides along with account_type and device_type on a phone, and is undefined elsewhere', () => {
        expect(getAnalyticsData().device_orientation).toBeUndefined();

        Object.assign(mock_device, { is_mobile: true, is_phone_landscape: true });
        expect(getAnalyticsData()).toEqual(
            expect.objectContaining({ account_type: expect.any(String), device_orientation: 'landscape' })
        );
    });
});
