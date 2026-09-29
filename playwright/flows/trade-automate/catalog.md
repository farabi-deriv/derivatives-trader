# 🗺️ Automate Journey Catalog — Technical Reference

> Source of truth: `playwright/pages/TradeAutomatePage.ts` (extends `TradeParametersPage → TradeBasePage`)
> Source components: `packages/trader/src/AppV2/Components/AutomationPanel/` · `packages/trader/src/AppV2/Containers/Automate/` · `packages/trader/src/AppV2/Hooks/useRunControls.ts` · `packages/trader/src/Stores/Modules/Trading/automation-store.ts` · `packages/trader/src/AppV2/Components/TradePanelTabs/trade-panel-tabs.tsx` · `packages/trader/src/AppV2/Routes/AutomateSwitch.tsx`
> Fixture: `tradeAutomatePage` in `playwright/fixtures/fixtures.ts`
> Last updated: 2026-09-18

---

## Section 1 — Journey Index

| Journey ID | Spec File | Tags |
| --- | --- | --- |
| Flow 1 | Embedded in Flows 5–13 · `trade-automate/even-odd/verify-even-martingale.spec.ts` (canonical) | `@automate @martingale @desktop @mobile` |
| Flow 2.1 | `trade-automate/verify-threshold-auto-stop.spec.ts` | `@automate @desktop @mobile` |
| Flow 2.2 | `trade-automate/verify-threshold-auto-stop.spec.ts` | `@automate @desktop @mobile` |
| Flow 3 | `trade-automate/verify-account-switch-resync.spec.ts` | `@automate @desktop @mobile` |
| Flow 4 | `trade-automate/verify-eu-gating.spec.ts` | `@automate @desktop @mobile` |
| Flow 5.1 | `trade-automate/rise-fall/verify-rise-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 5.2 | `trade-automate/rise-fall/verify-rise-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 5.3 | `trade-automate/rise-fall/verify-fall-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 5.4 | `trade-automate/rise-fall/verify-fall-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 6.1 | `trade-automate/accumulators/verify-accumulators-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 6.2 | `trade-automate/accumulators/verify-accumulators-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 6.3 | `trade-automate/accumulators/verify-accumulators-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 6.4 | `trade-automate/accumulators/verify-accumulators-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 7.1 | `trade-automate/matches-differs/verify-matches-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 7.2 | `trade-automate/matches-differs/verify-matches-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 7.3 | `trade-automate/matches-differs/verify-differs-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 7.4 | `trade-automate/matches-differs/verify-differs-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 8.1 | `trade-automate/over-under/verify-over-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 8.2 | `trade-automate/over-under/verify-over-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 8.3 | `trade-automate/over-under/verify-under-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 8.4 | `trade-automate/over-under/verify-under-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 9.1 | `trade-automate/even-odd/verify-even-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 9.2 | `trade-automate/even-odd/verify-even-martingale.spec.ts` | `@automate @martingale @desktop @mobile` |
| Flow 9.3 | `trade-automate/even-odd/verify-odd-martingale.spec.ts` | `@automate @martingale @smoke @desktop @mobile` |
| Flow 9.4 | `trade-automate/even-odd/verify-odd-martingale.spec.ts` | `@automate @martingale @smoke @desktop @mobile` |
| Flow 10.1 | `trade-automate/rise-fall/verify-rise-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 10.2 | `trade-automate/rise-fall/verify-rise-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 10.3 | `trade-automate/rise-fall/verify-fall-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 10.4 | `trade-automate/rise-fall/verify-fall-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 11.1 | `trade-automate/matches-differs/verify-matches-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 11.2 | `trade-automate/matches-differs/verify-matches-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 11.3 | `trade-automate/matches-differs/verify-differs-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 11.4 | `trade-automate/matches-differs/verify-differs-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 12.1 | `trade-automate/over-under/verify-over-dalembert.spec.ts` | `@automate @dalembert @smoke @desktop @mobile @production` |
| Flow 12.2 | `trade-automate/over-under/verify-over-dalembert.spec.ts` | `@automate @dalembert @smoke @desktop @mobile @production` |
| Flow 12.3 | `trade-automate/over-under/verify-under-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 12.4 | `trade-automate/over-under/verify-under-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 13.1 | `trade-automate/even-odd/verify-even-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 13.2 | `trade-automate/even-odd/verify-even-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 13.3 | `trade-automate/even-odd/verify-odd-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 13.4 | `trade-automate/even-odd/verify-odd-dalembert.spec.ts` | `@automate @dalembert @desktop @mobile` |
| Flow 14 | `trade-automate/verify-already-running.spec.ts` | `@automate @desktop @mobile` |
| Flow 15 | `trade-automate/verify-trade-param-validation.spec.ts` | `@automate @desktop @mobile` |
| Flow 16 | `trade-automate/verify-automate-market-compatibility.spec.ts` | `@automate @desktop @mobile` |
| Flow 17 | `trade-automate/verify-automate-param-info-icon-hover.spec.ts` | `@automate @desktop @mobile` |
| Flow 18 | `trade-automate/verify-automate-closed-market.spec.ts` | `@automate @desktop @mobile` |
| G2 | `trade-automate/verify-validation.spec.ts` | `@automate @desktop @mobile` |

