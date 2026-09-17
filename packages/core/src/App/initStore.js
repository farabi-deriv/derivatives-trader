import { configure } from 'mobx';

import {
    clearAccountId,
    clearAccountTypeParam,
    fetchLegacyHistoryMigrationStatus,
    getAccountId,
    getApiCoreBaseUrl,
    isDemoAccountId,
    removeCookies,
} from '@deriv/shared';

import { checkWhoAmI, fetchMigrationStatus } from 'Services';
import NetworkMonitor from 'Services/network-monitor';
import RootStore from 'Stores';

configure({ enforceActions: 'observed' });

const setStorageEvents = root_store => {
    window.addEventListener('storage', evt => {
        if (evt.key === 'active_loginid') {
            if (localStorage.getItem('active_loginid') === 'null' || !localStorage.getItem('active_loginid')) {
                root_store.client.logout();
            }
            if (document.hidden) {
                window.location.reload();
            }
        }
    });
};

// Must complete before React renders. Handles URL params, validates session via whoami,
// instantiates the RootStore, and runs the synchronous parts of common/ui store init.
// Returns the data needed for both the initial render and the deferred `connectClient` call.
export const initStore = async notification_messages => {
    const url_query_string = window.location.search;
    const url_params = new URLSearchParams(url_query_string);

    if (url_params.get('action') === 'signup') {
        // If a user comes from the signup process, we need to give him a clean setup
        const server_url = localStorage.getItem('config.server_url');
        localStorage.clear();
        if (server_url) localStorage.setItem('config.server_url', server_url);
    }

    // whoami must complete before RootStore is created so we can clear stale credentials
    // before any WebSocket connection attempts. This is a critical safety property.
    let external_id;
    const account_id = getAccountId();

    // Clear any stale account_type param left by a deep link (deprecated; unused by the app).
    clearAccountTypeParam();

    if (account_id) {
        const whoami_result = await checkWhoAmI();

        if (whoami_result.error?.code === 401) {
            // Clear credentials before any WebSocket connection. The options_account_id cookie
            // MUST go too: getAccountId() falls back to it and would repopulate localStorage,
            // booting a "logged in" session with dead cookies — which the WS server then refuses.
            clearAccountId();
            localStorage.removeItem('active_loginid');
            sessionStorage.removeItem('active_loginid');
            localStorage.removeItem('current_account');
            removeCookies('client_information', 'region', 'options_account_id');
        } else if (whoami_result.data?.identity?.external_id) {
            external_id = whoami_result.data.identity.external_id;
        }
    }

    const root_store = new RootStore();

    if (typeof window !== 'undefined') {
        window.__deriv_store = root_store;
    }

    // initStore can re-run in the same page (dev HMR); dispose the previous store's global theme
    // listeners (matchMedia 'change' + the changeTheme autorun) so orphaned instances can't keep
    // writing <html>/<body> theme state after an OS theme flip. First run: no-op.
    window.__deriv_prev_ui_store?.onUnmount?.();
    window.__deriv_prev_ui_store = root_store.ui;

    setStorageEvents(root_store);
    root_store.common.init();
    root_store.ui.init(notification_messages);

    const current_account_id = getAccountId();
    if (current_account_id) {
        root_store.client.setIsLoggingIn(true);
    }

    return { root_store, external_id, account_id: current_account_id };
};

// Runs in the background after React has rendered the app shell. Performs the remaining REST
// checks, opens the WebSocket, and initializes the client store. Components that depend on auth
// state observe the existing `is_logging_in` / `is_client_store_initialized` flags on the client.
export const connectClient = async (root_store, external_id, account_id) => {
    if (!account_id) {
        // 401 path or no session — still init NetworkMonitor so public connection can open
        NetworkMonitor.init(root_store);
        return;
    }

    // accounts-check and migration are independent — run in parallel
    let accounts_response = null;
    const accountsCheckPromise = (async () => {
        try {
            const response = await fetch(`${getApiCoreBaseUrl()}/cfd/v1/options/accounts`, {
                credentials: 'include',
            });
            if (response.ok) {
                accounts_response = await response.json();
                const accounts = accounts_response?.data;
                const target_account = accounts?.find(acc => acc.account_id === account_id);

                if (target_account?.status === 'trading_disabled') {
                    const demo_account = accounts?.find(
                        acc => isDemoAccountId(acc.account_id) && acc.status !== 'trading_disabled'
                    );
                    if (demo_account) {
                        localStorage.setItem('account_id', demo_account.account_id);
                    } else {
                        clearAccountId();
                    }
                }
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to check account status:', e);
        }
    })();

    const migrationPromise = (async () => {
        if (!external_id) return;
        try {
            const migration_result = await fetchMigrationStatus({ client_id: external_id });
            if (migration_result?.data?.metadata?.status === 'fully_migrated') {
                localStorage.setItem('is_migrated_user', 'true');
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to fetch migration status:', e);
        }
    })();

    await Promise.all([accountsCheckPromise, migrationPromise]);

    // After accounts-check has potentially switched account_id in localStorage,
    // open the WebSocket and initialize the client store. client.init is async (waits for
    // authorize + balance) — surface any failure so monitoring/alerting can catch regressions.
    NetworkMonitor.init(root_store);
    try {
        await root_store.client.init(external_id);
        // Reuse the accounts response from the bootstrap check — useDerivativesAccount
        // would otherwise refetch the same data once components mount.
        if (accounts_response && root_store.client.loginid && window.ReactQueryClient) {
            window.ReactQueryClient.setQueryData(
                ['derivatives', 'account', root_store.client.loginid],
                accounts_response
            );
        }
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Client initialisation failed:', e);
    }

    // Legacy history migration — fire-and-forget; menu/reports read result reactively
    fetchLegacyHistoryMigrationStatus().then(response => {
        if ('status' in response) {
            root_store.client.setHasArchivedStatement(response.status === 'complete');
        }
    });
};
