## ADDED Requirements

### Requirement: Account list refreshes its data every time it is opened

The account list SHALL trigger a refetch of the derivatives accounts query
(`['derivatives', 'account', <loginid>]`, `GET /cfd/v1/options/accounts`) on every closed → open
transition, regardless of the query's `staleTime`. This applies to both surfaces: the AppV2 header
rendered by `AccountHeader` and the legacy core header rendered by `AccountInfo`, which both render
`AccountSwitcher`.

The refetch SHALL be dispatched from the same handler that opens the list.

Closing the list SHALL NOT trigger a refetch.

#### Scenario: Opening the account list refetches the accounts

- **WHEN** a logged-in user with more than one account activates the account-info trigger while the list
  is closed
- **THEN** the derivatives accounts query is refetched
- **AND** the list opens

#### Scenario: Closing the list does not refetch

- **WHEN** the user closes an open account list (trigger click, outside click, or action-sheet dismiss)
- **THEN** no refetch of the derivatives accounts query is triggered

#### Scenario: Opening without a refetch handler does not fail

- **GIVEN** the container renders the list without supplying a refetch handler
- **WHEN** the user opens the list
- **THEN** the list opens and no error is thrown

#### Scenario: Reopening after an out-of-band balance change shows the new balance

- **GIVEN** a non-selected account's balance changed outside this session (deposit, transfer, trade
  settled in another tab, demo balance reset)
- **WHEN** the user opens the account list again
- **THEN** that account's row shows the balance from the newly fetched payload, not the balance captured
  when the page loaded

### Requirement: A successful refresh is invisible

While a refetch of an already-populated accounts query is in flight, `AccountSwitcher` SHALL continue to
render the last successfully fetched account rows, and SHALL NOT render its loading state. The loading
state is reserved for the case where there is no account data to render at all.

#### Scenario: List keeps rendering during a successful refresh

- **WHEN** the account list is open and a refetch of the accounts query is in flight over an existing list
- **THEN** the switcher renders the previously fetched account rows
- **AND** the two-row skeleton is not rendered

#### Scenario: Rows update once the refetch resolves

- **WHEN** the in-flight refetch resolves successfully
- **THEN** the switcher renders one row per account from the refetched payload, real accounts before demo
  accounts

#### Scenario: Skeleton covers a cold load

- **WHEN** the account list is open and the accounts query has no data yet
- **THEN** the switcher renders the two-row skeleton
- **AND** no account row is rendered

### Requirement: Opening the account list does not disturb the header trigger

The account header trigger (account-type label, balance, and the Deposit / Try real button) SHALL
continue to be driven by the live WebSocket balance and by the initial load of the accounts query only.
A refetch triggered by opening the list SHALL NOT put the header trigger into its skeleton state.

#### Scenario: Header stays rendered while the list refreshes

- **WHEN** the user opens the account list and a refetch is in flight
- **THEN** the header trigger keeps showing the active account's type label and live balance
- **AND** the header skeleton is not shown

### Requirement: The selected row shows the live WebSocket balance

The row for the currently selected account SHALL display `client.balance` (fed by the
`subscribe({ balance: 1 })` stream), not the balance field from the accounts payload, so the active
account's balance stays correct between refreshes.

#### Scenario: Selected row tracks the live balance

- **GIVEN** the account list is open and the accounts payload reports a different balance for the active
  account than the store holds
- **WHEN** the rows are rendered
- **THEN** the selected row shows the store's live balance
- **AND** every non-selected row shows the balance from the accounts payload

### Requirement: A failed fetch shows the error state instead of unverified balances

When the accounts query is in an error state, `AccountSwitcher` SHALL render "Failed to load" with a
Refresh button, and SHALL NOT render account rows — including when a previously fetched list is still
held in cache. A balance the application cannot confirm as current is never displayed.

#### Scenario: Refetch fails with accounts already cached

- **GIVEN** the accounts query has previously returned at least one account
- **WHEN** the user opens the list and the refetch fails
- **THEN** the switcher renders "Failed to load" and the Refresh button
- **AND** no account row, and therefore no stale balance, is rendered

#### Scenario: Initial fetch fails

- **GIVEN** the accounts query has no data (initial load failed, or the payload was empty)
- **WHEN** the list is open and not loading
- **THEN** the switcher renders the "Failed to load" message and the Refresh button

#### Scenario: Refresh button retries the fetch

- **WHEN** the user clicks the Refresh button in the error state
- **THEN** the accounts query is refetched

#### Scenario: Failure during retry backoff is reported late

- **GIVEN** the accounts query is configured to retry a failed request with exponential backoff
- **WHEN** an attempt fails but retries are still pending
- **THEN** the query is not yet in an error state, so the cached list remains rendered until the retries
  are exhausted

### Requirement: Refetch-on-open must not degrade other consumers of the accounts query

Every consumer of the derivatives accounts query SHALL evaluate its cached `data` before its error flag,
so a transient failure cannot discard an answer the cache still holds. Refetching on every open makes a
failed fetch of that query reachable mid-session, which it was not before this change.

#### Scenario: EU account keeps its EU classification across a failed refetch

- **GIVEN** the accounts query has returned an account whose `group` marks it as an EU (DIEL) client
- **WHEN** a later refetch of that query fails while the cached payload is still held
- **THEN** the account is still classified as EU
- **AND** EU-gated behaviour (automation availability, the positions contract-type filter) stays gated

#### Scenario: No cached account data and the fetch failed

- **GIVEN** the accounts query holds no data
- **WHEN** the fetch fails
- **THEN** the consumer reports a resolved, non-EU result rather than blocking on an unresolved state