> **Env vars (Flows 16–18):** `TEST_EMAIL_AUTOMATE` (desktop) / `TEST_EMAIL_AUTOMATE_MOBILE` (mobile) — funded real staging account with Automation enabled (non-EU).

---

## Section 2 — Flow Details

### Shared account setup

**Panel / control specs (Flows 2.1–2.2, 3–4, 14–17, G2)** — shared backup account:

```typescript
const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_MOBILE' : 'TEST_EMAIL_AUTOMATE';
```

**Trade-type specs (Flows 5–13)** — one dedicated backup account per trade type (see env var table in Section 4). Example for Rise/Fall:

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

### Flow 1 — Pause and Resume (embedded in Flows 5–13)

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

### Flow 14 — verify-already-running.spec.ts

Single test — `VERIFY Run click from a stale tab shows the already-running snackbar and starts no duplicate`.

**Reachability (why the test uses a second tab):** the Run button renders only while the store is idle (`automation-actions.tsx`), and the store auto-adopts any server-side run on mount/loginid change and on visibility/focus (`useAutomationStore.tsx`). The snackbar therefore fires only from a **stale** store — a context loaded while no run existed and never focused again (the "parked screen" scenario in the `useRunControls.ts` guard comment).

The spec opens a second tab in the **same browser context** (shares the login session, independent JS runtime) _before_ tab A starts the run. Tab B's mount `recover()` finds no run → its Run button stays visible. Tab A starts the run and reaches Running. Tab B's Run click runs its own `await resync()` inside `handleRunClick` → finds tab A's run → snackbar **"Automation is already running for this account."** → early return, so no duplicate `auto_start`. The spec then asserts tab B slid into the _existing_ run's Pause/Stop state (adoption, not a new run) and that tab A's run is untouched.

Snackbars auto-dismiss, so assert via the POM's `alreadyRunningSnackbar` locator (`.snackbar--container` text match) immediately after the click.

### Flow 4 + G2 — not yet implemented

See `flow.md` for step tables. Flow 4 requires a dedicated EU/DIEL account. G2 asserts inline error banner (`automation-actions__error`, `role='alert'`) for unsupported trade types or invalid params.

### Flows 5–13 — supported trade type lifecycle runs

Dual-outcome trade types use **one spec per outcome and strategy** under `playwright/tests/trade-automate/<trade-type>/` — each file holds **two serial tests** (demo = `.1`/`.3`, real = `.2`/`.4` per outcome). Accumulators use **one spec per strategy** in the same parent flow — Martingale **6.1** demo · **6.2** real; D'Alembert **6.3** demo · **6.4** real. Each test passes a **full inline params object** to its POM method.

| Flow | Strategy | POM method | Child flows |
| --- | --- | --- | --- |
| 5 | Martingale | `runRiseFallAndVerify()` | 5.1–5.4 Rise/Fall demo+real |
| 6 | Both | `runAccumulatorsAndVerify()` | 6.1–6.2 Martingale · 6.3–6.4 D'Alembert demo+real |
| 7 | Martingale | `runMatchesDiffersAndVerify()` | 7.1–7.4 Matches/Differs demo+real |
| 8 | Martingale | `runOverUnderAndVerify()` | 8.1–8.4 Over/Under demo+real |
| 9 | Martingale | `runEvenOddAndVerify()` | 9.1–9.4 Even/Odd demo+real |
| 10 | D'Alembert | `runRiseFallAndVerify()` | 10.1–10.4 Rise/Fall demo+real |
| 11 | D'Alembert | `runMatchesDiffersAndVerify()` | 11.1–11.4 Matches/Differs demo+real |
| 12 | D'Alembert | `runOverUnderAndVerify()` | 12.1–12.4 Over/Under demo+real |
| 13 | D'Alembert | `runEvenOddAndVerify()` | 13.1–13.4 Even/Odd demo+real |

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
await this.verifyAutomateOpenPositionAndContractDetails({ market, stake, tradeType, maxStake: automation.maxStake });
await this.verifyAutomateSequentialContractPurchase();
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

