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

| Method                                          | Purpose                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `startAutomateRun()`                            | Click **Run** (waits for enabled first)                                                                                                    |
| `verifyAutomateBotIsRunning()`                  | Assert **Status: Running** text, stats line, Pause/Stop labels; trade-form + automation-panel inputs **disabled**; tolerates **Starting…** |
| `stopAutomateRun()`                             | Click **Stop** and verify idle state (Run visible, Running status gone)                                                                    |
| `stopAutomateRunIfActive()`                     | `afterEach` cleanup — stop only if Stop is visible                                                                                         |
| `pauseRun()` / `resumeRun()` / `verifyPaused()` | Flow 1 pause/resume                                                                                                                        |
| `verifyLossThresholdAutoStop()`                 | Flow 2 — idle Run returns without manual Stop                                                                                              |

**Stake:** Use a low stake (e.g. `1`) whenever a run is started so the bot cannot burn much before it is stopped.

**Demo and real accounts (Flows 7–11):** Dual-outcome trade types (Flows 7, 9–11) run **four tests** per spec — both outcome tabs × demo/real. Accumulators (Flow 8) runs **two tests** — demo then real. The `beforeAll` account is always `'real'`; demo/real switching happens in-app. Each test uses **distinct inline params** (stake, thresholds, digit, etc.) so Martingale doubled stakes do not collide on closed-position lookup.

**Test folder layout:** Panel/control specs live at `playwright/tests/trade-automate/*.spec.ts`. Trade-type specs live under `playwright/tests/trade-automate/<trade-type>/`, mirroring `playwright/tests/trade/`.

> **No manual close of individual contracts** — stop the run via **Stop**; the bot manages its own contracts.

---

## Section 2 — Per-Flow Sections

### Flow 1 — verify-automate-pause-resume.spec.ts

**Display name:** Pause and Resume a running automation

**Prerequisites:** Shared prerequisites; a run is active (Running).

| #   | Step        | Action                                                | Expected Result                                     | Platform |
| --- | ----------- | ----------------------------------------------------- | --------------------------------------------------- | -------- |
| 1   | Start a run | `startAutomateRun()` → `verifyAutomateBotIsRunning()` | "Status: Running"; Pause + Stop visible             | Both     |
| 2   | Pause       | `pauseRun()` → `verifyPaused()`                       | **"Status: Paused"**; the button becomes **Resume** | Both     |
| 3   | Resume      | `resumeRun()` → `verifyAutomateBotIsRunning()`        | **"Status: Running"**; the button becomes **Pause** | Both     |
| 4   | Stop        | `stopAutomateRun()`                                   | Run stops; idle **Run** button returns              | Both     |

---

### Flow 2 — verify-automate-threshold-stop.spec.ts

**Display name:** Risk threshold auto-stop (loss threshold reached)

**Prerequisites:** Shared prerequisites. Set a very small **Loss threshold** so the run auto-stops quickly.

| #   | Step               | Action                                                                                     | Expected Result                              | Platform |
| --- | ------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------- | -------- |
| 1   | Set loss threshold | `setLossThreshold('1')`, `setProfitThreshold('1000')`, `setStake('1')`, `setDuration(...)` | Thresholds + stake saved                     | Both     |
| 2   | Start a run        | `startAutomateRun()` → `verifyAutomateBotIsRunning()`                                      | "Status: Running"                            | Both     |
| 3   | Wait for auto-stop | `verifyLossThresholdAutoStop()` (no manual Stop)                                           | Idle **Run** returns (snackbar is transient) | Both     |

---

### Flow 3 — verify-automate-strategy-selection.spec.ts

**Display name:** Strategy selection and parameters

**Prerequisites:** Shared prerequisites.

