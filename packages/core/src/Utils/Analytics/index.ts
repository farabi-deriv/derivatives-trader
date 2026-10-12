import FIREBASE_INIT_DATA from '@deriv/api/src/remote_config.json';
import { Analytics } from '@deriv-com/analytics';

import { FeatureFlags, isFeatureFlags } from '../../types/feature-flags';

const APP_VERSION = process.env.APP_VERSION || '0.0.0';

/**
 * Fetches remote configuration with proper error handling and logging
 */
const fetchRemoteConfig = async (url: string): Promise<FeatureFlags> => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Validate the response structure
        if (!isFeatureFlags(data)) {
            throw new Error('Invalid feature flags structure received from remote config');
        }

        return data;
    } catch (error) {
        // Remote config fetch failed, fall back to local config
        // This is expected during development or when remote config is unavailable
        return FIREBASE_INIT_DATA as FeatureFlags;
    }
};

export const AnalyticsInitializer = async () => {
    // Initialize GTM
    (function (w: any, d: Document, s: string, l: string, i: string) {
        w[l] = w[l] || [];
        w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
        const f = d.getElementsByTagName(s)[0];
        const j = d.createElement(s) as HTMLScriptElement;
        const dl = l !== 'dataLayer' ? `&l=${l}` : '';
        j.async = true;
        j.src = `https://www.googletagmanager.com/gtm.js?id=${i}${dl}`;
        f?.parentNode?.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', 'GTM-NF7884S');

    if (!process.env.REMOTE_CONFIG_URL) {
        return;
    }

    const flags = await fetchRemoteConfig(process.env.REMOTE_CONFIG_URL);

    // Initialize RudderStack and/or PostHog based on feature flags
    // Note: posthogKey and posthogHost are supported in @deriv-com/analytics v1.33.0+
    const hasRudderStack = !!(process.env.RUDDERSTACK_KEY && flags.tracking_rudderstack);
    const hasPostHog = !!(process.env.POSTHOG_KEY && flags.tracking_posthog);

    // Initialize Analytics if at least one service is enabled
    if (hasRudderStack || hasPostHog) {
        const config: {
            rudderstackKey?: string;
            app_version?: string;
            posthogOptions?: {
                apiKey: string;
                allowedDomains?: string[];
                config?: {
                    api_host?: string;
                    autocapture?: boolean;
                    advanced_disable_feature_flags?: boolean;
                    capture_exceptions?: boolean;
                };
            };
        } = { app_version: APP_VERSION };

        if (hasRudderStack) {
            config.rudderstackKey = process.env.RUDDERSTACK_KEY!;
        }

        if (hasPostHog) {
            config.posthogOptions = {
                apiKey: process.env.POSTHOG_KEY!,
                config: {
                    autocapture: false,
                    // Keeps the /flags request (PostHog remote config drives web vitals) but stops flag evaluation.
                    advanced_disable_feature_flags: true,
                    // Capture uncaught runtime errors automatically, replacing DataDog RUM's error collection.
                    capture_exceptions: true,
                    ...(process.env.POSTHOG_HOST && {
                        api_host: process.env.POSTHOG_HOST,
                    }),
                },
            };
        }

        await Analytics?.initialise(config);
    }
};
