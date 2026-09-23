# 🗺️ Notifications Journey Catalog — Technical Reference

> Source of truth: `playwright/pages/NotificationsPage.ts`
> Last updated: 2026-09-11

---

## Section 1 — Journey Index

| Journey ID | Spec File | Tags | Status |
| --- | --- | --- | --- |
| Flow 1 | `notifications/verify-trade-banner-purchase.spec.ts` | `@notifications @mobile` | ✅ Automated |
| Flow 2 | `notifications/verify-trade-banner-sell.spec.ts` | `@notifications @mobile` | ✅ Automated |
| Flow 3 | — | — | **N/A — surface removed** |
| Flow 4 | — | — | **N/A — surface removed** |
| Flow 5 | — | — | **N/A — surface removed** |
| Flow 6 | — | — | **N/A — surface removed** |
| Flow 7 | — | — | **N/A — surface removed** |
| G1 | `notifications/verify-no-bell-on-trade-page.spec.ts` | `@notifications @desktop @mobile` | ✅ Automated |
| G2 | `notifications/verify-trade-banner-locator-fallback.spec.ts` | `@notifications @mobile` | ✅ Automated |

> **Flows 3–7 are N/A**: the bell entry point (`ShowNotifications`) lost its last host in commit `1221b37030` (TRAH-6133, 2025-06-19) — `show-notifications.tsx` has zero importers, so the notification centre (`NotificationsDialog/`, `dt_notifications_list_wrapper`) is unreachable. The previously proposed centre specs (`verify-notification-centre-*.spec.ts`) are cancelled. The `NotificationsPage` bell/centre locators are dead test code pending the app team's cleanup of the dead app components (see `flow.md` Architecture Note).

---

## Section 2 — Flow Details

### Flow 1 — Trade banner: purchase notification appears after buy

**Account setup:**

```typescript
// Requires a funded real account — use env vars, not createAccountV2
// TEST_EMAIL and TEST_PASSWORD in playwright/.env.staging must be a funded real account
```

**Test pattern:**

```typescript
test.describe('Notifications — Trade banner purchase', { tag: ['@notifications', '@mobile'] }, () => {
    test.beforeEach(async ({ loginPage, tradePage, page }) => {
        await loginPage.login();
        await tradePage.goto();
        await NavigationUtils.waitForDerivApiSettled(page);
        await tradePage.selectTradeType('Rise/Fall');
    });

    test('VERIFY purchase notification banner appears and auto-hides', async ({
        tradePage,
        notificationsPage,
        page,
    }) => {
        await tradePage.setStakeAmount('1.00');
        await tradePage.clickRise();
        // Assert banner visible — no testid, use CSS class
        await expect(notificationsPage.tradeBanner, 'Trade purchase banner should be visible').toBeVisible();
        // Wait for auto-hide (4000ms + buffer)
        await page.waitForTimeout(4500);
        await expect(notificationsPage.tradeBanner, 'Trade banner should auto-hide after 4 seconds').not.toBeVisible();
    });
    // → Flow 1
});
```

> **Note:** `page.waitForTimeout()` is used here intentionally — the 4s auto-hide is a timed DOM removal with no intermediate state to poll. This is the only exception to the no-waitForTimeout rule in this module.

---

### Flow 2 — Trade banner: sell notification appears after contract close

**Account setup:** Same as Flow 1 — funded real account with at least one open contract.

**Test pattern:**

```typescript
test.describe('Notifications — Trade banner sell', { tag: ['@notifications', '@mobile'] }, () => {
    test.beforeEach(async ({ loginPage, tradePage, page }) => {
        await loginPage.login();
        await tradePage.goto();
        await NavigationUtils.waitForDerivApiSettled(page);
    });

    test('VERIFY sell notification banner appears after closing contract', async ({
        tradePage,
        notificationsPage,
        page,
    }) => {
        // Close open contract from positions panel (pre-existing position required)
        await tradePage.closeFirstOpenContract();
        await expect(notificationsPage.tradeBanner, 'Trade sell banner should be visible after close').toBeVisible();
        await page.waitForTimeout(4500);
        await expect(notificationsPage.tradeBanner, 'Trade banner should auto-hide after 4 seconds').not.toBeVisible();
    });
    // → Flow 2
});
```

---

### Flow 3 — Notification centre: bell opens dialog (desktop) — **CANCELLED (N/A, surface removed)**

