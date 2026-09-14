import React from 'react';
import { useLocation, withRouter } from 'react-router';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import { ThemedScrollbars } from '@deriv/components';
import { redirectToLogin } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';
import { Analytics } from '@deriv-com/analytics';
import { useDevice } from '@deriv-com/ui';

const AppContents = observer(({ children }) => {
    const { client, common, ui } = useStore();
    const { isDesktop, isMobile } = useDevice();
    const location = useLocation();
    const has_access_denied_error = location.search.includes('access_denied');

    const { is_logged_in, should_redirect_user_to_login, setShouldRedirectToLogin } = client;
    const { is_app_disabled, active_sidebar_flyout, is_route_modal_on, notifyAppInstall, setAppContentsScrollRef } = ui;

    const scroll_ref = React.useRef(null);
    const child_ref = React.useRef(null);

    React.useEffect(() => {
        if (should_redirect_user_to_login && client.is_client_store_initialized) {
            // Don't redirect if we have an account_id (user is authenticated)
            const hasAccountId = !!localStorage.getItem('account_id');

            if (hasAccountId) {
                setShouldRedirectToLogin(false);
            } else {
                setShouldRedirectToLogin(false);
                redirectToLogin(common.current_language);
            }
        }
    }, [should_redirect_user_to_login, is_logged_in, setShouldRedirectToLogin, client.is_client_store_initialized]);

    React.useEffect(() => {
        if (scroll_ref.current) setAppContentsScrollRef(scroll_ref);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        Analytics.pageView(window.location.href, {
            loggedIn: is_logged_in,
            device_type: isMobile ? 'mobile' : 'desktop',
            network_rtt: navigator?.connection?.rtt,
            network_type: navigator?.connection?.effectiveType,
            network_downlink: navigator?.connection?.downlink,
        });
        // react-hooks/exhaustive-deps
    }, [window.location.href]);

    React.useEffect(() => {
        // Gets the reference of the child element and scrolls it to the top
        if (child_ref.current) {
            child_ref.current.scrollTop = 0;
        }
    }, [location?.pathname]);

    React.useEffect(() => {
        const handleInstallPrompt = e => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            // Update UI notify the user they can install the PWA
            notifyAppInstall(e);
        };
        window.addEventListener('beforeinstallprompt', handleInstallPrompt);

        return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    }, [notifyAppInstall]);

    return (
        <div
            id='app_contents'
            className={classNames('app-contents', {
                'app-contents--show-positions-drawer': active_sidebar_flyout,
                'app-contents--is-disabled': is_app_disabled,
                'app-contents--is-mobile': isMobile,
                'app-contents--is-route-modal': is_route_modal_on,
                'app-contents--is-hidden': has_access_denied_error,
                'app-contents--is-dtrader-v2': isMobile,
            })}
            ref={scroll_ref}
        >
            {isMobile && children}
            {!isMobile && (
                /* Calculate height of user screen and offset height of header and footer */
                <ThemedScrollbars height={isDesktop ? '100vh' : undefined} has_horizontal refSetter={child_ref}>
                    {children}
                </ThemedScrollbars>
            )}
        </div>
    );
});

AppContents.propTypes = {
    children: PropTypes.any,
};

export default withRouter(AppContents);
