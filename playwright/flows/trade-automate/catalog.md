# 🗺️ Automate Journey Catalog — Technical Reference

> Source of truth: `playwright/pages/TradeAutomatePage.ts` (extends `TradeParametersPage → TradeBasePage`)
> Source components: `packages/trader/src/AppV2/Components/AutomationPanel/` · `packages/trader/src/AppV2/Containers/Automate/` · `packages/trader/src/AppV2/Hooks/useRunControls.ts` · `packages/trader/src/Stores/Modules/Trading/automation-store.ts` · `packages/trader/src/AppV2/Components/TradePanelTabs/trade-panel-tabs.tsx` · `packages/trader/src/AppV2/Routes/AutomateSwitch.tsx`
> Fixture: `tradeAutomatePage` in `playwright/fixtures/fixtures.ts`
> Last updated: 2026-09-07

---

## Section 1 — Journey Index

| Journey ID | Spec File                                                                                     | Tags                                                        |
| ---------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Flow 1     | Embedded in Flows 5–14 · `trade-automate/even-odd/verify-even-martingale.spec.ts` (canonical) | `@automate @martingale @smoke @desktop @mobile @production` |
| Flow 2.1   | `trade-automate/verify-threshold-auto-stop.spec.ts`                                           | `@automate @desktop @mobile`                                |
| Flow 2.2   | `trade-automate/verify-threshold-auto-stop.spec.ts`                                           | `@automate @desktop @mobile`                                |
| Flow 3     | `trade-automate/verify-account-switch-resync.spec.ts`                                         | `@automate @desktop @mobile`                                |
| Flow 4     | `trade-automate/verify-eu-gating.spec.ts`                                                     | `@automate @desktop @mobile`                                |
| Flow 5.1   | `trade-automate/rise-fall/verify-rise-martingale.spec.ts`                                     | `@automate @martingale @desktop @mobile`                    |
| Flow 5.2   | `trade-automate/rise-fall/verify-fall-martingale.spec.ts`                                     | `@automate @martingale @desktop @mobile`                    |
| Flow 6.1   | `trade-automate/accumulators/verify-accumulators-martingale.spec.ts`                          | `@automate @martingale @desktop @mobile`                    |
| Flow 6.2   | `trade-automate/accumulators/verify-accumulators-martingale.spec.ts`                          | `@automate @martingale @desktop @mobile`                    |
| Flow 7.1   | `trade-automate/matches-differs/verify-matches-martingale.spec.ts`                            | `@automate @martingale @desktop @mobile`                    |
| Flow 7.2   | `trade-automate/matches-differs/verify-differs-martingale.spec.ts`                            | `@automate @martingale @desktop @mobile`                    |
| Flow 8.1   | `trade-automate/over-under/verify-over-martingale.spec.ts`                                    | `@automate @martingale @desktop @mobile`                    |
| Flow 8.2   | `trade-automate/over-under/verify-under-martingale.spec.ts`                                   | `@automate @martingale @desktop @mobile`                    |
| Flow 9.1   | `trade-automate/even-odd/verify-even-martingale.spec.ts`                                      | `@automate @martingale @smoke @desktop @mobile @production` |
| Flow 9.2   | `trade-automate/even-odd/verify-odd-martingale.spec.ts`                                       | `@automate @martingale @smoke @desktop @mobile`             |
| Flow 10.1  | `trade-automate/rise-fall/verify-rise-dalembert.spec.ts`                                      | `@automate @dalembert @desktop @mobile`                     |
| Flow 10.2  | `trade-automate/rise-fall/verify-fall-dalembert.spec.ts`                                      | `@automate @dalembert @desktop @mobile`                     |
| Flow 11.1  | `trade-automate/accumulators/verify-accumulators-dalembert.spec.ts`                           | `@automate @dalembert @desktop @mobile`                     |
| Flow 11.2  | `trade-automate/accumulators/verify-accumulators-dalembert.spec.ts`                           | `@automate @dalembert @desktop @mobile`                     |
| Flow 12.1  | `trade-automate/matches-differs/verify-matches-dalembert.spec.ts`                             | `@automate @dalembert @desktop @mobile`                     |
| Flow 12.2  | `trade-automate/matches-differs/verify-differs-dalembert.spec.ts`                             | `@automate @dalembert @desktop @mobile`                     |
| Flow 13.1  | `trade-automate/over-under/verify-over-dalembert.spec.ts`                                     | `@automate @dalembert @desktop @mobile`                     |
| Flow 13.2  | `trade-automate/over-under/verify-under-dalembert.spec.ts`                                    | `@automate @dalembert @desktop @mobile`                     |
| Flow 14.1  | `trade-automate/even-odd/verify-even-dalembert.spec.ts`                                       | `@automate @dalembert @desktop @mobile`                     |
| Flow 14.2  | `trade-automate/even-odd/verify-odd-dalembert.spec.ts`                                        | `@automate @dalembert @desktop @mobile`                     |
| Flow 15    | `trade-automate/verify-trade-param-validation.spec.ts`                                        | `@automate @desktop @mobile`                                |
| G1         | `trade-automate/verify-already-running.spec.ts`                                               | `@automate @desktop @mobile`                                |
| G2         | `trade-automate/verify-validation.spec.ts`                                                    | `@automate @desktop @mobile`                                |

