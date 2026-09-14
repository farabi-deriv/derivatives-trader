# balance-aware-buy-gate Specification

## Purpose

TBD - created by archiving change p2-buy-button-stays-enabled-and-quotes-a-payout-when-stake-is-5x-available-balance. Update Purpose after archive.
## Requirements
### Requirement: [BABG-006] The server-driven insufficient-balance path is preserved

The insufficient-balance error path SHALL be the sole authority for affordability. When the balance state is reported by the price response or by a failed buy, **Buy** SHALL stay pressable and pressing it SHALL open the existing insufficient-balance sheet with its existing title, message, and **Deposit now** (real account) / **OK** (virtual account) actions.

There is no longer a client-provable gate alongside it: every affordability rejection — including one the client could compute from the current charge and balance — SHALL be surfaced through this server-driven path rather than by disabling **Buy** in advance. This covers a rejection that arrives while the balance is still unknown, a limit that is not the account balance, and a balance that changes between the last price and the buy.

#### Scenario: A price-reported balance rejection keeps today's behaviour

- **WHEN** the price response for the displayed contract carries an insufficient-balance error while the client-side balance is unknown
- **THEN** **Buy** stays pressable and pressing it opens the insufficient-balance sheet with **Deposit now**, exactly as before this change

#### Scenario: A rejected buy keeps today's behaviour

- **WHEN** a buy is rejected for insufficient balance — a balance that fell between the last price and the request
- **THEN** the same sheet is shown with the same message and actions

### Requirement: [BABG-007] The stake is never silently capped

The committed stake SHALL NOT be reduced, clamped, or rewritten to fit the available balance. The value the user set SHALL remain exactly as they set it, and the gate SHALL make it visible instead.

Capping would rewrite a user's own input without asking, and would frequently produce a value that cannot be bought at all: a balance below the contract's minimum stake — as in the reported `0.77 USD` case — has no affordable valid stake to cap to.

#### Scenario: An unaffordable stake keeps its value

- **WHEN** the balance is `0.77 USD` and the committed stake is `4.00 USD`
- **THEN** the stake field still reads `4.00 USD`, **Buy** is unavailable with the inline reason, and nothing has been silently changed on the user's behalf

#### Scenario: A balance below the minimum stake is reported, not worked around

- **WHEN** the balance is `0.77 USD` and the contract's minimum stake is `1.00 USD`, so no affordable stake exists
- **THEN** the inline reason is shown and **Buy** stays unavailable, rather than a sub-minimum stake being substituted

