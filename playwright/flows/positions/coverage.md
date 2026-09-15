# Positions Journey Coverage

**Analysis date:** 2026-08-26 · **Last updated:** 2026-09-15 (G1–G4 promoted to Flows 8–11)

---

## Section 1 — Coverage at a Glance

| #       | Journey                                                                | Desktop | Mobile | Notes                                   |
| ------- | ---------------------------------------------------------------------- | ------- | ------ | --------------------------------------- |
| Flow 1  | Open positions list loads (mobile)                                     | N/A     | ✅     | `verify-positions-load.spec.ts`         |
| Flow 2  | Open positions list loads (desktop sidebar flyout)                     | ✅      | N/A    | `verify-positions-load.spec.ts`         |
| Flow 3  | Empty open positions state (light + dark theme icon contrast, #1036)   | N/A     | ✅     | `verify-positions-empty-states.spec.ts` |
| Flow 4  | Closed positions tab with date sections                                | N/A     | ✅     | `verify-positions-load.spec.ts`         |
| Flow 5  | Filter open positions by trade type                                    | N/A     | ✅     | `verify-positions-filters.spec.ts`      |
| Flow 6  | Filter closed positions by time                                        | N/A     | ✅     | `verify-positions-filters.spec.ts`      |
| Flow 7  | Navigate from positions card to contract details                       | N/A     | ✅     | `verify-positions-load.spec.ts`         |
| Flow 8  | Close open contract from positions (swipe + Close button)              | N/A     | ✅     | `verify-positions-actions.spec.ts`      |
| Flow 9  | Cancel open multiplier contract from positions (swipe + Cancel button) | N/A     | ✅     | `verify-positions-actions.spec.ts`      |
| Flow 10 | Empty closed positions state                                           | N/A     | ✅     | `verify-positions-empty-states.spec.ts` |
| Flow 11 | Filter yields no matches (open positions)                              | N/A     | ✅     | `verify-positions-filters.spec.ts`      |

> **Desktop column N/A** for Flows 1, 3–11: `PositionsSwitch` redirects desktop users to `/` — the `/positions` full-page route is mobile-only. Desktop positions are covered by Flow 2 (sidebar flyout).

---

## Section 2 — Gaps

_No unautomated gaps. Former G1–G4 were promoted to Flows 8–11 on 2026-09-15._

---

## Section 3 — Priority List

| Priority | Spec file                                         | Flow                           | Reason                                                   |
| -------- | ------------------------------------------------- | ------------------------------ | -------------------------------------------------------- |
| P0       | `positions/verify-positions-load.spec.ts`         | Flow 1, Flow 2, Flow 4, Flow 7 | Core positions page load & navigation — gates release    |
| P1       | `positions/verify-positions-actions.spec.ts`      | Flow 8, Flow 9                 | Closing and cancelling contracts from the positions list |
| P2       | `positions/verify-positions-filters.spec.ts`      | Flow 5, Flow 6, Flow 11        | Filter options and empty search states                   |
| P3       | `positions/verify-positions-empty-states.spec.ts` | Flow 3, Flow 10                | Edge cases — empty open and closed positions states      |
