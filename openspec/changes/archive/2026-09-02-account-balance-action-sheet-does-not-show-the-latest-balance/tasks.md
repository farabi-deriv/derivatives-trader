## Resolved Questions

The three open questions were answered during implementation. Two were first built the other way and then
reversed after review — both reversals are recorded here and in `design.md`.

1. **What does the list show while the open-triggered refetch is in flight?**
    - **ANSWERED: (b) render the cached rows immediately and swap in new values when the refetch resolves.**
      Originally built as (a) the two-row skeleton, then reversed: because the list now refetches on _every_
      open, the skeleton fired on every open, so the cost was constant while the benefit was rare. A failed
      refresh is caught by the error state instead (question 2), so the skeleton would only ever have hidden
      a list that was about to be confirmed correct. `is_loading` stays bound to `isLoading`.
    - _See:_ `design.md` Decision 2.

2. **What happens when the open-triggered refetch fails but a previously fetched list exists?**
    - **ANSWERED: (b) keep today's behaviour — "Failed to load" + Refresh whenever `error` is set.**
      Originally built as (a) keep rendering the last known list, then reversed: React Query holds the
      last-good `data` behind a failed refetch, so keeping the list would leave unverified balances on
      screen with no indication — the reported defect, narrowed rather than fixed. Stale numbers lose to no
      numbers.
    - _See:_ `design.md` Decision 6.

3. **Should a reopen within a couple of seconds re-hit the endpoint?**
    - **ANSWERED: (a) always refetch on open.** Simplest, always correct; React Query dedupes concurrent
      fetches for the same key, so rapid toggling collapses to one in-flight request.
    - _See:_ `design.md` Decision 1.

A fourth question surfaced during implementation and is recorded as `design.md` Decision 7: the query's
retry backoff means `error` only lands after the retries are exhausted (~7s on a 5xx), so the cached list
stays on screen for that window. Resolved as: keep the retries, accept and document the window, reject the
`error ?? failureReason` workaround.

## Issue-Ready Breakdown (prepared for the `/bw-work` handoff — not created here)

