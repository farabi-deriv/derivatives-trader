## Context

Two containers own the account list's open/close state and both render the same
`AccountSwitcher` (`packages/core/src/App/Components/Layout/Header/account-switcher.tsx`):

| Surface                         | Container (owns `is_dropdown_open`)                                     | Mounts `useDerivativesAccount`         | Rendered as              |
| ------------------------------- | ----------------------------------------------------------------------- | -------------------------------------- | ------------------------ |
| AppV2 header (desktop + mobile) | `packages/trader/src/AppV2/Components/AccountHeader/account-header.tsx` | same file (line 50)                    | dropdown / `ActionSheet` |
| Legacy core header              | `packages/core/src/App/Components/Layout/Header/account-info.tsx`       | parent `account-actions.tsx` (line 29) | dropdown / `ActionSheet` |

`AccountSwitcher` decides dropdown vs. `ActionSheet` itself via `useDevice()`, which is why one component
change fixes rendering for both, but the _trigger_ has to be wired in each container.

Constraints discovered while researching:

- **The `balance` stream is the authorisation gate.** `socket_base.js` sends no `authorize`; it calls
  `subscribeBalance()` on socket open and `socket-general.js` transforms the first `balance`
  response into an `authorize` payload (`authorizeAccount`). `client.init` literally awaits
  `BinarySocket.wait('balance')` (`client-store.js:294`).
- **The React Query cache is shared cross-bundle and read directly.**
  `packages/reports/src/Hooks/useIsEuAccount.ts` calls
  `window.ReactQueryClient.getQueryData(['derivatives', 'account', loginid])` because reports is bundled
  without `APIProvider` context. The query key is a de-facto public contract.
- **The payload is seeded, not fetched, at bootstrap.** `initStore.js:173-176` `setQueryData`s the
  accounts response captured during the accounts-check, explicitly so `useDerivativesAccount` would not
  refetch the same data once components mount.
- React Query v4 (`@tanstack/react-query@^4.28.0`, 4.44.0 installed), React 18.

## Goals / Non-Goals

**Goals**

- Every row of the account list shows a freshly fetched balance each time the list is opened.
- The refresh is invisible when it succeeds — no skeleton flash on every open.
- A balance the app cannot vouch for is never rendered: a failed fetch shows the error state instead.
- Opening the list does not visibly disturb the header trigger.

**Non-Goals**

- Making non-active account balances live (streamed). Out of scope — see Decision 3.
- Push-based invalidation on deposit / transfer / settlement / demo-reset. Out of scope — see Decision 5.
- Any change to `staleTime` / `cacheTime`, the query key, the retry policy, the bootstrap `setQueryData`
  seed, or the `QueryClient` defaults.
- Refactoring the two duplicate header implementations into one.

## Decisions

### Decision 1 — Refetch on the closed → open transition, from the container

Call `refetch()` inside each container's open handler:

- `account-header.tsx` `toggleDropdown` (line 83) — `refetch` is already in scope from
  `useDerivativesAccount(client.loginid, is_logged_in)`.
- `account-info.tsx` `toggleDropdown` (line 59) — `refetch` already arrives as an optional prop from
  `account-actions.tsx`, and is already wired through to `AccountSwitcher`'s `onRefetch`.

Guarded on `if (!is_dropdown_open)` so only opening refetches, never closing.

_Why the container and not a `useEffect([is_open])` inside `AccountSwitcher`_ — it keeps `AccountSwitcher`
presentational (it performs no data side effects today) and keeps the "opened" event in the place that
knows about opening. `refetch()` is imperative and bypasses `staleTime` entirely, which is what makes the
5-minute window irrelevant to the switcher.

_Cost_: the trigger is duplicated in two containers. Accepted — it is a two-line handler each, and the
duplication already exists at the container level (both mount the same hook, render the same switcher,
and maintain their own `is_dropdown_open`). Extracting a shared hook for two `if (!open) refetch()` calls
would add a cross-package indirection for no behavioural gain (YAGNI).

_Alternatives considered_

- `useEffect` in `AccountSwitcher` — rejected (side effect in a presentational component).
- `invalidateQueries(['derivatives', 'account'])` via `useInvalidateQuery` — equivalent outcome, but
  `refetch()` is already threaded through both containers for the Refresh button, and invalidation would
  also refire the query for other cached loginids. Rejected as broader than needed.
