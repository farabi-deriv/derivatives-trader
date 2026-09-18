# multipliers-commission-display Specification

## Purpose
TBD - created by archiving change display-both-commission-stop-out-level-6. Update Purpose after archive.
## Requirements
### Requirement: [MCD-001] Commission is shown alongside Stop out and Stop out level

On Multipliers, a **Commission** row SHALL be displayed on every surface that already carries the
Stop out and Stop out level rows: the information rows rendered under the desktop trade parameters,
and the stake editor details shown in the mobile Stake action sheet and in the desktop Stake popover.
Commission and Stop out level SHALL both be present — displaying one SHALL NOT be at the expense of
the other. The Commission row SHALL be rendered after the Stop out level row, leaving the existing
rows in the order and position they already have.

#### Scenario: Desktop trade-parameters information rows

- **WHEN** a desktop trader is on the Multipliers trade page with a priced proposal
- **THEN** the information rows under the trade parameters show a Stop out row, a Stop out level row
  and a Commission row
- **AND** the Commission row is the last of the three

#### Scenario: Mobile Stake action sheet

- **WHEN** a mobile trader on Multipliers opens the Stake action sheet
- **THEN** the sheet's details list shows a Stop out row, a Stop out level row and a Commission row

#### Scenario: Desktop Stake popover

- **WHEN** a desktop trader on Multipliers opens the Stake popover
- **THEN** its details list shows a Stop out row, a Stop out level row and a Commission row

#### Scenario: Mobile trade page has no separate Commission row

- **WHEN** a mobile trader is on the Multipliers trade page
- **THEN** no Commission information row is rendered below the trade parameters, because the
  information rows are desktop-only
- **AND** the Commission row is reachable from the Stake action sheet

### Requirement: [MCD-002] The commission value comes from the priced proposal

The Commission figure SHALL be taken from the `commission` field of the Multipliers price proposal.
The value is the same for the Up and the Down direction, so either side's proposal SHALL be
acceptable: when the side the trader is on has not priced yet, the other side's commission SHALL be
used rather than showing nothing. No additional API request SHALL be made to obtain it.

#### Scenario: Commission read from the selected side

- **WHEN** the trader is on the Up side and its proposal carries a commission
- **THEN** the Commission row shows that value

#### Scenario: Falls back to the other direction

- **WHEN** the side the trader is on has not priced yet but the opposite side's proposal carries a
  commission
- **THEN** the Commission row shows the opposite side's value

#### Scenario: No extra request is issued

- **WHEN** the Commission row is rendered on any surface
- **THEN** it is fed by proposals the surface already receives, and no commission-specific request is
  sent

### Requirement: [MCD-003] Commission is formatted as a currency amount

The Commission figure is a money amount and SHALL be displayed as a positive, currency-formatted
value prefixed with the account's currency symbol, in the same form the Stop out amount uses on the
same surface. It SHALL NOT be rendered as a bare number, and SHALL NOT be shown negative.

#### Scenario: Commission carries the currency symbol

- **WHEN** the surface shows a commission of 0.35 on a USD account
- **THEN** the Commission row reads `$0.35`

#### Scenario: Stop out level is unaffected

- **WHEN** the Commission row is shown next to the Stop out level row
- **THEN** the Stop out level is still rendered as a bare price with no currency symbol and no
  currency code

### Requirement: [MCD-004] A placeholder is shown while no commission is priced

The Commission row SHALL remain rendered whenever no commission is available — no proposal has
arrived, the stake input is empty, or the drafted stake produced no priced proposal — showing the
placeholder its surface already uses for an unknown value: a skeleton in the trade-parameters
information rows, and `-` in the stake editor details. The row's visibility SHALL NOT depend on
whether its value is known.

#### Scenario: No proposal yet on the information rows

- **WHEN** the desktop information rows are rendered for Multipliers before any proposal has priced
- **THEN** the Commission row is visible showing a skeleton, alongside the Stop out and Stop out
  level skeletons

#### Scenario: Empty stake input

- **WHEN** a trader clears the stake input in the stake editor
- **THEN** the Commission row remains visible showing `-`

#### Scenario: Drafted stake produces no priced proposal

- **WHEN** a trader drafts a stake for which no priced proposal is returned
- **THEN** the Commission row remains visible showing `-` rather than disappearing

### Requirement: [MCD-005] The Commission label opens its explanation

The Commission label SHALL be operable and SHALL reveal how the commission was arrived at: the live
formula `<percentage>% of (<stake> × <multiplier>)`, using the current stake and multiplier. Desktop
SHALL reveal it on hover; mobile SHALL reveal it on activation. In the trade-parameters information
rows the mobile reveal SHALL use the same action sheet the Stop out explanation uses. In the mobile
Stake action sheet the reveal SHALL be a page within the sheet's carousel titled `Commission`,
reached by tapping the label and left by the header's back navigation, exactly as the Stop out and
Stop out level explanations are; that page SHALL show a sentence naming the percentage alongside the
formula. In the desktop Stake popover the label SHALL reveal the formula on hover — unlike the plain
Stop out and Stop out level labels beside it, because the formula is the reason the commission figure
is intelligible.

#### Scenario: Desktop information-row tooltip

- **WHEN** a desktop trader hovers the Commission label in the trade-parameters information rows
- **THEN** the commission formula is shown, naming the derived percentage

#### Scenario: Mobile information-row explanation

- **WHEN** a mobile-width viewport renders the Commission label in the information rows and the
  trader taps it
- **THEN** the commission formula is shown in the same action sheet the Stop out explanation uses
- **AND** dismissing it returns the trader to the trade page

#### Scenario: Mobile stake sheet explanation page

