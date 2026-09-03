import { getLogoutURL, removeCookies } from '@deriv/shared';

import WS from './ws-methods';

import SocketCache from '_common/base/socket_cache';

/**
 * Request logout via REST API endpoint
 * @returns Promise with logout response
 */
export const requestRestLogout = async () => {
    try {
        const logoutUrl = getLogoutURL();

        // Step 1: Get logout URL and token
        const response = await fetch(logoutUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();

            // Step 2: Call the logout_url to complete logout
            if (data.logout_url) {
                await fetch(data.logout_url, {
                    method: 'GET',
                    credentials: 'include',
                });
            }
        }

        // Return success response - cleanup is handled by client-store.js
        return { logout: 1 };
    } catch (error) {
        // Return success response even if REST call fails - cleanup is handled by client-store.js
        return { logout: 1 };
    }
};

/**
 * Request logout via WebSocket (legacy method for backward compatibility)
 * @returns Promise with logout response
 */
export const requestLogout = () => WS.logout().then(doLogout);

const doLogout = response => {
    if (response.logout !== 1) return undefined;
    removeCookies('affiliate_token', 'affiliate_tracking', 'onfido_token', 'gclid', 'utm_data');
    localStorage.removeItem('closed_toast_notifications');
    localStorage.removeItem('config.account1');
    localStorage.removeItem('config.tokens');
    localStorage.removeItem('verification_code.system_email_change');
    localStorage.removeItem('verification_code.request_email');
    localStorage.removeItem('new_email.system_email_change');
    localStorage.removeItem('account_id');
    SocketCache.clear();
    Object.keys(sessionStorage)
        .filter(key => key !== 'trade_store')
        .forEach(key => sessionStorage.removeItem(key));
    return response;
};
