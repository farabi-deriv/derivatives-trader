# 🗺️ Trade Journey Catalog — Technical Reference

> Source of truth: `packages/trader/src/AppV2/Containers/Trade/` · `packages/trader/src/AppV2/Components/TradeParameters/` · `packages/trader/src/AppV2/Components/PurchaseButton/`
> Last updated: 2026-09-11

---

## Section 1 — Journey Index

| Journey ID | Spec File                                                        | Tags                                           |
| ---------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| Flow 1     | `trade/verify-trade-form-loads.spec.ts`                          | `@trade @smoke @desktop @mobile @production`   |
| Flow 2.1   | `trade/rise-fall/verify-rise.spec.ts`                            | `@trade @smoke @desktop @mobile @production`   |
| Flow 2.2   | `trade/rise-fall/verify-fall.spec.ts`                            | `@trade @smoke @desktop @mobile`               |
| Flow 2.3   | `trade/rise-fall/verify-rise-allow-equals.spec.ts`               | `@trade @desktop @mobile`                      |
| Flow 2.4   | `trade/rise-fall/verify-fall-allow-equals.spec.ts`               | `@trade @desktop @mobile`                      |
| Flow 3.1   | `trade/higher-lower/verify-higher.spec.ts`                       | `@trade @desktop @mobile`                      |
| Flow 3.2   | `trade/higher-lower/verify-lower.spec.ts`                        | `@trade @desktop @mobile`                      |
| Flow 4.1   | `trade/touch-no-touch/verify-touch.spec.ts`                      | `@trade @desktop @mobile`                      |
| Flow 4.2   | `trade/touch-no-touch/verify-no-touch.spec.ts`                   | `@trade @desktop @mobile`                      |
| Flow 5.1   | `trade/matches-differs/verify-matches.spec.ts`                   | `@trade @smoke @desktop @mobile`               |
| Flow 5.2   | `trade/matches-differs/verify-differs.spec.ts`                   | `@trade @smoke @desktop @mobile`               |
| Flow 6.1   | `trade/over-under/verify-over.spec.ts`                           | `@trade @desktop @mobile`                      |
| Flow 6.2   | `trade/over-under/verify-under.spec.ts`                          | `@trade @desktop @mobile`                      |
| Flow 7.1   | `trade/even-odd/verify-even.spec.ts`                             | `@trade @desktop @mobile`                      |
| Flow 7.2   | `trade/even-odd/verify-odd.spec.ts`                              | `@trade @desktop @mobile`                      |
| Flow 8.1   | `trade/accumulators/verify-accumulators-no-tp.spec.ts`           | `@trade @desktop @mobile`                      |
| Flow 8.2   | `trade/accumulators/verify-accumulators-with-tp.spec.ts`         | `@trade @desktop @mobile`                      |
| Flow 9.1   | `trade/multipliers/verify-multipliers-no-tpsl.spec.ts`           | `@trade @desktop @mobile`                      |
| Flow 9.2   | `trade/multipliers/verify-multipliers-no-tpsl.spec.ts`           | `@trade @desktop @mobile`                      |
| Flow 9.3   | `trade/multipliers/verify-multipliers-with-tp.spec.ts`           | `@trade @desktop @mobile`                      |
| Flow 9.4   | `trade/multipliers/verify-multipliers-with-tp.spec.ts`           | `@trade @desktop @mobile`                      |
| Flow 9.5   | `trade/multipliers/verify-multipliers-with-sl.spec.ts`           | `@trade @desktop @mobile`                      |
| Flow 9.6   | `trade/multipliers/verify-multipliers-with-sl.spec.ts`           | `@trade @desktop @mobile`                      |
| Flow 9.7   | `trade/multipliers/verify-multipliers-deal-cancellation.spec.ts` | `@trade @desktop @mobile`                      |
| Flow 9.8   | `trade/multipliers/verify-multipliers-deal-cancellation.spec.ts` | `@trade @desktop @mobile`                      |
| Flow 10.1  | `trade/turbos/verify-turbos-up.spec.ts`                          | `@trade @desktop @mobile`                      |
| Flow 10.2  | `trade/turbos/verify-turbos-down.spec.ts`                        | `@trade @desktop @mobile`                      |
| Flow 10.3  | `trade/turbos/verify-turbos-up-with-tp.spec.ts`                  | `@trade @desktop @mobile`                      |
| Flow 10.4  | `trade/turbos/verify-turbos-down-with-tp.spec.ts`                | `@trade @desktop @mobile`                      |
| Flow 11.1  | `trade/vanillas/verify-vanillas-call.spec.ts`                    | `@trade @desktop @mobile`                      |
| Flow 11.2  | `trade/vanillas/verify-vanillas-put.spec.ts`                     | `@trade @desktop @mobile`                      |
| Flow 12    | `trade/verify-manual-trade-negative-validation.spec.ts`          | `@trade @regression @staging @desktop @mobile` |
| Flow 13    | `trade/verify-manual-trade-negative-validation.spec.ts`          | `@trade @regression @staging @desktop @mobile` |
| Flow 14    | `trade/verify-manual-trade-negative-validation.spec.ts`          | `@trade @regression @staging @desktop @mobile` |
| Flow 15    | `trade/verify-closed-market.spec.ts`                             | `@trade @desktop @mobile`                      |
| Flow 16    | `trade/verify-unauthenticated-purchase.spec.ts`                  | `@trade @desktop @mobile`                      |
| Flow 17    | `trade/verify-insufficient-balance.spec.ts`                      | `@trade @desktop @mobile`                      |
| Flow 18    | `trade/verify-invalid-url-modal.spec.ts`                         | `@trade @desktop @mobile`                      |
| Flow 19    | `trade/verify-trade-param-info-icon-hover.spec.ts`               | `@trade @desktop @mobile`                      |
| Flow 20    | `trade/verify-system-theme-option.spec.ts`                       | `@trade @desktop @mobile`                      |
| Flow 21    | `trade/over-under/verify-over-under-validations.spec.ts`         | `@trade @desktop @mobile`                      |

> **Runtime skip (Flow 15):** `selectClosedMarketFromPicker()` returns `null` when no session-gated candidate shows **CLOSED** in the picker — test skips (typical during exchange hours).
>
> **Env vars (Flow 17.1):** `TEST_EMAIL_ZERO_BALANCE` — real zero-balance account (desktop + mobile share the same inbox).
>
> **Env vars (Flow 17.2):** `TEST_EMAIL_INSUFFICIENT_BALANCE` (desktop) / `TEST_EMAIL_INSUFFICIENT_BALANCE_MOBILE` (mobile) — real accounts with low Options balance.

---

## Section 2 — Flow Details

### Flow 1 — Trade form loads with default state visible

```typescript
test.describe('Trade — Form Loads', { tag: ['@trade', '@smoke', '@desktop', '@mobile', '@production'] }, () => {
    test.beforeEach(async ({ loginPage }) => {
        await loginPage.login();
    });

    test('VERIFY trade form loads with default state visible', async ({ tradePage, page }, testInfo) => {
        await tradePage.goto();
        await NavigationUtils.waitForDerivApiSettled(page);
        await expect(page.getByTestId('dt_acc_info'), 'Account info should be visible').toBeVisible();
        await expect(tradePage.marketSelector, 'Market selector should be visible').toBeVisible();
        await expect(tradePage.purchaseButton, 'Purchase button should be visible').toBeVisible();
        if (testInfo.project.name.includes('mobile')) {
            await expect(
                page.getByTestId('trade-params-container'),
                'Bottom sheet should be visible on mobile'
            ).toBeVisible();
        }
    });
});
```

---

### Flow 2.1 / 2.2 — Rise/Fall: buy → close contract

