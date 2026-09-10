---
title: Test Writing - Assertions, Organization & Debugging
description: Failure resolution, auto-waiting, assertion patterns, test naming, tagging, error handling, and debugging utilities
parent_skill: playwright
---

## ⚖️ Autonomous Failure Resolution & Justification

When a test fails, you must act as a **Quality Engineer**, not just a script runner. You are responsible for deciding—and justifying—whether the fix belongs in the **Application Code** or the **Test Code**. You must prioritize the integrity of the test suite over simply achieving a "green" status.

### 1. The Decision Logic Gate

Before applying any fix, evaluate the failure against this matrix:

| Failure Category         | Investigation Finding                                                                                 | Corrective Action                                                                    |
| :----------------------- | :---------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| **Application Bug**      | UI state contradicts business logic or requirements (e.g., a required validation message is missing). | **DO NOT modify the test.** Propose or apply a fix for the application source code.  |
| **Test Maintenance**     | UI changed intentionally (e.g., design update) or a locator is no longer unique/stable.               | **Modify the test.** Update locators or logic to match the new intended UI state.    |
| **Infrastructure/Flake** | Failure is due to timeouts, network instability, or race conditions.                                  | **Stabilize the test.** Improve waiting strategies (e.g., `waitForDerivApiSettled`). |

### 2. Mandatory Investigation Protocol

You must perform these steps before making a decision to modify any code:

1.  **Inspect the DOM State**: Use Playwright MCP snapshots to see what is actually rendered vs. what the test expects.
2.  **Verify Business Intent**: Read the JSDoc and the assertion's description message. The test script is the "Source of Truth" for requirements.
3.  **Check the Network/Logs**: If a UI element is missing, check if the underlying API failed or returned unexpected data via application logs.

### 3. Required Justification Block

Before applying any change to the codebase, you must document your reasoning in your output using this format:

> **🔍 FAILURE ANALYSIS**:
>
> - **Expected Behavior**: [e.g., Error message 'Invalid Email' should appear]
> - **Actual Behavior**: [e.g., No error message appears; form allows submission]
> - **Root Cause**: [e.g., App Bug - validation logic missing in the new form component]
> - **Resolution**: [e.g., Fixing `src/components/FormValidator.ts`]
> - **Justification**: [Explain why changing the code—or the test—is the correct quality-first path.]

### 4. Forbidden "Shortcuts" & Safety Valve

- ❌ **No Deletion**: Never remove an assertion or a validation step simply to make a test pass.
- ❌ **No Commenting Out**: Never "skip" or comment out a failing step to bypass a failure.
- ❌ **No Assertion Weakening**: Do not change a specific assertion (e.g., `toHaveText`) to a generic one (e.g., `toBeVisible`) just to bypass a content mismatch.
- 🔓 **Safety Valve**: You may only remove/weaken assertions if the user explicitly confirms a **Requirement Change** or **Feature Deprecation**. In this case, still provide the Justification Block noting the user's instruction.

---

---

### 1. Auto-Waiting & Timing

#### ✅ Leverage Playwright's Built-in Waiting

```typescript
// ✅ EXCELLENT - Playwright handles timing automatically
await expect(this.emailInput).toBeVisible();
await this.emailInput.fill(email);
await this.submitButton.click();
await expect(this.successMessage).toBeVisible();

// ✅ GOOD - Explicit waiting for specific conditions
await this.page.waitForLoadState('networkidle');
await this.page.waitForFunction(() => window.myApp.isReady);

// ❌ AVOID - Manual timing (creates flaky tests)
await this.page.waitForTimeout(5000);
```

#### ✅ Smart Waiting Patterns

```typescript
// Wait for element to be actionable before interaction
async clickWhenReady(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
    await expect(locator).toBeEnabled();
    await locator.click();
}

// Wait for loading to complete
async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.page.locator('.loading-spinner')).not.toBeVisible();
}
```

### 2. Assertion Strategies

#### 🎯 **CRITICAL RULE**: Always Use Descriptive Assertion Messages

**Every assertion MUST include a clear description** explaining what is being tested. This is **mandatory** for better report analysis and debugging.

#### ✅ **CORRECT - Descriptive Assertions (REQUIRED)**

