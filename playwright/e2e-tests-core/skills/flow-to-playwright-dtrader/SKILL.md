---
name: flow-to-playwright-dtrader
description: Converts the existing flow documents in playwright/flows/ (flow.md + catalog.md + coverage.md) into Playwright test files for the derivatives-trader (DTrader) project. ONLY use for implementing gaps from coverage.md or generating tests from flows already documented in playwright/flows/. Do NOT use for general test writing or fixing failing tests.
version: 1.0.0
last_updated: 2026-06-16
---

# Flow-to-Playwright — DTrader Variant

This is the **derivatives-trader-specific** version of the `flow-to-playwright` skill.
It is a full standalone skill — do NOT load the shared `flow-to-playwright` skill alongside it.

> This skill exists because derivatives-trader diverges from home-app in four key areas:
>
> - **Monorepo source paths** — `packages/trader/src/`, `packages/core/src/`, `packages/reports/src/` (not `src/app/`)
> - **Two-step Deriv OAuth login** — `loginPage.login()` only; no `loginHelpers` export, no Ory Kratos flow
> - **`redirectionHelpers`** — in-app navigation utility (not forbidden, but must not replace UI clicks for user flows)
> - **Strict POM-only locators** — catalog snippets with inline `page.getByTestId()` calls must be moved to Page Objects

---

## 🎯 When to Use This Skill

**ONLY use this skill when converting the flow documents in `playwright/flows/` into Playwright tests.**

- ✅ Implementing a gap listed in a `playwright/flows/<feature>/coverage.md` file
- ✅ Generating a test for a flow described in a `playwright/flows/<feature>/flow.md` file
- ✅ Working with an existing `playwright/flows/<feature>/catalog.md` to produce a spec file

**Do NOT use this skill for:**

- ❌ Writing any test without a corresponding flow document
- ❌ Fixing or debugging a failing test (use the `playwright` skill instead)
- ❌ Creating a new Page Object from scratch (explore the live app first)
- ❌ General test writing without a flow.md or catalog.md to reference

---

## 🚨 Always Load the `playwright` Skill Alongside This Skill

**Before reading any files or writing any code, load BOTH skills:**

```
use_skill("flow-to-playwright-dtrader")   ← determines WHAT to generate (from flow docs)
use_skill("playwright")                   ← determines HOW to write high-quality code
```

The `playwright` skill provides critical rules from `playwright/AGENTS.md` governing test folder naming, TypeScript standards, Page Object patterns, navigation rules, and more.

---

## 📚 DTrader-Specific Rules (override shared skill defaults)

These rules apply to this project. They take precedence over any conflicting guidance in the shared `flow-to-playwright` skill.

### Rule 1 — Login is `loginPage.login()`, not `loginHelpers`

This project does NOT export a `loginHelpers` object from fixtures. Login is performed via the `loginPage` fixture:

```typescript
// ❌ WRONG — loginHelpers does not exist in this project
import { test, expect, loginHelpers } from '../../fixtures/fixtures';
await loginHelpers.login(page);

// ✅ CORRECT — use loginPage.login() from the fixture
import { test, expect } from '../../fixtures/fixtures';

test.describe('Feature', { tag: ['@feature', '@desktop'] }, () => {
    test.beforeEach(async ({ loginPage }) => {
        await loginPage.login();
    });
});
```

`loginPage.login()` reads `TEST_EMAIL` and `TEST_PASSWORD` from `playwright/.env.staging` automatically.

### Rule 2 — Login is two-step Deriv OAuth (not Ory Kratos)

This project uses a **two-step** OAuth redirect flow:

1. Navigate to `LOGIN_URL` (`staging-home.deriv.com/dashboard/login`)
2. Enter email → submit → redirects to `/dashboard/enter-password`
3. Enter password → submit → redirects back to `BASE_URL` (the dtrader app)

