# 🗺️ Auth Journey Catalog — Technical Reference

> Source of truth: `packages/core/src/App/Components/Layout/Header/` · `packages/core/src/Modules/Menu/menu.tsx` · `packages/trader/src/AppV2/Components/Layout/Sidebar/` · home-app `/dashboard/options` (external — page objects in `playwright/pages/HomePage.ts`, `playwright/pages/OptionsPage.ts`)
> Last updated: 2026-09-11

---

## Section 1 — Journey Index

| Journey ID | Spec File | Tags |
| --- | --- | --- |
| Flow 1 | `auth/verify-login-via-email-password.spec.ts` | `@auth @smoke @desktop @mobile @production` |
| Flow 2 | `auth/verify-login-via-otp.spec.ts` | `@auth @smoke @desktop @mobile @production` |
| Flow 3 | `auth/verify-logout.spec.ts` | `@auth @smoke @desktop @mobile @production` |
| Flow 4.1 | `auth/verify-home-to-dtrader-redirect.spec.ts` | `@auth @smoke @desktop @mobile @production` |
| Flow 4.2 | `auth/verify-home-to-dtrader-redirect.spec.ts` | `@auth @smoke @desktop @mobile @production` |

---

## Section 2 — Flow Details

### Flow 1 — Email + Password Login → lands back on dtrader

**Account setup:** Uses `TEST_EMAIL` / `TEST_PASSWORD` from `playwright/.env.staging`. Account must NOT have 2FA/OTP enabled.

**Test pattern:**

```typescript
test.describe('Login — Email and Password', { tag: ['@auth', '@smoke', '@desktop', '@mobile', '@production'] }, () => {
    test('VERIFY email and password login redirects back to DTrader successfully', async ({
        loginPage,
        passwordPage,
        tradeBasePage,
    }) => {
        await tradeBasePage.gotoTradePage();
        await tradeBasePage.loginButton.click();
        await loginPage.verifyLoginPageElements();
        await loginPage.enterEmail(process.env.TEST_EMAIL!);
        await loginPage.clickLogInButton();
        await passwordPage.verifyEnterPasswordPageElements();
        await passwordPage.enterPassword(process.env.TEST_PASSWORD!);
        await passwordPage.clickLogInButton();
        await tradeBasePage.verifySuccessfulLogin();
    });
});
```

> **Note on email input:** Use `pressSequentially` not `fill` — the Deriv login page input handlers require character-by-character input.

---

### Flow 2 — OTP Login → lands back on dtrader

**Account setup:** Uses `TEST_OTP_EMAIL` / `TEST_OTP_EMAIL_MOBILE` from `playwright/.env.staging`. Must be a `@webapps.mailisk.net` address. Requires `MAILISK_API_KEY`. Runs serially to avoid OTP inbox conflicts.

**Test pattern:**

```typescript
test.describe.configure({ mode: 'serial' });
test.describe('Login - One-Time Code', { tag: ['@auth', '@smoke', '@desktop', '@mobile', '@production'] }, () => {
    let testEmail: string = undefined!;

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const emailVar = isMobile ? 'TEST_EMAIL_MOBILE' : 'TEST_EMAIL';
        const email = process.env[emailVar];
        if (!email) throw new Error(`${emailVar} is not set in playwright/.env.staging`);
        testEmail = email;
    });

    test('VERIFY user can log in using a one-time code sent to email', async ({
        loginPage,
        passwordPage,
        tradeBasePage,
    }) => {
        const toAddrPrefix = testEmail.split('@')[0];
        await tradeBasePage.gotoTradePage();
        await tradeBasePage.loginButton.click();
        await loginPage.verifyLoginPageElements();
        await loginPage.enterEmail(testEmail);
        await loginPage.clickLogInButton();
        const fromTimestamp = Math.floor(Date.now() / 1000);
        await passwordPage.clickGetOtp();
        const { otp } = await MailiskUtils.extractOtp(
            'webapps',
            {
                to_addr_prefix: toAddrPrefix,
                subject_includes: 'Your one-time code for your account',
                from_timestamp: fromTimestamp,
                wait: true,
            },
            { timeout: 180_000 }
        );
        expect(otp, 'OTP should be a non-empty string').toBeTruthy();
        await loginPage.enterOTP(otp);
        await tradeBasePage.verifySuccessfulLogin();
    });
});
```

> **Note on `fromTimestamp`:** Captured as `Math.floor(Date.now() / 1000)` (Unix seconds) BEFORE `passwordPage.clickGetOtp()` — ensures only the OTP triggered by this test run is retrieved.

> **Note on OTP input:** `loginPage.enterOTP(otp)` waits for the OTP container to be visible then fills digit 1 (auto-advances through all 6 fields).

---

### Flow 3 — Logout → session cleared

**Account setup:** Uses `TEST_EMAIL` / `TEST_PASSWORD`. `loginPage.login()` handles the full login flow. Platform-branched internally via `tradeBasePage.logout()`.

**Test pattern:**

```typescript
test.describe('Logout', { tag: ['@auth', '@smoke', '@desktop', '@mobile', '@production'] }, () => {
    test.beforeAll(async () => {
        if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
            throw new Error(
                'Missing required env vars: TEST_EMAIL and TEST_PASSWORD must be set in playwright/.env.staging'
            );
        }
    });

    test('VERIFY logout and re-login', async ({ loginPage, tradeBasePage }) => {
        await loginPage.login();
        await tradeBasePage.verifySuccessfulLogin();
        await tradeBasePage.logout();
        await tradeBasePage.verifyLoggedOut();
    });
});
```

