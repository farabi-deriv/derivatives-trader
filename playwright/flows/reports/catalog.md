# 🗺️ Reports Journey Catalog — Technical Reference

> Source of truth: `playwright/pages/ReportsPage.ts`
> Last updated: 2026-09-15

---

## Section 1 — Journey Index

| Journey ID   | Spec File                                       | Tags                                    |
| ------------ | ----------------------------------------------- | --------------------------------------- |
| Flow 1, 5, 6 | `reports/verify-reports-navigation.spec.ts`     | `@reports @regression @desktop @mobile` |
| Flow 2–4, G1 | `reports/verify-reports-open-positions.spec.ts` | `@reports @regression @desktop @mobile` |
| Flow 7, 8    | `reports/verify-reports-empty-states.spec.ts`   | `@reports @regression @desktop @mobile` |
| G2           | `reports/verify-reports-navigation.spec.ts`     | `@reports @regression @desktop @mobile` |

---

## Section 2 — Flow Details

> Three consolidated spec files implement all Reports flows. Each runs **serial** under `@reports @regression @desktop @mobile`. Navigation and open-positions specs **seed contracts in-test** via `tradeRiseFallPage` / `tradeMultipliersPage`. Empty-state spec uses a **fresh account** from `createAccountV2viaJS` (staging) or env credentials (production).

### `verify-reports-navigation.spec.ts` — Flows 1, 5, 6, G2

**Account:** `TEST_EMAIL` / `TEST_EMAIL_MOBILE` + `TEST_PASSWORD`.

**Cleanup:** `afterEach` → `positionsPage.closeAllOpenContracts()`.

| Flow       | Test name                                                                  |
| ---------- | -------------------------------------------------------------------------- |
| 1          | `VERIFY reports page loads with default Open positions tab`                |
| 5          | `VERIFY trade table tab loads with date filter and content`                |
| 6          | `VERIFY statement tab loads with transaction filter and statement content` |
| 6 (filter) | `VERIFY filtering by Buy on statement tab`                                 |
| G2         | `VERIFY archived statement route and header display`                       |

**Describe block:**

```typescript
test.describe('Reports — Navigation & Statement', { tag: ['@reports', '@regression', '@desktop', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const emailVar = testInfo.project.name.includes('mobile') ? 'TEST_EMAIL_MOBILE' : 'TEST_EMAIL';
        // throw if unset
    });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(testEmail);
    });

    test.afterEach(async ({ positionsPage }) => {
        await positionsPage.closeAllOpenContracts().catch(() => {});
    });
});
```

**Flow 1 — default tab:**

```typescript
await redirectionHelpers.redirectTo(page, '/reports');
await NavigationUtils.waitForDerivApiSettled(page);
await expect(reportsPage.reportsHeaderTitle).toBeVisible();
await expect(page).toHaveURL(/\/reports\/positions/);
```

**Flow 5 — Trade Table:**

```typescript
await redirectionHelpers.redirectTo(page, '/reports/profit');
await NavigationUtils.waitForDerivApiSettled(page);
await expect(reportsPage.metaWrapper).toBeVisible();
await expect(reportsPage.tableRows.first().or(reportsPage.emptyStateIcon)).toBeVisible();
```

**Flows 6 — Statement (seeds a Buy first):**

```typescript
// Buy Rise on trade page (mobile: purchaseButton.click(); desktop: clickBuy())
await redirectionHelpers.redirectTo(page, '/reports/statement');
await NavigationUtils.waitForDerivApiSettled(page);
await expect(reportsPage.transactionTypeFilter).toBeVisible();
await reportsPage.selectTransactionTypeFilter('Buy');
await expect(reportsPage.tableRows.first()).toContainText(/Buy/i);
```

**G2 — Archived statement route:**

```typescript
await redirectionHelpers.redirectTo(reportsPage.page, '/reports/archived-statement');
await NavigationUtils.waitForDerivApiSettled(reportsPage.page);
await expect(reportsPage.reportsHeaderTitle).toBeVisible();
await expect(reportsPage.archivedStatementTab).toBeVisible();
```

> G2 asserts the **route and header render** — it does not require `ARCHIVED_TEST_EMAIL`. Tab visibility in the main Reports shell still depends on `client.has_archived_statement`.

---

### `verify-reports-open-positions.spec.ts` — Flows 2, 3, 4, G1

**Account / cleanup:** Same as navigation spec (`TEST_EMAIL` / `_MOBILE`, `closeAllOpenContracts` in `afterEach`).

| Flow | Test name                                                                 |
| ---- | ------------------------------------------------------------------------- |
| 2    | `VERIFY open positions tab shows Options contracts by default`            |
| 3    | `VERIFY switching to Multipliers filter shows multiplier contracts`       |
| 4    | `VERIFY switching to Accumulators filter displays growth rate sub-filter` |
| G1   | `VERIFY clicking an open position row navigates to contract details`      |

**Flow 2 — Options row visible (after in-test Rise buy):**

```typescript
await redirectionHelpers.redirectTo(page, '/reports/positions');
await NavigationUtils.waitForDerivApiSettled(page);
await expect(reportsPage.tableRows.first()).toBeVisible();
```

**Flow 3 — Multipliers filter (seeds Options + Multiplier contracts first):**

```typescript
await reportsPage.selectContractTypeFilter('Multipliers');
await NavigationUtils.waitForDerivApiSettled(page);
await expect(reportsPage.tableRows.first()).toContainText(/Multiplier|Up|x\d+|Vol/i);
```

