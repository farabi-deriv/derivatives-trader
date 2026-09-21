const flushMicrotasks = () =>
    new Promise<void>(resolve => {
        setTimeout(resolve, 0);
    });

/**
 * `APP_VERSION` is captured once at module load in Analytics/index.ts, so each env
 * scenario must (re)require the module inside an isolated registry with the env
 * already set. `@deriv-com/analytics` is re-required in the same isolated scope so
 * the `initialise` spy we assert on is the exact instance the initializer calls.
 */
describe('AnalyticsInitializer app_version registration', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        process.env = {
            ...OLD_ENV,
            REMOTE_CONFIG_URL: 'https://example.com/remote-config.json',
            RUDDERSTACK_KEY: 'rudderstack-key',
            POSTHOG_KEY: 'posthog-key',
        };
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ tracking_rudderstack: true, tracking_posthog: true }),
        }) as unknown as typeof fetch;
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    const loadInitializerWithAppVersion = (app_version?: string) => {
        let AnalyticsInitializer!: () => Promise<void>, initialise!: jest.Mock;
        jest.isolateModules(() => {
            if (app_version === undefined) {
                delete process.env.APP_VERSION;
            } else {
                process.env.APP_VERSION = app_version;
            }
            // eslint-disable-next-line @typescript-eslint/no-var-requires -- isolateModules needs a fresh require per env
            AnalyticsInitializer = require('../index').AnalyticsInitializer;
            // eslint-disable-next-line @typescript-eslint/no-var-requires -- re-require the spy in the same isolated scope
            initialise = require('@deriv-com/analytics').Analytics.initialise as jest.Mock;
        });
        return { AnalyticsInitializer, initialise };
    };

    it('[ANLY-002] passes a top-level app_version matching process.env.APP_VERSION into Analytics.initialise', async () => {
        const { AnalyticsInitializer, initialise } = loadInitializerWithAppVersion('production_9.9.9');

        await AnalyticsInitializer();
        await flushMicrotasks();

        expect(initialise).toHaveBeenCalledWith(expect.objectContaining({ app_version: 'production_9.9.9' }));
    });

    it('[ANLY-002] falls back to "0.0.0" when APP_VERSION is unset', async () => {
        const { AnalyticsInitializer, initialise } = loadInitializerWithAppVersion(undefined);

        await AnalyticsInitializer();
        await flushMicrotasks();

        expect(initialise).toHaveBeenCalledWith(expect.objectContaining({ app_version: '0.0.0' }));
    });
});