> **Split by outcome:** `verify-rise.spec.ts` (Flow **2.1** Rise) · `verify-fall.spec.ts` (Flow **2.2** Fall) — demo + real each. Flow 2.1 carries `@production` (real uses minimal stake on production).

```typescript
// verify-rise.spec.ts — Flow 2.1
test('VERIFY Buy "Rise" Contract and Close (Demo Account)', async ({ tradeRiseFallPage }) => {
    await tradeRiseFallPage.buyRiseAndVerify({
        accountType: 'demo',
        market: 'Volatility 100 Index',
        durationUnit: 'Minutes',
        durationValue: '15 min',
        stake: '10.50',
        currency: 'USD',
    });
});

// verify-fall.spec.ts — Flow 2.2
test('VERIFY Buy "Fall" Contract and Close (Demo Account)', async ({ tradeRiseFallPage }) => {
    await tradeRiseFallPage.buyFallAndVerify({
        accountType: 'demo',
        market: 'Volatility 100 Index',
        durationUnit: 'Minutes',
        durationValue: '18 min',
        stake: '20.50',
        currency: 'USD',
    });
});
```

**`buyRiseAndVerify` / `buyFallAndVerify` cover (in order):**

1. `selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall')` → `clickRiseFallOption` → `selectDuration` → `setStake` → `clickBuy`
2. `verifyOpenPositionsVisible` + `verifyContractCardDetails` + `verifyBalanceAfterContractPurchase`
3. `verifyOpenPositionsInReports` (Open positions tab) — captures `buyId`
4. `verifyContractDetailsPage` (open contract) — captures `entrySpot`
5. `closeFirstContract` / `sellContract`
6. `verifyClosedPositionsTab` — captures `contractProfitLossAmount`
7. `verifyClosedContractDetailsPage` (closed contract) — captures `sellId`
8. `verifyBalanceAfterContractClose`
9. `verifyClosedContractInReports` → Trade table (by `buyId`) + Statement Sell row (by `sellId`) + Buy row (by `buyId`)

> **Fixture:** `tradeRiseFallPage` from `playwright/fixtures/fixtures.ts`
> **Env var:** `TEST_EMAIL_RISE_FALL` — dedicated funded staging account for this suite
> **Serial mode:** each spec runs sequentially on a shared account
> **Flow 2.1** = `VERIFY Buy "Rise" Contract and Close` · **Flow 2.2** = `VERIFY Buy "Fall" Contract and Close`

---

### Flow 2.3 / 2.4 — Rise/Fall Allow Equals: enable toggle → buy → close

> **Split by outcome:** `verify-rise-allow-equals.spec.ts` (Flow **2.3** Rise) · `verify-fall-allow-equals.spec.ts` (Flow **2.4** Fall) — demo + real each. No `@production` tests.

```typescript
// verify-rise-allow-equals.spec.ts — Flow 2.3
test('VERIFY Buy "Rise" Contract with Allow Equals Enabled (Demo Account)', async ({ tradeRiseFallPage }) => {
    await tradeRiseFallPage.buyRiseAndVerify({
        accountType: 'demo',
        market: 'Volatility 100 Index',
        durationUnit: 'Minutes',
        durationValue: '15 min',
        stake: '10.50',
        currency: 'USD',
        allowEquals: true,
    });
});

// verify-fall-allow-equals.spec.ts — Flow 2.4
test('VERIFY Buy "Fall" Contract with Allow Equals Enabled (Demo Account)', async ({ tradeRiseFallPage }) => {
    await tradeRiseFallPage.buyFallAndVerify({
        accountType: 'demo',
        market: 'Volatility 100 Index',
        durationUnit: 'Minutes',
        durationValue: '18 min',
        stake: '20.50',
        currency: 'USD',
        allowEquals: true,
    });
});
```

**`buyRiseAndVerify` / `buyFallAndVerify` with `allowEquals: true` cover (in order):**

1. `selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall')` → enable Allow Equals toggle → `clickRiseFallOption` → `selectDuration` → `setStake` → `clickBuy`
2. Contract type submitted as `RISEEQUAL` / `FALLEQUAL` (pays out when exit spot = entry spot too)
3. Same full verification chain as Flow 2.1/2.2: open positions → reports → contract details → close → closed card → balance → reports

> **Fixture:** `tradeRiseFallPage` from `playwright/fixtures/fixtures.ts`
> **Serial mode:** each spec runs demo then real on a shared account
> **No `@production` test:** unlike Flow 2.1, none of these run against production — `beforeAll` always creates a fresh account
> **Flow 2.3** = `VERIFY Buy "Rise" Contract with Allow Equals Enabled` · **Flow 2.4** = `VERIFY Buy "Fall" Contract with Allow Equals Enabled`

---

### Flow 3.1 / 3.2 — Higher/Lower: buy → close → verify

> **Split by outcome:** `verify-higher.spec.ts` (Flow **3.1** Higher) · `verify-lower.spec.ts` (Flow **3.2** Lower) — demo + real each.

```typescript
// verify-higher.spec.ts — Flow 3.1
test('VERIFY Buy "Higher" Contract and Close (Demo Account)', async ({ tradeHigherLowerPage }) => {
    await tradeHigherLowerPage.buyHigherAndVerify({
        accountType: 'demo',
        market: 'Volatility 100 (1s) Index',
        durationUnit: 'Hours',
        durationValue: '1 hr',
        barrierType: 'Above spot',
        barrier: '5.11',
        stake: '10.00',
        currency: 'USD',
    });
});

// verify-lower.spec.ts — Flow 3.2
test('VERIFY Buy "Lower" Contract and Close (Demo Account)', async ({ tradeHigherLowerPage }) => {
    await tradeHigherLowerPage.buyLowerAndVerify({
        accountType: 'demo',
        market: 'Volatility 100 (1s) Index',
        durationUnit: 'Hours',
        durationValue: '1h 30m',
        barrierType: 'Below spot',
        barrier: '5.00',
        stake: '10.00',
        currency: 'USD',
    });
});
```

> **Flow 3.1** = `VERIFY Buy "Higher" Contract and Close` · **Flow 3.2** = `VERIFY Buy "Lower" Contract and Close`

---

### Flow 4.1 / 4.2 — Touch/No Touch: buy → close → verify

> **Split by outcome:** `verify-touch.spec.ts` (Flow **4.1** Touch) · `verify-no-touch.spec.ts` (Flow **4.2** No Touch) — demo + real each.

```typescript
// verify-touch.spec.ts — Flow 4.1
test('VERIFY Buy "Touch" Contract and Close (Demo Account)', async ({ tradeTouchNoTouchPage }) => {
    await tradeTouchNoTouchPage.buyTouchAndVerify({
        accountType: 'demo',
        market: 'Volatility 10 (1s) Index',
        durationUnit: 'Minutes',
        durationValue: '15 min',
        barrierType: 'Above spot',
        barrier: '1.01',
        stake: '5.01',
        currency: 'USD',
    });
});

// verify-no-touch.spec.ts — Flow 4.2
test('VERIFY Buy "No Touch" Contract and Close (Demo Account)', async ({ tradeTouchNoTouchPage }) => {
    await tradeTouchNoTouchPage.buyNoTouchAndVerify({
        accountType: 'demo',
        market: 'Volatility 10 (1s) Index',
        durationUnit: 'Minutes',
        durationValue: '5 min',
        barrierType: 'Below spot',
        barrier: '0.99',
        stake: '6.09',
        currency: 'USD',
    });
});
```

> **Flow 4.1** = `VERIFY Buy "Touch" Contract and Close` · **Flow 4.2** = `VERIFY Buy "No Touch" Contract and Close`

---

### Flow 5.1 / 5.2 — Matches/Differs: buy → settle in place → verify closed

