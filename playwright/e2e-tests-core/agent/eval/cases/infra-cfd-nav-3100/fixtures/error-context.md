# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: crypto-exchange/verify-exchange-funded-landing.spec.ts >> Crypto Exchange — Funded Landing State >> VERIFY funded state hero shows balance, Deposit, Withdraw, and asset list
- Location: playwright/tests/crypto-exchange/verify-exchange-funded-landing.spec.ts:49:9

# Error details

```
Error: Trade/CFDs nav link should be visible after login

expect(locator).toBeVisible() failed

Locator: locator('nav.lg\\:hidden a[href="/dashboard/cfds"]')
Expected: visible
Timeout: 45000ms
Error: element(s) not found

Call log:
  - Trade/CFDs nav link should be visible after login with timeout 45000ms
  - waiting for locator('nav.lg\\:hidden a[href="/dashboard/cfds"]')

```

```yaml
- alert: Deriv - Online Trading Platform
- link:
      - /url: /dashboard/dashboard/cfds
- link:
      - /url: /dashboard/dashboard/options
- link:
      - /url: /dashboard/dashboard/portfolio
- button "Go to profile": DR
- button "Ask Amy"
- button "Hide balances":
      - img
- button "Notifications":
      - img
      - text: '1'
- main:
      - button "Total value"
      - button "Refresh" [disabled]:
            - img
      - button "Deposit"
      - heading "My trading accounts" [level=2]
      - paragraph: Something went wrong.
      - button "Try again":
            - img
            - text: Try again
      - heading "Explore Deriv" [level=2]
      - button
      - button
      - button
      - button
      - button "P2P":
            - img
            - text: P2P
      - button [disabled]
- navigation:
      - link "Home":
            - /url: /dashboard/home
            - img
            - text: Home
      - link "Portfolio":
            - /url: /dashboard/portfolio
            - img
            - text: Portfolio
- button "Back"
- button "Notifications":
      - text: Notifications
      - img
- button:
      - img
- text: Address verified We have verified your address.
- button:
      - img
- button:
      - img
- button:
      - img
- text: 14d ago
- button "Back":
      - img
- img
- paragraph: No transactions yet
```

# Test source

