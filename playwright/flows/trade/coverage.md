# Trade Journey Coverage

**Analysis date:** 2026-09-15

---

## Section 1 — Coverage at a Glance

| # | Journey | Desktop | Mobile | Notes |
| --- | --- | --- | --- | --- |
| Flow 1 | Trade form loads with default state visible | ✅ | ✅ |  |
| Flow 2.1 | Rise/Fall — buy Rise → close | ✅ | ✅ |  |
| Flow 2.2 | Rise/Fall — buy Fall → close | ✅ | ✅ |  |
| Flow 2.3 | Rise/Fall Allow Equals — buy Rise → close | ✅ | ✅ |  |
| Flow 2.4 | Rise/Fall Allow Equals — buy Fall → close | ✅ | ✅ |  |
| Flow 2.5 | Rise/Fall Duration and Stake validation | ✅ | ✅ | Split from Flow 14; Vol 100; no purchase |
| Flow 3.1 | Higher/Lower — buy Higher → close | ✅ | ✅ |  |
| Flow 3.2 | Higher/Lower — buy Lower → close | ✅ | ✅ |  |
| Flow 3.3 | Higher/Lower Barrier, Duration and Stake validation | ✅ | ✅ | Split from Flow 14; Vol 100; no purchase |
| Flow 4.1 | Touch/No Touch — buy Touch → close | ✅ | ✅ |  |
| Flow 4.2 | Touch/No Touch — buy No Touch → close | ✅ | ✅ |  |
| Flow 4.3 | Touch/No Touch Barrier, Duration and Stake validation | ✅ | ✅ | Split from Flow 14; Vol 100; no purchase |
| Flow 5.1 | Matches/Differs — buy Matches → expiry | ✅ | ✅ |  |
| Flow 5.2 | Matches/Differs — buy Differs → expiry | ✅ | ✅ |  |
| Flow 5.3 | Matches/Differs digit, Duration, and Stake validation | ✅ | ✅ | |
| Flow 6.1 | Over/Under — buy Over → expiry | ✅ | ✅ |  |
| Flow 6.2 | Over/Under — buy Under → expiry | ✅ | ✅ |  |
| Flow 6.3 | Over/Under digit, Duration, and Stake validation | ✅ | ✅ | |
| Flow 6.4 | Higher/Lower → Over/Under proposal uses last_digit | ✅ | ✅ | Covers #1384 |
| Flow 7.1 | Even/Odd — buy Even → expiry | ✅ | ✅ |  |
| Flow 7.2 | Even/Odd — buy Odd → expiry | ✅ | ✅ |  |
| Flow 7.3 | Even/Odd Duration and Stake validation | ✅ | ✅ | No digit prediction; split from Flow 14 |
| Flow 8.1 | Accumulators without TP — buy → close | ✅ | ✅ |  |
| Flow 8.2 | Accumulators with TP — buy → verify TP set → close | ✅ | ✅ |  |
| Flow 8.3 | Accumulators Growth rate, Stake, and Take profit validation | ✅ | ✅ | |
| Flow 9.1 | Multipliers no TP/SL — buy Up → close | ✅ | ✅ | Commission + Stop out level on trade panel (#1413) |
| Flow 9.2 | Multipliers no TP/SL — buy Down → close | ✅ | ✅ |  |
| Flow 9.3 | Multipliers with TP — buy Up → close | ✅ | ✅ |  |
| Flow 9.4 | Multipliers with TP — buy Down → close | ✅ | ✅ |  |
| Flow 9.5 | Multipliers with SL — buy Up → close | ✅ | ✅ |  |
| Flow 9.6 | Multipliers with SL — buy Down → close | ✅ | ✅ |  |
| Flow 9.7 | Multipliers with Deal Cancellation — buy Up → cancel | ✅ | ✅ |  |
| Flow 9.8 | Multipliers with Deal Cancellation — buy Down → cancel | ✅ | ✅ |  |
| Flow 9.9 | Multipliers Multiplier, Stake, and Risk management validation | ✅ | ✅ | Split from Flow 14; Vol 25 (1s); no purchase |
| Flow 10.1 | Turbos without TP — buy Up → verify in positions | ✅ | ✅ |  |
| Flow 10.2 | Turbos without TP — buy Down → verify in positions | ✅ | ✅ |  |
| Flow 10.3 | Turbos with TP — buy Up → verify TP set in positions | ✅ | ✅ |  |
| Flow 10.4 | Turbos with TP — buy Down → verify TP set in positions | ✅ | ✅ |  |
| Flow 10.5 | Turbos Duration, Payout per point, Stake, and Take profit validation | ✅ | ✅ | Split from Flow 14; Vol 100 (1s); no purchase |
| Flow 11.1 | Vanillas — buy Call → close contract | ✅ | ✅ |  |
| Flow 11.2 | Vanillas — buy Put → close contract | ✅ | ✅ |  |
| Flow 11.3 | Vanillas Duration, Strike, and Stake validation | ✅ | ✅ | Split from Flow 14; Vol 100; no purchase |
| Flow 12 | Market closed → purchase hidden, countdown + recovery | ✅ | ✅ |  |
| Flow 13 | Insufficient balance → inline-validation gate (post-#1398) | ✅ | ✅ | Collapsed stake stays neutral (#1397) |
| Flow 14 | Manual Trading negative validation matrix | ✅ | ✅ |  |
| Flow 15 | Market closed → Buy hidden, params disabled, countdown | ✅ | ✅ | Skips when no CLOSED market at runtime |
| Flow 16 | Unauthenticated purchase → login prompt sheet | ✅ | ✅ |  |
| Flow 17.1 | Insufficient balance popup → deposit transfer | ✅ | ✅ |  |
| Flow 17.2 | Insufficient balance stake hint + Buy enabled | ✅ | ✅ |  |
| Flow 18 | Invalid URL — unsupported market and trade type modals | ✅ | ✅ | Covers regression for #895 |
| Flow 19 | Manual trade param info icons reveal descriptions | ✅ | ✅ | Covers regression for #995; Automate panel in trade-automate Flow 17 |
| Flow 20 | System theme follows OS / locks after explicit choice | ✅ | ✅ | Covers #1177 — mobile System radio; desktop sidebar toggle |

---

## Section 2 — Gaps

No open gaps — all Section 1 journeys are automated.

> Step-by-step test cases: [`flow.md`](./flow.md)

---

## Section 3 — Priority List

No pending gaps.