- Dropping `staleTime` to 0 / enabling `refetchOnWindowFocus` — does not fix it: the query stays mounted
  for the whole session, so nothing re-triggers it, and the `QueryClient` defaults are global to every
  package's queries.

### Decision 2 — The refresh is invisible while it succeeds; `is_loading` stays `isLoading`

Both containers pass `is_loading={isLoading}` — the raw React Query flag, true only when there is nothing
cached to render. A refetch over an existing list therefore renders **no** skeleton: the previous rows
stay on screen and the fresh values swap in when the response lands.

_Why not `isLoading || isFetching`_ — that was the first implementation and it was rejected. Because the
list now refetches on _every_ open, feeding `isFetching` into the skeleton means every single open flashes
a two-row skeleton before showing the list, even on a fast, successful refresh. The cost is paid
constantly; the benefit (hiding values for the sub-second window before fresh ones arrive) is paid rarely.
Since a _failed_ refresh is caught by the error branch (Decision 6), the only thing the skeleton would
have hidden is a list that is about to be confirmed correct.

The header trigger's own `shouldShowLoader` (`isLoading || is_switching_account`) is likewise untouched —
opening the list must not skeleton the header.

_Alternative considered_: a separate `is_refetching` prop on `AccountSwitcher`. Rejected — no consumer.

### Decision 3 — Do NOT switch the WS subscription to `balance: 1, account: 'all'`

Rejected. The `balance` stream doubles as this app's authorisation handshake (see Context): the first
`balance` message is transformed into `authorize` and gates `client.init`. With `account: 'all'` the
stream carries per-account messages plus a total, so the first message is not reliably the authorised
account's — `authorizeAccount` could seed `current_account` from the wrong loginid, and
`ResponseHandlers.balanceActiveAccount` stamps _every_ incoming balance with `client_store?.loginid`,
which would write another account's balance onto the active one. The comment
`// Removed balanceOtherAccounts - not needed for single account` in `socket-general.js` marks where
that multi-account path was deliberately deleted. Restoring it is an auth-path change, not a UI fix, and
is disproportionate to the reported bug. REST-on-open gives the required freshness with no risk to login.

### Decision 4 — Do NOT change the query key or the bootstrap seed

`packages/reports/src/Hooks/useIsEuAccount.ts` reads `['derivatives', 'account', loginid]` out of
`window.ReactQueryClient` by hand. Changing the key would silently fail-open EU users to the non-EU UI.
Refetching the same key only makes that read fresher. The `initStore.js` seed also stays: it still avoids
a duplicate fetch at startup, and open-triggered refetches supersede it from then on.

### Decision 5 — Scope to open-triggered refresh; skip event-driven invalidation

The issue also suggests invalidating after balance-changing events. Checked, and each is already covered:

- Deposit / transfer navigates away (`window.location.href = …/transfer…` in both containers), so the
  return trip is a fresh page load.
- Contract settlement and demo-balance reset (`client.resetVirtualBalance` → `topupVirtual`) only affect
  the **active** account, whose row already reads the live `client.balance`.
- Everything else is out-of-band by definition — another tab, another device, another session — which is
  exactly the case open-triggered refresh handles.

Adding invalidation hooks for these would be speculative work with no reachable symptom (YAGNI).

### Decision 6 — The error state outranks a cached list

`account-switcher.tsx:73` keeps `if (error || !accounts || accounts.length === 0)`. An intermediate
version of this change weakened it to a "nothing to render" check so that a transient refresh failure
would not wipe a good list — that was reversed.

Rationale: React Query holds the last-good `data` behind a failed refetch, so dropping `error` from the
condition means a failed refresh leaves the previous balances on screen with no indication they are
unverified. That is the reported defect, narrowed rather than fixed. Stale numbers are worse than no
numbers here, so a failed fetch _or_ refetch shows "Failed to load" plus the Refresh button.

### Decision 8 — Consumers of this query must prefer cached `data` over `isError`

Refetch-on-open makes a _failed refetch_ reachable mid-session for the first time. Previously the payload
was seeded at bootstrap, the query stayed mounted all session, and `refetchOnWindowFocus` /
`refetchOnReconnect` are off — nothing refetched, so `isError` could only be true when there was no data
at all, which made failing open on it correct.

That precondition is gone. React Query retains `data` through a failed refetch (see the table in
Decision 7), so any consumer branching on `isError` _before_ `data` now discards a good cached answer.

