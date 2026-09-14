# 📋 Notifications Journey Spec — What to Test

> **Purpose:** Describes the notification surfaces on `staging-dtrader.deriv.com`. Defines _what_ to verify at each step.
>
> **Feature location:** Trade page banner (AppV2 trade route `/`). The notification centre dialog (Flows 3–7) is **N/A — surface removed** (see the deprecation note below).
> **URL:** `https://staging-dtrader.deriv.com/`
> **Authentication:** Required — all tests start from a logged-in state
> **Staging only:** Flows 1–2 require a funded real account to place and close contracts

---

## Architecture Note

DTrader has **two notification systems**, one live and one dead:

| System              | Component                                          | Entry point                              | Status                                        |
| ------------------- | -------------------------------------------------- | ---------------------------------------- | --------------------------------------------- |
| Trade banner        | `AppV2/Containers/Notifications/notifications.tsx` | Auto-shown after purchase / sell         | **Live** (Flows 1–2)                          |
| Notification centre | `core/App/Containers/NotificationsDialog/`         | Bell icon in `ShowNotifications` wrapper | **Dead code — unreachable** (Flows 3–7 → N/A) |

### ⚠️ Deprecation note — notification centre is unreachable (2026-09-11)

The bell entry point to the notification centre was removed in **commit `1221b37030`** ("Nijil / TRAH-6133 / Fix Header Inconsistency (#18295)", 2025-06-19), which deleted the `default-mobile-links` host and the dtrader-v2 header experiments that rendered `ShowNotifications`. The current header (`header-legacy.tsx`) renders only the logo, `AccountActions`, and `NewVersionNotification` — the complete dead chain is:

- `show-notifications.tsx` (`ShowNotifications`) — **zero importers** (only its own unit test)
- `toggle-notifications.jsx` (`ToggleNotifications`) — imported only by `show-notifications.tsx` and the `Header/index.js` barrel (nothing consumes that export)
- `NotificationsDialog/` (`dt_notifications_list_wrapper`) — reachable only via `ToggleNotifications`

No route renders the bell, so Flows 3–7 cannot be tested. **App-team cleanup item:** delete `show-notifications.tsx` + its test, `toggle-notifications.jsx`, the `ToggleNotifications` barrel export, and `NotificationsDialog/` — they are all dead code. The `NotificationsPage` POM's bell/notification-centre locators (`tradersHubShowNotifications`, `bellIconWrapper`, `notificationsListWrapper`, `emptyStateIcon`, `clearAllButton`, `notificationItems`, `openNotificationCentre`, `gotoNotificationCentreSurface`, `clickOutsideDialog`, `clearAllIfEnabled`) become dead test code alongside them.

The bell icon (`ToggleNotifications`) was rendered by `ShowNotifications` in the Traders Hub header. It is **not present** in the DTrader trade page sidebar or mobile bottom nav. Flow 1–2 cover the trade banner; Flows 3–7 covered the notification centre, which is now **unreachable** (see the deprecation note above) and marked **N/A**.

---

## Section 1 — Shared Prerequisites

All flows require an authenticated session. Flows 1–2 additionally require a funded real account to place a contract. Flows 3–7 are **N/A** — the notification centre has no live entry point.

---

## Section 2 — Per-Flow Sections

### Flow 1 — Trade banner: purchase notification appears after contract buy

**Prerequisites:** Authenticated funded real account; trade page loaded at `/`

| #   | Step                  | Action                                     | Expected Result                                                                                   | Test Data |
| --- | --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------- |
| 1   | Load trade page       | Navigate to `/` and wait for API to settle | Trade form visible                                                                                | —         |
| 2   | Select trade type     | Choose Rise/Fall                           | Rise/Fall parameters visible                                                                      | —         |
| 3   | Set stake             | Enter a valid stake amount                 | Stake field shows entered value                                                                   | `1.00`    |
| 4   | Buy contract          | Click "Rise" buy button                    | Contract purchased; trade banner with purchase confirmation appears at top of screen              | —         |
| 5   | Assert banner visible | —                                          | Banner element with CSS class `trade-notification--purchase` (or `trade-notification`) is visible | —         |
| 6   | Wait for auto-hide    | Wait ~4.5s                                 | Banner disappears automatically (auto-hide timeout is 4000ms)                                     | —         |