---

## Section 2 — Flow Details

### Shared account setup

**Panel / control specs (Flows 2.1–2.2, 3–4, 15, G1, G2)** — shared backup account:

```typescript
const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_MOBILE' : 'TEST_EMAIL_AUTOMATE';
```

**Trade-type specs (Flows 5–14)** — one dedicated backup account per trade type (see env var table in Section 4). Example for Rise/Fall:

```typescript
const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_RISE_FALL_MOBILE' : 'TEST_EMAIL_AUTOMATE_RISE_FALL';
```

All specs use a funded **real (staging test)** account with automation enabled (non-EU). On staging, `'real'` uses virtual test funds.

```typescript
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({}, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_MOBILE' : 'TEST_EMAIL_AUTOMATE';

    const account = await createAccountV2viaJS('real', {
        currency: 'USD',
        trading: true,
        backupAccount: process.env[backupEmailVar],
    });
    accountEmail = account.email;
    accountPassword = account.password;
});

test.beforeEach(async ({ page, loginPage }) => {
    await TradeBasePage.seedLocalStorageOnOrigin(page);
    await loginPage.login(accountEmail, accountPassword);
});

test.afterEach(async ({ tradeAutomatePage }) => {
    await tradeAutomatePage.stopAutomateRunIfActive();
});
```

### Flow 1 — Pause and Resume (embedded in Flows 5–14)

No dedicated spec — pause/resume is exercised via `verifyPauseAndResumeWhileRunning()` inside every trade-type lifecycle (`run*AndVerify()`). Canonical reference: `verify-even-martingale.spec.ts` (Flow 9.1).

```typescript
// Inside runRiseFallAndVerify() — tick types; Accumulators skip sequential step
await this.verifyAutomateRunningControls(tradeType);
await this.verifyAutomateSequentialContractPurchase();
await this.verifyAutomateOpenPositionAndContractDetails({ market, stake, tradeType, maxStake: automation.maxStake });
await this.verifyPauseAndResumeWhileRunning({ market, stake, tradeType, maxStake: automation.maxStake });
await this.stopAutomateRun();
```

> **Flow 1** = pause/resume step embedded in each lifecycle spec (formerly `verify-pause-resume.spec.ts`)

### Flow 2.1 / 2.2 — verify-threshold-auto-stop.spec.ts

Single spec, **serial** — loss auto-stop (Flow 2.1) then profit auto-stop (Flow 2.2). Each test sets the opposite threshold unreachable so auto-stop is deterministic.

**Flow 2.1** — 10 ticks, loss threshold `1`, profit threshold `1000`:

```typescript
test('VERIFY loss threshold auto-stops the run', async ({ tradeAutomatePage }) => {
    await tradeAutomatePage.goToAutomatedTrading();
    await tradeAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', { mode: 'automate' });
    await tradeAutomatePage.verifyPanelDefaultState();
    await tradeAutomatePage.setStake('1');
    await tradeAutomatePage.selectDuration('Ticks', '10 ticks');
    await tradeAutomatePage.setProfitThreshold('1000');
    await tradeAutomatePage.setLossThreshold('1');
    await tradeAutomatePage.startAutomateRun();
    await tradeAutomatePage.verifyAutomateBotIsRunning({
        market: 'Volatility 100 Index',
        stake: '1',
        tradeType: 'Rise/Fall',
    });
    await tradeAutomatePage.verifyLossThresholdAutoStop();
});
```

**Flow 2.2** — 10 ticks, profit threshold `1`, loss threshold `1000`:

