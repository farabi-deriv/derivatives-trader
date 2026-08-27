import React from 'react';

import { getBrandName } from '@deriv/shared';
import { useTranslations } from '@deriv-com/translations';

/**
 * Keeps the browser tab label (`document.title`) in sync with the matched route's title
 * and with the active language. Shared by the `RouteWithSubRoutes` component of
 * `@deriv/components`, `@deriv/core` and `@deriv/reports`, and by the `Reports` container
 * (which resolves the reports sub-page). See issue #951 (deriv-com/derivatives-trader):
 * the tab label kept the previous language until a manual refresh.
 *
 * Two things here are deliberate and must not be "tidied up":
 *
 * 1. **The title is assigned during render, not in a `useEffect`.** Several callers are
 *    nested inside one another: on `/reports/statement` core's `/reports` route writes
 *    "Reports", the `@deriv/reports` router writes "Reports" again, and the `Reports`
 *    container — a descendant of both — writes "Statement". Render runs parent-first, so
 *    the deepest caller writes last and wins, which is what makes the tab read
 *    "Statement | Deriv". React runs effects child-first, so moving this into a `useEffect`
 *    inverts that precedence and every nested reports page regresses to "Reports | Deriv".
 *    The write is idempotent (same inputs produce the same string) so a StrictMode
 *    double-invoke is harmless.
 *
 * 2. **The re-render is triggered by i18next's `languageChanged`, not by the selected
 *    language.** `common.current_language` (MobX) and `useTranslations().currentLang`
 *    (React context) both flip as soon as the user *picks* a language — before the Crowdin
 *    bundle has downloaded — so a title derived at that moment is still the old one.
 *    `languageChanged` is emitted by i18next only once the new bundle is loaded, which is
 *    the moment `getTitle()` starts returning translated text.
 *
 * @param getTitle - Returns the localized page title. When omitted, or when it returns an
 * empty string, the tab shows the brand name on its own.
 */
export const useDocumentTitle = (getTitle?: () => string) => {
    const { instance } = useTranslations();
    const [, refreshTitle] = React.useReducer((count: number) => count + 1, 0);

    React.useEffect(() => {
        // Guarded so a partially mocked i18next instance degrades to a single render-phase
        // write — the pre-fix behaviour — instead of throwing.
        instance?.on?.('languageChanged', refreshTitle);
        return () => {
            instance?.off?.('languageChanged', refreshTitle);
        };
    }, [instance]);

    const title = getTitle?.() || '';
    const next_title = title ? `${title} | ${getBrandName()}` : getBrandName();

    // Every caller re-renders for reasons unrelated to the title (core's router is an `observer`,
    // so any `client` store mutation re-runs it), so skip the DOM write when nothing changed.
    if (document.title !== next_title) {
        document.title = next_title;
    }
};
