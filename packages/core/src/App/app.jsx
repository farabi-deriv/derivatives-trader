import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import PropTypes from 'prop-types';

import { APIProvider } from '@deriv/api';
import { Loading } from '@deriv/components';
import { initFormErrorMessages, setUrlLanguage, setWebsocket } from '@deriv/shared';
import { StoreProvider } from '@deriv/stores';
import { Analytics } from '@deriv-com/analytics';
import { BreakpointProvider } from '@deriv-com/quill-ui';
import { getInitialLanguage, initializeI18n, TranslationProvider } from '@deriv-com/translations';

import WS from 'Services/ws-methods';

import { FORM_ERROR_MESSAGES } from '../Constants/form-error-messages';

import AppContent from './AppContent';

import 'Sass/app.scss';

const App = ({ root_store }) => {
    const i18nInstance = initializeI18n({
        cdnUrl: `${process.env.CROWDIN_URL}/${process.env.R2_PROJECT_NAME}/${process.env.CROWDIN_BRANCH_NAME}`,
    });
    const l = window.location;
    const base = l.pathname.split('/')[1];
    const has_base = /^\/(br_)/.test(l.pathname);
    const { preferred_language } = root_store.client;
    const language = preferred_language ?? getInitialLanguage();

    React.useEffect(() => {
        sessionStorage.removeItem('redirect_url');
        const loadSmartchartsStyles = () => {
            import('@deriv-com/smartcharts-champion/dist/smartcharts.css');
        };

        // `?theme=` deep link is applied as an explicit choice, exactly like tapping the theme
        // switcher: it renders with first priority and the Theme menu shows it as the selected
        // option (setDarkMode records it as theme_preference).
        const urlParams = new URLSearchParams(window.location.search);
        const themeParam = urlParams.get('theme');
        if (themeParam === 'dark') {
            root_store.ui.setDarkMode(true);
        } else if (themeParam === 'light') {
            root_store.ui.setDarkMode(false);
        }

        // TODO: [translation-to-shared]: add translation implemnentation in shared
        setUrlLanguage(language);
        initFormErrorMessages(FORM_ERROR_MESSAGES);
        root_store.common.setPlatform();
        loadSmartchartsStyles();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const platform_passthrough = {
        root_store,
        WS,
        i18nInstance,
        language,
    };

    setWebsocket(WS);

    React.useEffect(() => {
        Analytics.reset();
    }, []);

    return (
        <Router basename={has_base ? `/${base}` : null}>
            <StoreProvider store={root_store}>
                <BreakpointProvider>
                    <APIProvider>
                        <TranslationProvider defaultLang={language} i18nInstance={i18nInstance}>
                            {/* This is required as translation provider uses suspense to reload language */}
                            <React.Suspense fallback={<Loading />}>
                                <AppContent passthrough={platform_passthrough} />
                            </React.Suspense>
                        </TranslationProvider>
                    </APIProvider>
                </BreakpointProvider>
            </StoreProvider>
        </Router>
    );
};

App.propTypes = {
    root_store: PropTypes.object,
};

export default App;