```typescript
test('VERIFY profit threshold auto-stops the run', async ({ tradeAutomatePage }) => {
    await tradeAutomatePage.goToAutomatedTrading();
    await tradeAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', { mode: 'automate' });
    await tradeAutomatePage.verifyPanelDefaultState();
    await tradeAutomatePage.setStake('1');
    await tradeAutomatePage.selectDuration('Ticks', '10 ticks');
    await tradeAutomatePage.setProfitThreshold('1');
    await tradeAutomatePage.setLossThreshold('1000');
    await tradeAutomatePage.startAutomateRun();
    await tradeAutomatePage.verifyAutomateBotIsRunning({
        market: 'Volatility 100 Index',
        stake: '1',
        tradeType: 'Rise/Fall',
    });
    await tradeAutomatePage.verifyProfitThresholdAutoStop();
});
```

> **Flow 2.1** = `VERIFY loss threshold auto-stops the run` · **Flow 2.2** = `VERIFY profit threshold auto-stops the run`

### Flow 3 — verify-account-switch-resync.spec.ts

Single test — Account B is the demo account every login carries. Guards GRWT-9318 (stuck on "Starting…" after account switch). No sequential purchase or pause/resume — only account-switch resync. Uses **10 ticks** (not the default 5) so open contract-details verification survives the round-trip.

```typescript
test.beforeAll(async ({ }, testInfo) => {
    const account = await createAccountV2viaJS('real', { currency: 'USD', trading: true, … });
    accountEmail = account.email;
    accountPassword = account.password;
});

test.beforeEach(async ({ page, loginPage }) => {
    await TradeBasePage.seedLocalStorageOnOrigin(page);
    await loginPage.login(accountEmail, accountPassword);
});

test('VERIFY automation run is re-adopted as Running after switching account', async ({
    tradeAutomatePage,
}) => {
    await tradeAutomatePage.goToAutomatedTrading();
    await tradeAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', { mode: 'automate' });
    await tradeAutomatePage.verifyPanelDefaultState();
    await tradeAutomatePage.setStake('1');
    await tradeAutomatePage.selectDuration('Ticks', '10 ticks');
    await tradeAutomatePage.startAutomateRun();
    await tradeAutomatePage.verifyAutomateBotIsRunning({
        market: 'Volatility 100 Index',
        stake: '1',
        tradeType: 'Rise/Fall',
    });

    await tradeAutomatePage.switchToAccountType('demo');
    await tradeAutomatePage.goToAutomatedTrading();
    await tradeAutomatePage.verifyPanelDefaultState();
    await tradeAutomatePage.switchToAccountType('real');

    await tradeAutomatePage.verifyAutomateBotIsRunning({
        market: 'Volatility 100 Index',
        stake: '1',
        tradeType: 'Rise/Fall',
    });

    await tradeAutomatePage.stopAutomateRun();
});

test.afterEach(async ({ tradeAutomatePage }) => {
    await tradeAutomatePage.stopAutomateRunIfActive();
});
```

> **Flow 3** = `VERIFY automation run is re-adopted as Running after switching account`

### Flow 4 + G1 + G2 — not yet implemented

See `flow.md` for step tables. Flow 4 requires a dedicated EU/DIEL account. G1 asserts snackbar from `useRunControls.ts`: **"Automation is already running for this account."** G2 asserts inline error banner (`automation-actions__error`, `role='alert'`) for unsupported trade types or invalid params.

### Flows 5–14 — supported trade type lifecycle runs

Dual-outcome trade types use **one spec per outcome and strategy** under `playwright/tests/trade-automate/<trade-type>/` — `verify-{outcome}-martingale.spec.ts` / `verify-{outcome}-dalembert.spec.ts` (demo + real serial per file). Accumulators use **one spec per strategy** — `verify-accumulators-martingale.spec.ts` / `verify-accumulators-dalembert.spec.ts`. Each test passes a **full inline params object** to its POM method.

| Flow | Strategy   | POM method                     | Child flows                 |
| ---- | ---------- | ------------------------------ | --------------------------- |
| 5    | Martingale | `runRiseFallAndVerify()`       | 5.1 Rise · 5.2 Fall         |
| 6    | Martingale | `runAccumulatorsAndVerify()`   | 6.1 demo · 6.2 real         |
| 7    | Martingale | `runMatchesDiffersAndVerify()` | 7.1 Matches · 7.2 Differs   |
| 8    | Martingale | `runOverUnderAndVerify()`      | 8.1 Over · 8.2 Under        |
| 9    | Martingale | `runEvenOddAndVerify()`        | 9.1 Even · 9.2 Odd          |
| 10   | D'Alembert | `runRiseFallAndVerify()`       | 10.1 Rise · 10.2 Fall       |
| 11   | D'Alembert | `runAccumulatorsAndVerify()`   | 11.1 demo · 11.2 real       |
| 12   | D'Alembert | `runMatchesDiffersAndVerify()` | 12.1 Matches · 12.2 Differs |
| 13   | D'Alembert | `runOverUnderAndVerify()`      | 13.1 Over · 13.2 Under      |
| 14   | D'Alembert | `runEvenOddAndVerify()`        | 14.1 Even · 14.2 Odd        |

