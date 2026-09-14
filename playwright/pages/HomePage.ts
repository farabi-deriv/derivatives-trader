import { Page, Locator, expect } from '@playwright/test';
import { NavigationUtils } from '../e2e-tests-core/utils';

/**
 * Page Object for the authenticated home dashboard (`/dashboard/home` on home.deriv.com).
 *
 * Used when tests navigate from DTrader via the Home button and need to verify
 * the cross-app session is still active before opening Options.
 */
export class HomePage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // ============================================
    // LOCATORS
    // ============================================

    private get isMobile(): boolean {
        return (this.page.viewportSize()?.width ?? 1024) < 1024;
    }

    /** "Explore Deriv" section heading — confirms the home dashboard has loaded. */
    get exploreDerivHeader(): Locator {
        return this.page.getByRole('heading', { name: 'Explore Deriv', exact: true });
    }

    /**
     * Options sidebar / bottom-nav link — viewport-aware.
     * Desktop: `nav:not(.lg:hidden) a[href="/dashboard/options"]`
     * Mobile: `nav.lg:hidden a[href="/dashboard/options"]`
     */
    get navOptionsLink(): Locator {
        if (this.isMobile) {
            return this.page.locator('nav.lg\\:hidden a[href="/dashboard/options"]');
        }
        return this.page.locator('nav:not(.lg\\:hidden) a[href="/dashboard/options"]');
    }

    get tncUpdateModal(): Locator {
        return this.page.getByTestId('tnc-update-modal');
    }

    get tncUpdateModalAcceptButton(): Locator {
        return this.page.getByTestId('tnc-update-modal-btn-accept');
    }

    get depositNudgeSheet(): Locator {
        return this.page.getByTestId('deposit-nudge-sheet');
    }

    get depositNudgeCloseButton(): Locator {
        return this.page.getByTestId('deposit-nudge-btn-close');
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Seed localStorage on the home-app origin before the test starts.
     * Suppresses the deposit nudge sheet that can appear after login.
     */
    static async seedLocalStorageOnOrigin(page: Page): Promise<void> {
        const loginUrl = process.env.LOGIN_URL;
        if (!loginUrl) {
            throw new Error('LOGIN_URL not set in playwright/.env.staging');
        }
        const homeOrigin = new URL(loginUrl).origin;
        await page.goto(`${homeOrigin}/dashboard/home`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
            localStorage.setItem('deposit_nudge_viewed', 'true');
        });
    }

    /**
     * Dismiss post-login overlays that can block navigation (TNC update, deposit nudge).
     */
    async dismissPostLoginPopupsIfPresent(): Promise<void> {
        const tncAppeared = await this.tncUpdateModal
            .waitFor({ state: 'visible', timeout: 5_000 })
            .then(() => true)
            .catch(() => false);

        if (tncAppeared) {
            await this.tncUpdateModalAcceptButton.click();
            await this.tncUpdateModal.waitFor({ state: 'hidden' });
        }

        if (!(await this.depositNudgeSheet.isVisible({ timeout: 5_000 }).catch(() => false))) {
            return;
        }

        if (this.isMobile) {
            await this.page.mouse.click(10, 10);
        } else {
            await this.depositNudgeCloseButton.click();
        }
        await this.depositNudgeSheet.waitFor({ state: 'hidden' });
    }

    /**
     * Click Options in the sidebar / bottom nav and wait for `/dashboard/options`.
     */
    async navigateToOptionsFromSidebar(): Promise<void> {
        await expect(this.navOptionsLink, 'Options nav link should be visible on home dashboard').toBeVisible();
        await this.navOptionsLink.click();
        await expect(this.page, 'Should navigate to the Options page').toHaveURL(/\/dashboard\/options/);
        await NavigationUtils.waitForDerivApiSettled(this.page);
    }

    // ============================================
    // VERIFICATIONS
    // ============================================

    /**
     * Assert the browser landed on the home dashboard with an active session
     * (not redirected back to login).
     */
    async verifyOnHomeDashboard(): Promise<void> {
        await expect(this.page, 'Should land on home dashboard after clicking Home from DTrader').toHaveURL(
            /\/dashboard\/home/
        );
        await expect(this.page, 'Active session should not redirect to login').not.toHaveURL(/\/dashboard\/login/);
        await expect(
            this.exploreDerivHeader,
            'Explore Deriv heading should confirm home dashboard loaded with active session'
        ).toBeVisible({ timeout: 60_000 });
    }
}