```typescript
// ✅ EXCELLENT - Clear description of what's being tested
await expect(element, 'Login button should be visible on page load').toBeVisible();
await expect(element, 'Submit button should be disabled until form is valid').toBeDisabled();
await expect(otpCode, 'OTP code should be extracted from email').toBeTruthy();
await expect(otpCode.length, 'OTP code should be 6 digits').toBe(6);

// ✅ GOOD - Describes expected behavior
await expect(errorMessage, 'Error message should display for invalid email').toContainText('Invalid email format');
await expect(page, 'User should be redirected to dashboard after login').toHaveURL(/.*dashboard.*/);
await expect(items, 'Shopping cart should contain 3 items').toHaveCount(3);

// ✅ EXCELLENT - Describes business logic
await expect(balance, 'Account balance should be updated after deposit').toBeGreaterThan(previousBalance);
await expect(notification, 'Success notification should appear after form submission').toBeVisible();
await expect(username, 'Username should match the logged-in user').toBe(expectedUsername);
```

#### ❌ **INCORRECT - Missing Descriptions (FORBIDDEN)**

```typescript
// ❌ BAD - No description, hard to debug failures
await expect(element).toBeVisible();
await expect(element).toBeDisabled();
await expect(otpCode).toBeTruthy();
await expect(otpCode.length).toBe(6);

// ❌ BAD - Unclear what failed when test breaks
await expect(errorMessage).toContainText('Invalid email format');
await expect(page).toHaveURL(/.*dashboard.*/);
await expect(items).toHaveCount(3);
```

#### 📊 **Benefits of Descriptive Assertions**

1. **Better Test Reports**: Immediately understand what failed without reading code
2. **Faster Debugging**: Clear failure messages pinpoint exact issue
3. **Documentation**: Assertions serve as living documentation of expected behavior
4. **Team Communication**: Non-technical stakeholders can understand test failures
5. **Maintenance**: Future developers understand test intent quickly

#### ✅ Comprehensive Assertion Patterns with Descriptions

```typescript
// ✅ Visibility assertions
await expect(element, 'Element should be visible after page load').toBeVisible();
await expect(element, 'Loading spinner should disappear after data loads').not.toBeVisible();

// ✅ State assertions
await expect(element, 'Button should be enabled when form is valid').toBeEnabled();
await expect(element, 'Submit button should be disabled during API call').toBeDisabled();
await expect(element, 'Terms checkbox should be checked by default').toBeChecked();

// ✅ Content assertions
await expect(element, 'Welcome message should display user name').toHaveText('Expected text');
await expect(element, 'Error message should contain validation hint').toContainText('Partial text');
await expect(element, 'Input field should retain entered value').toHaveValue('input value');

// ✅ Count assertions
await expect(this.page.locator('.item'), 'Product list should show 5 items').toHaveCount(5);

// ✅ URL assertions
await expect(this.page, 'User should be on dashboard page').toHaveURL(/.*dashboard.*/);

// ✅ Numeric assertions
await expect(price, 'Total price should match sum of items').toBe(expectedTotal);
await expect(balance, 'Balance should be positive after deposit').toBeGreaterThan(0);
await expect(discount, 'Discount should not exceed 50%').toBeLessThanOrEqual(50);

// ✅ String assertions
await expect(email, 'Email should be in valid format').toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
await expect(response, 'API response should contain success status').toContain('success');

// ✅ Boolean assertions
await expect(isLoggedIn, 'User should be logged in after authentication').toBeTruthy();
await expect(hasErrors, 'Form should have no validation errors').toBeFalsy();
```

#### ✅ Custom Assertion Helpers

```typescript
// Reusable assertion patterns
async expectSuccessState(): Promise<void> {
    await expect(this.successMessage).toBeVisible();
    await expect(this.errorMessage).not.toBeVisible();
    await expect(this.page).toHaveURL(/.*success.*/);
}

async expectErrorState(expectedMessage?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (expectedMessage) {
        await expect(this.errorMessage).toContainText(expectedMessage);
    }
}
```

### 3. Test Organization & Structure

#### ✅ Spec File Header — Link Every Test File to Its Flow

**Every spec file MUST begin with a JSDoc block comment** that links it back to its flow spec and coverage document. This allows both humans and AI to instantly understand what business flow the file covers and where to find the spec and gap analysis.

```typescript
/**
 * @name     <Flow Name>
 * @id       flow-<N>
 * @flow     playwright/flows/<domain>/flow.md#flow-<N>
 * @coverage playwright/flows/<domain>/coverage.md
 */
```

**Rules:**