| #   | Step              | Action                                                                      | Expected Result                            | Platform |
| --- | ----------------- | --------------------------------------------------------------------------- | ------------------------------------------ | -------- |
| 1   | Panel defaults    | `verifyPanelDefaultState()`                                                 | Martingale defaults visible; Run enabled   | Both     |
| 2   | Select D'Alembert | `selectStrategy("D'Alembert")`                                              | Strategy shows D'Alembert; params update   | Both     |
| 3   | Set params        | `setStakeIncrement(3)`                                                      | Stake increment saved                      | Both     |
| 4   | Start + Stop      | `startAutomateRun()` → `verifyAutomateBotIsRunning()` → `stopAutomateRun()` | Runs with D'Alembert, then returns to idle | Both     |

---

### Flow 4 — verify-automate-resync.spec.ts

**Display name:** Resync after account switch (run stays Running)

**Prerequisites:** Shared prerequisites; a run is active on Account A; a second account available.

| #   | Step           | Action                                                             | Expected Result                                                         | Platform |
| --- | -------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------- |
| 1   | Start a run    | `startAutomateRun()` → `verifyAutomateBotIsRunning()` on Account A | "Status: Running"                                                       | Both     |
| 2   | Switch account | `switchToAccountType('demo')` then `'real'`                        | Automation on A is re-adopted as **Running** (not stuck on "Starting…") | Both     |
| 3   | Verify + Stop  | `verifyAutomateBotIsRunning()` → `stopAutomateRun()`               | Run stops; idle **Run** returns                                         | Both     |

> Guards the known intermittent "stuck on Starting…" resync behaviour (GRWT-9318).

---

### Flow 6 — verify-automate-eu-gating.spec.ts

**Display name:** Automation unavailable for EU account (gating)

**Prerequisites:** An **EU/DIEL** account.

| #   | Step              | Action                                | Expected Result                                             | Platform |
| --- | ----------------- | ------------------------------------- | ----------------------------------------------------------- | -------- |
| 1   | Check trade panel | Log in on an EU account, open trade   | The **"Automated trading"** tab is **not** available        | Desktop  |
| 1   | Check /automate   | Navigate to `/automate` on EU account | Redirected away from `/automate` (automation not available) | Mobile   |

---

### Supported trade type runs — shared pattern (Flows 7–11)

> Each UI trade type automation supports gets its own spec under `playwright/tests/trade-automate/<trade-type>/`. Tests pass a **full inline params object** to a dedicated POM method (`runRiseFallAndVerify`, `runAccumulatorsAndVerify`, etc.) — same pattern as manual `buy*AndVerify()`.

**Tests per spec:**

| Flows                  | Outcomes                                            | Tests                                                                                |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 7, 9–11 (dual-outcome) | Rise/Fall · Matches/Differs · Over/Under · Even/Odd | **4** — `{Outcome} (Demo Account)` · `{Outcome} (Real Account)` for each outcome tab |
| 8 (Accumulators)       | Single trade type                                   | **2** — `(Demo Account)` · `(Real Account)`                                          |

**Params convention:** No shared exported types — each `run*AndVerify()` method destructures its params inline on the function signature (same pattern as `buyRiseAndVerify({ accountType, market, … })` on manual trade POMs). Specs pass a matching inline object literal per test call.

**Params shape:** trade-form fields at the top level + nested `automation` block for the automation panel:

