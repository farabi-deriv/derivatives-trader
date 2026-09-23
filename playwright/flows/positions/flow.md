# 📋 Positions Journey Spec — What to Test

> **Purpose:** Describes the Positions feature on `staging-dtrader.deriv.com`. Defines _what_ to verify at each step.
>
> **Feature location:**
>
> - **Desktop:** Sidebar flyout — click the Positions icon in the left sidebar to open a drawer showing open contracts
> - **Mobile:** Full-page `/positions` route with "Open" and "Closed" tabs
>
> **URL:**
>
> - Desktop: `https://staging-dtrader.deriv.com/` (positions accessed via sidebar flyout)
> - Mobile: `https://staging-dtrader.deriv.com/positions` (routed by `PositionsSwitch`)
>
> **Authentication:** Required — all tests start from a logged-in state
> **Note:** `PositionsSwitch` redirects desktop users to `/` — the `/positions` route only renders the full-page UI on mobile (`isMobile` guard in `PositionsSwitch.tsx`).

---

## Section 1 — Shared Steps

### Login and Navigate to Positions Steps

> Referenced by Flows 1–11. Provides common setup.

**Prerequisites:** Logged-in account with at least one open position (or none for empty-state flows)

| # | Step | Action | Expected Result |
| --- | --- | --- | --- |
| 1 | Login | `loginPage.login()` | App loads at trade page |
| 2 | Wait for API | `NavigationUtils.waitForDerivApiSettled(page)` | WebSocket settled, trade container visible |

---

## Section 2 — Per-Flow Sections

### Flow 1 — Open positions list loads on mobile

**Prerequisites:** Logged-in account; at least one open contract

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Login & settle | Follow shared login steps | Trade page visible | Mobile |
| 2 | Navigate | Navigate to `/positions` via `redirectionHelpers.redirectTo(page, '/positions')` | Positions page loads | Mobile |
| 3 | Confirm tab | Observe page | "Open" tab is active by default | Mobile |
| 4 | Confirm cards | View contract cards | At least one `dt_contract_card` element visible | Mobile |
| 5 | Confirm P/L summary | View top of page | `dt_total_profit_loss` element visible showing total P/L with currency | Mobile |

---

### Flow 2 — Open positions list loads on desktop (sidebar flyout)

**Prerequisites:** Logged-in account; at least one open contract

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Login & settle | Follow shared login steps | Trade page visible | Desktop |
| 2 | Click positions icon | Click `dt_sidebar_positions` in the left sidebar | Sidebar flyout opens with title "Open positions" | Desktop |
| 3 | Confirm cards | View flyout content | At least one `dt_contract_card` visible inside the flyout | Desktop |
| 4 | Confirm footer | View flyout footer | Position count text ("N open position(s)") and "Total P/L:" amount visible | Desktop |

---

### Flow 3 — Empty open positions state

**Prerequisites:** Logged-in account with no open contracts (close any open contracts first if the shared inbox has positions)