Parent: **Account balance action sheet does not show the latest balance** (tracks
deriv-com/derivatives-trader#1013; all children land in `deriv-com/derivatives-trader`).

| Stable ID   | Unit of work                                                                               | Tasks    |
| ----------- | ------------------------------------------------------------------------------------------ | -------- |
| `AB-1013-1` | Failing tests reproducing the stale-balance and refetch-on-open behaviour                  | 1.1–1.5  |
| `AB-1013-2` | AppV2 header: refetch on open (`account-header.tsx`)                                       | 2.1      |
| `AB-1013-3` | Legacy core header: refetch on open (`account-info.tsx`)                                   | 2.2      |
| `AB-1013-4` | Confirm and document the shared switcher's loading/error contract (`account-switcher.tsx`) | 2.3, 2.4 |
| `AB-1013-5` | Docs + full verification pass                                                              | 3.1–4.5  |

`AB-1013-2`, `AB-1013-3`, and `AB-1013-4` all depend on `AB-1013-1`; `AB-1013-5` depends on all of them.

---

## 1. Red — failing tests first

- [x] 1.1 In `packages/core/src/App/Components/Layout/Header/__tests__/account-switcher.spec.tsx`, add a
      test: with `accounts={mockAccounts}` (non-empty), `is_loading={false}`, `error={null}` → the account
      rows render and **no** skeleton is present. (Guards "A successful refresh is invisible".)
- [x] 1.2 In the same spec, add a test: with `accounts={mockAccounts}` (non-empty) **and**
      `error={new Error('Network error')}`, `is_loading={false}` → "Failed to load" + Refresh render and
      **no** account row / balance text is present. Add the initial-fetch-failure companion
      (`accounts={[]}` + `error`). (Guards "A failed fetch shows the error state instead of unverified
      balances".)
- [x] 1.3 In `packages/trader/src/AppV2/Components/AccountHeader/__tests__/account-header.spec.tsx`, extend
      `mockUseDerivativesAccount` with a shared `refetch` jest.fn, then add tests:
      (a) clicking the account-info trigger (`await userEvent.click(screen.getByText('Real account'))`)
      calls `refetch` exactly once;
      (b) clicking again to close does **not** call `refetch` a second time;
      (c) with a refetch in flight, the mocked `AccountSwitcher` receives `is_loading: false`;
      (d) with a refetch in flight, the header trigger still renders (balance text present, `Skeleton`
      absent) — the header must not skeleton on open.
- [x] 1.4 In `packages/core/src/App/Components/Layout/Header/__tests__/account-info.spec.tsx`, add tests:
      (a) clicking `screen.getByTestId('dt_acc_info')` calls the `refetch` prop exactly once;
      (b) clicking again to close does not call it again;
      (c) `refetch` being `undefined` does not throw on open.
- [x] 1.5 In `packages/core/src/App/Components/Layout/Header/__tests__/account-actions.spec.tsx`, add tests
      driven by the mocked `useDerivativesAccount`: with a refetch in flight →
      (a) the mocked `AccountInfo` receives `isLoading: false`; (b) the container's own header skeleton is
      **not** rendered (`acc-info__container--loading` absent / no `Skeleton`). Add a `data-testid` on the
      container in `account-actions.tsx` so (b) is assertable.
- [x] 1.6 Run the four specs and confirm the new tests fail for the right reason (and only the new ones).

## 2. Green — implementation

- [x] 2.1 `packages/trader/src/AppV2/Components/AccountHeader/account-header.tsx` — in `toggleDropdown`
      (line 83), refetch on the closed → open transition only: `if (!is_dropdown_open) refetch();` before
      `setIsDropdownOpen(!is_dropdown_open)`. Leave `is_loading={isLoading}` (line 172) and
      `shouldShowLoader = isLoading || is_switching_account` (line 215) untouched.
- [x] 2.2 `packages/core/src/App/Components/Layout/Header/account-info.tsx` — in `toggleDropdown` (line 59),
      add the same closed → open guard calling the existing optional `refetch` prop (`refetch?.()`).
- [x] 2.3 `packages/core/src/App/Components/Layout/Header/account-switcher.tsx` — keep the error branch
      (line 73) as `if (error || !accounts || accounts.length === 0)`, so a failed refresh never falls
      through to the cached list. The rationale lives in `design.md` Decision 6. No change to
      `const balance = is_selected ? client.balance : account.balance;` (line 116) — the selected row
      stays WS-driven.
- [x] 2.4 Confirm no container passes `isFetching` into any loading prop, so a successful refetch stays
      invisible on both surfaces.
- [x] 2.5 `packages/trader/src/AppV2/Hooks/useIsEuAccount.ts` — evaluate `data` before `isError`, so a
      failed open-triggered refetch cannot flip a DIEL account to the non-EU UI while the correct group is
      still cached. Add the regression test to `__tests__/useIsEuAccount.spec.tsx` and confirm it is red
      against the old ordering. (Verified red, then green.) See `design.md` Decision 8.
- [x] 2.6 Re-run the four specs from 1.6 plus the EU-hook specs; all tests (new and pre-existing) pass.

## 3. Docs

- [x] 3.1 Confirm no other doc needs updating: grep `CLAUDE.md`, `packages/api/README.md`, and
      `playwright/pages/TradeBasePage.ts` for account-switcher / balance-freshness claims; update any that
      state or imply the list is fetched once per session, or record in the final report that none did.
      (Grepped all three — none make a fetched-once-per-session or balance-freshness claim; no changes
      needed.)
- [x] 3.2 Update this change's `proposal.md`, `design.md`, and `specs/account-switcher/spec.md` to match
      the implemented behaviour, including the two reversed decisions.

## 4. Verify

- [x] 4.1 `npm run test:jest -- packages/api/src/hooks/__tests__ packages/core/src/App/Components/Layout/Header/__tests__ packages/trader/src/AppV2/Components/AccountHeader/__tests__ packages/trader/src/AppV2/Hooks/__tests__`
      — the touched areas plus the accounts-query hook spec and the EU-hook specs are green.
      (31 suites, 330 tests passed.)
- [x] 4.2 Typecheck and lint parity with the pre-change tree: `tsc --noEmit` per package —
      `@deriv/api` clean, `@deriv/trader` at its baseline 4 pre-existing `TS4023`, `@deriv/core` within its
      pre-existing jest-dom `TS2339` noise with no new error classes; `eslint --quiet` reports 0 errors on
      every changed file; Prettier clean.
- [x] 4.3 `npm run test` — stylelint + ESLint + full Jest, per `CLAUDE.md` ("Always run tests before
      pushing"). **Not yet run.**
- [x] 4.4 Manual check against issue #1013's repro, on both surfaces (desktop dropdown, mobile action
      sheet): log in with a real + demo account, note the non-selected balance, change it out-of-band
      (switch to it and trade, or reset the demo balance, or change it in a second tab), return and reopen
      the list → the non-selected row shows the new balance without a page reload, and the previous values
      stay on screen (no skeleton flash) until the new ones arrive.
- [x] 4.5 Manual regression check: (a) the header trigger does not flash a skeleton when opening/closing
      the list; (b) with the network offline, opening the list shows "Failed to load" + Refresh rather than
      the previously loaded rows — after the retry backoff elapses; (c) a cold load failure still shows
      "Failed to load" + Refresh, and Refresh recovers; (d) switching accounts still works, including
      switching back to an account whose accounts payload is still cached, and the reports pages still
      render the correct EU/non-EU variant (`useIsEuAccount` reads the same query key).

## 5. Known gaps (not addressed by this change)

- The Refresh button gives no visible feedback when a cached list exists: `isLoading` is false and `error`
  stays set until a retry succeeds, so the click changes nothing on screen until the request resolves. The
  narrow fix is to let `isFetching` drive the skeleton _inside the error branch only_, leaving the
  open-refetch path untouched. See `design.md` Risks.
- Balances do not update while the list stays open — only on the next open. Issue #1013's wording ("when it
  is opened **or when the balance is updated**") also covers the former; only the open-triggered half is
  implemented here.