> **Platform note:** This flow is mobile-only (AppV2 renders on mobile viewport). The trade banner component lives in `AppV2/Containers/Notifications/notifications.tsx` and only renders on route `/`.

---

### Flow 2 — Trade banner: sell notification appears after contract close

**Prerequisites:** Authenticated funded real account; open Rise/Fall contract in portfolio

| #   | Step               | Action                                    | Expected Result                            | Test Data |
| --- | ------------------ | ----------------------------------------- | ------------------------------------------ | --------- |
| 1   | Load trade page    | Navigate to `/`                           | Trade form visible                         | —         |
| 2   | Open positions     | Wait for open contract in positions panel | Contract visible in open positions         | —         |
| 3   | Close contract     | Click close button on the open contract   | Contract close initiated                   | —         |
| 4   | Assert sell banner | —                                         | Trade banner element is visible after sell | —         |
| 5   | Wait for auto-hide | Wait ~4.5s                                | Banner disappears automatically            | —         |

> **Note:** No `data-testid` is set on the banner container. Use CSS selector `.trade-notification--purchase` or `.trade-notification` to locate it.

---

### Flow 3 — Notification centre: bell opens dialog (desktop) — **N/A (surface removed)**

> **N/A (2026-09-11):** No route renders `ShowNotifications`, so the bell and the dialog it opens are unreachable — see the deprecation note in the Architecture Note. Not automatable until/unless the app team re-adds the bell entry point.

**Prerequisites:** Authenticated account; on a page that renders the `ShowNotifications` header wrapper (e.g. navigate such that `dt_traders_hub_show_notifications` is visible)

| #   | Step                 | Action                                                     | Expected Result                                                                                                          | Platform |
| --- | -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | Locate bell icon     | —                                                          | Bell icon wrapper (CSS class `notifications-toggle__icon-wrapper`) is visible within `dt_traders_hub_show_notifications` | Desktop  |
| 2   | Click bell icon      | Click the bell icon wrapper                                | Notification centre dialog opens — `dt_notifications_list_wrapper` becomes visible                                       | Desktop  |
| 3   | Assert dialog open   | —                                                          | Element with `data-testid='dt_notifications_list_wrapper'` is visible; dialog has heading "Notifications"                | Desktop  |
| 4   | Click outside dialog | Click anywhere outside the dialog (excluding bell wrapper) | Dialog closes; `dt_notifications_list_wrapper` no longer visible                                                         | Desktop  |

---

### Flow 4 — Notification centre: bell opens dialog (mobile) — **N/A (surface removed)**

> **N/A (2026-09-11):** Same as Flow 3 — the mobile `MobileDialog` variant is unreachable without the bell.

**Prerequisites:** Same as Flow 3; mobile viewport

| #   | Step              | Action                               | Expected Result                                                                                | Platform |
| --- | ----------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- | -------- |
| 1   | Locate bell icon  | —                                    | Bell icon visible within `dt_traders_hub_show_notifications`                                   | Mobile   |
| 2   | Tap bell icon     | Tap the bell icon                    | `MobileDialog` modal opens with title "Notifications"; `dt_notifications_list_wrapper` visible | Mobile   |
| 3   | Assert modal open | —                                    | `dt_notifications_list_wrapper` visible; heading "Notifications" visible                       | Mobile   |
| 4   | Close modal       | Tap close / drag down or tap outside | Dialog closes                                                                                  | Mobile   |

---

### Flow 5 — Notification centre: empty state — **N/A (surface removed)**

> **N/A (2026-09-11):** Same as Flow 3 — the empty state lives inside the unreachable `NotificationsDialog`.

**Prerequisites:** Authenticated account; notification centre has no items (cleared or new account)

