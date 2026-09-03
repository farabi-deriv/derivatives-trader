import { action, autorun, computed, makeObservable, observable } from 'mobx';

import { isMobile, isTouchDevice } from '@deriv/shared';

import { MAX_MOBILE_WIDTH, MAX_TABLET_WIDTH } from 'Constants/ui';

import BaseStore from './base-store';

const store_name = 'ui_store';

export default class UIStore extends BaseStore {
    url_hashed_values = '';
    is_reports_visible = false;
    reports_route_tab_index = 0;
    is_history_tab_active = false;
    active_sidebar_flyout = null; // 'theme' | 'language' | 'positions' | 'account' | null
    // TODO: [cleanup ui-store]
    // Take profit, Stop loss & Deal cancellation checkbox
    should_show_cancellation_warning = true;

    // Extensions
    settings_extension = undefined;
    notification_messages_ui = undefined;

    is_dark_mode_on = window?.matchMedia?.('(prefers-color-scheme: dark)').matches && isMobile();
    is_settings_modal_on = false;
    is_mobile_language_menu_open = false;

    // Purchase Controls
    // @observable is_purchase_confirm_on    = false;
    is_services_error_visible = false;
    is_link_expired_modal_visible = false;
    is_reset_password_modal_visible = false;
    is_reset_email_modal_visible = false;
    is_update_email_modal_visible = false;
    is_reset_trading_password_modal_visible = false;
    // @observable is_purchase_lock_on       = false;
    // SmartCharts Controls
    // TODO: enable asset information
    // @observable is_chart_asset_info_visible = true;
    is_chart_countdown_visible = false;
    is_chart_layout_default = true;

    // Mobile (AppV2) chart maximize mode: hides the header/market strip/bottom-nav so the
    // chart grows while trade params stay visible. Session-only (not persisted) — resets on
    // reload and on leaving the trade page. Read across packages (core shell + trader page).
    is_chart_maximized = false;

    // True only during the ~300ms maximize/minimize transition. Gates the chart container's
    // height transition so it animates in lockstep with the collapsing chrome on toggle, but
    // NOT on unrelated height changes (trade-type switches, viewport/keyboard resize).
    is_chart_maximize_animating = false;

    // PWA event and config
    pwa_prompt_event = null;

    screen_width = window.innerWidth;
    screen_height = window.innerHeight;
    is_onscreen_keyboard_active = false;

    is_advanced_duration = false;
    advanced_duration_unit = 't';
    advanced_expiry_type = 'duration';
    simple_duration_unit = 't';
    duration_t = 5;
    duration_s = 15;
    duration_m = 3;
    duration_h = 1;
    duration_d = 1;

    // purchase button states
    purchase_states = [false, false];

    // app states for modal
    is_app_disabled = false;
    is_route_modal_on = false;

    // real account signup
    is_from_signup_account = false;

    // position states
    show_positions_toggle = true;

    modal_index = 0;

    // MT5 create real STP from demo, show only real accounts from switcher
    should_show_real_accounts_list = false;

    // UI Focus retention
    current_focus = null;

    // Mobile
    mobile_toast_timeout = 3500;
    toasts = [];

    is_cfd_page = false;
    is_nativepicker_visible = false;
    is_landscape = false;

    prompt_when = false;
    promptFn = () => {};

    //phone number verification
    should_show_phone_number_otp = false;
    is_forced_to_exit_pnv = false;
    is_phone_verification_completed = false;

    //warn user if they want to close create real account modal
    is_closing_create_real_account_modal = false;

    app_contents_scroll_ref = null;
    is_redirected_from_email = false;
    isUrlUnavailableModalVisible = false;
    // 'trade_type' | 'symbol' | 'both' — which URL value(s) were invalid
    urlUnavailableModalReason = 'trade_type';
    is_logout_success_modal_visible = false;
    is_try_real_modal_visible = false;
    sub_section_index = 0;
    field_ref_to_focus = null;
    is_switching_account = false;
    is_chart_loading = false;

    // tnc update
    is_tnc_update_modal_open = false;

    getDurationFromUnit = unit => this[`duration_${unit}`];