> The patterns below are retained for reference only. No spec implements them — `ShowNotifications` (the only bell host) is dead code with zero importers since commit `1221b37030` (TRAH-6133). `gotoNotificationCentreSurface()` as written navigates to `/`, where the bell never renders — it could never have worked.

**Account setup:** Any authenticated account.

**Test pattern:**

```typescript
test.describe('Notifications — Centre dialog desktop', { tag: ['@notifications', '@smoke', '@desktop'] }, () => {
    test.beforeEach(async ({ loginPage, notificationsPage, page }) => {
        await loginPage.login();
        // Navigate to a surface that renders ShowNotifications (Traders Hub header)
        await notificationsPage.gotoNotificationCentreSurface();
        await NavigationUtils.waitForDerivApiSettled(page);
    });

    test('VERIFY bell icon opens notification centre dialog', async ({ notificationsPage }) => {
        await notificationsPage.openNotificationCentre();
        await expect(
            notificationsPage.notificationsListWrapper,
            'Notification centre should open on bell click'
        ).toBeVisible();
    });

    test('VERIFY clicking outside closes notification centre dialog', async ({ notificationsPage, page }) => {
        await notificationsPage.openNotificationCentre();
        await expect(notificationsPage.notificationsListWrapper, 'Dialog should be open').toBeVisible();
        await notificationsPage.clickOutsideDialog();
        await expect(
            notificationsPage.notificationsListWrapper,
            'Dialog should close when clicking outside'
        ).not.toBeVisible();
    });
    // → Flow 3
});
```

---

### Flow 4 — Notification centre: bell opens dialog (mobile) — **CANCELLED (see Flow 3)**

**Account setup:** Same as Flow 3; runs under `chromium-mobile` project.

**Test pattern:**

```typescript
test.describe('Notifications — Centre dialog mobile', { tag: ['@notifications', '@smoke', '@mobile'] }, () => {
    test.beforeEach(async ({ loginPage, notificationsPage, page }) => {
        await loginPage.login();
        await notificationsPage.gotoNotificationCentreSurface();
        await NavigationUtils.waitForDerivApiSettled(page);
    });

    test('VERIFY bell icon opens notification centre modal (mobile)', async ({ notificationsPage }) => {
        await notificationsPage.openNotificationCentre();
        await expect(
            notificationsPage.notificationsListWrapper,
            'Notification centre modal should open on tap'
        ).toBeVisible();
    });
    // → Flow 4
});
```

---

### Flow 5 — Notification centre: empty state — **CANCELLED (see Flow 3)**

**Account setup:** Authenticated account with cleared or no notification items.

**Test pattern:**

```typescript
test.describe('Notifications — Centre empty state', { tag: ['@notifications', '@desktop', '@mobile'] }, () => {
    test.beforeEach(async ({ loginPage, notificationsPage, page }) => {
        await loginPage.login();
        await notificationsPage.gotoNotificationCentreSurface();
        await NavigationUtils.waitForDerivApiSettled(page);
        await notificationsPage.openNotificationCentre();
        // Clear all first to ensure empty state
        await notificationsPage.clearAllIfEnabled();
    });

    test('VERIFY empty state shows correct icon and copy', async ({ notificationsPage }) => {
        await expect(notificationsPage.emptyStateIcon, 'Empty state icon should be visible').toBeVisible();
        await expect(notificationsPage.clearAllButton, 'Clear All button should be disabled when empty').toBeDisabled();
    });
    // → Flow 5
});
```

---

### Flow 6 — Notification centre: notifications list with items — **CANCELLED (see Flow 3)**

**Account setup:** Authenticated account that has one or more notification items (e.g. a newly created real account often has welcome/verification notifications).

**Test pattern:**

```typescript
test.describe('Notifications — Centre list with items', { tag: ['@notifications', '@desktop', '@mobile'] }, () => {
    test.beforeEach(async ({ loginPage, notificationsPage, page }) => {
        await loginPage.login();
        await notificationsPage.gotoNotificationCentreSurface();
        await NavigationUtils.waitForDerivApiSettled(page);
    });

    test('VERIFY notification items are listed and Clear All is enabled', async ({ notificationsPage }) => {
        await notificationsPage.openNotificationCentre();
        await expect(
            notificationsPage.emptyStateIcon,
            'Empty state should not be visible when items exist'
        ).not.toBeVisible();
        await expect(
            notificationsPage.clearAllButton,
            'Clear All button should be enabled when items exist'
        ).toBeEnabled();
    });
    // → Flow 6
});
```

---

### Flow 7 — Notification centre: Clear All clears notifications — **CANCELLED (see Flow 3)**

