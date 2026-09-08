# Automate Journey Coverage

**Analysis date:** 2026-09-07

---

## Section 1 — Coverage at a Glance

| #         | Journey                                                  | Desktop | Mobile |
| --------- | -------------------------------------------------------- | ------- | ------ |
| Flow 1    | Pause and Resume a running automation                    | ✅      | ✅     |
| Flow 2.1  | Loss threshold auto-stop                                 | ✅      | ✅     |
| Flow 2.2  | Profit threshold auto-stop                               | ✅      | ✅     |
| Flow 3    | Resync after account switch (stays Running)              | ✅      | ✅     |
| Flow 4    | Automation unavailable for EU account (gating)           | ❌      | ❌     |
| Flow 5.1  | Rise/Fall Martingale — Rise (demo + real)                | ✅      | ✅     |
| Flow 5.2  | Rise/Fall Martingale — Fall (demo + real)                | ✅      | ✅     |
| Flow 6.1  | Accumulators Martingale — demo lifecycle                 | ✅      | ✅     |
| Flow 6.2  | Accumulators Martingale — real lifecycle                 | ✅      | ✅     |
| Flow 7.1  | Matches/Differs Martingale — Matches (demo + real)       | ✅      | ✅     |
| Flow 7.2  | Matches/Differs Martingale — Differs (demo + real)       | ✅      | ✅     |
| Flow 8.1  | Over/Under Martingale — Over (demo + real)               | ✅      | ✅     |
| Flow 8.2  | Over/Under Martingale — Under (demo + real)              | ✅      | ✅     |
| Flow 9.1  | Even/Odd Martingale — Even (demo + real)                 | ✅      | ✅     |
| Flow 9.2  | Even/Odd Martingale — Odd (demo + real)                  | ✅      | ✅     |
| Flow 10.1 | Rise/Fall D'Alembert — Rise (demo + real)                | ✅      | ✅     |
| Flow 10.2 | Rise/Fall D'Alembert — Fall (demo + real)                | ✅      | ✅     |
| Flow 11.1 | Accumulators D'Alembert — demo lifecycle                 | ✅      | ✅     |
| Flow 11.2 | Accumulators D'Alembert — real lifecycle                 | ✅      | ✅     |
| Flow 12.1 | Matches/Differs D'Alembert — Matches (demo + real)       | ✅      | ✅     |
| Flow 12.2 | Matches/Differs D'Alembert — Differs (demo + real)       | ✅      | ✅     |
| Flow 13.1 | Over/Under D'Alembert — Over (demo + real)               | ✅      | ✅     |
| Flow 13.2 | Over/Under D'Alembert — Under (demo + real)              | ✅      | ✅     |
| Flow 14.1 | Even/Odd D'Alembert — Even (demo + real)                 | ✅      | ✅     |
| Flow 14.2 | Even/Odd D'Alembert — Odd (demo + real)                  | ✅      | ✅     |
| Flow 15   | Invalid trade/automation param validation (min/max/zero) | ✅      | ✅     |
| G1        | "Automation already running" adoption snackbar           | ❌      | ❌     |
| G2        | Unsupported-contract-type error on Run                   | ❌      | ❌     |

---

## Section 2 — Gaps

| Gap | Description                                                                                  | Proposed spec file                              |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| G1  | Clicking Run while a run is already active shows an "already running" snackbar, no duplicate | `trade-automate/verify-already-running.spec.ts` |
| G2  | Unsupported trade type surfaces an error and blocks the run (Run-click validation)           | `trade-automate/verify-validation.spec.ts`      |

---

## Section 3 — Priority List

| Priority | Flow / Gap | Reason                                                                                |
| -------- | ---------- | ------------------------------------------------------------------------------------- |
| P1       | G1         | Duplicate-run guard — quick to add; prevents false failures when a run is left active |
| P1       | G2         | Unsupported trade type — important error path on Run                                  |
| P2       | Flow 4     | EU gating — needs a dedicated EU/DIEL account                                         |
