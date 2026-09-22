# reports-store-fixes Specification

## Purpose
TBD - created by archiving change derivatives-trader-issues-1270. Update Purpose after archive.
## Requirements
### Requirement: [RSF-001] An argument-less statement filter reset restores all transactions

`StatementStore.handleFilterChange` (`packages/reports/src/Stores/Modules/Statement/statement-store.js`) SHALL default its `filterValue` to the string `'all'`, not `{}`. `action_type` is a string observable (`'all' | 'buy' | 'sell' | 'deposit' | 'withdrawal'`, initialized to `'all'`); the public store type (`useReportsStores.tsx`) permits an argument-less call, so a default of `{}` sets `action_type` to an object and sends a malformed non-enum `action_type` on the `statement` WebSocket request, leaving the transactions table stuck/empty instead of showing all transactions.

#### Scenario: Reset with no argument shows all transactions

- **WHEN** `handleFilterChange()` is called with no argument
- **THEN** `action_type` becomes the string `'all'`, the request omits the `action_type` filter, and the statement table shows all transactions

#### Scenario: Explicit filter value still applies

- **WHEN** `handleFilterChange('deposit')` is called
- **THEN** `action_type` becomes `'deposit'` and only deposit transactions are fetched, unchanged from today

### Requirement: [RSF-002] The statement transaction icon key uses the row's real identifier

In `packages/reports/src/Constants/data-table-constants.tsx`, the statement `icon` column's `MarketSymbolIconRow` SHALL take its React `key` from `row_obj.refid` rather than `row_obj.transaction_id`. The statement formatter (`formatStatementTransaction`) maps the API `transaction_id` into a field named `refid` and returns no `transaction_id`, so the current `key={row_obj.transaction_id}` is `undefined` for every statement row. The profit-table and archived-statement icon sites (which spread `...transaction` and retain `transaction_id`) SHALL be left unchanged.

#### Scenario: Statement icon has a stable per-row key

- **WHEN** the statement table renders its rows
- **THEN** each transaction icon's `key` is the row's `refid` (a defined value), not `undefined`

#### Scenario: Profit and archived tables unchanged

- **WHEN** the profit-table and archived-statement tables render
- **THEN** their icon `key={row_obj.transaction_id}` sites are untouched and still resolve to a defined value