**Spec:** `verify-positions-empty-states.spec.ts` — also covers issue **#1036** (dark-theme empty-state icon contrast) in the same test via a second step.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Login & settle | Follow shared login steps | Trade page visible | Mobile |
| 2 | Navigate to positions | Navigate to `/positions` | Positions page loads on Open tab | Mobile |
| 3 | Ensure empty Open tab | `positionsPage.ensureEmptyOpenPositionsTab()` — close any open contracts if present | No `dt_contract_card` on Open tab | Mobile |
| 4 | Confirm empty state (light) | `positionsPage.verifyEmptyOpenPositionsState()` | `dt_empty_state_icon` visible; "No open positions"; "Your active trades will appear here."; "Start trading" button visible | Mobile |
| 5 | Switch to dark theme | `TradeBasePage.seedDarkThemePreference(page)` → reload → navigate to `/positions` → re-ensure empty | `body.theme--dark` applied | Mobile |
| 6 | Confirm icon in dark mode | View empty state | `dt_empty_state_icon` remains visible with sufficient contrast (#1036) | Mobile |

---

### Flow 4 — Closed positions tab loads with date sections

**Prerequisites:** Logged-in account with at least one closed contract in history

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Login & settle | Follow shared login steps | Trade page visible | Mobile |
| 2 | Navigate to positions | Navigate to `/positions` | Positions page loads on Open tab | Mobile |
| 3 | Switch to Closed tab | Click the "Closed" tab | Closed tab becomes active | Mobile |
| 4 | Wait for load | Observe page | Contract cards appear grouped under date section headings (e.g. "11 Jun 2026") | Mobile |
| 5 | Confirm P/L summary | View bottom of list | `dt_total_profit_loss` element visible at bottom showing "Last N contracts:" summary | Mobile |

---

### Flow 5 — Filter open positions by trade type

**Prerequisites:** Logged-in account with multiple open contracts of different trade types

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to Open tab | Follow Flow 1 steps 1–4 | Contract cards visible | Mobile |
| 2 | Open filter | Click "Trade types" chip | Filter action sheet opens with title "Filter by trade types" | Mobile |
| 3 | Select a trade type | Check one trade type checkbox (e.g. "Rise/Fall") | Checkbox becomes checked | Mobile |
| 4 | Apply filter | Click "Apply" button | Action sheet closes; only contracts matching selected trade type visible; chip shows count "(1)" | Mobile |
| 5 | Clear filter | Click "Trade types (1)" chip → click "Clear All" → click "Apply" | All contracts visible again; chip returns to unselected state | Mobile |

---

### Flow 6 — Filter closed positions by time

**Prerequisites:** Logged-in account with closed contracts on multiple dates

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to Closed tab | Follow Flow 4 steps 1–3 | Closed tab active with contracts | Mobile |
| 2 | Open time filter | Click the time filter chip (label "All time" or date range) | Time filter action sheet opens with title "Filter by time" | Mobile |
| 3 | Select time range | Select "Today" radio option | Action sheet closes; only today's closed contracts visible | Mobile |
| 4 | Confirm filter applied | Observe chip | Time chip shows "Today" and is highlighted/selected | Mobile |
| 5 | Reset filter | Open time filter → click "Reset" | All closed contracts visible; chip returns to default state | Mobile |

---

### Flow 7 — Navigate from open position card to contract details

**Prerequisites:** Logged-in account with at least one open contract

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to Open tab | Follow Flow 1 steps 1–4 | Contract cards visible | Mobile |
| 2 | Click a contract card | Click any `dt_contract_card` | Navigates to contract details page | Mobile |
| 3 | Confirm contract details | View page | Header shows "Contract details" text; `dt_contract_card` visible in details view | Mobile |
| 4 | Navigate back | Click the back arrow icon | Returns to positions page | Mobile |
| 5 | Confirm return | View page | Positions page visible with contract cards | Mobile |

---

### Flow 8 — Close open contract from positions card (swipe action)

**Prerequisites:** Logged-in account with at least one open contract

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to Open tab | Follow Flow 1 steps 1–4 | Contract card visible | Mobile |
| 2 | Swipe to reveal Close button | Swipe left on a contract card | Close button appears on the right side of the card | Mobile |
| 3 | Click Close | Click the Close button | Loading spinner (`dt_button_loader`) appears; contract card animates out of list | Mobile |
| 4 | Confirm removal | Observe positions list | Contract removed from Open positions list | Mobile |

---

### Flow 9 — Cancel open multiplier contract from positions card (swipe action)

**Prerequisites:** Logged-in account with an open multiplier contract that has Deal Cancellation enabled

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Open a multiplier position | Buy a multiplier contract with Deal Cancellation enabled | Contract card shows "DC" risk label | Mobile |
| 2 | Navigate to Open tab | Navigate to `/positions` | Multiplier contract card visible | Mobile |
| 3 | Swipe to reveal Cancel button | Swipe left on the multiplier contract card | Both "Cancel" (with remaining time) and "Close" buttons appear | Mobile |
| 4 | Click Cancel | Click the "Cancel" button while profit is negative | Loading spinner (`dt_button_loader`) appears; cancellation executed | Mobile |
| 5 | Confirm cancellation | Observe positions list | Contract removed from Open positions list | Mobile |

---

### Flow 10 — Empty closed positions state

**Prerequisites:** Account with no closed positions in history — **fresh account** via `createAccountV2viaJS` on staging (cannot share the Open-tab inbox used by Flow 3)

**Spec:** `verify-positions-empty-states.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Create / login | Fresh account on staging (`createAccountV2viaJS`) or production creds | Logged in with empty closed history | Mobile |
| 2 | Navigate to Closed tab | Navigate to `/positions`; click Closed tab; wait for API settled | Closed tab active | Mobile |
| 3 | Confirm empty state | `positionsPage.verifyEmptyClosedPositionsState()` | `dt_empty_state_icon` visible; "No closed positions"; "Your closed positions will be shown here." visible | Mobile |

---

### Flow 11 — Filter yields no matches (open positions)

**Prerequisites:** Logged-in account with open contracts of only one trade type

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to Open tab | Follow Flow 1 steps 1–4 | Contracts visible | Mobile |
| 2 | Apply mismatching filter | Open Trade types filter; select a trade type with no matching positions | Action sheet closes | Mobile |
| 3 | Confirm no-matches state | Observe page | `dt_empty_state_icon` visible; text "No matches found" visible; text "Try changing or removing filters to view available positions." visible | Mobile |
