const { ContextReplacementPlugin } = require('webpack');

// Single source of truth for locales the app supports. Webpack's ContextReplacementPlugin
// uses this to drop unused dayjs locale files (~600KB raw across 144 locales) from each bundle.
// Mirror any locale list change here in one place — every package/build/constants.js consumes
// this helper so all bundles stay in sync.
const SUPPORTED_LOCALES = [
    'en',
    'en-gb',
    'ar',
    'de',
    'es',
    'fr',
    'id',
    'it',
    'ja',
    'ko',
    'mn',
    'nl',
    'pl',
    'pt',
    'ru',
    'sw',
    'th',
    'tr',
    'ur',
    'vi',
    'zh-cn',
    'zh-tw',
    'km',
    'bn',
    'si',
    'ta',
];

const createDayjsLocalePlugin = () =>
    new ContextReplacementPlugin(/dayjs[/\\]locale$/, new RegExp(`^\\.\\/(?:${SUPPORTED_LOCALES.join('|')})\\.js$`));

module.exports = { createDayjsLocalePlugin, SUPPORTED_LOCALES };
