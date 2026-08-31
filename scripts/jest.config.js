// Standalone Jest project for the root-level tooling scripts (knip/bundle/structural safety net).
// The root jest.config.js only discovers packages/* projects, so these plain-CJS unit tests run via
// `npm run test:scripts`.
module.exports = {
    displayName: 'scripts',
    rootDir: '..',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/scripts/__tests__/**/*.spec.js'],
    transform: {},
};