`packages/trader/src/AppV2/Hooks/useIsEuAccount.ts` did exactly that, and the blast radius is EU (DIEL)
gating: `useIsAutomationEnabled` would enable the `/automate` route, and `positions-content.tsx` would
stop narrowing the contract-type filter to Multipliers — until the next _successful_ fetch of the key. It
also left the two bundles disagreeing, since `packages/reports/src/Hooks/useIsEuAccount.ts` reads the
cached `data` straight out of `window.ReactQueryClient` and never consults an error flag.

Fixed by evaluating `data` first and falling back to the fail-open `isError` branch only when nothing is
cached. Every previously reachable outcome is preserved; only the `data`-present-and-errored case
changes. Guarded by a regression test verified red against the old ordering.

Checked and needing no change: `bottom-nav.tsx` reads the group from `data` regardless and uses `isError`
only to widen an already-true `is_account_resolved`; `useIsTradeTypeSelectionRestricted` reads `data`
only.

### Decision 7 — Keep the query's retry policy, and accept the bounded stale window it implies

`useDerivativesAccount` keeps its existing retry config unchanged: never retry 401/403 or other 4xx,
retry 5xx and 429 up to three times with exponential backoff (1s / 2s / 4s).

This interacts with Decision 6 in a way worth recording, measured against React Query 4.44:

| moment                                | `status`  | `error`  | `failureReason` | `data`      |
| ------------------------------------- | --------- | -------- | --------------- | ----------- |
| after a good fetch                    | `success` | null     | null            | cached list |
| attempt 1 failed, retries backing off | `success` | **null** | SET             | cached list |
| all retries exhausted (4 attempts)    | `error`   | SET      | SET             | cached list |

React Query does not flip `status` while it is retrying, so `error` stays null for the whole backoff
window (~7s on a 5xx). During that window the switcher still renders the cached list. The failure does
surface — just late.

_Alternative considered and rejected_: have the containers pass `error ?? failureReason`, which surfaces
the failure on the first failed attempt while the retries continue underneath. It closes the 7s window
exactly, at the cost of two extra lines per container and a non-obvious React Query field. Judged not
worth the added concept; the retries are worth more than closing the gap. Recorded here so the window is
not rediscovered as a bug.

_Note_: the bottom row also shows `data` surviving a terminal error. That is precisely why the `error ||`
guard is load-bearing — without it, `accounts.length > 0` stays true and the stale list would render
indefinitely, not merely for the backoff window.

## Risks / Trade-offs

- **One extra REST call per open; rapid open/close could spam it.** → Accepted, un-throttled. Note the
  requests are _not_ deduped: v4's `refetch()` defaults to `cancelRefetch: true`
  (`queryObserver.js:184`), so toggling the list cancels the in-flight request and starts a new one
  rather than collapsing into it. The call is user-initiated, cheap, and bounded by how fast a person can
  click. No throttle added (no premature optimization).
- **A brief window of stale values on a successful refresh.** → Accepted (Decision 2). The rows are
  replaced as soon as the response lands, and a failure is caught by the error branch instead.
- **Up to ~7s of stale values while the retry backoff runs.** → Accepted (Decision 7), documented in two
  places rather than engineered around.
- **The Refresh button gives no feedback when a list is already cached.** After a failed refresh,
  `isLoading` is false (data exists) and `error` stays set until a retry succeeds, so clicking Refresh
  changes nothing on screen until the request resolves. → Known gap, not addressed here. The narrow fix
  is to let `isFetching` drive the skeleton _inside the error branch only_, which would leave the
  open-refetch path untouched.
- **`account-actions.tsx`'s reset effect depends on the `accounts` array identity.** A refetch produces a
  new `data` object, which re-runs the effect and clears `is_switching_account`. Narrowing that dependency
  to `accounts.length` (attempted, then reverted) breaks the case where an account switch resolves against
  an already-cached query key: `isLoading` never flips, the length is unchanged, so the effect never runs
  and `is_switching_account` stays true — which also disables the purchase button, run controls, and the
  positions drawer. The dependency must stay on the array.

## Migration Plan

None required — pure UI/data-fetch behaviour change, no schema, storage, contract, or feature-flag work.
Rollback is a straight revert of the two `toggleDropdown` guards plus the `useIsEuAccount` reorder.

## Open Questions

Resolved. `tasks.md` (`## Resolved Questions`) records each question and the answer that was implemented.