    constructor(root_store) {
        const local_storage_properties = [
            'advanced_duration_unit',
            'is_advanced_duration',
            'advanced_expiry_type',
            'simple_duration_unit',
            'duration_t',
            'duration_s',
            'duration_m',
            'duration_h',
            'duration_d',
            'is_chart_asset_info_visible',
            'is_chart_countdown_visible',
            'is_chart_layout_default',
            'is_dark_mode_on',
            'active_sidebar_flyout',
            'is_reports_visible',
            // 'is_purchase_confirm_on',
            // 'is_purchase_lock_on',
            'should_show_cancellation_warning',
        ];

        super({ root_store, local_storage_properties, store_name });

        makeObservable(this, {
            is_services_error_visible: observable,
            is_link_expired_modal_visible: observable,
            is_reset_password_modal_visible: observable,
            is_reset_email_modal_visible: observable,
            is_update_email_modal_visible: observable,
            is_reset_trading_password_modal_visible: observable,
            sub_section_index: observable,
            is_chart_countdown_visible: observable,
            is_chart_layout_default: observable,
            is_chart_maximized: observable,
            is_chart_maximize_animating: observable,
            pwa_prompt_event: observable,
            screen_width: observable,
            screen_height: observable,
            is_onscreen_keyboard_active: observable,
            is_advanced_duration: observable,
            advanced_duration_unit: observable,
            advanced_expiry_type: observable,
            app_contents_scroll_ref: observable,
            current_focus: observable,
            duration_d: observable,
            duration_h: observable,
            duration_m: observable,
            duration_s: observable,
            duration_t: observable,
            is_forced_to_exit_pnv: observable,
            is_phone_verification_completed: observable,

            is_app_disabled: observable,
            is_cfd_page: observable,

            is_closing_create_real_account_modal: observable,
            is_dark_mode_on: observable,
            is_from_signup_account: observable,
            is_redirected_from_email: observable,

            is_history_tab_active: observable,
            is_landscape: observable,
            is_mobile_language_menu_open: observable,
            is_nativepicker_visible: observable,

            active_sidebar_flyout: observable,
            is_positions_drawer_on: computed,
            is_reports_visible: observable,
            is_route_modal_on: observable,
            is_settings_modal_on: observable,
            is_tnc_update_modal_open: observable,
            isUrlUnavailableModalVisible: observable,
            urlUnavailableModalReason: observable,
            is_logout_success_modal_visible: observable,
            is_try_real_modal_visible: observable,
            is_switching_account: observable,
            is_chart_loading: observable,
            modal_index: observable,
            notification_messages_ui: observable,
            prompt_when: observable,
            promptFn: observable,
            purchase_states: observable,
            reports_route_tab_index: observable,
            settings_extension: observable,
            should_show_phone_number_otp: observable,
            should_show_cancellation_warning: observable,
            should_show_real_accounts_list: observable,
            show_positions_toggle: observable,
            simple_duration_unit: observable,
            toasts: observable.shallow,
            addToast: action.bound,
            disableApp: action.bound,
            disableRouteModal: action.bound,
            enableApp: action.bound,
            handleResize: action.bound,
            init: action.bound,
            installWithDeferredPrompt: action.bound,
            is_desktop: computed,
            is_mobile: computed,
            is_tablet: computed,
            url_hashed_values: observable,
            notifyAppInstall: action.bound,
            onChangeUiStore: action.bound,
            openPositionsDrawer: action.bound,
            populateSettingsExtensions: action.bound,
            removePWAPromptEvent: action.bound,
            removeToast: action.bound,
            resetPurchaseStates: action.bound,
            setShouldShowPhoneNumberOTP: action.bound,
            setAppContentsScrollRef: action.bound,
            setChartCountdown: action.bound,
            setChartLayout: action.bound,
            setIsChartMaximized: action.bound,
            setChartMaximizeAnimating: action.bound,
            toggleChartMaximized: action.bound,
            setCurrentFocus: action.bound,
            setDarkMode: action.bound,
            setHashedValue: action.bound,
            setIsForcedToExitPnv: action.bound,
            setIsPhoneVerificationCompleted: action.bound,
            setIsClosingCreateRealAccountModal: action.bound,
            setIsFromSignupAccount: action.bound,
            setIsNativepickerVisible: action.bound,
            setReportsTabIndex: action.bound,
            toggleShouldShowRealAccountsList: action.bound,
            setRedirectFromEmail: action.bound,
            setModalIndex: action.bound,
            setPromptHandler: action.bound,
            setPurchaseState: action.bound,
            setPWAPromptEvent: action.bound,
            setResetTradingPasswordModalOpen: action.bound,
            setRouteModal: action.bound,
            setSubSectionIndex: action.bound,
            setMobileLanguageMenuOpen: action.bound,
            toggleCancellationWarning: action.bound,
            toggleHistoryTab: action.bound,
            toggleOnScreenKeyboard: action.bound,
            toggleReports: action.bound,
            toggleResetEmailModal: action.bound,
            toggleResetPasswordModal: action.bound,
            toggleServicesErrorModal: action.bound,
            toggleSettingsModal: action.bound,
            toggleUpdateEmailModal: action.bound,
            toggleUrlUnavailableModal: action.bound,
            field_ref_to_focus: observable,
            setFieldRefToFocus: action.bound,
            toggleTncUpdateModal: action.bound,
            toggleLogoutSuccessModal: action.bound,
            toggleTryRealModal: action.bound,
            setSidebarFlyout: action.bound,
            closeSidebarFlyout: action.bound,
            setIsSwitchingAccount: action.bound,
            setIsChartLoading: action.bound,
        });

        window.addEventListener('resize', this.handleResize);
        autorun(() => {
            this.changeTheme();
        });
    }
    changeTheme = () => {
        if (this.is_dark_mode_on) {
            document.body.classList.remove('theme--light');
            document.body.classList.add('theme--dark');
        } else {
            document.body.classList.remove('theme--dark');
            document.body.classList.add('theme--light');
        }
    };

