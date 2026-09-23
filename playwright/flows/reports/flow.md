# 📋 Reports Journey Spec — What to Test

> **Purpose:** Describes the Reports feature on `staging-dtrader.deriv.com`. Defines _what_ to verify at each step.
>
> **Feature location:**
>
> - **Desktop:** `/reports` — full-page layout with `VerticalTab` sidebar (Open positions / Trade table / Statement) on the left and route content on the right
> - **Mobile:** `/reports` — `SelectNative` dropdown at the top for tab selection; same route content below
>
> **URL:**
>
> - Both: `https://staging-dtrader.deriv.com/reports` (default tab: `/reports/positions`)
>
> **Authentication:** Required — all tests start from a logged-in state
> **Note:** Reports is accessible from the desktop sidebar via `dt_sidebar_reports` (navigates to `/reports`) or from the mobile bottom nav. The shell always renders regardless of viewport — unlike Positions, there is no redirect.

---

## Section 1 — Shared Steps

### Login and Navigate to Reports Steps

> Referenced by all Flows. Provides common setup.

**Prerequisites:** Logged-in account

| # | Step | Action | Expected Result |
| --- | --- | --- | --- |
| 1 | Login | `loginPage.login()` | App loads at trade page |
| 2 | Wait for API | `NavigationUtils.waitForDerivApiSettled(page)` | WebSocket settled |
| 3 | Navigate to Reports | Click `dt_sidebar_reports` (desktop) or navigate via mobile bottom nav; use `redirectionHelpers.redirectTo(page, '/reports')` in tests | Reports shell loads at `/reports/positions` by default |
| 4 | Confirm shell | Observe page | `dt_reports_meta_wrapper` visible; page title "Reports" visible |

---

## Section 2 — Per-Flow Sections

### Flow 1 — Reports page loads with default tab (Open positions)

**Prerequisites:** Logged-in account

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Login & settle | Follow shared login steps 1–2 | Trade page visible | Both |
| 2 | Navigate to Reports | `redirectionHelpers.redirectTo(page, '/reports')` | Reports shell loads | Both |
| 3 | Confirm default tab | Observe URL and active tab | URL is `/reports/positions`; "Open positions" tab is selected (desktop: highlighted in VerticalTab sidebar; mobile: visible in SelectNative dropdown) | Both |
| 4 | Confirm meta wrapper | Observe page | `dt_reports_meta_wrapper` is visible | Both |
| 5 | Confirm page heading | Observe header | "Reports" text visible in `PageOverlay` header | Both |

---

### Flow 2 — Open Positions tab — Options contracts visible

**Prerequisites:** Logged-in account with at least one open Options contract

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to Reports | Follow shared steps 1–3 | Open positions tab active at `/reports/positions` | Both |
| 2 | Confirm filter default | Observe contract type filter | "Options" is selected by default in the contract type filter (desktop: `Dropdown`; mobile: `SelectNative`) | Both |
| 3 | Confirm contract rows | View table/list | At least one row visible in the positions table/list showing contract details | Both |
| 4 | Confirm row content | Inspect a row | Row shows contract type name, underlying symbol, and buy price/payout fields | Both |

---

### Flow 3 — Open Positions tab — switch to Multipliers filter

**Prerequisites:** Logged-in account with at least one open Multiplier contract

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to Open Positions | Follow Flow 2 steps 1–2 | Open positions tab active, "Options" selected | Both |
| 2 | Change filter to Multipliers | Select "Multipliers" from the contract type filter dropdown | Filter updates; URL or state reflects "Multipliers" selection | Both |
| 3 | Confirm Multiplier rows | View table/list | Rows visible showing Multiplier contract details | Both |
| 4 | Confirm row columns | Inspect a row | Row shows contract type, underlying, stake, current stake, and profit/loss fields | Both |

---

### Flow 4 — Open Positions tab — switch to Accumulators filter

**Prerequisites:** Logged-in account with at least one open Accumulator contract

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to Open Positions | Follow Flow 2 steps 1–2 | Open positions tab active, "Options" selected | Both |
| 2 | Change filter to Accumulators | Select "Accumulators" from the contract type filter dropdown | Filter updates | Both |
| 3 | Confirm Accumulator rows | View table/list | Rows visible showing Accumulator contract details | Both |
| 4 | Confirm growth rate sub-filter | Observe filter bar | Growth rate sub-filter visible ("All growth rates" selected by default); rates 1%–5% available as options | Both |

