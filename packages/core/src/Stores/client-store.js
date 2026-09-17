import Cookies from 'js-cookie';
import { action, computed, makeObservable, observable, runInAction, when } from 'mobx';

import {
    clearAccountId,
    dayjs,
    filterUrlQuery,
    getAccountId,
    isCryptocurrency,
    isDemoAccountId,
    isMobile,
    LocalStore,
    removeCookies,
    routes,
    urlForLanguage,
} from '@deriv/shared';
import { BaseStore } from '@deriv/stores';
import { Analytics } from '@deriv-com/analytics';
import { getInitialLanguage, localize } from '@deriv-com/translations';
import { CountryUtils } from '@deriv-com/utils';

import { checkWhoAmI, requestRestLogout, WS } from 'Services';

import { buildCurrenciesList } from './Modules/Trading/Helpers/currency';

import BinarySocket from '_common/base/socket_base';

const LANGUAGE_KEY = 'i18n_language';
const storage_key = 'current_account';
const store_name = 'client_store';

export default class ClientStore extends BaseStore {
    loginid;
    preferred_language;
    user_id;
    external_id;

    current_account = null;
    initialized_broadcast = false;
    is_authorize = false;
    is_logging_in = false;
    is_client_store_initialized = false;
    has_logged_out = false;
    should_redirect_user_to_login = false;

    currencies_list = {};
    selected_currency = '';

    tab_visibility_handler = null;
    has_archived_statement = false;

    constructor(root_store) {
        const local_storage_properties = [];
        super({ root_store, local_storage_properties, store_name });

        makeObservable(this, {
            loginid: observable,
            preferred_language: observable,
            user_id: observable,
            current_account: observable,
            initialized_broadcast: observable,
            currencies_list: observable,
            selected_currency: observable,
            is_authorize: observable,
            is_logging_in: observable,
            is_client_store_initialized: observable,
            has_logged_out: observable,
            should_redirect_user_to_login: observable,
            has_archived_statement: observable,

            balance: computed,
            currency: computed,
            is_virtual: computed,
            is_eu: computed,
            is_logged_in: computed,
            account_type: computed,
            default_currency: computed,
            residence: computed,
            email_address: computed,
            landing_company_shortcode: computed,
            responsePayoutCurrencies: action.bound,
            responseAuthorize: action.bound,
            setLoginId: action.bound,
            setIsAuthorize: action.bound,
            setIsLoggingIn: action.bound,
            setBalanceActiveAccount: action.bound,
            selectCurrency: action.bound,
            setInitialized: action.bound,
            setIsClientStoreInitialized: action.bound,
            cleanUp: action.bound,
            logout: action.bound,
            setLogout: action.bound,
            setShouldRedirectToLogin: action.bound,
            setHasArchivedStatement: action.bound,
            init: action.bound,
            resetVirtualBalance: action.bound,
            is_crypto: action.bound,
            switchAccount: action.bound,
        });
    }

    get balance() {
        if (this.current_account?.balance !== undefined && this.current_account?.balance !== null) {
            return this.current_account.balance.toString();
        }
        return undefined;
    }

    get currency() {
        if (this.selected_currency.length) {
            return this.selected_currency;
        }
        return this.current_account?.currency || this.default_currency;
    }

    is_crypto(currency) {
        return isCryptocurrency(currency || this.currency);
    }

    get default_currency() {
        if (Object.keys(this.currencies_list).length > 0) {
            const keys = Object.keys(this.currencies_list);
            if (this.currencies_list[localize('Fiat')]?.length < 1) return 'USD';
            return Object.values(this.currencies_list[`${keys[0]}`])[0].text;
        }
        return 'USD';
    }

    get is_logged_in() {
        const hasAccountId = !!getAccountId();
        const hasCurrentAccountLoginId = !!this.current_account?.loginid;
        const hasLoginId = !!this.loginid;
        return hasAccountId && hasCurrentAccountLoginId && hasLoginId;
    }

    get is_virtual() {
        // Demo if the account_id/loginid carries the DOT prefix. Referencing this.loginid
        // keeps the computed reactive to account switches.
        return isDemoAccountId(this.loginid);
    }

    get is_eu() {
        return this.landing_company_shortcode === 'maltainvest';
    }

    get account_type() {
        // Only consumed by GTM analytics (bom_account_type); demo → 'virtual', otherwise undefined.
        return this.is_virtual ? 'virtual' : undefined;
    }

    get residence() {
        return this.current_account?.residence || '';
    }

