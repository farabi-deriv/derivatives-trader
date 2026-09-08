# Trade Journey Coverage

**Analysis date:** 2026-08-24

---

## Section 1 — Coverage at a Glance

| #         | Journey                                                | Desktop | Mobile | Notes |
| --------- | ------------------------------------------------------ | ------- | ------ | ----- |
| Flow 1    | Trade form loads with default state visible            | ✅      | ✅     |       |
| Flow 2.1  | Rise/Fall — buy Rise → close                           | ✅      | ✅     |       |
| Flow 2.2  | Rise/Fall — buy Fall → close                           | ✅      | ✅     |       |
| Flow 2.3  | Rise/Fall Allow Equals — buy Rise → close              | ✅      | ✅     |       |
| Flow 2.4  | Rise/Fall Allow Equals — buy Fall → close              | ✅      | ✅     |       |
| Flow 3.1  | Higher/Lower — buy Higher → close                      | ✅      | ✅     |       |
| Flow 3.2  | Higher/Lower — buy Lower → close                       | ✅      | ✅     |       |
| Flow 4.1  | Touch/No Touch — buy Touch → close                     | ✅      | ✅     |       |
| Flow 4.2  | Touch/No Touch — buy No Touch → close                  | ✅      | ✅     |       |
| Flow 5.1  | Matches/Differs — buy Matches → expiry                 | ✅      | ✅     |       |
| Flow 5.2  | Matches/Differs — buy Differs → expiry                 | ✅      | ✅     |       |
| Flow 6.1  | Over/Under — buy Over → expiry                         | ✅      | ✅     |       |
| Flow 6.2  | Over/Under — buy Under → expiry                        | ✅      | ✅     |       |
| Flow 7.1  | Even/Odd — buy Even → expiry                           | ✅      | ✅     |       |
| Flow 7.2  | Even/Odd — buy Odd → expiry                            | ✅      | ✅     |       |
| Flow 8.1  | Accumulators without TP — buy → close                  | ✅      | ✅     |       |
| Flow 8.2  | Accumulators with TP — buy → verify TP set → close     | ✅      | ✅     |       |
| Flow 9.1  | Multipliers no TP/SL — buy Up → close                  | ✅      | ✅     |       |
| Flow 9.2  | Multipliers no TP/SL — buy Down → close                | ✅      | ✅     |       |
| Flow 9.3  | Multipliers with TP — buy Up → close                   | ✅      | ✅     |       |
| Flow 9.4  | Multipliers with TP — buy Down → close                 | ✅      | ✅     |       |
| Flow 9.5  | Multipliers with SL — buy Up → close                   | ✅      | ✅     |       |
| Flow 9.6  | Multipliers with SL — buy Down → close                 | ✅      | ✅     |       |
| Flow 9.7  | Multipliers with Deal Cancellation — buy Up → cancel   | ✅      | ✅     |       |
| Flow 9.8  | Multipliers with Deal Cancellation — buy Down → cancel | ✅      | ✅     |       |
| Flow 10.1 | Turbos without TP — buy Up → verify in positions       | ✅      | ✅     |       |
| Flow 10.2 | Turbos without TP — buy Down → verify in positions     | ✅      | ✅     |       |
| Flow 10.3 | Turbos with TP — buy Up → verify TP set in positions   | ✅      | ✅     |       |
| Flow 10.4 | Turbos with TP — buy Down → verify TP set in positions | ✅      | ✅     |       |
| Flow 11.1 | Vanillas — buy Call → close contract                   | ✅      | ✅     |       |
| Flow 11.2 | Vanillas — buy Put → close contract                    | ✅      | ✅     |       |
| Flow 12   | Market closed → purchase hidden, countdown visible     | ❌      | ❌     |       |
| G1        | Insufficient balance → ServiceErrorSheet               | ❌      | ❌     |       |
| G2        | Unauthenticated purchase → login prompt sheet          | ❌      | ❌     |       |

---

## Section 2 — Gaps

| Gap | Description                                                                                                                                                                   | Proposed spec file                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| G1  | Insufficient balance: clicking Buy with insufficient funds opens `ServiceErrorSheet` ("Insufficient balance" / "Deposit now"). Requires specific account state.               | `trade/verify-insufficient-balance.spec.ts`     |
| G2  | Unauthenticated purchase: clicking Buy without login shows `ServiceErrorSheet` ("Start trading with us" / "Login" / "Create free account"). Requires unauthenticated session. | `trade/verify-unauthenticated-purchase.spec.ts` |

> Step-by-step test cases for each gap: [`flow.md — Gap Flows`](./flow.md#gap-flows)

---

## Section 3 — Priority List

| Priority | Spec file                                                                                                                                          | Flow                           | Reason                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------- |
| P0       | `trade/accumulators/verify-accumulators-no-tp.spec.ts`                                                                                             | Flow 8.1                       | Top-traffic trade type; without TP                 |
| P0       | `trade/accumulators/verify-accumulators-with-tp.spec.ts`                                                                                           | Flow 8.2                       | Top-traffic trade type; with TP                    |
| P0       | `trade/matches-differs/verify-matches.spec.ts` · `verify-differs.spec.ts`                                                                          | Flow 5.1 + 5.2                 | Most popular Digit type                            |
| P1       | `trade/higher-lower/verify-higher.spec.ts` · `verify-lower.spec.ts`                                                                                | Flow 3.1 + 3.2                 | Core directional type with barrier                 |
| P1       | `trade/multipliers/verify-multipliers-with-sl.spec.ts`                                                                                             | Flow 9.5 + 9.6                 | SL is a critical risk control path                 |
| P1       | `trade/turbos/verify-turbos-up.spec.ts` · `verify-turbos-down.spec.ts` · `verify-turbos-up-with-tp.spec.ts` · `verify-turbos-down-with-tp.spec.ts` | Flow 10.1 + 10.2 + 10.3 + 10.4 | Unique payout per point param; without and with TP |
| P1       | `trade/vanillas/verify-vanillas-call.spec.ts` · `verify-vanillas-put.spec.ts`                                                                      | Flow 11.1 + 11.2               | Unique strike price param; full open + close chain |
| P2       | `trade/touch-no-touch/verify-touch.spec.ts` · `verify-no-touch.spec.ts`                                                                            | Flow 4.1 + 4.2                 | Directional with barrier — lower traffic           |
| P2       | `trade/over-under/verify-over.spec.ts` · `verify-under.spec.ts`                                                                                    | Flow 6.1 + 6.2                 | Secondary Digit type                               |
| P2       | `trade/even-odd/verify-even.spec.ts` · `verify-odd.spec.ts`                                                                                        | Flow 7.1 + 7.2                 | Secondary Digit type; simplest params              |
| P2       | `trade/multipliers/verify-multipliers-deal-cancellation.spec.ts`                                                                                   | Flow 9.7 + 9.8                 | DC less-used; symbol availability varies           |
| P2       | `trade/verify-closed-market.spec.ts`                                                                                                               | Flow 12                        | Important edge case; environment-dependent         |
| P2       | `trade/verify-insufficient-balance.spec.ts`                                                                                                        | G1                             | Important error path; needs account state setup    |
| P3       | `trade/verify-unauthenticated-purchase.spec.ts`                                                                                                    | G2                             | Edge case — most users are logged in               |
