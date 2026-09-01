# Automate Journey Coverage

**Analysis date:** 2026-08-26 (POM run-control methods: `startAutomateRun`, `verifyAutomateBotIsRunning`, `stopAutomateRun`)

---

## Section 1 — Coverage at a Glance

| #       | Journey                                                  | Desktop | Mobile | Notes            |
| ------- | -------------------------------------------------------- | ------- | ------ | ---------------- |
| Flow 1  | Pause and Resume a running automation                    | ✅      | ✅     |                  |
| Flow 2  | Risk threshold auto-stop (loss/profit threshold)         | ✅      | ✅     |                  |
| Flow 3  | Strategy selection & params (Martingale / D'Alembert)    | ✅      | ✅     |                  |
| Flow 4  | Resync after account switch (stays Running)              | ✅      | ✅     |                  |
| Flow 6  | Automation unavailable for EU account (gating)           | ❌      | ❌     |                  |
| Flow 7  | Automate — Rise/Fall (Rise/Fall × demo/real)             | ✅      | ✅     | 4 tests per spec |
| Flow 8  | Automate — Accumulators (demo + real lifecycle)          | ✅      | ✅     | 2 tests per spec |
| Flow 9  | Automate — Matches/Differs (Matches/Differs × demo/real) | ✅      | ✅     | 4 tests per spec |
| Flow 10 | Automate — Over/Under (Over/Under × demo/real)           | ✅      | ✅     | 4 tests per spec |
| Flow 11 | Automate — Even/Odd (Even/Odd × demo/real)               | ✅      | ✅     | 4 tests per spec |
| G1      | "Automation already running" adoption snackbar           | ❌      | ❌     |                  |
| G2      | Validation / unsupported-contract-type error             | ❌      | ❌     |                  |

---

## Section 2 — Gaps

| Gap | Description                                                                                  | Proposed spec file                                       |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| G1  | Clicking Run while a run is already active shows an "already running" snackbar, no duplicate | `trade-automate/verify-automate-already-running.spec.ts` |
| G2  | Unsupported trade type / invalid strategy params surface an error and block the run          | `trade-automate/verify-automate-validation.spec.ts`      |

> Step-by-step test cases for each gap: [`flow.md — Gap Flows`](./flow.md#gap-flows)

---

## Section 3 — Priority List

Remaining work only (Flows 1–4 and 7–11 are automated). Panel default state (`verifyPanelDefaultState` / `verifyAutomationPanelFieldsVisible`) is covered by Flow 3 and trade-type lifecycles (Flows 7–11). Dual-outcome specs (Flows 7, 9–11) run four tests each; Accumulators (Flow 8) runs two — see `flow.md` for param examples and `tradeType` / `selectTradeTypeOption()` usage.

| Priority | Flow / Gap | Reason                                                                                |
| -------- | ---------- | ------------------------------------------------------------------------------------- |
| P1       | G1         | Duplicate-run guard — quick to add; prevents false failures when a run is left active |
| P1       | G2         | Validation / unsupported trade type — important error paths before Run starts         |
| P2       | Flow 6     | EU gating — needs a dedicated EU/DIEL account                                         |
