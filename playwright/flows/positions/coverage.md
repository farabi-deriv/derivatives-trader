# Positions Journey Coverage

**Analysis date:** 2026-08-26

---

## Section 1 — Coverage at a Glance

| #      | Journey                                                                | Desktop | Mobile | Notes                                   |
| ------ | ---------------------------------------------------------------------- | ------- | ------ | --------------------------------------- |
| Flow 1 | Open positions list loads (mobile)                                     | N/A     | ✅     | `verify-positions-load.spec.ts`         |
| Flow 2 | Open positions list loads (desktop sidebar flyout)                     | ✅      | N/A    | `verify-positions-load.spec.ts`         |
| Flow 3 | Empty open positions state                                             | N/A     | ✅     | `verify-positions-empty-states.spec.ts` |
| Flow 4 | Closed positions tab with date sections                                | N/A     | ✅     | `verify-positions-load.spec.ts`         |
| Flow 5 | Filter open positions by trade type                                    | N/A     | ✅     | `verify-positions-filters.spec.ts`      |
| Flow 6 | Filter closed positions by time                                        | N/A     | ✅     | `verify-positions-filters.spec.ts`      |
| Flow 7 | Navigate from positions card to contract details                       | N/A     | ✅     | `verify-positions-load.spec.ts`         |
| G1     | Close open contract from positions (swipe + Close button)              | N/A     | ✅     | `verify-positions-actions.spec.ts`      |
| G2     | Cancel open multiplier contract from positions (swipe + Cancel button) | N/A     | ✅     | `verify-positions-actions.spec.ts`      |
| G3     | Empty closed positions state                                           | N/A     | ✅     | `verify-positions-empty-states.spec.ts` |
| G4     | Filter yields no matches (open positions)                              | N/A     | ✅     | `verify-positions-filters.spec.ts`      |

> **Desktop column N/A** for Flows 1, 3–7, G1–G4: `PositionsSwitch` redirects desktop users to `/` — the `/positions` full-page route is mobile-only. Desktop positions are covered by Flow 2 (sidebar flyout).

---

## Section 2 — Gaps

| Gap | Description                                                                                           | Implemented Spec File                             |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| G1  | Close an open contract by swiping left on its card and clicking the Close button                      | `positions/verify-positions-actions.spec.ts`      |
| G2  | Cancel an open multiplier contract with Deal Cancellation by swiping left and clicking Cancel         | `positions/verify-positions-actions.spec.ts`      |
| G3  | Verify the empty state on the Closed tab when the account has no contract history                     | `positions/verify-positions-empty-states.spec.ts` |
| G4  | Verify the no-matches empty state when a trade type filter is applied with no matching open positions | `positions/verify-positions-filters.spec.ts`      |

> Step-by-step test cases for each gap: [`flow.md — Gap Flows`](./flow.md#gap-flows)

---

## Section 3 — Priority List

| Priority | Spec file                                         | Gap / Flow                     | Reason                                                   |
| -------- | ------------------------------------------------- | ------------------------------ | -------------------------------------------------------- |
| P0       | `positions/verify-positions-load.spec.ts`         | Flow 1, Flow 2, Flow 4, Flow 7 | Core positions page load & navigation — gates release    |
| P1       | `positions/verify-positions-actions.spec.ts`      | G1, G2                         | Closing and cancelling contracts from the positions list |
| P2       | `positions/verify-positions-filters.spec.ts`      | Flow 5, Flow 6, G4             | Filter options and empty search states                   |
| P3       | `positions/verify-positions-empty-states.spec.ts` | Flow 3, G3                     | Edge cases — empty open and closed positions states      |
