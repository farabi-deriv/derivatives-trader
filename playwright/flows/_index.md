# Flow Document Index

Master tracking file for all Playwright journey flow documents in `derivatives-trader`.
This folder contains plain-English journey specifications, coverage scorecards, and technical catalogs for every feature area tested in this project.

Updated when new flows are added, tests are implemented, or coverage status changes.

Last updated: 2026-09-01

---

## How to Read This File

Each module section lists every documented flow with its current **status** and **priority**.

### Status Values

| Status       | Meaning                                                             |
| ------------ | ------------------------------------------------------------------- |
| `documented` | `flow.md` + `catalog.md` + `coverage.md` exist; no test written yet |
| `automated`  | Playwright spec file exists in `playwright/tests/` and runs in CI   |

### Priority Values

| Priority | Meaning                                                      |
| -------- | ------------------------------------------------------------ |
| `P0`     | Blocking — must pass before any release                      |
| `P1`     | High — critical user path; implement next sprint             |
| `P2`     | Medium — important but not blocking                          |
| `P3`     | Low — nice-to-have or edge case                              |
| `N/A`    | Not automatable (e.g. SmartCharts canvas, real money trades) |

---

## Coverage Summary

| Module             | Total Flows | Documented | Automated |
| ------------------ | ----------- | ---------- | --------- |
| `trade`            | 34          | 34         | 29        |
| `positions`        | 11          | 11         | 0         |
| `reports`          | 8           | 8          | 0         |
| `notifications`    | 9           | 9          | 0         |
| `auth`             | 3           | 3          | 3         |
| `trade-automate`   | 26          | 26         | 23        |
| `feed`             | 1           | 1          | 1         |
| `market-selection` | 25          | 25         | 24        |
| **Total**          | **117**     | **117**    | **80**    |

> Status advances: `documented` → `automated`

---

## Module: `trade` — Trade Form

**Flow docs:** `playwright/flows/trade/` · **Test folder:** `playwright/tests/trade/`

| Flow      | Priority | Description                                                | User State                   | Status       |
| --------- | -------- | ---------------------------------------------------------- | ---------------------------- | ------------ |
| Flow 1    | P0       | Trade form loads with default state visible                | authenticated                | `automated`  |
| Flow 2.1  | P0       | Rise/Fall — buy Rise → close                               | authenticated, funded        | `automated`  |
| Flow 2.2  | P0       | Rise/Fall — buy Fall → close                               | authenticated, funded        | `automated`  |
| Flow 2.3  | P2       | Rise/Fall Allow Equals — buy Rise → close                  | authenticated, funded        | `automated`  |
| Flow 2.4  | P2       | Rise/Fall Allow Equals — buy Fall → close                  | authenticated, funded        | `automated`  |
| Flow 3.1  | P1       | Higher/Lower — buy Higher → close                          | authenticated, funded        | `automated`  |
| Flow 3.2  | P1       | Higher/Lower — buy Lower → close                           | authenticated, funded        | `automated`  |
| Flow 4.1  | P2       | Touch/No Touch — buy Touch → close                         | authenticated, funded        | `automated`  |
| Flow 4.2  | P2       | Touch/No Touch — buy No Touch → close                      | authenticated, funded        | `automated`  |
| Flow 5.1  | P0       | Matches/Differs — buy Matches → expiry                     | authenticated, funded        | `automated`  |
| Flow 5.2  | P0       | Matches/Differs — buy Differs → expiry                     | authenticated, funded        | `automated`  |
| Flow 6.1  | P2       | Over/Under — buy Over → expiry                             | authenticated, funded        | `automated`  |
| Flow 6.2  | P2       | Over/Under — buy Under → expiry                            | authenticated, funded        | `automated`  |
| Flow 7.1  | P2       | Even/Odd — buy Even → expiry                               | authenticated, funded        | `automated`  |
| Flow 7.2  | P2       | Even/Odd — buy Odd → expiry                                | authenticated, funded        | `automated`  |
| Flow 8.1  | P0       | Accumulators without TP — buy → close                      | authenticated, funded        | `automated`  |
| Flow 8.2  | P0       | Accumulators with TP — buy → verify TP set → close         | authenticated, funded        | `automated`  |
| Flow 9.1  | P0       | Multipliers no TP/SL — buy Up → close                      | authenticated, funded        | `automated`  |
| Flow 9.2  | P0       | Multipliers no TP/SL — buy Down → close                    | authenticated, funded        | `automated`  |
| Flow 9.3  | P0       | Multipliers with TP — buy Up → close                       | authenticated, funded        | `automated`  |
| Flow 9.4  | P0       | Multipliers with TP — buy Down → close                     | authenticated, funded        | `automated`  |
| Flow 9.5  | P1       | Multipliers with SL — buy Up → close                       | authenticated, funded        | `automated`  |
| Flow 9.6  | P1       | Multipliers with SL — buy Down → close                     | authenticated, funded        | `automated`  |
| Flow 9.7  | P2       | Multipliers with Deal Cancellation — buy Up → cancel       | authenticated, funded        | `documented` |
| Flow 9.8  | P2       | Multipliers with Deal Cancellation — buy Down → cancel     | authenticated, funded        | `documented` |
| Flow 10.1 | P1       | Turbos without TP — buy Up → verify in positions           | authenticated, funded        | `automated`  |
| Flow 10.2 | P1       | Turbos without TP — buy Down → verify in positions         | authenticated, funded        | `automated`  |
| Flow 10.3 | P1       | Turbos with TP — buy Up → verify TP set in positions       | authenticated, funded        | `automated`  |
| Flow 10.4 | P1       | Turbos with TP — buy Down → verify TP set in positions     | authenticated, funded        | `automated`  |
| Flow 11.1 | P1       | Vanillas — buy Call → close contract                       | authenticated, funded        | `automated`  |
| Flow 11.2 | P1       | Vanillas — buy Put → close contract                        | authenticated, funded        | `automated`  |
| Flow 12   | P2       | Market closed → purchase hidden, countdown visible         | authenticated, closed market | `documented` |
| —         | P2       | Insufficient balance → ServiceErrorSheet (G1)              | authenticated, zero balance  | `documented` |
| —         | P3       | Unauthenticated purchase attempt → login prompt sheet (G2) | unauthenticated              | `documented` |