**POM signatures (destructured inline — not exported):**

```typescript
// TradeAutomatePage.ts — each method destructures its param shape
async runRiseFallAndVerify({
    accountType,
    market,
    tradeType,
    durationUnit,
    durationValue,
    stake,
    automation,
}: {
    accountType: 'real' | 'demo';
    market: string;
    tradeType: 'Rise' | 'Fall';
    durationUnit: string;
    durationValue: string;
    stake: string;
    automation: {
        strategy: 'Martingale' | "D'Alembert";
        stakeMultiplier?: number;
        stakeIncrement?: number;
        maxStake?: string;
        profitThreshold: string;
        lossThreshold: string;
    };
}): Promise<void>

async runMatchesDiffersAndVerify({
    accountType,
    market,
    tradeType,
    durationTicks,
    digit,
    stake,
    automation,
}: {
    accountType: 'real' | 'demo';
    market: string;
    tradeType: 'Matches' | 'Differs';
    durationTicks: string;
    digit: string;
    stake: string;
    automation: { /* same automation block */ };
}): Promise<void>

async runAccumulatorsAndVerify({
    accountType,
    market,
    growthRate,
    stake,
    takeProfit,
    automation,
}: {
    accountType: 'real' | 'demo';
    market: string;
    growthRate: string;
    stake: string;
    takeProfit?: string;
    automation: { /* same automation block */ };
}): Promise<void>
```

**Lifecycle inside each `run*AndVerify()` (no shared wrapper — direct POM calls):**

```typescript
await this.goToAutomatedTrading();
await this.switchToAccountType(accountType);
await this.selectMarketAndTradeType(market, 'Rise/Fall', { mode: 'automate' });
await this.selectTradeTypeOption(tradeType, tradeType === 'Rise' ? 'top' : 'bottom');
await this.openAndVerifyAutomateGuide('Rise/Fall');
await this.verifyAutomationPanelFieldsVisible();
// …trade-form params (duration, stake, etc.)…
await this.selectStrategy({
    strategy: automation.strategy,
    stakeMultiplier: automation.stakeMultiplier,
    stakeIncrement: automation.stakeIncrement,
});
await this.setMaxStake(automation.maxStake, stake); // when provided
await this.setProfitThreshold(automation.profitThreshold);
await this.setLossThreshold(automation.lossThreshold);
await this.startAutomateRun();
await this.verifyAutomateRunningControls(tradeType);
await this.verifyAutomateSequentialContractPurchase();
await this.verifyAutomateOpenPositionAndContractDetails({ market, stake, tradeType, maxStake: automation.maxStake });
await this.verifyPauseAndResumeWhileRunning({ market, stake, tradeType, maxStake: automation.maxStake });
await this.stopAutomateRun();
await this.verifyAutomateStoppedWithClosedContract({ market, stake, tradeType });
```

**Spec call (inline object — Flow 5.1 Rise demo):**

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

| Parent | Spec                                                                                                     | Backup env vars (desktop / mobile)                |
| ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 5      | `trade-automate/rise-fall/verify-rise-martingale.spec.ts` · `verify-fall-martingale.spec.ts`             | `TEST_EMAIL_AUTOMATE_RISE_FALL` / `_MOBILE`       |
| 6      | `trade-automate/accumulators/verify-accumulators-martingale.spec.ts`                                     | `TEST_EMAIL_AUTOMATE_ACCUMULATORS` / `_MOBILE`    |
| 7      | `trade-automate/matches-differs/verify-matches-martingale.spec.ts` · `verify-differs-martingale.spec.ts` | `TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS` / `_MOBILE` |
| 8      | `trade-automate/over-under/verify-over-martingale.spec.ts` · `verify-under-martingale.spec.ts`           | `TEST_EMAIL_AUTOMATE_OVER_UNDER` / `_MOBILE`      |
| 9      | `trade-automate/even-odd/verify-even-martingale.spec.ts` · `verify-odd-martingale.spec.ts`               | `TEST_EMAIL_AUTOMATE_EVEN_ODD` / `_MOBILE`        |
| 10     | `trade-automate/rise-fall/verify-rise-dalembert.spec.ts` · `verify-fall-dalembert.spec.ts`               | `TEST_EMAIL_AUTOMATE_RISE_FALL` / `_MOBILE`       |
| 11     | `trade-automate/accumulators/verify-accumulators-dalembert.spec.ts`                                      | `TEST_EMAIL_AUTOMATE_ACCUMULATORS` / `_MOBILE`    |
| 12     | `trade-automate/matches-differs/verify-matches-dalembert.spec.ts` · `verify-differs-dalembert.spec.ts`   | `TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS` / `_MOBILE` |
| 13     | `trade-automate/over-under/verify-over-dalembert.spec.ts` · `verify-under-dalembert.spec.ts`             | `TEST_EMAIL_AUTOMATE_OVER_UNDER` / `_MOBILE`      |
| 14     | `trade-automate/even-odd/verify-even-dalembert.spec.ts` · `verify-odd-dalembert.spec.ts`                 | `TEST_EMAIL_AUTOMATE_EVEN_ODD` / `_MOBILE`        |

