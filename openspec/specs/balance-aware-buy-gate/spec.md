# balance-aware-buy-gate Specification

## Purpose

TBD - created by archiving change p2-buy-button-stays-enabled-and-quotes-a-payout-when-stake-is-5x-available-balance. Update Purpose after archive.

## Requirements

### Requirement: [BABG-001] Buy is unavailable when the charge exceeds the available balance

The trade page's **Buy** control SHALL be unavailable — not pressable, and visibly presented as such — whenever the amount that buying the currently displayed contract would charge the account is greater than the account's available balance.

This SHALL hold on both breakpoints, for every trade type that renders a Buy control, and regardless of which route put the stake in that state: an amount committed from the desktop stake modal, a persisted or URL-supplied amount, or a balance that fell below an already-valid amount after earlier trades.

Pressing the control while it is unavailable SHALL NOT send a buy request and SHALL NOT open the insufficient-balance error sheet.

#### Scenario: The reported case is blocked before any request

- **WHEN** the available balance is `0.77 USD`, the displayed contract's charge is `4.00 USD`, and the priced payout is `7.69 USD`
- **THEN** **Buy** is unavailable, no buy request is sent when it is pressed, and the user is not made to wait for a server rejection to learn the trade is unaffordable

#### Scenario: A charge equal to the balance is affordable

- **WHEN** the available balance is `4.00 USD` and the contract's charge is exactly `4.00 USD`
- **THEN** **Buy** stays available and buying proceeds normally — only a charge strictly greater than the balance blocks it

#### Scenario: An empty balance blocks Buy

- **WHEN** the available balance is `0` (or negative)
- **THEN** **Buy** is unavailable, whether or not the contract has been priced yet, because no charge can be met from that balance

### Requirement: [BABG-002] The compared amount is the sum the account will be charged

The comparison SHALL use the charge quoted by the current price for the displayed contract — the sum a buy would debit — and SHALL NOT use the stake the user typed or the payout being quoted.

Consequently the gate SHALL be correct without knowing which basis the trade form is on, and SHALL account for amounts that a stake alone does not describe: the multiplier commission and, when deal cancellation is on, its fee. These are the two cases the stake-input warning documents as accepted blind spots; this capability closes them.

#### Scenario: Payout basis does not mislead the gate

- **WHEN** the trade form holds a target payout of `10.00 USD` rather than a stake, the balance is `4.00 USD`, and the resulting charge is `3.20 USD`
- **THEN** **Buy** stays available, because the charge — not the `10.00` target — is what is compared

#### Scenario: A multiplier's fees are inside the compared amount

- **WHEN** the balance is `5.00 USD`, a multiplier's stake is `5.00 USD`, and deal cancellation adds a `0.50 USD` fee so the charge is `5.50 USD`
- **THEN** **Buy** is unavailable, even though the stake on its own does not exceed the balance

### Requirement: [BABG-003] The reason is stated inline, next to the Buy control

Whenever **Buy** is unavailable for this reason, an inline message SHALL be shown adjacent to the control, stating the balance and what to do about it. The user SHALL NOT have to open the stake editor, press a disabled control, or wait for a sheet in order to see it.

The message SHALL reuse the balance-aware sentences the stake inputs already show, resolved from the same source, so the two surfaces can never report different balances and no new copy is introduced:

- available balance greater than zero → `You only have {{balance}} {{currency}} left. Try a lower stake.`
- available balance of zero or less → `Balance is empty. Deposit funds to buy this contract.`

The balance SHALL be rendered at the currency's own precision (two decimal places for fiat, up to eight for crypto), and the currency SHALL be the one the balance is denominated in.

The message SHALL disappear as soon as the charge is affordable again — with no page reload, no re-opening of the stake editor, and no new price required beyond the one that already made it affordable.

#### Scenario: The inline reason names the balance

- **WHEN** the available balance is `0.77 USD` and the charge is `4.00 USD`
- **THEN** `You only have 0.77 USD left. Try a lower stake.` is shown next to the unavailable **Buy** control

#### Scenario: The empty-balance reason is distinct

- **WHEN** the available balance is `0.00 USD`
- **THEN** `Balance is empty. Deposit funds to buy this contract.` is shown instead of the "you only have" sentence

#### Scenario: Crypto precision is respected

- **WHEN** the balance is `0.00004500 BTC` and the charge is `0.00100000 BTC`
- **THEN** the message reports the balance at the currency's own precision rather than rounding it to two decimal places

#### Scenario: Lowering the stake clears the reason

- **WHEN** the message is showing and the user commits a stake whose charge is at or below the balance
- **THEN** the message is gone and **Buy** is available again

### Requirement: [BABG-004] No payout is quoted while Buy is unavailable for this reason

While the gate is active, the **Buy** control SHALL NOT display a payout, total cost, or max payout amount. Its value slot SHALL fall back to the same placeholder already used when a contract cannot be priced, so nothing on the control implies a return the user cannot obtain.

The basis label (for example `Payout`) SHALL remain, because it never depends on the price; only the amount is withheld.

#### Scenario: The quoted payout is withheld