Digit contracts are **Ticks-only** and **auto-expire** (no manual close). The POM opens the open
position's contract details right after buy, captures its buy reference ID, waits for the contract to
settle in place, then verifies the settled contract in Positions, contract details, balance, and Reports.
All locators live in `TradeMatchesDiffersPage` / `ContractDetailsPage` (no inline locators in the test).

> **Split by outcome:** `verify-matches.spec.ts` (Flow **5.1** Matches) · `verify-differs.spec.ts` (Flow **5.2** Differs) — demo + real each.

```typescript
// verify-matches.spec.ts — Flow 5.1
test('VERIFY Buy "Matches" Contract (Demo Account)', async ({ tradeMatchesDiffersPage }) => {
    await tradeMatchesDiffersPage.buyMatchesAndVerify({
        accountType: 'demo',
        market: 'Volatility 10 Index',
        durationValue: '10 ticks',
        stake: '10.00',
        currency: 'USD',
        digit: '2',
    });
});

// verify-differs.spec.ts — Flow 5.2
test('VERIFY Buy "Differs" Contract (Demo Account)', async ({ tradeMatchesDiffersPage }) => {
    await tradeMatchesDiffersPage.buyDiffersAndVerify({
        accountType: 'demo',
        market: 'Volatility 10 Index',
        durationValue: '10 ticks',
        stake: '10.00',
        currency: 'USD',
        digit: '6',
    });
});
```

> **`buyMatchesAndVerify` / `buyDiffersAndVerify` cover (in order):** select market → select Matches/Differs →
> select Matches/Differs tab → `selectTicksDuration` → `setStake` → `selectDigit` → `clickBuy` →
> verify balance deducted → open the open position's details + capture `buyId` → `waitForContractSettled` →
> Closed tab `verifyClosedPositionsTab` (signed P/L) → `verifyClosedDigitContractDetailsPage` (Target digit, `sellId`) →
> `verifyBalanceAfterContractClose` → Reports `verifyClosedContractInReports` (Trade table + Statement).
> **Flow 5.1** = `VERIFY Buy "Matches" Contract` · **Flow 5.2** = `VERIFY Buy "Differs" Contract`

---

### Flow 6.1 / 6.2 — Over/Under: buy → settle in place → verify closed

Same digit-contract pattern as Matches/Differs (Flow 5.1/5.2). The `TradeOverUnderPage` fixture shares
its logic with `TradeMatchesDiffersPage` via the common `TradeDigitsPage` base; only the outcome labels
differ. **Invalid digits:** Over cannot predict 9, Under cannot predict 0.

> **Split by outcome:** `verify-over.spec.ts` (Flow **6.1** Over) · `verify-under.spec.ts` (Flow **6.2** Under) — demo + real each.

```typescript
// verify-over.spec.ts — Flow 6.1
test('VERIFY Buy "Over" Contract (Demo Account)', async ({ tradeOverUnderPage }) => {
    await tradeOverUnderPage.buyOverAndVerify({
        accountType: 'demo',
        market: 'Volatility 10 Index',
        durationValue: '10 ticks',
        stake: '10.00',
        currency: 'USD',
        digit: '1',
    });
});

// verify-under.spec.ts — Flow 6.2
test('VERIFY Buy "Under" Contract (Demo Account)', async ({ tradeOverUnderPage }) => {
    await tradeOverUnderPage.buyUnderAndVerify({
        accountType: 'demo',
        market: 'Volatility 10 Index',
        durationValue: '10 ticks',
        stake: '10.00',
        currency: 'USD',
        digit: '9',
    });
});
```

> `buyOverAndVerify` / `buyUnderAndVerify` run the same chain as `buyMatchesAndVerify` (see Flow 5.1/5.2),
> differing only in the outcome tab (`Over`/`Under`) and audit Target text (`Over N` / `Under N`).
> **Flow 6.1** = `VERIFY Buy "Over" Contract` · **Flow 6.2** = `VERIFY Buy "Under" Contract`

---

### Flow 7.1 / 7.2 — Even/Odd: buy → settle in place → verify closed

Simplest digit type — **no last-digit selector** (the outcome is even vs odd). The `TradeEvenOddPage`
fixture shares its logic with the other digit types via the common `TradeDigitsPage` base; `buyEvenAndVerify`
/ `buyOddAndVerify` take no `digit`, and the audit Target row reads "Even" / "Odd".

> **Split by outcome:** `verify-even.spec.ts` (Flow **7.1** Even) · `verify-odd.spec.ts` (Flow **7.2** Odd) — demo + real each.

```typescript
// verify-even.spec.ts — Flow 7.1
test('VERIFY Buy "Even" Contract (Demo Account)', async ({ tradeEvenOddPage }) => {
    await tradeEvenOddPage.buyEvenAndVerify({
        accountType: 'demo',
        market: 'Volatility 10 Index',
        durationValue: '10 ticks',
        stake: '10.00',
        currency: 'USD',
    });
});

// verify-odd.spec.ts — Flow 7.2
test('VERIFY Buy "Odd" Contract (Demo Account)', async ({ tradeEvenOddPage }) => {
    await tradeEvenOddPage.buyOddAndVerify({
        accountType: 'demo',
        market: 'Volatility 10 Index',
        durationValue: '10 ticks',
        stake: '10.00',
        currency: 'USD',
    });
});
```

> `buyEvenAndVerify` / `buyOddAndVerify` run the same chain as `buyMatchesAndVerify` (see Flow 5.1/5.2)
> minus the digit selection, differing in the outcome tab (`Even`/`Odd`) and audit Target text (`Even` / `Odd`).
> **Flow 7.1** = `VERIFY Buy "Even" Contract` · **Flow 7.2** = `VERIFY Buy "Odd" Contract`

---

### Flow 8.1 / 8.2 — Accumulators: buy → settle → verify closed

Accumulators have **no duration**, a **Growth rate** param (set 5%), and an optional **Take profit**
(Flow 8.2 sets 4.00). They close from the **trade page** ("Close [amount]" purchase button), and can
also auto-settle when spot hits the **barrier** or the **take profit**. `TradeAccumulatorsPage` uses a
close-reason-agnostic settle helper (manual close for 8.1; wait-for-auto-settle with manual fallback
for 8.2) and verifies the closed contract in Positions, contract details, balance, and Reports. TP is
asserted on the **form** before buying (deterministic).

> **Split into two spec files:** `verify-accumulators-no-tp.spec.ts` (Flow 8.1) and
> `verify-accumulators-with-tp.spec.ts` (Flow 8.2) — each with its own `describe` block and `beforeAll`.

```typescript
// verify-accumulators-no-tp.spec.ts (Flow 8.1)
import { test } from '../../../fixtures/fixtures';
import { TradeBasePage } from '../../../pages/TradeBasePage';

test.describe('Trade — Accumulators (without Take Profit)', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page, loginPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login(accountEmail, accountPassword);
    });

    test('VERIFY Buy Accumulators Contract Without Take Profit and Close (Demo Account)', async ({
        tradeAccumulatorsPage,
    }) => {
        await tradeAccumulatorsPage.buyAccumulatorAndVerify({
            accountType: 'demo',
            market: 'Volatility 100 Index',
            growthRate: '5%',
            stake: '10.00',
            currency: 'USD',
        });
    });
});

// verify-accumulators-with-tp.spec.ts (Flow 8.2) — separate describe block, same shape, plus `takeProfit: '4.00'`.
```