Dual-outcome specs map one file per child flow — **5.1** `verify-rise-martingale.spec.ts` · **5.2** `verify-fall-martingale.spec.ts`, **7.1** `verify-matches-martingale.spec.ts` · **7.2** `verify-differs-martingale.spec.ts`, etc. (D'Alembert: **10.1**–**14.2** same pattern). Accumulators map to **6.1** demo · **6.2** real (Martingale) and **11.1** demo · **11.2** real (D'Alembert) in a single spec each. Params vary per test (unique stakes/thresholds avoid cross-contamination on closed-position lookup):

```typescript
test('VERIFY automation run on Rise/Fall — Rise (Demo Account)', async ({ tradeAutomatePage }) => {
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
});

test('VERIFY automation run on Accumulators trade type (Demo Account)', async ({ tradeAutomatePage }) => {
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
});
```

> **Flows 5–9** = Martingale lifecycles · **Flows 10–14** = D'Alembert lifecycles (same trade-type order: Rise/Fall → Accumulators → Matches/Differs → Over/Under → Even/Odd)

Each `run*AndVerify()`: `startAutomateRun()` → `verifyAutomateRunningControls()` → `verifyAutomateSequentialContractPurchase()` (tick types) or skip (Accumulators) → open-position details → `verifyPauseAndResumeWhileRunning()` → `stopAutomateRun()` → `verifyAutomateStoppedWithClosedContract()`.

### Flow 15 — verify-trade-param-validation.spec.ts

Two tests — full negative validation for trade-form **Stake** and automation-panel fields on Rise/Fall automate.

**15.1 Martingale** — stake below-min, empty, max-payout, above-balance; loss/profit threshold zero; multiplier zero and above max (`11`); max stake zero and below initial stake.

**15.2 D'Alembert** — `selectStrategy({ strategy: "D'Alembert", stakeIncrement: 2 })` then stake increment zero.

```typescript
test('VERIFY automate trade params reject invalid drafts — Martingale', async ({ tradeAutomatePage }) => {
    await tradeAutomatePage.goToAutomatedTrading();
    await tradeAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', { mode: 'automate' });
    await tradeAutomatePage.verifyPanelDefaultState();
    await tradeAutomatePage.setStake('1');
    await tradeAutomatePage.selectDuration('Ticks', '10 ticks');

    await tradeAutomatePage.verifyInitialStakeRejectsInvalidAmount();
    await tradeAutomatePage.verifyAutomationThresholdsRejectInvalidAmount();
    await tradeAutomatePage.verifyStakeMultiplierRejectsInvalidAmount();
    await tradeAutomatePage.verifyMaxStakeRejectsInvalidAmount();
    await tradeAutomatePage.verifyAutomatePanelIdleAfterParamValidation();
});

test("VERIFY automate trade params reject invalid drafts — D'Alembert", async ({ tradeAutomatePage }) => {
    await tradeAutomatePage.goToAutomatedTrading();
    await tradeAutomatePage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall', { mode: 'automate' });
    await tradeAutomatePage.verifyPanelDefaultState();
    await tradeAutomatePage.setStake('1');
    await tradeAutomatePage.selectDuration('Ticks', '10 ticks');
    await tradeAutomatePage.selectStrategy({ strategy: "D'Alembert", stakeIncrement: 2 });

    await tradeAutomatePage.verifyStakeIncrementRejectsInvalidAmount();
    await tradeAutomatePage.verifyAutomatePanelIdleAfterParamValidation();
});
```

> **Flow 15** = negative in-editor validation before Run — Martingale full matrix + D'Alembert increment

**Run control API:**