**Flow 4 — Accumulators sub-filter:**

```typescript
await reportsPage.selectContractTypeFilter('Accumulators');
await expect(reportsPage.growthRateFilter).toBeVisible();
```

**G1 — Row → contract details:**

```typescript
await reportsPage.tableRows.first().click();
await expect(page.getByText('Contract details').first()).toBeVisible();
```

---

### `verify-reports-empty-states.spec.ts` — Flows 7, 8

**Account:** Fresh account — `createAccountV2viaJS('real', …)` on staging (backup `TEST_EMAIL` / `_MOBILE`); production uses env credentials directly.

| Flow | Test name                                                                                 |
| ---- | ----------------------------------------------------------------------------------------- |
| 7    | `VERIFY empty state shown on Trade Table when account has no trading activity`            |
| 8    | `VERIFY empty state shown on Statement when account has no transactions of selected type` |

**Flow 7:**

```typescript
await redirectionHelpers.redirectTo(page, '/reports/profit');
await expect(
    page.getByText(/You('ve made no transactions of this type during this period| have no trading activity yet)/i)
).toBeVisible();
```

**Flow 8 — filter Withdrawal on fresh account (only Deposit exists):**

```typescript
await redirectionHelpers.redirectTo(page, '/reports/statement');
await reportsPage.selectTransactionTypeFilter('Withdrawal');
await expect(
    page.getByText(/You('ve made no transactions of this type during this period| have no transactions yet)/i)
).toBeVisible();
```

---

## Section 3 — Tags Reference

| Tag           | When to apply                                                            |
| ------------- | ------------------------------------------------------------------------ |
| `@reports`    | All tests in the reports feature area                                    |
| `@smoke`      | Not used on any automated spec today                                     |
| `@regression` | All automated Reports specs (no `@smoke` or `@production` in code today) |
| `@production` | Not used — Reports tests require login and contract/statement mutations  |
| `@desktop`    | Desktop viewport — `VerticalTab` sidebar navigation                      |
| `@mobile`     | Mobile viewport — `SelectNative` dropdown tab navigation                 |

---

## Section 4 — Feature-Specific Decisions

### Reports is full-page on BOTH desktop and mobile

Unlike `Positions` (mobile-only full page, desktop sidebar flyout), the `/reports` route renders a full-page layout on both desktop and mobile. Desktop shows a `VerticalTab` sidebar with tab links; mobile shows a `SelectNative` dropdown for tab selection. Both surfaces render the same route content below.

**Impact on generated code:** Always use `redirectionHelpers.redirectTo(page, '/reports')` — no platform guard needed for the route. Platform branching is only needed at the tab-navigation interaction level (`VerticalTab.click()` vs `SelectNative.selectOption()`).

### Tab navigation differs by platform

- **Desktop:** Click the tab label inside the `VerticalTab` sidebar (text match: "Open positions", "Trade table", "Statement", "Archived statement")
- **Mobile:** Select the option from the `SelectNative` `<select>` dropdown element

No `data-testid` on the tab elements — use `getByText()` (desktop) and `getByRole('option', { name: '...' })` or direct `selectOption()` (mobile).

**Impact on generated code:** Tab-switch actions in the Page Object must branch on `isMobile`. Verify actual select/option label text on staging before finalising.

### Contract type filter differs by platform

- **Desktop:** Quill `Dropdown` component — click to open, then click an option
- **Mobile:** `SelectNative` `<select>` — use `.selectOption(value)` directly

No `data-testid` on the filter element. Use class-based or role-based locators; verify on staging.

**Impact on generated code:** `selectContractTypeFilter()` POM action must branch on `isMobile`.

### Calendar date inputs use HTML `id`, not `data-testid`

`CompositeCalendar` renders its desktop inputs with `id="dt_calendar_input_from"` and `id="dt_calendar_input_to"` — NOT `data-testid`. Use `this.page.locator('#dt_calendar_input_from')` for desktop. Mobile uses `CompositeCalendarMobile` with a sheet UI — verify the mobile interaction pattern on staging.

**Impact on generated code:** Never use `getByTestId('dt_calendar_input_from')` — it will not find the element. Use `locator('#dt_calendar_input_from')` on desktop.

### `waitForDerivApiSettled` required after tab switch and filter apply

Switching between Reports tabs triggers WebSocket calls to fetch data (profit table, statement, open positions). Always call `NavigationUtils.waitForDerivApiSettled(page)` after tab switching and after filter changes before asserting row visibility.

**Impact on generated code:** Every tab switch action and filter action in the Page Object must be followed by `await NavigationUtils.waitForDerivApiSettled(page)` in the test.

### Archived Statement tab vs G2 route test

The "Archived statement" tab in the main Reports shell only appears when `client.has_archived_statement` is true. **G2** (`verify-reports-navigation.spec.ts`) navigates directly to `/reports/archived-statement` and asserts the header — it does not depend on the tab being visible in the shell or on a dedicated `ARCHIVED_TEST_EMAIL`.

### Open Positions flows seed contracts in-test

Flows 2–4 and G1 buy Rise/Multiplier contracts in the same spec before opening `/reports/positions`. They use `TEST_EMAIL` / `_MOBILE` for login, not a pre-seeded portfolio — `afterEach` closes all open contracts for the next test.

**Impact on generated code:** Follow the buy-then-navigate pattern in `verify-reports-open-positions.spec.ts`; do not assume pre-existing open positions on the shared staging account.