> **`buyAccumulatorAndVerify` covers (in order):** select market → select Accumulators (asserts no Duration)
> → `setGrowthRate('5%')` → (8.2) `setTakeProfit('4.00')` asserted on the form → `setStake` →
> `clickAccumulatorsBuy` → `verifyOpenPositionsVisible()` + `verifyBalanceAfterContractPurchase()` →
> `settleAccumulatorContract` (manual / auto-settle) → Closed tab `verifyClosedPositionsTab` (signed P/L) →
> `verifyClosedAccumulatorContractDetailsPage()` (asserts market, growth rate, stake, contract value, P&L,
> take profit, reference IDs, entry/exit spot+time — returns `{ buyId, sellId }`) →
> `verifyBalanceAfterContractClose` → Reports `verifyClosedContractInReports`.
> **Close button:** the trade-page purchase button becomes "Close [amount] [currency]" while an
> accumulator is open (`.purchase-button--single`); it reverts to "Buy" on any auto-close.
> **Flow 8.1** = `VERIFY Buy Accumulators Contract Without Take Profit and Close` · **Flow 8.2** = `VERIFY Buy Accumulators Contract With Take Profit and Close`

---

### Flow 9.1 — Multipliers without TP/SL: buy Up → close

### Flow 9.2 — Multipliers without TP/SL: buy Down → close

```typescript
test.describe('Trade — Multipliers', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_MULTIPLIERS_MOBILE' : 'TEST_EMAIL_MULTIPLIERS';
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

    test('VERIFY Buy "Up" Multipliers Contract and Close (without TP/SL) (Demo Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyUpAndVerify({
            accountType: 'demo',
            market: 'Volatility 100 (1s) Index',
            multiplier: 'x200',
            stake: '5.40',
            currency: 'USD',
        });
    });

    test('VERIFY Buy "Down" Multipliers Contract and Close (without TP/SL) (Demo Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyDownAndVerify({
            accountType: 'demo',
            market: 'Volatility 100 (1s) Index',
            multiplier: 'x300',
            stake: '5.88',
            currency: 'USD',
        });
    });
});
```

> **Flow 9.1** = `VERIFY Buy "Up" Multipliers Contract and Close (without TP/SL)` · **Flow 9.2** = `VERIFY Buy "Down" Multipliers Contract and Close (without TP/SL)`
>
> Both tests delegate to `buyUpAndVerify` / `buyDownAndVerify` on `TradeMultipliersPage`, which implement the full 17-step chain: configure → buy → positions → reports (open) → contract details (open, captures `buyId` + `entrySpot`) → close → closed positions tab → contract details (closed, asserts commission, Stop out level as `-N.NN USD` containing the numeric pre-buy `stopOut`, entry/exit details) → balance → reports (closed trade table + statement).
> Commission and stop out are captured pre-buy from the info panel and asserted exactly in the closed contract details.
> Mobile entry/exit detail dates render as `DD Mon YYYY`; the helper derives this format internally from the ISO `buyDate`.
>
> **Env vars:** `TEST_EMAIL_MULTIPLIERS` (desktop) / `TEST_EMAIL_MULTIPLIERS_MOBILE` (mobile) — dedicated funded accounts.
> **Fixture:** `tradeMultipliersPage` from `playwright/fixtures/fixtures.ts` · **Serial mode:** shared account state between Up and Down tests

---

### Flow 9.3 — Multipliers with Take Profit: set TP → buy Up → close

### Flow 9.4 — Multipliers with Take Profit: set TP → buy Down → close

```typescript
test.describe('Trade — Multipliers', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_MULTIPLIERS_TP_MOBILE' : 'TEST_EMAIL_MULTIPLIERS_TP';
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

    test('VERIFY Buy "Up" Multipliers Contract With Take Profit and Close (Demo Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyUpAndVerify({
            accountType: 'demo',
            market: 'Volatility 25 (1s) Index',
            multiplier: 'x160',
            stake: '10.00',
            currency: 'USD',
            riskManagement: { takeProfit: '30.01' },
        });
    });

    test('VERIFY Buy "Down" Multipliers Contract With Take Profit and Close (Demo Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyDownAndVerify({
            accountType: 'demo',
            market: 'Volatility 25 (1s) Index',
            multiplier: 'x400',
            stake: '11.11',
            currency: 'USD',
            riskManagement: { takeProfit: '21.32' },
        });
    });
});
```

> **Flow 9.3** = `VERIFY Buy "Up" Multipliers Contract With Take Profit and Close` · **Flow 9.4** = `VERIFY Buy "Down" Multipliers Contract With Take Profit and Close`
>
> Both tests delegate to `buyUpAndVerify` / `buyDownAndVerify` on `TradeMultipliersPage` with a `riskManagement: { takeProfit }` param, which adds `setRiskManagement()` before the buy step. The full 18-step chain is identical to the no-TP flows (Flow 9.1/9.2) plus TP configuration, and additionally asserts the TP amount in both the open and closed contract details pages.
>
> **TP input race condition (mobile):** `setRiskManagement()` uses `pressSequentially` + `Tab` to blur the input, then `waitForTimeout(1500)` before clicking Save. The `is_api_response_tp_received_ref` flag must be `true` (set by the API response) for `onSave()` to proceed — the "acceptable range" hint from the store alone is not a reliable guard.
>
> **Commission source:** read pre-buy from `.multipliers-information__container` on the trade page (same locator on desktop and mobile). Not from the stake action sheet.
>
> **TP display in positions:** mobile renders `"30.01"` (no `+` prefix); desktop renders `"+30.01"`. The assertion branches on `isMobile`.
>
> **Env vars:** `TEST_EMAIL_MULTIPLIERS_TP` (desktop) / `TEST_EMAIL_MULTIPLIERS_TP_MOBILE` (mobile) — dedicated funded accounts.
>
> **Fixture:** `tradeMultipliersPage` from `playwright/fixtures/fixtures.ts` · **Serial mode:** shared account state between Up and Down tests

---

### Flow 9.5 — Multipliers with Stop Loss: set SL → buy Up → close

### Flow 9.6 — Multipliers with Stop Loss: set SL → buy Down → close

```typescript
test.describe('Trade — Multipliers', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({}, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');
        const backupEmailVar = isMobile ? 'TEST_EMAIL_MULTIPLIERS_SL_MOBILE' : 'TEST_EMAIL_MULTIPLIERS_SL';
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

    test('VERIFY Buy "Up" Multipliers Contract With Stop Loss and Close (Demo Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyUpAndVerify({
            accountType: 'demo',
            market: 'Volatility 50 (1s) Index',
            multiplier: 'x200',
            stake: '25.05',
            currency: 'USD',
            riskManagement: { stopLoss: '21.10' },
        });
    });

    test('VERIFY Buy "Down" Multipliers Contract With Stop Loss and Close (Demo Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyDownAndVerify({
            accountType: 'demo',
            market: 'Volatility 50 (1s) Index',
            multiplier: 'x600',
            stake: '25.00',
            currency: 'USD',
            riskManagement: { stopLoss: '23.01' },
        });
    });
});
```

> **Flow 9.5** = `VERIFY Buy "Up" Multipliers Contract With Stop Loss and Close` · **Flow 9.6** = `VERIFY Buy "Down" Multipliers Contract With Stop Loss and Close`
>
> Both tests delegate to `buyUpAndVerify` / `buyDownAndVerify` on `TradeMultipliersPage` with a `riskManagement: { stopLoss }` param, which adds `setRiskManagement()` before the buy step. The full 18-step chain is identical to the no-SL flows (Flow 9.1/9.2) plus SL configuration, and additionally asserts the SL amount in both the open and closed contract details pages.
>
> **SL input race condition (mobile):** `setRiskManagement()` uses `pressSequentially` + `Tab` to blur the input, then waits for the `slAcceptableRangeHint` to appear, then `waitForTimeout(1500)` before clicking Save. The `is_api_response_received_ref` flag must be `true` (set by the API response) for `onSave()` to proceed.
>
> **SL display in positions (mobile):** renders as `-21.10 ` (negative prefix + trailing space) — asserted with `new RegExp('^-${stopLoss}\\s*$')`. Desktop renders `-21.10`.
>
> **Mobile contract details assertions:** trade type (`Multipliers Up`/`Multipliers Down`), stake value (`25.05 USD`), TP badge absent, SL badge present, TP toggle `aria-pressed="false"`, SL toggle `aria-pressed="true"`, SL input value (`-21.10 USD`), start time contains `buyDate`, TP/SL history section with label and value rows.
>
> **Env vars:** `TEST_EMAIL_MULTIPLIERS_SL` (desktop) / `TEST_EMAIL_MULTIPLIERS_SL_MOBILE` (mobile) — dedicated funded accounts.
>
> **Fixture:** `tradeMultipliersPage` from `playwright/fixtures/fixtures.ts` · **Serial mode:** shared account state between Up and Down tests