| #   | Step                      | Action              | Expected Result                                                                         |
| --- | ------------------------- | ------------------- | --------------------------------------------------------------------------------------- |
| 1   | Open notification centre  | Click/tap bell icon | Dialog opens (`dt_notifications_list_wrapper` visible)                                  |
| 2   | Assert empty state        | —                   | `dt_ic_box_icon` (empty-state icon) is visible                                          |
| 3   | Assert empty copy         | —                   | Text "No notifications" is visible                                                      |
| 4   | Assert Clear All disabled | —                   | `dt_clear_all_footer_button` is present but disabled (when notifications list is empty) |

---

### Flow 6 — Notification centre: notifications list with items — **N/A (surface removed)**

> **N/A (2026-09-11):** Same as Flow 3 — the list renders inside the unreachable `NotificationsDialog`.

**Prerequisites:** Authenticated account that has at least one notification item

| #   | Step                     | Action          | Expected Result                                                                                                              |
| --- | ------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Open notification centre | Click bell icon | Dialog opens                                                                                                                 |
| 2   | Assert items visible     | —               | One or more notification items are listed (CSS class `notifications-item`); empty-state icon `dt_ic_box_icon` is NOT visible |
| 3   | Assert counter badge     | —               | Counter badge on bell icon shows a number ≥ 1 (CSS class `notifications-toggle__step`)                                       |
| 4   | Assert Clear All enabled | —               | `dt_clear_all_footer_button` is visible and enabled                                                                          |

---

### Flow 7 — Notification centre: Clear All clears notifications — **N/A (surface removed)**

> **N/A (2026-09-11):** Same as Flow 3 — Clear All is the footer button of the unreachable `NotificationsDialog`.

**Prerequisites:** Same as Flow 6; at least one notification item present

| #   | Step                      | Action                             | Expected Result                                           |
| --- | ------------------------- | ---------------------------------- | --------------------------------------------------------- |
| 1   | Open notification centre  | Click bell icon                    | Dialog opens; items visible                               |
| 2   | Click Clear All           | Click `dt_clear_all_footer_button` | All notification items removed                            |
| 3   | Assert empty state        | —                                  | `dt_ic_box_icon` visible; text "No notifications" visible |
| 4   | Assert badge gone         | —                                  | Counter badge on bell icon is no longer visible           |
| 5   | Assert Clear All disabled | —                                  | `dt_clear_all_footer_button` is now disabled              |

---

## Gap Flows

> These are test cases for coverage gaps. The proposed spec file for each gap is in [`coverage.md`](./coverage.md).

### G1 — No bell icon in DTrader trade page header

The bell icon / `ShowNotifications` wrapper is absent from the DTrader trade page sidebar (`packages/trader/src/AppV2/Components/Layout/Sidebar/sidebar.tsx`) and mobile bottom nav. There is no DTrader-native entry point to the notification centre from within the trade page.

| #   | Test case                         | Steps                                                         | Expected Result                                            |
| --- | --------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Confirm bell absent on trade page | Navigate to `/`; look for `dt_traders_hub_show_notifications` | Element is NOT present in DOM                              |
| 2   | Confirm bell absent in sidebar    | Navigate to `/`; check DTrader sidebar (`dt_sidebar`)         | No bell or notification toggle rendered inside the sidebar |

> **Implication for test design:** Flows 3–7 (notification centre) are **N/A** — no surface renders `ShowNotifications` anymore (see the deprecation note in the Architecture Note). There is no route to the notification centre, from the trade page or anywhere else.

### G2 — Trade banner has no data-testid

The trade banner container (`AppV2/Containers/Notifications/notifications.tsx`) does not expose a `data-testid` attribute. Assertions must use CSS class selectors (`.trade-notification--purchase`, `.trade-notification`) instead.

| #   | Test case                     | Steps                                                      | Expected Result                                    |
| --- | ----------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| 1   | Verify fallback locator works | After placing a Rise contract, query `.trade-notification` | Element is found and visible                       |
| 2   | Verify auto-hide              | Wait 4500ms after banner appears                           | `.trade-notification` element is no longer visible |
