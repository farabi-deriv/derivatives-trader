import { getAccountId, getPropertyValue, getSocketURL, mapErrorMessage } from '@deriv/shared';
import { Analytics } from '@deriv-com/analytics';
import { localize } from '@deriv-com/translations';

import WS from './ws-methods';

import ServerTime from '_common/base/server_time';

let client_store, common_store;

// TODO: update commented statements to the corresponding functions from app
const BinarySocketGeneral = (() => {
    // Removed session management variables - not needed for trading app

    let responseTimeoutErrorTimer = null;

    const onDisconnect = () => {
        clearTimeout(responseTimeoutErrorTimer);
        common_store.setIsSocketOpened(false);
    };

    const onConnectionError = () => {
        // Repeated refused handshakes are the WS server's only signal for stale session cookies,
        // but at the socket layer they are indistinguishable from plain network trouble (browsers
        // expose no HTTP status for a failed WS handshake). handleWhoAmI is the one validation
        // path (shared with the visibility/focus checks): it verifies over REST using the same
        // session state the WS server validates and, on a confirmed 401, runs the canonical
        // cleanUp() — which clears credentials including the options_account_id cookie and
        // reconnects, resolving the socket URL to the public server. For plain network trouble
        // it does nothing and the network monitor keeps retrying with backoff.
        if (getAccountId()) {
            client_store.handleWhoAmI();
            return;
        }

        // Already on the public connection: no session involved — genuine connectivity problem.
        common_store.setError(true, {
            message: localize('Connection failed. Please refresh this page to continue.'),
        });
    };

    const onOpen = is_ready => {
        responseTimeoutErrorTimer = setTimeout(() => {
            const expectedResponseTypes = WS?.get?.()?.expect_response_types || {};
            const pendingResponseTypes = Object.keys(expectedResponseTypes).filter(
                key => expectedResponseTypes[key].state === 'pending'
            );

            const error = new Error('deriv-api: no message received after 30s');
            error.userId = client_store?.loginid;

            // Wrapped in a try/catch so a reporting failure can never surface as an
            // unhandled error from this timer callback.
            try {
                Analytics.trackEvent('websocket_timeout', {
                    message: error.message,
                    websocketUrl: getSocketURL(),
                    pendingResponseTypes,
                });
            } catch (reportingError) {
                // eslint-disable-next-line no-console
                console.error('Failed to report error to analytics:', reportingError);
            }
        }, 30000);

        if (is_ready) {
            ServerTime.init(() => common_store.setServerTime(ServerTime.get()));
            common_store.setIsSocketOpened(true);
        }
    };

    const onMessage = response => {
        clearTimeout(responseTimeoutErrorTimer);
        handleError(response);

        switch (response.msg_type) {
            case 'balance':
                // Always process authorization on balance response
                // This handles both initial connection and reconnection
                if (response.balance && response.balance.loginid) {
                    const loginid_changed = response.balance.loginid !== client_store.loginid;
                    const not_yet_authorized = !client_store.is_authorize;

                    // Only call authorizeAccount when needed
                    if (loginid_changed || not_yet_authorized) {
                        // Clear contract markers when account changes to prevent showing previous account's contracts
                        if (loginid_changed) {
                            client_store.root_store.contract_trade.clearContracts();
                        }
                        authorizeAccount(response);
                    }
                }
                break;
            // no default
        }
    };

    const setBalanceActiveAccount = obj_balance => {
        client_store.setBalanceActiveAccount(obj_balance);
    };

    const handleError = response => {
        const msg_type = response.msg_type;
        const error_code = getPropertyValue(response, ['error', 'code']);
        switch (error_code) {
            case 'WrongResponse':
                if (msg_type === 'balance') {
                    WS.forgetAll('balance').then(subscribeBalance);
                }
                break;
            case 'RateLimit':
                common_store.setError(true, {
                    message: localize('You have reached the rate limit of requests per second. Please try later.'),
                });
                break;
            case 'InvalidAppID':
                common_store.setError(true, { message: mapErrorMessage(response.error) });
                break;
            case 'DisabledClient':
                common_store.setError(true, { message: mapErrorMessage(response.error) });
                break;
            case 'AuthorizationRequired': {
                if (msg_type === 'buy' || msg_type?.startsWith('auto_')) {
                    return;
                }
                if (getAccountId()) {
                    client_store.logout();
                }
                break;
            }
            case 'InvalidToken': {
                if (!getAccountId()) break;
                // Give logout() a bounded window to clear the stale credentials, then reload
                // regardless — its fetch has no timeout and can hang under exactly the flaky
                // network this handles. A premature reload is safe: boot's whoami-401 cleanup
                // clears the credentials (including the cookie) before any WS connection opens.
                Promise.race([client_store.logout(), new Promise(resolve => setTimeout(resolve, 5000))]).finally(() =>
                    window.location.reload()
                );
                break;
            }
            default:
                break;
        }
    };

    const subscribeBalance = () => {
        WS.subscribeBalance(ResponseHandlers.balanceActiveAccount);
    };

    const init = store => {
        client_store = store.client;
        common_store = store.common;

        WS.setOnReconnect(() => {
            if (getAccountId()) subscribeBalance();
        });

        return {
            onDisconnect,
            onOpen,
            onMessage,
            onConnectionError,
        };
    };

    const authorizeAccount = response => {
        // Balance response now contains authorization data
        // Transform if needed to match authorize format
        let authorize_data = response;

        // If response is balance format, transform to authorize format
        if (response.balance && !response.authorize) {
            authorize_data = {
                authorize: {
                    loginid: response.balance.loginid,
                    balance: response.balance.balance,
                    currency: response.balance.currency,
                    email: response.balance.email || '',
                    landing_company_name: response.balance.landing_company_name || '',
                    country: response.balance.country || '',
                    user_id: response.balance.user_id || '',
                    preferred_language: response.balance.preferred_language || '',
                },
            };
        }

        client_store.responseAuthorize(authorize_data);
        client_store.setIsAuthorize(true); // Set BEFORE anything that depends on it
        subscribeBalance(); // Continue balance subscription
    };

    return {
        init,
        setBalanceActiveAccount,
        authorizeAccount,
    };
})();

export default BinarySocketGeneral;

const ResponseHandlers = (() => {
    const balanceActiveAccount = response => {
        if (!response.error) {
            // Check if this is the first balance response (contains auth data)
            if (!client_store.is_authorize && response.balance && response.balance.loginid) {
                // This is the authorization response - handled in onMessage
                return;
            }

            // Regular balance update
            const balance = response.balance?.balance ?? response.balance;

            // Only update if we have a valid balance
            if (balance !== undefined && balance !== null && balance !== '') {
                BinarySocketGeneral.setBalanceActiveAccount({
                    balance,
                    loginid: client_store?.loginid,
                });
            }
        }
    };

    // Removed balanceOtherAccounts - not needed for single account

    return {
        balanceActiveAccount,
    };
})();
