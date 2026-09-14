import { Page, Locator, expect } from '@playwright/test';
import { NavigationUtils } from '../e2e-tests-core/utils';

/**
 * Page Object for the Options dashboard (`/dashboard/options` on home.deriv.com).
 *
 * Covers the Real/Demo account tabs and the banner Trade shortcut that opens DTrader.
 */
export class OptionsPage {
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

    /**
     * Real account tab — viewport-aware.
     * Desktop: `options-tab-real` · Mobile: `options-tab-mobile-real`
     */
    get tabReal(): Locator {
        const byTestId = this.page.getByTestId(this.isMobile ? 'options-tab-mobile-real' : 'options-tab-real');
        return byTestId.or(this.page.getByRole('button', { name: 'Real', exact: true }));
    }

    /**
     * Demo account tab — viewport-aware.
     * Desktop: `options-tab-demo` · Mobile: `options-tab-mobile-demo`
     */
    get tabDemo(): Locator {
        const byTestId = this.page.getByTestId(this.isMobile ? 'options-tab-mobile-demo' : 'options-tab-demo');
        return byTestId.or(this.page.getByRole('button', { name: 'Demo', exact: true }));
    }

    /**
     * "Trade" shortcut in the Real/Demo account banner.
     * Opens DTrader for the active tab. `data-testid="options-btn-trade"`
     */
    get tradeButton(): Locator {
        return this.page.getByTestId('options-btn-trade');
    }

    /** Demo-tab-only control — confirms the Demo banner is active. `options-btn-reset-balance` */
    get resetBalanceButton(): Locator {
        return this.page.getByTestId('options-btn-reset-balance');
    }

    /** Real-tab-only control — confirms the Real banner is active. `options-btn-transfer` */
    get transferButton(): Locator {
        return this.page.getByTestId('options-btn-transfer');
    }

    // ============================================
    // ACTIONS
    // ============================================

    /** Switch to the Real tab and wait for the Real banner controls. */
    async switchToRealTab(): Promise<void> {
        await this.tabReal.click();
        await NavigationUtils.waitForDerivApiSettled(this.page);
        await expect(this.tradeButton, 'Real tab Trade button should be visible after switching to Real').toBeVisible();
        await expect(
            this.transferButton,
            'Real tab Transfer button should be visible after switching to Real'
        ).toBeVisible();
    }

    /** Switch to the Demo tab and wait for the Demo banner controls. */
    async switchToDemoTab(): Promise<void> {
        await this.tabDemo.click();
        await NavigationUtils.waitForDerivApiSettled(this.page);
        await expect(this.tradeButton, 'Demo tab Trade button should be visible after switching to Demo').toBeVisible();
        await expect(
            this.resetBalanceButton,
            'Demo tab Reset balance button should be visible after switching to Demo'
        ).toBeVisible();
    }

    /** Click the banner Trade button — navigates to DTrader for the active tab. */
    async clickTradeBanner(): Promise<void> {
        await expect(this.tradeButton, 'Trade button should be visible in Options banner before click').toBeVisible();
        await this.tradeButton.click();
    }

    // ============================================
    // VERIFICATIONS
    // ============================================

    /** Assert the Options page loaded and the banner Trade CTA is ready. */
    async verifyOptionsPageLoaded(): Promise<void> {
        await expect(this.page, 'Should be on the Options dashboard page').toHaveURL(/\/dashboard\/options/);
        await expect(this.tabReal, 'Real tab should be visible on Options page').toBeVisible();
        await expect(this.tabDemo, 'Demo tab should be visible on Options page').toBeVisible();
        await expect(this.tradeButton, 'Trade button should be visible in Options banner').toBeVisible({
            timeout: 90_000,
        });
    }
}
