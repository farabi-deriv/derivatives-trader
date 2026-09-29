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

| Method | Purpose |
| --- | --- |
| `startAutomateRun()` | Click **Run** (waits for enabled first) |
| `verifyAutomateBotIsRunning()` | Full running check: controls + open position + contract details (panel specs, post-resume) |
| `verifyAutomateRunningControls()` | Fast running check only — Status, Pause/Stop, stats line, params disabled (private; tick lifecycles before open details) |
| `verifyAutomateSequentialContractPurchase()` | Tick types only: one open at a time (dual-sample badge ± Open tab); no required open → 0 gap; reach **`Contracts >= 2`** with exactly one open. **Run after** open-position details (details need a live contract) |
| `verifyPauseAndResumeWhileRunning()` | Flow 1 — Pause → full paused UI → Resume → Running (embedded in Flows 5–13 lifecycles) |
| `stopAutomateRun()` | Click **Stop** and verify idle state (Run visible, Running status gone) |
| `stopAutomateRunIfActive()` | `afterEach` cleanup — stop only if Stop is visible |
| `pauseRun()` / `resumeRun()` / `verifyPaused()` | Lower-level Flow 1 steps (used by `verifyPauseAndResumeWhileRunning()`) |
| `verifyLossThresholdAutoStop()` | Flow 2.1 — loss snackbar, idle controls hidden, params re-enabled (no manual Stop) |
| `verifyProfitThresholdAutoStop()` | Flow 2.2 — profit snackbar, idle controls hidden, params re-enabled (no manual Stop) |

> **Tick lifecycle order:** `verifyAutomateRunningControls()` → open-position/contract-details (via `verifyAutomateOpenPositionAndContractDetails()`) → `verifyAutomateSequentialContractPurchase()` → `verifyPauseAndResumeWhileRunning()`. Open details while the first contract is still live; sequential does not require an open → 0 gap (tick bots often re-buy faster than a navigation poll can observe it).

> **One open at a time:** `verifyAutomationOpenPositionVisible()` requires exactly one open contract. **Open** stake may be strategy-adjusted (≥ initial, ≤ max. stake); **closed** tab still matches initial stake. Multi-contract sequencing is asserted via `verifyAutomateSequentialContractPurchase()` on tick types only.

**Stake:** Use a low stake (e.g. `1`) whenever a run is started so the bot cannot burn much before it is stopped.

**Demo and real accounts (Flows 5–13):** Each **test case** maps to one child flow ID. **Accumulators (Flow 6):** **6.1**/**6.2** = Martingale demo/real · **6.3**/**6.4** = D'Alembert demo/real. **Dual-outcome trade types** (Flows 5, 7–9, 10–13): `.1`/`.2` = first outcome demo/real · `.3`/`.4` = second outcome demo/real (e.g. Flow **5.1** Rise demo · **5.2** Rise real · **5.3** Fall demo · **5.4** Fall real). The `beforeAll` account is always `'real'`; demo/real switching happens in-app. Each test uses **distinct inline params** so strategy-adjusted stakes do not collide on closed-position lookup.

**Test folder layout:** Panel/control specs live at `playwright/tests/trade-automate/*.spec.ts` (Flows **14–17**). Trade-type specs live under `playwright/tests/trade-automate/<trade-type>/`. Dual-outcome types use **one file per outcome and strategy** — each file holds **two tests** (demo + real), e.g. `verify-rise-martingale.spec.ts` → Flows **5.1** and **5.2**. Accumulators keep **one file per strategy** with two tests — Flows **6.1** demo · **6.2** real.

**Lifecycle test titles (Flows 5–13):** `VERIFY automated trade run - {Strategy} - {surface} ({account})` — e.g. `VERIFY automated trade run - Martingale - Rise (Demo)`, `"VERIFY automated trade run - D'Alembert - Accumulators (Real)"`. Use outcome-only surface labels (`Rise`, not `Rise/Fall — Rise`); use double quotes when the title contains `D'Alembert`.

> **No manual close of individual contracts** — stop the run via **Stop**; the bot manages its own contracts.

---

## Section 2 — Per-Flow Sections

### Flow 1 — Pause and Resume a running automation

**Display name:** Pause and Resume a running automation

