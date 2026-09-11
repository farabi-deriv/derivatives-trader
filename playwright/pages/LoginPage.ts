import { Page, Locator, expect } from '@playwright/test';
import { NavigationUtils } from '../e2e-tests-core/utils';
import { PasswordPage } from './PasswordPage';
import { TradeBasePage } from './TradeBasePage';

/**
 * Page Object for the Deriv login page (/dashboard/login) — email entry step.
 *
 * The login flow spans two pages:
 *   1. `/dashboard/login`          — email input + submit  (this page)
 *   2. `/dashboard/enter-password` — password input + submit → redirects to dtrader (PasswordPage)
 *
 * OTP flow diverges at step 2:
 *   2a. Click "Try another verification method" → "Get a one-time code"
 *   2b. `/dashboard/login-otp` — 6-digit OTP input
 *
 * @example
 * ```typescript
 * test('VERIFY login', async ({ loginPage, passwordPage, tradePage }) => {
 *     await loginPage.gotoLoginPage();
 *     await loginPage.enterEmail(process.env.TEST_EMAIL!);
 *     await loginPage.clickLogInButton();
 *     await passwordPage.enterPassword(process.env.TEST_PASSWORD!);
 *     await passwordPage.clickLogInButton();
 *     await tradePage.verifySuccessfulLogin();
 * });
 * ```
 */
