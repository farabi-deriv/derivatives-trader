# 🗺️ Positions Journey Catalog — Technical Reference

> Source of truth: `playwright/pages/PositionsPage.ts`
> Last updated: 2026-09-15

---

## Section 1 — Journey Index

| Journey ID | Spec File | Tags |
| --- | --- | --- |
| Flow 1, 2, 4, 7 | `positions/verify-positions-load.spec.ts` | `@positions @desktop @mobile` |
| Flow 3, 10 | `positions/verify-positions-empty-states.spec.ts` | `@positions @regression @mobile` |
| Flow 5, 6, 11 | `positions/verify-positions-filters.spec.ts` | `@positions @regression @mobile` |
| Flow 8, 9 | `positions/verify-positions-actions.spec.ts` | `@positions @regression @mobile` |

---

## Section 2 — Flow Details

> Four consolidated spec files implement all Positions flows. **Desktop-only** flows (2) and **mobile-only** flows (1, 3–11) use `test.skip()` when the wrong viewport runs. Load/actions specs **seed contracts in-test** via `tradeRiseFallPage` / `tradeMultipliersPage`; Flow 10 uses a **fresh account** on staging.

### `verify-positions-load.spec.ts` — Flows 1, 2, 4, 7

**Account:** `TEST_EMAIL` / `TEST_EMAIL_MOBILE` + `TEST_PASSWORD`.

**Cleanup:** `afterEach` → redirect mobile to `/positions`, then `closeAllOpenContracts()`.

| Flow | Platform | Test name |
| --- | --- | --- |
| 1 | Mobile | `VERIFY open positions list loads with contract cards on mobile` |
| 2 | Desktop | `VERIFY positions flyout opens from sidebar on desktop` |
| 4 | Mobile | `VERIFY closed positions tab shows contracts grouped by date on mobile` |
| 7 | Mobile | `VERIFY clicking a contract card navigates to contract details on mobile` |

**Describe block:**

```typescript
test.describe('Positions — Page Load & Navigation', { tag: ['@positions', '@desktop', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });
    // beforeAll: TEST_EMAIL / TEST_EMAIL_MOBILE
    // beforeEach: seedLocalStorage + login
    // afterEach: mobile redirect + closeAllOpenContracts
});
```

**Flow 1 — mobile open list (buys Rise first):**

```typescript
if (!isMobileViewport) test.skip(true, 'Flow 1 is mobile-only');
// buy Rise via tradeRiseFallPage (5 min, stake 1.00)
await redirectionHelpers.redirectTo(page, '/positions');
await expect(positionsPage.positionsOpenTab).toBeVisible();
await expect(positionsPage.firstContractCard).toBeVisible();
await expect(positionsPage.mobileTotalProfitLoss).toBeVisible();
```

**Flow 2 — desktop sidebar flyout:**

```typescript
if (isMobileViewport) test.skip(true, 'Flow 2 is desktop-only');
await tradeRiseFallPage.clickBuy();
await positionsPage.sidebarPositionsButton.click();
await expect(positionsPage.positionsFlyout).toBeVisible();
await expect(positionsPage.positionsTitle).toHaveText('Positions');
await expect(positionsPage.footerTotalPL).toBeVisible();
```

**Flow 4 — mobile closed tab (uses account history; no buy required):**

```typescript
await positionsPage.clickClosedTab();
await expect(positionsPage.closedPositionsDateHeader.first()).toBeVisible();
await expect(positionsPage.firstMobileClosedCard).toBeVisible();
```

**Flow 7 — mobile card → details → back:**

```typescript
await positionsPage.firstContractCard.click();
await expect(page.getByText('Contract details')).toBeVisible();
await page.goBack();
await expect(positionsPage.firstContractCard).toBeVisible();
```

---

### `verify-positions-empty-states.spec.ts` — Flow 3, Flow 10

**Tags:** `@positions @regression @mobile` — mobile-only (desktop skips).

| Flow | Test name |
| --- | --- |
| 3 | `VERIFY empty open positions state on mobile` (light + dark theme) |
| 10 | `VERIFY empty closed positions state on mobile` |