---

## Module: `positions` — Open & Closed Positions

**Flow docs:** `playwright/flows/positions/` · **Test folder:** `playwright/tests/positions/`

| Flow   | Priority | Description                                                                | User State                                                 | Status       |
| ------ | -------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------ |
| Flow 1 | P0       | Open positions list loads (mobile full-page route)                         | authenticated, has open contracts (mobile)                 | `documented` |
| Flow 2 | P0       | Open positions list loads (desktop sidebar flyout)                         | authenticated, has open contracts (desktop)                | `documented` |
| Flow 3 | P2       | Empty state when no open contracts                                         | authenticated, no open contracts (mobile)                  | `documented` |
| Flow 4 | P1       | Closed positions tab shows contracts grouped by date                       | authenticated, has closed contracts (mobile)               | `documented` |
| Flow 5 | P2       | Filter open positions by trade type                                        | authenticated, multiple open contracts (mobile)            | `documented` |
| Flow 6 | P2       | Filter closed positions by time range                                      | authenticated, closed contracts on multiple dates (mobile) | `documented` |
| Flow 7 | P1       | Navigate from positions card to contract details                           | authenticated, has open contracts (mobile)                 | `documented` |
| —      | P1       | Close open contract from positions list (swipe + Close button) (G1)        | authenticated, has open contracts (mobile)                 | `documented` |
| —      | P2       | Cancel open multiplier with Deal Cancellation (swipe + Cancel button) (G2) | authenticated, funded multiplier open (mobile)             | `documented` |
| —      | P3       | Empty state on Closed tab (no contract history) (G3)                       | authenticated, no contract history (mobile)                | `documented` |
| —      | P3       | Filter yields no matches on open positions (G4)                            | authenticated, open contracts (mobile)                     | `documented` |

---

## Module: `reports` — Reports

**Flow docs:** `playwright/flows/reports/` · **Test folder:** `playwright/tests/reports/`

