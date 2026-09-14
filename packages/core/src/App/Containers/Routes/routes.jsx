import React from 'react';
import { withRouter } from 'react-router';
import PropTypes from 'prop-types';

import { UILoader } from '@deriv/components';
import { urlForLanguage } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';

import BinaryRoutes from 'App/Components/Routes';

const ErrorLazy = React.lazy(() => import(/* webpackChunkName: "error-component" */ 'App/Components/Elements/Errors'));

const Error = props => (
    <React.Suspense fallback={<UILoader />}>
        <ErrorLazy {...props} />
    </React.Suspense>
);

const Routes = observer(({ history, location, passthrough }) => {
    const { client, common } = useStore();
    const { is_logged_in, is_logging_in } = client;
    const { current_language, error, has_error, addRouteHistoryItem, setInitialRouteHistoryItem } = common;
    const initial_route = React.useRef(null);
    const unlisten_to_change = React.useRef(null);

    React.useEffect(() => {
        if (!unlisten_to_change.current && !initial_route.current) {
            initial_route.current = location.pathname;
        }

        setInitialRouteHistoryItem(history.location);

        unlisten_to_change.current = history.listen((route_to, action) => {
            if (['PUSH', 'POP'].includes(action)) addRouteHistoryItem({ ...route_to, action });
        });

        return () => {
            if (typeof unlisten_to_change.current === 'function') {
                unlisten_to_change.current();
                unlisten_to_change.current = null;
                initial_route.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the URL's `lang` in step with the active language. Two cases need it: on load the URL
    // may carry a differently-cased value (`getInitialLanguage` upper-cases what it reads), and a
    // react-router navigation rebuilds the URL from a path alone, dropping the param entirely.
    React.useEffect(() => {
        const url_lang = new URLSearchParams(window.location.search).get('lang');
        const expected_lang = current_language === 'EN' ? null : current_language;
        if (url_lang !== expected_lang) {
            window.history.replaceState({}, document.title, urlForLanguage(current_language));
        }
    }, [location.pathname, current_language]);

    if (has_error) {
        return <Error {...error} />;
    }

    return <BinaryRoutes is_logged_in={is_logged_in} is_logging_in={is_logging_in} passthrough={passthrough} />;
});

Routes.propTypes = {
    history: PropTypes.object,
    location: PropTypes.object,
    passthrough: PropTypes.object,
};

// need to wrap withRouter around connect
// to prevent updates on <BinaryRoutes /> from being blocked
export default withRouter(Routes);