**Prerequisites:** Shared prerequisites; a run is active (Running). Covered per trade type in Flows 5–13 lifecycles via `verifyPauseAndResumeWhileRunning()` (after sequential contract purchase on tick types, or after first contract on Accumulators). No dedicated spec — see `verify-even-martingale.spec.ts` as canonical reference.

> **Removed:** Former standalone `verify-pause-resume.spec.ts` — pause/resume is embedded in every trade-type lifecycle (Flows 5–13).

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Start a run | `startAutomateRun()` → `verifyAutomateBotIsRunning()` → `verifyPauseAndResumeWhileRunning()` | Running → Paused (params disabled, no new contracts) → Resume → Running | Both |
| 2 | Stop | `stopAutomateRun()` | Run stops; idle **Run** button returns | Both |

---

### Flow 2.1 — Loss threshold auto-stop

**Display name:** Risk threshold auto-stop (loss threshold reached)

**Spec:** `playwright/tests/trade-automate/verify-threshold-auto-stop.spec.ts` · **Test:** `VERIFY loss threshold auto-stops the run`

**Prerequisites:** Shared prerequisites. Set a very small **Loss threshold** so the run auto-stops quickly. Spec runs **serial** (profit test follows loss).

**Params:** Volatility 100 Index · Rise/Fall · stake `1` · 10 ticks · loss threshold `1` · profit threshold `1000` (unreachable — run can only auto-stop on loss).

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Configure | `goToAutomatedTrading()` → `selectMarketAndTradeType(...)` → `verifyPanelDefaultState()` → `setStake('1')` → `selectDuration('Ticks', '10 ticks')` → thresholds | Automate panel ready; thresholds saved | Both |
| 2 | Start a run | `startAutomateRun()` → `verifyAutomateBotIsRunning()` | "Status: Running" | Both |
| 3 | Wait for auto-stop | `verifyLossThresholdAutoStop()` (no manual Stop) | Snackbar + idle Run; params unlocked | Both |

---

### Flow 2.2 — Profit threshold auto-stop

**Display name:** Risk threshold auto-stop (profit threshold reached)

**Spec:** `playwright/tests/trade-automate/verify-threshold-auto-stop.spec.ts` · **Test:** `VERIFY profit threshold auto-stops the run`

**Prerequisites:** Shared prerequisites. Set a very small **Profit threshold** so the run auto-stops once cumulative wins reach it. Same spec as Flow 2.1, second test in **serial** order.

**Params:** Volatility 100 Index · Rise/Fall · stake `1` · 10 ticks · profit threshold `1` · loss threshold `1000` (unreachable — run can only auto-stop on profit).

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Configure | `goToAutomatedTrading()` → `selectMarketAndTradeType(...)` → `verifyPanelDefaultState()` → `setStake('1')` → `selectDuration('Ticks', '10 ticks')` → thresholds | Automate panel ready; thresholds saved | Both |
| 2 | Start a run | `startAutomateRun()` → `verifyAutomateBotIsRunning()` | "Status: Running" | Both |
| 3 | Wait for auto-stop | `verifyProfitThresholdAutoStop()` (no manual Stop) | Snackbar + idle Run; params unlocked | Both |

---

### Flow 3 — Resync after account switch (run stays Running)

**Display name:** Resync after account switch (run stays Running)

**Spec:** `playwright/tests/trade-automate/verify-account-switch-resync.spec.ts` · **Test:** `VERIFY automation run is re-adopted as Running after switching account`

**Prerequisites:** Shared prerequisites; Account A = funded **real** (staging test); Account B = **demo** on the same login. `beforeAll` creates Account A via `createAccountV2viaJS('real', …)`; `beforeEach` logs in. `afterEach` calls `stopAutomateRunIfActive()` if the test fails after `startAutomateRun()`.

**Params:** Volatility 100 Index · Rise/Fall · stake `1` · 10 ticks (longer than default 5 ticks so `verifyAutomateBotIsRunning()` contract-details checks survive the account round-trip).

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Configure | `goToAutomatedTrading()` → `selectMarketAndTradeType(...)` → `verifyPanelDefaultState()` → `setStake('1')` → `selectDuration('Ticks', '10 ticks')` | Automate panel ready on Account A | Both |
| 2 | Start a run | `startAutomateRun()` → `verifyAutomateBotIsRunning()` on Account A | "Status: Running" | Both |
| 3 | Switch account | `switchToAccountType('demo')` → `goToAutomatedTrading()` → `verifyPanelDefaultState()` then `switchToAccountType('real')` | Demo shows idle panel (Run enabled); real run re-adopted as **Running** (not stuck on "Starting…") | Both |
| 4 | Verify + Stop | `verifyAutomateBotIsRunning()` → `stopAutomateRun()` | Run stops; idle **Run** returns | Both |