    get email_address() {
        return this.current_account?.email || '';
    }

    get landing_company_shortcode() {
        // Default to 'svg' for ROW behavior (maximum permissiveness)
        return this.current_account?.landing_company_shortcode || 'svg';
    }

    setIsAuthorize(value) {
        this.is_authorize = value;
    }

    responsePayoutCurrencies(response) {
        // Since payout_currencies endpoint has been removed, use USD as fallback
        const list = response?.payout_currencies || response || ['USD'];
        this.currencies_list = buildCurrenciesList(Array.isArray(list) ? list : ['USD']);
        this.selectCurrency('');
    }

    responseAuthorize(response) {
        const { authorize } = response;

        runInAction(() => {
            this.current_account = {
                loginid: authorize.loginid,
                balance: authorize.balance,
                currency: authorize.currency,
                email: authorize.email || '',
                landing_company_shortcode: authorize.landing_company_name || '',
                residence: authorize.country || '',
                session_start: parseInt(dayjs().utc().valueOf() / 1000),
            };

            this.setLoginId(authorize.loginid);
        });

        this.user_id = authorize.user_id || '';
        if (this.user_id) {
            localStorage.setItem('active_user_id', this.user_id);
        }

        // Store active_loginid for backward compatibility with notification system and multi-tab sync
        localStorage.setItem('active_loginid', authorize.loginid);
        sessionStorage.setItem('active_loginid', authorize.loginid);

        // Store current account
        localStorage.setItem(storage_key, JSON.stringify(this.current_account));
    }

    async resetVirtualBalance() {
        this.root_store.notifications.removeNotificationByKey({ key: 'reset_virtual_balance' });
        this.root_store.notifications.removeNotificationMessage({
            key: 'reset_virtual_balance',
            should_show_again: true,
        });
        await WS.authorized.topupVirtual();
    }

