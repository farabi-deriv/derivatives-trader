# Notifications Journey Coverage

**Analysis date:** 2026-06-11 · **Updated:** 2026-09-11 (notification centre marked N/A — surface removed; Flows 1–2/G1 verified automated)

---

## Section 1 — Coverage at a Glance

| #      | Journey                                               | Desktop | Mobile | Notes                                                      |
| ------ | ----------------------------------------------------- | ------- | ------ | ---------------------------------------------------------- |
| Flow 1 | Trade banner: purchase notification appears after buy | N/A     | ✅     | Automated — `verify-trade-banner-purchase.spec.ts`         |
| Flow 2 | Trade banner: sell notification appears after close   | N/A     | ✅     | Automated — `verify-trade-banner-sell.spec.ts`             |
| Flow 3 | Bell opens notification centre dialog                 | N/A     | N/A    | **N/A — surface removed** (TRAH-6133, commit `1221b37030`) |
| Flow 4 | Bell opens notification centre modal                  | N/A     | N/A    | **N/A — surface removed** (see Flow 3)                     |
| Flow 5 | Notification centre shows empty state                 | N/A     | N/A    | **N/A — surface removed** (see Flow 3)                     |
| Flow 6 | Notification centre lists items and Clear All enabled | N/A     | N/A    | **N/A — surface removed** (see Flow 3)                     |
| Flow 7 | Clear All removes all notifications                   | N/A     | N/A    | **N/A — surface removed** (see Flow 3)                     |
| G1     | Bell icon absent from DTrader trade page              | ✅      | ✅     | Automated — `verify-no-bell-on-trade-page.spec.ts`         |
| G2     | Trade banner uses CSS class locator (no testid)       | N/A     | ✅     | Automated — `verify-trade-banner-locator-fallback.spec.ts` |

> **Notification centre (Flows 3–7): N/A, not a gap.** The bell entry point (`ShowNotifications`) lost its last host in commit `1221b37030` (TRAH-6133, 2025-06-19); no route renders it, so the dialog behind it is unreachable. `show-notifications.tsx`, `toggle-notifications.jsx`, and `NotificationsDialog/` are dead app code. Do **not** plan specs for Flows 3–7 unless the app team re-adds the bell — treat these rows as retired, not as gaps to fill.

---

## Section 2 — Gaps

**None open.** G1 and G2 are both automated (`verify-no-bell-on-trade-page.spec.ts`, `verify-trade-banner-locator-fallback.spec.ts`), and the only previously-proposed gap specs that remain unimplemented — the notification-centre files below — are **cancelled** because the surface was removed (see the Section 1 note).

> Step-by-step test cases for the retired gaps: [`flow.md — Gap Flows`](./flow.md#gap-flows)

---

## Section 3 — Priority List

All previously-listed notification-centre priorities (Flows 3–7) are **withdrawn** — the surface is unreachable. What remains:

| Priority | Spec file                                                    | Flow   | Status       | Reason                                                                   |
| -------- | ------------------------------------------------------------ | ------ | ------------ | ------------------------------------------------------------------------ |
| P0       | `notifications/verify-trade-banner-purchase.spec.ts`         | Flow 1 | ✅ Automated | Most visible user feedback after a purchase — regression if broken       |
| P1       | `notifications/verify-trade-banner-sell.spec.ts`             | Flow 2 | ✅ Automated | Sell banner confirms close feedback path                                 |
| P3       | `notifications/verify-no-bell-on-trade-page.spec.ts`         | G1     | ✅ Automated | Architectural confirmation — stays relevant while the bell stays removed |
| P3       | `notifications/verify-trade-banner-locator-fallback.spec.ts` | G2     | ✅ Automated | Validates CSS class locator strategy                                     |

~~`verify-notification-centre-desktop.spec.ts` / `-mobile.spec.ts` / `-empty.spec.ts` / `-list.spec.ts` / `-clear-all.spec.ts`~~ — **cancelled (N/A, surface removed; see Section 1).**
