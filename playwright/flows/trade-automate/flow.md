# 📋 Automate Journey Spec — What to Test

> **Purpose:** Describes the Automate (Automated Trading) feature on `staging-dtrader.deriv.com`. Defines _what_ to verify at each step.
>
> **Feature location:** Trade page — Desktop: the **"Automated trading"** tab in the trade panel (`TradePanelTabs`). Mobile: the **`/automate`** route (reached via the **Automate** bottom-nav item).
> **URL:** `https://staging-dtrader.deriv.com/` (desktop tab) · `https://staging-dtrader.deriv.com/automate` (mobile)
> **Module:** `playwright/flows/trade-automate/` · **Tests:** `playwright/tests/trade-automate/`
> **Authentication:** Required — all tests start from a logged-in state
> **Staging only:** Requires a **funded real (staging test) account with Automation enabled** (non-EU/DIEL). On the default staging environment a `'real'` account uses virtual/test funds (no real money, no production). The run controls place actual (staging test) contracts, so a running bot must always be stopped in cleanup.

---

## Section 1 — Shared prerequisites

**Account:** Funded real (staging test) account, Automation available (non-EU/DIEL). On staging, `'real'` uses virtual test funds (no production money).

**Run cleanup:** Every flow that starts a run must stop it in `afterEach` via `stopAutomateRunIfActive()` — a leftover bot breaks the next test ("Automation is already running" snackbar).

**Run control API (`TradeAutomatePage`):**

