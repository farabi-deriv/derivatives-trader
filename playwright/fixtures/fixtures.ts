import { test as base, Page } from '@playwright/test';
import { NavigationUtils } from '../e2e-tests-core/utils';
import { LoginPage } from '../pages/LoginPage';
import { PasswordPage } from '../pages/PasswordPage';
import { TradeBasePage } from '../pages/TradeBasePage';
import { TradeParametersPage } from '../pages/TradeParametersPage';
import { TradeRiseFallPage } from '../pages/TradeRiseFallPage';
import { TradeHigherLowerPage } from '../pages/TradeHigherLowerPage';
import { TradeTouchNoTouchPage } from '../pages/TradeTouchNoTouchPage';
import { TradeMatchesDiffersPage } from '../pages/TradeMatchesDiffersPage';
import { TradeOverUnderPage } from '../pages/TradeOverUnderPage';
import { TradeEvenOddPage } from '../pages/TradeEvenOddPage';
import { TradeMultipliersPage } from '../pages/TradeMultipliersPage';
import { TradeAccumulatorsPage } from '../pages/TradeAccumulatorsPage';
import { TradeTurbosPage } from '../pages/TradeTurbosPage';
import { TradeVanillasPage } from '../pages/TradeVanillasPage';
import { TradeValidationPage } from '../pages/TradeValidationPage';
import { TradeAutomatePage } from '../pages/TradeAutomatePage';
import { PositionsPage } from '../pages/PositionsPage';
import { ReportsPage } from '../pages/ReportsPage';
import { ContractDetailsPage } from '../pages/ContractDetailsPage';
import { FeedPage } from '../pages/FeedPage';
import { MarketSelectionPage } from '../pages/MarketSelectionPage';
import { NotificationsPage } from '../pages/NotificationsPage';

/**
 * Extended test fixtures with page object models for derivatives-trader.
 *
 * Import `test` from this file in all spec files — NOT from `@playwright/test` directly.
 *
 * @example
 * ```typescript
 * import { test, expect } from "../fixtures/fixtures";
 *
 * test("my test", async ({ tradeBasePage }) => {
 *   await tradeBasePage.gotoTradePage();
 * });
 * ```
 *
 * To add a new fixture:
 *   1. Create the page object in `playwright/pages/`
 *   2. Import it here
 *   3. Add the type to the `base.extend<{...}>()` generic
 *   4. Add the fixture implementation below
 */
/**
 * Suppress WebAuthn / Passkeys browser popup ("Your device can't be used with this site").
 *
 * Chrome `--disable-features` flags cannot suppress this popup because it is
 * triggered by the OS-level credential manager, not Chrome's internal WebAuthn
 * feature flag.  Ory Kratos calls `navigator.credentials.get({ mediation: "conditional" })`
 * on every page load.  Stubbing `navigator.credentials` at the JS init-script
 * level prevents the call from ever reaching the browser's native credential UI.
 */
async function suppressWebAuthn(page: Page): Promise<void> {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'credentials', {
            value: {
                get: () => Promise.resolve(null),
                create: () => Promise.resolve(null),
                store: () => Promise.resolve(null),
                preventSilentAccess: () => Promise.resolve(undefined),
            },
            writable: false,
            configurable: true,
        });
    });
}