| Flow   | Priority | Description                                                           | User State                                    | Status       |
| ------ | -------- | --------------------------------------------------------------------- | --------------------------------------------- | ------------ |
| Flow 1 | P0       | Reports page loads with default tab (Open positions)                  | authenticated                                 | `documented` |
| Flow 2 | P1       | Open Positions tab — Options contracts visible                        | authenticated, has open Options contracts     | `documented` |
| Flow 3 | P2       | Open Positions tab — Multipliers filter                               | authenticated, has open Multiplier contracts  | `documented` |
| Flow 4 | P2       | Open Positions tab — Accumulators filter + growth rate sub-filter     | authenticated, has open Accumulator contracts | `documented` |
| Flow 5 | P0       | Trade Table tab loads with date filter and data rows                  | authenticated, has closed contract history    | `documented` |
| Flow 6 | P0       | Statement tab loads with transaction type filter                      | authenticated, has statement entries          | `documented` |
| Flow 7 | P2       | Empty state — no trading activity (Trade Table)                       | authenticated, no trade history               | `documented` |
| Flow 8 | P2       | Empty state — no transactions (Statement)                             | authenticated, no statement history           | `documented` |
| —      | P1       | Navigate from Open Positions row to contract details (G1)             | authenticated, has open Options contracts     | `documented` |
| —      | P3       | Archived Statement tab (conditional on `has_archived_statement`) (G2) | authenticated, account with archived history  | `documented` |

---

## Module: `notifications` — Notifications

**Flow docs:** `playwright/flows/notifications/` · **Test folder:** `playwright/tests/notifications/`

| Flow   | Priority | Description                                                  | User State                       | Status       |
| ------ | -------- | ------------------------------------------------------------ | -------------------------------- | ------------ |
| Flow 1 | P0       | Trade banner: purchase notification appears after buy        | authenticated, funded (mobile)   | `documented` |
| Flow 2 | P1       | Trade banner: sell notification appears after contract close | authenticated, funded (mobile)   | `documented` |
| Flow 3 | P0       | Bell opens notification centre dialog (desktop)              | authenticated                    | `documented` |
| Flow 4 | P0       | Bell opens notification centre modal (mobile)                | authenticated                    | `documented` |
| Flow 5 | P1       | Notification centre shows empty state                        | authenticated                    | `documented` |
| Flow 6 | P2       | Notification centre lists items and Clear All enabled        | authenticated, has notifications | `documented` |
| Flow 7 | P1       | Clear All removes all notifications                          | authenticated, has notifications | `documented` |
| —      | P3       | Bell icon absent from DTrader trade page (G1)                | authenticated                    | `documented` |
| —      | P3       | Trade banner CSS class locator fallback verified (G2)        | authenticated, funded (mobile)   | `documented` |

---

## Module: `auth` — Login / Authentication

**Flow docs:** `playwright/flows/auth/` · **Test folder:** `playwright/tests/auth/`

| Flow   | Priority | Description                                                                            | User State      | Status       |
| ------ | -------- | -------------------------------------------------------------------------------------- | --------------- | ------------ |
| Flow 1 | P0       | Email + Password Login → account info + balance visible on dtrader                     | unauthenticated | `automated`  |
| Flow 2 | P0       | OTP Login → account info + balance visible on dtrader                                  | unauthenticated | `automated`  |
| Flow 3 | P1       | Logout → success modal → session cleared (desktop: sidebar; mobile: bottom nav menu)   | authenticated   | `automated`  |
| —      | N/A      | Full OAuth round-trip via dtrader "Log in" button — cross-origin, not automatable (G1) | unauthenticated | `documented` |

---

## Module: `trade-automate` — Automated Trading

