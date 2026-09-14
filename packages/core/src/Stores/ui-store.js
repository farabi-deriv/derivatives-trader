import { action, autorun, computed, makeObservable, observable, override } from 'mobx';

import { isTouchDevice } from '@deriv/shared';
import { BaseStore } from '@deriv/stores';

import { MAX_MOBILE_WIDTH, MAX_TABLET_WIDTH } from 'Constants/ui';

const store_name = 'ui_store';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

// Fallback surfaces for the theme-color meta when the semantic tokens are not computable (jsdom in
// tests, a stylesheet that failed to load). At runtime the meta colour is read from the resolved
// `--color-surface-primary` token, so brand.config.json stays the single source of the real values.
const FALLBACK_SURFACE_COLORS = {
    dark: '#181c25',
    light: '#ffffff',
};

const systemPrefersDark = () => !!window?.matchMedia?.(DARK_SCHEME_QUERY)?.matches;

// Anything other than an explicit 'light'/'dark' — including a value from a newer build or a
// hand-edited snapshot — resolves against the system preference.
const resolvePreference = preference => {
    if (preference === 'dark' || preference === 'light') return preference === 'dark';
    return systemPrefersDark();
};

// Reads the persisted preference straight out of localStorage, synchronously.
//
// It cannot wait for BaseStore's rehydrate: that runs in a setTimeout(..., 0) and its localStorage
// reaction writes the whole snapshot back — `theme_preference` included — before any timer queued
// behind it could read storage. A legacy snapshot would therefore already look migrated, and the
// stored theme would be lost. Reading here is also what lets the constructor's autorun paint the
// right theme on the first frame instead of flashing the system one.
const readStoredThemePreference = () => {
    let snapshot = {};
    try {
        snapshot = JSON.parse(localStorage.getItem(store_name)) || {};
    } catch (e) {
        snapshot = {};
    }

    // Own-property checks: the snapshot is parsed from localStorage, so `in` would also match
    // anything hanging off Object.prototype.
    const has = key => Object.prototype.hasOwnProperty.call(snapshot, key);

    if (has('theme_preference') && ['system', 'light', 'dark'].includes(snapshot.theme_preference)) {
        return snapshot.theme_preference;
    }

    if (has('is_dark_mode_on') && typeof snapshot.is_dark_mode_on === 'boolean') {
        // A stored boolean with no preference key predates `theme_preference`, and a boolean cannot
        // tell a deliberate choice from a default. Read it as explicit so an upgrade never flips a
        // returning user's theme.
        return snapshot.is_dark_mode_on ? 'dark' : 'light';
    }

    return 'system';
};

// index.html ships a static theme-color; keep it on the resolved theme's surface colour so the
// browser chrome matches. Created defensively so a host page without the tag still gets one.
const setThemeColorMeta = color => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
};

export default class UIStore extends BaseStore {
    is_reports_visible = false;
    reports_route_tab_index = 0;
    is_history_tab_active = false;
    active_sidebar_flyout = null; // 'language' | 'positions' | 'account' | null
    // TODO: [cleanup ui-store]
    // Take profit, Stop loss & Deal cancellation checkbox
    should_show_cancellation_warning = true;

    // Extensions
    notification_messages_ui = undefined;

    // 'system' | 'light' | 'dark'. Source of truth for the theme; `is_dark_mode_on` is its resolved
    // output and stays the observable every consumer reads. Both are seeded from storage here rather
    // than on rehydrate — see readStoredThemePreference().
    theme_preference = readStoredThemePreference();
    is_dark_mode_on = resolvePreference(this.theme_preference);
    is_mobile_language_menu_open = false;

    // Purchase Controls
    // @observable is_purchase_confirm_on    = false;
    is_services_error_visible = false;
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

    screen_width = window.innerWidth;
    screen_height = window.innerHeight;
    is_onscreen_keyboard_active = false;

    is_advanced_duration = false;

    // purchase button states
    purchase_states = [false, false];

    // app states for modal
    is_app_disabled = false;
    is_route_modal_on = false;

    // UI Focus retention
    current_focus = null;

    // Mobile
    mobile_toast_timeout = 3500;
    toasts = [];

    prompt_when = false;
    promptFn = () => {};

    app_contents_scroll_ref = null;
    isUrlUnavailableModalVisible = false;
    // 'trade_type' | 'symbol' | 'both' — which URL value(s) were invalid
    urlUnavailableModalReason = 'trade_type';
    is_logout_success_modal_visible = false;
    is_try_real_modal_visible = false;
    is_switching_account = false;
    is_chart_loading = false;