    setFieldRefToFocus(field_ref) {
        this.field_ref_to_focus = field_ref;
    }

    setIsClosingCreateRealAccountModal(is_closing_create_real_account_modal) {
        this.is_closing_create_real_account_modal = is_closing_create_real_account_modal;
    }

    setShouldShowPhoneNumberOTP(should_show_phone_number_otp) {
        this.should_show_phone_number_otp = should_show_phone_number_otp;
    }

    async setIsForcedToExitPnv(is_forced_to_exit_pnv) {
        this.is_forced_to_exit_pnv = is_forced_to_exit_pnv;
    }

    setIsPhoneVerificationCompleted(is_phone_verification_completed) {
        this.is_phone_verification_completed = is_phone_verification_completed;
    }

    setHashedValue(url_hashed_values) {
        this.url_hashed_values = url_hashed_values;
    }

    init(notification_messages) {
        this.setHashedValue(window.location.hash);
        this.notification_messages_ui = notification_messages;
    }

    setAppContentsScrollRef(value) {
        this.app_contents_scroll_ref = value;
    }

    populateSettingsExtensions(menu_items) {
        this.settings_extension = menu_items;
    }

    onChangeUiStore({ name, value }) {
        if (!(name in this)) {
            throw new Error(`Invalid Argument: ${name}`);
        }
        this[name] = value;
    }

    handleResize() {
        this.screen_width = window.innerWidth;
        this.screen_height = window.innerHeight;
    }

    setPromptHandler(condition, cb = () => {}) {
        this.prompt_when = condition;
        this.promptFn = cb;
    }

    get is_desktop() {
        return this.screen_width > MAX_TABLET_WIDTH;
    }

    get is_mobile() {
        return this.screen_width <= MAX_MOBILE_WIDTH;
    }

    get is_tablet() {
        return MAX_MOBILE_WIDTH < this.screen_width && this.screen_width <= MAX_TABLET_WIDTH;
    }

    get is_positions_drawer_on() {
        return this.active_sidebar_flyout === 'positions';
    }

    setRouteModal() {
        this.is_route_modal_on = true;
    }

    disableRouteModal() {
        this.is_route_modal_on = false;
    }

    disableApp() {
        this.is_app_disabled = true;
    }

    enableApp() {
        this.is_app_disabled = false;
    }

    setIsFromSignupAccount(is_from_signup_account) {
        this.is_from_signup_account = is_from_signup_account;
    }

