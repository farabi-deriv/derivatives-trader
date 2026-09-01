# 🗺️ Automate Journey Catalog — Technical Reference

> Source of truth: `playwright/pages/TradeAutomatePage.ts` (extends `TradeParametersPage → TradeBasePage`)
> Source components: `packages/trader/src/AppV2/Components/AutomationPanel/` · `packages/trader/src/AppV2/Containers/Automate/` · `packages/trader/src/AppV2/Hooks/useRunControls.ts` · `packages/trader/src/Stores/Modules/Trading/automation-store.ts` · `packages/trader/src/AppV2/Components/TradePanelTabs/trade-panel-tabs.tsx` · `packages/trader/src/AppV2/Routes/AutomateSwitch.tsx`
> Fixture: `tradeAutomatePage` in `playwright/fixtures/fixtures.ts`
> Created: 2026-07-07 | Last updated: 2026-08-26 (run-control API: `startAutomateRun`, `verifyAutomateBotIsRunning`, `stopAutomateRun`)

---

## Section 1 — Journey Index

| Journey ID | Spec File                                                                | Tags                                |
| ---------- | ------------------------------------------------------------------------ | ----------------------------------- |
| Flow 1     | `trade-automate/verify-automate-pause-resume.spec.ts`                    | `@automate @desktop @mobile`        |
| Flow 2     | `trade-automate/verify-automate-threshold-stop.spec.ts`                  | `@automate @desktop @mobile`        |
| Flow 3     | `trade-automate/verify-automate-strategy-selection.spec.ts`              | `@automate @desktop @mobile`        |
| Flow 4     | `trade-automate/verify-automate-resync.spec.ts`                          | `@automate @desktop @mobile`        |
| Flow 6     | `trade-automate/verify-automate-eu-gating.spec.ts`                       | `@automate @desktop @mobile`        |
| G1         | `trade-automate/verify-automate-already-running.spec.ts`                 | `@automate @desktop @mobile`        |
| G2         | `trade-automate/verify-automate-validation.spec.ts`                      | `@automate @desktop @mobile`        |
| Flow 7     | `trade-automate/rise-fall/verify-automate-rise-fall.spec.ts`             | `@automate @smoke @desktop @mobile` |
| Flow 8     | `trade-automate/accumulators/verify-automate-accumulators.spec.ts`       | `@automate @desktop @mobile`        |
| Flow 9     | `trade-automate/matches-differs/verify-automate-matches-differs.spec.ts` | `@automate @desktop @mobile`        |
| Flow 10    | `trade-automate/over-under/verify-automate-over-under.spec.ts`           | `@automate @desktop @mobile`        |
| Flow 11    | `trade-automate/even-odd/verify-automate-even-odd.spec.ts`               | `@automate @desktop @mobile`        |

---

## Section 2 — Flow Details

### Shared account setup

**Panel / control specs (Flows 1–4, G1, G2)** — shared backup account:

```typescript
const backupEmailVar = isMobile ? 'TEST_EMAIL_AUTOMATE_MOBILE' : 'TEST_EMAIL_AUTOMATE';
```

**Trade-type specs (Flows 7–11)** — one dedicated backup account per trade type (see env var table in Section 4). Example for Rise/Fall:

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

### Flow 1 — verify-automate-pause-resume.spec.ts

```typescript
test.describe('Automate — Pause/Resume', { tag: ['@automate', '@desktop', '@mobile'] }, () => {
    test('VERIFY pause and resume a running automation', async ({ tradeAutomatePage }) => {
        await tradeAutomatePage.goToAutomatedTrading();
        await tradeAutomatePage.startAutomateRun();
        await tradeAutomatePage.verifyAutomateBotIsRunning();
        await tradeAutomatePage.pauseRun();
        await tradeAutomatePage.verifyPaused();
        await tradeAutomatePage.resumeRun();
        await tradeAutomatePage.verifyAutomateBotIsRunning();
        await tradeAutomatePage.stopAutomateRun();
    });
});
```

> **Flow 1** = `VERIFY pause and resume a running automation`

### Flow 2 — verify-automate-threshold-stop.spec.ts

Uses a short tick duration (5 ticks) and a tiny loss threshold (`1`) so auto-stop fires deterministically. Profit threshold is set high (`1000`) so the run cannot stop on profit.

