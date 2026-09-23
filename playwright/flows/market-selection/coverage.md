# Market Selection & Trade Tabs Journey Coverage

**Analysis date:** 2026-08-06 · **Last updated:** 2026-09-15 (Flow 7 description matrix)

---

## Section 1 — Coverage at a Glance

| #       | Journey                                                               | Desktop | Mobile | Notes                                                    |
| ------- | --------------------------------------------------------------------- | ------- | ------ | -------------------------------------------------------- |
| Flow 1  | Add market opens the picker as a new-tab flow                         | ✅      | ✅     |                                                          |
| Flow 2  | Clicking the active tab replaces it instead of adding a new one       | ✅      | ✅     |                                                          |
| Flow 3  | Trade-type navigation lists the same set on both platforms            | ✅      | ✅     |                                                          |
| Flow 4  | Switching trade type reloads the list to only tradeable symbols       | ✅      | ✅     |                                                          |
| Flow 5  | Asset-class category filter chips scope the list                      | ✅      | ✅     |                                                          |
| Flow 6  | Time-window dropdown is always present in the category list           | ✅      | ✅     |                                                          |
| Flow 7  | Market Info screen (descriptions matrix, Trade-on, Favourite, Back)   | ✅      | ✅     | `verify-market-info-screen.spec.ts` — 75 symbols (#1029) |
| Flow 8  | Search by market name                                                 | ✅      | ✅     |                                                          |
| Flow 9  | Search with no matches                                                | ✅      | ✅     |                                                          |
| Flow 10 | Favourite toggle from the browse list                                 | ✅      | ✅     |                                                          |
| Flow 11 | Favourites persist across a page reload                               | ✅      | ✅     |                                                          |
| Flow 12 | Guide affordance opens the trade-type description modal               | ✅      | ✅     |                                                          |
| Flow 13 | Close without selecting                                               | ✅      | ✅     |                                                          |
| Flow 14 | Switch between existing tabs                                          | ✅      | ✅     |                                                          |
| Flow 15 | Re-selecting an already-open pair focuses the existing tab            | ✅      | ✅     |                                                          |
| Flow 16 | Same market, different trade type are independent tabs                | ✅      | ✅     |                                                          |
| Flow 17 | Remove a non-active tab                                               | ✅      | ✅     |                                                          |
| Flow 18 | Remove the active tab falls back to an adjacent tab                   | ✅      | ✅     |                                                          |
| Flow 19 | Remove the last remaining tab is blocked                              | ✅      | ✅     |                                                          |
| Flow 20 | Tab strip scroll and active/inactive tab sizing                       | ✅      | ✅     |                                                          |
| Flow 21 | Tabs persist across page reload                                       | ✅      | ✅     |                                                          |
| Flow 22 | Buy always targets the active tab's pair                              | ✅      | ✅     |                                                          |
| Flow 23 | Tab icon reflects its own market                                      | ✅      | ✅     |                                                          |
| Flow 24 | Max tab limit enforced (4 mobile / 7 desktop)                         | ✅      | ✅     |                                                          |
| Flow 25 | Trade params (stake + duration) persist per tab across reload (#1186) | ✅      | ✅     | Promoted from former G1                                  |
| G2      | Active tab's chevron cue marks it as the picker trigger               | ❌      | ❌     | New affordance (2026-08-17) — not yet asserted           |

---

## Section 2 — Gaps

| Gap | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Proposed spec file                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G2  | The active tab's chevron cue (`dt_market_tab_chevron`) — present only where the tap opens the picker (the active tab, and not while an automation run locks the strip), absent on inactive/disabled tabs — plus the `aria-haspopup="dialog"` / `aria-label` affordance on the tab root. Unit-covered in `market-tab.spec.tsx`; not yet asserted end-to-end alongside the Flow 2 replace journey it advertises. Also covers the `dt_market_tab_profit_separator` divider that sits between the cue and the inline P/L (issue #1168). | Extend `market-selection/verify-trade-tabs.spec.ts` (Flow 20's sizing test already walks the active/inactive tab split, so the cue assertion belongs there rather than in a new spec) |

> Step-by-step test cases for each gap: [`flow.md — Gap Flows`](./flow.md#gap-flows)