---

### Flow 9.7 — Multipliers with Deal Cancellation: set DC → buy Up → cancel

```typescript
test.describe('Trade — Multipliers with Deal Cancellation', { tag: ['@trade', '@desktop', '@mobile'] }, () => {
    test.describe.configure({ mode: 'serial' });

    test('VERIFY Buy "Up" Multipliers Contract With Deal Cancellation and Cancel (Demo Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyUpAndVerifyWithDC({
            accountType: 'demo',
            market: 'Volatility 75 Index',
            multiplier: 'x300',
            stake: '20.00',
            currency: 'USD',
            dealCancellation: '5 min',
        });
    });

    test('VERIFY Buy "Up" Multipliers Contract With Deal Cancellation and Cancel (Real Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyUpAndVerifyWithDC({
            accountType: 'real',
            market: 'Volatility 75 Index',
            multiplier: 'x300',
            stake: '20.00',
            currency: 'USD',
            dealCancellation: '5 min',
        });
    });

    test('VERIFY Buy "Down" Multipliers Contract With Deal Cancellation and Cancel (Demo Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyDownAndVerifyWithDC({
            accountType: 'demo',
            market: 'Volatility 75 Index',
            multiplier: 'x300',
            stake: '21.00',
            currency: 'USD',
            dealCancellation: '10 min',
        });
    });

    test('VERIFY Buy "Down" Multipliers Contract With Deal Cancellation and Cancel (Real Account)', async ({
        tradeMultipliersPage,
    }) => {
        await tradeMultipliersPage.buyDownAndVerifyWithDC({
            accountType: 'real',
            market: 'Volatility 75 Index',
            multiplier: 'x300',
            stake: '21.00',
            currency: 'USD',
            dealCancellation: '10 min',
        });
    });
});
```

> `buyUpAndVerifyWithDC` / `buyDownAndVerifyWithDC` cover (in order): switch account type → select Multipliers → Up/Down → `setStake` → `setMultiplier` → `setRiskManagement({ dealCancellation })` → assert Buy shows **"Total cost"** → capture `multipliersTotalCost` (numeric, stripped from `$N.NN`) → `readStopOut()` (numeric; mobile Stake sheet dismissed with Close) → `clickMultipliersBuy()` → open card + balance deducted by Total cost → open details (`verifyMultipliersContractDetailsPage` with Total cost as stake display + DC fee; TP/SL disabled) → `verifyDealCancellationAvailable()` → `cancelDealCancellationContract()` → Closed tab → closed details (`verifyClosedMultipliersContractDetailsPage`; Stop out level still `-N.NN USD`). Reports/Statement are skipped.
>
> **Flow 9.7** = `VERIFY Buy "Up" Multipliers Contract With Deal Cancellation and Cancel` · **Flow 9.8** = `VERIFY Buy "Down" Multipliers Contract With Deal Cancellation and Cancel` — each as `(Demo Account)` / `(Real Account)`

---

### Flow 10.1 / 10.2 / 10.3 / 10.4 — Turbos: buy → verify open → close early → verify closed

Turbos use **Up/Down tabs** (`.trade-params__option`) → a **single "Buy" button** (`.purchase-button--single`),
with unique **Payout per point** + **Barrier info** params and an optional **Take profit** (shared
standalone widget). They are early-sellable, so `TradeTurbosPage.buyTurbosAndVerify` uses a **Minutes**
duration + `verifyContractCardDetails` (remaining-time works), then closes early via
`ContractDetailsPage.sellContract()` (retries on `PriceMoved` slippage) and verifies the full closed
chain (Closed tab → balance → Reports). TP flows also assert the TP amount on the open contract details.
No inline locators — all via `TradeTurbosPage`.

> **Split by direction (no TP):** `verify-turbos-up.spec.ts` (Flow **10.1** Up) · `verify-turbos-down.spec.ts` (Flow **10.2** Down) — demo + real each.
> **Split by direction (with TP):** `verify-turbos-up-with-tp.spec.ts` (Flow **10.3** Up) · `verify-turbos-down-with-tp.spec.ts` (Flow **10.4** Down) — demo + real each.

```typescript
// verify-turbos-up.spec.ts — Flow 10.1 (no Take Profit)
test('VERIFY Buy "Up" Turbos Contract (Demo Account)', async ({ tradeTurbosPage }) => {
    await tradeTurbosPage.buyTurbosAndVerify({
        accountType: 'demo',
        market: 'Volatility 100 (1s) Index',
        direction: 'Up',
        stake: '10.50',
        currency: 'USD',
    });
});

// verify-turbos-down.spec.ts — Flow 10.2 (no Take Profit)
test('VERIFY Buy "Down" Turbos Contract (Demo Account)', async ({ tradeTurbosPage }) => {
    await tradeTurbosPage.buyTurbosAndVerify({
        accountType: 'demo',
        market: 'Volatility 100 (1s) Index',
        direction: 'Down',
        stake: '10.50',
        currency: 'USD',
    });
});

// verify-turbos-up-with-tp.spec.ts — Flow 10.3 (Take Profit 20.00)
test('VERIFY Buy "Up" Turbos Contract With Take Profit (Demo Account)', async ({ tradeTurbosPage }) => {
    await tradeTurbosPage.buyTurbosAndVerify({
        accountType: 'demo',
        market: 'Volatility 100 (1s) Index',
        direction: 'Up',
        stake: '10.50',
        currency: 'USD',
        takeProfit: '20.00',
    });
});

// verify-turbos-down-with-tp.spec.ts — Flow 10.4 (Take Profit 20.00)
test('VERIFY Buy "Down" Turbos Contract With Take Profit (Demo Account)', async ({ tradeTurbosPage }) => {
    await tradeTurbosPage.buyTurbosAndVerify({
        accountType: 'demo',
        market: 'Volatility 100 (1s) Index',
        direction: 'Down',
        stake: '10.50',
        currency: 'USD',
        takeProfit: '20.00',
    });
});
```

> `buyTurbosAndVerify` covers (in order): select market → select Turbos (asserts Duration / Payout per point / Take profit / Barrier info visible) → `selectDirection` → (TP flows) `setTakeProfit('20.00')` asserted on the form → `selectDuration('Minutes','5 min')` → `setStake` → `clickTurbosBuy` → verify open card + balance → open details `getBuyReferenceId` (+ TP flows assert TP on details) → `sellContract()` (early close, slippage-tolerant) → Closed tab `verifyClosedPositionsTab` + `getSellReferenceId` → `verifyBalanceAfterContractClose` → `verifyClosedContractInReports`.
> **Turbos buttons are "Up" / "Down"** (card label "Turbos Up" / "Turbos Down"). Source: `CONTRACT_TYPES.TURBOS.LONG → name 'Up'`, `SHORT → 'Down'`.
> **Flow 10.1/10.2** = `VERIFY Buy "Up"/"Down" Turbos Contract` · **Flow 10.3/10.4** = `... With Take Profit`

