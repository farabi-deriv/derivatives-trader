# Notifications Journey Coverage

**Analysis date:** 2026-06-11

---

## Section 1 — Coverage at a Glance

| #      | Journey                                               | Desktop | Mobile | Notes                                                     |
| ------ | ----------------------------------------------------- | ------- | ------ | --------------------------------------------------------- |
| Flow 1 | Trade banner: purchase notification appears after buy | N/A     | ❌     | AppV2-only — trade banner renders on mobile viewport only |
| Flow 2 | Trade banner: sell notification appears after close   | N/A     | ❌     | AppV2-only — trade banner renders on mobile viewport only |
| Flow 3 | Bell opens notification centre dialog                 | ❌      | N/A    | Desktop: inline CSSTransition dropdown                    |
| Flow 4 | Bell opens notification centre modal                  | N/A     | ❌     | Mobile: MobileDialog component                            |
| Flow 5 | Notification centre shows empty state                 | ❌      | ❌     | Requires cleared notifications                            |
| Flow 6 | Notification centre lists items and Clear All enabled | ❌      | ❌     | Requires account with notifications                       |
| Flow 7 | Clear All removes all notifications                   | ❌      | ❌     | Requires account with notifications                       |
| G1     | Bell icon absent from DTrader trade page              | ❌      | ❌     | Negative assertion — confirms no bell on `/`              |
| G2     | Trade banner uses CSS class locator (no testid)       | N/A     | ✅     | Verifies CSS fallback works; mobile only                  |

---

## Section 2 — Gaps

| Gap | Description                                                                                                                                                                                     | Proposed spec file                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| G1  | No bell icon or notification toggle is rendered in the DTrader trade page sidebar or mobile bottom nav — confirm via negative assertion.                                                        | `notifications/verify-no-bell-on-trade-page.spec.ts`         |
| G2  | Trade banner container has no `data-testid` — CSS class selectors (`.trade-notification--purchase`, `.trade-notification`) must be used; this gap verifies the fallback locator strategy works. | `notifications/verify-trade-banner-locator-fallback.spec.ts` |

> Step-by-step test cases for each gap: [`flow.md — Gap Flows`](./flow.md#gap-flows)

---

## Section 3 — Priority List

| Priority | Spec file                                                    | Flow   | Reason                                                                  |
| -------- | ------------------------------------------------------------ | ------ | ----------------------------------------------------------------------- |
| P0       | `notifications/verify-trade-banner-purchase.spec.ts`         | Flow 1 | Most visible user feedback after a purchase — regression if broken      |
| P0       | `notifications/verify-notification-centre-desktop.spec.ts`   | Flow 3 | Core bell → dialog open/close on desktop                                |
| P0       | `notifications/verify-notification-centre-mobile.spec.ts`    | Flow 4 | Core bell → modal on mobile                                             |
| P1       | `notifications/verify-trade-banner-sell.spec.ts`             | Flow 2 | Sell banner confirms close feedback path                                |
| P1       | `notifications/verify-notification-centre-empty.spec.ts`     | Flow 5 | Empty state is the default for new accounts; must render correctly      |
| P1       | `notifications/verify-notification-centre-clear-all.spec.ts` | Flow 7 | Clear All is the primary destructive action in the notification centre  |
| P2       | `notifications/verify-notification-centre-list.spec.ts`      | Flow 6 | Items-present state — depends on account having notifications           |
| P3       | `notifications/verify-no-bell-on-trade-page.spec.ts`         | G1     | Architectural confirmation — low risk of regression                     |
| P3       | `notifications/verify-trade-banner-locator-fallback.spec.ts` | G2     | Validates CSS class locator strategy — useful during initial test setup |
