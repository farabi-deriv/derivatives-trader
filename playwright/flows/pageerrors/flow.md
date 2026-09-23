# 📋 Pageerrors Journey Spec — What to Test

> **Purpose:** Guards against **uncaught JavaScript exceptions** (`page.on('pageerror')`) on critical user paths.
> These are regression tests for production bugs — not UI journey specs. Specs live in
> `playwright/tests/pageerrors/`; each flow row links back to the originating GitHub issue.
>
> **What `pageerror` is:** Playwright fires this when the page throws an uncaught exception. It is
> **not** a general console-log check — `console.warn` / `console.error` alone do not fail these tests.
>
> **Cross-module:** Specs may exercise the trade page, positions flyout, etc. Tag with **`@pageerrors`** plus **`@desktop`** / **`@mobile`** only — product area is documented in the flow row, not duplicated as tags.

---

## Section 1 — Shared Pattern

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Register listener | `page.on('pageerror')` **before** navigation | Listener captures uncaught exceptions during the journey | Both |
| 2 | Reproduce path | Login / navigate / interact per flow | User path completes (or reaches the asserted surface) | Both |
| 3 | Assert clean | Inspect collected errors (filter by substring) | No matching `pageerror` messages | Both |

> **Naming:** `verify-no-<identifier>-error-on-<trigger>.spec.ts` under `playwright/tests/pageerrors/`.

---

## Section 2 — Per-Flow Sections

### Flow 1 — Trade form load: no delay_amount pageerror

> Covers regression for #901.

**Prerequisites:** Authenticated (real or demo account). Market open.
**Spec:** `pageerrors/verify-no-delay-amount-error-on-load.spec.ts`
**Product area:** Trade panel after login (`verifyDTraderLandingPage()`).

| # | Step | Action | Expected Result | Platform |
| --- | --- | --- | --- | --- |
| 1 | Register listener | `page.on('pageerror')` before `loginPage.login()` | Listener active during trade panel hydration | Both |
| 2 | Login + load | `TradeBasePage.seedLocalStorageOnOrigin()` → `login()` → landing verify | Trade panel renders; **no** pageerror contains `delay_amount` | Both |