---

### Flow 11.1 / 11.2 — Vanillas: buy → close contract

> **Split by direction:** `verify-vanillas-call.spec.ts` (Flow **11.1** Call) · `verify-vanillas-put.spec.ts` (Flow **11.2** Put) — demo + real each.

```typescript
// verify-vanillas-call.spec.ts — Flow 11.1
test('VERIFY Buy "Call" Vanillas Contract (Demo Account)', async ({ tradeVanillasPage }) => {
    await tradeVanillasPage.buyVanillasAndVerify({
        accountType: 'demo',
        market: 'Volatility 100 Index',
        direction: 'Call',
        durationUnit: 'Minutes',
        durationValue: '5 min',
        strike: '+0.00',
        stake: '10.00',
        currency: 'USD',
    });
});

// verify-vanillas-put.spec.ts — Flow 11.2
test('VERIFY Buy "Put" Vanillas Contract (Demo Account)', async ({ tradeVanillasPage }) => {
    await tradeVanillasPage.buyVanillasAndVerify({
        accountType: 'demo',
        market: 'Volatility 100 Index',
        direction: 'Put',
        durationUnit: 'Minutes',
        durationValue: '5 min',
        strike: '+0.00',
        stake: '10.00',
        currency: 'USD',
    });
});
```

> **Fixture:** `tradeVanillasPage` from `playwright/fixtures/fixtures.ts`
> **Env vars:** `TEST_EMAIL_VANILLAS` / `TEST_EMAIL_VANILLAS_MOBILE` — backup accounts for `createAccountV2viaJS`
> **Serial mode:** each spec runs demo then real on a shared account; each `buyVanillasAndVerify` closes its contract before the next run

> `buyVanillasAndVerify` covers (in order): switch account type → select market → select Vanillas (asserts Strike price / Duration / Stake / Payout per point info / Buy) → `selectDirection` → `selectStrike('+0.00')` → `verifyPayoutPerPointInfo` (desktop) → `selectDuration('Minutes','5 min')` → `setStake` → `clickVanillasBuy` → verify open card + balance → `verifyOpenPositionsInReportsForVanillas` (captures `buyId`) → `verifyVanillasOpenContractDetailsPage` → `closeFirstContract` → `verifyClosedPositionsTab` → `verifyVanillasClosedContractDetailsPage` (captures `sellId`) → `verifyBalanceAfterContractClose` → `verifyClosedContractInReports`.
> **Vanillas buttons are "Call" / "Put"** — Positions cards and mobile contract details use the combined label (`"Vanillas Call"` / `"Vanillas Put"`). Desktop contract-details drawer shows direction only (`"Call"` / `"Put"`). Source: `getContractTypeDisplay()` with `showMainTitle` only on Positions AppV2 cards, not on desktop `ContractTypeCell`.
> **Vanillas have NO take profit parameter** — confirmed from `getTradeParams()` in `trade-params-utils.tsx`. Do not add TP assertions for Vanillas.
> **Flow 11.1** = `VERIFY Buy "Call" Vanillas Contract` · **Flow 11.2** = `VERIFY Buy "Put" Vanillas Contract`

---

### Flow 12 — Market closed: purchase button hidden, countdown visible

```typescript
const closedMarket = await tradeValidationPage.selectFirstClosedMarket();
test.skip(!closedMarket, 'No closed market is currently returned by staging');
await tradeValidationPage.verifyClosedMarketPurchaseState();
await tradeValidationPage.selectMarketAndTradeType('Volatility 100 Index', 'Rise/Fall');
const recovered = await tradeValidationPage.getPurchaseControlState();
```

### Flow 13 — Insufficient balance: inline-validation gate (post-#1398)

```typescript
const balance = Number(await tradeValidationPage.getBalance());
await tradeValidationPage.verifyInsufficientBalanceBehavior(balance);
expect(tradeValidationPage.getTrackedBuyRequestCount(), 'Client-side balance validation must not send Buy').toBe(0);
```

### Flow 14 — Manual Trading negative validation matrix

```typescript
for (const configuration of stakeCapabilityMatrix) {
    await tradeValidationPage.selectMarketAndTradeType(configuration.market, configuration.tradeType);
    await tradeValidationPage.verifyStakeRuntimeBoundaries();
    await tradeValidationPage.verifyCommittedBuyUnaffectedByRejectedDraft();
}
await tradeValidationPage.verifyDurationRuntimeBoundaries('Seconds');
await tradeValidationPage.verifyBarrierRequiredAndZeroValidation();
await tradeValidationPage.verifyDigitChoiceAvailability();
await tradeValidationPage.verifyRiskManagementRuntimeOptions();
```

