/**
 * Types shim for @deriv-com/translations.
 *
 * The package sets `types` to ./dist/index.d.ts, which it has not shipped since
 * 1.4.6 — declarations now land under dist/src. The entry file it does ship,
 * dist/src/index.d.ts, re-exports from '../utils/index', a path that lands
 * outside dist/src where no declarations exist, so every export silently
 * degrades to `any`.
 *
 * The leaf declaration files are internally consistent, so re-export through
 * them. This is an ambient declaration rather than a tsconfig `paths` entry so
 * that dependency analysis still sees the real import in each package.
 * Delete this once the package ships a correct types pointer.
 */
declare module '@deriv-com/translations' {
    export {
        localize,
        getInitialLanguage,
        loadIncontextTranslation,
        getAllowedLanguages,
        initializeI18n,
    } from '@deriv-com/translations/dist/src/utils/index';
    export { Localize } from '@deriv-com/translations/dist/src/components/index';
    export { useTranslations } from '@deriv-com/translations/dist/src/hooks/index';
    export { TranslationProvider } from '@deriv-com/translations/dist/src/provider/index';
}