> **`loginPage.login()`:** Full login flow — navigates to `BASE_URL`, clicks Login button, enters credentials, waits for API to settle, asserts `verifySuccessfulLogin()`.

> **`tradeBasePage.logout()`:** Desktop clicks `dt_sidebar_account` then "Log out"; mobile taps the bottom nav Menu tab, waits for `/menu`, then clicks "Log out".

---

### Flow 4 — Home → Options → DTrader redirect

**Account setup:** Uses `TEST_EMAIL` / `TEST_PASSWORD`. Account must have a **created Options account** (both Real and Demo tabs usable). Seeds localStorage on DTrader and home-app origins before login to suppress onboarding tours and deposit nudge.

**Test pattern:**

```typescript
test.describe('Home to DTrader redirect', { tag: ['@auth', '@smoke', '@desktop', '@mobile', '@production'] }, () => {
    test.beforeEach(async ({ page, loginPage, tradeBasePage, homePage, optionsPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await HomePage.seedLocalStorageOnOrigin(page);

        await loginPage.login();
        await tradeBasePage.verifySuccessfulLogin();

        await tradeBasePage.clickHome();
        await homePage.dismissPostLoginPopupsIfPresent();
        await homePage.verifyOnHomeDashboard();

        await homePage.navigateToOptionsFromSidebar();
        await optionsPage.verifyOptionsPageLoaded();
    });

    test('VERIFY Demo tab Trade redirects to DTrader demo account', async ({ optionsPage, tradeBasePage }) => {
        await optionsPage.switchToDemoTab();
        await optionsPage.clickTradeBanner();
        await tradeBasePage.verifyLandedOnDTraderAs('demo');
    });

    test('VERIFY Real tab Trade redirects to DTrader real account', async ({ optionsPage, tradeBasePage }) => {
        await optionsPage.switchToRealTab();
        await optionsPage.clickTradeBanner();
        await tradeBasePage.verifyLandedOnDTraderAs('real');
    });
});
```

> **`tradeBasePage.clickHome()`:** Desktop clicks `dt_sidebar_home`; mobile taps bottom nav "Home". Both assign `window.location.href` to `{getBrandUrl()}/home?source=options&acc=options&curr=…`.

> **`verifySuccessfulLogin()`:** Asserts the browser is on the `BASE_URL` hostname after OAuth (PR preview when `BASE_URL` is overridden), then account chrome.
>
> **`verifyLandedOnDTraderAs(type)`:** Waits for a `dtrader.deriv.*` host (home-app Trade always opens staging DTrader, even from a preview login), rejects `/dashboard/home` and `/dashboard/options`, asserts market tabs + balance + account type (`Real account` / `Demo account`). On real accounts, also asserts Deposit visible and Try real hidden. Demo accounts with both Real and Demo wallets show Deposit (not Try real) — account-type label is the authoritative demo check.

---

## Section 3 — Tags Reference

| Tag | When to apply |
| --- | --- |
| `@auth` | Login state, logout, session handling |
| `@smoke` | Critical path — must pass on every run |
| `@production` | Safe to run on production (read-only assertions only) |
| `@desktop` | Desktop viewport (chromium project, 1728×1117) |
| `@mobile` | Mobile viewport (chromium-mobile project, 500×850) |

---

## Section 4 — Feature-Specific Decisions

### Login flow starts from BASE_URL — navigate via app Login button

All flows navigate to `BASE_URL` first, then click the Login button in the header. This matches the real user journey. `loginPage.login()` encapsulates the full flow. `loginPage.gotoLoginPage()` is available for tests that need to navigate directly to the login page (e.g. OTP flow step-by-step).

### Email input uses `pressSequentially`, not `fill`

The Deriv login page email input is a Quill component — the `<input>` is only rendered after clicking the label (`label[for="login-identifier"]`). Use `pressSequentially` with `{ delay: 70 }` to avoid race conditions between email and phone number detection.

### OTP input is 6 separate digit fields

The OTP component is a Quill `<Code>` 6-digit input. `loginPage.enterOTP(otp)` waits for the container then fills digit 1 (auto-advances). Record `fromTimestamp = Math.floor(Date.now() / 1000)` (Unix seconds) before `passwordPage.clickGetOtp()`.

### `passwordPage.clickGetOtp()` wraps both clicks

`clickGetOtp()` calls `clickTryAnotherMethod()` internally, then clicks "Get a one-time code" and asserts the URL navigates to `/login-otp`. No need to call `clickTryAnotherMethod()` separately in tests.

### Logout is platform-branched in `tradeBasePage.logout()`

**Desktop:** clicks `dt_sidebar_account` → "Log out". **Mobile:** taps bottom nav Menu tab → waits for `/menu` → clicks "Log out". Tests call `tradeBasePage.logout()` — no `isMobile` branching needed in test files.

### `isMobileApp` hides logout, language, and help centre

When `isMobileApp` is true (native bridge), logout, language selector, and help centre are hidden. Tests run in browser where `isMobileApp` is false — these items are always visible.

### Cross-app Home redirect preserves OAuth session

Flow 4 navigates DTrader → home-app → DTrader in the same browser tab. Session cookies must survive the cross-origin hop. Seed `HomePage.seedLocalStorageOnOrigin()` before login to suppress home-app deposit nudge; call `homePage.dismissPostLoginPopupsIfPresent()` after landing on `/dashboard/home`.

### Options Trade must open DTrader, not the Options hub

`optionsPage.clickTradeBanner()` targets `data-testid="options-btn-trade"`. If the account has no created Options wallet, home-app routes to `/dashboard/options` content only — `verifyLandedOnDTraderAs()` throws explicitly rather than passing on the Options hub URL.
