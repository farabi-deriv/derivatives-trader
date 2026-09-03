# Reports Journey Coverage

**Analysis date:** 2026-08-26

---

## Section 1 — Coverage at a Glance

| #      | Journey                                                           | Desktop | Mobile | Notes                                   |
| ------ | ----------------------------------------------------------------- | ------- | ------ | --------------------------------------- |
| Flow 1 | Reports page loads with default tab (Open positions)              | ✅      | ✅     | `verify-reports-navigation.spec.ts`     |
| Flow 2 | Open Positions tab — Options contracts visible                    | ✅      | ✅     | `verify-reports-open-positions.spec.ts` |
| Flow 3 | Open Positions tab — Multipliers filter                           | ✅      | ✅     | `verify-reports-open-positions.spec.ts` |
| Flow 4 | Open Positions tab — Accumulators filter + growth rate sub-filter | ✅      | ✅     | `verify-reports-open-positions.spec.ts` |
| Flow 5 | Trade Table tab loads with date filter and data rows              | ✅      | ✅     | `verify-reports-navigation.spec.ts`     |
| Flow 6 | Statement tab loads with transaction type filter                  | ✅      | ✅     | `verify-reports-navigation.spec.ts`     |
| Flow 7 | Empty state — no trading activity (Trade Table)                   | ✅      | ✅     | `verify-reports-empty-states.spec.ts`   |
| Flow 8 | Empty state — no transactions (Statement)                         | ✅      | ✅     | `verify-reports-empty-states.spec.ts`   |

> **N/A Note:** No flows are platform-exclusive. Both desktop and mobile render the full `/reports` page. Platform differences are limited to tab navigation UI (VerticalTab vs SelectNative) and filter interaction (Dropdown vs SelectNative).

---

## Section 2 — Gaps

| Gap | Description                                                                                                                            | Implemented Spec File                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| G1  | Navigate from an Open Positions row to contract details, then return to Reports                                                        | `reports/verify-reports-open-positions.spec.ts` |
| G2  | Archived statement route navigation and header display (full historical view requires an account with `has_archived_statement = true`) | `reports/verify-reports-navigation.spec.ts`     |

> Step-by-step test cases for each gap: [`flow.md — Gap Flows`](./flow.md#gap-flows)

---

## Section 3 — Priority List

| Priority | Spec file                                       | Gap / Flow                 | Reason                                                                 |
| -------- | ----------------------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| P0       | `reports/verify-reports-navigation.spec.ts`     | Flow 1, Flow 5, Flow 6, G2 | Core page load, Trade Table, Statement & Archived Statement navigation |
| P1       | `reports/verify-reports-open-positions.spec.ts` | Flow 2, Flow 3, Flow 4, G1 | Open Positions tab, Options/Multipliers/Accumulators filters & details |
| P2       | `reports/verify-reports-empty-states.spec.ts`   | Flow 7, Flow 8             | Empty states on Trade Table and Statement for accounts with no history |