**Account setup:** Same as Flow 6.

**Test pattern:**

```typescript
test.describe('Notifications — Centre clear all', { tag: ['@notifications', '@desktop', '@mobile'] }, () => {
    test.beforeEach(async ({ loginPage, notificationsPage, page }) => {
        await loginPage.login();
        await notificationsPage.gotoNotificationCentreSurface();
        await NavigationUtils.waitForDerivApiSettled(page);
        await notificationsPage.openNotificationCentre();
    });

    test('VERIFY Clear All removes all notifications and shows empty state', async ({ notificationsPage }) => {
        await expect(notificationsPage.clearAllButton, 'Clear All should be enabled before clearing').toBeEnabled();
        await notificationsPage.clearAllButton.click();
        await expect(notificationsPage.emptyStateIcon, 'Empty state icon should appear after Clear All').toBeVisible();
        await expect(notificationsPage.clearAllButton, 'Clear All should be disabled after clearing').toBeDisabled();
    });
    // → Flow 7
});
```

---

## Section 3 — Tags Reference

| Tag | When to apply |
| --- | --- |
| `@notifications` | All tests in the notifications module |
| `@smoke` | Not used on any automated spec today (cancelled centre flows 3–7 would have carried it) |
| `@desktop` | Desktop viewport only (notification centre inline dropdown) |
| `@mobile` | Mobile viewport (trade banner is AppV2-only; notification centre opens as MobileDialog) |

---

## Section 4 — Feature-Specific Decisions

### Two separate notification systems — different locator strategies

DTrader has two notification systems that must not be confused:

1. **Trade page banner** (`AppV2/Containers/Notifications/notifications.tsx`) — CSS classes only (`trade-notification--purchase`, `trade-notification`). No `data-testid`. Appears on route `/` only. Auto-hides after 4000ms.
2. **Notification centre dialog** (`core/App/Containers/NotificationsDialog/`) — testids: `dt_notifications_list_wrapper`, `dt_clear_all_footer_button`, `dt_ic_box_icon`. Entry via bell icon in `dt_traders_hub_show_notifications` wrapper.

**Impact on generated code:** The `NotificationsPage` POM must expose two separate locator groups — one for the trade banner (CSS class), one for the notification centre (testid). Tests for banner (Flows 1–2) and tests for the notification centre (Flows 3–7) should live in separate spec files.

### Bell icon has no data-testid — **obsolete (surface removed)**

The bell icon guidance below is retained for reference only. The bell no longer renders anywhere: `ShowNotifications` (the component that wrapped it) has zero importers since commit `1221b37030` (TRAH-6133), so the `dt_traders_hub_show_notifications` wrapper and the `notifications-toggle__icon-wrapper` child never appear in the DOM. The `NotificationsPage` locators built on them are dead test code.

The bell icon itself (`LegacyNotification1pxIcon` inside `notifications-toggle__icon-wrapper`) had no `data-testid`; the wrapper `dt_traders_hub_show_notifications` was used to locate the bell region, then the child `notifications-toggle__icon-wrapper` element was clicked.

### Bell icon lives only in Traders Hub header — not on trade page — **obsolete (surface removed)**

`ShowNotifications` (and `ToggleNotifications`) no longer renders on **any** surface — its last host was removed in TRAH-6133 (commit `1221b37030`). It is absent from the DTrader AppV2 sidebar (`dt_sidebar`), the mobile bottom nav, and every route. Flows 3–7 are N/A until the app team re-adds a bell entry point.

### Trade banner auto-hide — intentional waitForTimeout

The banner uses `autohideTimeout={4000}` from `@deriv-com/quill-ui`'s `NotificationBanners`. There is no intermediate DOM event to poll. A single `page.waitForTimeout(4500)` is the correct approach for asserting auto-hide — this is the only exception to the no-waitForTimeout rule in this module.

### Only one purchase banner is shown at a time

If more than one notification is queued, the component removes the oldest. Do not attempt to assert two banners simultaneously — only one will ever be visible.

### Individual notification items have no testid

Notification items in the list use CSS class `notifications-item` with no `data-testid`. Use `.locator('.notifications-item')` for count assertions; use `clearAllButton` for bulk operations rather than targeting individual items.

### `dt_clear_all_footer_button` disabled state

The Clear All button is disabled when `is_notifications_empty` is true (driven by the `notifications` MobX store). Assert `toBeDisabled()` after clearing and `toBeEnabled()` when items exist.
