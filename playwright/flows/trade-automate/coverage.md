# Automate Journey Coverage

**Analysis date:** 2026-09-18

> **Child flow IDs:** one ID per test case. **Accumulators (Flow 6):** `.1`/`.2` = Martingale demo/real · `.3`/`.4` = D'Alembert demo/real. **Dual-outcome types** (Rise/Fall, Matches/Differs, Over/Under, Even/Odd): `.1`/`.2` = first outcome demo/real · `.3`/`.4` = second outcome demo/real.
>
> **Lifecycle test titles (Flows 5–13):** `VERIFY automated trade run - {Strategy} - {surface} ({account})` — e.g. Flow **5.1** → `VERIFY automated trade run - Martingale - Rise (Demo)` · Flow **6.3** → `"VERIFY automated trade run - D'Alembert - Accumulators (Demo)"`.

---

## Section 1 — Coverage at a Glance

| # | Journey | Desktop | Mobile |
| --- | --- | --- | --- |
| Flow 1 | Pause and Resume a running automation | ✅ | ✅ |
| Flow 2.1 | Loss threshold auto-stop | ✅ | ✅ |
| Flow 2.2 | Profit threshold auto-stop | ✅ | ✅ |
| Flow 3 | Resync after account switch (stays Running) | ✅ | ✅ |
| Flow 4 | Automation unavailable for EU account (gating) | ❌ | ❌ |
| Flow 5.1 | Rise/Fall Martingale — Rise (demo) | ✅ | ✅ |
| Flow 5.2 | Rise/Fall Martingale — Rise (real) | ✅ | ✅ |
| Flow 5.3 | Rise/Fall Martingale — Fall (demo) | ✅ | ✅ |
| Flow 5.4 | Rise/Fall Martingale — Fall (real) | ✅ | ✅ |
| Flow 6.1 | Accumulators Martingale — demo | ✅ | ✅ |
| Flow 6.2 | Accumulators Martingale — real | ✅ | ✅ |
| Flow 6.3 | Accumulators D'Alembert — demo | ✅ | ✅ |
| Flow 6.4 | Accumulators D'Alembert — real | ✅ | ✅ |
| Flow 7.1 | Matches/Differs Martingale — Matches (demo) | ✅ | ✅ |
| Flow 7.2 | Matches/Differs Martingale — Matches (real) | ✅ | ✅ |
| Flow 7.3 | Matches/Differs Martingale — Differs (demo) | ✅ | ✅ |
| Flow 7.4 | Matches/Differs Martingale — Differs (real) | ✅ | ✅ |
| Flow 8.1 | Over/Under Martingale — Over (demo) | ✅ | ✅ |
| Flow 8.2 | Over/Under Martingale — Over (real) | ✅ | ✅ |
| Flow 8.3 | Over/Under Martingale — Under (demo) | ✅ | ✅ |
| Flow 8.4 | Over/Under Martingale — Under (real) | ✅ | ✅ |
| Flow 9.1 | Even/Odd Martingale — Even (demo) | ✅ | ✅ |
| Flow 9.2 | Even/Odd Martingale — Even (real) | ✅ | ✅ |
| Flow 9.3 | Even/Odd Martingale — Odd (demo) | ✅ | ✅ |
| Flow 9.4 | Even/Odd Martingale — Odd (real) | ✅ | ✅ |
| Flow 10.1 | Rise/Fall D'Alembert — Rise (demo) | ✅ | ✅ |
| Flow 10.2 | Rise/Fall D'Alembert — Rise (real) | ✅ | ✅ |
| Flow 10.3 | Rise/Fall D'Alembert — Fall (demo) | ✅ | ✅ |
| Flow 10.4 | Rise/Fall D'Alembert — Fall (real) | ✅ | ✅ |
| Flow 11.1 | Matches/Differs D'Alembert — Matches (demo) | ✅ | ✅ |
| Flow 11.2 | Matches/Differs D'Alembert — Matches (real) | ✅ | ✅ |
| Flow 11.3 | Matches/Differs D'Alembert — Differs (demo) | ✅ | ✅ |
| Flow 11.4 | Matches/Differs D'Alembert — Differs (real) | ✅ | ✅ |
| Flow 12.1 | Over/Under D'Alembert — Over (demo) | ✅ | ✅ |
| Flow 12.2 | Over/Under D'Alembert — Over (real; production smoke) | ✅ | ✅ |
| Flow 12.3 | Over/Under D'Alembert — Under (demo) | ✅ | ✅ |
| Flow 12.4 | Over/Under D'Alembert — Under (real) | ✅ | ✅ |
| Flow 13.1 | Even/Odd D'Alembert — Even (demo) | ✅ | ✅ |
| Flow 13.2 | Even/Odd D'Alembert — Even (real) | ✅ | ✅ |
| Flow 13.3 | Even/Odd D'Alembert — Odd (demo) | ✅ | ✅ |
| Flow 13.4 | Even/Odd D'Alembert — Odd (real) | ✅ | ✅ |
| Flow 14 | "Automation already running" adoption snackbar | ✅ | ✅ |
| Flow 15 | Invalid trade/automation param validation (min/max/zero) | ✅ | ✅ |
| Flow 16 | Manual-to-Automate market compatibility | ✅ | ✅ |
| Flow 17 | Automate param info icons reveal descriptions | ✅ | ✅ |
| G2 | Unsupported-contract-type error on Run | ❌ | ❌ |

---

## Section 2 — Gaps

| Gap | Description | Spec file | Status |
| --- | --- | --- | --- |
| G2 | Unsupported trade type surfaces an error and blocks the run (Run-click validation) | `trade-automate/verify-validation.spec.ts` | ❌ Open |

---

## Section 3 — Priority List

| Priority | Flow / Gap | Reason |
| --- | --- | --- |
| P1 | G2 | Unsupported trade type — important error path on Run |
| P2 | Flow 4 | EU gating — needs a dedicated EU/DIEL account |