> **Fixture:** `tradeValidationPage` from `playwright/fixtures/fixtures.ts`
> **Runtime limit source:** visible Stake, Duration, TP, and SL range messages; rendered option lists for mobile Duration, Digits, Multiplier, and Deal Cancellation.
> **Buy-state coverage:** hidden for closed markets; Buy **enabled** with quoted payout when stake exceeds balance (insufficient-balance inform-don't-disable); insufficient-balance **popup** on Buy click for zero-balance server path; exactly one outbound Buy for an Accumulators double-click; enabled again after settlement.

---

### Flow 15 — Market closed: purchase hidden, params disabled, countdown visible

> **Discovery:** `selectClosedMarketFromPicker()` iterates `FeedPage.MARKETS` entries with `status: 'session_gated'`, searches each in the picker, and selects the first row whose **CLOSED** tag is visible. Returns `null` → `test.skip()` when every candidate is open.
>
> **Assertions (`verifyClosedMarketTradeState`):** Buy not rendered · `ClosedMarketMessage` intro + `HH:MM:SS` timer · all `button` / `input` in `.trade-params__options-wrapper` disabled · **CLOSED** tag still on the row when the picker is reopened.

```typescript
test.describe('Trade — Closed Market', { tag: ['@trade', '@desktop', '@mobile'] }, () => {
    test.beforeEach(async ({ page, loginPage, tradeParametersPage }) => {
        await TradeBasePage.seedLocalStorageOnOrigin(page);
        await loginPage.login();
        await tradeParametersPage.gotoTradePage();
    });

    test('VERIFY closed market hides purchase button and shows reopening countdown', async ({
        tradeParametersPage,
    }) => {
        const selection = await tradeParametersPage.selectClosedMarketFromPicker();
        if (!selection) {
            test.skip(true, 'No session-gated market is CLOSED right now — rerun outside exchange hours');
            return;
        }

        await tradeParametersPage.verifyClosedMarketTradeState(selection.market, selection.tradeType);
    });
});
```

---

### Flow 16 — Unauthenticated purchase → login prompt sheet

```typescript
test.describe('Trade — Unauthenticated Purchase', { tag: ['@trade', '@desktop', '@mobile'] }, () => {
    test.beforeEach(async ({ tradeParametersPage }) => {
        await tradeParametersPage.gotoTradePage();
        await tradeParametersPage.verifyDTraderLandingPageLoggedOut();
        await tradeParametersPage.clickBuyLoggedOut();
        await tradeParametersPage.verifyAuthorizationRequiredSheet();
    });

    test('VERIFY Login button on authorization sheet navigates to login page', async ({ tradeParametersPage }) => {
        await tradeParametersPage.clickAuthorizationLoginButton();
        await tradeParametersPage.verifyNavigatedToLoginPage();
    });

    test('VERIFY Create free account button navigates to signup page', async ({ tradeParametersPage }) => {
        await tradeParametersPage.clickAuthorizationCreateFreeAccountButton();
        await tradeParametersPage.verifyNavigatedToSignupPage();
    });
});
```

---

### Flow 17 — Insufficient balance

Two child flows in `verify-insufficient-balance.spec.ts`. Post PR #1398: Buy stays **enabled** when stake exceeds balance; balance hints live in the stake editor (**Save** blocked); **Buy** opens the insufficient-balance popup when the server rejects the purchase.

#### Flow 17.1 — Insufficient balance popup dismiss and deposit

> **POM:** `verifyEmptyBalanceStakeEditorHint()` → `clickBuyWithInsufficientBalance()` → `verifyInsufficientBalancePopup()` → dismiss → Buy again → `clickInsufficientBalanceDepositButton()` → `verifyNavigatedToDepositFromDTrader()`.

```typescript
test.describe('Insufficient balance popup on Buy click', () => {
    // Flow 17.1 — TEST_EMAIL_ZERO_BALANCE
    test('VERIFY insufficient balance popup dismiss and deposit', async ({ tradeParametersPage }) => {
        await tradeParametersPage.verifyEmptyBalanceStakeEditorHint();
        await tradeParametersPage.clickBuyWithInsufficientBalance();
        await tradeParametersPage.verifyInsufficientBalancePopup();
        await tradeParametersPage.clickInsufficientBalancePopupClose();
        await tradeParametersPage.verifyInsufficientBalancePopupDismissed();
        await tradeParametersPage.clickBuyWithInsufficientBalance();
        await tradeParametersPage.verifyInsufficientBalancePopup();
        await tradeParametersPage.clickInsufficientBalanceDepositButton();
        await tradeParametersPage.verifyNavigatedToDepositFromDTrader();
    });
});
```

#### Flow 17.2 — Stake editor hint + Buy enabled

> **POM:** `verifyInsufficientBalanceClientGate()` — seeds `tab_trade_params_v2` + reload on **both** viewports (`commitUnaffordableStakeForGate()`), asserts Buy enabled + quoted payout, balance hint in editor, no popup before Buy.

```typescript
test.describe('Stake editor hint', () => {
    // Flow 17.2 — TEST_EMAIL_INSUFFICIENT_BALANCE / _MOBILE
    test('VERIFY insufficient balance keeps Buy enabled and shows balance hint', async ({ tradeParametersPage }) => {
        await tradeParametersPage.verifyInsufficientBalanceClientGate();
    });
});
```

---

### Flow 19 — Manual trade param info icons reveal descriptions

> Covers regression for #995. Matrix-driven across trade types — desktop hover-reveal + TooltipPortal; mobile editor `action-sheet-header-tooltip` tap. Automate panel + Accumulators trade-form counterpart: `playwright/flows/trade-automate/flow.md` Flow 17.

```typescript
test.describe('Trade — parameter info icon', { tag: ['@desktop', '@mobile', '@trade'] }, () => {
    test('VERIFY manual trade param info icons reveal authored descriptions', async ({
        tradeParametersPage,
    }, testInfo) => {
        const isMobile = testInfo.project.name.includes('mobile');

        for (const {
            market,
            tradeType,
            desktopParams,
            mobileChecks,
        } of TradeParametersPage.TRADE_PARAM_INFO_ICON_CASES) {
            await tradeParametersPage.selectMarketAndTradeType(market, tradeType, { verifyParams: false });

            if (isMobile) {
                for (const { openField, icons } of mobileChecks ?? []) {
                    await tradeParametersPage.verifyTradeParamInfoIconsInMobileEditor(openField, icons);
                }
                continue;
            }

            for (const { label, descriptions } of desktopParams ?? []) {
                await tradeParametersPage.verifyTradeParamInfoIconOnDesktop(label, descriptions);
            }
        }
    });
});
```

---

## Section 3 — POM Method Reference

| Purpose                                              | Page Object method                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Parse and validate current Stake limits              | `tradeValidationPage.verifyStakeRuntimeBoundaries()`                                                     |
| Verify Stake input filtering                         | `tradeValidationPage.verifyStakeInputSanitization()`                                                     |
| Validate current Duration limits/options             | `tradeValidationPage.verifyDurationRuntimeBoundaries()`                                                  |
| Validate required/zero Barrier                       | `tradeValidationPage.verifyBarrierRequiredAndZeroValidation()`                                           |
| Read current Digits availability                     | `tradeValidationPage.verifyDigitChoiceAvailability()`                                                    |
| Read Multipliers TP/SL/DC options                    | `tradeValidationPage.verifyRiskManagementRuntimeOptions()`                                               |
| Discover markets in an asset category                | `tradeValidationPage.readMarketsForCategory()`                                                           |
| Select current closed market                         | `tradeValidationPage.selectFirstClosedMarket()`                                                          |
| Verify insufficient balance client gate              | `tradeParametersPage.verifyInsufficientBalanceClientGate()`                                              |
| Verify empty-balance stake editor hint               | `tradeParametersPage.verifyEmptyBalanceStakeEditorHint()`                                                |
| Click Buy with insufficient balance                  | `tradeParametersPage.clickBuyWithInsufficientBalance()`                                                  |
| Verify insufficient-balance popup                    | `tradeParametersPage.verifyInsufficientBalancePopup()`                                                   |
| Dismiss insufficient-balance popup                   | `tradeParametersPage.clickInsufficientBalancePopupClose()`                                               |
| Verify popup dismissed                               | `tradeParametersPage.verifyInsufficientBalancePopupDismissed()`                                          |
| Click Deposit now on popup                           | `tradeParametersPage.clickInsufficientBalanceDepositButton()`                                            |
| Verify DTrader → transfer redirect                   | `tradeParametersPage.verifyNavigatedToDepositFromDTrader()`                                              |
| Verify insufficient balance behavior (Flow 13)       | `tradeValidationPage.verifyInsufficientBalanceBehavior()`                                                |
| Verify desktop param info icon + tooltip (Flow 19)   | `tradeParametersPage.verifyTradeParamInfoIconOnDesktop()`                                                |
| Verify mobile param info icon + tooltip (Flow 19)    | `tradeParametersPage.verifyTradeParamInfoIconsInMobileEditor()`                                          |
| Open mobile Theme drawer (Flow 20)                   | `tradeParametersPage.openMobileThemeDrawer()`                                                            |
| Select mobile theme preference (Flow 20)             | `tradeParametersPage.selectMobileThemePreference('System')`                                              |
| Desktop sidebar theme toggle (Flow 20)               | `tradeParametersPage.clickSidebarThemeToggle()`                                                          |
| Assert resolved body theme (Flow 20)                 | `tradeParametersPage.expectResolvedBodyTheme('dark')`                                                    |
| Seed theme preference (Flow 20)                      | `TradeBasePage.seedThemePreference(page, 'system')`                                                      |
| HL→OU proposal uses last_digit (Flow 21 / #1384)     | `tradeOverUnderPage.verifyProposalAfterHigherLowerToOverUnder({ market, digit })`                        |
| Read committed stake (Flow 25 / market-selection)    | `tradeParametersPage.readCommittedStake()`                                                               |
| Read committed duration (Flow 25 / market-selection) | `tradeParametersPage.readCommittedDuration()`                                                            |
| Assert stake + duration (Flow 25)                    | `tradeParametersPage.expectCommittedStakeAndDuration()` — pass `{ differs: true }` for sibling isolation |
| Reload + restore stake/duration (Flow 25)            | `tradeParametersPage.verifyStakeAndDurationPersistAcrossReload()`                                        |
| Track duplicate Buy requests                         | `tradeValidationPage.startBuyRequestTracking()`                                                          |
| Read complete Buy state                              | `tradeValidationPage.getPurchaseControlState()`                                                          |

---

## Section 4 — Tags Reference

| Tag           | When to apply                                           |
| ------------- | ------------------------------------------------------- |
| `@trade`      | Trade form, purchase flow, market selector, trade types |
| `@auth`       | Login, logout, session handling                         |
| `@reports`    | Positions, statements, P&L                              |
| `@smoke`      | Critical path — must pass on every run                  |
| `@production` | Safe to run on production (read-only assertions only)   |
| `@desktop`    | Desktop viewport (chromium project, 1728×1117)          |
| `@mobile`     | Mobile viewport (chromium-mobile project, 500×850)      |

---

## Section 5 — Feature-Specific Decisions

### Desktop vs Mobile: same spec, platform-branched assertions

`trade.tsx` routes to `TradeDesktop` or `TradeMobile` based on `isMobile`. Both serve route `/`. Single spec per trade type runs under both `chromium` and `chromium-mobile` projects. Use `testInfo.project.name.includes('mobile')` for platform-specific testid branches (e.g. `dt_tp_input` vs `dt_tp_input_desktop`).

### Unique parameter locator map per trade type

| Trade type        | Unique param                                                                                                                                  | Locator strategy                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Rise/Fall         | Allow equals                                                                                                                                  | `getByText('Allow equals')` — toggle, no testid                          |
| Higher/Lower      | Barrier                                                                                                                                       | `getByText('Barrier')` — label, no testid                                |
| Touch/No Touch    | Barrier                                                                                                                                       | `getByText('Barrier')`                                                   |
| Matches/Differs   | Last digit prediction                                                                                                                         | `getByTestId('dt_digit_stats_percentage').first()`                       |
| Over/Under        | Last digit prediction                                                                                                                         | `getByTestId('dt_digit_stats_percentage').first()`                       |
| Accumulators      | Growth rate                                                                                                                                   | `getByText('Growth rate')`                                               |
| Accumulators      | Take profit                                                                                                                                   | Mobile: `dt_tp_input`; Desktop: `dt_take_profit_input`                   |
| Multipliers       | Multiplier                                                                                                                                    | `getByText('Multiplier')` — label, no testid                             |
| Multipliers       | Risk management                                                                                                                               | `getByText('Risk management')`                                           |
| Multipliers TP    | TP input                                                                                                                                      | Mobile: `dt_tp_input`; Desktop: `dt_tp_input_desktop`                    |
| Multipliers SL    | SL input                                                                                                                                      | Mobile: `dt_sl_input`; Desktop: `dt_sl_input_desktop`                    |
| Multipliers DC    | Deal cancellation badge                                                                                                                       | `getByTestId('dt_deal_cancellation_badge')`                              |
| Buy (payout / DC) | Purchase-button amount (`$N.NN`)                                                                                                              | `dt_purchase_button_wrapper` → `locator('> span').last()` — no `dt_span` |
| Turbos            | Payout per point                                                                                                                              | `getByText('Payout per point')`                                          |
| Turbos            | Barrier info panel                                                                                                                            | `getByText('Barrier')` (info panel below params)                         |
| Vanillas          | Strike price                                                                                                                                  | `getByText('Strike price')`                                              |
| Stake (all types) | Chips `Select value $N`; Custom: `dt_stake_input_desktop` + `.stake-input-desktop__save-button`; Mobile: `dt_stake_input` + header Save/Close |

### Which trade types require manual close vs auto-expiry

| Trade type                            | Close method                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rise/Fall                             | Desktop: `PositionsPage.closeFirstContract()` (inline Close button on card). Mobile: `PositionsPage.closeFirstContract()` (force-clicks hidden button). Then `verifyClosedContractDetailsPage()` extracts `sellId`. |
| Higher/Lower, Touch/No Touch          | Manual close via contract details footer: `getByRole('button', { name: /^Close/ })`                                                                                                                                 |
| Accumulators                          | Close button on trade page (`getByRole('button', { name: /^Close/ })`) while contract is active                                                                                                                     |
| Multipliers                           | Manual close via contract details footer                                                                                                                                                                            |
| Matches/Differs, Over/Under, Even/Odd | Auto-expiry — no manual close                                                                                                                                                                                       |
| Turbos                                | Auto-expiry — no manual close; test only verifies purchase + position card                                                                                                                                          |
| Vanillas                              | Early close via `PositionsPage.closeFirstContract()`; full closed-chain assertions via `verifyVanillasClosedContractDetailsPage()` and `verifyClosedContractInReports()`                                            |

### `NavigationUtils.waitForDerivApiSettled(page)` required after every navigation

All state is driven by WebSocket. Always call after `page.goto()` and after navigating to positions/contract details.

### Notification banner locator

No `data-testid` on the purchase notification banner. Use CSS class `'.trade-notification--purchase'` on the icon wrapper inside the banner — set during `addNotificationBannerCallback` in `purchase-button.tsx`.

### Purchase button amount is `$N.NN` — no Money `dt_span`

`purchase-button-content.tsx` renders the basis label and amount as two direct `<span>` children of `dt_purchase_button_wrapper` via `formatAmountWithSymbol` (e.g. `$24.93`). There is no nested `dt_span`. Use `locator('> span').last()` (`purchaseButtonPayout` / `multipliersTotalCost`). `clickBuy()` strips the symbol and returns the numeric string (`24.93`) for card/report assertions. While the proposal is in flight the amount span can contain a nested Skeleton — direct-child scoping keeps the locator on the value slot.

Desktop Multipliers **Stop out** (`multipliers-information.tsx`) uses the same `$N.NN` pattern: the row's last `<p>`, not `dt_span`. Stop out level is still a bare price.

**Contract details still use Money (`-20.00 USD`), not `$`.** `readStopOut()` therefore stores the numeric amount (`20.00`) and closed mobile Order Details "Stop out level" is asserted with `toContainText` against that number.

### Stake chips are `$N` — desktop Quick picks auto-commit

Preset chips use `aria-label="Select value $20"` (not `"Select value 20.00 USD"`). Desktop (`stake-desktop.tsx`): **Quick picks** / **Custom** tabs. Tapping a chip commits and closes the popover — Quick picks has no Save. Custom shows `dt_stake_input_desktop` and footer Save (`.stake-input-desktop__save-button`). Mobile: chips only draft; header Save commits, and stays disabled while the draft equals the committed stake — dismiss an unchanged reopen with Close (`dt-actionsheet-header-close-action`).

### Insufficient balance has two purchase paths

**Stake editor (client-readable shortfall):** balance hint in the open stake editor; **Save** disabled while the hint shows; committed unaffordable stakes are seeded via `tab_trade_params_v2` + reload on both viewports because Save cannot commit through the UI.

**Buy click (server-reported shortfall):** Buy stays **enabled** with a quoted payout; clicking **Buy** opens the insufficient-balance popup (`Insufficient balance` + **Deposit now** on real accounts). **Deposit now** redirects to home-app `/transfer?from=dtrader&source=options&acc=options&curr=USD`.

Flow 17.1 (`verify-insufficient-balance.spec.ts`) covers the zero-balance popup + deposit redirect (`TEST_EMAIL_ZERO_BALANCE`). Flow 17.2 covers the low-balance stake hint accounts. Flow 13 in `verify-manual-trade-negative-validation.spec.ts` exercises the same inform-don't-disable stance dynamically against the logged-in account balance.

### Multipliers Risk Management panel — TP/SL and Deal Cancellation are mutually exclusive

When Deal Cancellation is active, TP and SL toggles are disabled. Source: `risk-management-content.tsx` copy: "Take profit and/or stop loss are not available while deal cancellation is active."

### `dt_acc_info` is in core Header, not AppV2

`data-testid='dt_acc_info'` is in `packages/core/src/App/Components/Layout/Header/account-info.tsx:79` — rendered by the dtrader shell, visible on all pages post-login.