| Method                                            | Purpose                                                                                                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startAutomateRun()`                              | Click **Run** (asserts visible + enabled first)                                                                                                                                               |
| `verifyAutomateBotIsRunning()`                    | Full running check: controls + exactly one open position + contract details; tolerates **Starting…**                                                                                          |
| `verifyAutomateRunningControls()`                 | Fast running check only (private; tick lifecycles before sequential purchase)                                                                                                                 |
| `verifyAutomateSequentialContractPurchase()`      | Tick types: one open at a time; first settles (open → 0); then one open with **`Contracts >= 2`** (may read 3+ on fast ticks). Run right after running controls, before open-position details |
| `verifyPauseAndResumeWhileRunning()`              | Flow 1 — Pause → full paused UI → Resume → Running (embedded in Flows 5–14 lifecycles)                                                                                                        |
| `stopAutomateRun()`                               | Click **Stop** + verify idle (Run visible, Running status gone) — replaces separate stop + verify                                                                                             |
| `stopAutomateRunIfActive()`                       | `afterEach` cleanup when Stop may or may not be present                                                                                                                                       |
| `pauseRun()` / `resumeRun()` / `verifyPaused()`   | Lower-level Flow 1 steps (used by `verifyPauseAndResumeWhileRunning()`)                                                                                                                       |
| `verifyLossThresholdAutoStop()`                   | Flow 2.1 — loss snackbar, idle controls hidden, params re-enabled (no manual Stop)                                                                                                            |
| `verifyProfitThresholdAutoStop()`                 | Flow 2.2 — profit snackbar, idle controls hidden, params re-enabled (no manual Stop)                                                                                                          |
| `verifyInitialStakeRejectsInvalidAmount()`        | Flow 15 — stake below min · empty · invalid format (`1.`) · max payout (reads **Max payout** from stake details) · above balance; prior value restored on dismiss each time                   |
| `verifyAutomationThresholdsRejectInvalidAmount()` | Flow 15 — profit and loss threshold editors block empty · zero                                                                                                                                |
| `verifyStakeMultiplierRejectsInvalidAmount()`     | Flow 15 — Martingale multiplier Custom tab blocks empty · zero · values above 10                                                                                                              |
| `verifyStakeIncrementRejectsInvalidAmount()`      | Flow 15 — D'Alembert increment Custom tab blocks empty · zero                                                                                                                                 |
| `verifyMaxStakeRejectsInvalidAmount()`            | Flow 15 — Max. stake toggle on blocks empty · zero · cap below initial stake `1`                                                                                                              |
| `verifyAutomatePanelIdleAfterParamValidation()`   | Flow 15 — Run visible/enabled; no active run after rejected drafts                                                                                                                            |

**Panel verification helpers:**

| Method                                  | Visibility | Used by                                                                                                                   |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `verifyPanelDefaultState()`             | public     | Flows 2–3 (panel/control specs) — fields visible + Run **enabled**                                                        |
| `verifyAutomationPanelFieldsVisible()`  | private    | Flows 5–14 lifecycle — fields visible after guide closes (Run visible only; enabled checked later via `startAutomateRun`) |
| `openAndVerifyAutomateGuide(tradeType)` | public     | Flows 5–14 — full guide popup flow before configuring params                                                              |

Supported trade types are defined in `automation-guide-config.ts` and gated at runtime by strategy `supported_contract_types` via `useAutomationSupportedTradeTypes.ts`. Non-automatable markets (Crypto, Crash/Boom) are excluded — use Volatility indices only.

---

## Section 3 — Tags Reference

| Tag           | When to apply                                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@automate`   | All Automate (automated trading) tests in this module                                                                                                |
| `@martingale` | Martingale strategy lifecycle specs (Flows 5–9)                                                                                                      |
| `@dalembert`  | D'Alembert strategy lifecycle specs (Flows 10–14)                                                                                                    |
| `@smoke`      | Critical path — Even/Odd Martingale lifecycle (Flow 9); embeds Flow 1 pause/resume                                                                   |
| `@production` | Production smoke — Flow 9.1 Even Martingale (`verify-even-martingale.spec.ts`; real uses minimum stake `0.35` on production, mandatory Stop cleanup) |
| `@desktop`    | Desktop viewport (chromium project)                                                                                                                  |
| `@mobile`     | Mobile viewport (chromium-mobile project)                                                                                                            |

> **Note:** Most automate lifecycle specs do not carry `@production` — they place contracts via the automation bot on disposable staging accounts. **Exception:** Flow **9.1** Even Martingale (`verify-even-martingale.spec.ts`) is tagged `@production` for production smoke (real uses minimum stake `0.35` on production, same pattern as manual Rise/Fall; `stopAutomateRunIfActive()` in `afterEach`).

---

## Section 4 — Feature-Specific Decisions

### Module source paths