    setPurchaseState(index) {
        this.purchase_states[index] = true;

        // TODO: Find better solution in the future for hack below
        // Force the animation to start quicker by manually assigning class to compensate for mobx getter lag
        // Because mobx has a delay before it can receive the updated prop used to assign the animation class
        const el_purchase_buttons = document.getElementsByClassName('btn-purchase');
        if (el_purchase_buttons[index]) {
            el_purchase_buttons[index].classList.add('btn-purchase--swoosh');
        }
        // UI/UX wants button to remain green until transition is finished and only then disable buttons
        setTimeout(() => {
            [].forEach.bind(el_purchase_buttons, el => {
                el.classList.add('btn-purchase--disabled');
            })();
        }, 250);
    }

    resetPurchaseStates() {
        this.purchase_states = [false, false];
    }

    setChartLayout(is_default) {
        this.is_chart_layout_default = is_default;
    }

    // TODO: enable asset information
    // @action.bound
    // setChartAssetInfo(is_visible) {
    //     this.is_chart_asset_info_visible = is_visible;
    // }

    setChartCountdown(is_visible) {
        this.is_chart_countdown_visible = is_visible;
    }

    setIsChartMaximized(is_maximized) {
        this.is_chart_maximized = is_maximized;
    }

    setChartMaximizeAnimating(is_animating) {
        this.is_chart_maximize_animating = is_animating;
    }

    toggleChartMaximized() {
        // Flag the transition window synchronously with the toggle so the chart container's
        // height transition is armed on the same render the height changes (both directions).
        this.is_chart_maximize_animating = true;
        this.is_chart_maximized = !this.is_chart_maximized;
    }

    // @action.bound
    // togglePurchaseLock() {
    //     this.is_purchase_lock_on = !this.is_purchase_lock_on;
    // }

    // @action.bound
    // setPurchaseLock(is_locked) {
    //     this.is_purchase_lock_on = is_locked;
    // }

    // @action.bound
    // togglePurchaseConfirmation() {
    //     this.is_purchase_confirm_on = !this.is_purchase_confirm_on;
    // }

    setDarkMode(is_dark_mode_on) {
        if (this.is_dark_mode_on !== is_dark_mode_on) {
            this.is_dark_mode_on = is_dark_mode_on;
            // This GTM call is here instead of the GTM store due to frequency of use
            this.root_store.gtm.pushDataLayer({ event: 'switch theme' });
        }

        return this.is_dark_mode_on;
    }

    setMobileLanguageMenuOpen(is_mobile_language_menu_open) {
        this.is_mobile_language_menu_open = is_mobile_language_menu_open;
    }

    setModalIndex(index = 0) {
        this.modal_index = index;
    }

    toggleSettingsModal() {
        this.is_settings_modal_on = !this.is_settings_modal_on;
    }

    openPositionsDrawer() {
        // show and hide Positions Drawer
        this.active_sidebar_flyout = 'positions';
    }

    toggleReports(is_visible) {
        this.is_reports_visible = is_visible;
    }

    toggleServicesErrorModal(is_visible) {
        this.is_services_error_visible = is_visible;
    }

    removePWAPromptEvent() {
        this.pwa_prompt_event = null;
    }

    setPWAPromptEvent(e) {
        this.pwa_prompt_event = e;
    }

    toggleCancellationWarning(state_change = !this.should_show_cancellation_warning) {
        this.should_show_cancellation_warning = state_change;
    }

    toggleHistoryTab(state_change = !this.is_history_tab_active) {
        this.is_history_tab_active = state_change;
    }

    toggleResetPasswordModal(state_change = !this.is_reset_password_modal_visible) {
        this.is_reset_password_modal_visible = state_change;
    }

    toggleLinkExpiredModal(state_change = !this.is_link_expired_modal_visible) {
        this.is_link_expired_modal_visible = state_change;
    }

    toggleResetEmailModal(state_change = !this.is_reset_email_modal_visible) {
        if (!state_change) {
            this.root_store.client.setPreventRedirectToHub(false);
        }
        this.is_reset_email_modal_visible = state_change;
    }