    constructor(root_store) {
        const local_storage_properties = [
            'is_advanced_duration',
            'is_chart_asset_info_visible',
            'is_chart_countdown_visible',
            'is_chart_layout_default',
            // The theme persists as `theme_preference` alone. `is_dark_mode_on` is derived from it,
            // and persisting the derived value too let rehydrate write back a stale boolean that
            // contradicted a 'system' preference whose OS theme had changed since the last visit.
            'theme_preference',
            'active_sidebar_flyout',
            'is_reports_visible',
            // 'is_purchase_confirm_on',
            // 'is_purchase_lock_on',
            'should_show_cancellation_warning',
        ];

        super({ root_store, local_storage_properties, store_name });

        makeObservable(this, {
            is_services_error_visible: observable,
            is_chart_countdown_visible: observable,
            is_chart_layout_default: observable,
            is_chart_maximized: observable,
            is_chart_maximize_animating: observable,
            screen_width: observable,
            screen_height: observable,
            is_onscreen_keyboard_active: observable,
            is_advanced_duration: observable,
            app_contents_scroll_ref: observable,
            current_focus: observable,

            is_app_disabled: observable,

            is_dark_mode_on: observable,
            theme_preference: observable,
            resolveTheme: action.bound,
            onUnmount: override,

            is_history_tab_active: observable,
            is_mobile_language_menu_open: observable,

            active_sidebar_flyout: observable,
            is_positions_drawer_on: computed,
            is_reports_visible: observable,
            is_route_modal_on: observable,
            isUrlUnavailableModalVisible: observable,
            urlUnavailableModalReason: observable,
            is_logout_success_modal_visible: observable,
            is_try_real_modal_visible: observable,
            is_switching_account: observable,
            is_chart_loading: observable,
            notification_messages_ui: observable,
            prompt_when: observable,
            promptFn: observable,
            purchase_states: observable,
            reports_route_tab_index: observable,
            should_show_cancellation_warning: observable,
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
            notifyAppInstall: action.bound,
            openPositionsDrawer: action.bound,
            removeToast: action.bound,
            resetPurchaseStates: action.bound,
            setAppContentsScrollRef: action.bound,
            setChartLayout: action.bound,
            setIsChartMaximized: action.bound,
            setChartMaximizeAnimating: action.bound,
            toggleChartMaximized: action.bound,
            setCurrentFocus: action.bound,
            setDarkMode: action.bound,
            setThemePreference: action.bound,
            setReportsTabIndex: action.bound,
            setPromptHandler: action.bound,
            setPurchaseState: action.bound,
            setRouteModal: action.bound,
            setMobileLanguageMenuOpen: action.bound,
            toggleCancellationWarning: action.bound,
            toggleHistoryTab: action.bound,
            toggleOnScreenKeyboard: action.bound,
            toggleReports: action.bound,
            toggleServicesErrorModal: action.bound,
            toggleUrlUnavailableModal: action.bound,
            toggleLogoutSuccessModal: action.bound,
            toggleTryRealModal: action.bound,
            setSidebarFlyout: action.bound,
            closeSidebarFlyout: action.bound,
            setIsSwitchingAccount: action.bound,
            setIsChartLoading: action.bound,
        });

        window.addEventListener('resize', this.handleResize);

        this.system_theme_query = window?.matchMedia?.(DARK_SCHEME_QUERY) ?? null;
        if (this.system_theme_query?.addEventListener) {
            this.system_theme_query.addEventListener('change', this.resolveTheme);
        } else if (this.system_theme_query?.addListener) {
            // Safari < 14 and older Android WebViews only expose the deprecated MediaQueryList API.
            this.system_theme_query.addListener(this.resolveTheme);
        }

        this.themeAutorunDisposer = autorun(() => {
            this.changeTheme();
        });

        // Enforce the single-writer rule on the <html> light/dark class. Quill's ThemeProvider
        // re-applies its previous theme class from a stale effect when the OS scheme flips while
        // the preference is System (its own prefers-color-scheme hook fires before it has seen the
        // new theme prop), overwriting changeTheme()'s correct class after the fact — the quill
        // design tokens are scoped to this class, so half the app (and on Samsung the chart's
        // token chain, issue #1177's follow-up) rendered in the old theme. Any late writer that
        // disagrees with the resolved theme is corrected here; the correction re-fires the
        // observer once, matches, and stops.
        if (typeof MutationObserver !== 'undefined') {
            this.theme_class_observer = new MutationObserver(() => {
                const expected = this.applied_theme;
                if (!expected) return;
                const root = document.documentElement;
                const wrong = expected === 'dark' ? 'light' : 'dark';
                if (root.classList.contains(wrong) || !root.classList.contains(expected)) {
                    root.classList.remove('light', 'dark');
                    root.classList.add(expected);
                }
            });
            this.theme_class_observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class'],
            });
        }
    }

    /**
     * Derives `is_dark_mode_on` from `theme_preference`, falling back to the system preference.
     * Guarded so a no-change resolve (boot, a system `change` event matching the current theme)
     * never dirties the observable — an unguarded write re-triggered the persistence reaction's
     * full-store snapshot on every boot.
     */
    resolveTheme() {
        const is_dark_mode_on = resolvePreference(this.theme_preference);
        if (is_dark_mode_on !== this.is_dark_mode_on) this.is_dark_mode_on = is_dark_mode_on;
    }

    onUnmount() {
        super.onUnmount();

        this.themeAutorunDisposer?.();
        this.theme_class_observer?.disconnect();

        if (this.system_theme_query?.removeEventListener) {
            this.system_theme_query.removeEventListener('change', this.resolveTheme);
        } else if (this.system_theme_query?.removeListener) {
            this.system_theme_query.removeListener(this.resolveTheme);
        }
    }

    // The single runtime writer of theme DOM state. The pre-React boot script in index.html sets the
    // same `<html>` class, inline loader colours and `color-scheme` before any bundle loads; keeping
    // them all in step here is what stops them going stale on a theme switch.
    changeTheme = () => {
        const theme = this.is_dark_mode_on ? 'dark' : 'light';
        // The autorun re-fires only when is_dark_mode_on flips, but guard anyway: every run below
        // writes inline :root style, which invalidates style for the whole document.
        if (this.applied_theme === theme) return;
        this.applied_theme = theme;

        const root = document.documentElement;

        document.body.classList.remove('theme--light', 'theme--dark');
        document.body.classList.add(`theme--${theme}`);

        root.classList.remove('light', 'dark');
        root.classList.add(theme);

        // Declares which scheme is in use, so browser-painted surfaces match and automatic
        // dark-theme features (Samsung Internet, Chrome auto dark) stop force-darkening the page —
        // force-dark cannot reach the canvas-rendered chart, which is what made them disagree.
        root.style.colorScheme = theme;
        // The boot script inline-paints these two tokens for the pre-CSS loader frame. Once the
        // stylesheets are in charge the `.theme--*` blocks own them — clear the inline copies
        // rather than rewriting them, so hardcoded values can never shadow the brand tokens.
        root.style.removeProperty('--color-surface-primary');
        root.style.removeProperty('--color-text-primary');

        // Browser chrome colour follows the resolved surface token (brand.config.json via the
        // generated semantic tokens); the literal fallback only covers jsdom/broken-CSS cases.
        const surface = getComputedStyle(document.body).getPropertyValue('--color-surface-primary').trim();
        setThemeColorMeta(surface || FALLBACK_SURFACE_COLORS[theme]);
    };

    init(notification_messages) {
        this.notification_messages_ui = notification_messages;
    }

    setAppContentsScrollRef(value) {
        this.app_contents_scroll_ref = value;
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

    setThemePreference(preference) {
        if (!['light', 'dark', 'system'].includes(preference)) return;

        const was_dark_mode_on = this.is_dark_mode_on;
        this.theme_preference = preference;
        this.resolveTheme();

        if (this.is_dark_mode_on !== was_dark_mode_on) {
            // This GTM call is here instead of the GTM store due to frequency of use
            this.root_store.gtm.pushDataLayer({ event: 'switch theme' });
        }
    }

    setDarkMode(is_dark_mode_on) {
        // Choosing a theme (toggle, `?theme=` deep link, native mobile bridge) is an explicit
        // preference: it wins over the system theme from here on, and the Theme menu shows it as
        // the selected option.
        this.setThemePreference(is_dark_mode_on ? 'dark' : 'light');

        return this.is_dark_mode_on;
    }

    setMobileLanguageMenuOpen(is_mobile_language_menu_open) {
        this.is_mobile_language_menu_open = is_mobile_language_menu_open;
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

    toggleCancellationWarning(state_change = !this.should_show_cancellation_warning) {
        this.should_show_cancellation_warning = state_change;
    }

    toggleHistoryTab(state_change = !this.is_history_tab_active) {
        this.is_history_tab_active = state_change;
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
        // flyout_type can be 'language' | 'positions' | 'account' | null
        this.active_sidebar_flyout = flyout_type;
    }

    closeSidebarFlyout() {
        this.active_sidebar_flyout = null;
    }
}