> Guards the known intermittent "stuck on Starting…" resync behaviour (GRWT-9318). Uses full `verifyAutomateBotIsRunning()` (controls + open position + contract details) before and after the account round-trip — not `verifyAutomateRunningControls()` alone.

> **Removed:** Former standalone strategy-selection flow — covered by Martingale (Flows 5–9) and D'Alembert (Flows 10–13) lifecycle specs via `selectStrategy()` in each run.

---

### Flow 4 — Automation unavailable for EU account (gating)

**Display name:** Automation unavailable for EU account (gating)

**Prerequisites:** An **EU/DIEL** account.

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Check trade panel | Log in on an EU account, open trade | The **"Automated trading"** tab is **not** available | Desktop |
| 1 | Check /automate | Navigate to `/automate` on EU account | Redirected away from `/automate` (automation not available) | Mobile |

---

### Supported trade type runs — shared pattern (Flows 5–13)

> Each UI trade type gets one spec per strategy under `playwright/tests/trade-automate/<trade-type>/`. Tests pass a **full inline params object** to a dedicated POM method — same pattern as manual `buy*AndVerify()`.

**Tests per spec (child flows):**

| Parent flow | Strategy | Outcomes / account split | Child flows |
| --- | --- | --- | --- |
| 5, 7–9 | Martingale | Dual-outcome trade types | `.1` outcome A demo · `.2` outcome A real · `.3` outcome B demo · `.4` outcome B real |
| 6 | Martingale | Accumulators | `.1` demo · `.2` real |
| 10–13 | D'Alembert | Dual-outcome trade types | `.1` outcome A demo · `.2` outcome A real · `.3` outcome B demo · `.4` outcome B real |
| 11 | D'Alembert | Accumulators | `.1` demo · `.2` real |

**Params shape:** trade-form fields at the top level + nested `automation` block (`strategy`, `stakeMultiplier` or `stakeIncrement`, `maxStake?`, `profitThreshold`, `lossThreshold`).

**Lifecycle order (POM — each `run*AndVerify()`):**

1. `goToAutomatedTrading()` → `switchToAccountType(accountType)`
2. `selectMarketAndTradeType(market, '<Category>', { mode: 'automate' })`
3. `selectTradeTypeOption(tradeType, position)` — dual-outcome flows only
4. `openAndVerifyAutomateGuide('<Category>')` → `verifyAutomationPanelFieldsVisible()`
5. Trade-form params → automation panel setters
6. `startAutomateRun()` → `verifyAutomateRunningControls()` → open-position details → `verifyAutomateSequentialContractPurchase()` (tick-duration only) → `verifyPauseAndResumeWhileRunning()` → `stopAutomateRun()` → `verifyAutomateStoppedWithClosedContract()`

> **Accumulators (Flow 6):** skip `verifyAutomateSequentialContractPurchase()`; call `verifyPauseAndResumeWhileRunning()` after the first contract is running.

| Trade type | Martingale | D'Alembert | Spec(s) |
| --- | --- | --- | --- |
| Rise/Fall | 5.1–5.4 | 10.1–10.4 | `verify-rise-martingale.spec.ts` · `verify-fall-martingale.spec.ts` · `verify-rise-dalembert.spec.ts` · `verify-fall-dalembert.spec.ts` |
| Accumulators | 6.1–6.2 | 6.3–6.4 | `verify-accumulators-martingale.spec.ts` · `verify-accumulators-dalembert.spec.ts` |
| Matches/Differs | 7.1–7.4 | 11.1–11.4 | `verify-matches-martingale.spec.ts` · `verify-differs-martingale.spec.ts` · `verify-matches-dalembert.spec.ts` · `verify-differs-dalembert.spec.ts` |
| Over/Under | 8.1–8.4 | 12.1–12.4 | `verify-over-martingale.spec.ts` · `verify-under-martingale.spec.ts` · `verify-over-dalembert.spec.ts` · `verify-under-dalembert.spec.ts` |
| Even/Odd | 9.1–9.4 | 13.1–13.4 | `verify-even-martingale.spec.ts` · `verify-odd-martingale.spec.ts` · `verify-even-dalembert.spec.ts` · `verify-odd-dalembert.spec.ts` |