```typescript
test('VERIFY loss threshold auto-stops the run', async ({ tradeAutomatePage }) => {
    await tradeAutomatePage.goToAutomatedTrading();
    await tradeAutomatePage.verifyPanelDefaultState();
    await tradeAutomatePage.setDuration('Ticks', '5 ticks');
    await tradeAutomatePage.setLossThreshold('1');
    await tradeAutomatePage.setProfitThreshold('1000');
    await tradeAutomatePage.setStake('1');
    await tradeAutomatePage.startAutomateRun();
    await tradeAutomatePage.verifyAutomateBotIsRunning();
    await tradeAutomatePage.verifyLossThresholdAutoStop(); // idle Run returns; no manual Stop
});
```

> **Flow 2** = `VERIFY loss threshold auto-stops the run`

### Flow 3 — verify-automate-strategy-selection.spec.ts

```typescript
test("VERIFY select D'Alembert strategy, set its parameter, then run and stop", async ({ tradeAutomatePage }) => {
    await tradeAutomatePage.goToAutomatedTrading();
    await tradeAutomatePage.verifyPanelDefaultState();
    await tradeAutomatePage.selectStrategy("D'Alembert");
    await tradeAutomatePage.setStakeIncrement(3);
    await tradeAutomatePage.startAutomateRun();
    await tradeAutomatePage.verifyAutomateBotIsRunning();
    await tradeAutomatePage.stopAutomateRun();
});
```

> **Flow 3** = `VERIFY select D'Alembert strategy, set its parameter, then run and stop`

### Flow 4 — verify-automate-resync.spec.ts

Second account is the demo account every login carries. Guards GRWT-9318 (stuck on "Starting…" after account switch).

```typescript
test('VERIFY automation run is re-adopted as Running after switching account away and back', async ({
    tradeAutomatePage,
}) => {
    await tradeAutomatePage.goToAutomatedTrading();
    await tradeAutomatePage.verifyPanelDefaultState();
    await tradeAutomatePage.setStake('1');
    await tradeAutomatePage.startAutomateRun();
    await tradeAutomatePage.verifyAutomateBotIsRunning();
    await tradeAutomatePage.switchToAccountType('demo');
    await tradeAutomatePage.switchToAccountType('real');
    await tradeAutomatePage.verifyAutomateBotIsRunning();
    await tradeAutomatePage.stopAutomateRun();
});
```

> **Flow 4** = `VERIFY automation run is re-adopted as Running after switching account away and back`

### Flow 6 + G1 + G2 — not yet implemented

See `flow.md` for step tables. Flow 6 requires a dedicated EU/DIEL account. G1 asserts snackbar from `useRunControls.ts`: **"Automation is already running for this account."** G2 asserts inline error banner (`automation-actions__error`, `role='alert'`) for unsupported trade types or invalid params.

### Flows 7–11 — supported trade type lifecycle runs

One spec per trade type under `playwright/tests/trade-automate/<trade-type>/`. Each test passes a **full inline params object** to its POM method — no exported param types; each `run*AndVerify()` destructures params inline on the method signature (same pattern as `buyRiseAndVerify()` on `TradeRiseFallPage`).