| Parent | Spec | Backup env vars (desktop / mobile) |
| --- | --- | --- |
| 5 | `trade-automate/rise-fall/verify-rise-martingale.spec.ts` · `verify-fall-martingale.spec.ts` | `TEST_EMAIL_AUTOMATE_RISE_FALL` / `_MOBILE` |
| 6 | `trade-automate/accumulators/verify-accumulators-martingale.spec.ts` · `verify-accumulators-dalembert.spec.ts` | `TEST_EMAIL_AUTOMATE_ACCUMULATORS` / `_MOBILE` |
| 7 | `trade-automate/matches-differs/verify-matches-martingale.spec.ts` · `verify-differs-martingale.spec.ts` | `TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS` / `_MOBILE` |
| 8 | `trade-automate/over-under/verify-over-martingale.spec.ts` · `verify-under-martingale.spec.ts` | `TEST_EMAIL_AUTOMATE_OVER_UNDER` / `_MOBILE` |
| 9 | `trade-automate/even-odd/verify-even-martingale.spec.ts` · `verify-odd-martingale.spec.ts` | `TEST_EMAIL_AUTOMATE_EVEN_ODD` / `_MOBILE` |
| 10 | `trade-automate/rise-fall/verify-rise-dalembert.spec.ts` · `verify-fall-dalembert.spec.ts` | `TEST_EMAIL_AUTOMATE_RISE_FALL` / `_MOBILE` |
| 11 | `trade-automate/matches-differs/verify-matches-dalembert.spec.ts` · `verify-differs-dalembert.spec.ts` | `TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS` / `_MOBILE` |
| 12 | `trade-automate/over-under/verify-over-dalembert.spec.ts` · `verify-under-dalembert.spec.ts` | `TEST_EMAIL_AUTOMATE_OVER_UNDER` / `_MOBILE` |
| 13 | `trade-automate/even-odd/verify-even-dalembert.spec.ts` · `verify-odd-dalembert.spec.ts` | `TEST_EMAIL_AUTOMATE_EVEN_ODD` / `_MOBILE` |

Dual-outcome specs map one file per outcome and strategy — **5.1** `verify-rise-martingale.spec.ts` · **5.3** `verify-fall-martingale.spec.ts`, **7.1** `verify-matches-martingale.spec.ts` · **7.3** `verify-differs-martingale.spec.ts`, etc. (D'Alembert: **10.1**–**13.4** same pattern). Accumulators map to **6.1**/**6.2** (Martingale) and **6.3**/**6.4** (D'Alembert) in one spec per strategy. Params vary per test (unique stakes/thresholds avoid cross-contamination on closed-position lookup).

**Lifecycle test titles (Flows 5–13):**

```text
VERIFY automated trade run - {Strategy} - {surface} ({account})
```

| Slot | Values |
| --- | --- |
| Strategy | `Martingale` or `D'Alembert` |
| surface | Outcome only (`Rise`, `Even`, `Over`, `Matches`, …) or `Accumulators` |
| account | `Demo` or `Real` (not `Demo Account`) |

Use double-quoted strings when the title contains `D'Alembert`. Examples:

```typescript
/** Flow 5.1 — Rise/Fall Martingale: Rise (demo) */
test('VERIFY automated trade run - Martingale - Rise (Demo)', async ({ tradeAutomatePage }) => {
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

/** Flow 6.1 — Accumulators Martingale (demo) */
test('VERIFY automated trade run - Martingale - Accumulators (Demo)', async ({ tradeAutomatePage }) => {
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

/** Flow 12.1 — Over/Under D'Alembert: Over (demo) */
test("VERIFY automated trade run - D'Alembert - Over (Demo)", async ({ tradeAutomatePage }) => {
    // …runOverUnderAndVerify({ accountType: 'demo', tradeType: 'Over', … })
});
```