````ts
  595 |   ): Promise<string> {
  596 |     const loginEmail = email ?? process.env.TEST_EMAIL;
  597 |     const loginPassword = password ?? process.env.TEST_PASSWORD;
  598 |
  599 |     if (!loginEmail || !loginPassword) {
  600 |       throw new Error(
  601 |         "Login credentials not found. Provide email/password or set " +
  602 |         "TEST_EMAIL and TEST_PASSWORD in playwright/.env.staging"
  603 |       );
  604 |     }
  605 |
  606 |     await this.gotoLoginPage();
  607 |     await this.enterEmailAndSubmit(loginEmail);
  608 |
  609 |     const enterPasswordPage = new PasswordPage(this.page);
  610 |     await enterPasswordPage.enterPasswordAndSubmit(loginPassword);
  611 |
  612 |     // Kratos AAL2 step-up: 2FA-enabled accounts are redirected to /login-totp
  613 |     // instead of going straight to the dashboard.
  614 |     await this.page.waitForURL(/\/login-totp/, { timeout: 30_000 });
  615 |     await this.verifyLoginTotpPage(loginEmail);
  616 |
  617 |     return loginEmail;
  618 |   }
  619 |
  620 |   /**
  621 |    * Complete the full 2-step login flow (email → password → home dashboard).
  622 |    *
  623 |    * Navigates to the login page, enters credentials, waits for the dashboard
  624 |    * to load, asserts the nav home link is visible, and waits for the Deriv API
  625 |    * to settle.
  626 |    *
  627 |    * @param email - User email (uses TEST_EMAIL env var if not provided)
  628 |    * @param password - User password (uses TEST_PASSWORD env var if not provided)
  629 |    * @param isEuRegion - `true` for an EU or UAE account, `false` for ROW. Defaults to `false`.
  630 |    *   The caller supplies this because the test knows which account it logs in with; region
  631 |    *   is NOT inferred from the rendered nav (that would be circular — the nav is part of what
  632 |    *   login verifies). EU/UAE accounts hide the Options nav link (`isUaeOrEu` gate in
  633 |    *   `src/components/layouts/sidebar.tsx` / `mobile-nav.tsx`), so the Options assertion is
  634 |    *   gated on the declared region: visible for ROW, hidden for EU/UAE.
  635 |    * @param hasCfdsNav - `false` for accounts that have no CFD trading accounts and therefore
  636 |    *   do not show the CFDs/Trade nav link. Defaults to `true`. Pass `false` for dedicated
  637 |    *   profile-edit or other non-trading test accounts so the CFDs nav assertion is skipped.
  638 |    * @returns The email address used to log in
  639 |    *
  640 |    * @throws If credentials are missing
  641 |    *
  642 |    * @example
  643 |    * ```typescript
  644 |    * // ROW (default)
  645 |    * await loginPage.login();  // uses TEST_EMAIL + TEST_PASSWORD from env
  646 |    * // EU/UAE account — declare the region so Options is asserted hidden, not visible
  647 |    * await loginPage.login(euEmail, undefined, true);
  648 |    * // Profile-edit account without CFD trading accounts
  649 |    * await loginPage.login(profileEmail, undefined, false, false);
  650 |    * ```
  651 |    */
  652 |   async login(
  653 |     email?: string,
  654 |     password?: string,
  655 |     isEuRegion: boolean = false,
  656 |     hasCfdsNav: boolean = true
  657 |   ): Promise<string> {
  658 |     const loginEmail = email ?? process.env.TEST_EMAIL;
  659 |     const loginPassword = password ?? process.env.TEST_PASSWORD;
  660 |
  661 |     if (!loginEmail || !loginPassword) {
  662 |       throw new Error(
  663 |         "Login credentials not found. Provide email/password or set " +
  664 |         "TEST_EMAIL and TEST_PASSWORD in playwright/.env.staging"
  665 |       );
  666 |     }
  667 |
  668 |     await this.gotoLoginPage();
  669 |     await this.enterEmailAndSubmit(loginEmail);
  670 |
  671 |     const enterPasswordPage = new PasswordPage(this.page);
  672 |     await enterPasswordPage.enterPasswordAndSubmit(loginPassword);
  673 |
  674 |     // Happy path: password → /dashboard/home. If the browser lands on /login-totp
  675 |     // (Kratos AAL2 step-up), the account has 2FA enabled — tests that legitimately
  676 |     // expect that state use `loginExpectingTotp()`. Race both URLs so a stuck 2FA
  677 |     // account fails fast with an actionable message instead of a 45s timeout.
  678 |     await this.page.waitForURL(/\/dashboard\/(home|login-totp)/);
  679 |     if (this.page.url().includes("/login-totp")) {
  680 |       throw new Error(
  681 |         `Login for ${loginEmail} redirected to /login-totp (AAL2 step-up), but ` +
  682 |         `login() expects an account without 2FA. Either use loginExpectingTotp() ` +
  683 |         `for a 2FA-enabled account, or reset 2FA on this account — a prior 2FA ` +
  684 |         `test run may have left it enabled.`
  685 |       );
  686 |     }
  687 |     await NavigationUtils.waitForDerivApiSettled(this.page);
  688 |
  689 |     const homePage = new HomePage(this.page);
  690 |     await expect(homePage.navHomeLink, 'Home nav link should be visible after login').toBeVisible();
  691 |     // Labeled "CFDs" for ROW and "Trade" for EU/UAE; the locator targets href="/dashboard/cfds" (region-agnostic).
  692 |     // Skipped when hasCfdsNav=false — for accounts without CFD trading accounts that legitimately
  693 |     // hide this link (useShowCfdsNav returns false when no CFD account is present).
  694 |     if (hasCfdsNav) {
> 695 |       await expect(homePage.navCfdsLink, 'Trade/CFDs nav link should be visible after login').toBeVisible();
      |                                                                                               ^ Error: Trade/CFDs nav link should be visible after login
  696 |     }
  697 |     // Options nav link is region-gated: EU/UAE hide it (isUaeOrEu gate in sidebar/mobile-nav).
  698 |     // Region comes from the caller (what the test knows about its account), never inferred
  699 |     // from the nav — so a regression in the nav cannot silently disable this assertion.
  700 |     if (!isEuRegion) {
  701 |       await expect(homePage.navOptionsLink, 'Options nav link should be visible for ROW account').toBeVisible();
  702 |     } else {
  703 |       await expect(homePage.navOptionsLink, 'Options nav link should be hidden for EU/UAE account').toBeHidden();
  704 |     }
  705 |     await expect(homePage.navPortfolioLink, 'Portfolio nav link should be visible after login').toBeVisible();
  706 |     await expect(homePage.exploreDerivHeader, '"Explore Deriv" heading should be visible after login').toBeVisible();
  707 |
  708 |     return loginEmail;
  709 |   }
  710 |
  711 |   /**
  712 |    * Attempt login with a known-wrong password and assert the credentials error message.
  713 |    * Submits the email (navigating to /enter-password), enters the given password, and
  714 |    * verifies the inline error message appears.
  715 |    *
  716 |    * `expectedError` is intentionally a free-form string parameter — callers pass the
  717 |    * exact copy they expect so this method can cover any error variant (wrong password,
  718 |    * locked account, etc.) without coupling `LoginPage` to a specific message.
  719 |    * If the app copy changes, update the string at the call site in the spec file.
  720 |    *
  721 |    * @param email - The account email to submit
  722 |    * @param wrongPassword - The password that should be rejected
  723 |    * @param expectedError - Expected error message text (pass the exact string shown in the UI)
  724 |    */
  725 |   async verifyLoginRejected(email: string, wrongPassword: string, expectedError: string): Promise<void> {
  726 |     await this.submitEmail(email);
  727 |     const enterPasswordPage = new PasswordPage(this.page);
  728 |     await enterPasswordPage.enterPasswordAndSubmit(wrongPassword);
  729 |     await expect(enterPasswordPage.credentialsError,
  730 |       `Login should be rejected with error: "${expectedError}"`).toHaveText(expectedError);
  731 |   }
  732 |
  733 |   // ============================================
  734 |   // VERIFICATIONS
  735 |   // ============================================
  736 |
  737 |   /**
  738 |    * Assert the Turnstile widget is rendered on /login: the container and the
  739 |    * Cloudflare-injected `cf-turnstile-response` hidden input are attached.
  740 |    *
  741 |    * The widget runs in `appearance: "interaction-only"` mode — Cloudflare
  742 |    * does not inject an iframe unless an interactive challenge is required, so
  743 |    * the hidden response input is the artifact that proves the widget mounted.
  744 |    *
  745 |    * The container only mounts in phone-mode — call `switchToPhoneMode()`
  746 |    * before this verification.
  747 |    */
  748 |   async verifyTurnstileWidgetRendered(): Promise<void> {
  749 |     await expect(
  750 |       this.turnstileContainer,
  751 |       "Turnstile container should be attached to the DOM on /login when in phone-mode",
  752 |     ).toBeAttached();
  753 |     await expect(
  754 |       this.turnstileResponseInput,
  755 |       "Cloudflare Turnstile hidden response input should be rendered inside the container on /login",
  756 |     ).toBeAttached();
  757 |   }
  758 |
  759 |   /**
  760 |    * Assert the "No account found" server error is shown after a client-lookup
  761 |    * response with no active `deriv`/v2 row (e.g. `legacy`- or `uae`-brand-only
  762 |    * entries). Checks the error text references the identifier method used
  763 |    * ("email" or "phone number") and that the nested "sign up" link is visible.
  764 |    *
  765 |    * @param method - Which identifier path was submitted, controls the expected wording.
  766 |    */
  767 |   async verifyNoAccountFound(method: "email" | "phone" = "email"): Promise<void> {
  768 |     await expect(
  769 |       this.serverError,
  770 |       "\"No account found\" server error should be visible after login",
  771 |     ).toBeVisible();
  772 |     await expect(
  773 |       this.serverError,
  774 |       `"No account found" error should reference the ${method} identifier method`,
  775 |     ).toContainText(method === "phone" ? "phone number" : "email");
  776 |     await expect(
  777 |       this.noAccountSignupLink,
  778 |       "\"Sign up\" link nested in the no-account error should be visible",
  779 |     ).toBeVisible();
  780 |   }
  781 |
  782 |   /** Assert that all expected elements on the login page are visible */
  783 |   async verifyLoginPageElements(): Promise<void> {
  784 |     await expect(this.welcomeBackHeading, '"Welcome back" heading should be visible').toBeVisible();
  785 |     await expect(this.emailInput, 'Email input should be visible').toBeVisible();
  786 |     await expect(this.logInButton, '"Log in" button should be visible').toBeVisible();
  787 |     await expect(this.googleButton, '"Log in with Google" button should be visible').toBeVisible();
  788 |     await expect(this.facebookButton, '"Log in with Facebook" button should be visible').toBeVisible();
  789 |     await expect(this.appleButton, '"Log in with Apple" button should be visible').toBeVisible();
  790 |     await expect(this.signUpLink, '"Sign up" link should be visible').toBeVisible();
  791 |     await expect(this.languageSwitcher, 'Language switcher button should be visible').toBeVisible();
  792 |     await expect(this.liveChatButton, 'Live chat button should be visible').toBeVisible();
  793 |   }
  794 |
  795 |   /**
````