| Method                                          | Purpose                                                                                                                                                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startAutomateRun()`                            | Click **Run** (waits for enabled first)                                                                                                                                                                                       |
| `verifyAutomateBotIsRunning()`                  | Full running check: controls + open position + contract details (panel specs, post-resume)                                                                                                                                    |
| `verifyAutomateRunningControls()`               | Fast running check only — Status, Pause/Stop, stats line, params disabled (private; tick lifecycles before sequential)                                                                                                        |
| `verifyAutomateSequentialContractPurchase()`    | Tick types only: one open at a time; first settles (open → 0); then one open with **`Contracts >= 2`** (may read 3+ on fast ticks). **Run immediately after** `verifyAutomateRunningControls()`, before open-position details |
| `verifyPauseAndResumeWhileRunning()`            | Flow 1 — Pause → full paused UI → Resume → Running (embedded in Flows 5–14 lifecycles)                                                                                                                                        |
| `stopAutomateRun()`                             | Click **Stop** and verify idle state (Run visible, Running status gone)                                                                                                                                                       |
| `stopAutomateRunIfActive()`                     | `afterEach` cleanup — stop only if Stop is visible                                                                                                                                                                            |
| `pauseRun()` / `resumeRun()` / `verifyPaused()` | Lower-level Flow 1 steps (used by `verifyPauseAndResumeWhileRunning()`)                                                                                                                                                       |
| `verifyLossThresholdAutoStop()`                 | Flow 2.1 — loss snackbar, idle controls hidden, params re-enabled (no manual Stop)                                                                                                                                            |
| `verifyProfitThresholdAutoStop()`               | Flow 2.2 — profit snackbar, idle controls hidden, params re-enabled (no manual Stop)                                                                                                                                          |

> **Tick lifecycle order:** `verifyAutomateRunningControls()` → `verifyAutomateSequentialContractPurchase()` → open-position/contract-details (via `verifyAutomateOpenPositionAndContractDetails()`) → `verifyPauseAndResumeWhileRunning()`. Sequential must run while `Contracts: 1` for the first phase — not after the slow open-details retry loop.

> **One open at a time:** `verifyAutomationOpenPositionVisible()` requires exactly one open contract. **Open** stake may be strategy-adjusted (≥ initial, ≤ max. stake); **closed** tab still matches initial stake. Multi-contract sequencing is asserted via `verifyAutomateSequentialContractPurchase()` on tick types only.

**Stake:** Use a low stake (e.g. `1`) whenever a run is started so the bot cannot burn much before it is stopped.

**Demo and real accounts (Flows 5–14):** Dual-outcome trade types use `.1`/`.2` per outcome tab (demo + real each). Accumulators use `.1` demo · `.2` real. Flows **5–9** = Martingale; **10–14** = D'Alembert (same trade-type order). The `beforeAll` account is always `'real'`; demo/real switching happens in-app. Each test uses **distinct inline params** so strategy-adjusted stakes do not collide on closed-position lookup.

**Test folder layout:** Panel/control specs live at `playwright/tests/trade-automate/*.spec.ts`. Trade-type specs live under `playwright/tests/trade-automate/<trade-type>/`. Dual-outcome types (Rise/Fall, Matches/Differs, Over/Under, Even/Odd) use **one file per outcome and strategy** — `verify-{outcome}-martingale.spec.ts` / `verify-{outcome}-dalembert.spec.ts` (e.g. `verify-rise-martingale.spec.ts`, Flow **5.1**). Accumulators keep **one file per strategy** — `verify-accumulators-martingale.spec.ts` / `verify-accumulators-dalembert.spec.ts` (demo + real in each).

> **No manual close of individual contracts** — stop the run via **Stop**; the bot manages its own contracts.

---

## Section 2 — Per-Flow Sections

### Flow 1 — Pause and Resume a running automation

**Display name:** Pause and Resume a running automation

**Prerequisites:** Shared prerequisites; a run is active (Running). Covered per trade type in Flows 5–14 lifecycles via `verifyPauseAndResumeWhileRunning()` (after sequential contract purchase on tick types, or after first contract on Accumulators). No dedicated spec — see `verify-even-martingale.spec.ts` as canonical reference.

> **Removed:** Former standalone `verify-pause-resume.spec.ts` — pause/resume is embedded in every trade-type lifecycle (Flows 5–14).

| #   | Step        | Action                                                                                       | Expected Result                                                         | Platform |
| --- | ----------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| 1   | Start a run | `startAutomateRun()` → `verifyAutomateBotIsRunning()` → `verifyPauseAndResumeWhileRunning()` | Running → Paused (params disabled, no new contracts) → Resume → Running | Both     |
| 2   | Stop        | `stopAutomateRun()`                                                                          | Run stops; idle **Run** button returns                                  | Both     |

---

### Flow 2.1 — Loss threshold auto-stop

**Display name:** Risk threshold auto-stop (loss threshold reached)

**Spec:** `playwright/tests/trade-automate/verify-threshold-auto-stop.spec.ts` · **Test:** `VERIFY loss threshold auto-stops the run`

**Prerequisites:** Shared prerequisites. Set a very small **Loss threshold** so the run auto-stops quickly. Spec runs **serial** (profit test follows loss).

**Params:** Volatility 100 Index · Rise/Fall · stake `1` · 10 ticks · loss threshold `1` · profit threshold `1000` (unreachable — run can only auto-stop on loss).

| #   | Step               | Action                                                                                                                                                          | Expected Result                        | Platform |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------- |
| 1   | Configure          | `goToAutomatedTrading()` → `selectMarketAndTradeType(...)` → `verifyPanelDefaultState()` → `setStake('1')` → `selectDuration('Ticks', '10 ticks')` → thresholds | Automate panel ready; thresholds saved | Both     |
| 2   | Start a run        | `startAutomateRun()` → `verifyAutomateBotIsRunning()`                                                                                                           | "Status: Running"                      | Both     |
| 3   | Wait for auto-stop | `verifyLossThresholdAutoStop()` (no manual Stop)                                                                                                                | Snackbar + idle Run; params unlocked   | Both     |

---

### Flow 2.2 — Profit threshold auto-stop

**Display name:** Risk threshold auto-stop (profit threshold reached)

**Spec:** `playwright/tests/trade-automate/verify-threshold-auto-stop.spec.ts` · **Test:** `VERIFY profit threshold auto-stops the run`

**Prerequisites:** Shared prerequisites. Set a very small **Profit threshold** so the run auto-stops once cumulative wins reach it. Same spec as Flow 2.1, second test in **serial** order.

**Params:** Volatility 100 Index · Rise/Fall · stake `1` · 10 ticks · profit threshold `1` · loss threshold `1000` (unreachable — run can only auto-stop on profit).

| #   | Step               | Action                                                                                                                                                          | Expected Result                        | Platform |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------- |
| 1   | Configure          | `goToAutomatedTrading()` → `selectMarketAndTradeType(...)` → `verifyPanelDefaultState()` → `setStake('1')` → `selectDuration('Ticks', '10 ticks')` → thresholds | Automate panel ready; thresholds saved | Both     |
| 2   | Start a run        | `startAutomateRun()` → `verifyAutomateBotIsRunning()`                                                                                                           | "Status: Running"                      | Both     |
| 3   | Wait for auto-stop | `verifyProfitThresholdAutoStop()` (no manual Stop)                                                                                                              | Snackbar + idle Run; params unlocked   | Both     |

---

### Flow 3 — Resync after account switch (run stays Running)

**Display name:** Resync after account switch (run stays Running)

**Spec:** `playwright/tests/trade-automate/verify-account-switch-resync.spec.ts` · **Test:** `VERIFY automation run is re-adopted as Running after switching account`

**Prerequisites:** Shared prerequisites; Account A = funded **real** (staging test); Account B = **demo** on the same login. `beforeAll` creates Account A via `createAccountV2viaJS('real', …)`; `beforeEach` logs in. `afterEach` calls `stopAutomateRunIfActive()` if the test fails after `startAutomateRun()`.

**Params:** Volatility 100 Index · Rise/Fall · stake `1` · 10 ticks (longer than default 5 ticks so `verifyAutomateBotIsRunning()` contract-details checks survive the account round-trip).

| #   | Step           | Action                                                                                                                                             | Expected Result                                                                                    | Platform |
| --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| 1   | Configure      | `goToAutomatedTrading()` → `selectMarketAndTradeType(...)` → `verifyPanelDefaultState()` → `setStake('1')` → `selectDuration('Ticks', '10 ticks')` | Automate panel ready on Account A                                                                  | Both     |
| 2   | Start a run    | `startAutomateRun()` → `verifyAutomateBotIsRunning()` on Account A                                                                                 | "Status: Running"                                                                                  | Both     |
| 3   | Switch account | `switchToAccountType('demo')` → `goToAutomatedTrading()` → `verifyPanelDefaultState()` then `switchToAccountType('real')`                          | Demo shows idle panel (Run enabled); real run re-adopted as **Running** (not stuck on "Starting…") | Both     |
| 4   | Verify + Stop  | `verifyAutomateBotIsRunning()` → `stopAutomateRun()`                                                                                               | Run stops; idle **Run** returns                                                                    | Both     |

> Guards the known intermittent "stuck on Starting…" resync behaviour (GRWT-9318). Uses full `verifyAutomateBotIsRunning()` (controls + open position + contract details) before and after the account round-trip — not `verifyAutomateRunningControls()` alone.

> **Removed:** Former standalone strategy-selection flow — covered by Martingale (Flows 5–9) and D'Alembert (Flows 10–14) lifecycle specs via `selectStrategy()` in each run.

---

### Flow 4 — Automation unavailable for EU account (gating)

**Display name:** Automation unavailable for EU account (gating)

**Prerequisites:** An **EU/DIEL** account.

| #   | Step              | Action                                | Expected Result                                             | Platform |
| --- | ----------------- | ------------------------------------- | ----------------------------------------------------------- | -------- |
| 1   | Check trade panel | Log in on an EU account, open trade   | The **"Automated trading"** tab is **not** available        | Desktop  |
| 1   | Check /automate   | Navigate to `/automate` on EU account | Redirected away from `/automate` (automation not available) | Mobile   |

---

### Supported trade type runs — shared pattern (Flows 5–14)

> Each UI trade type gets one spec per strategy under `playwright/tests/trade-automate/<trade-type>/`. Tests pass a **full inline params object** to a dedicated POM method — same pattern as manual `buy*AndVerify()`.

**Tests per spec (child flows):**

| Parent flow | Strategy   | Outcomes / account split | Child flows                         |
| ----------- | ---------- | ------------------------ | ----------------------------------- |
| 5, 7–9      | Martingale | Dual-outcome trade types | `.1`/`.2` (demo + real per outcome) |
| 6           | Martingale | Accumulators             | `.1` demo · `.2` real               |
| 10, 12–14   | D'Alembert | Dual-outcome trade types | `.1`/`.2` (demo + real per outcome) |
| 11          | D'Alembert | Accumulators             | `.1` demo · `.2` real               |

**Params shape:** trade-form fields at the top level + nested `automation` block (`strategy`, `stakeMultiplier` or `stakeIncrement`, `maxStake?`, `profitThreshold`, `lossThreshold`).

**Lifecycle order (POM — each `run*AndVerify()`):**

1. `goToAutomatedTrading()` → `switchToAccountType(accountType)`
2. `selectMarketAndTradeType(market, '<Category>', { mode: 'automate' })`
3. `selectTradeTypeOption(tradeType, position)` — dual-outcome flows only
4. `openAndVerifyAutomateGuide('<Category>')` → `verifyAutomationPanelFieldsVisible()`
5. Trade-form params → automation panel setters
6. `startAutomateRun()` → `verifyAutomateRunningControls()` → `verifyAutomateSequentialContractPurchase()` (tick-duration only) → open-position details → `verifyPauseAndResumeWhileRunning()` → `stopAutomateRun()` → `verifyAutomateStoppedWithClosedContract()`

> **Accumulators (Flows 6, 11):** skip `verifyAutomateSequentialContractPurchase()`; call `verifyPauseAndResumeWhileRunning()` after the first contract is running.

| Trade type      | Martingale | D'Alembert | Spec(s)                                                                                                                                             |
| --------------- | ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rise/Fall       | 5.1–5.2    | 10.1–10.2  | `verify-rise-martingale.spec.ts` · `verify-fall-martingale.spec.ts` · `verify-rise-dalembert.spec.ts` · `verify-fall-dalembert.spec.ts`             |
| Accumulators    | 6.1–6.2    | 11.1–11.2  | `verify-accumulators-martingale.spec.ts` · `verify-accumulators-dalembert.spec.ts`                                                                  |
| Matches/Differs | 7.1–7.2    | 12.1–12.2  | `verify-matches-martingale.spec.ts` · `verify-differs-martingale.spec.ts` · `verify-matches-dalembert.spec.ts` · `verify-differs-dalembert.spec.ts` |
| Over/Under      | 8.1–8.2    | 13.1–13.2  | `verify-over-martingale.spec.ts` · `verify-under-martingale.spec.ts` · `verify-over-dalembert.spec.ts` · `verify-under-dalembert.spec.ts`           |
| Even/Odd        | 9.1–9.2    | 14.1–14.2  | `verify-even-martingale.spec.ts` · `verify-odd-martingale.spec.ts` · `verify-even-dalembert.spec.ts` · `verify-odd-dalembert.spec.ts`               |

> For D'Alembert, use `strategy: "D'Alembert"` and `stakeIncrement` instead of `stakeMultiplier`. D'Alembert flows use distinct stakes/thresholds to avoid closed-position lookup collisions with Martingale runs on the same backup accounts.

---

### Flow 5 — Rise/Fall

**Specs:** `rise-fall/verify-rise-martingale.spec.ts` (Flow **5.1** Rise) · `rise-fall/verify-fall-martingale.spec.ts` (Flow **5.2** Fall) — demo + real each · **POM:** `runRiseFallAndVerify()` · **Tags:** `@automate @martingale @desktop @mobile`

**Prerequisites:** Dedicated backup account (`TEST_EMAIL_AUTOMATE_RISE_FALL`).

| #   | Step             | Action                                                                                                                                                                                                 | Expected Result                                                                                                                          | Platform |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Open Automation  | `goToAutomatedTrading()`                                                                                                                                                                               | Automation tab/page active                                                                                                               | Both     |
| 2   | Switch account   | `switchToAccountType(accountType)`                                                                                                                                                                     | Active account matches `accountType`                                                                                                     | Both     |
| 3   | Select Rise/Fall | `selectMarketAndTradeType(market, 'Rise/Fall', { mode: 'automate' })`                                                                                                                                  | Rise/Fall trade form + Run visible                                                                                                       | Both     |
| 4   | Select outcome   | `selectTradeTypeOption(tradeType, 'top' \| 'bottom')`                                                                                                                                                  | Purchase button colour matches Rise/Fall tab                                                                                             | Both     |
| 5   | Guide popup      | `openAndVerifyAutomateGuide('Rise/Fall')`                                                                                                                                                              | Guide verified; dismiss (desktop **X**, mobile **Got it**)                                                                               | Both     |
| 6   | Panel defaults   | `verifyAutomationPanelFieldsVisible()`                                                                                                                                                                 | Strategy params + risk management fields + Run visible                                                                                   | Both     |
| 7   | Set duration     | `selectDuration(durationUnit, durationValue)`                                                                                                                                                          | Duration field reflects value                                                                                                            | Both     |
| 8   | Set stake        | `setStake(stake)`                                                                                                                                                                                      | Initial stake saved                                                                                                                      | Both     |
| 9   | Automation panel | `selectStrategy`, `setStakeMultiplier`, `setMaxStake`, `setProfitThreshold`, `setLossThreshold`                                                                                                        | All automation params saved                                                                                                              | Both     |
| 10  | Run lifecycle    | `startAutomateRun()` → running controls → `verifyAutomateSequentialContractPurchase()` → open-position details → `verifyPauseAndResumeWhileRunning()` → `stopAutomateRun()` → closed contract verified | **Status: Running**; sequential purchase; **Pause → Resume → Running**; Stop returns idle **Run**; closed position matches initial stake | Both     |

**Inline params (Flow 5.1 — Rise demo):**

```typescript
await tradeAutomatePage.runRiseFallAndVerify({
    accountType: 'demo',
    market: 'Volatility 100 Index',
    tradeType: 'Rise',
    durationUnit: 'Ticks',
    durationValue: '10 ticks',
    stake: '1',
    automation: {
        strategy: 'Martingale',
        stakeMultiplier: 2,
        maxStake: '150',
        profitThreshold: '150',
        lossThreshold: '150',
    },
});
```

---

### Flow 6 — Accumulators

**Spec:** `accumulators/verify-accumulators-martingale.spec.ts` · **POM:** `runAccumulatorsAndVerify()`

**Child flows:** **6.1** demo · **6.2** real

**Prerequisites:** Dedicated backup account (`TEST_EMAIL_AUTOMATE_ACCUMULATORS`).

Same step table as Flow 5 where applicable (no outcome tab; uses `growthRate`, optional `takeProfit`). **Omits** `verifyAutomateSequentialContractPurchase()` — see shared lifecycle note above.

**Inline params (Flow 6.1 — demo):**

```typescript
await tradeAutomatePage.runAccumulatorsAndVerify({
    accountType: 'demo',
    market: 'Volatility 10 Index',
    growthRate: '4%',
    stake: '1',
    automation: {
        strategy: 'Martingale',
        stakeMultiplier: 2,
        maxStake: '50',
        profitThreshold: '101',
        lossThreshold: '102',
    },
});
```

---

### Flow 7 — Matches/Differs

**Specs:** `matches-differs/verify-matches-martingale.spec.ts` (Flow **7.1** Matches) · `matches-differs/verify-differs-martingale.spec.ts` (Flow **7.2** Differs) — demo + real each · **POM:** `runMatchesDiffersAndVerify()`

**Prerequisites:** Dedicated backup account (`TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS`).

**Inline params (Flow 7.1 — Matches demo):**

```typescript
await tradeAutomatePage.runMatchesDiffersAndVerify({
    accountType: 'demo',
    market: 'Volatility 10 Index',
    tradeType: 'Matches',
    durationTicks: '10 ticks',
    digit: '1',
    stake: '3',
    automation: {
        strategy: 'Martingale',
        stakeMultiplier: 2,
        maxStake: '56',
        profitThreshold: '108',
        lossThreshold: '109',
    },
});
```

---

### Flow 8 — Over/Under

**Specs:** `over-under/verify-over-martingale.spec.ts` (Flow **8.1** Over) · `over-under/verify-under-martingale.spec.ts` (Flow **8.2** Under) — demo + real each · **POM:** `runOverUnderAndVerify()`

**Prerequisites:** Dedicated backup account (`TEST_EMAIL_AUTOMATE_OVER_UNDER`).

**Inline params (Flow 8.1 — Over demo):**

```typescript
await tradeAutomatePage.runOverUnderAndVerify({
    accountType: 'demo',
    market: 'Volatility 10 Index',
    tradeType: 'Over',
    durationTicks: '10 ticks',
    digit: '3',
    stake: '1',
    automation: {
        strategy: 'Martingale',
        stakeMultiplier: 2,
        maxStake: '70',
        profitThreshold: '104',
        lossThreshold: '104',
    },
});
```

---

### Flow 9 — Even/Odd

**Specs:** `even-odd/verify-even-martingale.spec.ts` (Flow **9.1** Even) · `even-odd/verify-odd-martingale.spec.ts` (Flow **9.2** Odd) — demo + real each · **POM:** `runEvenOddAndVerify()` · **Tags:** `@automate @martingale @smoke @desktop @mobile` (Flow **9.1** also `@production` — real uses minimum stake `0.35` on production, same as manual Rise/Fall)

**Prerequisites:** Dedicated backup account (`TEST_EMAIL_AUTOMATE_EVEN_ODD`).

**Inline params (Flow 9.1 — Even demo):**

```typescript
await tradeAutomatePage.runEvenOddAndVerify({
    accountType: 'demo',
    market: 'Volatility 10 Index',
    tradeType: 'Even',
    durationTicks: '10 ticks',
    stake: '1',
    automation: {
        strategy: 'Martingale',
        stakeMultiplier: 5,
        maxStake: '66',
        profitThreshold: '201',
        lossThreshold: '200',
    },
});
```

---

### Flow 10 — Rise/Fall (D'Alembert)

**Specs:** `rise-fall/verify-rise-dalembert.spec.ts` (Flow **10.1** Rise) · `rise-fall/verify-fall-dalembert.spec.ts` (Flow **10.2** Fall) — demo + real each · **POM:** `runRiseFallAndVerify()`

Same step table as Flow 5; `strategy: "D'Alembert"`, `stakeIncrement: 3`, distinct stakes/thresholds.

**Inline params (Flow 10.1 — Rise demo):**

```typescript
await tradeAutomatePage.runRiseFallAndVerify({
    accountType: 'demo',
    market: 'Volatility 100 Index',
    tradeType: 'Rise',
    durationUnit: 'Ticks',
    durationValue: '10 ticks',
    stake: '2',
    automation: {
        strategy: "D'Alembert",
        stakeIncrement: 3,
        maxStake: '160',
        profitThreshold: '160',
        lossThreshold: '160',
    },
});
```

---

### Flow 11 — Accumulators (D'Alembert)

**Spec:** `accumulators/verify-accumulators-dalembert.spec.ts` · **POM:** `runAccumulatorsAndVerify()`

**Child flows:** **11.1** demo · **11.2** real — same steps as Flow 6; D'Alembert params.

---

### Flow 12 — Matches/Differs (D'Alembert)

**Specs:** `matches-differs/verify-matches-dalembert.spec.ts` (Flow **12.1** Matches) · `matches-differs/verify-differs-dalembert.spec.ts` (Flow **12.2** Differs) — demo + real each. Same steps as Flow 7; D'Alembert params.

---

### Flow 13 — Over/Under (D'Alembert)

**Specs:** `over-under/verify-over-dalembert.spec.ts` (Flow **13.1** Over) · `over-under/verify-under-dalembert.spec.ts` (Flow **13.2** Under) — demo + real each. Same steps as Flow 8; D'Alembert params.

---

### Flow 14 — Even/Odd (D'Alembert)

**Specs:** `even-odd/verify-even-dalembert.spec.ts` (Flow **14.1** Even) · `even-odd/verify-odd-dalembert.spec.ts` (Flow **14.2** Odd) — demo + real each. Same steps as Flow 9; D'Alembert params.

---

### Flow 15 — Invalid trade and automation param validation

**Display name:** Invalid trade/automation param validation (zero, min/max, and invalid drafts)

**Spec:** `playwright/tests/trade-automate/verify-trade-param-validation.spec.ts`

**Prerequisites:** Shared prerequisites (non-EU funded account).

**Params:** Volatility 100 Index · Rise/Fall · valid stake `1` · 10 ticks · then attempt invalid drafts.

#### Flow 15.1 — Martingale (trade form + automation panel)

| #   | Step                           | Action                                                                                             | Expected Result                                                                                                               | Platform |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Configure valid baseline       | `goToAutomatedTrading()` → Rise/Fall automate → `verifyPanelDefaultState()` → stake `1` → 10 ticks | Martingale defaults; panel ready with valid committed params                                                                  | Both     |
| 2   | Initial stake below minimum    | Open **Stake** Custom, enter `0.01` (below market min, e.g. `0.35`)                                | **"Please enter a stake amount that's at least …"**; **Save** disabled; dismiss restores prior stake                          | Both     |
| 3   | Initial stake empty            | Re-open **Stake** Custom, clear field, **Save** (desktop)                                          | Desktop: **"Amount is a required field."**; Mobile: **Save** disabled; dismiss restores prior stake                           | Both     |
| 4   | Initial stake invalid format   | Re-open **Stake** Custom, enter `1.` (trailing decimal)                                            | **"Should be a valid number."**; **Save** disabled; dismiss restores prior stake                                              | Both     |
| 5   | Initial stake above max payout | Re-open **Stake** Custom → read **Max payout** from details → draft until **Payout** row errors    | **Payout** row `.error`; proposal min/max payout message; **Save** disabled; dismiss restores prior stake                     | Both     |
| 6   | Initial stake above balance    | Enter `{balance + 0.01}` (computed from header balance)                                            | **"You only have {balance} {currency} left. Try a lower stake."**; Mobile: **Save** disabled; dismiss restores prior stake    | Both     |
| 7   | Profit threshold empty         | Open **Profit threshold**, clear field                                                             | Desktop: **Save** disabled; Mobile: **Save** → **"Please enter a valid amount greater than 0"**; dismiss restores prior value | Both     |
| 8   | Profit threshold zero          | Re-open **Profit threshold**, enter `0`, **Save**                                                  | Same positive-amount error; Desktop: **Save** disabled; dismiss restores prior value                                          | Both     |
| 9   | Loss threshold empty           | Open **Loss threshold**, clear field                                                               | Desktop: **Save** disabled; Mobile: **Save** → positive-amount error; dismiss restores prior value                            | Both     |
| 10  | Loss threshold zero            | Re-open **Loss threshold**, enter `0`, **Save**                                                    | Same positive-amount error; Desktop: **Save** disabled; dismiss restores prior value                                          | Both     |
| 11  | Stake multiplier empty         | Open **Stake multiplier** Custom, clear field                                                      | **Save** disabled; dismiss restores prior multiplier                                                                          | Both     |
| 12  | Stake multiplier zero          | Re-open **Stake multiplier** Custom, enter `0`, **Save**                                           | **"Multiplier must be at least …"**; **Save** disabled; dismiss restores prior multiplier                                     | Both     |
| 13  | Stake multiplier above max     | Custom enter `11`, **Save**                                                                        | **"Multiplier cannot exceed 10"**; **Save** disabled; dismiss restores prior multiplier                                       | Both     |
| 14  | Max. stake empty               | Open **Max. stake**, enable toggle, clear amount field                                             | **Save** disabled; dismiss restores `-`                                                                                       | Both     |
| 15  | Max. stake zero                | Re-open, enable toggle, enter `0`, **Save**                                                        | **"Please enter a valid amount greater than 0"**; Desktop: **Save** disabled; dismiss restores `-`                            | Both     |
| 16  | Max. stake below initial       | Enable toggle, enter `0.5` (initial stake `1`), **Save**                                           | **"Max. stake must be equal or greater than 1"**; Desktop: **Save** disabled; dismiss restores `-`                            | Both     |
| 17  | Panel stays idle               | `verifyAutomatePanelIdleAfterParamValidation()`                                                    | **Run** visible and enabled; no **Status: Running**                                                                           | Both     |

#### Flow 15.2 — D'Alembert (stake increment)

| #   | Step                  | Action                                                                                  | Expected Result                                                                         | Platform |
| --- | --------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| 1   | Switch strategy       | Same baseline as 15.1 → `selectStrategy({ strategy: "D'Alembert", stakeIncrement: 2 })` | **Stake increment** field visible (`2 unit`); multiplier field replaced                 | Both     |
| 2   | Stake increment empty | Open **Stake increment** Custom, clear field                                            | **Save** disabled; dismiss restores prior increment (`2 unit`)                          | Both     |
| 3   | Stake increment zero  | Re-open **Stake increment** Custom, enter `0`, **Save**                                 | **"Increment must be at least 1"**; **Save** disabled; dismiss restores prior increment | Both     |
| 4   | Panel stays idle      | `verifyAutomatePanelIdleAfterParamValidation()`                                         | **Run** visible and enabled; no active run                                              | Both     |

> Numeric automation editors strip non-digit input (`regex={/[^0-9.,]/g}`), so minus signs cannot be typed. Run-click validation for unsupported trade types remains **G2**.

---

## Gap Flows

> These are test cases for coverage gaps. The proposed spec file for each gap is in [`coverage.md`](./coverage.md).

### G1 — "Automation already running" adoption snackbar

| #   | Test case           | Steps                                                                | Expected Result                                                                           |
| --- | ------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Already-running Run | With a run active, click **Run** again (or open in a second context) | Snackbar: **"Automation is already running for this account."**; no duplicate run started |

### G2 — Validation / unsupported-contract-type error

| #   | Test case              | Steps                                                                    | Expected Result                                                                          |
| --- | ---------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 1   | Unsupported trade type | Select a trade type the strategy doesn't support, click **Run**          | Inline error banner (e.g. strategy does not support this trade type); run does not start |
| 2   | Invalid params         | Enter an invalid strategy parameter (e.g. multiplier ≤ 1), click **Run** | Validation error shown; run does not start                                               |

> **Flow 15** covers in-editor validation for trade-form stake (below-min, empty, max payout, above balance) and automation thresholds/multiplier — drafts blocked or surfaced before Run. G2 case 2 (Run-click invalid params) remains a separate gap if needed.
