# 📋 Auth Journey Spec — What to Test

> **Purpose:** Describes authentication flows on `staging-dtrader.deriv.com`. Defines _what_ to verify at each step.
>
> **Feature location:** Header (login button + account info) · Deriv login page (`LOGIN_URL`) · Sidebar (desktop logout) · Bottom nav menu (mobile logout) · Sidebar/bottom-nav Home button (cross-app redirect to home-app) · home-app Options page (`/dashboard/options`)
> **URL:** `https://staging-dtrader.deriv.com/` (trade page) · `https://staging-dtrader.deriv.com/menu` (mobile menu) · `https://staging-home.deriv.com/dashboard/home` (home dashboard) · `https://staging-home.deriv.com/dashboard/options` (Options hub)
> **Authentication:** Flows 1–2 drive the external Deriv login page (unauthenticated). Flows 3–4 start from a logged-in state.
> **Staging only:** Tests use `TEST_EMAIL` / `TEST_PASSWORD` / `MAILISK_API_KEY` env vars set in `playwright/.env.staging`

---

## Flow 1 — Email + Password Login → lands back on dtrader

**Prerequisites:** Unauthenticated. Test account: `TEST_EMAIL` / `TEST_PASSWORD` from `playwright/.env.staging`. Account must NOT have 2FA enabled — use a dedicated test account.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to app | `tradePage.gotoTradePage()` | dtrader loads at `BASE_URL` | Both |
| 2 | Click Login button | Click "Log in" button in the header | Browser navigates to Deriv login page | Both |
| 3 | Verify login page | `loginPage.verifyLoginPageElements()` | Email input and Log in button visible | Both |
| 4 | Enter email | Type `TEST_EMAIL` into email input (use `pressSequentially`) | Email field populated | Both |
| 5 | Submit email | `loginPage.clickLogInButton()` | Browser navigates to enter-password page | Both |
| 6 | Verify enter-password page | `passwordPage.verifyEnterPasswordPageElements()` | Password input and Log in button visible | Both |
| 7 | Enter password | Type `TEST_PASSWORD` into password field | Password field populated (masked) | Both |
| 8 | Submit password | `passwordPage.clickLogInButton()` | Browser redirects back to dtrader (`staging-dtrader.deriv.com`) | Both |
| 9 | Verify login success | `tradePage.verifySuccessfulLogin()` | Account info pill visible, balance visible, login button gone | Both |

> **Note:** Email input on the Deriv login page requires `pressSequentially` — `fill()` does not trigger the input handlers correctly (same behaviour as home-app). Verify exact input `data-testid` / role on the login page.

---

## Flow 2 — OTP Login → lands back on dtrader

**Prerequisites:** Unauthenticated. Test account must use a `@webapps.mailisk.net` email so Mailisk can intercept the OTP. Requires `MAILISK_API_KEY`.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to login page | `loginPage.gotoLoginPage()` | Deriv login page loads | Both |
| 2 | Enter email | Type Mailisk test email into email input | Email field populated | Both |
| 3 | Request OTP | Click "Send OTP" / "Use OTP" button | OTP sent to Mailisk inbox; OTP input appears | Both |
| 4 | Retrieve OTP | `MailiskUtils.getOtp(emailPrefix, fromTimestamp)` | 6-digit OTP retrieved | Both |
| 5 | Enter OTP | Fill each OTP digit input | All 6 digits entered | Both |
| 6 | Submit | Click confirm / submit | Browser redirects back to dtrader | Both |
| 7 | Verify login success | Observe header | Account info pill visible (`dt_acc_info`), login button gone | Both |

> **Note:** Record `fromTimestamp = Date.now()` before step 3 — pass it to `MailiskUtils.getOtp()` to avoid retrieving a stale OTP from a previous test run.

> **Note:** OTP input is split into 6 separate digit fields (same as home-app Quill `<Code>` component). Fill each digit individually — verify exact selectors on staging.

---

## Flow 3 — Logout → success modal → session cleared

**Prerequisites:** Authenticated — `loginPage.login()` called in `beforeEach`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Open logout entry point | Click "Account" item (`dt_sidebar_account`) in left sidebar | Account flyout opens | Desktop |
| 1 | Open logout entry point | Tap "Menu" in bottom nav | Navigates to menu page | Mobile |
| 2 | Trigger logout | Click "Log out" button in flyout | Logout success modal appears | Desktop |
| 2 | Trigger logout | Tap "Log out" item in menu page | Logout success action sheet appears | Mobile |
| 3 | Verify modal title | Observe modal / action sheet | Title: "Log out successful" | Both |
| 4 | Verify modal message | Observe modal / action sheet | Message contains "To sign out everywhere" | Both |
| 5 | Dismiss | Click "Got it" button | Modal / action sheet closes | Both |
| 6 | Verify logged out | Observe header / page | Login button visible (`#dt_login_button_v2`) | Both |

