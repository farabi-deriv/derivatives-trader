# Market Selection & Trade Tabs Journey Coverage

**Analysis date:** 2026-08-06 · **Last updated:** 2026-09-23 (Flow 25 #1186 + Flow 26 chevron cue; G2 narrowed to locked-strip / P/L divider)

---

## Section 1 — Coverage at a Glance

| # | Journey | Desktop | Mobile | Notes |
| --- | --- | --- | --- | --- |
| Flow 1 | Add market opens the picker as a new-tab flow | ✅ | ✅ |  |
| Flow 2 | Clicking the active tab replaces it instead of adding a new one | ✅ | ✅ |  |
| Flow 3 | Trade-type navigation lists the same set on both platforms | ✅ | ✅ |  |
| Flow 4 | Switching trade type reloads the list to only tradeable symbols | ✅ | ✅ |  |
| Flow 5 | Asset-class category filter chips scope the list | ✅ | ✅ | Includes #994 Derived submarket order |
| Flow 6 | Time-window dropdown is always present in the category list | ✅ | ✅ |  |
| Flow 7 | Market Info screen (descriptions matrix, Trade-on, Favourite, Back) | ✅ | ✅ | `verify-market-info-screen.spec.ts` — 75 symbols (#1029) |
| Flow 8 | Search by market name | ✅ | ✅ |  |
| Flow 9 | Search with no matches | ✅ | ✅ |  |
| Flow 10 | Favourite toggle from the browse list | ✅ | ✅ |  |
| Flow 11 | Favourites persist across a page reload | ✅ | ✅ |  |
| Flow 12 | Guide affordance opens the trade-type description modal | ✅ | ✅ |  |
| Flow 13 | Close without selecting | ✅ | ✅ |  |
| Flow 14 | Switch between existing tabs | ✅ | ✅ |  |
| Flow 15 | Re-selecting an already-open pair focuses the existing tab | ✅ | ✅ |  |
| Flow 16 | Same market, different trade type are independent tabs | ✅ | ✅ |  |
| Flow 17 | Remove a non-active tab | ✅ | ✅ |  |
| Flow 18 | Remove the active tab falls back to an adjacent tab | ✅ | ✅ |  |
| Flow 19 | Remove the last remaining tab is blocked | ✅ | ✅ |  |
| Flow 20 | Tab strip scroll and active/inactive tab sizing | ✅ | ✅ |  |
| Flow 21 | Tabs persist across page reload | ✅ | ✅ |  |
| Flow 22 | Buy always targets the active tab's pair | ✅ | ✅ |  |
| Flow 23 | Tab icon reflects its own market | ✅ | ✅ |  |
| Flow 24 | Max tab limit enforced (4 mobile / 7 desktop) | ✅ | ✅ |  |
| Flow 25 | Trade params (stake + duration) persist per tab across reload (#1186) | ✅ | ✅ | Promoted from former G1 |
| Flow 26 | Active tab's chevron cue marks it as the picker trigger | ✅ | ✅ | Ex-G2 cases 1–4 — `verify-trade-tabs.spec.ts` (2026-09-23) |
| G2 | Cue withheld while a run locks the strip + cue/P/L divider | ❌ | ❌ | Ex-G2 cases 5–6 — need a running run / an open position |

---

## Section 2 — Gaps

| Gap | Description | Proposed spec file |
| --- | --- | --- |
| G2 | The remaining, heavier half of the old G2: the cue withheld while an automation run locks the strip (active tab stays `aria-current="true"` but loses chevron/`aria-haspopup`/`aria-label`; tap raises the locked snackbar), and the `dt_market_tab_profit_separator` divider between the cue and the inline P/L (issue #1168). Cases 1–4 of the old G2 — the active/inactive cue split, cue movement, and tap-opens-picker — were automated as Flow 26 in `verify-trade-tabs.spec.ts` on 2026-09-23. | Extend a `trade-automate` lifecycle spec for the locked-strip case (needs login + a running run); the P/L divider needs a spec with an open position — both pending |

> Step-by-step test cases for each gap: [`flow.md — Gap Flows`](./flow.md#gap-flows)
