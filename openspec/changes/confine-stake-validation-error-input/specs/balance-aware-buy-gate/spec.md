## MODIFIED Requirements

### Requirement: [BABG-006] The server-driven insufficient-balance path is preserved

The insufficient-balance error path SHALL be the sole authority for affordability. When the balance state is reported by the price response or by a failed buy, **Buy** SHALL stay pressable and pressing it SHALL open the existing insufficient-balance sheet with its existing title, message, and **Deposit now** (real account) / **OK** (virtual account) actions.

There is no longer a client-provable gate alongside it: every affordability rejection — including one the client could compute from the current charge and balance — SHALL be surfaced through this server-driven path rather than by disabling **Buy** in advance. This covers a rejection that arrives while the balance is still unknown, a limit that is not the account balance, and a balance that changes between the last price and the buy.

#### Scenario: A price-reported balance rejection keeps today's behaviour

- **WHEN** the price response for the displayed contract carries an insufficient-balance error while the client-side balance is unknown
- **THEN** **Buy** stays pressable and pressing it opens the insufficient-balance sheet with **Deposit now**, exactly as before this change

#### Scenario: A rejected buy keeps today's behaviour

- **WHEN** a buy is rejected for insufficient balance — a balance that fell between the last price and the request
- **THEN** the same sheet is shown with the same message and actions

## REMOVED Requirements

### Requirement: [BABG-001] Buy is unavailable when the charge exceeds the available balance

**Reason**: The client-provable gate is removed — **Buy** now stays pressable and the server-driven insufficient-balance path is the sole authority.
**Migration**: See `stake-error-confinement` requirement `[SEC-002]` (Buy stays enabled despite a client-provable stake shortfall) and the retained `[BABG-006]` (the server-driven insufficient-balance path is preserved) above.

### Requirement: [BABG-002] The compared amount is the sum the account will be charged

**Reason**: With the client-provable gate removed, no client-side charge/balance comparison drives **Buy** any longer.
**Migration**: The server response is the authority; no client comparison remains. Affordability is reported by the insufficient-balance sheet on press.

### Requirement: [BABG-003] The reason is stated inline, next to the Buy control

**Reason**: With **Buy** no longer disabled for this reason, there is no dead control to explain next to it.
**Migration**: The balance-aware hint continues to show inside the stake editor per `balance-aware-stake-warning`; the server insufficient-balance sheet states the reason on press.

### Requirement: [BABG-004] No payout is quoted while Buy is unavailable for this reason

**Reason**: **Buy** is no longer made unavailable for this reason, so its payout is quoted normally.
**Migration**: See `stake-error-confinement` requirement `[SEC-002]` — the payout renders normally while **Buy** stays enabled.

### Requirement: [BABG-005] The gate stays inert whenever the comparison cannot be trusted

**Reason**: There is no gate to keep inert; the client-side comparison and its inert-state handling are removed entirely.
**Migration**: All affordability states now flow through the server-driven insufficient-balance path.

### Requirement: [BABG-008] Surfaces other than the Buy control are unchanged

**Reason**: This requirement scoped the removed gate's blast radius and asserted the desktop modal still commits an unaffordable stake because "the Buy gate is what makes that state visible" — a rationale that no longer holds once the gate is gone.
**Migration**: The desktop modal's Save gating on an unaffordable stake and the balance-blind preset chips are governed by `balance-aware-stake-warning`; the collapsed stake trade parameter staying neutral is governed by `stake-error-confinement` `[SEC-001]`.