> **Flows 5–9** = Martingale lifecycles · **Flows 10–13** = D'Alembert lifecycles (same trade-type order: Rise/Fall → Accumulators under Flow 6 → Matches/Differs → Over/Under → Even/Odd)

Each `run*AndVerify()`: `startAutomateRun()` → `verifyAutomateRunningControls()` → open-position details → `verifyAutomateSequentialContractPurchase()` (tick types) or skip sequential (Accumulators; details after running controls) → `verifyPauseAndResumeWhileRunning()` → `stopAutomateRun()` → `verifyAutomateStoppedWithClosedContract()`.

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

### Flow 16 — verify-automate-market-compatibility.spec.ts

Two tests — manual-to-Automate market switching regressions (#916, #917).

```typescript
test('VERIFY Range Break Index loads Automate without an infinite trade-type spinner', async ({
    tradeAutomatePage,
}) => {
    await tradeAutomatePage.selectMarketAndTradeType('Range Break 100 Index', 'Multipliers', { mode: 'manual' });
    await tradeAutomatePage.goToAutomatedTrading();
    await expect(tradeAutomatePage.strategyParametersHeader).toBeVisible();
});

test('VERIFY Crash/Boom with Accumulators remains on the selected market in Automate', async ({
    tradeAutomatePage,
}) => {
    await tradeAutomatePage.verifyAutomateMarketCompatibility({
        market: 'Crash 500 Index',
        tradeType: 'Accumulators',
        expectAutomatable: true,
    });
});
```

### Flow 17 — verify-automate-param-info-icon-hover.spec.ts

Single matrix-driven test — automation-panel info icons (#995) plus Accumulators trade-form Growth rate / Take profit (shared with manual Flow 19).

```typescript
test.describe('Automate — parameter info icon', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
    test('VERIFY automate param info icons reveal authored descriptions', async ({ tradeAutomatePage }, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');

        for (const {
            market,
            tradeType,
            strategyDesktopParams,
            strategyMobileChecks,
            tradeFormDesktopParams,
            tradeFormMobileChecks,
        } of TradeAutomatePage.AUTOMATE_PARAM_INFO_ICON_CASES) {
            await tradeAutomatePage.selectMarketAndTradeType(market, tradeType, {
                mode: 'automate',
                verifyParams: false,
            });

            if (isMobile) {
                for (const { openField, icons } of strategyMobileChecks) {
                    await tradeAutomatePage.verifyTradeParamInfoIconsInMobileEditor(openField, icons);
                }
                for (const { openField, icons } of tradeFormMobileChecks ?? []) {
                    await tradeAutomatePage.verifyTradeParamInfoIconsInMobileEditor(openField, icons);
                }
                continue;
            }

            for (const { label, descriptions } of strategyDesktopParams) {
                await tradeAutomatePage.verifyAutomateParamInfoIconOnDesktop(label, descriptions);
            }
            for (const { label, descriptions } of tradeFormDesktopParams ?? []) {
                await tradeAutomatePage.verifyTradeParamInfoIconOnDesktop(label, descriptions);
            }
        }
    });
});
```

> **Matrix rows:** Volatility 100 Index · Rise/Fall (strategy panel only) · Volatility 100 Index · Accumulators (+ Growth rate / Take profit on the shared trade form). Copy source: `automation-config.ts` (`getStrategyDescription`, `getParamDescription`) for strategy-panel params; `TRADE_PARAM_INFO_DESCRIPTIONS` for Accumulators trade-form params.

**Run control API:**

| Method | Purpose |
| --- | --- |
| `startAutomateRun()` | Click **Run** (asserts visible + enabled first) |
| `verifyAutomateBotIsRunning()` | Full running check: controls + exactly one open position + contract details; tolerates **Starting…** |
| `verifyAutomateRunningControls()` | Fast running check only (private; tick lifecycles before open-position details) |
| `verifyAutomateSequentialContractPurchase()` | Tick types: one open at a time (dual-sample badge ± Open tab); no required open → 0 gap; reach **`Contracts >= 2`** with exactly one open. Run after open-position details |
| `verifyPauseAndResumeWhileRunning()` | Flow 1 — Pause → full paused UI → Resume → Running (embedded in Flows 5–13 lifecycles) |
| `stopAutomateRun()` | Click **Stop** + verify idle (Run visible, Running status gone) — replaces separate stop + verify |
| `stopAutomateRunIfActive()` | `afterEach` cleanup when Stop may or may not be present |
| `pauseRun()` / `resumeRun()` / `verifyPaused()` | Lower-level Flow 1 steps (used by `verifyPauseAndResumeWhileRunning()`) |
| `verifyLossThresholdAutoStop()` | Flow 2.1 — loss snackbar, idle controls hidden, params re-enabled (no manual Stop) |
| `verifyProfitThresholdAutoStop()` | Flow 2.2 — profit snackbar, idle controls hidden, params re-enabled (no manual Stop) |
| `verifyInitialStakeRejectsInvalidAmount()` | Flow 15 — stake below min · empty · invalid format (`1.`) · max payout (reads **Max payout** from stake details) · above balance; prior value restored on dismiss each time |
| `verifyAutomationThresholdsRejectInvalidAmount()` | Flow 15 — profit and loss threshold editors block empty · zero |
| `verifyStakeMultiplierRejectsInvalidAmount()` | Flow 15 — Martingale range hint on Custom open (#1369); blocks empty · zero · exclusive min `1` · values above 10 |
| `verifyStakeIncrementRejectsInvalidAmount()` | Flow 15 — D'Alembert **Minimum 1** hint on Custom open (#1369); blocks empty · zero |
| `verifyMaxStakeRejectsInvalidAmount()` | Flow 15 — Max. stake toggle on blocks empty · zero · cap below initial stake `1` |
| `verifyAutomatePanelIdleAfterParamValidation()` | Flow 15 — Run visible/enabled; no active run after rejected drafts |
| `verifyAutomateMarketCompatibility()` | Flow 16 — manual → Automate symbol/trade-type compatibility (#916, #917) |
| `verifyAutomateParamInfoIconOnDesktop()` | Flow 17 — desktop hover-reveal + tooltip for automation-panel params |
| `verifyClosedMarketAutomateParamsDisabled()` | Flow 18 — Strategy + Risk management disabled on closed market; no lock overlay (#1426) |
| `verifyTradeParamInfoIconOnDesktop()` | Flow 17 — inherited from `TradeParametersPage` — Accumulators trade-form params |
| `verifyTradeParamInfoIconsInMobileEditor()` | Flow 17 — inherited from `TradeParametersPage` — mobile editor header info icons |

**Panel verification helpers:**

| Method | Visibility | Used by |
| --- | --- | --- |
| `verifyPanelDefaultState()` | public | Flows 2–3 (panel/control specs) — fields visible + Run **enabled** |
| `verifyAutomationPanelFieldsVisible()` | private | Flows 5–13 lifecycle — fields visible after guide closes (Run visible only; enabled checked later via `startAutomateRun`) |
| `openAndVerifyAutomateGuide(tradeType)` | public | Flows 5–13 — open guide → `verifyAutomateGuidePopupContent` → dismiss (desktop **X**, mobile **Got it**) |
| `verifyAutomateGuidePopupContent(popup, guideTitle)` | private | Trade-type description, Strategies overview, strategy-info icon, Martingale/D'Alembert chips + params + warning (`automation-guide-config.ts`) |
| `verifyAutomateGuideStrategyInfo(content)` | private | Strategy-info icon: desktop hover → `automationGuideStrategyInfoTooltip`; mobile ActionSheet **Strategy overview** → Close |
| `automationGuideStrategyInfoTooltip` | getter | Portaled Quill tooltip — `.react-tiny-popover-container .tooltip-content` (desktop strategy-info copy) |

Supported trade types are defined in `automation-guide-config.ts` and gated at runtime by strategy `supported_contract_types` via `useAutomationSupportedTradeTypes.ts`. Non-automatable markets (Crypto, Crash/Boom) are excluded — use Volatility indices only.

---

## Section 3 — Tags Reference

| Tag | When to apply |
| --- | --- |
| `@automate` | All Automate (automated trading) tests in this module |
| `@martingale` | Martingale strategy lifecycle specs (Flows 5–9) |
| `@dalembert` | D'Alembert strategy lifecycle specs (Flows 10–13) |
| `@smoke` | Critical path — Over/Under D'Alembert Over (Flows **12.1**/**12.2** spec, `@production` on real); Odd Martingale (Flows **9.3**/**9.4** spec). Flow 1 pause/resume embedded in lifecycles |
| `@production` | Production smoke — Flow 12.2 Over D'Alembert (`verify-over-dalembert.spec.ts`; real uses stake `0.35`, increment `1`, digit `1`, maxStake `5`, profit/loss thresholds `5`/`6`; mandatory Stop cleanup) |
| `@desktop` | Desktop viewport (chromium project) |
| `@mobile` | Mobile viewport (chromium-mobile project) |

> **Note:** Most automate lifecycle specs do not carry `@production` — they place contracts via the automation bot on disposable staging accounts. **Exception:** Flow **12.2** Over D'Alembert real (`verify-over-dalembert.spec.ts`) is the production smoke path (minimum stake `0.35`, increment `1`, digit `1`, maxStake `5`, profit threshold `5`, loss threshold `6`; `stopAutomateRunIfActive()` in `afterEach`). The spec's describe tag applies to both Over tests in that file.

---

## Section 4 — Feature-Specific Decisions

### Module source paths

| Surface | Path |
| --- | --- |
| Automation panel UI | `packages/trader/src/AppV2/Components/AutomationPanel/` |
| Run controls hook | `packages/trader/src/AppV2/Hooks/useRunControls.ts` |
| MobX store | `packages/trader/src/Stores/Modules/Trading/automation-store.ts` |
| Desktop entry (trade tab) | `packages/trader/src/AppV2/Components/TradePanelTabs/trade-panel-tabs.tsx` |
| Mobile route | `packages/trader/src/AppV2/Routes/AutomateSwitch.tsx` → `AppV2/Containers/Automate/automate-mobile.tsx` |
| EU gating | `packages/trader/src/AppV2/Hooks/useIsAutomationEnabled.ts` (wraps `useIsEuAccount`) |

### No data-testids on the automation panel

The Automation panel and run controls (`automation-panel.tsx`, `automation-actions.tsx`) expose **no `data-testid`s**. Locate via Quill button labels, status text, and stable classes:

- **Run:** `automationActions.getByRole('button', { name: 'Run' })` — class `.automation-actions__run-button`
- **Running state (`verifyAutomateBotIsRunning`):** `.automation-actions__status` block with **Status: Running**, `.automation-status-info__icon`, stats line `Contracts: N | P/L: …`, `.automation-actions__run-actions` (Pause + `.automation-actions__run-stop` Stop); Run hidden; open Positions/contract-details stake is **≥ initial stake** and **≤ max. stake** when Martingale/D'Alembert adjusts stakes — **closed** tab still matches **initial stake** exactly
- **Paused state (`verifyPaused`):** same status block with **Status: Paused**, info icon, stats line, Resume + Stop enabled; Pause and Run hidden; trade-form + automation-panel params **disabled**; **no new contracts** for 15s (`Contracts: N` fixed, open badge/tab count must not exceed baseline — existing contracts may settle)
- **Starting:** Run button label becomes `Starting...` and is disabled
- **Status:** `automationActionsStatusLine.getByText('Status: Running')` / `'Status: Paused'`
- **Stats:** `automationActionsStatus.getByText(/Contracts:\s*\d+\s*\|\s*P\/L:/)`
- **Sequential purchase (`verifyAutomateSequentialContractPurchase`):** tick types only. Call **after** open-position details (details need a live contract). Assert at least one purchased + one open → hot loop never exceeds one open (badge ± Open tab) → **`Contracts >= 2`** with exactly one open (no required open → 0 gap; counter is cumulative). Then pause/resume.
- **Pause / Resume:** `automationRunActions.getByRole('button', { name: 'Pause' })` / `{ name: 'Resume' }`
- **Stop:** `automationRunActions.getByRole('button', { name: 'Stop' })` — class `.automation-actions__run-stop`
- **Panel headers:** `getByText('Strategy parameters')`, `getByText('Risk management')`
- **Strategy default:** Martingale (`DEFAULT_AUTOMATION_CONFIG.strategy = 'martingale'`); options include Martingale and D'Alembert
- **Default panel fields (`verifyPanelDefaultState` / `verifyAutomationPanelFieldsVisible`):** Strategy field (= Martingale), Stake multiplier, Profit threshold, Loss threshold, Max. stake, Run button
- **Automation guide (`openAndVerifyAutomateGuide`):** trigger `Automate {trade type}`; desktop Modal (`.automation-guide__modal`) / mobile ActionSheet (`.automation-guide__sheet-content`). Strategy-info icon `.automation-guide-content__info-icon` (`aria-label="More info about strategies"`) — **desktop:** Quill `Tooltip` portals to `automationGuideStrategyInfoTooltip` (assert via `toPass` + re-hover; do not use a one-shot `page.getByText`); **mobile:** ActionSheet `.automation-guide__strategy-info` with heading **Strategy overview**. Copy from `AUTOMATE_GUIDE_STRATEGY_INFO_TEXT` / `automation-guide-content.tsx`. Dismiss: desktop **X** (`.quill-modal__close-icon`), mobile **Got it**

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

Trade-type lifecycle methods (`runRiseFallAndVerify`, `runAccumulatorsAndVerify`, …) destructure params inline on the method — not exported types. Specs pass a matching object literal per test call; see `flow.md` Flows 5–13 for full examples per trade type.

### Env vars — backup accounts

| Scope | Desktop | Mobile |
| --- | --- | --- |
| Panel / controls (Flows 2–4, 14–15, G2) | `TEST_EMAIL_AUTOMATE` | `TEST_EMAIL_AUTOMATE_MOBILE` |
| Flow 5 Rise/Fall | `TEST_EMAIL_AUTOMATE_RISE_FALL` | `TEST_EMAIL_AUTOMATE_RISE_FALL_MOBILE` |
| Flow 6 Accumulators | `TEST_EMAIL_AUTOMATE_ACCUMULATORS` | `TEST_EMAIL_AUTOMATE_ACCUMULATORS_MOBILE` |
| Flow 7 Matches/Differs | `TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS` | `TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS_MOBILE` |
| Flow 8 Over/Under | `TEST_EMAIL_AUTOMATE_OVER_UNDER` | `TEST_EMAIL_AUTOMATE_OVER_UNDER_MOBILE` |
| Flow 9 Even/Odd | `TEST_EMAIL_AUTOMATE_EVEN_ODD` | `TEST_EMAIL_AUTOMATE_EVEN_ODD_MOBILE` |

Set each pair in `playwright/.env.staging` (Mailisk inboxes). Used as `backupAccount` when `createAccountV2viaJS` falls back — keeps each trade-type suite on its own account so parallel runs and leftover bots do not cross-contaminate.

### Feature gating — non-EU account required

Automation availability is controlled by `useIsAutomationEnabled` (`is_enabled = is_ready && !is_eu`). Flow 4 covers EU gating; all other flows require a non-EU account.

### Supported automation trade types

Trade-type lifecycle specs live under `playwright/tests/trade-automate/<trade-type>/`, mirroring `playwright/tests/trade/`.

Automation supports five UI trade types (source: `automation-guide-config.ts`, runtime-gated by strategy `supported_contract_types` via `useAutomationSupportedTradeTypes.ts`):

| Trade type | Flow (Martingale / D'Alembert) | Automatable market (example) | Notes |
| --- | --- | --- | --- |
| Even/Odd | 9.1–9.4 / 13.1–13.4 | Volatility 10 Index | Flow **9.3**/**9.4** Odd Martingale spec carries `@smoke` on staging |
| Rise/Fall | 5.1–5.4 / 10.1–10.4 | Volatility 100 Index | Covered in manual trade smoke |
| Accumulators | 6.1–6.4 | Volatility 10 Index | Martingale **6.1**/**6.2** · D'Alembert **6.3**/**6.4** |
| Matches/Differs | 7.1–7.4 / 11.1–11.4 | Volatility 10 Index | Matches / Differs per strategy |
| Over/Under | 8.1–8.4 / 12.1–12.4 | Volatility 10 Index | Production automate smoke (`@production` on Flow **12.2** Over D'Alembert real) |

Crypto and Crash/Boom symbols are **not** automatable (`is_symbol_automatable` is false) even when they offer a supported trade type — always pick Volatility indices.

Higher/Lower, Touch/No Touch, Multipliers, Turbos, and Vanillas are **not** in the automation guide config and are out of scope for Flows 5–13.

### Page Object section ordering

`TradeAutomatePage` follows: **LOCATORS** → **ACTIONS** (public then private) → **VERIFICATIONS** (public then private), matching the other trade POMs.