| Flow | POM method                     | Trade-form params                                                              | Automation panel (`automation`)                                                                   |
| ---- | ------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 7    | `runRiseFallAndVerify()`       | `accountType`, `market`, `tradeType`, `durationUnit`, `durationValue`, `stake` | `strategy`, `stakeMultiplier` / `stakeIncrement`, `maxStake?`, `profitThreshold`, `lossThreshold` |
| 8    | `runAccumulatorsAndVerify()`   | `accountType`, `market`, `growthRate`, `stake`, `takeProfit?`                  | same                                                                                              |
| 9    | `runMatchesDiffersAndVerify()` | `accountType`, `market`, `tradeType`, `durationTicks`, `digit`, `stake`        | same                                                                                              |
| 10   | `runOverUnderAndVerify()`      | `accountType`, `market`, `tradeType`, `durationTicks`, `digit`, `stake`        | same                                                                                              |
| 11   | `runEvenOddAndVerify()`        | `accountType`, `market`, `tradeType`, `durationTicks`, `stake`                 | same                                                                                              |

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
await this.selectStrategy(automation.strategy);
await this.setStakeMultiplier(automation.stakeMultiplier); // or setStakeIncrement for D'Alembert
await this.setMaxStake(automation.maxStake, stake); // when provided
await this.setProfitThreshold(automation.profitThreshold);
await this.setLossThreshold(automation.lossThreshold);
await this.startAutomateRun();
await this.verifyAutomateBotIsRunning({ market, stake, tradeType });
await this.stopAutomateRun();
await this.verifyAutomateStoppedWithClosedContract({ market, stake, tradeType });
```

**Spec call (inline object — Flow 7 Rise demo):**

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

| Flow | Spec                                                                     | Backup env vars (desktop / mobile)                |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| 7    | `trade-automate/rise-fall/verify-automate-rise-fall.spec.ts`             | `TEST_EMAIL_AUTOMATE_RISE_FALL` / `_MOBILE`       |
| 8    | `trade-automate/accumulators/verify-automate-accumulators.spec.ts`       | `TEST_EMAIL_AUTOMATE_ACCUMULATORS` / `_MOBILE`    |
| 9    | `trade-automate/matches-differs/verify-automate-matches-differs.spec.ts` | `TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS` / `_MOBILE` |
| 10   | `trade-automate/over-under/verify-automate-over-under.spec.ts`           | `TEST_EMAIL_AUTOMATE_OVER_UNDER` / `_MOBILE`      |
| 11   | `trade-automate/even-odd/verify-automate-even-odd.spec.ts`               | `TEST_EMAIL_AUTOMATE_EVEN_ODD` / `_MOBILE`        |

Dual-outcome specs (Flows 7, 9–11) run **four tests** — both outcome tabs × demo/real. Accumulators (Flow 8) runs **two tests** — demo then real. Params vary per test (unique stakes/thresholds avoid Martingale cross-contamination on closed-position lookup):

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

> **Flow 7** = Rise/Fall · **Flow 8** = Accumulators · **Flow 9** = Matches/Differs · **Flow 10** = Over/Under · **Flow 11** = Even/Odd

Each `run*AndVerify()`: `goToAutomatedTrading()` → account switch → market/category (`mode: 'automate'`) → `selectTradeTypeOption()` (dual-outcome flows) → guide verification → panel field visibility → trade-form params → automation panel setters → `startAutomateRun()` → `verifyAutomateBotIsRunning()` → `stopAutomateRun()` → `verifyAutomateStoppedWithClosedContract()`. Override any field by editing the inline object in the spec — no shared params helper file.

**Run control API:**

| Method                                          | Purpose                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `startAutomateRun()`                            | Click **Run** (asserts visible + enabled first)                                                                                 |
| `verifyAutomateBotIsRunning()`                  | **Status: Running** text, stats line, Pause/Stop labels; trade-form + automation-panel inputs disabled; tolerates **Starting…** |
| `stopAutomateRun()`                             | Click **Stop** + verify idle (Run visible, Running status gone) — replaces separate stop + verify                               |
| `stopAutomateRunIfActive()`                     | `afterEach` cleanup when Stop may or may not be present                                                                         |
| `pauseRun()` / `resumeRun()` / `verifyPaused()` | Flow 1                                                                                                                          |
| `verifyLossThresholdAutoStop()`                 | Flow 2 auto-stop (no manual Stop)                                                                                               |

**Panel verification helpers:**

| Method                                  | Visibility | Used by                                                                                                                   |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `verifyPanelDefaultState()`             | public     | Flows 2–4 (panel/control specs) — fields visible + Run **enabled**                                                        |
| `verifyAutomationPanelFieldsVisible()`  | private    | Flows 7–11 lifecycle — fields visible after guide closes (Run visible only; enabled checked later via `startAutomateRun`) |
| `openAndVerifyAutomateGuide(tradeType)` | public     | Flows 7–11 — full guide popup flow before configuring params                                                              |

Supported trade types are defined in `automation-guide-config.ts` and gated at runtime by strategy `supported_contract_types` via `useAutomationSupportedTradeTypes.ts`. Non-automatable markets (Crypto, Crash/Boom) are excluded — use Volatility indices only.

---

## Section 3 — Tags Reference

| Tag         | When to apply                                         |
| ----------- | ----------------------------------------------------- |
| `@automate` | All Automate (automated trading) tests in this module |
| `@smoke`    | Critical path — Rise/Fall lifecycle run (Flow 7)      |
| `@desktop`  | Desktop viewport (chromium project)                   |
| `@mobile`   | Mobile viewport (chromium-mobile project)             |

> **Note:** Automate specs intentionally do not carry `@production` — they place live (staging test) contracts via the automation bot.

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
- **Running state (`verifyAutomateBotIsRunning`):** `.automation-actions__status` block with **Status: Running**, `.automation-status-info__icon`, stats line `Contracts: N | P/L: …`, `.automation-actions__run-actions` (Pause + `.automation-actions__run-stop` Stop); Run hidden
- **Starting:** Run button label becomes `Starting...` and is disabled
- **Status:** `automationActionsStatusLine.getByText('Status: Running')` / `'Status: Paused'`
- **Stats:** `automationActionsStatus.getByText(/Contracts:\s*\d+\s*\|\s*P\/L:/)`
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

Trade-type lifecycle methods (`runRiseFallAndVerify`, `runAccumulatorsAndVerify`, …) destructure params inline on the method — not exported types. Specs pass a matching object literal per test call; see `flow.md` Flows 7–11 for full examples per trade type.

### Env vars — backup accounts

| Scope                                | Desktop                               | Mobile                                       |
| ------------------------------------ | ------------------------------------- | -------------------------------------------- |
| Panel / controls (Flows 1–4, G1, G2) | `TEST_EMAIL_AUTOMATE`                 | `TEST_EMAIL_AUTOMATE_MOBILE`                 |
| Flow 7 Rise/Fall                     | `TEST_EMAIL_AUTOMATE_RISE_FALL`       | `TEST_EMAIL_AUTOMATE_RISE_FALL_MOBILE`       |
| Flow 8 Accumulators                  | `TEST_EMAIL_AUTOMATE_ACCUMULATORS`    | `TEST_EMAIL_AUTOMATE_ACCUMULATORS_MOBILE`    |
| Flow 9 Matches/Differs               | `TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS` | `TEST_EMAIL_AUTOMATE_MATCHES_DIFFERS_MOBILE` |
| Flow 10 Over/Under                   | `TEST_EMAIL_AUTOMATE_OVER_UNDER`      | `TEST_EMAIL_AUTOMATE_OVER_UNDER_MOBILE`      |
| Flow 11 Even/Odd                     | `TEST_EMAIL_AUTOMATE_EVEN_ODD`        | `TEST_EMAIL_AUTOMATE_EVEN_ODD_MOBILE`        |

Set each pair in `playwright/.env.staging` (Mailisk inboxes). Used as `backupAccount` when `createAccountV2viaJS` falls back — keeps each trade-type suite on its own account so parallel runs and leftover bots do not cross-contaminate.

### Feature gating — non-EU account required

Automation availability is controlled by `useIsAutomationEnabled` (`is_enabled = is_ready && !is_eu`). Flow 6 covers EU gating; all other flows require a non-EU account.

### Supported automation trade types

Trade-type lifecycle specs live under `playwright/tests/trade-automate/<trade-type>/`, mirroring `playwright/tests/trade/`.

Automation supports five UI trade types (source: `automation-guide-config.ts`, runtime-gated by strategy `supported_contract_types` via `useAutomationSupportedTradeTypes.ts`):

| Trade type      | Flow | Automatable market (example) | Notes                                                               |
| --------------- | ---- | ---------------------------- | ------------------------------------------------------------------- |
| Rise/Fall       | 7    | Volatility 100 Index         | Primary lifecycle smoke (`@smoke`); 4 tests (Rise/Fall × demo/real) |
| Accumulators    | 8    | Volatility 10 Index          | 2 tests (demo/real)                                                 |
| Matches/Differs | 9    | Volatility 10 Index          | 4 tests (Matches/Differs × demo/real)                               |
| Over/Under      | 10   | Volatility 10 Index          | 4 tests (Over/Under × demo/real)                                    |
| Even/Odd        | 11   | Volatility 10 Index          | 4 tests (Even/Odd × demo/real)                                      |

Crypto and Crash/Boom symbols are **not** automatable (`is_symbol_automatable` is false) even when they offer a supported trade type — always pick Volatility indices.

Higher/Lower, Touch/No Touch, Multipliers, Turbos, and Vanillas are **not** in the automation guide config and are out of scope for Flows 7–11.

### Page Object section ordering

`TradeAutomatePage` follows: **LOCATORS** → **ACTIONS** (public then private) → **VERIFICATIONS** (public then private), matching the other trade POMs.
