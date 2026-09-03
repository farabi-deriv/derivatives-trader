# Account balance action sheet does not show the latest balance

Source: [deriv-com/derivatives-trader#1013](https://github.com/deriv-com/derivatives-trader/issues/1013)

## Why

The account list — desktop dropdown and mobile action sheet, both rendered by
`packages/core/src/App/Components/Layout/Header/account-switcher.tsx` — shows a **stale balance for
every account except the active one**. The active row reads the live WebSocket balance
(`client.balance`), while all other rows read `account.balance` from a REST payload
(`GET /cfd/v1/options/accounts`) that is fetched **once per loginid per session** and never refreshed:

- The payload is seeded into the shared React Query cache at bootstrap
  (`packages/core/src/App/initStore.js:173-176`, `setQueryData(['derivatives', 'account', loginid], …)`).
- `useDerivativesAccount` sets `staleTime: 5 * 60 * 1000` (`packages/api/src/hooks/useDerivativesAccount.ts`),
  but the query is mounted for the whole session by the always-rendered header, so `staleTime` never
  triggers a refetch; and the shared `QueryClient` disables both `refetchOnWindowFocus` and
  `refetchOnReconnect` (`packages/api/src/APIProvider.tsx:58-63`).
- Opening the list only flips local React state (`is_dropdown_open` in
  `packages/trader/src/AppV2/Components/AccountHeader/account-header.tsx` and
  `packages/core/src/App/Components/Layout/Header/account-info.tsx`); nothing mounts or invalidates
  the query at that moment. `refetch` is wired only to the **Refresh** button, which renders exclusively
  in the switcher's error branch.
- The WS balance stream is single-account by design: `subscribe({ balance: 1 })`
  (`packages/core/src/_common/base/socket_base.js:168`) and `setBalanceActiveAccount` guards on
  `obj_balance.loginid === this.current_account.loginid`
  (`packages/core/src/Stores/client-store.js:490-497`).

Net effect at `account-switcher.tsx:116` — `const balance = is_selected ? client.balance : account.balance;`
— only the selected row is ever correct. A hard reload or an account switch is the only way to refresh
the others.

## What Changes

- **Refetch the accounts query when the account list is opened.** Both containers that own the
  open/close state trigger `refetch()` on the closed → open transition, so the list always reflects a
  freshly fetched payload. The trigger lives in the containers (not in `AccountSwitcher`) so the refetch
  is dispatched in the same event handler that opens the list, and stays out of an otherwise
  presentational component.
- **A successful refetch is invisible.** No skeleton on open: the last-good list keeps rendering and the
  new values swap in when the response lands. `is_loading` stays bound to `isLoading` (true only when
  there is nothing to render yet), so the skeleton is reserved for a genuine cold load. This avoids a
  skeleton flash on every single open.
- **A failed fetch _or_ refetch shows the error state, never a stale balance.** The switcher keeps its
  existing `error || accounts.length === 0` branch: "Failed to load" plus the Refresh button replaces the
  cached list. Showing balances the app can no longer vouch for is the exact defect this change exists to
  fix, so stale numbers lose to no numbers.
- **No change** to the WS `balance` subscription, the query key `['derivatives', 'account', loginid]`,
  `staleTime`, `cacheTime`, or the query's retry policy. See `design.md` for why the
  `balance: 1, account: 'all'` alternative is rejected, why the query key is load-bearing, and the
  bounded stale window the retained retry backoff implies.

Not a breaking change: no public API, prop contract removal, or storage-shape change.

## Capabilities

### New Capabilities

- `account-switcher`: the account list surface (desktop dropdown + mobile action sheet) — which balance
  each row shows, when the list refreshes its data, how loading and error states are presented, and the
  guard that refreshing on open must not degrade other consumers of the same accounts query.

### Modified Capabilities

None. `openspec/specs/` holds seven capabilities (`allow-equals-toggle`, `barrier-input`,
`barrier-range-errors`, `contract-details-chart`, `duration-end-time-fields`, `market-descriptions`,
`positions-drawer`); none of them covers the account switcher or the derivatives accounts query, so there
is no established requirement to amend.

## Impact

**Code**

- `packages/trader/src/AppV2/Components/AccountHeader/account-header.tsx` — refetch on the closed → open
  transition in `toggleDropdown`.
- `packages/core/src/App/Components/Layout/Header/account-info.tsx` — same refetch-on-open guard, using
  the existing optional `refetch` prop; also makes the `@tanstack/react-query` type-only import explicit
  (`import type`).
- `packages/core/src/App/Components/Layout/Header/account-actions.tsx` — no behaviour change; adds a
  `data-testid` alongside the existing `id` so the container's loading state is assertable.
- `packages/core/src/App/Components/Layout/Header/account-switcher.tsx` — no behaviour change; drops an
  unused `import React` (the repo builds with the automatic JSX runtime).
- `packages/trader/src/AppV2/Hooks/useIsEuAccount.ts` — evaluate `data` before `isError`, so a failed
  open-triggered refetch cannot flip a DIEL account to the non-EU UI while the correct group is cached.

**Tests**

- `packages/core/src/App/Components/Layout/Header/__tests__/account-switcher.spec.tsx`
- `packages/core/src/App/Components/Layout/Header/__tests__/account-info.spec.tsx`
- `packages/core/src/App/Components/Layout/Header/__tests__/account-actions.spec.tsx`
- `packages/trader/src/AppV2/Components/AccountHeader/__tests__/account-header.spec.tsx`
- `packages/trader/src/AppV2/Hooks/__tests__/useIsEuAccount.spec.tsx`

**APIs / dependencies**

- One extra `GET /cfd/v1/options/accounts` request per list open (user-initiated). The requests are not
  deduped — v4's `refetch()` defaults to `cancelRefetch: true`, so toggling cancels the in-flight request
  and starts a new one; see `design.md` Risks. No new dependency.

**Systems that read the same cache — must not regress**

- `packages/reports/src/Hooks/useIsEuAccount.ts` reads
  `window.ReactQueryClient.getQueryData(['derivatives', 'account', loginid])` directly across bundles.
  The query key must stay exactly as-is; a refetch on open makes this read _fresher_, not weaker.
- `packages/trader/src/AppV2/Hooks/useIsEuAccount.ts` also consumes `useDerivativesAccount` and branched
  on `isError` before `data`. That was safe only while nothing ever refetched; refetch-on-open makes a
  failed refetch reachable mid-session, and React Query keeps `data` through it. Fixed as part of this
  change — see `design.md` Decision 8.
- `packages/trader/src/AppV2/Hooks/useIsTradeTypeSelectionRestricted.ts` (reads `data` only) and
  `packages/core/src/App/Containers/Layout/bottom-nav/bottom-nav.tsx` (reads the group from `data`
  regardless of the error flag) were checked and need no change.