- `@name` must match the exact flow name used in `flow.md` and `coverage.md`
- `@id` must be `flow-<N>` where `N` is the flow number (e.g., `flow-1`, `flow-2`)
- `@flow` must be the path to `flow.md` with a `#flow-<N>` anchor so an AI can navigate directly to the right section
- `@coverage` must point to the `coverage.md` in the same flow folder
- Place this block **before** any `import` statements

**Example — `tests/auth/login-using-email-and-password.spec.ts`:**

```typescript
/**
 * @name     Email + Password Login
 * @id       flow-1
 * @flow     playwright/flows/auth/flow.md#flow-1
 * @coverage playwright/flows/auth/coverage.md
 */
import { test } from '../../fixtures/fixtures';
```

**Why this matters for AI:**

1. An AI reading any spec file immediately knows which business flow it covers
2. The `@flow` path is directly `read_file`-able — no repo search required
3. The `#flow-<N>` anchor identifies the exact section to jump to in `flow.md`
4. The `@coverage` path leads directly to the gap analysis for that flow
5. JSDoc tags are structured and parseable — tools and scripts can extract metadata programmatically

> **When generating a new spec file**, always derive the header from `flow.md` before writing any test code. If the flow has no spec yet, create one first.

---

#### ✅ Test Naming Convention — `VERIFY ...`

All `test()` titles **must** start with `VERIFY` (uppercase) followed by a plain-English description of the observable outcome being asserted.

```typescript
// ✅ CORRECT — starts with VERIFY, describes the observable outcome
test('VERIFY user is redirected to login page after clicking logout', ...
test('VERIFY validation error appears when email field is empty', ...
test('VERIFY user can create MT5 Standard real and demo accounts', ...
test('VERIFY sidebar links navigate to the correct pages', ...

// ❌ WRONG — must not start with 'should', 'check', or a vague noun
test('should display validation error when submitting empty email field', ...
test('login test', ...
test('check form', ...
```

**Rules:**

- Always uppercase `VERIFY` — never `verify`, `Verify`
- Follow with `user ...` / `<subject> ...` in plain English
- Be specific about the observable outcome, not the implementation steps

#### ✅ Test Structure Patterns

```typescript
test.describe('Login Functionality', () => {
    let loginPage: LoginPage;

    test.beforeEach(async ({ page }) => {
        loginPage = new LoginPage(page);
        await loginPage.goto();
    });

    test.describe('Email Validation', () => {
        test('should accept valid email format', async () => {
            // Test implementation
        });

        test('should reject invalid email format', async () => {
            // Test implementation
        });
    });

    test.describe('Password Security', () => {
        test('should mask password input', async () => {
            // Test implementation
        });
    });
});
```

#### ✅ Test Tags & Filtering — Official `{ tag: [...] }` API

Use Playwright's **official tag API** — never put `@tag` strings in test or describe titles.

```typescript
// ✅ CORRECT — Tags as second argument to test.describe()
test.describe('Login flow', { tag: ['@smoke', '@critical', '@login', '@desktop', '@mobile'] }, () => {
    test('should login with valid credentials', async ({ page }) => {
        // ...
    });

    test('should display error for invalid password', async ({ page }) => {
        // ...
    });
});

// ✅ CORRECT — All tags on test.describe(), never on individual test()
test.describe('Password validation', { tag: ['@security', '@profile', '@desktop', '@mobile'] }, () => {
    test('should enforce minimum length', async ({ page }) => {
        // ...
    });

    // ❌ BAD — tags on individual test() are forbidden; all tags must go on test.describe()
    // test(
    //   "should block common passwords",
    //   { tag: ["@smoke"] },
    //   async ({ page }) => { ... },
    // );

    // ✅ CORRECT — just a regular test inside the tagged describe block
    test('should block common passwords', async ({ page }) => {
        // ...
    });
});

// ❌ WRONG — Never put tags in test titles (old grep approach)
// test('critical login flow @smoke @critical', async ({ page }) => {

// Run specific test categories (tag API is compatible with --grep)
// npx playwright test --grep "@smoke"
// npx playwright test --grep "@critical"
// npx playwright test --grep "@cfd"
```

**Available tags:**