---

### Flow 5 — Trade Table tab loads with date filter

**Prerequisites:** Logged-in account with at least one closed/completed contract in profit table history

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to Reports | Follow shared steps 1–3 | Open positions tab active | Both |
| 2 | Switch to Trade Table | Click "Trade table" in VerticalTab (desktop) or select "Trade table" from SelectNative dropdown (mobile) | URL changes to `/reports/profit`; Trade table content loads | Both |
| 3 | Confirm meta wrapper | Observe page | `dt_reports_meta_wrapper` visible | Both |
| 4 | Confirm date filter | Observe filter bar | Calendar icon (`dt_calendar_icon`) visible; date inputs present (desktop: `dt_calendar_input_from` and `dt_calendar_input_to`; mobile: calendar sheet) | Both |
| 5 | Confirm table/list | View content | At least one data row visible with transaction date, contract details, buy/sell price, and profit/loss | Both |

---

### Flow 6 — Statement tab loads with transaction type filter

**Prerequisites:** Logged-in account with at least one statement entry (any transaction type)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to Reports | Follow shared steps 1–3 | Open positions tab active | Both |
| 2 | Switch to Statement | Click "Statement" in VerticalTab (desktop) or select "Statement" from SelectNative dropdown (mobile) | URL changes to `/reports/statement`; Statement content loads | Both |
| 3 | Confirm meta wrapper | Observe page | `dt_reports_meta_wrapper` visible | Both |
| 4 | Confirm filter bar | Observe page | Calendar icon visible; transaction type filter visible (default: "All transactions") | Both |
| 5 | Confirm table/list | View content | At least one statement row visible with date, transaction type (Buy/Sell/Deposit/Withdrawal), amount, and balance | Both |
| 6 | Change transaction type filter | Select "Buy" from the transaction type filter | Rows filtered to show only Buy transactions | Both |

---

### Flow 7 — Empty state — no trading activity (Trade Table)

**Prerequisites:** Logged-in account with no completed contracts in the profit table period

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to Trade Table | Follow Flow 5 steps 1–2 | Trade Table tab active at `/reports/profit` | Both |
| 2 | Confirm empty state | Observe content area | `dt_empty_trade_history_icon` visible; text "You have no trading activity yet." visible | Both |

> **Note:** This flow requires an account with no trade history, or can be simulated by applying a date filter that falls outside the account's history.

---

### Flow 8 — Empty state — no transactions (Statement)

**Prerequisites:** Logged-in account with no statement entries

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to Statement | Follow Flow 6 steps 1–2 | Statement tab active at `/reports/statement` | Both |
| 2 | Confirm empty state | Observe content area | `dt_empty_trade_history_icon` visible; text "You have no transactions yet." visible | Both |

> **Note:** This flow requires a fresh account with no transaction history.

---

## Gap Flows

> These are test cases for coverage gaps. The proposed spec file for each gap is in [`coverage.md`](./coverage.md).

### G1 — Navigate from Open Positions row to contract details

| # | Test case | Steps | Expected Result |
| --- | --- | --- | --- |
| 1 | Navigate to Open Positions with Options filter | Follow Flow 2 steps 1–3 | Contract rows visible |
| 2 | Click a row | Click any contract row in the Open Positions table/list | Navigates to contract details page |
| 3 | Confirm contract details | Observe page | Contract details page visible with contract information |
| 4 | Navigate back | Use browser back or back button | Returns to Reports Open Positions tab |

> **Note:** Row click navigation is only available in the Open Positions tab, not Trade Table or Statement. Verify actual testid/selector for clickable row on staging.

### G2 — Archived Statement tab (conditional on `has_archived_statement`)

| # | Test case | Steps | Expected Result |
| --- | --- | --- | --- |
| 1 | Account with archived history | Use a staging account where `client.has_archived_statement` is true | "Archived statement" option visible in Reports tab navigation |
| 2 | Navigate to Archived Statement | Click "Archived statement" in VerticalTab or select from dropdown | URL changes to `/reports/archived-statement`; Archived statement content loads |
| 3 | Confirm filter bar | Observe page | Date filter and loginid account selector visible |
| 4 | Confirm table/list | View content | At least one archived statement row visible |

> **Constraint:** Requires a specific staging account with `has_archived_statement = true`. Cannot be created programmatically — must use a pre-existing account with env var credentials.