**Flow 3 — empty open tab (light theme, then dark-theme icon contrast #1036):**

```typescript
await positionsPage.ensureEmptyOpenPositionsTab();
await positionsPage.verifyEmptyOpenPositionsState();
// Dark theme step: seedDarkThemePreference → reload → re-ensure empty → assert body.theme--dark + icon visible
```

**Flow 10 — empty closed tab (fresh account via `createAccountV2viaJS` on staging):**

```typescript
await redirectionHelpers.redirectTo(page, '/positions');
await positionsPage.clickClosedTab();
await NavigationUtils.waitForDerivApiSettled(page);
await positionsPage.verifyEmptyClosedPositionsState();
```

---

### `verify-positions-filters.spec.ts` — Flows 5, 6, 11

**Account:** `TEST_EMAIL` / `_MOBILE`. Mobile-only; `beforeEach`/`afterEach` no-op on desktop.

| Flow | Test name |
| --- | --- |
| 5 | `VERIFY filter by trade type narrows open positions list and can be cleared` |
| 11 | `VERIFY no-matches state when trade type filter has no matching open positions` |
| 6 | `VERIFY time filter narrows closed positions list and can be reset` |

**Flow 5 — trade-type filter:**

```typescript
await positionsPage.openTradeTypeFilter();
await positionsPage.selectFirstTradeTypeFilter();
await positionsPage.applyFilter();
await expect(positionsPage.tradeTypeFilterChip).toContainText('(1)');
await positionsPage.openTradeTypeFilter();
await positionsPage.clearFilter();
```

**Flow 11 — no matches (filter Accumulators with only Rise open):**

```typescript
await page.getByRole('checkbox', { name: 'Accumulators' }).check();
await positionsPage.applyFilter();
await expect(page.getByText('No matches found')).toBeVisible();
```

**Flow 6 — closed-tab time filter:**

```typescript
await positionsPage.clickClosedTab();
await positionsPage.openTimeFilter();
await positionsPage.selectTimeFilterOption('Today');
await expect(positionsPage.timeFilterChip).toContainText('Today');
await positionsPage.resetTimeFilter();
```

---

### `verify-positions-actions.spec.ts` — Flow 8, Flow 9

**Account:** `TEST_EMAIL` / `_MOBILE`. Mobile-only swipe/force-click actions.

| Flow | Test name |
| --- | --- |
| 8 | `VERIFY swiping left on a contract card allows closing the position on mobile` |
| 9 | `VERIFY swiping left on a multiplier contract with DC allows cancelling on mobile` |

**Flow 8 — close via swipe action:**

```typescript
await positionsPage.closeFirstContract();
```

**Flow 9 — Multiplier with Deal Cancellation:**

```typescript
await tradeMultipliersPage.setRiskManagement({ dealCancellation: '5 min' });
await tradeMultipliersPage.clickMultipliersBuy();
await positionsPage.mobileContractCardCancelButton.click({ force: true });
await expect(positionsPage.emptyStateIcon).toBeVisible();
```

---

## Section 3 — Tags Reference

| Tag | When to apply |
| --- | --- |
| `@positions` | All tests in the positions feature area |
| `@smoke` | Not used on any automated spec today |
| `@regression` | Filters, empty states, close/cancel actions (`verify-positions-filters`, `verify-positions-empty-states`, `verify-positions-actions`) |
| `@production` | Not used — Positions tests require login and contract mutations |
| `@desktop` | Desktop viewport — sidebar flyout flow only (Flow 2 in load spec) |
| `@mobile` | Mobile viewport — full-page `/positions` route with tabs |

---

## Section 4 — Feature-Specific Decisions

### Desktop-only: sidebar flyout, not a full-page route

`PositionsSwitch` redirects to `/` on desktop — the positions page only renders on mobile. Desktop positions live in the sidebar `Flyout` component opened by clicking `dt_sidebar_positions`. All desktop position tests must navigate to `/` first and interact via the sidebar. Never navigate to `/positions` on desktop — it redirects.

**Impact on generated code:** Desktop tests must click `sidebarPositionsButton` and assert on `positionsFlyout` content. Mobile tests use `redirectionHelpers.redirectTo(page, '/positions')`.

### No testids on filter chips or action sheet elements

The `ContractTypeFilter` and `TimeFilter` components use Quill UI `Chip.Standard` and `ActionSheet` — no `data-testid` attributes. Use role/text locators: `getByRole('button', { name: '...' })`, `getByText(...)`, `getByRole('checkbox')`, `getByRole('radio', { name: '...' })`.

**Impact on generated code:** Locators for filter chips fall back to text/role. Verify actual label text on staging before finalising assertions.

### Contract cards navigation uses `NavLink` with `redirectTo` prop

`ContractCard` renders as `NavLink` when `redirectTo` is set (open positions) and as `div` when not (desktop drawer). On mobile, clicking a contract card navigates to `/contract/{id}`. On desktop flyout, cards are non-navigable divs. Do not assert navigation from desktop flyout cards.

**Impact on generated code:** Flow 7 (card → contract details) is mobile only. Desktop tests should not assert navigation from flyout cards.

### Closed positions loading — scroll-triggered pagination

`ContractCardsSections` shows a `dt_load_more_spinner` when `isLoadingMore` is true. For accounts with many closed contracts, scroll to bottom to trigger fetch of next batch. Tests asserting a specific number of closed contracts should avoid exact counts — use `toBeVisible()` on the first card instead.

**Impact on generated code:** Avoid exact `contractCards.count()` assertions on the closed tab; prefer `firstMobileClosedCard.toBeVisible()`.

### Contract seeding vs fresh accounts

- **Load, filters, actions specs:** Buy Rise/Multiplier contracts in-test via `tradeRiseFallPage` / `tradeMultipliersPage`; login with `TEST_EMAIL` / `_MOBILE`.
- **Flow 3 (empty open):** Uses shared account; closes any open contracts before asserting empty state.
- **Flow 10 (empty closed):** Uses `createAccountV2viaJS` on staging (or production env credentials) so the Closed tab has no history.

**Impact on generated code:** Do not assume a pre-existing portfolio on the shared staging account — follow the seed-or-clear patterns in each spec.

### `waitForDerivApiSettled` required after tab switch and filter apply

Switching from Open to Closed tab triggers a WebSocket call (`onClosedTabMount`) to fetch profit table data. Filter apply on the closed tab also triggers a refetch. Always call `NavigationUtils.waitForDerivApiSettled(page)` after these interactions before asserting card visibility.

**Impact on generated code:** Add `await NavigationUtils.waitForDerivApiSettled(page)` after `clickClosedTab()` and after `applyFilter()` on the closed tab.
