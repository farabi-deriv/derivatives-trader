/**
 * Wraps the identity-like `translation.mock.js` so one key can read in two languages (it prefixes
 * non-English text with the language code). Mirrors the two react-i18next properties the #960 fix
 * relies on: `useTranslations()` re-renders on `languageChanged`, and the `localize` it returns is
 * bound to that render's language — so a callback omitting it from its deps keeps the old text.
 *
 * Reference it lazily inside `jest.mock`'s callback; `jest.mock` is hoisted above imports.
 */
const createLanguageAwareTranslationsMock = () => {
    const shared = jest.requireActual('@deriv-com/translations');
    const react = jest.requireActual('react');
    // From the module export, not `useTranslations()`: this runs at import time, and the real hook
    // uses `useContext`/`useTranslation` and throws off-render.
    const { instance } = shared;

    const interpolate = (text, values) =>
        text.replace(/{{(\w+)}}/g, (match, key) => {
            return key in values ? String(values[key]) : match;
        });

    const translate = (lang, text) => {
        if (lang === 'EN' || text.includes('{{') || text.startsWith(`${lang}_`)) {
            return text;
        }
        return `${lang}_${text}`;
    };

    const useLanguageAwareTranslations = () => {
        const [, forceUpdate] = react.useReducer(count => count + 1, 0);
        react.useEffect(() => {
            instance.on('languageChanged', forceUpdate);
            return () => instance.off('languageChanged', forceUpdate);
        }, []);
        const lang = instance.language;
        return {
            ...shared.useTranslations(),
            currentLang: lang,
            localize: (text, values = {}) => interpolate(translate(lang, text), values),
        };
    };

    return {
        ...shared,
        // Rendered as an element, not invoked as a plain function: `shared.Localize(props)` bypasses
        // React entirely and would throw `Invalid hook call` the day the underlying `Localize`
        // becomes subscribed (or is otherwise given a hook).
        Localize: props =>
            react.createElement(shared.Localize, {
                ...props,
                i18n_default_text: translate(instance.language, props.i18n_default_text ?? ''),
            }),
        localize: (text, values = {}) => interpolate(translate(instance.language, text), values),
        useTranslations: useLanguageAwareTranslations,
    };
};

module.exports = { createLanguageAwareTranslationsMock };