- **WHEN** the balance is `0.77 USD`, the charge is `4.00 USD`, and the price has resolved a payout of `7.69 USD`
- **THEN** the control shows the `Payout` label with the unpriced placeholder in place of `7.69 USD`, and does not shimmer as if a price were still loading

#### Scenario: An affordable contract quotes its payout as before

- **WHEN** the balance is `20.00 USD` and the charge is `4.00 USD`
- **THEN** the payout amount is displayed exactly as it is today

### Requirement: [BABG-005] The gate stays inert whenever the comparison cannot be trusted

The gate SHALL only engage when both the available balance and the charge are readable, finite amounts. In every other state it SHALL be completely inert — **Buy** behaves exactly as it did before this capability existed, with no inline message and no withheld payout.

Inert states SHALL include at least:

- the balance is not yet known, is empty, or is not a number (an account whose balance has not loaded MUST NOT be reported as `0.00`);
- the contract has no resolved price, or its price returned an error, so no charge is known;
- the user is logged out — the existing log-in / create-account path SHALL be reached unchanged;
- an account switch is in flight, where the balance on hand may belong to the previous account.

A readable balance of zero or less is **not** an inert state: it engages the gate, per the empty-balance requirement above.

#### Scenario: An unloaded balance changes nothing

- **WHEN** the available balance is unknown (not yet loaded, empty, or non-numeric)
- **THEN** **Buy** is available or unavailable exactly as it would be without this capability, no inline message is shown, and no `0.00` balance is reported anywhere

#### Scenario: An unpriced contract changes nothing

- **WHEN** no price has resolved for the displayed contract, or its price returned an error, so the charge is unknown
- **THEN** the gate does not engage and the control keeps its existing loading / error presentation

#### Scenario: A logged-out user keeps the auth path

- **WHEN** a logged-out user presses **Buy**
- **THEN** the log-in / create-account prompt opens as it does today, and the gate plays no part

#### Scenario: An account switch suppresses the reason

- **WHEN** an account switch is in flight
- **THEN** no inline balance reason is shown, so a balance belonging to the previous account is never quoted

### Requirement: [BABG-006] The server-driven insufficient-balance path is preserved

The existing insufficient-balance error path SHALL be unchanged and SHALL remain the authority for every rejection the client cannot predict. When the balance state is reported by the price response or by a failed buy — rather than derived by the gate above — **Buy** SHALL stay pressable and pressing it SHALL open the existing insufficient-balance sheet with its existing title, message, and **Deposit now** (real account) / **OK** (virtual account) actions.

This is the deliberate division of responsibility: the gate covers what the client can prove from the balance and the current charge; the error path covers everything else, including a rejection that arrives while the balance is still unknown, a limit that is not the account balance, and a balance that changes between the last price and the buy.

#### Scenario: A price-reported balance rejection keeps today's behaviour

- **WHEN** the price response for the displayed contract carries an insufficient-balance error while the client-side balance is unknown
- **THEN** **Buy** stays pressable and pressing it opens the insufficient-balance sheet with **Deposit now**, exactly as before this change

#### Scenario: A rejected buy keeps today's behaviour

- **WHEN** a buy is rejected for insufficient balance — a balance that fell between the last price and the request
- **THEN** the same sheet is shown with the same message and actions, and the gate does not alter or replace it

### Requirement: [BABG-007] The stake is never silently capped

The committed stake SHALL NOT be reduced, clamped, or rewritten to fit the available balance. The value the user set SHALL remain exactly as they set it, and the gate SHALL make it visible instead.

Capping would rewrite a user's own input without asking, and would frequently produce a value that cannot be bought at all: a balance below the contract's minimum stake — as in the reported `0.77 USD` case — has no affordable valid stake to cap to.

#### Scenario: An unaffordable stake keeps its value

- **WHEN** the balance is `0.77 USD` and the committed stake is `4.00 USD`
- **THEN** the stake field still reads `4.00 USD`, **Buy** is unavailable with the inline reason, and nothing has been silently changed on the user's behalf

#### Scenario: A balance below the minimum stake is reported, not worked around

- **WHEN** the balance is `0.77 USD` and the contract's minimum stake is `1.00 USD`, so no affordable stake exists
- **THEN** the inline reason is shown and **Buy** stays unavailable, rather than a sub-minimum stake being substituted

### Requirement: [BABG-008] Surfaces other than the Buy control are unchanged

This capability SHALL change only the trade page's **Buy** control and its adjacent message. It SHALL NOT change the stake editor's own warning or its commit behaviour on either breakpoint, the automation **Run** control's existing balance handling, or the stake preset values offered.

In particular the desktop stake modal SHALL still commit an unaffordable stake — the Buy gate is what makes that state visible, so the modal needs no new restriction.

#### Scenario: The desktop stake modal still commits an unaffordable stake

- **WHEN** the balance is `0.77 USD` and the user commits `4.00 USD` from the desktop stake modal
- **THEN** the commit succeeds and the modal closes as before, and the trade page then shows the inline reason with **Buy** unavailable

#### Scenario: Stake presets are unchanged

- **WHEN** the balance is `0.77 USD` and the contract's stake limits admit the usual preset values
- **THEN** every preset is still offered, unfiltered by the balance