> For D'Alembert, use `strategy: "D'Alembert"` and `stakeIncrement` instead of `stakeMultiplier`. D'Alembert flows use distinct stakes/thresholds to avoid closed-position lookup collisions with Martingale runs on the same backup accounts.

---

### Flow 5 — Rise/Fall

**Specs:** `rise-fall/verify-rise-martingale.spec.ts` (Flows **5.1** Rise demo · **5.2** Rise real) · `rise-fall/verify-fall-martingale.spec.ts` (Flows **5.3** Fall demo · **5.4** Fall real) · **POM:** `runRiseFallAndVerify()` · **Tags:** `@automate @martingale @desktop @mobile`

**Prerequisites:** Dedicated backup account (`TEST_EMAIL_AUTOMATE_RISE_FALL`).

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Open Automation | `goToAutomatedTrading()` | Automation tab/page active | Both |
| 2 | Switch account | `switchToAccountType(accountType)` | Active account matches `accountType` | Both |
| 3 | Select Rise/Fall | `selectMarketAndTradeType(market, 'Rise/Fall', { mode: 'automate' })` | Rise/Fall trade form + Run visible | Both |
| 4 | Select outcome | `selectTradeTypeOption(tradeType, 'top' \ | 'bottom')` | Purchase button colour matches Rise/Fall tab | Both |
| 5 | Guide popup | `openAndVerifyAutomateGuide('Rise/Fall')` | Title + trade-type copy; **Strategies overview**; strategy-info icon (`More info about strategies`); **desktop:** hover → portaled `.tooltip-content` (`automationGuideStrategyInfoTooltip`, re-hover via `toPass`); **mobile:** tap → Strategy overview ActionSheet → Close; Martingale / D'Alembert chips + params + warning; dismiss (desktop **X**, mobile **Got it**) | Both |
| 6 | Panel defaults | `verifyAutomationPanelFieldsVisible()` | Strategy params + risk management fields + Run visible | Both |
| 7 | Set duration | `selectDuration(durationUnit, durationValue)` | Duration field reflects value | Both |
| 8 | Set stake | `setStake(stake)` | Initial stake saved | Both |
| 9 | Automation panel | `selectStrategy`, `setStakeMultiplier`, `setMaxStake`, `setProfitThreshold`, `setLossThreshold` | All automation params saved | Both |
| 10 | Run lifecycle | `startAutomateRun()` → running controls → open-position details → `verifyAutomateSequentialContractPurchase()` → `verifyPauseAndResumeWhileRunning()` → `stopAutomateRun()` → closed contract verified | **Status: Running**; open details while first contract is live; sequential purchase; **Pause → Resume → Running**; Stop returns idle **Run**; closed position matches initial stake | Both |

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

**Specs:** `accumulators/verify-accumulators-martingale.spec.ts` (Flows **6.1** Martingale demo · **6.2** Martingale real) · `accumulators/verify-accumulators-dalembert.spec.ts` (Flows **6.3** D'Alembert demo · **6.4** D'Alembert real) · **POM:** `runAccumulatorsAndVerify()`

**Child flows:** **6.1** Martingale demo · **6.2** Martingale real · **6.3** D'Alembert demo · **6.4** D'Alembert real

**Prerequisites:** Dedicated backup account (`TEST_EMAIL_AUTOMATE_ACCUMULATORS`).

Same step table as Flow 5 where applicable (no outcome tab; uses `growthRate`, optional `takeProfit`). **Omits** `verifyAutomateSequentialContractPurchase()` — see shared lifecycle note above.

**Inline params (Flow 6.1 — Martingale demo):**

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

