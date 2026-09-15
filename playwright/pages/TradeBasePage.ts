import { Page, Locator, expect } from '@playwright/test';
import { NavigationUtils } from '../e2e-tests-core/utils';

/**
 * Base Page Object for the DTrader trade page (/).
 *
 * Contains only elements that are always present regardless of contract type:
 * the header (account info, balance, login button) and the trade container.
 * Contract-type-specific parameters live in subclass page objects.
 *
 * @example
 * ```typescript
 * test('VERIFY trade page loads', async ({ tradeBasePage }) => {
 *     await tradeBasePage.gotoTradePage();
 *     await tradeBasePage.verifySuccessfulLogin();
 * });
 * ```
 */
export class TradeBasePage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // ============================================
    // HELPERS
    // ============================================

    protected get isMobile(): boolean {
        return (this.page.viewportSize()?.width ?? 1024) < 1024;
    }

    // ============================================
    // LOCATORS
    // ============================================

    /**
     * Account info area — AppV2 renders different elements per viewport.
     * - Mobile (< 1024px): `[data-testid="dt_acc_info"]`
     * - Desktop (≥ 1024px): `.account-header__content`
     */
    get accountInfo(): Locator {
        return this.isMobile ? this.page.getByTestId('dt_acc_info') : this.page.locator('.account-header__content');
    }

    /**
     * Balance display — AppV2 renders different elements per viewport.
     * - Mobile (< 1024px): `[data-testid="dt_balance"]`
     * - Desktop (≥ 1024px): `.account-header__balance`
     */
    get balance(): Locator {
        return this.isMobile ? this.page.getByTestId('dt_balance') : this.page.locator('.account-header__balance');
    }

    /**
     * Deposit button — visible when logged in on both viewports.
     * Label may be "Try real" for demo-only accounts.
     * Source: account-header.tsx aria-label='Deposit'
     */
    get depositButton(): Locator {
        return this.page.getByRole('button', { name: 'Deposit' });
    }

    /**
     * Login button — visible when logged out. AppV2 renders different elements per viewport.
     * - Mobile (< 1024px): `#dt_login_button_v2`
     * - Desktop (≥ 1024px): role-based button "Log in"
     */
    get loginButton(): Locator {
        return this.isMobile
            ? this.page.locator('#dt_login_button_v2')
            : this.page.getByRole('button', { name: 'Log in' });
    }

    /**
     * "Try real" CTA — shown on demo accounts to prompt switching to real trading.
     */
    get tryRealButton(): Locator {
        return this.page.getByRole('button', { name: /try real/i });
    }

    /**
     * Market tabs strip — always rendered once DTrader's main trade UI has painted.
     * Source: market-tabs.tsx `data-testid="dt_market_tabs"`
     */
    get tradeTypeTabsContainer(): Locator {
        return this.page.getByTestId('dt_market_tabs');
    }

    /** Sidebar Home button — desktop only */
    get sidebarHomeButton(): Locator {
        return this.page.getByTestId('dt_sidebar_home');
    }

    /** Sidebar Positions button — desktop only */
    get sidebarPositionsButton(): Locator {
        return this.page.getByTestId('dt_sidebar_positions');
    }

    /** Sidebar Reports button — desktop only */
    get sidebarReportsButton(): Locator {
        return this.page.getByTestId('dt_sidebar_reports');
    }

    /** Sidebar Help button — desktop only */
    get sidebarHelpButton(): Locator {
        return this.page.getByTestId('dt_sidebar_help');
    }

    /** Sidebar Language button — desktop only */
    get sidebarLanguageButton(): Locator {
        return this.page.getByTestId('dt_sidebar_language');
    }

    /** Sidebar Theme button — desktop only */
    get sidebarThemeButton(): Locator {
        return this.page.getByTestId('dt_sidebar_theme');
    }

    /**
     * Sidebar Log out button — desktop only. Direct nav item, only rendered while logged in
     * (no separate account-dropdown trigger anymore). Source: sidebar.tsx `dt_sidebar_logout`.
     */
    get sidebarLogoutButton(): Locator {
        return this.page.getByTestId('dt_sidebar_logout');
    }

    /** Bottom nav Home tab — mobile only */
    get bottomNavHome(): Locator {
        return this.page.locator('.bottom-nav-container').getByText('Home');
    }

    /** Bottom nav Trade tab — mobile only */
    get bottomNavTrade(): Locator {
        return this.page.locator('.bottom-nav-container').getByText('Trade');
    }

    /** Bottom nav Positions tab — mobile only */
    get bottomNavPositions(): Locator {
        return this.page.locator('.bottom-nav-container').getByText('Positions');
    }

    /** Bottom nav Menu tab — mobile only */
    get bottomNavMenu(): Locator {
        return this.page.locator('.bottom-nav-container').getByText('Menu');
    }

    /** Bottom nav Automate tab — mobile only. Source: bottom-nav.tsx `bottom-nav-item--automate`. */
    get bottomNavAutomate(): Locator {
        return this.page.locator('.bottom-nav-item--automate');
    }

    /**
     * "Open positions" link in the mobile Menu → Reports section.
     * Navigates to the open positions list (trade table).
     * Source: menu.tsx menu-page__item containing "Open positions"
     */
    get mobileMenuOpenPositions(): Locator {
        return this.page.getByText('Open positions', { exact: true });
    }

    /**
     * Log out control — rendered differently per viewport:
     *  - Desktop: a real `button` in the sidebar account dropdown (role=button, name "Log out").
     *  - Mobile: the logout row on the menu page — a `div.header__menu-logout` (NOT a button role,
     *    so `getByRole('button')` never matches). This class is unique to the logout row and owns
     *    the `handleLogout` click handler, so we target it directly rather than the generic
     *    `.header__menu-mobile-link` container (shared by every menu item) — this is also
     *    language-independent, unlike a text-based match.
     * The `.or()` chain resolves to exactly one element per viewport, avoiding strict-mode conflicts.
     */
    get logoutButton(): Locator {
        return this.page.getByRole('button', { name: 'Log out' }).or(this.page.locator('.header__menu-logout'));
    }

    /**
     * The active (symbol, trade type) tab on the market-tabs strip — confirms the trade form is
     * fully loaded. Replaces the pre-redesign `.quill-chip[data-state="selected"]` trade-type chip,
     * which no longer renders on the main trade page (that pattern now only appears inside the
     * market-selection modal's picker list). Source: market-tab.tsx — each tab is
     * `[data-testid="dt_market_tab"]` with `aria-current="true"` when active. Present both logged
     * in and logged out.
     */
    get activeMarketTab(): Locator {
        return this.page.locator('[data-testid="dt_market_tab"][aria-current="true"]').first();
    }

    /**
     * The currently-active account's type label shown on the account-info trigger (switcher closed).
     * Reads "Real account" or "Demo account". AppV2 renders a different container per viewport:
     * - Desktop: `.account-header__content-header` (account-header.tsx, AppV2)
     * - Mobile: `.acc-info__account-type-header` (core account-info.tsx)
     *
     * These trigger-specific classes are distinct from the switcher's account-item classes, so the
     * label never collides with the "Real account" / "Demo account" text rendered by the open
     * switcher's account rows.
     */
    get activeAccountTypeLabel(): Locator {
        return this.isMobile
            ? this.page.locator('.acc-info__account-type-header')
            : this.page.locator('.account-header__content-header');
    }

    /**
     * The account-list container inside the open switcher — a single element on both viewports
     * (dropdown on desktop, ActionSheet on mobile). Confirms the switcher opened without colliding
     * with the individual account rows. Source: account-switcher.tsx `.acc-switcher__accounts`.
     */
    get accountSwitcherList(): Locator {
        return this.page.locator('.acc-switcher__accounts');
    }

    /**
     * An account row inside the open account switcher, matched by account type via its aria-label.
     * The shared `AccountSwitcher` (core/.../account-switcher.tsx) renders each account as
     * `<button aria-label="{Real|Demo} account {id} with balance {bal} {curr}" data-testid="dt_account_item_{id}">`.
     * The account_id is dynamic, so the stable anchor is the aria-label prefix ("Real account " /
     * "Demo account "). The currently-active account renders `disabled`, so clicking a different
     * type always targets an enabled row.
     *
     * @param type - `'real'` or `'demo'`.
     * @returns Locator for the first switcher row of that account type.
     */
    accountSwitcherItem(type: 'real' | 'demo'): Locator {
        const prefix = type === 'real' ? 'Real account ' : 'Demo account ';
        return this.page.getByRole('button', { name: new RegExp(`^${prefix}`) }).first();
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Seed localStorage on the DTrader origin before the test starts.
     *
     * Navigates to BASE_URL, injects keys that suppress onboarding tours and popups,
     * then returns — the caller should proceed with `loginPage.login()`.
     *
     * Keys injected:
     *  - `guide_dtrader_v2` → marks all tour steps as seen
     *  - `guide_dtrader_v2_desktop` → marks desktop tour steps as seen
     *  - `guide_dtrader_v2_desktop_returning` → marks returning-user desktop tour steps as seen
     *  - `presets_onboarding_guide` → suppresses the presets onboarding popup
     *  - `trade_param_guide` → suppresses the trade parameter guide popup
     *  - `automation_onboarding_completed` → marks automation onboarding as completed
     *
     * @example
     * test.beforeEach(async ({ page, loginPage }) => {
     *   await TradeBasePage.seedLocalStorageOnOrigin(page);
     *   await loginPage.login();
     * });
     */
    static async seedLocalStorageOnOrigin(page: Page): Promise<void> {
        const baseUrl = process.env.BASE_URL;
        if (!baseUrl) {
            throw new Error(
                'BASE_URL environment variable is required. Add it to playwright/.env.staging (e.g. BASE_URL=https://staging-dtrader.deriv.com).'
            );
        }
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
            localStorage.setItem(
                'guide_dtrader_v2',
                JSON.stringify({
                    trade_types_selection: true,
                    trade_page: true,
                    positions_page: true,
                })
            );
            localStorage.setItem(
                'guide_dtrader_v2_desktop',
                JSON.stringify({
                    trade_page: true,
                    positions_page: true,
                })
            );
            localStorage.setItem(
                'guide_dtrader_v2_desktop_returning',
                JSON.stringify({
                    trade_page: true,
                    positions_page: true,
                })
            );
            localStorage.setItem('presets_onboarding_guide', 'true');
            localStorage.setItem('trade_param_guide', 'true');
            localStorage.setItem('automation_onboarding_completed', 'true');
        });
    }

    /**
     * Navigate to the dtrader root. Use only as the initial entry point.
     */
    async gotoTradePage(): Promise<void> {
        await this.page.goto('/');
        await this.page.waitForLoadState('domcontentloaded');
        await NavigationUtils.waitForDerivApiSettled(this.page);
        await expect(
            this.activeMarketTab,
            'Active market tab should be visible — confirms trade form is fully loaded'
        ).toBeVisible();
    }

    /**
     * Navigate to the Reports page.
     * - Desktop: clicks the sidebar Reports button → opens the Reports flyout
     * - Mobile: taps bottom nav Menu → taps "Open positions" in the menu
     *
     * Waits for the Deriv API to settle after navigation.
     */
    async goToReports(): Promise<void> {
        if (this.isMobile) {
            await this.bottomNavMenu.click();
            await this.page.waitForURL('**/menu');
            await this.mobileMenuOpenPositions.click();
        } else {
            await this.sidebarReportsButton.click();
        }
        await NavigationUtils.waitForDerivApiSettled(this.page);
    }

    /**
     * Click Home (sidebar on desktop, bottom nav on mobile) to return to the
     * home-app dashboard with the active OAuth session preserved.
     */
    async clickHome(): Promise<void> {
        const homeButton = this.isMobile ? this.bottomNavHome : this.sidebarHomeButton;
        await expect(homeButton, 'Home button should be visible before navigating to home dashboard').toBeVisible();
        await homeButton.click();
        await this.page.waitForURL(/\/dashboard\/home/, { timeout: 90_000 });
        await NavigationUtils.waitForDerivApiSettled(this.page);
    }

    /**
     * Navigate to the Positions view.
     * - Desktop: waits for the flyout if already open (automation opens it on run start);
     *   otherwise clicks sidebar Positions to open it
     * - Mobile: clicks the bottom nav Positions tab → navigates to positions page
     *
     * Waits for Deriv API to settle after navigation.
     */
    async goToPositions(): Promise<void> {
        if (this.isMobile) {
            await this.bottomNavPositions.click();
        } else {
            const flyout = this.page.locator('.dc-flyout.dc-flyout--open');
            if (!(await flyout.isVisible().catch(() => false))) {
                await this.sidebarPositionsButton.click();
            }
            await expect(flyout, 'Positions flyout should be open on desktop').toBeVisible();
        }
        await NavigationUtils.waitForDerivApiSettled(this.page);
    }

    /**
     * Trigger logout for the current viewport.
     * - Desktop: clicks the sidebar's "Log out" nav item directly
     * - Mobile: navigates to the menu page via the bottom nav then clicks "Log out"
     */
    async logout(): Promise<void> {
        if (this.isMobile) {
            await this.bottomNavMenu.click();
            await this.page.waitForURL('**/menu');
        }
        await this.logoutButton.click();
    }

    /**
     * Open the account switcher from the account-info trigger and wait for it to list accounts.
     * Works on both viewports — desktop renders an inline dropdown, mobile an ActionSheet, but
     * both mount the same account rows.
     *
     * @returns Promise that resolves once at least one account row is visible.
     */
    async openAccountSwitcher(): Promise<void> {
        await expect(
            this.accountInfo,
            'Account info trigger should be visible before opening the account switcher'
        ).toBeVisible();
        await this.accountInfo.click();
        await expect(
            this.accountSwitcherList,
            'Account switcher list should be visible after opening the switcher'
        ).toBeVisible();
    }

    /**
     * Switch to an account of the given type via the account switcher, then wait for the switch to
     * fully settle (the trigger reflects the new account type and the Deriv API has reconnected).
     *
     * `client.switchAccount` is fire-and-forget — it swaps localStorage and reconnects the
     * WebSocket, showing a skeleton loader in between — so the settle is confirmed by the
     * account-type label updating rather than by the click alone.
     *
     * No-op when the target account is already active — the active row renders `disabled`, so
     * opening the switcher and clicking it would hang until timeout. Guarding keeps the method
     * idempotent.
     *
     * @param type - The account type to switch to: `'real'` or `'demo'`.
     * @returns Promise that resolves once the target account is active.
     */
    async switchToAccountType(type: 'real' | 'demo'): Promise<void> {
        const expectedText = type === 'real' ? 'Real account' : 'Demo account';
        const currentLabel = (await this.activeAccountTypeLabel.textContent())?.trim() ?? '';
        if (currentLabel.includes(expectedText)) return; // already on the target account — nothing to do

        await this.openAccountSwitcher();
        const row = this.accountSwitcherItem(type);
        await expect(row, `A ${type} account row should be available in the switcher`).toBeVisible();
        await row.click();
        await this.verifyActiveAccountType(type);
        await NavigationUtils.waitForDerivApiSettled(this.page);
    }

    /**
     * Returns the current balance as a numeric string, stripped of currency suffix.
     * Source: account-header__balance — text format "998.86 USD"
     *
     * @returns Balance value, e.g. "998.86"
     */
    async getBalance(): Promise<string> {
        const text = await this.balance.innerText();
        return text
            .replace(/,/g, '')
            .replace(/\s+[A-Z]+$/, '')
            .trim();
    }

    // ============================================
    // VERIFICATIONS
    // ============================================

    /**
     * Returns the current UTC date as "YYYY-MM-DD".
     * Use this to assert date-based values in the audit grid (e.g. start time).
     *
     * @returns UTC date string, e.g. "2026-06-18"
     */
    getCurrentDate(): string {
        return new Date().toISOString().slice(0, 10);
    }

    /**
     * Converts an ISO date string ("YYYY-MM-DD") to the "DD Mon YYYY" format used by
     * the mobile entry/exit details section (e.g. "2026-07-07" → "07 Jul 2026").
     *
     * @param iso - ISO date string, e.g. "2026-07-07"
     * @returns Formatted date string, e.g. "07 Jul 2026"
     */
    static formatISODate(iso: string): string {
        const [year, month, day] = iso.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day} ${months[parseInt(month, 10) - 1]} ${year}`;
    }

    /**
     * Returns the current UTC date as "DD Mon YYYY" (e.g. "07 Jul 2026").
     * Use this for mobile entry/exit details date assertions where the UI renders
     * this format instead of the ISO "YYYY-MM-DD" used by the desktop audit grid.
     *
     * @returns Formatted date string, e.g. "07 Jul 2026"
     */
    getCurrentDateFormatted(): string {
        return TradeBasePage.formatISODate(this.getCurrentDate());
    }

    /**
     * Wait for the balance to decrease by the stake amount after a buy.
     * Polls the live balance element — needed because the WebSocket balance
     * update arrives asynchronously after the buy is confirmed.
     *
     * @param balanceBefore - Balance captured before clicking buy, e.g. "998.86"
     * @param stake         - Stake amount as a string, e.g. "10.50"
     */
    async verifyBalanceAfterContractPurchase(balanceBefore: string, stake: string): Promise<void> {
        const expectedBalance = (parseFloat(balanceBefore) - parseFloat(stake)).toFixed(2);
        await expect
            .poll(() => this.getBalance(), {
                message: `Balance should decrease by stake ${stake} after buy (${balanceBefore} → ${expectedBalance})`,
            })
            .toBe(expectedBalance);
    }

    /**
     * Wait for the balance to reflect the correct settlement after a contract closes.
     * Polls the live balance element until it matches the expected value — needed because
     * the WebSocket balance update arrives asynchronously after the contract settles.
     *
     * The balance before close = initialBalance - stake.
     * After close the account receives sellProceeds = stake + P&L back, so:
     *   expectedBalance = balanceBeforeClose + stake + P&L
     *
     * @param balanceBeforeClose - Balance captured immediately before clicking Close, e.g. "959.89"
     * @param stake              - Stake amount as a string, e.g. "10.50"
     * @param profitLossAmount   - P&L from the closed positions card, e.g. "+1.26 USD" or "-2.05 USD"
     */
    async verifyBalanceAfterContractClose(
        balanceBeforeClose: string,
        stake: string,
        profitLossAmount: string,
        currentBalance: string
    ): Promise<void> {
        const pnl = parseFloat(
            profitLossAmount
                .replace(/,/g, '')
                .replace(/[A-Za-z]+$/, '')
                .trim()
        );
        const expectedBalance = (parseFloat(balanceBeforeClose) + parseFloat(stake) + pnl).toFixed(2);
        expect(
            currentBalance,
            `Balance after close should be ${expectedBalance} (${balanceBeforeClose} + ${stake} + ${pnl})`
        ).toBe(expectedBalance);
    }

    /**
     * Assert the browser correctly redirected to DTrader for the expected account type
     * (e.g. after clicking Trade on the Real or Demo tab in home-app Options).
     *
     * Verifies:
     * - Navigation leaves home-app and lands on a Deriv DTrader host (home-app always opens
     *   `staging-dtrader.deriv.com`, even when the test started on a PR preview `BASE_URL`)
     * - Does not stop on `/dashboard/options` or `/dashboard/home`
     * - DTrader trade page chrome is loaded (market tabs, balance, logged-in header)
     * - Active account matches the Options tab (`real` or `demo`)
     *
     * @param type - `'real'` or `'demo'` — must match the Options tab used before Trade was clicked.
     */
    async verifyLandedOnDTraderAs(type: 'real' | 'demo'): Promise<void> {
        const baseUrl = process.env.BASE_URL;
        const loginUrl = process.env.LOGIN_URL;
        if (!baseUrl || !loginUrl) {
            throw new Error('BASE_URL and LOGIN_URL must be set in playwright/.env.staging');
        }

        const dtraderHost = new URL(baseUrl).hostname;
        const homeHost = new URL(loginUrl).hostname;

        await this.page.waitForURL(
            url => url.hostname === dtraderHost || /dtrader\.deriv\.(com|be|me)/i.test(url.hostname),
            { timeout: 90_000 }
        );

        const currentUrl = this.page.url();
        if (currentUrl.includes('/dashboard/options')) {
            throw new Error(
                'Options Trade opened /dashboard/options instead of DTrader — redirect to DTrader did not occur.'
            );
        }
        if (currentUrl.includes('/dashboard/home') || new URL(currentUrl).hostname === homeHost) {
            throw new Error('Still on home dashboard — redirect to DTrader did not occur.');
        }

        await expect(this.page, `Should redirect to staging DTrader after Options ${type} Trade click`).toHaveURL(
            /dtrader\.deriv\.(com|be|me)/i
        );
        await expect(this.page, 'Should leave home-app domain after Options Trade click').not.toHaveURL(
            new RegExp(homeHost.replace(/\./g, '\\.'))
        );

        await expect(
            this.tradeTypeTabsContainer,
            'DTrader market tabs should be visible — confirms trade page loaded'
        ).toBeVisible({ timeout: 60_000 });
        await expect(
            this.activeMarketTab,
            'Active market tab should be visible — confirms DTrader trade form loaded'
        ).toBeVisible({ timeout: 60_000 });
        await expect(this.accountInfo, 'Account info should be visible on DTrader after redirect').toBeVisible();
        await expect(this.balance, 'Balance should be visible on DTrader after redirect').toBeVisible();
        await expect(this.loginButton, 'Login button should not be visible on authenticated DTrader').not.toBeVisible();

        await this.verifyActiveAccountType(type);

        if (type === 'real') {
            await expect(this.depositButton, 'Deposit button should be visible on real DTrader account').toBeVisible();
            await expect(
                this.tryRealButton,
                'Try real button should not be visible on real DTrader account'
            ).not.toBeVisible();
        }

        await NavigationUtils.waitForDerivApiSettled(this.page);
    }

    /**
     * Verify the user is logged in — account info, balance, login button, and sidebar nav items.
     * Sidebar nav assertions are desktop-only (sidebar is not rendered on mobile).
     */
    async verifySuccessfulLogin(): Promise<void> {
        const baseUrl = process.env.BASE_URL;
        if (!baseUrl) {
            throw new Error('BASE_URL must be set in playwright/.env.staging');
        }
        const expectedHost = new URL(baseUrl).hostname;
        await expect(this.page, `Should land on DTrader (${expectedHost}) after login`).toHaveURL(
            new RegExp(expectedHost.replace(/\./g, '\\.'))
        );

        await expect(this.accountInfo, 'Account info should be visible after login').toBeVisible();
        await expect(this.balance, 'Balance should be visible after login').toBeVisible();
        await expect(this.depositButton, 'Deposit button should be visible after login').toBeVisible();
        await expect(this.loginButton, 'Login button should not be visible after login').not.toBeVisible();

        if (this.isMobile) {
            await expect(this.bottomNavHome, 'Bottom nav Home tab should be visible after login').toBeVisible();
            await expect(this.bottomNavTrade, 'Bottom nav Trade tab should be visible after login').toBeVisible();
            await expect(
                this.bottomNavPositions,
                'Bottom nav Positions tab should be visible after login'
            ).toBeVisible();
            await expect(this.bottomNavMenu, 'Bottom nav Menu tab should be visible after login').toBeVisible();
        } else {
            await expect(this.sidebarHomeButton, 'Sidebar Home button should be visible after login').toBeVisible();
            await expect(
                this.sidebarPositionsButton,
                'Sidebar Positions button should be visible after login'
            ).toBeVisible();
            await expect(
                this.sidebarReportsButton,
                'Sidebar Reports button should be visible after login'
            ).toBeVisible();
            await expect(this.sidebarHelpButton, 'Sidebar Help button should be visible after login').toBeVisible();
            await expect(
                this.sidebarLanguageButton,
                'Sidebar Language button should be visible after login'
            ).toBeVisible();
            await expect(this.sidebarThemeButton, 'Sidebar Theme button should be visible after login').toBeVisible();
            await expect(
                this.sidebarLogoutButton,
                'Sidebar Log out button should be visible after login'
            ).toBeVisible();
        }
    }

    /**
     * Verify which account is currently active by reading the account-info trigger's type label.
     * Polls (with a generous timeout) to tolerate the skeleton loader shown mid-switch while the
     * WebSocket reconnects.
     *
     * @param type - Expected active account type: `'real'` or `'demo'`.
     * @returns Promise that resolves once the trigger reflects the expected account type.
     */
    async verifyActiveAccountType(type: 'real' | 'demo'): Promise<void> {
        const expectedText = type === 'real' ? 'Real account' : 'Demo account';
        await expect(
            this.activeAccountTypeLabel,
            `Account trigger should show "${expectedText}" once the ${type} account is active`
        ).toContainText(expectedText);
    }

    /**
     * Verify the user is logged out — login button visible, account info absent.
     */
    async verifyLoggedOut(): Promise<void> {
        await expect(this.loginButton, 'Login button should reappear after logout').toBeVisible();
        await expect(this.accountInfo, 'Account info should not be visible after logout').not.toBeVisible();
    }
}