This is **not** Ory Kratos (home-app's pattern). It is a Deriv-hosted login hosted on `staging-home.deriv.com`, not the dtrader domain.

For OTP login flows: the Deriv login page also supports OTP. The flow is documented in `playwright/flows/auth/catalog.md`.

### Rule 2a — DTrader (AppV2) renders different DOM elements per viewport width

DTrader runs **AppV2 exclusively** — there is no "Classic" UI. However, **AppV2 renders different DOM elements depending on viewport width**:

| Viewport | Width    |
| -------- | -------- |
| Desktop  | ≥ 1024px |
| Mobile   | < 1024px |

The same logical element (e.g. account info, balance, login button) can have a `data-testid` on one viewport but use a CSS class or `id` on the other, or use a completely different selector type. **Never assume a single locator works on both viewports without verifying both.**

**Locator selector types — priority order (try top to bottom):**

| Priority | Type                   | Example                                   | Notes                                               |
| -------- | ---------------------- | ----------------------------------------- | --------------------------------------------------- |
| 1        | `data-testid`          | `getByTestId("dt_acc_info")`              | Most stable — use when present                      |
| 2        | `id`                   | `#dt_login_button_v2`                     | Stable — use when present                           |
| 3        | Role + accessible name | `getByRole('button', { name: 'Log in' })` | Use when element has `aria-label` or visible text   |
| 4        | Visible text           | `getByText('Log in')`                     | Use for labels/headings with no better anchor       |
| 5        | CSS class              | `.account-header__balance`                | Last resort — only when no testid/id/role available |

**Use `isMobile` to branch between layouts** when an element exists in both but with different selectors. Every dtrader Page Object should define this private helper:

```typescript
private get isMobile(): boolean {
    return (this.page.viewportSize()?.width ?? 1024) < 1024;
}
```

Then use it in locator getters:

```typescript
// ✅ CORRECT — explicit per-layout locators via isMobile
get accountInfo(): Locator {
    return this.isMobile
        ? this.page.getByTestId("dt_acc_info")
        : this.page.locator(".account-header__content");
}

get balance(): Locator {
    return this.isMobile
        ? this.page.getByTestId("dt_balance")
        : this.page.locator(".account-header__balance");
}

// ❌ WRONG — only works on mobile, silently fails on desktop
get accountInfo(): Locator {
    return this.page.getByTestId("dt_acc_info"); // missing on desktop viewport
}
```

**Known viewport-specific locators (source-verified):**

Desktop elements source: `packages/trader/src/AppV2/Components/AccountHeader/account-header.tsx`
Mobile elements source: `packages/core/src/App/Components/Layout/Header/` (`account-info.tsx`, `login-button.tsx`)

| Element           | Desktop (≥ 1024px)                                                         | Mobile (< 1024px)             |
| ----------------- | -------------------------------------------------------------------------- | ----------------------------- |
| Account info area | `.account-header__content`                                                 | `[data-testid="dt_acc_info"]` |
| Balance           | `.account-header__balance`                                                 | `[data-testid="dt_balance"]`  |
| Login button      | `getByRole('button', { name: 'Log in' })` (class `.account-header__login`) | `#dt_login_button_v2`         |

**Where to find locators — primary source locations:**

| Feature area                                         | Where to look first                                     |
| ---------------------------------------------------- | ------------------------------------------------------- |
| Trade form, contract type selector, trade parameters | `packages/trader/src/AppV2/Components/`                 |
| Trade page layout (desktop vs mobile containers)     | `packages/trader/src/AppV2/Containers/Trade/`           |
| Contract details page                                | `packages/trader/src/AppV2/Containers/ContractDetails/` |
| Positions list                                       | `packages/trader/src/AppV2/Containers/Positions/`       |
| Sidebar (desktop nav), account selector              | `packages/trader/src/AppV2/Components/Layout/Sidebar/`  |
| Bottom nav, header (mobile), login button            | `packages/core/src/App/Components/Layout/Header/`       |
| App shell, menu page (mobile)                        | `packages/core/src/`                                    |
| Reports (P&L, statement, portfolio)                  | `packages/reports/src/`                                 |
| Contract type constants, button display names        | `packages/shared/src/utils/constants/contract.ts`       |

**Rule: always start in `packages/trader/src/AppV2/` for anything on the trade page or contract details.** `packages/core/src/` covers only the app shell (header, bottom nav, login button, account info, menu).

**How to discover the right locator for a new element:**

1. **Search the source first** — most locators are findable without a browser:
    - For any **trade page element**: start in `packages/trader/src/AppV2/Components/` (component-level) and `packages/trader/src/AppV2/Containers/Trade/` (page-level layout)
    - For **app shell elements** (header, login button, balance, bottom nav): look in `packages/core/src/App/Components/Layout/Header/`
    - Check for `data-testid` first (`dt_` prefix convention), then `id`, then `aria-label`/role, then a stable unique CSS class
2. **Grep for the attribute directly:**

    ```bash
    # Find all data-testids in a feature component
    grep -r "data-testid" packages/trader/src/AppV2/Components/<Feature> --include="*.tsx" -n

    # Find all data-testids across the whole AppV2 trade area
    grep -r "data-testid" packages/trader/src/AppV2/ --include="*.tsx" -n | grep -i "<keyword>"
    ```

3. **Only use Playwright MCP as a last resort** — when test IDs are computed at runtime, the element is behind auth/account state you can't replicate from source, or source inspection alone is insufficient.
4. If both viewports have different selectors, use `isMobile` to branch in the Page Object getter.
5. If only one viewport is in scope for the test, a single selector is fine — document why.

### Rule 2b — Quill UI: login inputs are lazy-rendered and require a container click

Both the email and password fields on the Deriv login page use the **Quill UI component library**. The native `<input>` element is **not present in the DOM** until the container `<div>` is clicked first. This is a known Quill behaviour — the label/container is always visible, but the `<input>` is lazy-rendered on focus.

**LoginPage.ts naming convention:**

| Getter            | What it targets                                     | Used for                                      |
| ----------------- | --------------------------------------------------- | --------------------------------------------- |
| `emailTextbox`    | `[data-testid="login-input-identifier"]`            | Visibility assertions, `.click()` to activate |
| `emailInput`      | `emailTextbox.locator("input")`                     | `.pressSequentially()` to type                |
| `passwordTextbox` | `[data-testid="enter-password-input-password"]`     | Visibility assertions, `.click()` to activate |
| `passwordInput`   | `passwordTextbox.locator("input[type='password']")` | `.fill()` to type                             |

**Why `passwordInput` is scoped to `input[type='password']`:** The container also holds a "Show password" toggle button with `aria-label="Password"`, so `getByLabel('Password')` would be ambiguous.

**POM action pattern:**

```typescript
// ✅ CORRECT — click container first, then type into the native input
async fillEmail(email: string): Promise<void> {
    await this.emailTextbox.click();
    await this.emailInput.pressSequentially(email, { delay: 50 });
}

// ✅ CORRECT — same pattern for password
async fillPassword(password: string): Promise<void> {
    await this.passwordTextbox.click();
    await this.passwordInput.fill(password);
}

// ❌ WRONG — input not yet in DOM, will time out
async fillEmail(email: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Email or phone number' }).fill(email);
}
```

**Test assertion pattern** — assert the always-visible container, not the lazy input:

```typescript
// ✅ CORRECT — container is always visible on page load
await expect(loginPage.emailTextbox, 'Email field should be visible on the login page').toBeVisible();

// ❌ WRONG — native input is not in the DOM until container is clicked
await expect(loginPage.emailInput, 'Email input should be visible').toBeVisible();
```

---

### Rule 2c — Trade type selector is viewport-aware (different element on mobile)

On **desktop**, the trade type selector is an icon button with `aria-label="View all trade types"` (`trade-types-selector__button`). On **mobile**, this button is hidden and replaced by a `"View all"` text button in the scrollable trade types bar.

Always use `isMobile` to branch:

```typescript
get tradeTypeSelector(): Locator {
    return this.isMobile
        ? this.page.getByRole('button', { name: 'View all' })
        : this.page.getByLabel('View all trade types');
}
```

**Why `getByLabel` on desktop instead of `getByRole('button', { name: '...' })`:** The Quill tooltip wraps the button in a `<span role="button">` with the same accessible name, causing a strict mode violation. `getByLabel` resolves to the `<button aria-label="...">` only.

---

### Rule 2d — `getByRole` with `name` does NOT match by text content

`getByRole('paragraph', { name: 'Home' })` matches only elements with an **`aria-label`** or **`aria-labelledby`** of "Home" — it does NOT match `<p>Home</p>`.

Quill navigation labels (e.g. bottom nav, trade type chips) carry their label as **text content only**, with no `aria-label`. Use `getByText()` scoped to a stable container instead:

```typescript
// ❌ WRONG — <p> has no aria-label, locator finds nothing
this.page.locator('.bottom-nav-container').getByRole('paragraph', { name: 'Home' });

// ✅ CORRECT — matches by text content, scoped to avoid false matches elsewhere
this.page.locator('.bottom-nav-container').getByText('Home');
```

---

### Rule 3 — Source code search paths (monorepo)

When Step 2 says to search `src/` for locators and component structure, use these paths:

| Package                             | Source path             |
| ----------------------------------- | ----------------------- |
| Trading terminal (DTrader)          | `packages/trader/src/`  |
| App shell, routing, global stores   | `packages/core/src/`    |
| Reports (portfolio, statement, P&L) | `packages/reports/src/` |
| Shared utilities and contract types | `packages/shared/src/`  |

Never search `src/app/`, `src/features/`, or `src/components/` — those paths do not exist in this repo.

### Rule 4 — Catalog inline locators must move to Page Objects

Some catalog snippets contain inline `page.getByTestId()`, `page.locator()`, or `page.getByRole()` calls written directly in the test body. **This is a violation of this project's strict POM rule.**

Before using any catalog snippet, scan it for inline locators:

```typescript
// ❌ Catalog snippet with inline locator — VIOLATION
await expect(page.getByTestId('dt_acc_info'), '...').toBeVisible();

// ✅ Correct — move to a Page Object getter, then reference via fixture
// In TradePage.ts:
get accountInfo() { return this.page.getByTestId('dt_acc_info'); }
// In the test:
await expect(tradePage.accountInfo, 'Account info should be visible').toBeVisible();
```

**Rule:** Any `page.getByTestId(...)`, `page.locator(...)`, or `page.getByRole(...)` call that appears directly in a test body is a violation. Move it to the appropriate Page Object getter before writing the test.

### Rule 5 — `redirectionHelpers` is allowed for direct URL navigation

`redirectionHelpers.redirectTo(page, '/path')` is exported from `playwright/fixtures/fixtures.ts` and is the correct way to navigate directly to a URL. It calls `NavigationUtils.waitForDerivApiSettled` internally — do NOT call that again after it.

```typescript
import { test, expect, redirectionHelpers } from '../../fixtures/fixtures';

// ✅ Direct URL navigation (entry point or deep link)
await redirectionHelpers.redirectTo(page, '/reports/positions');

// ❌ Do NOT also call this after redirectionHelpers — already called internally
await NavigationUtils.waitForDerivApiSettled(page); // redundant
```

However: for **in-app navigation** (sidebar, tabs, bottom nav), always click the UI element — never use `redirectionHelpers` as a shortcut for navigating within the app.

### Rule 6 — API settlement after login and in-app navigation

Call `NavigationUtils.waitForDerivApiSettled(page)` after:

- `loginPage.login()` — the OAuth redirect triggers multiple API calls
- Any in-app navigation click (sidebar links, tabs, bottom nav items)

Do NOT call it after `redirectionHelpers.redirectTo()` — already handled internally.

```typescript
import { NavigationUtils } from '../../utils';

await loginPage.login();
await NavigationUtils.waitForDerivApiSettled(page);
```

### Rule 7 — Match the verification depth documented in `flow.md` for the target trade type

When implementing a new trade type (e.g. Higher/Lower, Touch/No Touch, In/Out), **read the target trade type's section in `flow.md` first** and implement exactly the steps shown there. Do not implement a shallow "buy-and-close" flow when `flow.md` specifies a full verification chain.

**Canonical verification chain (for manually-closeable contracts):**

1. Configure and buy → capture `balanceBefore`, `buyDate`, `payout`
2. Verify open positions card + balance deducted after purchase
3. Verify open position in Reports → extract `buyId`
4. Verify contract details page → close details → close contract via Positions
5. Verify closed contract in Closed tab → verify closed contract details → extract `sellId`
6. Verify final balance after close
7. Verify closed contract in Reports (trade table + statement)

**How to apply:**

- Before writing any `buy*AndVerify` method, read the target trade type's section in `flow.md` and implement exactly the steps shown there.
- Structural exceptions are documented with `> **Structural exception:**` callouts in `flow.md` — follow them exactly (e.g. tick-expiry contracts that expire automatically, Deal Cancellation contracts that use a cancel button instead of close).
- **Never rename `buy*AndVerify` to `buy*AndClose`** — "Close" signals a minimal flow; "Verify" signals the full chain.

> **Why this matters:** the Higher/Lower flow was initially generated as `buyHigherAndClose` with only 3 steps because an earlier version of `flow.md` described only those steps. `flow.md` now contains the authoritative step count and structural exception callouts for every trade type — it is the single source of truth.

---

## 📋 12-Step Protocol (Steps 0–11)

### Step 0 — Ask for the Module and Target (if not provided)

Before doing anything else, check whether the user's invocation includes a module name and target.

- If provided explicitly (e.g. "implement flows for trade"), extract it and proceed to Step 1.
- **If not provided**, ask:

    > **Which module would you like to implement tests for?**
    > (e.g. `auth`, `trade`, `positions`, `reports`, `notifications`)

    Then:

    > **What would you like to implement?**
    > Options: `all flows`, `all P0 gaps`, `all P1 gaps`, a specific gap ID (e.g. `G1`), or a specific flow number

    Wait for both answers before continuing.

---

### Step 0b — N/A Hard Stop

Before reading any flow docs or writing any code, check if the gap is marked `N/A` in `coverage.md`.

```bash
grep -i "<gap-or-flow-id>" "playwright/flows/<module>/coverage.md"
```

| Result                | Action                                                                                |
| --------------------- | ------------------------------------------------------------------------------------- |
| Priority is `N/A`     | **STOP.** Tell the user the gap is not automatable and the reason. No test generated. |
| Priority is `P0`–`P3` | Continue to Step 1                                                                    |
| Gap ID not found      | Warn the user and stop until clarified                                                |

---

### Step 1 — Duplicate Check

Run this before reading flow docs or writing any code.

#### 1a — Check for existing spec files

```bash
find "playwright/tests/<module>" -name "verify-*.spec.ts" 2>/dev/null | sort
grep -En "test\('VERIFY|test\(\"VERIFY" playwright/tests/<module>/<spec-file>.spec.ts
```

Build a per-flow status table:

```
Flow 1 — <name>   → ✅ already has test case (line 42) — skip
Flow 2 — <name>   → ❌ missing — will generate
```

Only generate test cases for flows marked `❌`.

#### 1b — Check for existing POM methods

```bash
cat "playwright/pages/<Module>Page.ts" 2>/dev/null || echo "No POM yet"
```

Record which methods already exist (reuse) and which are missing (add before writing the test).

#### 1c — Check for existing fixtures

```bash
grep -En '^export' playwright/fixtures/fixtures.ts
```

| Result             | Action                               |
| ------------------ | ------------------------------------ |
| Fixture registered | Use it directly                      |
| Fixture missing    | Create the POM and register it first |

#### 1d — Print readiness summary

```
Duplicate check complete for module: <module>, target: <flow/gap>

Spec file: <filename>
  Flow 1 — <name>   → ✅ already implemented (line 42) — skip
  Flow 2 — <name>   → ❌ missing — will generate

POM:     <N> methods needed, <M> already exist, <K> need to be added
Fixture: <fixture name> — [registered ✅ / missing — create first ⚠️]

Will generate: Flow 2 — appending to existing spec file
```

---

### Step 2 — Read documents in this exact order

1. `playwright/flows/_conventions/fixtures-reference.md` — available fixtures and login pattern
2. `playwright/flows/_conventions/utils-reference.md` — available utilities
3. `playwright/flows/<feature>/flow.md` — what to test (flows, assertions, tags)
4. `playwright/flows/<feature>/catalog.md` — method chains to copy

**If catalog.md has no method chains for the target flow, or new Page Object methods are needed:**

1. **Search the monorepo source first** (faster than MCP, works offline):
    - `packages/trader/src/` — DTrader trading terminal
    - `packages/core/src/` — app shell, routing, global components
    - `packages/reports/src/` — reports pages
    - `packages/shared/src/` — shared utilities
    - Look for `data-testid` attributes in JSX — these map directly to `getByTestId()` locators
    - Look for conditional rendering (feature flags, account state) to understand UI differences

2. **Only launch Playwright MCP if source is insufficient** — use when:
    - Test IDs are computed at runtime
    - You need to see actual rendered output for a specific account state
    - Source alone doesn't clarify what's visible

---

### Step 3 — Determine import path depth

Count folder levels from the spec file up to `playwright/`, then add `fixtures/fixtures`.

```
playwright/
  fixtures/
    fixtures.ts              ← target
  tests/
    auth/
      verify-login.spec.ts  → '../../fixtures/fixtures'   (2 levels up)
    trade/
      verify-trade.spec.ts  → '../../fixtures/fixtures'   (2 levels up)
```

```bash
find playwright -name "fixtures.ts" | head -3
```

---

### Step 4 — Copy catalog method chains — and sanitise inline locators

Copy TypeScript code blocks from `catalog.md` and:

1. Replace `'...'` in assertion messages with descriptive text
2. **Scan for inline locators** — any `page.getByTestId()`, `page.locator()`, `page.getByRole()` directly in the test body is a violation. Move them to the appropriate Page Object getter before writing the test.
3. **Cross-check catalog steps against `flow.md`** — the catalog is manually maintained and can omit steps that are listed in `flow.md`. For every flow step in `flow.md`, verify a corresponding POM call exists in the catalog snippet. Common omissions to check:
    - `flow.md` lists "Duration param visible" → catalog must call `selectDuration(unit, value)` (not just assert visibility)
    - `flow.md` lists "Set stake amount" → catalog must call `setStake(amount)`
    - `flow.md` lists "Select trade type" → catalog must call `selectTradeType(tradeType)` in `beforeEach`
      If a step is in `flow.md` but missing from the catalog, add the POM call — **do not omit it** on the grounds that the catalog didn't include it.

    > **Why this matters:** catalog snippets sometimes verify a param is visible without actually _configuring_ it. Skipping `selectDuration()` makes the test rely on whatever default is active, which is flaky when state bleeds between serial tests or the default duration is invalid for the symbol.

4. **POM action methods with 3+ parameters must use a destructured object, not positional args** — follow the `buyRiseAndVerify({ market, durationUnit, durationValue, stake, currency })` pattern. Positional args become unreadable at the call site and make argument order errors silent. Apply this to all `buy*` and `verify*` methods in trade page objects.

5. **Always call `selectMarket()` even when `flow.md` omits it** — every trade flow test must pin a known symbol. If the catalog snippet or `flow.md` does not include a market selection step, add `selectMarket('Volatility 75 Index')` (or whichever symbol the flow prerequisite specifies) as the first call in the POM action method. Relying on whatever symbol happens to be active is fragile — a prior test or account default can leave an incompatible symbol selected.

    > **Reference:** the Rise/Fall pattern (`buyRiseAndVerify`) always begins with `selectMarket(market)` before `selectTradeType()`. Apply the same pattern for all trade type flows.

6. **Match the exact step chain documented in `flow.md` for the trade type being implemented** — before writing any `buy*` method, read the target trade type's section in `flow.md` and implement exactly the steps shown. Name the method `buy*AndVerify`, not `buy*AndClose` — "Close" signals a minimal flow; "Verify" signals the full chain. Structural exceptions are documented with `> **Structural exception:**` callouts in `flow.md` — follow them exactly.

    > **Why this matters:** Higher/Lower was initially generated as `buyHigherAndClose` with 3 steps because an earlier version of `flow.md` described only those steps. `flow.md` now carries the authoritative step count for every trade type. See Rule 7.

```typescript
// Catalog shows (with inline locator — violation):
await expect(page.getByTestId('dt_acc_info'), '...').toBeVisible();

// Step 1: Add getter to TradePage.ts (or appropriate POM):
get accountInfo() { return this.page.getByTestId('dt_acc_info'); }

// Step 2: Reference via fixture in the test:
await expect(tradePage.accountInfo, 'Account info should be visible after login').toBeVisible();
```

---

### Step 5 — Choose the right account provisioning pattern

Read `fixtures-reference.md` and `utils-reference.md` first.

**Pattern A — Fresh account per run (staging only):**

```typescript
import { createAccountV1, createAccountV2 } from '../../utils';

let account: Awaited<ReturnType<typeof createAccountV2>>;
test.beforeAll(async ({ request }) => {
    account = await createAccountV2('real', 'al', { currency: 'USD' });
});
```

**Pattern B — Pre-existing account from env:**

```typescript
const email = process.env.SOME_EMAIL;
if (!email) throw new Error('SOME_EMAIL is not set in playwright/.env.staging');
```

**Pattern C — Standard shared test account (most common):**

```typescript
test.beforeEach(async ({ loginPage }) => {
    await loginPage.login(); // reads TEST_EMAIL + TEST_PASSWORD from env
});
```

---

### Step 6 — Name the spec file with `verify-` prefix

All spec files must start with `verify-`.

| ✅ Correct                            | ❌ Wrong                       |
| ------------------------------------- | ------------------------------ |
| `verify-email-password-login.spec.ts` | `email-password-login.spec.ts` |
| `verify-trade-form-loads.spec.ts`     | `trade-form-loads.spec.ts`     |

If `coverage.md`'s "Proposed spec file" column is missing the prefix, add it and update `coverage.md` and `flow.md` references too.

---

### Step 7 — Use this test file skeleton

```typescript
/**
 * @name     [Human-readable test name, e.g. "Email + Password Login"]
 * @id       [flow id from flow.md, e.g. "flow-1"]
 * @flow     playwright/flows/<feature>/flow.md#<flow-anchor>
 * @coverage playwright/flows/<feature>/coverage.md
 */
import { test, expect } from '../../fixtures/fixtures';
// Uncomment as needed:
// import { redirectionHelpers } from '../../fixtures/fixtures';   // for direct URL navigation
// import { NavigationUtils } from '../../utils';                  // for API settlement
// import { createAccountV2, DataFactory } from '../../utils';     // if fresh account needed

/**
 * [Flow ID] — [Flow name from flow.md]
 */
test.describe('[Feature Name]', { tag: ['@desktop', '@<feature-tag>'] }, () => {
    test.beforeAll(() => {
        // Validate required env vars here — NEVER at module top level
        if (!process.env.TEST_EMAIL) throw new Error('TEST_EMAIL not set in playwright/.env.staging');
        if (!process.env.TEST_PASSWORD) throw new Error('TEST_PASSWORD not set in playwright/.env.staging');
    });

    test.beforeEach(async ({ loginPage }) => {
        await loginPage.login();
    });

    test('VERIFY [specific expected behaviour from flow.md]', async ({
        page,
        tradePage, // destructure fixtures — never instantiate manually
    }) => {
        await NavigationUtils.waitForDerivApiSettled(page);

        // Steps from catalog.md — using POM getters (no inline locators)
        await expect(tradePage.someElement, 'Descriptive assertion message').toBeVisible();
    });
});
```

---

### Step 8 — Required assertion format

Every `expect()` must include a descriptive message:

```typescript
// ❌ FORBIDDEN
await expect(element).toBeVisible();

// ✅ REQUIRED
await expect(element, 'Trade container should be visible after login').toBeVisible();
```

---

### Step 9 — Tag requirements

Every `test.describe()` must have:

1. At least one **feature tag**: `@auth`, `@trade`, `@positions`, `@reports`, `@notifications`
2. At least one **screen-size tag**: `@desktop` and/or `@mobile`
3. **Execution tag** where applicable: `@smoke` (critical path), `@staging` (requires credentials/Mailisk — not safe on prod), `@production` (read-only, safe on prod)

Tags go on `test.describe()` **only** — never on individual `test()` calls.

---

### Step 10 — Desktop AND Mobile coverage

Every test runs under both `chromium` (desktop) and `chromium-mobile` (mobile) projects automatically via a single `test.describe()` block — no duplication needed.

When a UI element differs between viewports, the Page Object getter must be viewport-aware:

```typescript
// In the Page Object:
private get isMobile(): boolean {
    return (this.page.viewportSize()?.width ?? 1024) < 1024;
}

get logoutButton() {
    return this.isMobile
        ? this.page.getByRole('button', { name: 'Menu' })   // bottom nav
        : this.page.getByTestId('dt_sidebar_account');       // sidebar
}
```

In tests, use `testInfo.project.name.includes('mobile')` to branch when the assertion itself differs.

Never add `(Desktop)` / `(Mobile)` suffixes to test names — the project prefix handles labelling.

---

### Step 11 — Post-generation checklist

Before presenting the generated test:

- [ ] Step 1 duplicate check was run — spec, POM methods, and fixture all verified
- [ ] Readiness summary (Step 1d) printed before any file was written
- [ ] Spec file name starts with `verify-`
- [ ] File starts with JSDoc `@name` / `@id` / `@flow` / `@coverage` header
- [ ] Imports `test` from `playwright/fixtures/fixtures` — **NOT** from `@playwright/test`
- [ ] Import path depth is correct (Step 3)
- [ ] Login uses `loginPage.login()` — no `loginHelpers` reference
- [ ] No inline `page.getByTestId()` / `page.locator()` / `page.getByRole()` in test body — all in POM
- [ ] `NavigationUtils.waitForDerivApiSettled(page)` called after `loginPage.login()` and in-app nav clicks
- [ ] `redirectionHelpers.redirectTo()` NOT followed by a redundant `waitForDerivApiSettled` call
- [ ] All fixtures destructured from test function parameters (never manually instantiated)
- [ ] Every `expect()` has a descriptive message as the second argument
- [ ] No `page.waitForTimeout()` without explicit justification
- [ ] No `locator.waitFor({ state: 'visible' })` — use `expect(...).toBeVisible()` instead
- [ ] Env var validation is in `test.beforeAll()`, not at module top level
- [ ] Tags include at least one feature tag AND one screen-size tag, on `test.describe()` only
- [ ] No `test.only()` or `describe.only()` left in the file
- [ ] No `timeout` in `test.describe.configure()` — only `mode` is allowed
- [ ] **Both `flow.md` AND `coverage.md` are updated** when a new flow or sub-flow is added
- [ ] **No duplication between flow docs** — each piece of info lives in exactly one file
- [ ] **`coverage.md` analysis date updated to today** (`YYYY-MM-DD`)
- [ ] **Gap rows promoted to proper flows** after implementation — no `G-*` identifiers remain in any doc file

---

## ✅ Readiness Assessment

Before generating, check:

````bash
# 1. Does catalog.md have TypeScript code blocks for the target flow?
grep -n '```typescript' "playwright/flows/<feature>/catalog.md" | head -10

# 2. Are the required fixtures registered?
grep -En '^export' playwright/fixtures/fixtures.ts
````

| Condition                                                       | Status                                             |
| --------------------------------------------------------------- | -------------------------------------------------- |
| `catalog.md` has method chains AND fixtures registered          | ✅ Generate autonomously                           |
| `catalog.md` has method chains BUT fixture not in `fixtures.ts` | 🟡 Create POM + register fixture first             |
| `catalog.md` has no method chains                               | 🟡 Search monorepo source, then use Playwright MCP |
| No `catalog.md` or `flow.md` exists                             | ❌ Run `src-to-flow-dtrader` skill first           |

---

## ⚠️ Common Mistakes — DTrader Edition

| Mistake                                                                                               | Fix                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Using `loginHelpers.login(page)`                                                                      | This export does not exist — use `loginPage.login()` via the fixture                                                                                                                      |
| Assuming Ory Kratos login (home-app pattern)                                                          | This project uses two-step Deriv OAuth — email page → enter-password page → redirect back to dtrader                                                                                      |
| Writing a locator without verifying both viewports                                                    | AppV2 renders different DOM elements at desktop (≥ 1024px) vs mobile (< 1024px) — search source for both render paths first, use `isMobile` to branch when selectors differ (see Rule 2a) |
| Using Playwright MCP before searching source                                                          | Most locators (`data-testid`, `id`, stable classes) are findable in `packages/trader/src/` without a browser — MCP is last resort only                                                    |
| Asserting `loginPage.emailInput` / `loginPage.passwordInput` visibility before clicking the container | These are lazy-rendered Quill inputs — assert `emailTextbox` / `passwordTextbox` (the containers) instead                                                                                 |
| Filling email/password without clicking the container first                                           | Quill inputs are not in the DOM until the container `<div>` is clicked — always click `emailTextbox` / `passwordTextbox` first                                                            |
| Using `getByLabel('Password')` for the password input                                                 | Ambiguous — matches both the input and the "Show password" toggle; use `passwordTextbox.locator("input[type='password']")` instead                                                        |
| Using a single locator for the trade type selector on both viewports                                  | On mobile the icon button is hidden and replaced by a `"View all"` text button — branch with `isMobile` (see Rule 2c)                                                                     |
| Using `getByRole('paragraph', { name: 'X' })` to match Quill nav labels                               | The `name` filter matches `aria-label`, not text content — use `getByText('X')` scoped to the container instead (see Rule 2d)                                                             |
| Searching `src/app/` for locators                                                                     | This is a monorepo — search `packages/trader/src/`, `packages/core/src/`, `packages/reports/src/`                                                                                         |
| Inline locators in test body                                                                          | All `page.getBy*()` / `page.locator()` calls must live in Page Object getters                                                                                                             |
| Calling `waitForDerivApiSettled` after `redirectionHelpers.redirectTo()`                              | Already called internally — redundant, do not add                                                                                                                                         |
| Not calling `waitForDerivApiSettled` after `loginPage.login()`                                        | Always call it — OAuth redirect triggers multiple API calls                                                                                                                               |
| Generating a test for an N/A gap                                                                      | Run Step 0b — if `coverage.md` marks the gap `N/A`, stop immediately                                                                                                                      |
| Rewriting POM methods that already exist                                                              | Run Step 1b first — read the existing POM                                                                                                                                                 |
| Wrong import path depth                                                                               | Count folder levels from spec file to `playwright/fixtures/fixtures.ts`                                                                                                                   |
| Missing assertion message                                                                             | Every `expect()` requires a descriptive string as second argument                                                                                                                         |
| Env var at module top level                                                                           | Move to `test.beforeAll()` inside `test.describe()`                                                                                                                                       |
| Tags on `test()` instead of `test.describe()`                                                         | Tags always on `test.describe({ tag: [...] })` only                                                                                                                                       |
| `timeout` in `test.describe.configure()`                                                              | Only `mode` is allowed — never set `timeout` there                                                                                                                                        |
| Leaving `G-*` rows after implementation                                                               | Promote to numbered flow in Section 1 and remove from Sections 2 and 3 of `coverage.md`                                                                                                   |

---

## 🗂️ Invocation Examples

```
/flow-to-playwright-dtrader
Follow flow-to-playwright-dtrader skill and implement flows for module: auth
Follow flow-to-playwright-dtrader skill and implement flows for module: trade
Follow flow-to-playwright-dtrader skill and implement gap G1 for module: positions
Follow flow-to-playwright-dtrader skill and implement all P0 gaps for module: trade
```

Before this skill runs, make sure `src-to-flow-dtrader` has already been run for the module:

```
Follow src-to-flow-dtrader skill and generate flow docs for module: <module_name>
```
