import { isFeatureFlags } from '../feature-flags';

describe('feature-flags after chat-gating removal', () => {
    it('[DCR-007] accepts a config with only the tracking flags (chat keys no longer required)', () => {
        expect(isFeatureFlags({ tracking_rudderstack: true, tracking_posthog: false })).toBe(true);
    });

    it('[DCR-007] still rejects an object missing the tracking flags', () => {
        expect(isFeatureFlags({ tracking_rudderstack: true })).toBe(false);
        expect(isFeatureFlags(null)).toBe(false);
    });
});
