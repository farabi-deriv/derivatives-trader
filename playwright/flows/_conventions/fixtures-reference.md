# 🔩 Fixtures Reference

> **Purpose:** This document describes every fixture available in `fixtures/fixtures.ts`. An AI writing tests must use fixtures instead of manually instantiating page objects — fixtures are the source of truth for all page object instances.
>
> **Import from the fixtures barrel:**
>
> ```typescript
> import { test, expect, redirectionHelpers } from '../fixtures/fixtures';
> ```

---

## What Are Fixtures?

Fixtures are Playwright's dependency injection system. Instead of creating page objects manually in every test, you declare them as function parameters and Playwright provides them automatically:

```typescript
// ❌ Wrong — manual instantiation
test('my test', async ({ page }) => {
    const tradePage = new TradePage(page); // don't do this
});

// ✅ Correct — fixture injection
test('my test', async ({ tradePage }) => {
    await tradePage.gotoTradePage(); // tradePage provided automatically
});
```

---

## Available Page Object Fixtures

| Fixture | Page Object | Used for |
| --- | --- | --- |
| `loginPage` | `LoginPage` | Deriv OAuth login flow |
| `tradePage` | `TradePage` | Desktop trade form (DTrader) |
| `tradeVanillasPage` | `TradeVanillasPage` | Vanillas Call/Put purchase + open/closed position verification |
| `isMobileViewport` | `boolean` | `true` when running under `chromium-mobile` project (viewport width < 1024px) |

> **Note:** As more page objects are added to `playwright/pages/`, register them in `playwright/fixtures/fixtures.ts` and add a row here.

---

## Helper Exports

### `redirectionHelpers`

Navigate to app pages by URL. Calls `NavigationUtils.waitForDerivApiSettled` internally.

```typescript
import { redirectionHelpers } from '../fixtures/fixtures';

// Navigate to any path (waitForDerivApiSettled is called internally)
await redirectionHelpers.redirectTo(page, '/');
await redirectionHelpers.redirectTo(page, '/reports/positions');
```

**Do NOT call `NavigationUtils.waitForDerivApiSettled` after this** — it is already called internally.

---

## Login Pattern

derivatives-trader uses **Deriv OAuth** — login redirects to an external Deriv login page and back to the app. Use `loginPage.login()` which reads credentials from env:

```typescript
test.describe('Trade', { tag: ['@trade', '@smoke', '@desktop'] }, () => {
    test.beforeEach(async ({ loginPage }) => {
        await loginPage.login();
    });

    test('VERIFY trade form loads', async ({ tradePage }) => {
        await expect(tradePage.tradeContainer, 'Trade container should be visible').toBeVisible();
    });
});
```

**Credentials** — set in `playwright/.env.staging`:

- `TEST_EMAIL` — the account email
- `TEST_PASSWORD` — the account password
- `LOGIN_URL` — the Deriv login page URL

---

## Common Usage Patterns

### Basic test with login

```typescript
import { test, expect } from '../../fixtures/fixtures';

test.describe('Trade Form', { tag: ['@trade', '@smoke', '@desktop'] }, () => {
    test.beforeEach(async ({ loginPage }) => {
        await loginPage.login();
    });

    test('VERIFY trade container is visible', async ({ tradePage }) => {
        await expect(tradePage.tradeContainer, 'Trade container should be visible').toBeVisible();
    });
});
```

### Mobile viewport detection

```typescript
test('VERIFY mobile layout renders', async ({ tradePage, isMobileViewport }) => {
    if (isMobileViewport) {
        // assert mobile-specific elements
    } else {
        // assert desktop-specific elements
    }
});
```

### Navigate to a specific page

```typescript
test('VERIFY reports page loads', async ({ page, loginPage }) => {
    await loginPage.login();
    await redirectionHelpers.redirectTo(page, '/reports/positions');
    // assert page content
});
```

---

## Adding a New Page Object as a Fixture

**1. Create the page object file** (`pages/MyNewPage.ts`)

**2. Add to `fixtures/fixtures.ts`:**

```typescript
import { MyNewPage } from '../pages/MyNewPage';

export const test = base.extend<{
    // ... existing fixtures
    myNewPage: MyNewPage;
}>({
    // ... existing fixture implementations
    myNewPage: async ({ page }, use) => {
        const myNewPage = new MyNewPage(page);
        await use(myNewPage);
    },
});
```

**3. Add a row to the Available Page Object Fixtures table above.**

**4. Use in tests:**

```typescript
test('VERIFY something', async ({ myNewPage }) => {
    await myNewPage.doSomething();
});
```

---

## What NOT to Do

```typescript
// ❌ Never manually instantiate page objects in tests
const tradePage = new TradePage(page);

// ❌ Never import page object classes in test files
import { TradePage } from '../../pages/TradePage';

// ✅ Always destructure from test function parameters
test('VERIFY trade', async ({ tradePage }) => {
    // tradePage is ready to use
});
```