    toggleUpdateEmailModal(state_change = !this.is_update_email_modal_visible) {
        this.is_update_email_modal_visible = state_change;
    }

    setResetTradingPasswordModalOpen(is_reset_trading_password_modal_visible) {
        if (!is_reset_trading_password_modal_visible) {
            this.root_store.client.setPreventRedirectToHub(false);
        }
        this.is_reset_trading_password_modal_visible = is_reset_trading_password_modal_visible;
    }

    toggleOnScreenKeyboard() {
        this.is_onscreen_keyboard_active = this.current_focus !== null && this.is_mobile && isTouchDevice();
    }

    setCurrentFocus(value) {
        this.current_focus = value;
        this.toggleOnScreenKeyboard();
    }

    addToast(toast_config) {
        toast_config.key = toast_config.key ?? toast_config.content;
        const toast_index = this.toasts.findIndex(t => t.key === toast_config.key);
        if (toast_index > -1) {
            this.toasts.splice(toast_index, 1);
        }

        toast_config.timeout = toast_config.timeout ?? this.mobile_toast_timeout;
        if (toast_config.is_bottom) {
            this.toasts.push(toast_config);
        } else {
            this.toasts.unshift(toast_config);
        }
    }

    removeToast(key) {
        const index = this.toasts.findIndex(t => t.key === key);
        if (index > -1) {
            this.toasts.splice(index, 1);
        }
    }

    setIsNativepickerVisible(is_nativepicker_visible) {
        this.is_nativepicker_visible = is_nativepicker_visible;
    }

    setReportsTabIndex(tab_index = 0) {
        this.reports_route_tab_index = tab_index;
    }

    notifyAppInstall(prompt) {
        this.deferred_prompt = prompt;
        setTimeout(() => {
            this.root_store.notifications.addNotificationMessageByKey('install_pwa');
        }, 10000);
    }

    async installWithDeferredPrompt() {
        this.deferred_prompt.prompt();
        const choice = await this.deferred_prompt.userChoice;
        if (choice.outcome === 'accepted') {
            const notification_key = 'install_pwa';
            this.root_store.notifications.removeNotificationMessage({
                key: notification_key,
                should_show_again: false,
            });
            this.root_store.notifications.removeNotificationByKey({ key: notification_key });
        }
    }

    toggleShouldShowRealAccountsList(value) {
        this.should_show_real_accounts_list = value;
    }

    setRedirectFromEmail(value) {
        this.is_redirected_from_email = value;
    }

    setSubSectionIndex(index) {
        this.sub_section_index = index;
    }

    toggleUrlUnavailableModal(value, reason = 'trade_type') {
        if (value && this.isUrlUnavailableModalVisible && this.urlUnavailableModalReason !== reason) {
            // A second validation reported a different invalid URL value while the popup was already
            // on screen. Replacing the reason used to rewrite the title under the user's eyes (a link
            // with an invalid trade type *and* market showed "Unsupported trade type" and then flipped
            // to "Unsupported market" — GRWT-9320). Widen to 'both' instead, so the copy only ever
            // becomes more complete, never contradictory. TradeStore.resolveInitialMarket validates
            // the symbol and the trade type in separate sequential phases and reports each one as it
            // fails, so a both-invalid deep link legitimately arrives here twice — this widening is
            // what turns that into a single stable "Unsupported link".
            this.urlUnavailableModalReason = 'both';
            return;
        }
        this.isUrlUnavailableModalVisible = value;
        if (value) this.urlUnavailableModalReason = reason;
    }

    toggleTncUpdateModal(value) {
        this.is_tnc_update_modal_open = value;
    }

    toggleLogoutSuccessModal(value) {
        this.is_logout_success_modal_visible = value;
    }

    toggleTryRealModal(value) {
        this.is_try_real_modal_visible = value;
    }

    setIsSwitchingAccount(value) {
        this.is_switching_account = value;
    }

    setIsChartLoading(value) {
        this.is_chart_loading = value;
    }

    setSidebarFlyout(flyout_type) {
        // flyout_type can be 'theme' | 'language' | 'positions' | 'account' | null
        this.active_sidebar_flyout = flyout_type;
    }

    closeSidebarFlyout() {
        this.active_sidebar_flyout = null;
    }
}
