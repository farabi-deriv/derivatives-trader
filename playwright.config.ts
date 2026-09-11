import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/**
 * TEST_ENV selects playwright/.env.staging or .env.production (default: staging).
 */
const VALID_ENVS = ['staging', 'production'] as const;
type ValidEnv = (typeof VALID_ENVS)[number];

const testEnvRaw = process.env.TEST_ENV || 'staging';
if (!(VALID_ENVS as readonly string[]).includes(testEnvRaw)) {
    throw new Error(`Invalid TEST_ENV: '${testEnvRaw}'. Expected one of: ${VALID_ENVS.join(', ')}`);
}
const testEnv: ValidEnv = testEnvRaw as ValidEnv;
const envFile = path.resolve(__dirname, 'playwright', `.env.${testEnv}`);

// PLAYWRIGHT_MERGE_REPORTS=1: merge-only CI jobs skip loading credentials.
const isMergeOnly = process.env.PLAYWRIGHT_MERGE_REPORTS === '1';

if (!isMergeOnly) {
    if (!fs.existsSync(envFile)) {
        const message =
            `Environment file not found: ${envFile}\n` +
            `TEST_ENV is '${testEnv}' (default: 'staging'). Ensure playwright/.env.${testEnv} exists.\n` +
            `Copy playwright/.env.example to playwright/.env.${testEnv} and fill in credentials.`;

        if (process.env.CI) {
            throw new Error(message);
        }
        console.warn(`⚠️  ${message}`);
    }

    dotenv.config({ path: envFile });
}

const chromiumLaunchArgs = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor,ThirdPartyCookiesPhaseout,TestThirdPartyCookiePhaseout',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
];

export default defineConfig({
    testDir: './playwright/tests',
    timeout: 600000,
    expect: {
        timeout: 45000,
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 4 : undefined,

    // CI test jobs (TESTDINO_STREAM=1): blob + live TestDino. Merge jobs: html/json only.
    reporter: process.env.CI
        ? process.env.TESTDINO_STREAM === '1'
            ? [
                  ['list'],
                  ['blob'],
                  ...(process.env.TESTDINO_TOKEN
                      ? [
                            [
                                '@testdino/playwright',
                                {
                                    token: process.env.TESTDINO_TOKEN,
                                    serverUrl: 'https://reporter.testdino.com',
                                    ciRunId: process.env.TESTDINO_CI_RUN_ID,
                                    ...(process.env.TESTDINO_TAG ? { tags: [process.env.TESTDINO_TAG] } : {}),
                                },
                            ] as [string, Record<string, unknown>],
                        ]
                      : []),
              ]
            : [
                  ['list'],
                  ['html', { outputFolder: './playwright/playwright-report' }],
                  ['json', { outputFile: './playwright/playwright-report/results.json' }],
              ]
        : [
              ['list'],
              ['html', { outputFolder: './playwright/playwright-report' }],
              ['json', { outputFile: './playwright/playwright-report/results.json' }],
          ],

    use: {
        baseURL: process.env.BASE_URL || 'https://staging-dtrader.deriv.com',
        permissions: ['geolocation'],
        geolocation: { latitude: 0, longitude: 0 },
        headless: !!process.env.CI,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        launchOptions: {
            slowMo: 0,
        },
        navigationTimeout: 45000,
        actionTimeout: 45000,
        userAgent: 'Playwright-Agent/deriv/1.9',
    },

    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1536, height: 864 },
                userAgent: `${devices['Desktop Chrome'].userAgent} Playwright-Agent/deriv/1.9`,
                launchOptions: {
                    args: chromiumLaunchArgs,
                },
            },
        },
        {
            name: 'chromium-mobile',
            use: {
                ...devices['Pixel 7'],
                viewport: { width: 412, height: 915 },
                userAgent: `${devices['Pixel 7'].userAgent} Playwright-Agent/deriv/1.9`,
                launchOptions: {
                    args: chromiumLaunchArgs,
                },
            },
        },
        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                viewport: { width: 1536, height: 864 },
                userAgent: `${devices['Desktop Firefox'].userAgent} Playwright-Agent/deriv/1.9`,
                launchOptions: {
                    firefoxUserPrefs: {
                        'media.navigator.streams.fake': true,
                        'media.navigator.permission.disabled': true,
                    },
                },
            },
        },
        {
            name: 'webkit',
            use: {
                ...devices['Desktop Safari'],
                viewport: { width: 1536, height: 864 },
                userAgent: `${devices['Desktop Safari'].userAgent} Playwright-Agent/deriv/1.9`,
            },
        },
        {
            name: 'webkit-mobile',
            use: {
                ...devices['iPhone 15 Plus'],
                userAgent: `${devices['iPhone 15 Plus'].userAgent} Playwright-Agent/deriv/1.9`,
            },
        },
    ],

    outputDir: './playwright/test-results',

    webServer:
        process.env.START_SERVER === 'true'
            ? {
                  command: process.env.SERVER_COMMAND || 'npm run dev',
                  url: process.env.SERVER_URL || 'http://localhost:3000',
                  reuseExistingServer: !process.env.CI,
                  timeout: 120000,
              }
            : undefined,
});