| Category            | Tags                                                                                                                                                                                                                                                                | Usage                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Feature area**    | `@cfd`, `@mt5`, `@ctrader`, `@login`, `@signup`, `@p2p`, `@profile`, `@home`, `@redirections`, `@portfolio`, `@cashier`, `@kyc`, `@dtrader`, `@dbot`, `@smarttrader`, `@options`, `@transfer`, `@partners`                                                          | Always required — every test must have at least one feature tag                                                                   |
| **Execution level** | `@smoke`, `@production`                                                                                                                                                                                                                                             | Optional — only add when explicitly decided by the team. `@production` marks tests safe to run against the production environment |
| **Special**         | `@example`, `@authentication`, `@i18n`, `@validation`, `@security`, `@address`, `@account-creation`, `@regulatory`, `@wallet`, `@bot-builder`, `@poa`, `@gps`, `@financial`, `@quick-strategy`, `@popup`, `@martingale`, `@dalembert`, `@oscars-grind`, `@standard` | Contextual — add when the test covers a specific cross-cutting concern                                                            |

> **Extending the registry:** This list is not exhaustive. When a new feature area, execution level, or cross-cutting concern emerges that is not covered by an existing tag, create a new tag following the `@kebab-case` convention. Add the new tag to the registry tables in `playwright/AGENTS.md`, `SKILL.md`, and `README.md` before using it in tests.

### 4. Error Handling & Debugging

#### ✅ Comprehensive Error Strategies

```typescript
// Graceful error handling with detailed information
async login(email: string, password: string): Promise<LoginResult> {
    try {
        await this.enterEmail(email);
        await this.enterPassword(password);

        const isSuccess = await this.isLoginSuccessful();
        if (isSuccess) {
            return { success: true, url: this.getCurrentUrl() };
        }

        const errorMessage = await this.getErrorMessage();
        return {
            success: false,
            error: errorMessage || 'Unknown login error',
            screenshot: await this.takeScreenshot('login-failed')
        };
    } catch (error) {
        return {
            success: false,
            error: `Login failed: ${error.message}`,
            screenshot: await this.takeScreenshot('login-exception')
        };
    }
}
```

#### ✅ Debugging Utilities

##### **1. Screenshots**

```typescript
// Screenshot capture for debugging
async takeScreenshot(name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `debug-${name}-${timestamp}.png`;
    await this.page.screenshot({ path: `test-results/${filename}` });
    return filename;
}

// Full page screenshot
async takeFullPageScreenshot(name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `fullpage-${name}-${timestamp}.png`;
    await this.page.screenshot({
        path: `test-results/${filename}`,
        fullPage: true
    });
    return filename;
}

// Element-specific screenshot
async takeElementScreenshot(locator: Locator, name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `element-${name}-${timestamp}.png`;
    await locator.screenshot({ path: `test-results/${filename}` });
    return filename;
}
```

##### **2. Trace Logs (Recommended for Debugging)**

Playwright's trace viewer is the **most powerful debugging tool** - it records everything that happens during test execution.

**Enable Traces in playwright.config.ts:**

```typescript
export default defineConfig({
    use: {
        // Capture trace on first retry of a failed test
        trace: 'on-first-retry',

        // OR: Always capture traces (useful during development)
        // trace: 'on',

        // OR: Capture traces only on failure
        // trace: 'retain-on-failure',

        // OR: Never capture traces (production)
        // trace: 'off',
    },
});
```

**Trace Options Explained:**

- `'on'` - Record trace for every test (large files, use during development)
- `'off'` - No traces (fastest, use in CI when not debugging)
- `'retain-on-failure'` - Keep traces only for failed tests (recommended for CI)
- `'on-first-retry'` - Record trace when retrying failed tests (balanced approach)

**Programmatic Trace Control:**

```typescript
test('debug specific test with trace', async ({ page, context }) => {
    // Start tracing before test actions
    await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true, // Include source code in trace
    });

    try {
        // Your test actions
        await page.goto('https://example.com');
        await page.click('button');
    } finally {
        // Stop tracing and save
        await context.tracing.stop({
            path: 'test-results/trace.zip',
        });
    }
});
```

**View Traces:**

```bash
# View trace file in Playwright Trace Viewer
npx playwright show-trace test-results/trace.zip

# Or view from test results directory
npx playwright show-trace test-results/login-test-chromium/trace.zip
```

**What Traces Include:**

- ✅ **Screenshots** at every action
- ✅ **DOM snapshots** before/after each action
- ✅ **Network activity** (requests/responses)
- ✅ **Console logs** from the browser
- ✅ **Action timeline** with timing information
- ✅ **Source code** that triggered each action
- ✅ **Test steps** with pass/fail status

**Trace Viewer Features:**

