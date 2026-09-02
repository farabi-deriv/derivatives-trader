# Automate Journey Coverage

**Analysis date:** 2026-09-02

---

## Section 1 — Coverage at a Glance

**Lifecycle notes (Flows 5–14):**

| Note               | Meaning                                                                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sequential**     | `verifyAutomateRunningControls()` → `verifyAutomateSequentialContractPurchase()` → open-position details → `verifyPauseAndResumeWhileRunning()` — tick types: one open at a time, first settles, then one open with `Contracts >= 2`, then Pause/Resume. |
| **First contract** | `verifyAutomateBotIsRunning()` + `verifyPauseAndResumeWhileRunning()` — Accumulators; no sequential step.                                                                                                                                                |

| #         | Journey                                            | Desktop | Mobile | Notes                                      |
| --------- | -------------------------------------------------- | ------- | ------ | ------------------------------------------ |
| Flow 1    | Pause and Resume a running automation              | ✅      | ✅     | Embedded in Flows 5–14 (no dedicated spec) |
| Flow 2    | Risk threshold auto-stop (loss/profit threshold)   | ✅      | ✅     |                                            |
| Flow 3    | Resync after account switch (stays Running)        | ✅      | ✅     |                                            |
| Flow 4    | Automation unavailable for EU account (gating)     | ❌      | ❌     |                                            |
| Flow 5.1  | Rise/Fall Martingale — Rise (demo + real)          | ✅      | ✅     | Sequential                                 |
| Flow 5.2  | Rise/Fall Martingale — Fall (demo + real)          | ✅      | ✅     | Sequential                                 |
| Flow 6.1  | Accumulators Martingale — demo lifecycle           | ✅      | ✅     | First contract                             |
| Flow 6.2  | Accumulators Martingale — real lifecycle           | ✅      | ✅     | First contract                             |
| Flow 7.1  | Matches/Differs Martingale — Matches (demo + real) | ✅      | ✅     | Sequential                                 |
| Flow 7.2  | Matches/Differs Martingale — Differs (demo + real) | ✅      | ✅     | Sequential                                 |
| Flow 8.1  | Over/Under Martingale — Over (demo + real)         | ✅      | ✅     | Sequential                                 |
| Flow 8.2  | Over/Under Martingale — Under (demo + real)        | ✅      | ✅     | Sequential                                 |
| Flow 9.1  | Even/Odd Martingale — Even (demo + real)           | ✅      | ✅     | Sequential                                 |
| Flow 9.2  | Even/Odd Martingale — Odd (demo + real)            | ✅      | ✅     | Sequential                                 |
| Flow 10.1 | Rise/Fall D'Alembert — Rise (demo + real)          | ✅      | ✅     | Sequential                                 |
| Flow 10.2 | Rise/Fall D'Alembert — Fall (demo + real)          | ✅      | ✅     | Sequential                                 |
| Flow 11.1 | Accumulators D'Alembert — demo lifecycle           | ✅      | ✅     | First contract                             |
| Flow 11.2 | Accumulators D'Alembert — real lifecycle           | ✅      | ✅     | First contract                             |
| Flow 12.1 | Matches/Differs D'Alembert — Matches (demo + real) | ✅      | ✅     | Sequential                                 |
| Flow 12.2 | Matches/Differs D'Alembert — Differs (demo + real) | ✅      | ✅     | Sequential                                 |
| Flow 13.1 | Over/Under D'Alembert — Over (demo + real)         | ✅      | ✅     | Sequential                                 |
| Flow 13.2 | Over/Under D'Alembert — Under (demo + real)        | ✅      | ✅     | Sequential                                 |
| Flow 14.1 | Even/Odd D'Alembert — Even (demo + real)           | ✅      | ✅     | Sequential                                 |
| Flow 14.2 | Even/Odd D'Alembert — Odd (demo + real)            | ✅      | ✅     | Sequential                                 |
| G1        | "Automation already running" adoption snackbar     | ❌      | ❌     |                                            |
| G2        | Validation / unsupported-contract-type error       | ❌      | ❌     |                                            |

---

## Section 2 — Gaps

| Gap | Description                                                                                  | Proposed spec file                              |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| G1  | Clicking Run while a run is already active shows an "already running" snackbar, no duplicate | `trade-automate/verify-already-running.spec.ts` |
| G2  | Unsupported trade type / invalid strategy params surface an error and block the run          | `trade-automate/verify-validation.spec.ts`      |

---

## Section 3 — Priority List

Remaining work only (Flows 2–3 and 5.1–14.2 are automated). Flow 1 pause/resume has no dedicated spec — it is embedded in every trade-type lifecycle (Flows 5–14) via `verifyPauseAndResumeWhileRunning()`. Tick-duration lifecycles assert sequential contract purchase; Accumulator lifecycles assert the first contract only.

| Priority | Flow / Gap | Reason                                                                                |
| -------- | ---------- | ------------------------------------------------------------------------------------- |
| P1       | G1         | Duplicate-run guard — quick to add; prevents false failures when a run is left active |
| P1       | G2         | Validation / unsupported trade type — important error paths before Run starts         |
| P2       | Flow 4     | EU gating — needs a dedicated EU/DIEL account                                         |