    async init(external_id) {
        // Remove any legacy token parameters from URL
        this.removeTokenFromUrl();

        let search = '';
        try {
            search = window?.location?.search || '';
        } catch (error) {
            search = '';
        }

        const search_params = new URLSearchParams(search);
        const redirect_url = search_params?.get('redirect_url');
        const action_param = search_params?.get('action');

        const account_id = getAccountId();

        if (account_id) {
            // Set is_logging_in to true while we wait for authorization
            this.setIsLoggingIn(true);

            // Wait for auth confirmation: socket-general's authorizeAccount flips is_authorize on
            // the first balance response, on whichever connection instance delivers it — unlike
            // the old expectResponse('balance'), which was pinned to one instance and hung forever
            // if that connection died before its balance arrived.
            try {
                await when(() => this.is_authorize, { timeout: 30000 });
            } catch (error) {
                // Not confirmed within the window (dead network, refused handshakes, lost
                // response). Let the one validation path decide: handleWhoAmI clears credentials
                // only on a confirmed 401; plain network trouble keeps retrying via the network
                // monitor while boot continues.
                // eslint-disable-next-line no-console
                console.error('[Auth] Authorization not confirmed within 30s:', error);
                this.handleWhoAmI();
            }
        }

        this.setLoginId(window.sessionStorage.getItem('active_loginid') || LocalStore.get('active_loginid'));

        this.user_id = LocalStore.get('active_user_id');

        // Load current account from localStorage if not already set
        if (!this.current_account) {
            const stored_account = LocalStore.getObject(storage_key);
            if (stored_account) {
                this.current_account = stored_account;
            }
        }

        this.external_id = external_id;

        // Analytics and GTM for logged-in users
        if (this.is_logged_in) {
            Analytics.identifyEvent(external_id || this.user_id);

            await this.root_store.gtm.pushDataLayer({
                event: 'login',
            });
        }

        // Handle redirect and language settings for logged-in users
        if (this.is_logged_in) {
            if (redirect_url) {
                const redirect_route = routes[redirect_url].length > 1 ? routes[redirect_url] : '';
                const has_action = ['reset_password'].includes(action_param);

                if (has_action) {
                    const query_string = filterUrlQuery(search, ['platform', 'code', 'action', 'loginid']);
                    window.location.replace(`${redirect_route}/redirect?${query_string}`);
                } else {
                    window.location.replace(`${redirect_route}/?${filterUrlQuery(search, ['platform', 'lang'])}`);
                }
            }

            const language = this.current_account?.preferred_language || getInitialLanguage();
            const stored_language_without_double_quotes = LocalStore.get(LANGUAGE_KEY).replace(/"/g, '');
            if (stored_language_without_double_quotes && language !== stored_language_without_double_quotes) {
                window.history.replaceState({}, document.title, urlForLanguage(language));
                await this.root_store.common.changeSelectedLanguage(language);
            }
        }

        this.selectCurrency('');

        // Since payout_currencies endpoint has been removed, use USD as default
        this.responsePayoutCurrencies(['USD']);

        this.setIsLoggingIn(false);
        this.setInitialized(true);

        // Clean up URL parameters
        if (action_param === 'signup') {
            const filteredQuery = filterUrlQuery(search, ['lang']);
            history.replaceState(
                null,
                null,
                window.location.href.replace(`${search}`, filteredQuery === '' ? '' : `?${filteredQuery}`)
            );
        }

        this.setIsClientStoreInitialized();

        // Set up visibility change listener to check whoami when tab becomes visible
        this.setupVisibilityListener();

        return true;
    }

    /**
     * Checks session validity via whoami service and handles cleanup if needed.
     * Guarded against overlap: visibility and focus both fire on a tab return, and the
     * connection-error path can trigger it too — one validation at a time is enough.
     */
    async handleWhoAmI() {
        if (this.is_whoami_in_flight) return;
        this.is_whoami_in_flight = true;

        try {
            const result = await checkWhoAmI();

            // Only trigger cleanup if we get 401 error AND have account_id (expect to be logged in)
            // This means user logged out from Deriv home. If no account_id, we're on public - ignore 401
            if (result.error?.code === 401 && getAccountId()) {
                await this.cleanUp();
            }
        } finally {
            this.is_whoami_in_flight = false;
        }
    }

    /**
     * Sets up visibility change and focus listeners to check whoami when tab becomes visible or gains focus
     */
    setupVisibilityListener() {
        // Remove existing listeners if any
        this.removeVisibilityListener();

        // Create visibility change handler
        this.tab_visibility_handler = () => {
            if (document.visibilityState === 'visible') {
                // Tab became visible - check whoami
                this.handleWhoAmI();
            }
        };

        // Create focus handler
        this.window_focus_handler = () => {
            // Window gained focus - check whoami
            this.handleWhoAmI();
        };

        // Add listeners
        document.addEventListener('visibilitychange', this.tab_visibility_handler);
        window.addEventListener('focus', this.window_focus_handler);
    }

    /**
     * Removes the visibility change and focus listeners
     */
    removeVisibilityListener() {
        if (this.tab_visibility_handler) {
            document.removeEventListener('visibilitychange', this.tab_visibility_handler);
            this.tab_visibility_handler = null;
        }
        if (this.window_focus_handler) {
            window.removeEventListener('focus', this.window_focus_handler);
            this.window_focus_handler = null;
        }
    }

    setLoginId(loginid) {
        this.loginid = loginid;
    }

    async getAnalyticsConfig(isLoggedOut = false) {
        const broker = this.loginid?.match(/[a-zA-Z]+/g)?.join('');

        // js-cookie v3 removed Cookies.getJSON(); replicate its v2 behavior (parse JSON, fall back to the raw string on failure)
        const utm_data_cookie = Cookies.get('utm_data');
        let utm_data;
        try {
            utm_data = utm_data_cookie === undefined ? undefined : JSON.parse(utm_data_cookie);
        } catch (e) {
            utm_data = utm_data_cookie;
        }
        const ppc_campaign_cookies =
            utm_data === 'null'
                ? {
                      utm_source: 'no source',
                      utm_medium: 'no medium',
                      utm_campaign: 'no campaign',
                      utm_content: 'no content',
                  }
                : utm_data;

        const residence_country = !isLoggedOut ? this.residence : '';
        const login_status = !isLoggedOut && this.is_logged_in;
        return {
            loggedIn: login_status,
            account_type: broker === 'null' ? 'unlogged' : broker,
            residence_country,
            device_type: isMobile() ? 'mobile' : 'desktop',
            language: getInitialLanguage(),
            device_language: navigator?.language || 'en-EN',
            user_language: getInitialLanguage().toLowerCase(),
            country: await CountryUtils.getCountry(),
            utm_source: ppc_campaign_cookies?.utm_source,
            utm_medium: ppc_campaign_cookies?.utm_medium,
            utm_campaign: ppc_campaign_cookies?.utm_campaign,
            utm_content: ppc_campaign_cookies?.utm_content,
            domain: window.location.hostname,
            url: window.location.href,
            ...(!isLoggedOut && this.external_id && { user_id: this.external_id }),
        };
    }

    setIsLoggingIn(bool) {
        this.is_logging_in = bool;
    }

    setBalanceActiveAccount(obj_balance) {
        if (!obj_balance || typeof obj_balance.balance === 'undefined') {
            return;
        }

        if (this.current_account && obj_balance.loginid === this.current_account.loginid) {
            this.current_account.balance = obj_balance.balance;

            if (this.is_virtual) {
                this.root_store.notifications.resetVirtualBalanceNotification(this.current_account.loginid);
            }

            // Update localStorage
            localStorage.setItem(storage_key, JSON.stringify(this.current_account));
        }
    }

    selectCurrency(value) {
        this.selected_currency = value;
    }

    setIsClientStoreInitialized() {
        this.is_client_store_initialized = true;
    }

    setInitialized(is_initialized) {
        this.initialized_broadcast = is_initialized;
    }

    async cleanUp() {
        // Remove visibility listener
        this.removeVisibilityListener();

        // Clean up notifications
        const notification_messages = LocalStore.getObject('notification_messages');
        if (notification_messages && this.loginid) {
            delete notification_messages[this.loginid];
            LocalStore.setObject('notification_messages', { ...notification_messages });
        }

        // Update analytics
        const analytics_config = await this.getAnalyticsConfig(true);
        Analytics.setAttributes(analytics_config);

        this.root_store.gtm.pushDataLayer({ event: 'log_out' });

        // Reset state
        this.loginid = null;
        this.user_id = null;
        this.external_id = null;
        this.current_account = null;
        this.setHasArchivedStatement(false);
        // The session is gone — without this, is_authorize stays true forever after logout and
        // auth gates (waitForAuth) would resolve stale-true.
        this.setIsAuthorize(false);

        LocalStore.set('marked_notifications', JSON.stringify([]));
        localStorage.setItem('active_loginid', this.loginid);
        sessionStorage.removeItem('active_loginid');
        localStorage.setItem('active_user_id', this.user_id);
        localStorage.setItem(storage_key, JSON.stringify(this.current_account));

        // Clear account_id from localStorage
        clearAccountId();

        // Remove the shared `options_account_id` cookie before reconnecting.
        removeCookies('options_account_id');

        Analytics.reset();

        runInAction(() => {
            // Since payout_currencies endpoint has been removed, use USD as default
            this.responsePayoutCurrencies(['USD']);
        });
        this.root_store.notifications.removeAllNotificationMessages(true);

        // Drop WebSocket connection and reconnect to public endpoint
        BinarySocket.closeAndOpenNewConnection();
    }

    setShouldRedirectToLogin(should_redirect_user_to_login) {
        this.should_redirect_user_to_login = should_redirect_user_to_login;
    }

    setHasArchivedStatement(has_archived_statement) {
        this.has_archived_statement = has_archived_statement;
    }

    async logout() {
        const response = await requestRestLogout();

        if (response?.logout === 1) {
            await this.cleanUp();
            this.setLogout(true);
        }

        return response;
    }

    setLogout(is_logged_out) {
        this.has_logged_out = is_logged_out;
        if (this.root_store.common.has_error) this.root_store.common.setError(false, null);
    }

    removeTokenFromUrl() {
        const url = new URL(window.location.href);
        if (url.searchParams.has('token')) {
            url.searchParams.delete('token');
            window.history.replaceState({}, document.title, url.toString());
        }
    }

    /**
     * Switch to a different account
     * Handles notification clearing, localStorage updates, and WebSocket reconnection.
     * The server (demo/real) is derived from the account_id prefix on reconnect.
     * @param {string} account_id - The account ID to switch to
     */
    async switchAccount(account_id) {
        if (!account_id || this.loginid === account_id) return;

        // Update localStorage with new account
        localStorage.setItem('account_id', account_id);
        localStorage.setItem('active_loginid', account_id);
        sessionStorage.setItem('active_loginid', account_id);

        // Clear notifications when switching accounts (similar to old implementation)
        this.root_store.notifications.removeNotifications(true);
        this.root_store.notifications.removeTradeNotifications();
        this.root_store.notifications.removeAllNotificationMessages(true);

        // Clear contract markers to prevent showing previous account's contracts on chart
        this.root_store.contract_trade.clearContracts();

        // Clear stale positions immediately so previous account's positions
        // are not visible while the new account's data loads
        this.root_store.portfolio.clearTable();

        // Reconnect WebSocket with new account
        BinarySocket.closeAndOpenNewConnection();
    }
}
