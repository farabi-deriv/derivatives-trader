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
    // Trading state survives a logout: the active pair ('trade_store'), the tab strips and each
    // tab's saved parameters ('open_markets_v2' / 'open_markets_automation_v2',
    // 'tab_trade_params_v2' / 'tab_trade_params_automation_v2' — see trader's
    // AppV2/Utils/open-markets-utils and tab-trade-params-utils). They are market configuration,
    // not account state; wiping them cost a re-logging-in user every tab and every saved value.
    const kept_session_keys = ['trade_store', 'open_markets', 'tab_trade_params'];
    Object.keys(sessionStorage)
        .filter(key => !kept_session_keys.some(kept => key === kept || key.startsWith(`${kept}_`)))
        .forEach(key => sessionStorage.removeItem(key));
    return response;
};