> **Desktop surface:** `packages/trader/src/AppV2/Components/Layout/Sidebar/account-selector.tsx` — `dt_sidebar_account` opens a Flyout with `AccountSelector`. When `isBridgeAvailable` (native app bridge), the button reads "Back to app"; in browser it always reads "Log out".

> **Mobile surface:** `packages/core/src/Modules/Menu/menu.tsx` — reached by tapping the "Menu" tab in the bottom nav. `MenuPage` redirects to `/` on desktop, so this path is mobile-only. Navigation must be via UI click — never `page.goto('/menu')`.

> **Shared modal:** Both surfaces fire `client.logout()` and display `LogoutSuccessModal` — desktop renders as a Modal, mobile as an ActionSheet.

---

## Flow 4 — Home → Options → DTrader redirect

**Prerequisites:** Authenticated on DTrader. Test account: `TEST_EMAIL` / `TEST_PASSWORD` from `playwright/.env.staging`. Account must have a **created Options account** (Real and Demo) — without one, Trade opens `/dashboard/options` instead of DTrader and the flow must fail.

**Shared setup** (runs in `beforeEach` before each sub-flow):

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Seed localStorage | `TradeBasePage.seedLocalStorageOnOrigin()` + `HomePage.seedLocalStorageOnOrigin()` | Onboarding / deposit nudge suppressed on both origins | Both |
| 2 | Log in on DTrader | `loginPage.login()` → `verifySuccessfulLogin()` | Lands on `BASE_URL` host (PR preview when overridden); account info + balance visible | Both |
| 3 | Return to home | `tradeBasePage.clickHome()` | Browser navigates to `staging-home.deriv.com/dashboard/home` | Both |
| 4 | Dismiss post-login UI | `homePage.dismissPostLoginPopupsIfPresent()` | TNC / deposit nudge dismissed if shown | Both |
| 5 | Verify active session | `homePage.verifyOnHomeDashboard()` | URL is `/dashboard/home`; not redirected to login | Both |
| 6 | Open Options | `homePage.navigateToOptionsFromSidebar()` | URL is `/dashboard/options` | Both |
| 7 | Verify Options loaded | `optionsPage.verifyOptionsPageLoaded()` | Real/Demo tabs and banner Trade button visible | Both |

### Flow 4.1 — Demo tab Trade → DTrader demo account

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 8 | Switch to Demo | `optionsPage.switchToDemoTab()` | Demo banner controls visible (Trade + Reset balance) | Both |
| 9 | Click Trade | `optionsPage.clickTradeBanner()` | Browser leaves home-app and lands on a `dtrader.deriv.*` host (typically `staging-dtrader.deriv.com` — home-app Trade does not open the PR preview `BASE_URL`) | Both |
| 10 | Verify DTrader | `tradeBasePage.verifyLandedOnDTraderAs('demo')` | DTrader trade page on `dtrader.deriv.*`; market tabs + balance; account trigger shows **Demo account** | Both |

### Flow 4.2 — Real tab Trade → DTrader real account

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 8 | Switch to Real | `optionsPage.switchToRealTab()` | Real banner controls visible (Trade + Transfer) | Both |
| 9 | Click Trade | `optionsPage.clickTradeBanner()` | Browser leaves home-app and lands on a `dtrader.deriv.*` host (typically `staging-dtrader.deriv.com` — home-app Trade does not open the PR preview `BASE_URL`) | Both |
| 10 | Verify DTrader | `tradeBasePage.verifyLandedOnDTraderAs('real')` | DTrader trade page on `dtrader.deriv.*`; account trigger shows **Real account**; Deposit visible, Try real hidden | Both |

> **Desktop Home button:** `packages/trader/src/AppV2/Components/Layout/Sidebar/sidebar.tsx` — `dt_sidebar_home` assigns `window.location.href` to `{brandUrl}/home?source=options&acc=options&curr=…`.

> **Mobile Home button:** `packages/core/src/App/Containers/Layout/bottom-nav/bottom-nav.tsx` — bottom nav "Home" item uses the same `getBrandUrl()/home` redirect via `sendBridgeEvent('trading:home', …)`.

> **Options Trade banner:** home-app `/dashboard/options` — `data-testid="options-btn-trade"`. Opens DTrader in the same tab for the active Real or Demo tab.

> **Must not pass on Options hub:** If Trade stops on `/dashboard/options`, the test account lacks a created Options account — fix the account/env; do not treat the Options hub as a successful redirect.

> **Preview vs redirect host:** Step 2 (`verifySuccessfulLogin()`) asserts the post-login hostname matches `BASE_URL` (PR preview when overridden). Steps 9–10 (`verifyLandedOnDTraderAs()`) assert a `dtrader.deriv.*` host — home-app Options Trade always opens staging DTrader, even when login started on a preview URL. The two assertions are intentionally split.