| Surface                   | Path                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Automation panel UI       | `packages/trader/src/AppV2/Components/AutomationPanel/`                                                 |
| Run controls hook         | `packages/trader/src/AppV2/Hooks/useRunControls.ts`                                                     |
| MobX store                | `packages/trader/src/Stores/Modules/Trading/automation-store.ts`                                        |
| Desktop entry (trade tab) | `packages/trader/src/AppV2/Components/TradePanelTabs/trade-panel-tabs.tsx`                              |
| Mobile route              | `packages/trader/src/AppV2/Routes/AutomateSwitch.tsx` → `AppV2/Containers/Automate/automate-mobile.tsx` |
| EU gating                 | `packages/trader/src/AppV2/Hooks/useIsAutomationEnabled.ts` (wraps `useIsEuAccount`)                    |

### No data-testids on the automation panel

The Automation panel and run controls (`automation-panel.tsx`, `automation-actions.tsx`) expose **no `data-testid`s**. Locate via Quill button labels, status text, and stable classes:

- **Run:** `automationActions.getByRole('button', { name: 'Run' })` — class `.automation-actions__run-button`
- **Running state (`verifyAutomateBotIsRunning`):** `.automation-actions__status` block with **Status: Running**, `.automation-status-info__icon`, stats line `Contracts: N | P/L: …`, `.automation-actions__run-actions` (Pause + `.automation-actions__run-stop` Stop); Run hidden; open Positions/contract-details stake is **≥ initial stake** and **≤ max. stake** when Martingale/D'Alembert adjusts stakes — **closed** tab still matches **initial stake** exactly
- **Paused state (`verifyPaused`):** same status block with **Status: Paused**, info icon, stats line, Resume + Stop enabled; Pause and Run hidden; trade-form + automation-panel params **disabled**; **no new contracts** for 15s (`Contracts: N` fixed, open badge/tab count must not exceed baseline — existing contracts may settle)
- **Starting:** Run button label becomes `Starting...` and is disabled
- **Status:** `automationActionsStatusLine.getByText('Status: Running')` / `'Status: Paused'`
- **Stats:** `automationActionsStatus.getByText(/Contracts:\s*\d+\s*\|\s*P\/L:/)`
- **Sequential purchase (`verifyAutomateSequentialContractPurchase`):** tick types only. Call immediately after `verifyAutomateRunningControls()`. Assert `Contracts: 1` + one open → first settles (open → 0) → one open again with **`Contracts >= 2`** (counter is cumulative; fast ticks may show 3+ on first re-open). Never more than one open at a time. Then open-position details, then pause/resume.
- **Pause / Resume:** `automationRunActions.getByRole('button', { name: 'Pause' })` / `{ name: 'Resume' }`
- **Stop:** `automationRunActions.getByRole('button', { name: 'Stop' })` — class `.automation-actions__run-stop`
- **Panel headers:** `getByText('Strategy parameters')`, `getByText('Risk management')`
- **Strategy default:** Martingale (`DEFAULT_AUTOMATION_CONFIG.strategy = 'martingale'`); options include Martingale and D'Alembert
- **Default panel fields (`verifyPanelDefaultState` / `verifyAutomationPanelFieldsVisible`):** Strategy field (= Martingale), Stake multiplier, Profit threshold, Loss threshold, Max. stake, Run button

### Entry point is viewport-specific — `goToAutomatedTrading()` branches on `isMobile`

- **Desktop:** click the **Automated trading** tab in `TradePanelTabs` — `.trade-panel-tabs__toggle button.item` index 1 (icon-only; tooltip `Automated trading`).
- **Mobile:** tap `.bottom-nav-item--automate` (label **Automate**).

**Page Object locator pattern:**

```typescript
get automatedTradingTab(): Locator {
    return this.page.locator('.trade-panel-tabs__toggle button.item').nth(1);
}

// bottomNavAutomate lives on TradeBasePage:
// this.page.locator('.bottom-nav-item--automate')
```

### Async run-status transitions — never use fixed waits

`run_status` moves `idle → starting → running → stopping → stopped` over the WebSocket. After **Run**, the store holds `starting` until the **first contract is observed**, then flips to `running`.

**Impact:** use `verifyAutomateBotIsRunning()` — asserts **Status: Running** text and running controls; tolerate the transient **Starting…**. Never `waitForTimeout`.

### It runs a live bot — low stake + mandatory cleanup

Starting a run places actual (staging test) contracts continuously until stopped. Use a **low initial stake** (e.g. `1`), run **serial**, and **always Stop** in `afterEach` (`stopAutomateRunIfActive()`).