| Block        | Fields                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Top-level    | `accountType`, `market`, `tradeType` (dual-outcome flows only), `stake`, plus trade-type-specific fields (see below)         |
| `automation` | `strategy`, `stakeMultiplier` (Martingale) or `stakeIncrement` (D'Alembert), `maxStake?`, `profitThreshold`, `lossThreshold` |

**Lifecycle order (POM — each `run*AndVerify()`):**

1. `goToAutomatedTrading()` — desktop **Automated trading** tab · mobile **Automate** bottom nav
2. `switchToAccountType(accountType)`
3. `selectMarketAndTradeType(market, '<Category>', { mode: 'automate' })` — e.g. `'Rise/Fall'`, `'Matches/Differs'`; asserts trade-form shell + Run via `verifyParamsForTradeType(..., 'automate')`
4. `selectTradeTypeOption(tradeType, position)` — dual-outcome flows only; e.g. `'Rise'` → `'top'`, `'Fall'` → `'bottom'`
5. `openAndVerifyAutomateGuide('<Category>')` — guide popup: trade-type description, strategy chips (Martingale ↔ D'Alembert), info tooltip; dismiss desktop **X** / mobile **Got it**
6. `verifyAutomationPanelFieldsVisible()` — strategy params + risk management fields + Run visible (default Martingale)
7. Trade-form params — duration / digit / growth rate / stake / optional take profit (trade-type-specific)
8. Automation panel — `selectStrategy()`, `setStakeMultiplier()` or `setStakeIncrement()`, optional `setMaxStake()`, `setProfitThreshold()`, `setLossThreshold()`
9. `startAutomateRun()` → `verifyAutomateBotIsRunning({ market, stake, tradeType })` → `stopAutomateRun()` → `verifyAutomateStoppedWithClosedContract({ market, stake, tradeType })`

> `tradeType` passed to verification helpers is the **outcome tab label** (e.g. `'Rise'`, `'Matches'`, `'Even'`) for dual-outcome flows, or the category name (e.g. `'Accumulators'`) when there is no outcome tab.

| Trade type      | Flow | Spec                                                      | POM method                     | Trade-form params (in addition to `market`, `stake`) |
| --------------- | ---- | --------------------------------------------------------- | ------------------------------ | ---------------------------------------------------- |
| Rise/Fall       | 7    | `rise-fall/verify-automate-rise-fall.spec.ts`             | `runRiseFallAndVerify()`       | `tradeType`, `durationUnit`, `durationValue`         |
| Accumulators    | 8    | `accumulators/verify-automate-accumulators.spec.ts`       | `runAccumulatorsAndVerify()`   | `growthRate`, `takeProfit?`                          |
| Matches/Differs | 9    | `matches-differs/verify-automate-matches-differs.spec.ts` | `runMatchesDiffersAndVerify()` | `tradeType`, `durationTicks`, `digit`                |
| Over/Under      | 10   | `over-under/verify-automate-over-under.spec.ts`           | `runOverUnderAndVerify()`      | `tradeType`, `durationTicks`, `digit`                |
| Even/Odd        | 11   | `even-odd/verify-automate-even-odd.spec.ts`               | `runEvenOddAndVerify()`        | `tradeType`, `durationTicks`                         |

**Representative params** (first demo test per spec — each test overrides inline as needed):

| Param                        | Rise/Fall            | Accumulators        | Matches/Differs           | Over/Under           | Even/Odd            |
| ---------------------------- | -------------------- | ------------------- | ------------------------- | -------------------- | ------------------- |
| `market`                     | Volatility 100 Index | Volatility 10 Index | Volatility 10 Index       | Volatility 10 Index  | Volatility 10 Index |
| `tradeType`                  | `'Rise'` / `'Fall'`  | —                   | `'Matches'` / `'Differs'` | `'Over'` / `'Under'` | `'Even'` / `'Odd'`  |
| `stake`                      | `1` (Rise demo)      | `1`                 | `3` (Matches demo)        | `1`                  | `1`                 |
| Duration                     | `Ticks` / `10 ticks` | —                   | `10 ticks`                | `10 ticks`           | `10 ticks`          |
| `growthRate`                 | —                    | `4%` (demo)         | —                         | —                    | —                   |
| `digit`                      | —                    | —                   | `1` (Matches demo)        | `3` (Over demo)      | —                   |
| `takeProfit`                 | —                    | omitted (no TP)     | —                         | —                    | —                   |
| `automation.strategy`        | Martingale           | Martingale          | Martingale                | Martingale           | Martingale          |
| `automation.stakeMultiplier` | `2`                  | `2`                 | `2`                       | `2`                  | `5` (Even/Odd demo) |
| `automation.maxStake`        | `150`                | `50`                | `56`                      | `70`                 | `66`                |
| `automation.profitThreshold` | `150`                | `101`               | `108`                     | `104`                | `201`               |
| `automation.lossThreshold`   | `150`                | `102`               | `109`                     | `104`                | `200`               |

**Example call (Flow 7 — Rise demo, matches current spec):**

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

> For D'Alembert, use `strategy: "D'Alembert"` and `stakeIncrement` instead of `stakeMultiplier`. Omit `maxStake` to leave max stake disabled.

---

### Flow 7 — rise-fall/verify-automate-rise-fall.spec.ts

**Display name:** Automate — Rise/Fall trade type run (primary lifecycle smoke)

**POM:** `runRiseFallAndVerify()`

**Tests:** `VERIFY automation run on Rise/Fall — Rise (Demo Account)` · `— Rise (Real Account)` · `— Fall (Demo Account)` · `— Fall (Real Account)`

**Prerequisites:** Shared prerequisites; dedicated backup account (`TEST_EMAIL_AUTOMATE_RISE_FALL`).

| #   | Step             | Action                                                                                                 | Expected Result                                                                                              | Platform |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | Open Automation  | `goToAutomatedTrading()`                                                                               | Automation tab/page active                                                                                   | Both     |
| 2   | Switch account   | `switchToAccountType(accountType)`                                                                     | Active account matches `accountType`                                                                         | Both     |
| 3   | Select Rise/Fall | `selectMarketAndTradeType(market, 'Rise/Fall', { mode: 'automate' })`                                  | Rise/Fall trade form + Run visible                                                                           | Both     |
| 4   | Select outcome   | `selectTradeTypeOption(tradeType, 'top' \| 'bottom')`                                                  | Purchase button colour matches Rise/Fall tab                                                                 | Both     |
| 5   | Guide popup      | `openAndVerifyAutomateGuide('Rise/Fall')`                                                              | **Automate Rise/Fall** guide verified; strategy chips + tooltips; dismiss (desktop **X**, mobile **Got it**) | Both     |
| 6   | Panel defaults   | `verifyAutomationPanelFieldsVisible()`                                                                 | Strategy params + risk management fields + Run visible (Martingale defaults)                                 | Both     |
| 7   | Set duration     | `selectDuration(durationUnit, durationValue)`                                                          | Duration field reflects value (e.g. Ticks / 10 ticks)                                                        | Both     |
| 8   | Set stake        | `setStake(stake)`                                                                                      | Initial stake saved on trade form                                                                            | Both     |
| 9   | Automation panel | `selectStrategy`, `setStakeMultiplier`, `setMaxStake`, `setProfitThreshold`, `setLossThreshold`        | All automation params saved                                                                                  | Both     |
| 10  | Run lifecycle    | `startAutomateRun()` → `verifyAutomateBotIsRunning()` → `stopAutomateRun()` → closed contract verified | **Status: Running**; Stop returns idle **Run**; closed position matches initial stake                        | Both     |

**Inline params (spec — Rise demo):**

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

### Flow 8 — accumulators/verify-automate-accumulators.spec.ts

**Display name:** Automate — Accumulators trade type run

**POM:** `runAccumulatorsAndVerify()`

**Tests:** `VERIFY automation run on Accumulators trade type (Demo Account)` · `(Real Account)`

**Prerequisites:** Shared prerequisites; dedicated backup account (`TEST_EMAIL_AUTOMATE_ACCUMULATORS`).

| #   | Step                | Action                                                                                          | Expected Result                                                                      | Platform |
| --- | ------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| 1   | Open Automation     | `goToAutomatedTrading()`                                                                        | Automation tab/page active                                                           | Both     |
| 2   | Switch account      | `switchToAccountType(accountType)`                                                              | Active account matches `accountType`                                                 | Both     |
| 3   | Select Accumulators | `selectMarketAndTradeType(market, 'Accumulators', { mode: 'automate' })`                        | Growth rate + stake + Run visible                                                    | Both     |
| 4   | Guide popup         | `openAndVerifyAutomateGuide('Accumulators')`                                                    | **Automate Accumulators** guide verified; dismiss (desktop **X**, mobile **Got it**) | Both     |
| 5   | Panel defaults      | `verifyAutomationPanelFieldsVisible()`                                                          | Strategy params + risk management fields + Run visible                               | Both     |
| 6   | Set growth rate     | `setGrowthRate(growthRate)`                                                                     | Growth rate field shows value (e.g. `5%`)                                            | Both     |
| 7   | Set stake           | `setStake(stake)`                                                                               | Initial stake saved                                                                  | Both     |
| 8   | Set take profit     | Optional `setTakeProfit(takeProfit)`                                                            | Take profit field shows value (omit for no TP)                                       | Both     |
| 9   | Automation panel    | `selectStrategy`, `setStakeMultiplier`, `setMaxStake`, `setProfitThreshold`, `setLossThreshold` | All automation params saved                                                          | Both     |
| 10  | Run lifecycle       | `startAutomateRun()` → `verifyAutomateBotIsRunning()` → `stopAutomateRun()`                     | **Status: Running**; `stopAutomateRun()` verifies idle **Run** returns               | Both     |

**Inline params (spec — demo):**

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

> Optional: add `takeProfit: '5'` for the with-TP variant. Omit for no take-profit (current lifecycle spec).

---

### Flow 9 — matches-differs/verify-automate-matches-differs.spec.ts

**Display name:** Automate — Matches/Differs trade type run

**POM:** `runMatchesDiffersAndVerify()`

**Tests:** `VERIFY automation run on Matches/Differs — Matches (Demo Account)` · `— Matches (Real Account)` · `— Differs (Demo Account)` · `— Differs (Real Account)`

**Prerequisites:** Shared prerequisites; dedicated backup account (`TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS`).

| #   | Step                   | Action                                                                                                 | Expected Result                                                                       | Platform |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------- |
| 1   | Open Automation        | `goToAutomatedTrading()`                                                                               | Automation tab/page active                                                            | Both     |
| 2   | Switch account         | `switchToAccountType(accountType)`                                                                     | Active account matches `accountType`                                                  | Both     |
| 3   | Select Matches/Differs | `selectMarketAndTradeType(market, 'Matches/Differs', { mode: 'automate' })`                            | Last digit + duration + Run visible                                                   | Both     |
| 4   | Select outcome         | `selectTradeTypeOption(tradeType, 'top' \| 'bottom')`                                                  | Purchase button colour matches Matches/Differs tab                                    | Both     |
| 5   | Guide popup            | `openAndVerifyAutomateGuide('Matches/Differs')`                                                        | Guide verified; dismiss (desktop **X**, mobile **Got it**)                            | Both     |
| 6   | Panel defaults         | `verifyAutomationPanelFieldsVisible()`                                                                 | Strategy params + risk management fields + Run visible                                | Both     |
| 7   | Set digit              | `selectDigit(digit)`                                                                                   | Digit selector reflects value (e.g. `1`)                                              | Both     |
| 8   | Set duration           | `selectDuration('Ticks', durationTicks)`                                                               | Duration reflects value (e.g. `10 ticks`)                                             | Both     |
| 9   | Set stake              | `setStake(stake)`                                                                                      | Initial stake saved                                                                   | Both     |
| 10  | Automation panel       | `selectStrategy`, `setStakeMultiplier`, `setMaxStake`, `setProfitThreshold`, `setLossThreshold`        | All automation params saved                                                           | Both     |
| 11  | Run lifecycle          | `startAutomateRun()` → `verifyAutomateBotIsRunning()` → `stopAutomateRun()` → closed contract verified | **Status: Running**; Stop returns idle **Run**; closed position matches initial stake | Both     |

**Inline params (spec — Matches demo):**

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

### Flow 10 — over-under/verify-automate-over-under.spec.ts

**Display name:** Automate — Over/Under trade type run

**POM:** `runOverUnderAndVerify()`

**Tests:** `VERIFY automation run on Over/Under — Over (Demo Account)` · `— Over (Real Account)` · `— Under (Demo Account)` · `— Under (Real Account)`

**Prerequisites:** Shared prerequisites; dedicated backup account (`TEST_EMAIL_AUTOMATE_OVER_UNDER`).

| #   | Step              | Action                                                                                                 | Expected Result                                                                       | Platform |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------- |
| 1   | Open Automation   | `goToAutomatedTrading()`                                                                               | Automation tab/page active                                                            | Both     |
| 2   | Switch account    | `switchToAccountType(accountType)`                                                                     | Active account matches `accountType`                                                  | Both     |
| 3   | Select Over/Under | `selectMarketAndTradeType(market, 'Over/Under', { mode: 'automate' })`                                 | Last digit + duration + Run visible                                                   | Both     |
| 4   | Select outcome    | `selectTradeTypeOption(tradeType, 'top' \| 'bottom')`                                                  | Purchase button colour matches Over/Under tab                                         | Both     |
| 5   | Guide popup       | `openAndVerifyAutomateGuide('Over/Under')`                                                             | Guide verified; dismiss (desktop **X**, mobile **Got it**)                            | Both     |
| 6   | Panel defaults    | `verifyAutomationPanelFieldsVisible()`                                                                 | Strategy params + risk management fields + Run visible                                | Both     |
| 7   | Set digit         | `selectDigit(digit)`                                                                                   | Digit selector reflects value (e.g. `3`)                                              | Both     |
| 8   | Set duration      | `selectDuration('Ticks', durationTicks)`                                                               | Duration reflects value (e.g. `10 ticks`)                                             | Both     |
| 9   | Set stake         | `setStake(stake)`                                                                                      | Initial stake saved                                                                   | Both     |
| 10  | Automation panel  | `selectStrategy`, `setStakeMultiplier`, `setMaxStake`, `setProfitThreshold`, `setLossThreshold`        | All automation params saved                                                           | Both     |
| 11  | Run lifecycle     | `startAutomateRun()` → `verifyAutomateBotIsRunning()` → `stopAutomateRun()` → closed contract verified | **Status: Running**; Stop returns idle **Run**; closed position matches initial stake | Both     |

**Inline params (spec — Over demo):**

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

### Flow 11 — even-odd/verify-automate-even-odd.spec.ts

**Display name:** Automate — Even/Odd trade type run

**POM:** `runEvenOddAndVerify()`

**Tests:** `VERIFY automation run on Even/Odd — Even (Demo Account)` · `— Even (Real Account)` · `— Odd (Demo Account)` · `— Odd (Real Account)`

**Prerequisites:** Shared prerequisites; dedicated backup account (`TEST_EMAIL_AUTOMATE_EVEN_ODD`).

| #   | Step             | Action                                                                                                 | Expected Result                                                                       | Platform |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------- |
| 1   | Open Automation  | `goToAutomatedTrading()`                                                                               | Automation tab/page active                                                            | Both     |
| 2   | Switch account   | `switchToAccountType(accountType)`                                                                     | Active account matches `accountType`                                                  | Both     |
| 3   | Select Even/Odd  | `selectMarketAndTradeType(market, 'Even/Odd', { mode: 'automate' })`                                   | Duration + Run visible; **no** last-digit prediction                                  | Both     |
| 4   | Select outcome   | `selectTradeTypeOption(tradeType, 'top' \| 'bottom')`                                                  | Purchase button colour matches Even/Odd tab                                           | Both     |
| 5   | Guide popup      | `openAndVerifyAutomateGuide('Even/Odd')`                                                               | Guide verified; dismiss (desktop **X**, mobile **Got it**)                            | Both     |
| 6   | Panel defaults   | `verifyAutomationPanelFieldsVisible()`                                                                 | Strategy params + risk management fields + Run visible                                | Both     |
| 7   | Set duration     | `selectDuration('Ticks', durationTicks)`                                                               | Duration reflects value (e.g. `10 ticks`)                                             | Both     |
| 8   | Set stake        | `setStake(stake)`                                                                                      | Initial stake saved                                                                   | Both     |
| 9   | Automation panel | `selectStrategy`, `setStakeMultiplier`, `setMaxStake`, `setProfitThreshold`, `setLossThreshold`        | All automation params saved                                                           | Both     |
| 10  | Run lifecycle    | `startAutomateRun()` → `verifyAutomateBotIsRunning()` → `stopAutomateRun()` → closed contract verified | **Status: Running**; Stop returns idle **Run**; closed position matches initial stake | Both     |

**Inline params (spec — Even demo):**

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
