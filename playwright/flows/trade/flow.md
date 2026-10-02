# 📋 Trade Journey Spec — What to Test

> **Purpose:** Describes the end-to-end buy + close flows for each trade type on `staging-dtrader.deriv.com`. Each dual-outcome trade type has a dedicated sub-flow per button.
>
> **Feature location:** `packages/trader/src/AppV2/Containers/Trade/` · `packages/trader/src/AppV2/Components/TradeParameters/` · `packages/trader/src/AppV2/Components/PurchaseButton/`
> **URL:** `https://staging-dtrader.deriv.com/` (trade page)
> **Authentication:** All flows start from a logged-in state (`loginPage.login()` in `beforeEach`)
> **Desktop source:** `trade-desktop.tsx` — inline trade params in a grid
> **Mobile source:** `trade-mobile.tsx` → `TradeParametersContainer` (swipeable bottom sheet)
> **Account type:** Every implemented buy flow below (Flows 2–11) runs as a `(Demo Account)` / `(Real Account)` test pair via
> `accountType: 'real' | 'demo'` on the page object's `buy*AndVerify()` method — the account created in
> `beforeAll` is real by default, and the demo variant switches in-app via `switchToAccountType('demo')`
> before configuring the trade.

---

## Flow 1 — Trade form loads with default state visible

### Flow 1a — Logged-out state

**Prerequisites:** No authentication. Market open.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `tradeParametersPage.gotoTradePage()` | Trade page loads at `/` | Both |
| 2 | Verify login button | Observe header | Login button visible | Both |
| 3 | Verify account info absent | Observe header | Account info not visible | Both |
| 4 | Verify trade type selector | Observe trade type row | "View all trade types" button visible | Both |
| 5 | Verify selected chip | Observe trade type chips | Rise/Fall chip selected by default | Both |
| 6 | Verify purchase button | Observe buy area | Purchase button visible | Both |

### Flow 1b — Default symbol and trade type (fresh session)

**Prerequisites:** No authentication. No localStorage (fresh browser context / incognito).

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `tradeParametersPage.gotoTradePage()` | Trade page loads at `/` | Both |
| 2 | Verify default symbol | Observe market selector | Symbol label shows "Volatility 100 (1s) Index" | Both |
| 3 | Verify default trade type | Observe trade type chips | Rise/Fall chip is selected | Both |

---

### Flow 1c — Logged-in state

**Prerequisites:** Authenticated (real or demo account). Market open.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Login | `loginPage.login()` | Redirected to trade page; API settled | Both |
| 2 | Verify account info | Observe header | Account info, balance, deposit button visible | Both |
| 3 | Verify login button absent | Observe header | Login button not visible | Both |
| 4 | Verify market selector | Observe market selector area | Market name + current spot price visible | Both |
| 5 | Verify trade type selector | Observe trade type row | "View all trade types" button visible | Both |
| 6 | Verify selected chip | Observe trade type chips | Rise/Fall chip selected by default | Both |
| 7 | Verify Rise/Fall buttons | Observe segmented control | Rise and Fall buttons visible | Both |
| 8 | Verify Duration + Stake | Observe parameters | Duration and Stake labels visible | Both |
| 9 | Verify Allow equals | Observe parameters | Allow equals text visible | Both |
| 10 | Verify purchase button | Observe buy area | Purchase button visible | Both |
| 11 | Verify param container (mobile) | Observe bottom sheet | `trade-params-container` visible (fixed height, no handle) | Mobile |
| 12 | Verify network status (desktop) | Observe footer | Network status indicator visible | Desktop |
| 13 | Verify fullscreen toggle (desktop) | Observe footer | Fullscreen toggle visible | Desktop |
| 14 | Verify sidebar (desktop) | Observe sidebar | Home, Positions, Reports, Help, Language, Theme, Account | Desktop |
| 15 | Verify bottom nav (mobile) | Observe bottom navigation | Home, Trade, Positions, Menu tabs visible | Mobile |

---

## Rise/Fall

### Flow 2.1 — Rise/Fall: buy Rise → close contract

**Prerequisites:** Authenticated with funded account. Symbol supporting Rise/Fall (e.g. Volatility 100 Index).
**Spec:** `playwright/tests/trade/rise-fall/verify-rise.spec.ts` — `VERIFY Buy "Rise" Contract and Close (Demo Account)` / `(Real Account)`
**Unique params:** Duration (`15 min`), Stake (`10.50`), Allow equals toggle

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall')` | Chip selected; Duration, Stake, Allow equals visible | Both |
| 3 | Select Rise option | `clickRiseFallOption('Rise')` | Purchase button turns green | Both |
| 4 | Select duration | `selectDuration('Minutes', '15 min')` | Duration field shows `15 min` | Both |
| 5 | Set stake | `setStake('10.50')` | Stake field shows `10.50` | Both |
| 6 | Buy Rise contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 7 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 8 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |
| 9 | Open contract details (open) | `openFirstContract()` + `verifyContractDetailsPage()` | Ref. ID, Duration, Start time, Entry spot, Barrier visible | Both |
| 10 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 11 | Verify closed contract card | `verifyClosedPositionsTab()` — captures P&L | Card shows market, trade type, stake, "Closed" status, P&L | Both |
| 12 | Open contract details (closed) | `verifyClosedContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs, Exit spot, Exit time visible; no Sell btn | Both |
| 13 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 14 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 15 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

### Flow 2.2 — Rise/Fall: buy Fall → close contract

**Prerequisites:** Same as Flow 2.1.
**Spec:** `playwright/tests/trade/rise-fall/verify-fall.spec.ts` — `VERIFY Buy "Fall" Contract and Close (Demo Account)` / `(Real Account)`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall')` | Chip selected; Duration, Stake, Allow equals visible | Both |
| 3 | Select Fall option | `clickRiseFallOption('Fall')` | Purchase button turns red | Both |
| 4 | Select duration | `selectDuration('Minutes', '15 min')` | Duration field shows `15 min` | Both |
| 5 | Set stake | `setStake('10.50')` | Stake field shows `10.50` | Both |
| 6 | Buy Fall contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 7 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 8 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |
| 9 | Open contract details (open) | `openFirstContract()` + `verifyContractDetailsPage()` | Ref. ID, Duration, Start time, Entry spot, Barrier visible | Both |
| 10 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 11 | Verify closed contract card | `verifyClosedPositionsTab()` — captures P&L | Card shows market, trade type, stake, "Closed" status, P&L | Both |
| 12 | Open contract details (closed) | `verifyClosedContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs, Exit spot, Exit time visible; no Sell btn | Both |
| 13 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 14 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 15 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

---

## Rise/Fall (Allow Equals)

### Flow 2.3 — Rise/Fall Allow Equals: buy Rise → close contract

**Prerequisites:** Same as Flow 2.1.
**Spec:** `playwright/tests/trade/rise-fall/verify-rise-allow-equals.spec.ts` — `VERIFY Buy "Rise" Contract with Allow Equals Enabled (Demo Account)` / `(Real Account)`
**Unique params:** Allow equals toggle enabled (changes contract to RISEEQUAL), Duration (`15 min`), Stake (`10.50`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall')` | Rise/Fall chip selected | Both |
| 3 | Select duration | `selectDuration('Minutes', '15 min')` | Duration field shows `15 min` | Both |
| 4 | Set stake amount | `setStake('10.50')` | Stake input shows `10.50` | Both |
| 5 | Enable Allow equals | `buyRiseAndVerify({ allowEquals: true })` | Toggle activated; contract type changes to RISEEQUAL | Both |
| 6 | Buy Rise contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 7 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 8 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |
| 9 | Open contract details (open) | `openFirstContract()` + `verifyContractDetailsPage()` | Ref. ID, Duration, Start time, Entry spot, Barrier visible | Both |
| 10 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 11 | Verify closed contract card | `verifyClosedPositionsTab()` — captures P&L | Card shows market, trade type, stake, "Closed" status, P&L | Both |
| 12 | Open contract details (closed) | `verifyClosedContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs, Exit spot, Exit time visible; no Sell btn | Both |
| 13 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 14 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 15 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

### Flow 2.4 — Rise/Fall Allow Equals: buy Fall → close contract

**Prerequisites:** Same as Flow 2.3.
**Spec:** `playwright/tests/trade/rise-fall/verify-fall-allow-equals.spec.ts` — `VERIFY Buy "Fall" Contract with Allow Equals Enabled (Demo Account)` / `(Real Account)`
**Unique params:** Allow equals toggle enabled (changes contract to FALLEQUAL), Duration (`18 min`), Stake (`20.50`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall')` | Rise/Fall chip selected | Both |
| 3 | Select duration | `selectDuration('Minutes', '18 min')` | Duration field shows `18 min` | Both |
| 4 | Set stake amount | `setStake('20.50')` | Stake input shows `20.50` | Both |
| 5 | Enable Allow equals | `buyFallAndVerify({ allowEquals: true })` | Toggle activated; contract type changes to FALLEQUAL | Both |
| 6 | Buy Fall contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 7 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 8 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |
| 9 | Open contract details (open) | `openFirstContract()` + `verifyContractDetailsPage()` | Ref. ID, Duration, Start time, Entry spot, Barrier visible | Both |
| 10 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 11 | Verify closed contract card | `verifyClosedPositionsTab()` — captures P&L | Card shows market, trade type, stake, "Closed" status, P&L | Both |
| 12 | Open contract details (closed) | `verifyClosedContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs, Exit spot, Exit time visible; no Sell btn | Both |
| 13 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 14 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 15 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

### Flow 2.5 — Rise/Fall Duration and Stake validation

> Split from Flow 14. Single no-purchase journey on Volatility 100 Index: Duration across offered units, then Stake runtime limits. Cross-market Rise/Fall sweeps stay in Flow 14.

**Prerequisites:** Authenticated (`TEST_EMAIL_RISE_FALL` / `TEST_EMAIL_RISE_FALL_MOBILE`). Symbol supporting Rise/Fall (e.g. Volatility 100 Index).
**Spec:** `playwright/tests/trade/rise-fall/verify-rise-fall-validations.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select Rise/Fall | `selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', { verifyAllowEquals: false })` | Chip selected; Duration + Stake visible | Both |
| 2 | Duration | `verifyDurationGuardrails('Rise/Fall')` | Desktop: Ticks/Seconds/Minutes/Hours/End time chips + Custom; Mobile: Ticks wheel 1–10, Time wheel hr/min/sec bounds, End time fields + pickers + future date → 23:59 GMT; editors dismissed | Both |
| 3 | Stake | `verifyStakeGuardrails('Rise/Fall')` | **6** quick-pick chips; Custom: `0` → min-stake error + Save disabled; max-payout+1 → payout-limits error + Save disabled; editor dismissed; rejected drafts leave Buy unchanged | Both |

> **POM:** call leaf helpers directly after one select (dedicated trade-type pattern).

---

## Higher/Lower

### Flow 3.1 — Higher/Lower: buy Higher → close contract