export const test = base.extend<{
    loginPage: LoginPage;
    passwordPage: PasswordPage;
    tradeBasePage: TradeBasePage;
    tradeParametersPage: TradeParametersPage;
    tradeRiseFallPage: TradeRiseFallPage;
    tradeHigherLowerPage: TradeHigherLowerPage;
    tradeTouchNoTouchPage: TradeTouchNoTouchPage;
    tradeMatchesDiffersPage: TradeMatchesDiffersPage;
    tradeOverUnderPage: TradeOverUnderPage;
    tradeEvenOddPage: TradeEvenOddPage;
    tradeMultipliersPage: TradeMultipliersPage;
    tradeAccumulatorsPage: TradeAccumulatorsPage;
    tradeTurbosPage: TradeTurbosPage;
    tradeVanillasPage: TradeVanillasPage;
    tradeValidationPage: TradeValidationPage;
    tradeAutomatePage: TradeAutomatePage;
    positionsPage: PositionsPage;
    reportsPage: ReportsPage;
    contractDetailsPage: ContractDetailsPage;
    feedPage: FeedPage;
    marketSelectionPage: MarketSelectionPage;
    notificationsPage: NotificationsPage;
    /** True when running under a mobile project (viewport width < 1024px). */
    isMobileViewport: boolean;
}>({
    /**
     * Override the built-in `page` fixture to register the WebAuthn suppression
     * init script before any test code runs.  This is the only reliable way to
     * prevent the OS-level passkeys popup — Chrome flags alone cannot suppress it.
     */
    page: async ({ page }, use) => {
        await suppressWebAuthn(page);
        await use(page);
    },

    /**
     * Login page fixture — provides initialized LoginPage instance
     */
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },

    /**
     * Enter Password page fixture — provides initialized PasswordPage instance
     * (Separate page from login — Ory Kratos 2-step flow)
     */
    passwordPage: async ({ page }, use) => {
        await use(new PasswordPage(page));
    },

    /**
     * Trade base page fixture — provides initialized TradeBasePage instance
     */
    tradeBasePage: async ({ page }, use) => {
        await use(new TradeBasePage(page));
    },

    /**
     * Trade parameters page fixture — provides initialized TradeParametersPage instance
     */
    tradeParametersPage: async ({ page }, use) => {
        await use(new TradeParametersPage(page));
    },

    /**
     * Trade Rise/Fall page fixture — provides initialized TradeRiseFallPage instance
     */
    tradeRiseFallPage: async ({ page }, use) => {
        await use(new TradeRiseFallPage(page));
    },

    /**
     * Trade Higher/Lower page fixture — provides initialized TradeHigherLowerPage instance
     */
    tradeHigherLowerPage: async ({ page }, use) => {
        await use(new TradeHigherLowerPage(page));
    },

    /**
     * Trade Touch/No Touch page fixture — provides initialized TradeTouchNoTouchPage instance
     */
    tradeTouchNoTouchPage: async ({ page }, use) => {
        await use(new TradeTouchNoTouchPage(page));
    },

    /**
     * Trade Matches/Differs page fixture — provides initialized TradeMatchesDiffersPage instance
     */
    tradeMatchesDiffersPage: async ({ page }, use) => {
        await use(new TradeMatchesDiffersPage(page));
    },

    /**
     * Trade Over/Under page fixture — provides initialized TradeOverUnderPage instance
     */
    tradeOverUnderPage: async ({ page }, use) => {
        await use(new TradeOverUnderPage(page));
    },

    /**
     * Trade Even/Odd page fixture — provides initialized TradeEvenOddPage instance
     */
    tradeEvenOddPage: async ({ page }, use) => {
        await use(new TradeEvenOddPage(page));
    },

    /**
     * Trade Multipliers page fixture — provides initialized TradeMultipliersPage instance
     */
    tradeMultipliersPage: async ({ page }, use) => {
        await use(new TradeMultipliersPage(page));
    },

    /**
     * Trade Accumulators page fixture — provides initialized TradeAccumulatorsPage instance
     */
    tradeAccumulatorsPage: async ({ page }, use) => {
        await use(new TradeAccumulatorsPage(page));
    },

    /**
     * Trade Turbos page fixture — provides initialized TradeTurbosPage instance
     */
    tradeTurbosPage: async ({ page }, use) => {
        await use(new TradeTurbosPage(page));
    },

    /**
     * Trade Vanillas page fixture — provides initialized TradeVanillasPage instance
     */
    tradeVanillasPage: async ({ page }, use) => {
        await use(new TradeVanillasPage(page));
    },

    /**
     * Manual Trading negative-validation fixture.
     */
    tradeValidationPage: async ({ page }, use) => {
        await use(new TradeValidationPage(page));
    },

    /**
     * Trade Automate page fixture — provides initialized TradeAutomatePage instance
     */
    tradeAutomatePage: async ({ page }, use) => {
        await use(new TradeAutomatePage(page));
    },

    /**
     * Positions page fixture — provides initialized PositionsPage instance
     */
    positionsPage: async ({ page }, use) => {
        await use(new PositionsPage(page));
    },

    /**
     * Reports page fixture — provides initialized ReportsPage instance
     */
    reportsPage: async ({ page }, use) => {
        await use(new ReportsPage(page));
    },

    /**
     * Contract details page fixture — provides initialized ContractDetailsPage instance
     */
    contractDetailsPage: async ({ page }, use) => {
        await use(new ContractDetailsPage(page));
    },

    /**
     * Feed page fixture — provides initialized FeedPage instance
     */
    feedPage: async ({ page }, use) => {
        await use(new FeedPage(page));
    },

    /**
     * Market selection page fixture — provides initialized MarketSelectionPage instance
     */
    marketSelectionPage: async ({ page }, use) => {
        await use(new MarketSelectionPage(page));
    },

    /**
     * Notifications page fixture — provides initialized NotificationsPage instance
     */
    notificationsPage: async ({ page }, use) => {
        await use(new NotificationsPage(page));
    },

    /**
     * isMobileViewport fixture — true when the current project uses a mobile viewport
     * (width < 1024px, i.e. below the Tailwind `lg` breakpoint).
     *
     * **Important:** The viewport width is captured **once** at fixture initialisation time,
     * before any test code runs.  If a test calls `page.setViewportSize()` mid-run, this
     * fixture will NOT reflect the updated width.  It is intended solely for differentiating
     * between mobile and desktop Playwright *projects* (configured in `playwright.config.ts`),
     * not for tests that dynamically resize the viewport.
     *
     * Use this in tests instead of hardcoding viewport checks:
     * @example
     * ```typescript
     * test('my test', async ({ isMobileViewport }) => {
     *   if (!isMobileViewport) {
     *     // desktop-only step
     *   }
     * });
     * ```
     */
    isMobileViewport: async ({ page }, use) => {
        // Snapshot the viewport width at fixture creation time (project-level viewport).
        // This will not update if the test calls page.setViewportSize() after this point.
        const width = page.viewportSize()?.width ?? 1024;
        await use(width < 1024);
    },
});

/**
 * Redirection helper functions for direct URL-based page navigation.
 * Uses Playwright's baseURL from config — relative paths are automatically
 * resolved against it.
 *
 * Use these helpers when you need to quickly jump to a page without relying
 * on sidebar clicks (e.g. after completing account creation).
 */
export const redirectionHelpers = {
    /**
     * Redirect to a page by appending the given endpoint to the baseURL.
     * Waits for DOM content to be loaded and all deriv.com API requests to settle.
     *
     * NOTE: API settle listeners are attached BEFORE `page.goto()` to capture
     * in-flight requests triggered during navigation.
     *
     * @param page - Playwright page object
     * @param endpoint - The URL path to redirect to (e.g. '/bot')
     *
     * @example
     * ```typescript
     * await redirectionHelpers.redirectTo(page, '/bot');
     * ```
     */
    redirectTo: async (page: Page, endpoint: string): Promise<void> => {
        // Start tracking API requests BEFORE navigation so in-flight requests are captured
        const apiSettled = NavigationUtils.waitForDerivApiSettled(page);
        await page.goto(endpoint);
        await page.waitForLoadState('domcontentloaded');
        await apiSettled;
    },
};

// Re-export expect for convenience
export { expect } from '@playwright/test';
