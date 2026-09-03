# multipliers-stop-out-info Specification

## Purpose

TBD - created by archiving change multipliers-stop-out-is-missing-on-stake-sheet-after-setting-stop-loss. Update Purpose after archive.

## Requirements

### Requirement: Stop out stays visible when Stop loss is set

On Multipliers, the Stop out figure SHALL be shown on the Stake surface whenever the multiplier information rows are shown, irrespective of whether Stop loss is enabled and irrespective of the Stop loss amount. Stop out is the platform's own liquidation point, derived from the stake and the multiplier; Stop loss is an additional trader-chosen limit that may sit anywhere at or inside it. Enabling one SHALL NOT hide the other, because a trader reasoning about their loss needs both numbers.

The same SHALL hold for Take profit: enabling Take profit, Stop loss, both, or Deal cancellation SHALL have no effect on whether Stop out or Stop out level is displayed.

#### Scenario: Stop out remains after enabling Stop loss

- **WHEN** a mobile trader on Multipliers enables Stop loss with a valid amount and then opens the Stake action sheet
- **THEN** the Stake sheet shows a Stop out row with the stop out amount
- **AND** it also shows the Stop out level row with the stop out price

#### Scenario: Stop out is present with no Stop loss

- **WHEN** a mobile trader on Multipliers with no Stop loss set opens the Stake action sheet
- **THEN** the Stake sheet shows the Stop out and Stop out level rows
- **AND** they are the same rows, in the same order and format, as when Stop loss is set

#### Scenario: Other risk-management settings do not hide the rows

- **WHEN** a Multipliers trader has Take profit enabled, or Deal cancellation enabled, or Take profit and Stop loss enabled together, and opens the Stake surface
- **THEN** both the Stop out and Stop out level rows are shown in every one of those states

#### Scenario: Desktop Stake popover matches

- **WHEN** a desktop trader on Multipliers with Stop loss set opens the Stake popover and switches to its amount input
- **THEN** the popover shows the Stop out and Stop out level rows
- **AND** the Stop out row is not suppressed by the presence of Stop loss

### Requirement: Mobile shows Stop out only on the Stake surface

On a mobile viewport the Stop out and Stop out level rows SHALL be reachable from the Stake action sheet, because the below-parameters information rows that carry them on desktop are not rendered on mobile. No Multipliers state SHALL leave a mobile trader with no way to see the stop out before buying.

#### Scenario: Mobile has no other stop out row to fall back on

- **WHEN** a mobile trader is on the Multipliers trade page with Stop loss set
- **THEN** the trade page itself shows no separate Stop out information row below the trade parameters
- **AND** opening the Stake action sheet shows the Stop out and Stop out level rows there

#### Scenario: Desktop keeps its below-parameters row too

- **WHEN** a desktop trader is on the Multipliers trade page with Stop loss set
- **THEN** the below-parameters Stop out and Stop out level rows remain displayed on the page as before
- **AND** they show the same figures as the Stake popover

### Requirement: The Stop out label opens its explanation

The Stop out label on the mobile Stake action sheet SHALL be operable and SHALL open an explanation of what stop out means, expressed as the percentage of the stake at which the contract closes automatically when that percentage can be derived from the current pricing, and as a generic sentence when it cannot. The Stop out level label SHALL likewise open its own explanation. On desktop these labels are plain, non-interactive text within the Stake surface.

#### Scenario: Explanation reachable while Stop loss is set

- **WHEN** a mobile trader with Stop loss set opens the Stake action sheet and taps the Stop out label
- **THEN** the Stop out explanation is shown, stating the percentage of the stake at which the contract closes automatically
- **AND** the trader can navigate back to the stake input from it

#### Scenario: Stop out level explanation reachable

- **WHEN** a mobile trader opens the Stake action sheet and taps the Stop out level label
- **THEN** the Stop out level explanation is shown, describing it as the price at which the position closes automatically

#### Scenario: Generic wording when the percentage is unknown

- **WHEN** the Stop out explanation is opened while no stop out amount or stake is available to derive a percentage from
- **THEN** the explanation is shown without a percentage, stating that the contract closes automatically when the loss reaches a certain percentage of the stake

#### Scenario: Labels are plain text on desktop

- **WHEN** a desktop trader opens the Stake popover's amount input on Multipliers
- **THEN** the Stop out and Stop out level labels are rendered as plain text and do not open an in-surface explanation page