**Flow docs:** `playwright/flows/trade-automate/` · **Test folder:** `playwright/tests/trade-automate/` (Flows 2–3 panel specs · Flows 5–9 Martingale · Flows 10–14 D'Alembert)

| Flow      | Priority | Description                                                                          | User State                                     | Status       |
| --------- | -------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------ |
| Flow 1    | P1       | Pause and Resume a running automation (embedded in Flows 5–14)                       | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 2    | P1       | Risk threshold auto-stop (loss/profit threshold)                                     | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 3    | P2       | Resync after account switch (stays Running) — `verify-account-switch-resync.spec.ts` | authenticated, funded real/staging, 2 accounts | `automated`  |
| Flow 4    | P3       | Automation unavailable for EU account (gating)                                       | authenticated, EU/DIEL account                 | `documented` |
| Flow 5.1  | P0       | Rise/Fall — Martingale Rise (demo + real)                                            | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 5.2  | P0       | Rise/Fall — Martingale Fall (demo + real)                                            | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 6.1  | P1       | Accumulators — Martingale demo                                                       | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 6.2  | P1       | Accumulators — Martingale real                                                       | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 7.1  | P1       | Matches/Differs — Martingale Matches (demo + real)                                   | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 7.2  | P1       | Matches/Differs — Martingale Differs (demo + real)                                   | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 8.1  | P1       | Over/Under — Martingale Over (demo + real)                                           | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 8.2  | P1       | Over/Under — Martingale Under (demo + real)                                          | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 9.1  | P1       | Even/Odd — Martingale Even (demo + real)                                             | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 9.2  | P1       | Even/Odd — Martingale Odd (demo + real)                                              | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 10.1 | P1       | Rise/Fall — D'Alembert Rise (demo + real)                                            | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 10.2 | P1       | Rise/Fall — D'Alembert Fall (demo + real)                                            | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 11.1 | P1       | Accumulators — D'Alembert demo                                                       | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 11.2 | P1       | Accumulators — D'Alembert real                                                       | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 12.1 | P1       | Matches/Differs — D'Alembert Matches (demo + real)                                   | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 12.2 | P1       | Matches/Differs — D'Alembert Differs (demo + real)                                   | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 13.1 | P1       | Over/Under — D'Alembert Over (demo + real)                                           | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 13.2 | P1       | Over/Under — D'Alembert Under (demo + real)                                          | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 14.1 | P1       | Even/Odd — D'Alembert Even (demo + real)                                             | authenticated, funded real/staging (non-EU)    | `automated`  |
| Flow 14.2 | P1       | Even/Odd — D'Alembert Odd (demo + real)                                              | authenticated, funded real/staging (non-EU)    | `automated`  |
| —         | P2       | "Automation already running" adoption snackbar (G1)                                  | authenticated, run active                      | `documented` |
| —         | P2       | Validation / unsupported-contract-type error (G2)                                    | authenticated, funded real/staging (non-EU)    | `documented` |

---

---

## Module: `feed` — Live Price Feed

**Flow docs:** `playwright/flows/feed/` · **Test folder:** `playwright/tests/feed/`

| Flow   | Priority | Description                                                                                                                    | User State      | Status      |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------- | ----------- |
| Flow 1 | P0       | All markets: feed active or closed state correct for every market (~65 symbols, desktop + mobile; open/session_gated branches) | unauthenticated | `automated` |

---

## Module: `market-selection` — Market Selection & Trade Tabs

**Flow docs:** `playwright/flows/market-selection/` · **Test folder:** `playwright/tests/market-selection/`

| Flow    | Priority | Description                                                          | User State            | Status       |
| ------- | -------- | -------------------------------------------------------------------- | --------------------- | ------------ |
| Flow 1  | P1       | Add market opens the picker as a new-tab flow                        | unauthenticated       | `automated`  |
| Flow 2  | P1       | Clicking the active tab replaces it instead of adding a new one      | unauthenticated       | `automated`  |
| Flow 3  | P1       | Trade-type navigation lists the same set on both platforms           | unauthenticated       | `automated`  |
| Flow 4  | P1       | Switching trade type reloads the list to only tradeable symbols      | unauthenticated       | `automated`  |
| Flow 5  | P1       | Asset-class category filter chips scope the list                     | unauthenticated       | `automated`  |
| Flow 6  | P1       | Time-window dropdown is always present in the category list          | unauthenticated       | `automated`  |
| Flow 7  | P2       | Market Info screen                                                   | unauthenticated       | `automated`  |
| Flow 8  | P0       | Search by market name                                                | unauthenticated       | `automated`  |
| Flow 9  | P0       | Search with no matches                                               | unauthenticated       | `automated`  |
| Flow 10 | P2       | Favourite toggle from the browse list                                | unauthenticated       | `automated`  |
| Flow 11 | P2       | Favourites persist across a page reload                              | unauthenticated       | `automated`  |
| Flow 12 | P3       | Guide affordance opens the trade-type description modal              | unauthenticated       | `automated`  |
| Flow 13 | P1       | Close without selecting                                              | unauthenticated       | `automated`  |
| Flow 14 | P0       | Switch between existing tabs                                         | unauthenticated       | `automated`  |
| Flow 15 | P0       | Re-selecting an already-open pair focuses the existing tab           | unauthenticated       | `automated`  |
| Flow 16 | P0       | Same market, different trade type are independent tabs               | unauthenticated       | `automated`  |
| Flow 17 | P0       | Remove a non-active tab                                              | unauthenticated       | `automated`  |
| Flow 18 | P0       | Remove the active tab falls back to an adjacent tab                  | unauthenticated       | `automated`  |
| Flow 19 | P0       | Remove the last remaining tab is blocked                             | unauthenticated       | `automated`  |
| Flow 20 | P0       | Tab strip scroll and active/inactive tab sizing                      | unauthenticated       | `automated`  |
| Flow 21 | P2       | Tabs persist across page reload                                      | unauthenticated       | `automated`  |
| Flow 22 | P1       | Buy always targets the active tab's pair                             | authenticated, funded | `automated`  |
| Flow 23 | P0       | Tab icon reflects its own market                                     | unauthenticated       | `automated`  |
| Flow 24 | P0       | Max tab limit enforced (4 mobile / 7 desktop)                        | unauthenticated       | `automated`  |
| —       | —        | No trade parameter is tab-scoped except (symbol, contract_type) (G1) | unauthenticated       | `documented` |

---

## Implementation Priority Order

| Priority | Module             | Key Flows to Implement First                                                        |
| -------- | ------------------ | ----------------------------------------------------------------------------------- |
| **Now**  | `trade`            | Flow 9.7/9.8 (Deal Cancellation)                                                    |
| **Now**  | `positions`        | Flow 1 (open positions mobile), Flow 2 (desktop flyout)                             |
| **Next** | `reports`          | Flow 1 (page load), Flow 5 (Trade Table), Flow 6 (Statement)                        |
| **Next** | `notifications`    | Flow 3 (bell → dialog desktop), Flow 4 (bell → modal mobile), Flow 1 (trade banner) |
| **Soon** | `trade-automate`   | Flow 4 (EU gating) + G1 (already-running snackbar) + G2 (validation)                |
| **Done** | `market-selection` | Flows 1–24 automated; G1 remains a product gap (tab-scoped params not built yet)    |

---

## How to Update This File

Ask AI to sync this file using `_orchestrator.md`:

```
Follow _orchestrator.md and sync _index.md.
```

AI will read all `coverage.md` files and `playwright/tests/` spec files, compute what's out of sync, and apply the correct edits. See `playwright/flows/_orchestrator.md` for the full instruction set.

---

## File Reference

| Module           | flow.md                          | catalog.md                             | coverage.md                              |
| ---------------- | -------------------------------- | -------------------------------------- | ---------------------------------------- |
| trade            | [flow](trade/flow.md)            | [catalog](trade/catalog.md)            | [coverage](trade/coverage.md)            |
| positions        | [flow](positions/flow.md)        | [catalog](positions/catalog.md)        | [coverage](positions/coverage.md)        |
| reports          | [flow](reports/flow.md)          | [catalog](reports/catalog.md)          | [coverage](reports/coverage.md)          |
| notifications    | [flow](notifications/flow.md)    | [catalog](notifications/catalog.md)    | [coverage](notifications/coverage.md)    |
| auth             | [flow](auth/flow.md)             | [catalog](auth/catalog.md)             | [coverage](auth/coverage.md)             |
| trade-automate   | [flow](trade-automate/flow.md)   | [catalog](trade-automate/catalog.md)   | [coverage](trade-automate/coverage.md)   |
| feed             | [flow](feed/flow.md)             | [catalog](feed/catalog.md)             | [coverage](feed/coverage.md)             |
| market-selection | [flow](market-selection/flow.md) | [catalog](market-selection/catalog.md) | [coverage](market-selection/coverage.md) |