- **WHEN** a mobile trader opens the Stake action sheet and taps the Commission label
- **THEN** the sheet navigates to a Commission explanation page titled `Commission`
- **AND** the page states that commission is calculated as the derived percentage of the stake
  multiplied by the multiplier, and shows the formula
- **AND** the trader can navigate back to the stake input from it

#### Scenario: Desktop Stake popover reveals the formula on hover

- **WHEN** a desktop trader opens the Stake popover on Multipliers and hovers the Commission label
- **THEN** the commission formula is shown
- **AND** no in-surface explanation page is opened

#### Scenario: Label is inert while the market is closed

- **WHEN** the market is closed and the trader activates the Commission label in the information rows
- **THEN** no explanation is opened, matching the Stop out label's behaviour in that state

### Requirement: [MCD-009] The commission percentage is derived, and the label falls back when it cannot be

The percentage shown in the formula SHALL be derived as `(commission × 100) / (multiplier × stake)`,
expressed to four decimal places. The stake in that divisor SHALL be the base stake amount, NOT the
proposal's ask price, which already bundles commission and any deal-cancellation fee. On a surface
where the commission figure re-prices with a stake being drafted, the stake used in the divisor SHALL
be that same drafted stake, so the percentage never mixes one stake's commission with another
stake's amount.

When the percentage cannot be derived — no commission, or a zero or non-finite divisor — the
Commission label SHALL be rendered as plain, non-interactive text with no reveal affordance, and no
formula, tooltip or explanation page SHALL be reachable from it. The Commission **value** row SHALL
still be rendered in that state, per [MCD-004].

#### Scenario: Percentage derived to four decimal places

- **WHEN** the commission is 0.5 on a multiplier of 100 and a stake of 10
- **THEN** the formula shows `0.0500%`

#### Scenario: Derived from the drafted stake, not the committed one

- **WHEN** a trader whose committed stake is 10 drafts a stake of 100 in the stake editor and it
  prices
- **THEN** the percentage is derived from the drafted stake of 100 and the commission priced for it
- **AND** it does not change merely because the drafted stake differs from the committed one

#### Scenario: Zero commission is still a percentage

- **WHEN** the priced commission is 0 with a non-zero multiplier and stake
- **THEN** the formula shows `0.0000%` rather than being suppressed

#### Scenario: Label is plain when the percentage cannot be derived

- **WHEN** no commission has been priced, or the multiplier or stake is zero
- **THEN** the Commission label is plain text carrying no underline, hover reveal, tap reveal or
  explanation page
- **AND** the Commission value row is still rendered with its placeholder

### Requirement: [MCD-006] Commission in the stake editor tracks the stake being drafted

The commission scales with the stake, so in the stake editor the Commission figure SHALL follow the
stake currently being drafted in that editor — not the committed stake — and SHALL be refreshed from
each proposal response the editor receives. When a drafted stake fails to price, the Commission
figure SHALL be reset alongside the Stop out figure so a stale amount is never attributed to the new
stake.

#### Scenario: Amount follows the drafted stake

- **WHEN** a trader changes the stake in the stake editor to a value that prices successfully
- **THEN** the Commission row shows the commission for the newly drafted stake, not for the
  previously committed one

#### Scenario: Seeded from the committed proposal on open

- **WHEN** the stake editor is opened before the trader has changed anything
- **THEN** the Commission row already shows the commission from the trade page's current proposal

#### Scenario: Reset when a drafted stake fails to price

- **WHEN** a drafted stake returns no proposal
- **THEN** the Commission row falls back to its placeholder instead of keeping the previous stake's
  commission

### Requirement: [MCD-007] The Commission row belongs to Multipliers only

The Commission row SHALL be shown only for Multipliers. Trade types whose stake editor shows payout
details, and other non-multiplier trade types, SHALL show no Commission row. On a Multipliers
proposal error the Commission row SHALL be suppressed together with the rest of the information-rows
block, exactly as the Stop out rows already are, and while the market is closed it SHALL carry the
same disabled styling as its siblings.

#### Scenario: Non-multiplier trade type

- **WHEN** the stake editor is opened for a trade type that is not Multipliers
- **THEN** no Commission row is rendered

#### Scenario: Payout details are shown instead

- **WHEN** the stake editor is opened for a trade type whose stake details are payout figures
- **THEN** the payout rows are shown and no Commission row is rendered

#### Scenario: Proposal error suppresses the block

- **WHEN** the Multipliers proposal returns an error
- **THEN** the information rows render nothing at all, including no Commission row

### Requirement: [MCD-008] Adding Commission changes nothing else

Introducing the Commission row SHALL NOT alter any other behaviour of the surfaces it joins: the
Stop out and Stop out level rows keep their sources, formats, placeholders and explanations; the
stake input and its decimal handling, the quick-pick chips, the range hint, validation and
balance-aware messages and their precedence, the mobile header save gating, the desktop footer save,
discard-on-dismiss, and the analytics emitted on commit all remain as they are.

#### Scenario: Stop out rows are untouched

- **WHEN** any surface that gained the Commission row is rendered
- **THEN** the Stop out row still shows the currency-formatted loss amount and the Stop out level row
  still shows the bare live price, with the same placeholders as before

#### Scenario: Committing a stake is unaffected

- **WHEN** a trader opens the stake editor, changes the stake to a valid affordable amount, and saves
- **THEN** the stake is committed exactly as it was before this change and the surface closes

#### Scenario: Save gating is unaffected

- **WHEN** a mobile trader opens the Stake action sheet and has not yet changed the stake
- **THEN** the header save action is disabled, and becomes enabled once the drafted stake differs
  from the committed stake and has validated