**Inline params (Flow 6.3 — D'Alembert demo):**

```typescript
await tradeAutomatePage.runAccumulatorsAndVerify({
    accountType: 'demo',
    market: 'Volatility 100 (1s) Index',
    growthRate: '5%',
    stake: '3',
    automation: {
        strategy: "D'Alembert",
        stakeIncrement: 3,
        maxStake: '60',
        profitThreshold: '111',
        lossThreshold: '112',
    },
});
```

---

### Flow 7 — Matches/Differs

**Specs:** `matches-differs/verify-matches-martingale.spec.ts` (Flows **7.1** Matches demo · **7.2** Matches real) · `matches-differs/verify-differs-martingale.spec.ts` (Flows **7.3** Differs demo · **7.4** Differs real) · **POM:** `runMatchesDiffersAndVerify()`

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

**Specs:** `over-under/verify-over-martingale.spec.ts` (Flows **8.1** Over demo · **8.2** Over real) · `over-under/verify-under-martingale.spec.ts` (Flows **8.3** Under demo · **8.4** Under real) · **POM:** `runOverUnderAndVerify()` · **Tags:** `@automate @martingale @desktop @mobile`

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

**Specs:** `even-odd/verify-even-martingale.spec.ts` (Flows **9.1** Even demo · **9.2** Even real) · `even-odd/verify-odd-martingale.spec.ts` (Flows **9.3** Odd demo · **9.4** Odd real) · **POM:** `runEvenOddAndVerify()` · **Tags:** `@automate @martingale @desktop @mobile` (Flow **9.3**/**9.4** spec also `@smoke`)

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

**Specs:** `rise-fall/verify-rise-dalembert.spec.ts` (Flows **10.1** Rise demo · **10.2** Rise real) · `rise-fall/verify-fall-dalembert.spec.ts` (Flows **10.3** Fall demo · **10.4** Fall real) · **POM:** `runRiseFallAndVerify()`

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

### Flow 11 — Matches/Differs (D'Alembert)

**Specs:** `matches-differs/verify-matches-dalembert.spec.ts` (Flows **11.1** Matches demo · **11.2** Matches real) · `matches-differs/verify-differs-dalembert.spec.ts` (Flows **11.3** Differs demo · **11.4** Differs real). Same steps as Flow 7; D'Alembert params.

---

### Flow 12 — Over/Under (D'Alembert)

**Specs:** `over-under/verify-over-dalembert.spec.ts` (Flows **12.1** Over demo · **12.2** Over real) · `over-under/verify-under-dalembert.spec.ts` (Flows **12.3** Under demo · **12.4** Under real) · **POM:** `runOverUnderAndVerify()` · **Tags:** `@automate @dalembert @desktop @mobile` (Flow **12.2** also `@smoke @production`)

**Prerequisites:** Dedicated backup account (`TEST_EMAIL_AUTOMATE_OVER_UNDER` / `_MOBILE`). On production, the spec uses pre-created funded accounts from `playwright/.env.production` instead of `createAccountV2viaJS`.

Same step table as Flow 8; `strategy: "D'Alembert"`, `stakeIncrement` instead of `stakeMultiplier`. Flow **12.2** real account uses production-gated params (min stake, conservative increment/thresholds).

**Inline params (Flow 12.1 — Over demo):**

```typescript
await tradeAutomatePage.runOverUnderAndVerify({
    accountType: 'demo',
    market: 'Volatility 10 Index',
    tradeType: 'Over',
    durationTicks: '10 ticks',
    digit: '2',
    stake: '2',
    automation: {
        strategy: "D'Alembert",
        stakeIncrement: 3,
        maxStake: '80',
        profitThreshold: '114',
        lossThreshold: '114',
    },
});
```

**Inline params (Flow 12.2 — Over real; production-gated):**

```typescript
const isProduction = process.env.TEST_ENV === 'production';
await tradeAutomatePage.runOverUnderAndVerify({
    accountType: 'real',
    market: 'Volatility 10 Index',
    tradeType: 'Over',
    durationTicks: '10 ticks',
    digit: '1',
    stake: isProduction ? '0.35' : '2',
    automation: {
        strategy: "D'Alembert",
        stakeIncrement: isProduction ? 1 : 3,
        maxStake: isProduction ? '5' : '81',
        profitThreshold: isProduction ? '5' : '113',
        lossThreshold: isProduction ? '6' : '113',
    },
});
```

---

### Flow 13 — Even/Odd (D'Alembert)

**Specs:** `even-odd/verify-even-dalembert.spec.ts` (Flows **13.1** Even demo · **13.2** Even real) · `even-odd/verify-odd-dalembert.spec.ts` (Flows **13.3** Odd demo · **13.4** Odd real). Same steps as Flow 9; D'Alembert params.

---

### Flow 14 — "Automation already running" adoption snackbar

**Display name:** "Automation already running" adoption snackbar

**Spec:** `playwright/tests/trade-automate/verify-already-running.spec.ts` · **Test:** `VERIFY Run click from a stale tab shows the already-running snackbar and starts no duplicate`

**Prerequisites:** Shared panel backup account (`TEST_EMAIL_AUTOMATE` / `_MOBILE`). `beforeEach` logs in; `afterEach` calls `stopAutomateRunIfActive()`.

**Params:** Volatility 100 Index · Rise/Fall · stake `1` · 10 ticks (low stake so the live bot cannot burn much before cleanup).

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Configure tab A | `goToAutomatedTrading()` → `selectMarketAndTradeType(...)` → `verifyPanelDefaultState()` → `setStake('1')` → `selectDuration('Ticks', '10 ticks')` | Tab A automate panel ready; run not started yet | Both |
| 2 | Open stale tab B | New page in same browser context → `goToAutomatedTrading()` → same market/trade type → `verifyPanelDefaultState()` **before** tab A starts the run | Tab B mount `recover()` finds no run → **Run** still visible (stale store) | Both |
| 3 | Start run on tab A | `startAutomateRun()` → assert **Status: Running** on tab A | Tab B never receives focus/resync — store stays stale | Both |
| 4 | Click Run on tab B | Tab B **Run** still enabled → click → in-click `resync()` finds tab A's run | Snackbar **"Automation is already running for this account."**; no duplicate `auto_start` | Both |
| 5 | Verify adoption | Assert tab B shows Pause/Stop + **Status: Running**; tab A still **Running** | Tab B adopts the existing run; tab A untouched | Both |
| 6 | Cleanup | `stopAutomateRunIfActive()` in `afterEach` | Run stopped | Both |

> **Reachability:** the Run button only renders while the store is idle, and the store auto-adopts any server-side run on mount/focus — so the snackbar is reachable only from a **stale tab** (a second context loaded before the run started, never focused again). The spec models this with a second tab in the same browser context: tab A starts the run, tab B (loaded pre-start, idle with Run visible) clicks Run → its in-click `resync()` finds tab A's run → snackbar, and tab B adopts the run's Pause/Stop state (no duplicate `auto_start`).

---

### Flow 15 — Invalid trade and automation param validation

**Display name:** Invalid trade/automation param validation (zero, min/max, and invalid drafts)

**Spec:** `playwright/tests/trade-automate/verify-trade-param-validation.spec.ts`

**Prerequisites:** Shared prerequisites (non-EU funded account).

**Params:** Volatility 100 Index · Rise/Fall · valid stake `1` · 10 ticks · then attempt invalid drafts.

#### Flow 15.1 — Martingale (trade form + automation panel)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Configure valid baseline | `goToAutomatedTrading()` → Rise/Fall automate → `verifyPanelDefaultState()` → stake `1` → 10 ticks | Martingale defaults; panel ready with valid committed params | Both |
| 2 | Initial stake below minimum | Open **Stake** Custom, enter `0.01` (below market min, e.g. `0.35`) | **"Please enter a stake amount that's at least …"**; **Save** disabled; dismiss restores prior stake | Both |
| 3 | Initial stake empty | Re-open **Stake** Custom, clear field, **Save** (desktop) | Desktop: **"Amount is a required field."**; Mobile: **Save** disabled; dismiss restores prior stake | Both |
| 4 | Initial stake invalid format | Re-open **Stake** Custom, enter `1.` (trailing decimal) | **"Should be a valid number."**; **Save** disabled; dismiss restores prior stake | Both |
| 5 | Initial stake above max payout | Re-open **Stake** Custom → read **Max payout** from details → draft until **Payout** row errors | **Payout** row `.error`; proposal min/max payout message; **Save** disabled; dismiss restores prior stake | Both |
| 6 | Initial stake above balance | Enter `{balance + 0.01}` (computed from header balance) | **"You only have {balance} {currency} left. Try a lower stake."**; Mobile: **Save** disabled; dismiss restores prior stake | Both |
| 7 | Profit threshold empty | Open **Profit threshold**, clear field | Desktop: **Save** disabled; Mobile: **Save** → **"Please enter a valid amount greater than 0"**; dismiss restores prior value | Both |
| 8 | Profit threshold zero | Re-open **Profit threshold**, enter `0`, **Save** | Same positive-amount error; Desktop: **Save** disabled; dismiss restores prior value | Both |
| 9 | Loss threshold empty | Open **Loss threshold**, clear field | Desktop: **Save** disabled; Mobile: **Save** → positive-amount error; dismiss restores prior value | Both |
| 10 | Loss threshold zero | Re-open **Loss threshold**, enter `0`, **Save** | Same positive-amount error; Desktop: **Save** disabled; dismiss restores prior value | Both |
| 11 | Stake multiplier open + empty | Open **Stake multiplier** Custom (valid draft) then clear field | On open: range hint **"The value must be greater than 1 and no more than 10."** (#1369); empty: **Save** disabled; dismiss restores prior multiplier | Both |
| 12 | Stake multiplier zero | Re-open **Stake multiplier** Custom, enter `0`, **Save** | Same range sentence as error; **Save** disabled; dismiss restores prior multiplier | Both |
| 13 | Stake multiplier above max | Custom enter `11`, **Save** | Same range sentence as error; **Save** disabled; dismiss restores prior multiplier | Both |
| 14 | Max. stake empty | Open **Max. stake**, enable toggle, clear amount field | **Save** disabled; dismiss restores `-` | Both |
| 15 | Max. stake zero | Re-open, enable toggle, enter `0`, **Save** | **"Please enter a valid amount greater than 0"**; Desktop: **Save** disabled; dismiss restores `-` | Both |
| 16 | Max. stake below initial | Enable toggle, enter `0.5` (initial stake `1`), **Save** | **"Max. stake must be equal or greater than 1"**; Desktop: **Save** disabled; dismiss restores `-` | Both |
| 17 | Panel stays idle | `verifyAutomatePanelIdleAfterParamValidation()` | **Run** visible and enabled; no **Status: Running** | Both |

#### Flow 15.2 — D'Alembert (stake increment)

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Switch strategy | Same baseline as 15.1 → `selectStrategy({ strategy: "D'Alembert", stakeIncrement: 2 })` | **Stake increment** field visible (`2 unit`); multiplier field replaced | Both |
| 2 | Stake increment open + empty | Open **Stake increment** Custom (valid draft) then clear field | On open: **"Minimum 1"** hint (#1369); empty: **Save** disabled; dismiss restores prior increment (`2 unit`) | Both |
| 3 | Stake increment zero | Re-open **Stake increment** Custom, enter `0`, **Save** | **"Increment must be at least 1"**; **Save** disabled; dismiss restores prior increment | Both |
| 4 | Panel stays idle | `verifyAutomatePanelIdleAfterParamValidation()` | **Run** visible and enabled; no active run | Both |

> Numeric automation editors strip non-digit input (`regex={/[^0-9.,]/g}`), so minus signs cannot be typed. Run-click validation for unsupported trade types remains **G2**.

### Flow 16 — Manual-to-Automate market compatibility

> Covers regressions for #916 (Range Break infinite trade-type load) and #917 (Crash/Boom + Accumulators symbol revert).

**Spec:** `playwright/tests/trade-automate/verify-automate-market-compatibility.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Open Automate | `goToAutomatedTrading()` | Strategy parameters panel renders | Both |
| 2 | Select market in Automate | `selectMarketAndTradeType(market, tradeType, { mode: 'automate' })` | Active tab reflects the chosen market + trade type — no infinite trade-type spinner (#916) | Both |
| 3a | Non-automatable (Range Break) | Range Break 100 Index · Multipliers | Snackbar explains market unavailable for automation; **Run** disabled | Both |
| 3b | Automatable (Crash/Boom) | Crash 500 Index · Accumulators | Tab stays on Crash 500 + Accumulators; Automate guide trigger visible; **Run** enabled (#917) | Both |

---

### Flow 17 — Automate param info icons reveal descriptions

> Covers regression for #995 on the automation panel and Accumulators trade-form params. Manual-trade counterpart: `playwright/flows/trade/flow.md` Flow 19.

**Prerequisites:** Funded real (staging test) account with Automation enabled (`TEST_EMAIL_AUTOMATE` / `TEST_EMAIL_AUTOMATE_MOBILE`).
**Spec:** `playwright/tests/trade-automate/verify-automate-param-info-icon-hover.spec.ts`
**Matrix:** `TradeAutomatePage.AUTOMATE_PARAM_INFO_ICON_CASES` — Rise/Fall (strategy panel only); Accumulators (strategy panel + Growth rate / Take profit trade-form rows).

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Open Automate | `goToAutomatedTrading()` | Strategy parameters panel renders | Both |
| 2 | Select market + trade type | `selectMarketAndTradeType(market, tradeType, { mode: 'automate', verifyParams: false })` | Automate panel shows the target trade type | Both |
| 3 | Desktop — strategy params | Hover each automation-panel row (Strategy, Stake multiplier, Max. stake, Profit/Loss threshold) | Info icon opacity `0` → `1`; tooltip shows `automation-config.ts` copy | Desktop |
| 4 | Desktop — Accumulators trade form | Hover Growth rate / Take profit collapsed rows | Same hover-reveal tooltip copy as manual Flow 19 | Desktop |
| 5 | Mobile — open parameter editor | Tap each read-only parameter field | Action sheet opens | Mobile |
| 6 | Mobile — verify info icon + copy | Tap `button.action-sheet-header-tooltip[aria-label="…"]` | Portaled tooltip shows the authored description | Mobile |

> **POM:** `verifyAutomateParamInfoIconOnDesktop()` · inherited `verifyTradeParamInfoIconOnDesktop()` / `verifyTradeParamInfoIconsInMobileEditor()` for trade-form rows · matrix constants `AUTOMATE_PARAM_INFO_DESCRIPTIONS` + `TRADE_PARAM_INFO_DESCRIPTIONS`.
>
> **Strategy-panel params (both matrix rows):** Strategy, Stake multiplier, Max. stake, Profit threshold, Loss threshold — collapsed-row hover reveal via shared `TradeParameterPopover` (`.trade-params__field-with-info`).
>
> **Accumulators-only trade-form params:** Growth rate, Take profit — same components as manual Flow 19; automate threshold copy differs from manual Risk management TP/SL.

---

### Flow 18 — Automate params disabled when market closed

> Covers regression for #1426. While the selected market is closed, Automate Strategy parameters and Risk management must be non-interactive (same as manual trade params). The automation-lock overlay must not appear — it is reserved for an active run lock.

**Prerequisites:** Funded real (staging test) account with Automation enabled (`TEST_EMAIL_AUTOMATE` / `TEST_EMAIL_AUTOMATE_MOBILE`).
**Spec:** `playwright/tests/trade-automate/verify-automate-closed-market.spec.ts`

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Open Trade | `gotoTradePage()` | Trade page loaded | Both |
| 2 | Select a CLOSED market | `selectClosedMarketFromPicker()` | First session-gated **CLOSED** row committed (skip when none closed) | Both |
| 3 | Open Automate | `goToAutomatedTrading()` | Strategy parameters panel; same closed market retained | Both |
| 4 | Assert closed banner | Observe reopen intro + countdown | `ClosedMarketMessage` intro + `HH:MM:SS` timer | Both |
| 5 | Assert Strategy params disabled | Observe Strategy, Stake multiplier/increment, Max. stake, Initial stake, Duration (if present) | All disabled | Both |
| 6 | Assert Risk management disabled | Observe Profit / Loss threshold | Both disabled | Both |
| 7 | Assert Run hidden + no lock overlay | Observe Run + `.trade-params__lock-overlay` | Run not visible (reopen banner occupies the slot); lock overlay count `0` | Both |

> **POM:** `verifyClosedMarketAutomateParamsDisabled(tradeType)`.

---

## Gap Flows

> Remaining coverage gaps. The proposed spec file for each gap is in [`coverage.md`](./coverage.md).

### G2 — Validation / unsupported-contract-type error

| # | Test case | Steps | Expected Result |
| --- | --- | --- | --- |
| 1 | Unsupported trade type | Select a trade type the strategy doesn't support, click **Run** | Inline error banner (e.g. strategy does not support this trade type); run does not start |
| 2 | Invalid params | Enter an invalid strategy parameter (e.g. multiplier ≤ 1), click **Run** | Validation error shown; run does not start |

> **Flow 15** covers in-editor validation for trade-form stake (below-min, empty, max payout, above balance) and automation thresholds/multiplier — drafts blocked or surfaced before Run. G2 case 2 (Run-click invalid params) remains a separate gap if needed.