export class LoginPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // ============================================
    // LOCATORS
    // ============================================

    /** "Welcome back" heading — confirms the login page has loaded */
    get welcomeBackHeading(): Locator {
        return this.page.getByRole('heading', { level: 1 });
    }

    /** Email field label — clicking it reveals the native input (Quill lazy render) */
    get emailTextboxLabel(): Locator {
        return this.page.locator('label[for="login-identifier"]');
    }

    /** Native <input> revealed after clicking the label */
    get emailTextboxInput(): Locator {
        return this.page.locator('#login-identifier');
    }

    /** Submit / Log in button on the email step */
    get logInButton(): Locator {
        return this.page.getByTestId('login-btn-submit').getByRole('button', { name: 'Log in' });
    }

    /** "Log in with Google" social button */
    get googleButton(): Locator {
        return this.page.getByTestId('social-btn-google');
    }

    /** "Log in with Facebook" social button */
    get facebookButton(): Locator {
        return this.page.getByTestId('social-btn-facebook');
    }

    /** "Log in with Apple" social button */
    get appleButton(): Locator {
        return this.page.getByTestId('social-btn-apple');
    }

    /** "Sign up" link */
    get signUpLink(): Locator {
        return this.page.getByTestId('login-link-signup');
    }

    /** Language switcher button */
    get languageSwitcher(): Locator {
        return this.page.getByTestId('auth-language-btn');
    }

    /** Live chat button */
    get liveChatButton(): Locator {
        return this.page.getByTestId('auth-btn-live-chat');
    }

    // ============================================
    // LOCATORS — OTP page (/dashboard/login-otp)
    // ============================================

    /** Container wrapping all 6 OTP digit inputs */
    get otpInputContainer(): Locator {
        return this.page.getByTestId('login-otp-input-otp');
    }

    /** Individual OTP digit inputs by position (1-based) */
    otpDigitInput(digit: 1 | 2 | 3 | 4 | 5 | 6): Locator {
        return this.page.getByRole('textbox', { name: `Digit ${digit}` });
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Navigate to the Deriv login page.
     */
    async gotoLoginPage(): Promise<void> {
        const loginUrl = process.env.LOGIN_URL;
        if (!loginUrl) throw new Error('LOGIN_URL not set in playwright/.env.staging');
        await this.page.goto(loginUrl);
        await this.page.waitForLoadState('domcontentloaded');
    }

    /**
     * Fill the email field. Asserts the label is visible, dispatches a click to reveal
     * the native input, waits for it to appear, then fills it.
     * @param email - Email address to type
     */
    async enterEmail(email: string): Promise<void> {
        await expect(this.emailTextboxInput, 'Email input should be visible').toBeVisible();
        await this.emailTextboxInput.pressSequentially(email, { delay: 70 });
    }

    /**
     * Click the Log in button and wait for the enter-password page to load.
     */
    async clickLogInButton(): Promise<void> {
        await this.logInButton.click();
    }

    /**
     * Full login flow: navigate to app, click Login, enter credentials, assert successful login.
     * Falls back to TEST_EMAIL / TEST_PASSWORD env vars if no credentials are provided.
     *
     * After OAuth returns, the trade shell sometimes mounts late (especially on mobile).
     * Recovery order per attempt: verify → page reload + re-verify → full re-login (up to 3 attempts).
     *
     * @param email - Optional email override
     * @param password - Optional password override
     * @returns The email address used to log in
     */
    async login(email?: string, password?: string): Promise<string> {
        const loginEmail = email ?? process.env.TEST_EMAIL;
        const loginPassword = password ?? process.env.TEST_PASSWORD;

        if (!loginEmail || !loginPassword) {
            throw new Error(
                'Login credentials not found. Provide email/password or set ' +
                    'TEST_EMAIL and TEST_PASSWORD in playwright/.env.staging'
            );
        }

        const tradeBasePage = new TradeBasePage(this.page);
        const maxAttempts = 3;
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await tradeBasePage.gotoTradePage();

                // A prior attempt may already have cookies; skip OAuth if the shell is up.
                if (await tradeBasePage.accountInfo.isVisible().catch(() => false)) {
                    await tradeBasePage.verifySuccessfulLogin();
                    return loginEmail;
                }

                await tradeBasePage.loginButton.click();
                await this.enterEmail(loginEmail);
                await this.clickLogInButton();

                const passwordPage = new PasswordPage(this.page);
                await passwordPage.enterPassword(loginPassword);
                await passwordPage.clickLogInButton();

                await NavigationUtils.waitForDerivApiSettled(this.page);
                await this.verifyLoginWithRefreshRecovery(tradeBasePage);
                return loginEmail;
            } catch (error) {
                lastError = error;
                if (attempt === maxAttempts) {
                    break;
                }
            }
        }

        throw lastError instanceof Error ? lastError : new Error(`Login failed after ${maxAttempts} attempts`);
    }

    /**
     * Assert logged-in shell; on miss, reload once and re-assert (covers late account-info mount).
     */
    private async verifyLoginWithRefreshRecovery(tradeBasePage: TradeBasePage): Promise<void> {
        try {
            await tradeBasePage.verifySuccessfulLogin();
        } catch {
            await this.page.reload({ waitUntil: 'domcontentloaded' });
            await NavigationUtils.waitForDerivApiSettled(this.page);
            await tradeBasePage.verifySuccessfulLogin();
        }
    }

    /**
     * Fill the 6-digit OTP. Fills digit 1 with the full code (auto-advances).
     * @param otp - 6-character OTP string
     */
    async fillOtp(otp: string): Promise<void> {
        // First digit input has maxlength=6 and auto-advances — fill the full OTP there
        await this.otpDigitInput(1).fill(otp);
    }

    /**
     * Enter the 6-digit OTP and wait for the OTP input to be visible first.
     * Alias for fillOtp with an explicit visibility wait.
     * @param otp - 6-character OTP string
     */
    async enterOTP(otp: string): Promise<void> {
        await expect(this.otpInputContainer, 'OTP input container should be visible on OTP page').toBeVisible();
        await this.otpDigitInput(1).fill(otp);
    }

    // ============================================
    // VERIFICATIONS
    // ============================================

    /**
     * Verify the login page has loaded with all expected elements visible.
     */
    async verifyLoginPageElements(): Promise<void> {
        await expect(this.welcomeBackHeading, '"Welcome back" heading should be visible').toBeVisible();
        await expect(this.emailTextboxLabel, 'Email input should be visible').toBeVisible();
        await expect(this.logInButton, '"Log in" button should be visible').toBeVisible();
        await expect(this.googleButton, '"Log in with Google" button should be visible').toBeVisible();
        await expect(this.facebookButton, '"Log in with Facebook" button should be visible').toBeVisible();
        await expect(this.appleButton, '"Log in with Apple" button should be visible').toBeVisible();
        await expect(this.signUpLink, '"Sign up" link should be visible').toBeVisible();
        await expect(this.languageSwitcher, 'Language switcher button should be visible').toBeVisible();
        await expect(this.liveChatButton, 'Live chat button should be visible').toBeVisible();
    }
}
