# 🔧 Utilities Reference

> **Purpose:** This document describes every utility available in `playwright/utils/`. An AI writing or maintaining tests must read this before using any utility — never guess at signatures or behaviours.
>
> **Import from the barrel:**
>
> ```typescript
> import { NavigationUtils, MailiskUtils, DataFactory, TestData } from '../utils';
> ```

---

## Available Utilities

| Utility | Source | Used for |
| --- | --- | --- |
| `NavigationUtils` | `e2e-tests-core/utils/navigationUtils.ts` | Wait for Deriv API to settle, browser back navigation |
| `MailiskUtils` | `e2e-tests-core/utils/mailisk.ts` | Retrieve OTP emails from Mailisk inboxes |
| `DataFactory` | `e2e-tests-core/utils/dataFactory.ts` | Generate test data (emails, names, addresses) |
| `createAccountV1` / `createAccountV2` | `e2e-tests-core/utils/accountCreationRunner.ts` | Provision staging test accounts |
| `topupAccount` / `changePoiPoaStatus` | `e2e-tests-core/utils/accountCreationRunner.ts` | Top up / KYC staging accounts |
| `enableFeatureFlags` / `disableFeatureFlags` / `getFeatureFlags` | `e2e-tests-core/utils/featureFlags.ts` | Toggle feature flags via localStorage |
| `CoinGeckoUtils` | `e2e-tests-core/utils/coinGeckoUtils.ts` | Live crypto exchange rate validation |
| `TestData` | `utils/testData.ts` | File paths for document/image uploads |

All utilities are re-exported from `playwright/utils/index.ts` — import from `'../utils'`, not from individual files.

---

## NavigationUtils

**Location:** `e2e-tests-core/utils/navigationUtils.ts`

### `NavigationUtils.waitForDerivApiSettled(page, options?)`

Waits for all in-flight XHR/Fetch requests to URLs containing `deriv.com` to settle. **Call this after every page navigation or state change** in DTrader — the app relies heavily on WebSocket/API calls to hydrate UI.

```typescript
import { NavigationUtils } from '../utils';

// After any navigation or state change
await NavigationUtils.waitForDerivApiSettled(page);

// With custom options (for faster pages)
await NavigationUtils.waitForDerivApiSettled(page, {
    idleMs: 1000, // ms with no new requests before considering settled (default: 5000)
    maxWaitMs: 20000, // max wait time before giving up (default: 20000)
});
```

**When to call:**

- After `loginPage.login()`
- After in-app navigation clicks (sidebar, tabs)
- After any action that triggers a route change or data reload

**When NOT needed:**

- After `redirectionHelpers.redirectTo()` — already calls this internally
- For SmartCharts / DBot canvas interactions — use landmark element assertions instead

### `NavigationUtils.goBackAndExpectUrl(page, urlPattern)`

Navigate back and assert the resulting URL.

```typescript
await NavigationUtils.goBackAndExpectUrl(page, /\/reports\/positions/);
```

---

## MailiskUtils

**Location:** `e2e-tests-core/utils/mailisk.ts`

Retrieve emails and extract OTPs from Mailisk inboxes. Use for any test that receives an email OTP.

**Default domain:** `@webapps.mailisk.net`

### `MailiskUtils.extractOtp(namespace, filters, options?)`

```typescript
// Capture from_timestamp BEFORE triggering the email send
const from_timestamp = Math.floor(Date.now() / 1000);

// Then trigger the email (e.g. click "Send OTP")
// Then extract:
const { otp } = await MailiskUtils.extractOtp(
    'webapps',
    {
        to_addr_prefix: emailLocalPart, // local part before @
        subject_includes: 'verification', // optional — narrows by subject
        from_timestamp,
    },
    { timeout: 180_000 } // 3 minutes
);
```

**Rules:**

- Always capture `from_timestamp` **before** triggering the OTP send
- Set `to_addr_prefix` to filter for this test's email only
- Use `timeout: 180_000` (3 minutes) as standard

---

## DataFactory

**Location:** `e2e-tests-core/utils/dataFactory.ts`

Generate realistic test data. **Always use DataFactory — never hardcode test data.**

```typescript
import { DataFactory } from '../utils';

// Emails
DataFactory.generateEmail(); // drvtstqa_<ts>_<rand>@webapps.mailisk.net
DataFactory.generateEmailWithPrefix('trade'); // drvtstqa_trade_<ts>_<rand>@webapps.mailisk.net

// Personal details
DataFactory.generateFirstName();
DataFactory.generateLastName();
DataFactory.generateFullName();
DataFactory.generateDateOfBirth(); // "YYYY-MM-DD" (age 18–80)
DataFactory.generatePhone();
DataFactory.generateAlbanianPhoneNumber(); // 9 digits, no country code

// Address
DataFactory.generateAddress();
DataFactory.generateCity();
DataFactory.generateAlbanianCity();
DataFactory.generateZipCode();
DataFactory.generateCompleteAddress(); // { street, city, state, countryCode, zipCode }

// All-in-one
DataFactory.generateUserProfile(); // { firstName, lastName, email, phone, dateOfBirth, address }
```

**Rules:**

- Email local part must NEVER exceed 64 characters (RFC 5321)
- Prefer `generateEmailWithPrefix('context')` over `generateEmail()` for traceability
- Store generated data in variables — never call DataFactory twice for the same value

---

## Account Creation Runner

**Location:** `e2e-tests-core/utils/accountCreationRunner.ts`

**⚠️ STAGING ONLY** — Never use in production tests.

```typescript
import { createAccountV1, createAccountV2, topupAccount, changePoiPoaStatus } from '../utils';

// Virtual (demo) account
const account = await createAccountV1('virtual');

// Real account
const account = await createAccountV2('real', 'al', { currency: 'USD' });
```

Returns `{ email, password, ... }`. Use the returned `email` and `password` with `loginPage.login()`.

---

## Feature Flags

**Location:** `e2e-tests-core/utils/featureFlags.ts`

Toggle feature flags in localStorage for tests that require specific feature states.

```typescript
import { enableFeatureFlags, disableFeatureFlags, getFeatureFlags } from '../utils';

// Navigate to the page first — localStorage requires a loaded page
await page.goto('/');

await enableFeatureFlags(page, 'FEATURE_FLAG_NAME');
await disableFeatureFlags(page, ['FLAG_A', 'FLAG_B']);

const flags = await getFeatureFlags(page);
```

---

## TestData

**Location:** `utils/testData.ts`

File path helpers for upload tests.

```typescript
import { TestData } from '../utils';

// Resolve path to a file in playwright/test-data/
await page.setInputFiles(input, TestData.document('Bank_statement.png'));
await page.setInputFiles(input, TestData.image('selfie.jpg'));
```

Files live in:

- `playwright/test-data/documents/` — PDFs, bank statements, ID docs
- `playwright/test-data/images/` — image files

---

## Quick Cheat Sheet

| Task | Use |
| --- | --- |
| Wait for page to fully load after navigation | `NavigationUtils.waitForDerivApiSettled(page)` |
| Generate a test email | `DataFactory.generateEmailWithPrefix('context')` |
| Retrieve OTP from email | `MailiskUtils.extractOtp('webapps', { to_addr_prefix, from_timestamp }, { timeout: 180_000 })` |
| Navigate to a page | `redirectionHelpers.redirectTo(page, '/reports/positions')` |
| Create a staging account | `createAccountV2('real', 'al', { currency: 'USD' })` |
| Resolve a test file path | `TestData.document('filename.pdf')` |
| Toggle a feature flag | `enableFeatureFlags(page, 'FLAG_NAME')` |