**Prerequisites:** Authenticated with funded account. Symbol supporting Higher/Lower with barrier (e.g. Volatility 100 Index).
**Spec:** `playwright/tests/trade/higher-lower/verify-higher.spec.ts` — `VERIFY Buy "Higher" Contract and Close (Demo Account)` / `(Real Account)`
**Unique params:** Barrier (`Above spot`, `8.11`), Duration (`1 hr`), Stake (`10.00`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 Index', 'Higher/Lower')` | Chip selected; Barrier, Duration, Stake visible | Both |
| 3 | Select Higher option | `clickHigherLowerOption('Higher')` | Purchase button turns green | Both |
| 4 | Select duration | `selectDuration('Hours', '1 hr')` | Duration field shows `1 hr` | Both |
| 5 | Set barrier | `setBarrier('8.11', 'Above spot')` — uses market-snapped accepted offset | Barrier field shows a valid `+` offset | Both |
| 6 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 7 | Buy Higher contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 8 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 9 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |
| 10 | Open contract details (open) | `openFirstContract()` + `verifyContractDetailsPage()` | Ref. ID, Duration, Start time, Entry spot, Barrier visible | Both |
| 11 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 12 | Verify closed contract card | `verifyClosedPositionsTab()` — captures P&L | Card shows market, trade type, stake, "Closed" status, P&L | Both |
| 13 | Open contract details (closed) | `verifyClosedContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs, Exit spot, Exit time visible; no Sell btn | Both |
| 14 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 15 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 16 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

### Flow 3.2 — Higher/Lower: buy Lower → close contract

**Prerequisites:** Same as Flow 3.1.
**Spec:** `playwright/tests/trade/higher-lower/verify-lower.spec.ts` — `VERIFY Buy "Lower" Contract and Close (Demo Account)` / `(Real Account)`
**Unique params:** Barrier (`Below spot`, `8.00`), Duration (`1h 30m`), Stake (`10.00`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 Index', 'Higher/Lower')` | Chip selected; Barrier, Duration, Stake visible | Both |
| 3 | Select Lower option | `clickHigherLowerOption('Lower')` | Purchase button turns red | Both |
| 4 | Select duration | `selectDuration('Hours', '1h 30m')` | Duration field shows `1h 30m` | Both |
| 5 | Set barrier | `setBarrier('8.00', 'Below spot')` — uses market-snapped accepted offset | Barrier field shows a valid `-` offset | Both |
| 6 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 7 | Buy Lower contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 8 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 9 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |
| 10 | Open contract details (open) | `openFirstContract()` + `verifyContractDetailsPage()` | Ref. ID, Duration, Start time, Entry spot, Barrier visible | Both |
| 11 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 12 | Verify closed contract card | `verifyClosedPositionsTab()` — captures P&L | Card shows market, trade type, stake, "Closed" status, P&L | Both |
| 13 | Open contract details (closed) | `verifyClosedContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs, Exit spot, Exit time visible; no Sell btn | Both |
| 14 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 15 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 16 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

### Flow 3.3 — Higher/Lower Barrier, Duration and Stake validation

> Split from Flow 14. Single no-purchase journey on Volatility 100 Index: Barrier zero/empty/too-far, Duration across offered units, then Stake runtime limits.

**Prerequisites:** Authenticated (`TEST_EMAIL_HIGHER_LOWER` / `TEST_EMAIL_HIGHER_LOWER_MOBILE`). Symbol supporting Higher/Lower (e.g. Volatility 100 Index).
**Spec:** `playwright/tests/trade/higher-lower/verify-higher-lower-validations.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select Higher/Lower | `selectMarketAndTradeType('Volatility 100 Index', 'Higher/Lower')` | Chip selected; Barrier + Duration + Stake visible | Both |
| 2 | Duration | `verifyDurationGuardrails('Higher/Lower')` | Desktop: Ticks/Seconds/Minutes/Hours/End time chips + Custom (when offered); Mobile: Ticks/Time/End time wheels; editors dismissed | Both |
| 3 | Barrier | `verifyBarrierGuardrails()` | Above spot + Below spot tabs present; on each: `0` → cannot be zero; empty → required; `123456` → too far from spot; Save disabled; committed barrier unchanged; editor dismissed | Both |
| 4 | Stake | `verifyStakeGuardrails('Higher/Lower')` | **6** quick-pick chips; Custom: `0` → min-stake error + Save disabled; max-payout+1 → payout-limits error + Save disabled; editor dismissed; rejected drafts leave Buy unchanged | Both |

> **POM:** call leaf helpers directly after one select (dedicated trade-type pattern).

---

## Touch/No Touch

### Flow 4.1 — Touch/No Touch: buy Touch → close contract

**Prerequisites:** Authenticated with funded account. Symbol supporting Touch/No Touch (e.g. Volatility 100 Index).
**Spec:** `playwright/tests/trade/touch-no-touch/verify-touch.spec.ts` — `VERIFY Buy "Touch" Contract and Close (Demo Account)` / `(Real Account)`
**Unique params:** Barrier (`Above spot`, `8.01`), Duration (`15 min`), Stake (`5.01`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 Index', 'Touch/No Touch')` | Chip selected; Barrier, Duration, Stake visible | Both |
| 3 | Select Touch option | `clickTouchNoTouchOption('Touch')` | Purchase button turns green | Both |
| 4 | Select duration | `selectDuration('Minutes', '15 min')` | Duration field shows `15 min` | Both |
| 5 | Set barrier | `setBarrier('8.01', 'Above spot')` — uses market-snapped accepted offset | Barrier field shows a valid `+` offset | Both |
| 6 | Set stake | `setStake('5.01')` | Stake field shows `5.01` | Both |
| 7 | Buy Touch contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 8 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 9 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |
| 10 | Open contract details (open) | `openFirstContract()` + `verifyContractDetailsPage()` | Ref. ID, Duration, Start time, Entry spot, Barrier visible | Both |
| 11 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 12 | Verify closed contract card | `verifyClosedPositionsTab()` — captures P&L | Card shows market, trade type, stake, "Closed" status, P&L | Both |
| 13 | Open contract details (closed) | `verifyClosedContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs, Exit spot, Exit time visible; no Sell btn | Both |
| 14 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 15 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 16 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

### Flow 4.2 — Touch/No Touch: buy No Touch → close contract

**Prerequisites:** Same as Flow 4.1.
**Spec:** `playwright/tests/trade/touch-no-touch/verify-no-touch.spec.ts` — `VERIFY Buy "No Touch" Contract and Close (Demo Account)` / `(Real Account)`
**Unique params:** Barrier (`Below spot`, `8.99`), Duration (`5 min`), Stake (`6.09`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 Index', 'Touch/No Touch')` | Chip selected; Barrier, Duration, Stake visible | Both |
| 3 | Select No Touch option | `clickTouchNoTouchOption('No Touch')` | Purchase button turns red | Both |
| 4 | Select duration | `selectDuration('Minutes', '5 min')` | Duration field shows `5 min` | Both |
| 5 | Set barrier | `setBarrier('8.99', 'Below spot')` — uses market-snapped accepted offset | Barrier field shows a valid `-` offset | Both |
| 6 | Set stake | `setStake('6.09')` | Stake field shows `6.09` | Both |
| 7 | Buy No Touch contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 8 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 9 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |
| 10 | Open contract details (open) | `openFirstContract()` + `verifyContractDetailsPage()` | Ref. ID, Duration, Start time, Entry spot, Barrier visible | Both |
| 11 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 12 | Verify closed contract card | `verifyClosedPositionsTab()` — captures P&L | Card shows market, trade type, stake, "Closed" status, P&L | Both |
| 13 | Open contract details (closed) | `verifyClosedContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs, Exit spot, Exit time visible; no Sell btn | Both |
| 14 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 15 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 16 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

### Flow 4.3 — Touch/No Touch Barrier, Duration and Stake validation

> Split from Flow 14. Single no-purchase journey on Volatility 100 Index: Duration across offered units, Barrier zero/empty, then Stake runtime limits.

**Prerequisites:** Authenticated (`TEST_EMAIL_TOUCH_NO_TOUCH` / `TEST_EMAIL_TOUCH_NO_TOUCH_MOBILE`). Symbol supporting Touch/No Touch (e.g. Volatility 100 Index).
**Spec:** `playwright/tests/trade/touch-no-touch/verify-touch-no-touch-validations.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select Touch/No Touch | `selectMarketAndTradeType('Volatility 100 Index', 'Touch/No Touch')` | Chip selected; Barrier + Duration + Stake visible | Both |
| 2 | Duration | `verifyDurationGuardrails('Touch/No Touch')` | Desktop: Ticks/Seconds/Minutes/Hours/End time chips + Custom (when offered); Mobile: Ticks/Time/End time wheels; editors dismissed | Both |
| 3 | Barrier | `verifyBarrierGuardrails()` | Above spot + Below spot tabs present; on each: `0` → cannot be zero; empty → required; `123456` → too far from spot; Save disabled; committed barrier unchanged; editor dismissed | Both |
| 4 | Stake | `verifyStakeGuardrails('Touch/No Touch')` | **6** quick-pick chips; Custom: `0` → min-stake error + Save disabled; max-payout+1 → payout-limits error + Save disabled; editor dismissed; rejected drafts leave Buy unchanged | Both |

> **POM:** call leaf helpers directly after one select (dedicated trade-type pattern).

---

## Matches/Differs

> **Structural exception — Ticks-only + no manual close:** Digit contracts support **Ticks duration only** (the duration popover has no unit-tab sidebar, just tick chips), and they **expire automatically** — there is no manual Close button. The tick duration is too short to reliably inspect the contract while open, so the flow opens the **open position's contract details right after purchase**, captures its buy reference ID, then **waits for the contract to settle in place** and verifies the **settled (closed)** contract — details page, Positions Closed tab, balance, and Reports (Trade table + Statement). The digit audit grid has **no Entry spot/Barrier** — instead a **Target** row (e.g. "Equals 5").

### Flow 5.1 — Matches/Differs: buy Matches → settle → verify closed

**Prerequisites:** Authenticated with funded account. Digits symbol (e.g. Volatility 10 Index).
**Spec:** `playwright/tests/trade/matches-differs/verify-matches.spec.ts` — `VERIFY Buy "Matches" Contract (Demo Account)` / `(Real Account)`
**Unique params:** Last digit prediction, Duration (ticks), Stake (`10.00`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select market and trade type | `selectMarketAndTradeType('Volatility 10 Index', 'Matches/Differs')` | Chip selected; last digit prediction + Stake visible | Both |
| 2 | Select Matches | `clickMatchesDiffersOption('Matches')` | Purchase button turns green | Both |
| 3 | Select duration (ticks only) | `selectTicksDuration('10 ticks')` | Duration field shows `10 ticks` | Both |
| 4 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 5 | Select digit prediction | `selectDigit('5')` | Digit 5 selected | Both |
| 6 | Buy Matches contract | `clickBuy()` — captures payout | Contract purchased; balance reduced by stake | Both |
| 7 | Open the open position's details | `openFirstContract()` + `getBuyReferenceId()` | Buy reference ID captured (pins this contract) | Both |
| 8 | Wait for auto-expiry in place | `waitForContractSettled()` | Sell reference ID appears (contract settled) | Both |
| 9 | Verify settled contract in Positions | Closed tab → `verifyClosedPositionsTab()` — captures signed P/L | Closed card shows market/type/stake/Closed + P/L | Both |
| 10 | Verify settled contract details | `verifyClosedDigitContractDetailsPage()` — asserts Target digit, extracts `sellId` | Ref IDs, Duration, Target, Exit spot/time correct | Both |
| 11 | Verify final balance | `verifyBalanceAfterContractClose()` | Balance = afterBuy + stake + P/L | Both |
| 12 | Verify settled contract in Reports | `verifyClosedContractInReports(buyId, sellId, …)` | Trade table + Statement rows match | Both |

### Flow 5.2 — Matches/Differs: buy Differs → settle → verify closed

**Prerequisites:** Same as Flow 5.1.
**Spec:** `playwright/tests/trade/matches-differs/verify-differs.spec.ts` — `VERIFY Buy "Differs" Contract (Demo Account)` / `(Real Account)`
**Unique params:** Duration (ticks), Stake (`10.00`)

Identical chain to Flow 5.1 with `clickMatchesDiffersOption('Differs')` (purchase button turns red) — buy Differs → open details → settle in place → verify the closed contract in Positions, contract details, balance, and Reports.

### Flow 5.3 — Matches/Differs digit, Duration, and Stake validation

> Split from Flow 14. Single no-purchase journey: digit choices for Matches and Differs, ticks-only Duration, then Stake runtime limits.

**Prerequisites:** Authenticated (`TEST_EMAIL_MATCHES_DIFFERS` / `TEST_EMAIL_MATCHES_DIFFERS_MOBILE`). Digits symbol (e.g. Volatility 10 Index).
**Spec:** `playwright/tests/trade/matches-differs/verify-matches-differs-validations.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select Matches/Differs | `selectMarketAndTradeType('Volatility 10 Index', 'Matches/Differs')` | Last digit prediction visible | Both |
| 2 | Digit choices | `verifyMatchesDiffersDigitChoiceAvailability()` | Digits 0–9 listed; Matches and Differs keep 0 and 9 enabled | Both |
| 3 | Duration | `verifyDurationGuardrails('Matches/Differs')` → `verifyBuyButtonRemainsEnabled()` | No unit tabs; desktop **6** quick-pick chips (values within **1–10 ticks**, not fixed); mobile wheel 1–10; desktop Custom: draft min−1 / max+1 → `Please enter a duration between {{min}} to {{max}} ticks.` + Save disabled; rejected drafts leave Buy unchanged | Both |
| 4 | Stake | `verifyStakeGuardrails('Matches/Differs')` → `verifyBuyButtonRemainsEnabled()` → `dismissStakeEditor()` | **6** quick-pick chips; Custom: `0` → min-stake error + Save disabled; max-payout+1 → payout-limits error + Save disabled; rejected drafts leave Buy unchanged | Both |

> **POM:** call leaf helpers directly after one select (dedicated trade-type pattern). Matrix specs still use `*ForConfiguration`.

---

## Over/Under

> **Structural exception — Ticks-only + no manual close:** Same digit-contract structure as Matches/Differs (see that section). Over/Under uses the same Ticks-only duration, tab selector → single colored purchase button, last-digit selector, and the **settle-in-place** verification chain. The audit **Target** row reads "Over N" / "Under N". **Invalid digits:** Over cannot predict 9, Under cannot predict 0 — use a middle digit (e.g. 5), valid for both. **#1011 (mobile ticks + Duration sheet):** covered by Flows 6.1/6.2 — `selectTicksDuration()` on mobile opens the action sheet and commits ticks; a successful buy implies current-spot ticks are streaming. Visual whitespace/swipe bleed remains manual.

### Flow 6.1 — Over/Under: buy Over → settle → verify closed

**Prerequisites:** Authenticated with funded account. Digits symbol (e.g. Volatility 10 Index).
**Spec:** `playwright/tests/trade/over-under/verify-over.spec.ts` — `VERIFY Buy "Over" Contract (Demo Account)` / `(Real Account)`
**Unique params:** Last digit prediction, Duration (ticks), Stake (`10.00`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select market and trade type | `selectMarketAndTradeType('Volatility 10 Index', 'Over/Under')` | Chip selected; last digit prediction + Stake | Both |
| 2 | Select Over | `selectPredictionOption('Over', 'top')` | Purchase button turns green | Both |
| 3 | Select duration (ticks only) | `selectTicksDuration('10 ticks')` | Duration field shows `10 ticks` | Both |
| 4 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 5 | Select digit prediction | `selectDigit('5')` | Digit 5 selected | Both |
| 6 | Buy Over contract | `clickBuy()` — captures payout | Contract purchased; balance reduced by stake | Both |
| 7 | Open the open position's details | `openFirstContract()` + `getBuyReferenceId()` | Buy reference ID captured (pins this contract) | Both |
| 8 | Wait for auto-expiry in place | `waitForContractSettled()` | Sell reference ID appears (contract settled) | Both |
| 9 | Verify settled contract in Positions | Closed tab → `verifyClosedPositionsTab()` — captures signed P/L | Closed card shows market/type/stake/Closed + P/L | Both |
| 10 | Verify settled contract details | `verifyClosedDigitContractDetailsPage()` — asserts Target digit, extracts `sellId` | Ref IDs, Duration, Target, Exit spot/time | Both |
| 11 | Verify final balance | `verifyBalanceAfterContractClose()` | Balance = afterBuy + stake + P/L | Both |
| 12 | Verify settled contract in Reports | `verifyClosedContractInReports(buyId, sellId, …)` | Trade table + Statement rows match | Both |

### Flow 6.2 — Over/Under: buy Under → settle → verify closed

**Prerequisites:** Same as Flow 6.1.
**Spec:** `playwright/tests/trade/over-under/verify-under.spec.ts` — `VERIFY Buy "Under" Contract (Demo Account)` / `(Real Account)`

Identical chain to Flow 6.1 with `selectPredictionOption('Under', 'bottom')` (purchase button turns red) — buy Under → open details → settle in place → verify the closed contract in Positions, contract details, balance, and Reports.

### Flow 6.3 — Over/Under digit, Duration, and Stake validation

> Split from Flow 14. Single no-purchase journey: digit subtype boundaries, ticks-only Duration, then Stake runtime limits.

**Prerequisites:** Authenticated (`TEST_EMAIL_OVER_UNDER` / `TEST_EMAIL_OVER_UNDER_MOBILE`). Digits symbol (e.g. Volatility 10 Index).
**Spec:** `playwright/tests/trade/over-under/verify-over-under-validations.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select Over/Under | `selectMarketAndTradeType('Volatility 10 Index', 'Over/Under')` | Last digit prediction visible | Both |
| 2 | Digit boundaries | `verifyLastDigitPredictionChoiceAvailability()` | Digits 0–9 listed; Over disables 9; Under disables 0 | Both |
| 3 | Duration | `verifyDurationGuardrails('Over/Under')` → `verifyBuyButtonRemainsEnabled()` | No unit tabs; desktop **6** quick-pick chips (values within **1–10 ticks**, not fixed); mobile wheel 1–10; desktop Custom: draft min−1 / max+1 → `Please enter a duration between {{min}} to {{max}} ticks.` + Save disabled; rejected drafts leave Buy unchanged | Both |
| 4 | Stake | `verifyStakeGuardrails('Over/Under')` → `verifyBuyButtonRemainsEnabled()` → `dismissStakeEditor()` | **6** quick-pick chips; Custom: `0` → min-stake error + Save disabled; max-payout+1 → payout-limits error + Save disabled; rejected drafts leave Buy unchanged | Both |

> **POM:** call leaf helpers directly after one select (dedicated trade-type pattern). Matrix specs still use `*ForConfiguration`.

### Flow 6.4 — Higher/Lower → Over/Under proposal uses last_digit

> Covers regression for #1384. Switching from Higher/Lower (price barrier) to Over/Under must not leave a stale `barrier` on the digit proposal — Buy must price with `last_digit` and stay enabled. No purchase.

**Prerequisites:** Same Over/Under shared account as Flow 6.3.
**Spec:** `playwright/tests/trade/over-under/verify-over-under-validations.spec.ts`
**Unique params:** Barrier on Higher/Lower → digit on Over/Under

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Seed Higher/Lower barrier | `selectMarketAndTradeType(…, 'Higher/Lower')` + `setBarrier` | Relative price barrier committed | Both |
| 2 | Switch to Over/Under | `selectMarketAndTradeType(…, 'Over/Under')` | Last digit prediction visible | Both |
| 3 | Select digit | `selectDigit('7')` | Digit 7 selected | Both |
| 4 | Assert proposal + Buy ready | `verifyProposalAfterHigherLowerToOverUnder()` | No barrier-range toast; Buy enabled; payout priced | Both |

> **POM:** `tradeOverUnderPage.verifyProposalAfterHigherLowerToOverUnder`.

---

## Even/Odd

> **Structural exception — Ticks-only + no digit selector + no manual close:** Same digit-contract structure as Matches/Differs (see that section), but Even/Odd is the **simplest digit type — there is no last-digit selector** (the outcome is whether the final digit is even or odd). Uses the same Ticks-only duration, tab selector → single colored purchase button, and **settle-in-place** verification chain. The audit **Target** row reads "Even" / "Odd".

### Flow 7.1 — Even/Odd: buy Even → settle → verify closed

**Prerequisites:** Authenticated with funded account. Digits symbol (e.g. Volatility 10 Index).
**Spec:** `playwright/tests/trade/even-odd/verify-even.spec.ts` — `VERIFY Buy "Even" Contract (Demo Account)` / `(Real Account)`
**Unique params:** Duration (ticks), Stake (`10.00`) — no digit selector

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select market and trade type | `selectMarketAndTradeType('Volatility 10 Index', 'Even/Odd')` | Chip selected; Last digit prediction NOT visible | Both |
| 2 | Select Even | `selectPredictionOption('Even', 'top')` | Purchase button turns green | Both |
| 3 | Select duration (ticks only) | `selectTicksDuration('10 ticks')` | Duration field shows `10 ticks` | Both |
| 4 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 5 | Buy Even contract | `clickBuy()` — captures payout | Contract purchased; balance reduced by stake | Both |
| 6 | Open the open position's details | `openFirstContract()` + `getBuyReferenceId()` | Buy reference ID captured (pins this contract) | Both |
| 7 | Wait for auto-expiry in place | `waitForContractSettled()` | Sell reference ID appears (contract settled) | Both |
| 8 | Verify settled contract in Positions | Closed tab → `verifyClosedPositionsTab()` — captures signed P/L | Closed card shows market/type/stake/Closed + P/L | Both |
| 9 | Verify settled contract details | `verifyClosedDigitContractDetailsPage()` — Target reads "Even", extracts `sellId` | Ref IDs, Duration, Target, Exit spot/time | Both |
| 10 | Verify final balance | `verifyBalanceAfterContractClose()` | Balance = afterBuy + stake + P/L | Both |
| 11 | Verify settled contract in Reports | `verifyClosedContractInReports(buyId, sellId, …)` | Trade table + Statement rows match | Both |

### Flow 7.2 — Even/Odd: buy Odd → settle → verify closed

**Prerequisites:** Same as Flow 7.1.
**Spec:** `playwright/tests/trade/even-odd/verify-odd.spec.ts` — `VERIFY Buy "Odd" Contract (Demo Account)` / `(Real Account)`

Identical chain to Flow 7.1 with `selectPredictionOption('Odd', 'bottom')` (purchase button turns red) — buy Odd → open details → settle in place → verify the closed contract in Positions, contract details, balance, and Reports.

### Flow 7.3 — Even/Odd Duration and Stake validation

> Split from Flow 14. Single no-purchase journey: ticks-only Duration, then Stake runtime limits. Even/Odd has **no** last-digit prediction.

**Prerequisites:** Authenticated (`TEST_EMAIL_EVEN_ODD` / `TEST_EMAIL_EVEN_ODD_MOBILE`). Digits symbol (e.g. Volatility 10 Index).
**Spec:** `playwright/tests/trade/even-odd/verify-even-odd-validations.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select Even/Odd | `selectMarketAndTradeType('Volatility 10 Index', 'Even/Odd')` | Chip selected; last digit prediction **not** visible | Both |
| 2 | Duration | `verifyDurationGuardrails('Even/Odd')` → `verifyBuyButtonRemainsEnabled()` | No unit tabs; desktop **6** quick-pick chips (values within **1–10 ticks**, not fixed); mobile wheel 1–10; desktop Custom: draft min−1 / max+1 → `Please enter a duration between {{min}} to {{max}} ticks.` + Save disabled; rejected drafts leave Buy unchanged | Both |
| 3 | Stake | `verifyStakeGuardrails('Even/Odd')` → `verifyBuyButtonRemainsEnabled()` → `dismissStakeEditor()` | **6** quick-pick chips; Custom: `0` → min-stake error + Save disabled; max-payout+1 → payout-limits error + Save disabled; rejected drafts leave Buy unchanged | Both |

> **POM:** call leaf helpers directly after one select (dedicated trade-type pattern). Matrix specs still use `*ForConfiguration`.

---

## Accumulators

> **Structural exception — close from trade page + auto-settle:** When an active accumulator is open, the purchase button on the trade page changes to "Close [amount] [currency]"; close is performed from the trade page directly (not the contract details footer). An accumulator can also **auto-settle** at any time — the spot hitting the **barrier** (loss) or the **take profit** (win) sells the contract, and the "Close" button reverts to "Buy". The implementation is therefore **close-reason agnostic**: it ensures the contract ends settled (manual close for 8.1; wait-for-auto-settle with a manual-close fallback for 8.2) and verifies the **settled (closed)** contract — Positions Closed tab, contract details, balance, and Reports — without asserting _how_ it closed. Because a low take profit can auto-settle within a tick or two, open-position assertions and the open-position Reports grid are **not** verified; the Take profit is instead asserted on the **trade form** before buying.

### Flow 8.1 — Accumulators without Take Profit: buy → close

**Prerequisites:** Authenticated with funded account. Symbol supporting Accumulators (e.g. Volatility 100 Index). Only one active accumulator per symbol at a time.
**Spec:** `playwright/tests/trade/accumulators/verify-accumulators-no-tp.spec.ts` — `VERIFY Buy Accumulators Contract Without Take Profit and Close (Demo Account)` / `(Real Account)`
**Unique params:** Growth rate (`5%`), Stake (`10.00`) — NO Duration, Take profit left off

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 Index', 'Accumulators')` | Chip selected; Growth rate, Take profit, Stake visible | Both |
| 3 | Verify no Duration param | Observe parameters | "Duration" NOT visible | Both |
| 4 | Set growth rate to 5% | `setGrowthRate('5%')` | Growth rate shows `5%` | Both |
| 5 | Verify Take profit param visible | Observe parameters | "Take profit" parameter visible | Both |
| 6 | Verify Take profit is off | Observe take profit toggle | Take profit toggle is off by default | Both |
| 7 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 8 | Buy Accumulators contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 9 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 10 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |
| 11 | Close contract from trade page | Click "Close [amount] [currency]" on purchase button (trade page) | Contract closed | Both |
| 12 | Verify closed contract card | `verifyClosedPositionsTab()` — captures P&L | Card shows market, trade type, stake, "Closed" status, P&L | Both |
| 13 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 14 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 15 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

### Flow 8.2 — Accumulators with Take Profit: buy → TP closes contract

**Prerequisites:** Same as Flow 8.1.
**Spec:** `playwright/tests/trade/accumulators/verify-accumulators-with-tp.spec.ts` — `VERIFY Buy Accumulators Contract With Take Profit and Close (Demo Account)` / `(Real Account)`
**Unique params:** Growth rate (`5%`), Take profit toggle + input (`4.00`) enabled

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 Index', 'Accumulators')` | Chip selected; Growth rate, Take profit, Stake visible | Both |
| 3 | Set growth rate to 5% | `setGrowthRate('5%')` | Growth rate shows `5%` | Both |
| 4 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 5 | Enable take profit | Toggle take profit on | Take profit input appears (`dt_take_profit_input` / `dt_tp_input`) | Both |
| 6 | Set take profit amount | Enter `4.00` in take profit input | Take profit shows `4.00` | Both |
| 7 | Save take profit | Click "Save" | Take profit applied | Both |
| 8 | Buy Accumulators contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 9 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 10 | Verify TP set in contract details | `openFirstContract()` + observe TP field | Contract details shows TP amount `4.00` | Both |
| 11 | Close contract from trade page | Click "Close [amount] [currency]" on purchase button (trade page) | Contract closed | Both |
| 12 | Verify closed contract card | `verifyClosedPositionsTab()` — captures P&L | Card shows market, trade type, stake, "Closed" status, P&L | Both |
| 13 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |

---

### Flow 8.3 — Accumulators Growth rate, Stake, and Take profit validation

> Split from Flow 14. Single no-purchase journey: Growth rate discrete options, Stake Range guardrails, then standalone Take profit runtime limits. Accumulators have **no Duration**.

**Prerequisites:** Authenticated (`TEST_EMAIL_ACCUMULATORS` / `TEST_EMAIL_ACCUMULATORS_MOBILE`). Symbol supporting Accumulators (e.g. Volatility 100 Index).
**Spec:** `playwright/tests/trade/accumulators/verify-accumulators-validations.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select Accumulators | `selectMarketAndTradeType('Volatility 100 Index', 'Accumulators', { verifyParams: false })` | Chip selected; Growth rate / Take profit / Stake available | Both |
| 2 | Growth rate | `verifyGrowthRateGuardrails()` | Options are exactly `1%` · `2%` · `3%` · `4%` · `5%` | Both |
| 3 | Stake | `verifyStakeGuardrails('Accumulators')` | **6** quick-pick chips; Custom: `0` → min-stake error + Save disabled; max+1 → Range error + Save disabled; rejected drafts leave Buy unchanged | Both |
| 4 | Take profit | `verifyTakeProfitGuardrails()` → `verifyBuyButtonRemainsEnabled()` | Standalone TP (no Risk management); below-min / above-max drafts show the bound + Save disabled; committed TP unchanged | Both |

> **POM:** call leaf helpers directly after one select (dedicated trade-type pattern). Duplicate-Buy / settle recovery stays in Flow 14.

---

## Multipliers

### Flow 9.1 — Multipliers no TP/SL: buy Up → close contract

**Prerequisites:** Authenticated with funded account. Symbol supporting Multipliers (e.g. Volatility 100 (1s) Index).
**Spec:** `playwright/tests/trade/multipliers/verify-multipliers-no-tpsl.spec.ts` — `VERIFY Buy "Up" Multipliers Contract and Close (without TP/SL) (Demo Account)` / `(Real Account)`
**Unique params:** Multiplier (`x200`), Stake (`5.40`) — NO Duration, NO TP/SL

> **Structural note:** Multipliers has no Duration param and no Barrier. The trade-page info panel (and the mobile Stake sheet) shows **Stop out** (loss amount, `$N.NN`), **Stop out level** (bare price) and **Commission** (`$N.NN`). Commission is also rendered on the contract details page from the API, and it is that copy the buy/sell assertions use: it is captured from the open contract details page and asserted exactly on the closed page.
>
> **Stop out capture:** `readStopOut()` stores the **numeric** amount (`20.00`), not `$20.00`. Trade params use `$N.NN`; **contract details still render Money as `-20.00 USD`**. Mobile closed Order Details "Stop out level" is asserted with `toContainText` on that numeric. On mobile, Stop out lives only in the Stake sheet — reopen it, read the rows, dismiss with **Close** (header Save stays disabled while the draft equals the committed stake).

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 (1s) Index', 'Multipliers')` | Chip selected; Multiplier, Risk management, Stake visible | Both |
| 3 | Select Up direction | `clickUpDownOption('Up')` | "Up" segment selected | Both |
| 4 | Set multiplier value | `setMultiplier('x200')` | Multiplier field shows `x200` | Both |
| 5 | Set stake | `setStake('5.40')` | Stake field shows `5.40` | Both |
| 6 | Capture pre-buy values | `readStopOut()` — `stopOutValue` + assert `stopOutLevelValue` + `commissionValue` present | Numeric `stopOut` captured; Stop out level + Commission rows visible (values not captured — #1413) | Both |
| 7 | Buy Up contract | `clickMultipliersBuy()` | Contract purchased; buy date captured | Both |
| 8 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyBalanceAfterContractPurchase()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 9 | Verify open position in Reports | `verifyOpenPositionsInReportsForMultipliers(currency, stake, multiplier)` | Multiplier, currency, stake, contract cost, contract value all correct | Both |
| 10 | Open contract details (open) | `verifyMultipliersContractDetailsPage()` — captures `buyId` + `entrySpot` + `commission` | Ref. ID, Multiplier, Commission (captured), Start time, Entry spot visible | Both |
| 11 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 12 | Verify closed contract card | `verifyClosedPositionsTab()` — captures `contractProfitLossAmount` | Card shows market, trade type, stake, P&L | Both |
| 13 | Open contract details (closed) | `verifyClosedMultipliersContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs; Multiplier, Stake, Commission (matches open), Stop out level (mobile, contains numeric `stopOut` in `-N.NN USD`); Start time, Entry spot (exact), Exit time/spot | Both |
| 14 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 15 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 16 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

> **Mobile date format:** Entry/exit details section renders dates as `DD Mon YYYY` (e.g. `07 Jul 2026`). The ISO `buyDate` is converted internally — no extra param needed.

### Flow 9.2 — Multipliers no TP/SL: buy Down → close contract

**Prerequisites:** Same as Flow 9.1.
**Spec:** `playwright/tests/trade/multipliers/verify-multipliers-no-tpsl.spec.ts` — `VERIFY Buy "Down" Multipliers Contract and Close (without TP/SL) (Demo Account)` / `(Real Account)`
**Unique params:** Multiplier (`x300`), Stake (`5.88`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 (1s) Index', 'Multipliers')` | Chip selected; Multiplier, Risk management, Stake visible | Both |
| 3 | Select Down direction | `clickUpDownOption('Down')` | "Down" segment selected | Both |
| 4 | Set multiplier value | `setMultiplier('x300')` | Multiplier field shows `x300` | Both |
| 5 | Set stake | `setStake('5.88')` | Stake field shows `5.88` | Both |
| 6 | Capture pre-buy values | `readStopOut()` — `stopOutValue` + assert `stopOutLevelValue` + `commissionValue` present | Numeric `stopOut` captured; Stop out level + Commission rows visible (values not captured — #1413) | Both |
| 7 | Buy Down contract | `clickMultipliersBuy()` | Contract purchased; buy date captured | Both |
| 8 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyBalanceAfterContractPurchase()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 9 | Verify open position in Reports | `verifyOpenPositionsInReportsForMultipliers(currency, stake, multiplier)` | Multiplier, currency, stake, contract cost, contract value all correct | Both |
| 10 | Open contract details (open) | `verifyMultipliersContractDetailsPage()` — captures `buyId` + `entrySpot` + `commission` | Ref. ID, Multiplier, Commission (captured), Start time, Entry spot visible | Both |
| 11 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 12 | Verify closed contract card | `verifyClosedPositionsTab()` — captures `contractProfitLossAmount` | Card shows market, trade type, stake, P&L | Both |
| 13 | Open contract details (closed) | `verifyClosedMultipliersContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs; Multiplier, Stake, Commission (matches open), Stop out level (mobile, contains numeric `stopOut` in `-N.NN USD`); Start time, Entry spot (exact), Exit time/spot | Both |
| 14 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 15 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 16 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

---

### Flow 9.3 — Multipliers with Take Profit: buy Up → close contract

**Prerequisites:** Same as Flow 9.1.
**Spec:** `playwright/tests/trade/multipliers/verify-multipliers-with-tp.spec.ts` — `VERIFY Buy "Up" Multipliers Contract With Take Profit and Close (Demo Account)` / `(Real Account)`
**Unique params:** TP (`30.01`), Multiplier (`x160`), Stake (`10.00`), Market (`Volatility 25 (1s) Index`)

> **Implementation notes:**
>
> - TP input on mobile requires `pressSequentially` + `Tab` press to blur, then a 1500ms wait for the API response before clicking Save. The "acceptable range" hint can render from stale store state and is not a reliable guard alone — `is_api_response_tp_received_ref` must be `true` (set by API response) or `onSave()` returns early.
> - Commission is shown on the trade panel and the Stake sheet alongside Stop out and Stop out level; `readStopOut()` asserts all three rows are non-empty (#1413). Pre-buy capture still stores only the numeric Stop out amount. Commission for buy/sell assertions is captured from the open contract details page.
> - Open positions card on mobile renders TP as `"30.01"` (no `+` prefix); desktop renders `"+30.01"`.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 25 (1s) Index', 'Multipliers')` | Chip selected; Multiplier, Risk management, Stake visible | Both |
| 3 | Select Up direction | `clickUpDownOption('Up')` | "Up" segment selected | Both |
| 4 | Set multiplier value | `setMultiplier('x160')` | Multiplier field shows `x160` | Both |
| 5 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 6 | Capture pre-buy values | `readStopOut()` — `stopOutValue` + assert `stopOutLevelValue` + `commissionValue` present | Numeric `stopOut` captured; Stop out level + Commission rows visible (values not captured — #1413) | Both |
| 7 | Set risk management (TP) | `setRiskManagement({ takeProfit: '30.01' })` — opens panel, toggles TP on, types value, Tab, wait, Save | TP of `30.01` applied; risk management closes | Both |
| 8 | Buy Up contract | `clickMultipliersBuy()` | Contract purchased; buy date captured | Both |
| 9 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyBalanceAfterContractPurchase()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake; TP shown as `30.01` (mobile) / `+30.01` (desktop) | Both |
| 10 | Verify open position in Reports | `verifyOpenPositionsInReportsForMultipliers(currency, stake, multiplier)` | Multiplier, currency, stake, contract cost, contract value all correct | Both |
| 11 | Open contract details (open) | `verifyMultipliersContractDetailsPage()` — captures `buyId` + `entrySpot` + `commission` | Ref. ID, Multiplier, Commission (captured), Start time, Entry spot visible; TP amount shown | Both |
| 12 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 13 | Verify closed contract card | `verifyClosedPositionsTab()` — captures `contractProfitLossAmount` | Card shows market, trade type, stake, P&L | Both |
| 14 | Open contract details (closed) | `verifyClosedMultipliersContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs; Multiplier, Stake, Commission (matches open), Stop out level (mobile, `-N.NN USD`); Take profit (`30.01`), Stop loss (Not set); Start time, Entry spot, Exit time/spot | Both |
| 15 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 16 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 17 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

### Flow 9.4 — Multipliers with Take Profit: buy Down → close contract

**Prerequisites:** Same as Flow 9.3.
**Spec:** `playwright/tests/trade/multipliers/verify-multipliers-with-tp.spec.ts` — `VERIFY Buy "Down" Multipliers Contract With Take Profit and Close (Demo Account)` / `(Real Account)`
**Unique params:** TP (`21.32`), Stake (`11.11`), Multiplier (`x400`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 25 (1s) Index', 'Multipliers')` | Chip selected | Both |
| 3 | Select Down direction | `clickUpDownOption('Down')` | "Down" segment selected | Both |
| 4 | Set multiplier value | `setMultiplier('x400')` | Multiplier field shows `x400` | Both |
| 5 | Set stake | `setStake('11.11')` | Stake field shows `11.11` | Both |
| 6 | Capture pre-buy values | `readStopOut()` — `stopOutValue` + assert `stopOutLevelValue` + `commissionValue` present | Numeric `stopOut` captured; Stop out level + Commission rows visible (values not captured — #1413) | Both |
| 7 | Set risk management (TP) | `setRiskManagement({ takeProfit: '21.32' })` | TP of `21.32` applied | Both |
| 8 | Buy Down contract | `clickMultipliersBuy()` | Contract purchased; buy date captured | Both |
| 9 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyBalanceAfterContractPurchase()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake; TP shown as `21.32` (mobile) / `+21.32` (desktop) | Both |
| 10 | Verify open position in Reports | `verifyOpenPositionsInReportsForMultipliers(currency, stake, multiplier)` | Multiplier, currency, stake, contract cost, contract value all correct | Both |
| 11 | Open contract details (open) | `verifyMultipliersContractDetailsPage()` — captures `buyId` + `entrySpot` + `commission` | Ref. ID, Multiplier, Commission (captured), Start time, Entry spot visible; TP amount shown | Both |
| 12 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 13 | Verify closed contract card | `verifyClosedPositionsTab()` — captures `contractProfitLossAmount` | Card shows market, trade type, stake, P&L | Both |
| 14 | Open contract details (closed) | `verifyClosedMultipliersContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs; Multiplier, Stake, Commission (matches open), Stop out level (mobile, `-N.NN USD`); Take profit (`21.32`), Stop loss (Not set); Start time, Entry spot, Exit time/spot | Both |
| 15 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 16 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 17 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

---

### Flow 9.5 — Multipliers with Stop Loss: buy Up → close contract

**Prerequisites:** Same as Flow 9.1.
**Spec:** `playwright/tests/trade/multipliers/verify-multipliers-with-sl.spec.ts` — `VERIFY Buy "Up" Multipliers Contract With Stop Loss and Close (Demo Account)` / `(Real Account)`
**Unique params:** SL (`21.10`), Multiplier (`x200`), Stake (`25.05`), Market (`Volatility 50 (1s) Index`)

> **Implementation notes:**
>
> - SL input on mobile requires `pressSequentially` + `Tab` press to blur, then wait for the "Range" hint (`slAcceptableRangeHint`) to appear, then a 1500ms wait before clicking Save. The `is_api_response_received_ref` guard must be `true` (set by API response) or `onSave()` returns early.
> - Open positions card (mobile) renders SL as `-21.10 ` (negative prefix + trailing space) — use `new RegExp('^-${stopLoss}\\s*$')` in the assertion.
> - Contract details page (mobile) verifies: trade type (`Multipliers Up`), stake (`25.05 USD`), TP badge absent, SL badge present, SL toggle `aria-pressed="true"`, SL input value (`-21.10 USD`), start time contains `buyDate`, TP/SL history section with label/value rows.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 50 (1s) Index', 'Multipliers')` | Chip selected; Multiplier, Risk management, Stake visible | Both |
| 3 | Select Up direction | `clickUpDownOption('Up')` | "Up" segment selected | Both |
| 4 | Set multiplier value | `setMultiplier('x200')` | Multiplier field shows `x200` | Both |
| 5 | Set stake | `setStake('25.05')` | Stake field shows `25.05` | Both |
| 6 | Capture pre-buy values | `readStopOut()` — `stopOutValue` + assert `stopOutLevelValue` + `commissionValue` present | Numeric `stopOut` captured; Stop out level + Commission rows visible (values not captured — #1413) | Both |
| 7 | Set risk management (SL) | `setRiskManagement({ stopLoss: '21.10' })` — opens panel, toggles SL on, types value, Tab, wait, Save | SL of `21.10` applied; risk management closes | Both |
| 8 | Buy Up contract | `clickMultipliersBuy()` | Contract purchased; buy date captured | Both |
| 9 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyBalanceAfterContractPurchase()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake; SL shown as `-21.10 ` (mobile) / `-21.10` (desktop) | Both |
| 10 | Verify open position in Reports | `verifyOpenPositionsInReportsForMultipliers(currency, stake, multiplier)` | Multiplier, currency, stake, contract cost, contract value all correct | Both |
| 11 | Open contract details (open) | `verifyMultipliersContractDetailsPage()` — captures `buyId` + `entrySpot` + `commission` | Ref. ID, Multiplier, Commission (captured), Start time, Entry spot visible; SL amount shown; mobile: trade type, stake, TP badge absent, SL badge present, toggles, history | Both |
| 12 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 13 | Verify closed contract card | `verifyClosedPositionsTab()` — captures `contractProfitLossAmount` | Card shows market, trade type, stake, P&L | Both |
| 14 | Open contract details (closed) | `verifyClosedMultipliersContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs; Multiplier, Stake, Commission (matches open), Stop out level (mobile, `-N.NN USD`); Take profit (Not set), Stop loss (`21.10`); Start time, Entry spot, Exit time/spot | Both |
| 15 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 16 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 17 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

> **Mobile SL display:** Open positions card renders SL as `-21.10 ` (negative prefix + trailing space) — asserted with `new RegExp('^-21.10\\s*$')`.
> **Mobile date format:** Entry/exit details section renders dates as `DD Mon YYYY` (e.g. `07 Jul 2026`). The ISO `buyDate` is converted internally — no extra param needed.

### Flow 9.6 — Multipliers with Stop Loss: buy Down → close contract

**Prerequisites:** Same as Flow 9.5.
**Spec:** `playwright/tests/trade/multipliers/verify-multipliers-with-sl.spec.ts` — `VERIFY Buy "Down" Multipliers Contract With Stop Loss and Close (Demo Account)` / `(Real Account)`
**Unique params:** SL (`23.01`), Multiplier (`x600`), Stake (`25.00`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 50 (1s) Index', 'Multipliers')` | Chip selected | Both |
| 3 | Select Down direction | `clickUpDownOption('Down')` | "Down" segment selected | Both |
| 4 | Set multiplier value | `setMultiplier('x600')` | Multiplier field shows `x600` | Both |
| 5 | Set stake | `setStake('25.00')` | Stake field shows `25.00` | Both |
| 6 | Capture pre-buy values | `readStopOut()` — `stopOutValue` + assert `stopOutLevelValue` + `commissionValue` present | Numeric `stopOut` captured; Stop out level + Commission rows visible (values not captured — #1413) | Both |
| 7 | Set risk management (SL) | `setRiskManagement({ stopLoss: '23.01' })` | SL of `23.01` applied | Both |
| 8 | Buy Down contract | `clickMultipliersBuy()` | Contract purchased; buy date captured | Both |
| 9 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyBalanceAfterContractPurchase()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake; SL shown as `-23.01 ` (mobile) / `-23.01` (desktop) | Both |
| 10 | Verify open position in Reports | `verifyOpenPositionsInReportsForMultipliers(currency, stake, multiplier)` | Multiplier, currency, stake, contract cost, contract value all correct | Both |
| 11 | Open contract details (open) | `verifyMultipliersContractDetailsPage()` — captures `buyId` + `entrySpot` + `commission` | Ref. ID, Multiplier, Commission (captured), Start time, Entry spot visible; SL amount shown; mobile: trade type `Multipliers Down`, stake, TP badge absent, SL badge present, toggles, history | Both |
| 12 | Close contract | `closeFirstContract()` | Contract card disappears from Positions | Both |
| 13 | Verify closed contract card | `verifyClosedPositionsTab()` — captures `contractProfitLossAmount` | Card shows market, trade type, stake, P&L | Both |
| 14 | Open contract details (closed) | `verifyClosedMultipliersContractDetailsPage()` — captures `sellId` | Buy + Sell Ref. IDs; Multiplier, Stake, Commission (matches open), Stop out level (mobile, `-N.NN USD`); Take profit (Not set), Stop loss (`23.01`); Start time, Entry spot, Exit time/spot | Both |
| 15 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance = balanceBeforeClose + stake + P&L | Both |
| 16 | Reports — Trade table | `verifyClosedContractInReports()` step 2 | Row by `buyId`; dates, stake, contract value, P&L correct | Both |
| 17 | Reports — Statement | `verifyClosedContractInReports()` step 3 | Sell row (by `sellId`) + Buy row (by `buyId`); balances correct | Both |

---

### Flow 9.7 — Multipliers with Deal Cancellation: buy Up → cancel contract

**Prerequisites:** Same as Flow 9.1. Deal cancellation available for selected symbol.
**Spec:** `playwright/tests/trade/multipliers/verify-multipliers-deal-cancellation.spec.ts` — `VERIFY Buy "Up" Multipliers Contract With Deal Cancellation and Cancel (Demo Account)` / `(Real Account)`
**Unique params:** Market (`Volatility 75 Index`), Multiplier (`x300`), DC (`5 min`); DC timer badge (`dt_deal_cancellation_badge`)

> **Structural exception:** Deal Cancellation contracts use a "Cancel [mm:ss]" button in the contract details footer — not "Close [amount] [currency]". **Desktop (#899):** the same Cancel also appears on the open-position card in the flyout (`.contract-card__cancel-btn`); Flow 9.7/9.8 assert it before opening details. Cancel in the spec still runs from contract details. Reports/Statement are skipped.
>
> **Buy button:** with DC active the button reads **"Total cost $N.NN"** (symbol-prefixed, no Money `dt_span`). Capture that amount before buying — it is stake + DC fee + commission, and it is what the Positions card Stake row and the balance deduction use.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 75 Index', 'Multipliers')` | Chip selected | Both |
| 3 | Set stake | `setStake('20.00')` | Stake field shows `20.00` | Both |
| 4 | Set multiplier value | Select `x300` in multiplier selector | Multiplier shows `x300` | Both |
| 5 | Open Risk management | Click "Risk management" param | Panel opens | Both |
| 6 | Enable Deal cancellation | Select "Deal cancellation" tab | DC selected; saving DC turns TP/SL off (mutually exclusive) | Both |
| 7 | Save | Click "Save" | DC applied; risk field shows `DC: 5 minutes` | Both |
| 8 | Capture Total cost and buy | Assert Buy shows "Total cost"; read `multipliersTotalCost`; `readStopOut()`; `clickMultipliersBuy()` | Total cost `$N.NN` captured as numeric; contract purchased | Both |
| 9 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyMultipliersContractCardDetails()` + `verifyDesktopDealCancellationCancelOnOpenCard()` (desktop) | Card visible; desktop flyout shows `.contract-card__cancel-btn` (#899); balance reduced by Total cost | Both |
| 10 | Open contract details | `openFirstContract()` + `verifyMultipliersContractDetailsPage()` + `verifyDealCancellationAvailable()` | Open details: contract cost = stake, Stake = Total cost, DC fee set, Cancel countdown | Both |
| 11 | Cancel contract | Click "Cancel [mm:ss]" button | Contract cancelled | Both |
| 12 | Verify closed position | Closed tab + `verifyClosedMultipliersContractDetailsPage()` | Card and details show executed DC; P/L equals the kept fee | Both |
| 13 | Verify balance after cancel | `verifyBalanceAfterContractClose()` | Balance = after-buy + Total cost + P/L | Both |

### Flow 9.8 — Multipliers with Deal Cancellation: buy Down → cancel contract

**Prerequisites:** Same as Flow 9.7.
**Spec:** `playwright/tests/trade/multipliers/verify-multipliers-deal-cancellation.spec.ts` — `VERIFY Buy "Down" Multipliers Contract With Deal Cancellation and Cancel (Demo Account)` / `(Real Account)`
**Unique params:** Multiplier (`x300`), Stake (`21.00`), DC (`10 min`)

> **Structural exception:** Same as Flow 9.7 — cancel from details, then Closed tab + closed details; no Reports/Statement.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1–7 | Setup (same as Flow 9.7 steps 1–7) | Same setup steps | DC applied | Both |
| 8 | Capture Total cost and buy | Assert Buy shows "Total cost"; read `multipliersTotalCost`; `readStopOut()`; `clickMultipliersBuy()` | Total cost `$N.NN` captured as numeric; contract purchased | Both |
| 9 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyMultipliersContractCardDetails()` + `verifyDesktopDealCancellationCancelOnOpenCard()` (desktop) | Card visible; desktop flyout shows `.contract-card__cancel-btn` (#899); balance reduced by Total cost | Both |
| 10 | Open contract details | `openFirstContract()` + `verifyMultipliersContractDetailsPage()` + `verifyDealCancellationAvailable()` | Open details + DC timer/Cancel | Both |
| 11 | Cancel contract | Click "Cancel [mm:ss]" button | Contract cancelled | Both |
| 12 | Verify closed position | Closed tab + `verifyClosedMultipliersContractDetailsPage()` | Executed DC on closed details | Both |
| 13 | Verify balance after cancel | `verifyBalanceAfterContractClose()` | Balance = after-buy + Total cost + P/L | Both |

### Flow 9.9 — Multipliers Multiplier, Stake, and Risk management validation

> Split from Flow 14. Single no-purchase journey on Volatility 25 (1s) Index: Multipliers have **no Duration**; Multiplier discrete choices, Stake Range (+ Stop out / Commission rows), Risk management TP/SL out-of-range drafts, Deal Cancellation (always-visible tab + five minutes chips), and TP/SL ↔ DC mutual exclusivity on Save.

**Prerequisites:** Authenticated (`TEST_EMAIL_MULTIPLIERS` / `TEST_EMAIL_MULTIPLIERS_MOBILE`). Symbol supporting Multipliers (e.g. Volatility 25 (1s) Index).
**Spec:** `playwright/tests/trade/multipliers/verify-multipliers-validations.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select Multipliers | `selectMarketAndTradeType('Volatility 25 (1s) Index', 'Multipliers')` | Chip selected; Multiplier + Risk management + Stake visible | Both |
| 2 | Duration | `verifyDurationGuardrails('Multipliers')` | Duration field absent | Both |
| 3 | Multiplier | `verifyMultiplierGuardrails()` | Runtime `xN` choices; committed value in list; editor dismissed | Both |
| 4 | Stake | `verifyStakeGuardrails('Multipliers')` | **6** chips; Custom Range + Stop out / Stop out level / Commission; out-of-range Save disabled | Both |
| 5 | Risk management | `verifyMultipliersRiskManagementGuardrails()` → `verifyBuyButtonRemainsEnabled()` | TP and SL each: below-min / above-max show bound + Save disabled; in-range restores `Range: … to …`; `verifyDealCancellationGuardrails` (five minutes chips); `verifyRiskManagementMutualExclusivity` (DC Save → `TP and SL have been turned off.` / `DC: 5 minutes`; TP+SL Save → `DC has been turned off.`); Buy stays enabled | Both |

> **POM:** call leaf helpers directly after one select. Multipliers lifecycle buy/close stays in Flow 9.1–9.8.

---

## Turbos

> **Implementation note:** Turbos have no _trade-page_ (Accumulator-style) close button, but they **are early-sellable from the contract-details footer** (`isValidToSell`). The tests use a short **Minutes** duration (so the positions card shows a remaining-time countdown and `verifyContractCardDetails` works unchanged), stake **`10.50`**, verify the open position, then **close early via `ContractDetailsPage.sellContract()`** (which retries on `PriceMoved` slippage) and verify the full closed chain (Closed tab → balance-after-close → Reports). TP flows also assert the TP amount on the open contract details before closing.

### Flow 10.1 — Turbos without TP: buy Up → verify in positions

**Prerequisites:** Authenticated with funded account. Symbol supporting Turbos (e.g. Volatility 100 (1s) Index).
**Spec:** `playwright/tests/trade/turbos/verify-turbos-up.spec.ts` — `VERIFY Buy "Up" Turbos Contract (Demo Account)` / `(Real Account)`
**Unique params:** Duration, Payout per point (`dt_payout-per-point_wrapper`), Stake (`10.00`) — Take profit off by default

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 (1s) Index', 'Turbos')` | Turbos chip selected | Both |
| 3 | Verify Duration param visible | Observe parameters | "Duration" parameter visible | Both |
| 4 | Verify Payout per point visible | Observe parameters | "Payout per point" parameter visible | Both |
| 5 | Verify Take profit param visible | Observe parameters | "Take profit" parameter visible | Both |
| 6 | Verify Take profit is off | Observe take profit toggle | Take profit toggle is off by default | Both |
| 7 | Verify Barrier info panel visible | Observe below parameters | Barrier info panel visible | Both |
| 8 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 9 | Buy Up contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 10 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 11 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |

### Flow 10.2 — Turbos without TP: buy Down → verify in positions

**Prerequisites:** Same as Flow 10.1.
**Spec:** `playwright/tests/trade/turbos/verify-turbos-down.spec.ts` — `VERIFY Buy "Down" Turbos Contract (Demo Account)` / `(Real Account)`
**Unique params:** Stake (`10.00`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 (1s) Index', 'Turbos')` | Turbos chip selected | Both |
| 3 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 4 | Buy Down contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 5 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 6 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |

### Flow 10.3 — Turbos with Take Profit: buy Up → verify TP set in positions

**Prerequisites:** Same as Flow 10.1.
**Spec:** `playwright/tests/trade/turbos/verify-turbos-up-with-tp.spec.ts` — `VERIFY Buy "Up" Turbos Contract With Take Profit (Demo Account)` / `(Real Account)`
**Unique params:** TP (`20.00`), Stake (`10.00`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 (1s) Index', 'Turbos')` | Turbos chip selected | Both |
| 3 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 4 | Enable take profit | Toggle take profit on | TP input appears (`dt_take_profit_input` / `dt_tp_input`) | Both |
| 5 | Set take profit amount | Enter `20.00` in take profit input | TP input shows `20.00` | Both |
| 6 | Save take profit | Click "Save" | Take profit applied | Both |
| 7 | Buy Up contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 8 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 9 | Open contract details | `openFirstContract()` + `verifyContractDetailsPage()` | Contract details shows TP amount `20.00` | Both |
| 10 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |

### Flow 10.4 — Turbos with Take Profit: buy Down → verify TP set in positions

**Prerequisites:** Same as Flow 10.3.
**Spec:** `playwright/tests/trade/turbos/verify-turbos-down-with-tp.spec.ts` — `VERIFY Buy "Down" Turbos Contract With Take Profit (Demo Account)` / `(Real Account)`
**Unique params:** TP (`20.00`), Stake (`10.00`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 (1s) Index', 'Turbos')` | Turbos chip selected | Both |
| 3 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 4 | Enable take profit | Toggle take profit on | TP input appears (`dt_take_profit_input` / `dt_tp_input`) | Both |
| 5 | Set take profit amount | Enter `20.00` in take profit input | TP input shows `20.00` | Both |
| 6 | Save take profit | Click "Save" | Take profit applied | Both |
| 7 | Buy Down contract | `clickBuy()` — captures payout | Contract purchased | Both |
| 8 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card visible; balance reduced by stake | Both |
| 9 | Open contract details | `openFirstContract()` + `verifyContractDetailsPage()` | Contract details shows TP amount `20.00` | Both |
| 10 | Verify open position in Reports | `verifyOpenPositionsInReports()` — captures `buyId` | Headers, row values, footer totals correct | Both |

### Flow 10.5 — Turbos Duration, Payout per point, Stake, and Take profit validation

> Split from Flow 14. Single no-purchase journey on Volatility 100 (1s) Index: Duration across offered units, Stake runtime limits, Payout per point discrete choices, then standalone Take profit. Turbos have **no** Higher/Lower-style Barrier editor (barrier is an info panel nested under Payout per point on mobile).

**Prerequisites:** Authenticated (`TEST_EMAIL_TURBOS` / `TEST_EMAIL_TURBOS_MOBILE`). Symbol supporting Turbos (e.g. Volatility 100 (1s) Index).
**Spec:** `playwright/tests/trade/turbos/verify-turbos-validations.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select Turbos | `selectMarketAndTradeType('Volatility 100 (1s) Index', 'Turbos')` | Chip selected; Duration + Payout per point + Stake + Take profit visible | Both |
| 2 | Duration | `verifyDurationGuardrails('Turbos')` | Desktop: offered unit chips + Custom; Mobile: Time/End time wheels (as offered); editors dismissed | Both |
| 3 | Stake | `verifyStakeGuardrails('Turbos')` | **6** quick-pick chips; Custom out-of-range drafts show Range/limit errors + Save disabled; editor dismissed | Both |
| 4 | Payout per point | `verifyPayoutPerPointGuardrails()` | Runtime `payout_choices` list (currency-prefixed, sorted ascending); committed value in list; selecting another choice updates the field (mobile Save waits for barrier proposal) | Both |
| 5 | Take profit | `verifyTakeProfitGuardrails()` → `verifyBuyButtonRemainsEnabled()` | Standalone TP (no Risk management); below-min / above-max drafts show the bound + Save disabled; committed TP unchanged | Both |

> **POM:** call leaf helpers directly after one select (dedicated trade-type pattern). Turbos lifecycle buy/close recovery stays in Flow 14.

---

## Vanillas

> **Contract type label:** Positions and mobile contract details show the combined label (`"Vanillas Call"` / `"Vanillas Put"`). Desktop contract-details drawer shows direction only (`"Call"` / `"Put"`) — assert each surface with the label it actually renders.

### Flow 11.1 — Vanillas: buy Call → close contract

**Prerequisites:** Authenticated with funded account (`createAccountV2viaJS` in spec `beforeAll`). Synthetics symbol supporting Vanillas (e.g. Volatility 100 Index). Spec runs **serial** (Call Demo → Call Real) on a shared account.
**Spec:** `playwright/tests/trade/vanillas/verify-vanillas-call.spec.ts` — `VERIFY Buy "Call" Vanillas Contract (Demo Account)` / `(Real Account)`
**Unique params:** Duration (`5 min`), Strike price (`+0.00`), Stake (`10.00`) — Payout per point info panel

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 Index', 'Vanillas')` | Vanillas chip selected | Both |
| 3 | Verify Strike price param visible | Observe parameters | "Strike price" parameter visible | Both |
| 4 | Verify Duration param visible | Observe parameters | "Duration" parameter visible | Both |
| 5 | Select Call direction | `selectDirection('Call')` | Buy button enabled | Both |
| 6 | Set strike price | `selectStrike('+0.00')` | Strike field shows `+0.00` | Both |
| 7 | Verify Payout per point info visible | Observe below parameters (desktop) / Strike sheet (mobile) | Payout per point visible | Both |
| 8 | Set duration | `selectDuration('Minutes', '5 min')` | Duration field shows `5 min` | Both |
| 9 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 10 | Buy Call contract | `clickVanillasBuy()` | Contract purchased | Both |
| 11 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card shows `"Vanillas Call"`; balance reduced by stake | Both |
| 12 | Verify open position in Reports | `verifyOpenPositionsInReportsForVanillas()` — captures `buyId` | Headers, row values, footer totals correct | Both |
| 13 | Verify open contract details | `verifyVanillasOpenContractDetailsPage()` | Desktop: type `"Call"`; mobile: `"Vanillas Call"`; Strike, payout per point, buyId correct | Both |
| 14 | Close contract from Positions | `closeFirstContract()` | Open tab empty; contract moved to Closed | Both |
| 15 | Verify closed position | `verifyClosedPositionsTab()` + `verifyVanillasClosedContractDetailsPage()` | Closed card `"Vanillas Call"`; desktop details `"Call"`; sell ID correct | Both |
| 16 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance reflects P/L from early close | Both |
| 17 | Verify closed contract in Reports | `verifyClosedContractInReports()` | Trade table + Statement rows correct | Both |

### Flow 11.2 — Vanillas: buy Put → close contract

**Prerequisites:** Same as Flow 11.1.
**Spec:** `playwright/tests/trade/vanillas/verify-vanillas-put.spec.ts` — `VERIFY Buy "Put" Vanillas Contract (Demo Account)` / `(Real Account)`
**Unique params:** Stake (`10.00`), Strike price (`+0.00`)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `page.goto(BASE_URL)` + `waitForDerivApiSettled` | Trade page loaded | Both |
| 2 | Select market and trade type | `selectMarketAndTradeType('Volatility 100 Index', 'Vanillas')` | Vanillas chip selected | Both |
| 3 | Select Put direction | `selectDirection('Put')` | Buy button enabled | Both |
| 4 | Set strike price | `selectStrike('+0.00')` | Strike field shows `+0.00` | Both |
| 5 | Set duration | `selectDuration('Minutes', '5 min')` | Duration field shows `5 min` | Both |
| 6 | Set stake | `setStake('10.00')` | Stake field shows `10.00` | Both |
| 7 | Buy Put contract | `clickVanillasBuy()` | Contract purchased | Both |
| 8 | Verify open position in Positions | `verifyOpenPositionsVisible()` + `verifyContractCardDetails()` | Card shows `"Vanillas Put"`; balance reduced by stake | Both |
| 9 | Verify open position in Reports | `verifyOpenPositionsInReportsForVanillas()` — captures `buyId` | Headers, row values, footer totals correct | Both |
| 10 | Verify open contract details | `verifyVanillasOpenContractDetailsPage()` | Desktop: type `"Put"`; mobile: `"Vanillas Put"`; Strike, payout per point, buyId correct | Both |
| 11 | Close contract from Positions | `closeFirstContract()` | Open tab empty; contract moved to Closed | Both |
| 12 | Verify closed position | `verifyClosedPositionsTab()` + `verifyVanillasClosedContractDetailsPage()` | Closed card `"Vanillas Put"`; desktop details `"Put"`; sell ID correct | Both |
| 13 | Verify balance after close | `verifyBalanceAfterContractClose()` | Balance reflects P/L from early close | Both |
| 14 | Verify closed contract in Reports | `verifyClosedContractInReports()` | Trade table + Statement rows correct | Both |

### Flow 11.3 — Vanillas Duration, Strike, and Stake validation

> Split from Flow 14. Single no-purchase journey on Volatility 100 Index: Duration across offered units, Strike price discrete choices (plus read-only Payout per point info), then Stake runtime limits. Vanillas have **no** Take profit.

**Prerequisites:** Authenticated (`TEST_EMAIL_VANILLAS` / `TEST_EMAIL_VANILLAS_MOBILE`). Symbol supporting Vanillas (e.g. Volatility 100 Index).
**Spec:** `playwright/tests/trade/vanillas/verify-vanillas-validations.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Select Vanillas | `selectMarketAndTradeType('Volatility 100 Index', 'Vanillas')` | Chip selected; Duration + Strike + Stake visible | Both |
| 2 | Duration | `verifyDurationGuardrails('Vanillas')` | Desktop: offered unit chips + Custom; Mobile: Time/End time wheels (as offered); editors dismissed | Both |
| 3 | Strike price | `verifyStrikePriceGuardrails()` | Runtime `barrier_choices` list (signed relative barriers); committed value in list; selecting another choice updates the field; Payout per point info visible (desktop panel / mobile strike sheet row) | Both |
| 4 | Stake | `verifyStakeGuardrails('Vanillas')` → `verifyBuyButtonRemainsEnabled()` | **6** quick-pick chips; Custom out-of-range drafts show Range/limit errors + Save disabled; editor dismissed; Buy stays enabled | Both |

> **POM:** call leaf helpers directly after one select (dedicated trade-type pattern). Vanillas lifecycle buy/close stays in Flow 11.1 / 11.2.

## Flow 12 — Market closed: purchase hidden and open-market recovery · `verify-manual-trade-negative-validation.spec.ts`

**Prerequisites:** Authenticated account and at least one currently closed market returned by staging.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Discover a closed market | Search the live market catalogue for a row tagged `CLOSED` | A closed symbol is selected without assuming its schedule | Both |
| 2 | Verify closed state | Observe trade parameters and reopening status | Buy is absent; reopening status is visible; no stale payout is shown | Both |
| 3 | Recover on an open market | Select Volatility 100 Index / Rise/Fall | Buy returns without remaining in loading state | Both |

## Flow 13 — Insufficient balance: inline-validation gate (post-#1398) · `verify-manual-trade-negative-validation.spec.ts`

**Prerequisites:** Authenticated account whose readable balance is below an in-range stake.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Read live limits and balance | Parse the displayed Stake range and account balance | Amount is generated above balance but inside the current range | Both |
| 2 | Enter unaffordable stake | Fill the generated amount in the stake editor | Balance-aware guidance uses the current account balance | Both |
| 3 | Verify Save gate | Observe Stake Save | Save is disabled while the balance hint shows; draft cannot commit through UI | Both |
| 4 | Commit unaffordable stake | Seed active tab `tab_trade_params_v2` amount + reload | Committed charge exceeds balance on the trade page | Both |
| 5 | Verify Buy ready | Observe Buy, payout, and collapsed Stake | Buy **enabled**; payout quoted (not `-`); collapsed Stake stays **neutral** (no Quill fill-error — #1397); no insufficient-balance popup yet | Both |
| 6 | Verify no submission | Inspect outbound buy count (Buy not clicked) | No buy request is sent | Both |

## Flow 14 — Manual Trading negative validation matrix · `verify-manual-trade-negative-validation.spec.ts`

**Prerequisites:** Authenticated funded staging account. Limits and options are returned by the active contract configuration.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Validate Stake matrix | Run current-limit checks across every Stake-bearing trade type and one representative per market family | Invalid drafts show configuration-specific limits; exact minimum is accepted; committed Stake and Buy stay unchanged | Both |
| 2 | Validate Stake filtering | Type letters, symbols, and excessive precision | Invalid characters are rejected and precision is bounded | Both |
| 3 | Validate Duration | Read desktop range or mobile wheel options | Out-of-range values are blocked; mobile options are bounded | Both |
| 4 | Validate Multipliers risk | Read multiplier, TP/SL ranges, and DC choices | Values come from the active configuration | Both |
| 5 | Validate market families | Inspect all live asset categories | Every major family has a representative | Both |
| 6 | Validate stale values | Switch symbols/types after setting parameters | Retained values belong to the new runtime ranges/options | Both |
| 7 | Validate duplicate purchase | Double-click Accumulators Buy | Exactly one buy request is sent | Both |
| 8 | Validate Accumulator recovery | Settle the Accumulator | Buy returns enabled | Both |
| 9 | Validate Turbos lifecycle | Buy and close a Turbos contract | Open position closes and Buy recovers | Both |

> **Rise/Fall** Duration / Stake on Vol 100 moved to Flow **2.5** (`verify-rise-fall-validations.spec.ts`) — cross-market Rise/Fall sweeps stay here.
> **Higher/Lower** Barrier / Duration / Stake on Vol 100 moved to Flow **3.3** (`verify-higher-lower-validations.spec.ts`).
> **Touch/No Touch** Barrier / Duration / Stake on Vol 100 moved to Flow **4.3** (`verify-touch-no-touch-validations.spec.ts`).
> **Matches/Differs** digit / duration / stake validation moved to Flow **5.3** (`verify-matches-differs-validations.spec.ts`).
> **Over/Under** digit / duration / stake validation moved to Flow **6.3** (`verify-over-under-validations.spec.ts`).
> **Even/Odd** duration / stake validation moved to Flow **7.3** (`verify-even-odd-validations.spec.ts`) — no digit prediction on this type.
> **Accumulators** Growth rate / stake / Take profit validation moved to Flow **8.3** (`verify-accumulators-validations.spec.ts`) — duplicate-Buy recovery stays here.
> **Multipliers** Multiplier / Stake / Risk management validation moved to Flow **9.9** (`verify-multipliers-validations.spec.ts`) — buy/close stays in Flow 9.1–9.8.
> **Turbos** Duration / Payout per point / Stake / Take profit validation moved to Flow **10.5** (`verify-turbos-validations.spec.ts`) — buy/close recovery stays here.
> **Vanillas** Duration / Strike / Stake validation moved to Flow **11.3** (`verify-vanillas-validations.spec.ts`) — buy/close stays in Flow 11.1 / 11.2.

> The current market picker does not expose Asians, Ends Between/Outside, or Stays Between/Goes Outside. Server-only open-position-cap setup is also unavailable with current account tooling; these states are not reported as passing by this flow.

---

## Gap Flows

> **Convention:** `G{n}` labels are triage placeholders only. Once a spec lands, promote the journey to the next **`Flow N`** in Section 1 — do not leave automated rows labelled `G{n}` (see Flow 16 ← former G2, Flow 17.1 ← former G1).

### G2 — Unauthenticated purchase attempt → login prompt sheet

> **Automated:** Flow 16 — `verify-unauthenticated-purchase.spec.ts`

---

## Flow 15 — Market closed → Buy hidden, params disabled, countdown

**Prerequisites:** Authenticated. At least one session-gated market (forex, indices, commodities) must be **CLOSED** in the picker at runtime — typically outside exchange hours.
**Spec:** `playwright/tests/trade/verify-closed-market.spec.ts`

Dedicated E2E for closed-market UI. Flow 12 in `verify-manual-trade-negative-validation.spec.ts` also covers closed-market discovery plus open-market recovery.

The spec searches `FeedPage.MARKETS` session-gated candidates in the market-selection picker (`selectClosedMarketFromPicker()` → `MarketSelectionPage.selectFirstClosedMarket()`), commits the first search row tagged **CLOSED**, then asserts via `verifyClosedMarketTradeState()`: Buy hidden, `ClosedMarketMessage` (reopen intro + `HH:MM:SS` countdown), every `button` / `input` in `.trade-params__options-wrapper` disabled, and **CLOSED** still shown when the picker is reopened. Skips when every candidate is open.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `TradeBasePage.seedLocalStorageOnOrigin()` → `loginPage.login()` → `gotoTradePage()` | Trade page loaded; onboarding overlay suppressed | Both |
| 2 | Find CLOSED market in picker | `selectClosedMarketFromPicker()` — search session-gated symbols | First row with **CLOSED** tag is selected; active tab updates | Both |
| 3 | Verify Buy hidden | Observe purchase area | `dt_purchase_button_wrapper` not visible (`PurchaseButton` not rendered) | Both |
| 4 | Verify reopen countdown | Observe `ClosedMarketMessage` | "This market will reopen at" + `HH:MM:SS` countdown visible (after `trading_times` loads) | Both |
| 5 | Verify params disabled | Observe `.trade-params__options-wrapper` | Every visible `button` / `input` in the row is disabled (`:enabled` count 0) — trade-type agnostic | Both |
| 6 | Verify CLOSED in picker | Reopen picker → search same market | Search row still shows **CLOSED** tag | Both |

---

## Flow 16 — Unauthenticated purchase → login prompt sheet

**Prerequisites:** No authentication. Market open.
**Spec:** `playwright/tests/trade/verify-unauthenticated-purchase.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `tradeParametersPage.gotoTradePage()` | Trade page loads at `/`; login button visible; account info absent | Both |
| 2 | Click Buy while logged out | `tradeParametersPage.clickBuyLoggedOut()` | Authorization `ServiceErrorSheet` opens (desktop: `.quill-modal__container`; mobile: `.service-error-sheet`) | Both |
| 3 | Verify sheet copy and CTAs | `tradeParametersPage.verifyAuthorizationRequiredSheet()` | Title "Start trading with us"; body "Log in or create a free account to place a trade."; both buttons visible | Both |
| 4 | Login button navigates to login | `clickAuthorizationLoginButton()` → `verifyNavigatedToLoginPage()` | Browser lands on Deriv login page (`LOGIN_URL`) | Both |
| 5 | Create account navigates to signup | `clickAuthorizationCreateFreeAccountButton()` → `verifyNavigatedToSignupPage()` | Browser lands on Deriv signup page (`SIGNUP_URL`) | Both |

> Steps 4 and 5 are separate tests — each starts from step 1–3 via shared `beforeEach`.

---

## Flow 17 — Insufficient balance

**Spec:** `playwright/tests/trade/verify-insufficient-balance.spec.ts`

Two child flows in one spec — separate staging accounts. Product stance (post PR #1398): **inform, don't disable** — Buy stays enabled when the stake exceeds balance; the stake editor owns the balance hint and blocks **Save**; clicking **Buy** defers to the server insufficient-balance popup.

> Flow 13 in `verify-manual-trade-negative-validation.spec.ts` exercises the same inform-don't-disable stance dynamically against the logged-in account balance.

---

### Flow 17.1 — Insufficient balance popup dismiss and deposit

**Prerequisites:** Authenticated **real** zero-balance account (`TEST_EMAIL_ZERO_BALANCE` — same inbox for desktop and mobile). Default committed stake above `0.00` (e.g. `$2`). Market open.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `TradeBasePage.seedLocalStorageOnOrigin()` → `login()` → `gotoTradePage()` → `real` account | Balance shows `0.00`; default stake already unaffordable | Both |
| 2 | Verify stake editor hint | Open **Stake** → **Custom** (desktop) | Error hint: `Balance is empty. Deposit funds to buy this contract.`; Save disabled | Both |
| 3 | Click Buy | `clickBuyWithInsufficientBalance()` | Insufficient-balance popup: title **Insufficient balance**, backend body, **Deposit now** (real) | Both |
| 4 | Dismiss popup | Click **X** (desktop `.quill-modal__close-icon`) or overlay (mobile) | Popup hidden; trade page unchanged | Both |
| 5 | Reopen popup | Click **Buy** again | Same popup content visible | Both |
| 6 | Deposit now | Click **Deposit now** → `verifyNavigatedToDepositFromDTrader()` | URL: `{LOGIN_URL origin}/dashboard/transfer?from=dtrader&source=options&acc=options&curr=USD`; **Transfer** heading; **From** Wallet; **To** Options `0.00 USD`; amount input + review button visible | Both |

> **POM:** `verifyEmptyBalanceStakeEditorHint()` → `clickBuyWithInsufficientBalance()` → `verifyInsufficientBalancePopup()` → `clickInsufficientBalancePopupClose()` → `verifyInsufficientBalancePopupDismissed()` → (repeat Buy + popup) → `clickInsufficientBalanceDepositButton()` → `verifyNavigatedToDepositFromDTrader()`.

> **Account setup:** `TEST_EMAIL_ZERO_BALANCE` in `playwright/.env.staging`.

---

### Flow 17.2 — Stake editor hint + Buy enabled

**Prerequisites:** Authenticated **real** account with Options balance below the committed proposal charge (`TEST_EMAIL_INSUFFICIENT_BALANCE` / `TEST_EMAIL_INSUFFICIENT_BALANCE_MOBILE`). Market open.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | Same setup as Flow 17.1 with low-balance accounts | Trade page loaded; balance visible | Both |
| 2 | Commit stake above balance | Seed active tab `tab_trade_params_v2` amount (`balance + 1`) + reload — **both viewports** | Committed charge exceeds header balance; Save cannot commit an unaffordable draft through the UI | Both |
| 3 | Verify Buy enabled | Observe `buyButton` + collapsed Stake | Buy **enabled**; payout quoted (not `-`); collapsed Stake stays **neutral** (#1397) | Both |
| 4 | Verify no popup yet | Observe purchase area | No insufficient-balance popup before Buy is clicked | Both |
| 5 | Draft stake above balance | Open stake editor → **Custom** (desktop) → enter unaffordable amount | Balance hint (`Balance is empty…` or `You only have … left. Try a lower stake.`); **Save disabled** | Both |

> **POM:** `verifyInsufficientBalanceClientGate()` — orchestrates steps 2–5 via `prepareCommittedUnaffordableStake()`, `verifyInsufficientBalanceBuyReady()`, `verifyInsufficientBalanceStakeHint()`.

> **Account setup:** `TEST_EMAIL_INSUFFICIENT_BALANCE` (desktop project) / `TEST_EMAIL_INSUFFICIENT_BALANCE_MOBILE` (mobile project).

---

## Flow 18 — Invalid URL — unsupported market and trade type modals

> Covers regression for #895.

**Prerequisites:** No authentication required. Invalid `symbol` or `trade_type` in URL query.
**Spec:** `playwright/tests/trade/verify-invalid-url-modal.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Open invalid market link | `gotoTradePageWithQuery('symbol=NOT_A_REAL_MARKET&…')` | UrlUnavailableModal opens | Both |
| 2 | Verify market V2 copy | Observe title + body | "Unsupported market" + V2 guidance text (not legacy V1 copy) | Both |
| 3 | Dismiss modal | Click **Got it** | Modal closes; default market tab still visible | Both |
| 4 | Open invalid trade_type link | `gotoTradePageWithQuery('trade_type=high_lowsd&…')` | UrlUnavailableModal opens | Both |
| 5 | Verify trade_type V2 copy | Observe title + body | "Unsupported trade type" + V2 guidance text (not legacy V1 copy) | Both |
| 6 | Dismiss modal | Click **Got it** | Modal closes; default market tab still visible | Both |

---

## Flow 19 — Manual trade param info icons reveal descriptions

> Covers regression for #995.

**Prerequisites:** Authenticated account (`TEST_EMAIL`). Desktop and mobile use the same inbox.
**Spec:** `playwright/tests/trade/verify-trade-param-info-icon-hover.spec.ts`
**Matrix:** `TradeParametersPage.TRADE_PARAM_INFO_ICON_CASES` — Multipliers, Accumulators, Turbos, Vanillas (both viewports); Higher/Lower and Touch/No Touch Barrier (mobile only).

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Navigate to trade page | `seedLocalStorageOnOrigin()` → `login()` → `gotoTradePage()` | Trade page loaded | Both |
| 2 | Select market + trade type | `selectMarketAndTradeType(market, tradeType, { verifyParams: false })` per matrix row | Trade form shows the target trade type | Both |
| 3 | Desktop — reveal info icon | Hover the parameter row (`.trade-params__field-with-info`) | Info icon wrapper opacity `0` → `1` | Desktop |
| 4 | Desktop — verify description | Hover the info icon → read `.trade-params__parameter-tooltip[role="tooltip"]` | Tooltip shows the authored description for that parameter (e.g. Multiplier, Growth rate, Take profit, Risk management TP/SL copy) | Desktop |
| 5 | Mobile — open parameter editor | Tap the read-only parameter field (`getByRole('textbox', { name })`) | Action sheet opens | Mobile |
| 6 | Mobile — verify info icon + copy | Tap `button.action-sheet-header-tooltip[aria-label="…"]` | Portaled Quill tooltip paragraph shows the authored description (Risk management sheet: separate icons for Take profit and Stop loss) | Mobile |

> **POM:** `verifyTradeParamInfoIconOnDesktop(label, descriptions)` · `verifyTradeParamInfoIconsInMobileEditor(openField, icons)` · matrix constant `TRADE_PARAM_INFO_DESCRIPTIONS`.
>
> **Automate counterpart:** `playwright/flows/trade-automate/flow.md` Flow 17 — strategy-panel params + Accumulators trade-form rows via `TradeAutomatePage.AUTOMATE_PARAM_INFO_ICON_CASES`.
>
> **Desktop-only params:** Multiplier, Risk management, Growth rate, Take profit, Payout per point, Strike price — collapsed-row hover reveal via `TradeParameterPopover`.
>
> **Mobile-only extra:** Barrier on Higher/Lower / Touch/No Touch — description lives in the barrier editor sheet header, not the collapsed row.

---

## Flow 20 — System theme option follows OS

> Covers feature for #1177.

**Prerequisites:** Unauthenticated. Seed `theme_preference: 'system'` before load.
**Spec:** `playwright/tests/trade/verify-system-theme-option.spec.ts`

### Mobile — Theme drawer (Light / Dark / System)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Open Theme drawer | Bottom nav Menu → Theme | Drawer shows Light, Dark, and System radios | Mobile |
| 2 | Select System | Tap System | System is `aria-checked=true` (preference, not resolved theme) | Mobile |
| 3 | OS dark | `page.emulateMedia({ colorScheme: 'dark' })` | `body` has `theme--dark`; System stays selected | Mobile |
| 4 | OS light | `page.emulateMedia({ colorScheme: 'light' })` | `body` has `theme--light` | Mobile |
| 5 | Lock Light against dark OS | Select Light → emulate dark OS | `body` stays `theme--light`; Light stays selected | Mobile |
| 6 | Lock Dark against light OS | Select Dark → emulate light OS | `body` stays `theme--dark`; Dark stays selected | Mobile |

### Desktop — sidebar Theme toggle (no System radio)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | OS dark under System | `emulateMedia({ colorScheme: 'dark' })` | `body` has `theme--dark` | Desktop |
| 2 | OS light under System | `emulateMedia({ colorScheme: 'light' })` | `body` has `theme--light` | Desktop |
| 3 | Lock Light against dark OS | Toggle to Light → emulate dark OS | `body` stays `theme--light` | Desktop |
| 4 | Lock Dark against light OS | Toggle to Dark → emulate light OS | `body` stays `theme--dark` | Desktop |

> **POM:** `seedThemePreference` · `setThemePreference` (branches Menu radios vs sidebar toggle) · `expectResolvedBodyTheme`.
>
> Chart canvas theme is N/A for Playwright — covered by unit/manual for SmartCharts `settings.theme`.

---

## Flow 21 — Cross-tab deep link — URL trade type resolves over the inherited session

> Covers regression for #1524.

**Prerequisites:** Authenticated (dedicated account via `createAccountV2viaJS`). Accumulators active on Crash 500 Index in the current tab — Chrome clones its `trade_store` sessionStorage into a `target="_blank"` tab, so the deep link resolves against an inherited outgoing-market session.
**Spec:** `playwright/tests/trade/verify-deep-link-cross-tab.spec.ts`
**Desktop only** — the popup path is a desktop browser behaviour (`context.newPage()` starts with an empty session and cannot reproduce it; Flow 18 covers the same-tab modal paths on both platforms).

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Seed the inherited session | `selectMarketAndTradeType('Crash 500 Index', 'Accumulators')` → `verifySessionOwnsMarket('CRASH500')` | sessionStorage `trade_store` carries CRASH500 | Desktop |
| 2 | Deep link to another market in a new tab | `openTradeQueryInNewTab('trade_type=rise_fall&symbol=1HZ25V&…')` | Popup opens with the URL market, not the inherited Crash 500 session | Desktop |
| 3 | Verify landed market | `verifyDeepLinkLandedOnMarket(popup, { market: 'Volatility 25 (1s)', tradeType: 'Rise/Fall', symbol: '1HZ25V' })` | Active market tab shows the linked market + trade type; URL keeps `symbol=1HZ25V`; stake renders; no "Unsupported trade type" modal | Desktop |
| 4 | Deep link to the default-market card | Repeat step 2 with `symbol=1HZ100V` | Lands on Volatility 100 (1s) Rise/Fall — pre-fix this variant showed "Invalid trade type" | Desktop |
| 5 | Regression guard — genuinely invalid trade type | Repeat step 2 with `trade_type=high_lowsd&symbol=1HZ100V` | "Unsupported trade type" UrlUnavailableModal still shows (fix is not a blanket suppression) | Desktop |

> **POM:** `openTradeQueryInNewTab` (real `target="_blank"` anchor — reproduces Chrome's sessionStorage clone; no opener-severing `rel`) · `verifySessionOwnsMarket` · `verifyDeepLinkLandedOnMarket` · `verifyUnsupportedTradeTypeModalOnPopup`.
>
> **Mechanism (#1528):** the trade-type availability decision waits for the URL symbol's own stamped `contracts_for` list (`contract_types_list_v2_symbol`) instead of judging against the inherited outgoing market's list.