- 🎬 **Timeline view** - See exactly when each action occurred
- 📸 **Before/After snapshots** - Compare DOM state
- 🌐 **Network tab** - Inspect API calls and responses
- 📝 **Console tab** - View browser console output
- 🔍 **Source tab** - See test code that executed
- ⏱️ **Performance metrics** - Identify slow operations

**Best Practices for Traces:**

```typescript
// ✅ RECOMMENDED: Use trace on first retry (balanced)
// playwright.config.ts
use: {
    trace: 'on-first-retry',
}

// ✅ DEVELOPMENT: Enable traces for specific tests
test.describe('Debug Login Flow', () => {
    test.use({ trace: 'on' });  // Override for this suite

    test('login with trace', async ({ page }) => {
        // Full trace will be captured
    });
});

// ✅ CI/CD: Retain traces only on failure
// playwright.config.ts (CI environment)
use: {
    trace: 'retain-on-failure',
}

// ✅ CUSTOM: Conditional tracing based on environment
use: {
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
}
```

**Trace in Test Hooks:**

```typescript
test.describe('Feature Tests', () => {
    test.beforeEach(async ({ context }) => {
        // Start trace before each test
        await context.tracing.start({
            screenshots: true,
            snapshots: true,
        });
    });

    test.afterEach(async ({ context }, testInfo) => {
        // Save trace only if test failed
        if (testInfo.status !== testInfo.expectedStatus) {
            await context.tracing.stop({
                path: `test-results/trace-${testInfo.title}-${Date.now()}.zip`,
            });
        } else {
            await context.tracing.stop();
        }
    });

    test('my test', async ({ page }) => {
        // Test actions - trace is automatically captured
    });
});
```

##### **3. Page State Inspection**

```typescript
// Comprehensive page state capture
async capturePageState(testName: string): Promise<PageState> {
    return {
        url: this.page.url(),
        title: await this.page.title(),
        screenshot: await this.takeScreenshot(testName),
        htmlContent: await this.page.content(),
        console: this.getConsoleErrors(),
        timestamp: new Date().toISOString()
    };
}

// Console log capture
getConsoleErrors(): string[] {
    const errors: string[] = [];
    this.page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });
    return errors;
}

// Network request logging
async captureNetworkActivity(): Promise<NetworkLog[]> {
    const requests: NetworkLog[] = [];

    this.page.on('request', request => {
        requests.push({
            url: request.url(),
            method: request.method(),
            timestamp: new Date().toISOString()
        });
    });

    return requests;
}
```

##### **4. Video Recording**

```typescript
// Enable video recording in playwright.config.ts
export default defineConfig({
    use: {
        video: 'retain-on-failure', // or 'on', 'off', 'on-first-retry'
        videoSize: { width: 1280, height: 720 },
    },
});

// Access video path in test
test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        const videoPath = await testInfo.attachments.find(a => a.name === 'video')?.path;
        console.log(`Video saved: ${videoPath}`);
    }
});
```

##### **5. Debug Mode**

```typescript
// Run tests in debug mode with Playwright Inspector
// npx playwright test --debug

// Pause execution at specific point
test('debug at specific point', async ({ page }) => {
    await page.goto('https://example.com');

    // Pause here - opens Playwright Inspector
    await page.pause();

    await page.click('button');
});

// Step-by-step debugging
test('step through test', async ({ page }) => {
    await page.goto('https://example.com');

    // Set breakpoint in code
    debugger; // Will pause if running with --debug

    await page.click('button');
});
```

##### **6. Debugging Utilities Summary**

| Tool             | Use Case                 | Command                               | Best For                    |
| ---------------- | ------------------------ | ------------------------------------- | --------------------------- |
| **Trace Viewer** | Complete test replay     | `npx playwright show-trace trace.zip` | Understanding test failures |
| **Screenshots**  | Visual debugging         | `await page.screenshot()`             | UI issues                   |
| **Video**        | Test execution recording | `video: 'on'` in config               | Flaky test analysis         |
| **Debug Mode**   | Interactive debugging    | `npx playwright test --debug`         | Development                 |
| **Console Logs** | Browser errors           | `page.on('console')`                  | JavaScript errors           |
| **Network Logs** | API debugging            | `page.on('request')`                  | Network issues              |

**Recommended Debugging Workflow:**

1. **First**: Check trace viewer (most comprehensive)
2. **Second**: Review screenshots and videos
3. **Third**: Inspect console and network logs
4. **Fourth**: Use debug mode for interactive investigation