### Automation reuses the shared trade form

Trade type (Rise/Fall), duration, and **Stake** come from the shared trade params (`TradeParametersPage`). The automation panel adds strategy / stake-multiplier / max-stake / thresholds.

`TradeAutomatePage` extends `TradeParametersPage` and inherits `selectMarket`, `selectTradeType`, `setStake`, `setDuration`, `switchToAccountType`, etc.

`selectMarketAndTradeType(..., { mode: 'automate' })` skips Buy-button assertions and uses the **Initial stake** label; `verifyParamsForTradeType(tradeType, 'automate')` asserts the Run control via `assertAutomateRunControl()`.

Dual-outcome trade types (Rise/Fall, Matches/Differs, Over/Under, Even/Odd) also call `selectTradeTypeOption(tradeType, position)` after the category is selected — `tradeType` is the outcome tab label (e.g. `'Rise'`, `'Matches'`), not the category string.

Trade-type lifecycle methods (`runRiseFallAndVerify`, `runAccumulatorsAndVerify`, …) destructure params inline on the method — not exported types. Specs pass a matching object literal per test call; see `flow.md` Flows 5–14 for full examples per trade type.

### Env vars — backup accounts

| Scope                                | Desktop                               | Mobile                                       |
| ------------------------------------ | ------------------------------------- | -------------------------------------------- |
| Panel / controls (Flows 2–4, G1, G2) | `TEST_EMAIL_AUTOMATE`                 | `TEST_EMAIL_AUTOMATE_MOBILE`                 |
| Flow 5 Rise/Fall                     | `TEST_EMAIL_AUTOMATE_RISE_FALL`       | `TEST_EMAIL_AUTOMATE_RISE_FALL_MOBILE`       |
| Flow 6 Accumulators                  | `TEST_EMAIL_AUTOMATE_ACCUMULATORS`    | `TEST_EMAIL_AUTOMATE_ACCUMULATORS_MOBILE`    |
| Flow 7 Matches/Differs               | `TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS` | `TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS_MOBILE` |
| Flow 8 Over/Under                    | `TEST_EMAIL_AUTOMATE_OVER_UNDER`      | `TEST_EMAIL_AUTOMATE_OVER_UNDER_MOBILE`      |
| Flow 9 Even/Odd                      | `TEST_EMAIL_AUTOMATE_EVEN_ODD`        | `TEST_EMAIL_AUTOMATE_EVEN_ODD_MOBILE`        |

Set each pair in `playwright/.env.staging` (Mailisk inboxes). Used as `backupAccount` when `createAccountV2viaJS` falls back — keeps each trade-type suite on its own account so parallel runs and leftover bots do not cross-contaminate.

### Feature gating — non-EU account required

Automation availability is controlled by `useIsAutomationEnabled` (`is_enabled = is_ready && !is_eu`). Flow 4 covers EU gating; all other flows require a non-EU account.

### Supported automation trade types

Trade-type lifecycle specs live under `playwright/tests/trade-automate/<trade-type>/`, mirroring `playwright/tests/trade/`.

Automation supports five UI trade types (source: `automation-guide-config.ts`, runtime-gated by strategy `supported_contract_types` via `useAutomationSupportedTradeTypes.ts`):

| Trade type      | Flow (Martingale / D'Alembert) | Automatable market (example) | Notes                                                 |
| --------------- | ------------------------------ | ---------------------------- | ----------------------------------------------------- |
| Even/Odd        | 9.1–9.2 / 14.1–14.2            | Volatility 10 Index          | Primary lifecycle smoke (`@smoke` on Martingale spec) |
| Rise/Fall       | 5.1–5.2 / 10.1–10.2            | Volatility 100 Index         | Covered in manual trade smoke                         |
| Accumulators    | 6.1–6.2 / 11.1–11.2            | Volatility 10 Index          | Demo + real per strategy                              |
| Matches/Differs | 7.1–7.2 / 12.1–12.2            | Volatility 10 Index          | Matches / Differs per strategy                        |
| Over/Under      | 8.1–8.2 / 13.1–13.2            | Volatility 10 Index          | Over / Under per strategy                             |

Crypto and Crash/Boom symbols are **not** automatable (`is_symbol_automatable` is false) even when they offer a supported trade type — always pick Volatility indices.

Higher/Lower, Touch/No Touch, Multipliers, Turbos, and Vanillas are **not** in the automation guide config and are out of scope for Flows 5–14.

### Page Object section ordering

`TradeAutomatePage` follows: **LOCATORS** → **ACTIONS** (public then private) → **VERIFICATIONS** (public then private), matching the other trade POMs.
