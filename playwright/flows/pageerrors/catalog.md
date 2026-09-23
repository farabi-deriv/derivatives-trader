# 🗺️ Pageerrors Journey Catalog — Technical Reference

> Specs: `playwright/tests/pageerrors/` · Flow prose: `playwright/flows/pageerrors/flow.md`
> Last updated: 2026-09-15

---

## Section 1 — Journey Index

| Journey ID | Spec File | Tags |
| --- | --- | --- |
| Flow 1 | `pageerrors/verify-no-delay-amount-error-on-load.spec.ts` | `@pageerrors @desktop @mobile` |

---

## Section 2 — Flow Details

### Flow 1 — Trade form load: no delay_amount pageerror

```typescript
const delayAmountErrors: string[] = [];
page.on('pageerror', error => {
    if (error.message.includes('delay_amount')) {
        delayAmountErrors.push(error.message);
    }
});

await TradeBasePage.seedLocalStorageOnOrigin(page);
await loginPage.login(testEmail);
await tradeParametersPage.verifyDTraderLandingPage();

expect(delayAmountErrors, 'Trade panel load should not throw delay_amount TypeError (issue #901)').toHaveLength(0);
```

**Env vars:** `TEST_EMAIL` (desktop) / `TEST_EMAIL_MOBILE` (mobile) — same as Flow 1 logged-in smoke in `trade/verify-trade-form-loads.spec.ts`.

**Fix context (#901):** `delay_amount` TypeError on trade panel load when automation-related store fields were read before hydration.

---

## Section 3 — Adding a New Pageerror Flow

1. Add `verify-no-<identifier>-error-on-<trigger>.spec.ts` under `playwright/tests/pageerrors/`.
2. Add **`## Flow N`** to `flow.md` with step table + `> Covers regression for #NNN.`
3. Update `coverage.md` Section 1 and `catalog.md` journey index.
4. Sync `playwright/flows/_index.md`.