### Requirement: Stop out and Stop out level are formatted distinctly

The Stop out figure is a loss amount and SHALL be displayed as a positive, currency-formatted amount prefixed with the account's currency symbol, even though the underlying value is negative. The Stop out level is a price, not an amount, and SHALL be displayed without any currency symbol or currency code.

#### Scenario: Stop out amount carries the currency symbol

- **WHEN** the Stake surface shows a stop out whose underlying value is a loss of 10.00 in USD
- **THEN** the Stop out row reads `$10.00`
- **AND** it is not shown as a negative number

#### Scenario: Stop out level carries no currency

- **WHEN** the Stake surface shows a stop out level of `8160.12`
- **THEN** the Stop out level row reads `8160.12`
- **AND** it is not prefixed with a currency symbol nor suffixed with a currency code

### Requirement: A placeholder is shown when a value is not available

When a stop out amount or stop out level is not available — the stake input is empty, the drafted stake has produced no priced proposal, or no pricing has arrived yet — the row SHALL remain rendered showing a `-` placeholder. The row's visibility SHALL NOT depend on whether its value is known: a missing value is communicated by the placeholder, never by removing the row.

#### Scenario: Empty stake input

- **WHEN** a trader clears the stake input on the Stake surface for Multipliers
- **THEN** the Stop out and Stop out level rows remain visible showing `-`

#### Scenario: No stop out level yet

- **WHEN** the Stake surface is shown for Multipliers before any stop out level has been priced
- **THEN** the Stop out level row is visible showing `-`

#### Scenario: Drafted stake produces no priced proposal

- **WHEN** a trader with Stop loss set drafts a stake for which no priced proposal is returned
- **THEN** the Stop out row remains visible showing `-` rather than disappearing

### Requirement: The stop out level tracks the live price

The Stop out level shown on the Stake surface SHALL reflect the currently priced level rather than freezing at the value that happened to be current when the surface was opened, since the level moves with the spot. The Stop out amount by contrast SHALL follow the stake being drafted in the surface, so a trader sees the stop out that the drafted stake would produce.

#### Scenario: Level updates while the surface is open

- **WHEN** the Stake surface is open on Multipliers and a newer stop out level is priced
- **THEN** the Stop out level row shows the newer value
- **AND** it no longer shows the value it opened with

#### Scenario: Amount follows the drafted stake

- **WHEN** a trader changes the stake in the Stake surface to a value that prices successfully
- **THEN** the Stop out row shows the stop out amount for the newly drafted stake, not for the previously committed one

### Requirement: The rows belong to Multipliers only

The Stop out and Stop out level rows SHALL be shown only for Multipliers. Trade types that display payout details on the Stake surface, and other non-multiplier trade types, SHALL show neither row.

#### Scenario: Non-multiplier trade type

- **WHEN** the Stake surface is opened for a trade type that is not Multipliers
- **THEN** neither a Stop out row nor a Stop out level row is rendered

#### Scenario: Payout details are shown instead

- **WHEN** the Stake surface is opened for a trade type whose stake details are payout figures
- **THEN** the payout rows are shown and the Stop out and Stop out level rows are not

### Requirement: Restoring the row changes nothing else about the Stake surface

Making Stop out visible with Stop loss set SHALL NOT alter any other Stake behaviour: the stake input and its decimal handling, the quick-pick chips and their derivation from the market limits, the range hint, validation and balance-aware messages and their precedence, the header save gating on mobile and the footer save on desktop, discard-on-dismiss, and the analytics emitted on commit all remain as they are.

#### Scenario: Committing a stake is unaffected

- **WHEN** a trader with Stop loss set opens the Stake surface, changes the stake to a valid affordable amount, and saves
- **THEN** the stake is committed exactly as it was before this change and the surface closes

#### Scenario: Save gating is unaffected

- **WHEN** a trader with Stop loss set opens the mobile Stake action sheet and has not yet changed the stake
- **THEN** the header save action is disabled
- **AND** it becomes enabled once the drafted stake differs from the committed stake and has validated

#### Scenario: Validation messages are unaffected

- **WHEN** a trader with Stop loss set drafts a stake that is rejected, or that exceeds the available balance
- **THEN** the same message is shown under the stake input as before this change, with the same precedence between messages
