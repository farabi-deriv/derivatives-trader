## Purpose

Defines how the default stake and the stake quick picks are derived from the market's minimum stake, so a user entering any market on any trade type is never presented with a stake below that market's minimum, and never sees a stake error on a fresh load.

The bug was reported against Vanillas on Volatility 75 and Volatility 50 (1s), but the ordering gap that causes it is not a Vanillas property: `min_stake` is absent from `contracts_for` and arrives only on a pricing result, on every trade type. Turbos on the 1s volatility indices has the same shape and was previously papered over with a hardcoded per-symbol table. The rules below therefore apply to every trade type, which also removes the desktop/mobile and Vanillas/non-Vanillas divergences that the narrower fix would have left behind.

## ADDED Requirements

### Requirement: The default stake is never below the market minimum

For every market, trade type and sub-type, the stake presented to the user SHALL be greater than or equal to the minimum stake the market accepts for that combination. The value SHALL be resolved at runtime from the applicable market limits; it MUST NOT come from a per-symbol table of hardcoded stake values.

This applies to every market and every trade type, not only Vanillas and not only Volatility 25 (1s) and Volatility 50 (1s).

#### Scenario: A market whose minimum is above the account default

- **WHEN** a user selects a market whose minimum stake is above the account default stake — for example Vanillas on Volatility 25 (1s), or Turbos on Volatility 25 (1s)
- **THEN** the stake shown is at or above that market's minimum stake
- **AND** it is not the account default of USD 2

#### Scenario: A market whose minimum is at or below the account default

- **WHEN** a user selects a market whose minimum stake is at or below the account default stake
- **THEN** the stake shown remains the account default (unchanged from before this change)

#### Scenario: No hardcoded per-symbol stake values are introduced

- **WHEN** the derived stake for a market is inspected
- **THEN** it is a function of the minimum stake reported for that market and sub-type
- **AND** no symbol-keyed table of literal stake values contributes to it

### Requirement: The default stake is rounded up to a round value

The default stake SHALL be the market minimum rounded **up** to the next round value, so the user is never shown an awkward fraction as their starting stake. Rounding SHALL scale with the magnitude of the minimum and SHALL never round _down_ below the minimum.

Where the account default stake already exceeds the rounded minimum, the account default SHALL be kept, so markets that are already valid today are not changed.

#### Scenario: A fractional minimum yields a nearby round default

- **WHEN** the resolved minimum stake for a market is `6.5`
- **THEN** the default stake is `8`
- **AND** it is not a value far above the minimum, such as `10` or more

#### Scenario: A fractional minimum rounds up, never down

- **WHEN** the resolved minimum stake is a fractional value such as `34.06`
- **THEN** the default stake is a round value strictly greater than `34.06` — `40`
- **AND** it is never a value below the minimum

#### Scenario: Rounding stays near the minimum

- **WHEN** any market minimum is rounded up to a default stake
- **THEN** the result is close to the minimum rather than approaching double it
- **AND** a minimum that is already a round value is kept exactly, as `25` is

#### Scenario: An already-round minimum is left alone

- **WHEN** the resolved minimum stake is already a round value at or below the account default
- **THEN** the default stake is the account default and no rounding-up is applied on top of it

#### Scenario: A narrow stake band falls back to the raw minimum

- **WHEN** rounding the minimum up would produce a value above the market's maximum stake
- **THEN** the raw minimum is used as the default stake, because it is the only value guaranteed to sit inside the band

### Requirement: Stake quick picks start at the default stake and ascend

The stake quick picks (value chips) offered for a market SHALL begin at the derived default stake and ascend from there. Every offered quick pick SHALL be greater than or equal to the market minimum and less than or equal to the market maximum. Quick-pick values SHALL be round values.

This SHALL hold on every trade type. A curated preset set is not a licence to offer a stake the market would reject: where a curated value falls below the active market's minimum, it SHALL NOT be offered.

#### Scenario: The first quick pick is the default stake

- **WHEN** the derived default stake for a market is `10`
- **THEN** the first stake quick pick offered is `10`
- **AND** every subsequent quick pick is larger than the one before it

#### Scenario: The default stake is never above the lowest quick pick

- **WHEN** the stake shown on entering any market is compared with the quick picks offered for that market
- **THEN** the stake is exactly the lowest quick pick offered
- **AND** it is never a larger quick pick, and never a value the quick picks do not offer at all

#### Scenario: No quick pick is below the market minimum

- **WHEN** a market's minimum stake invalidates the lower values of the shared quick-pick set for its trade type
- **THEN** none of those below-minimum values is offered as a quick pick

#### Scenario: A curated preset below the market minimum is dropped

- **WHEN** a trade type with a curated preset set — such as Turbos — is opened on a market whose minimum invalidates the lowest curated values
- **THEN** those curated values are not offered
- **AND** the row leads with the derived default for that market instead

#### Scenario: No quick pick is above the market maximum

- **WHEN** a market reports a maximum stake
- **THEN** no quick pick above that maximum is offered

#### Scenario: Selecting any offered quick pick is accepted

- **WHEN** a user taps or clicks any quick pick offered for a market
- **THEN** the resulting stake is accepted without a below-minimum stake error

### Requirement: The quick-pick row is always six wide

Six quick picks SHALL be offered for every market, so the row is the same width everywhere. Where a market's minimum invalidates the lower shared quick picks, the row SHALL be topped up from above with higher values, so raising the floor never leaves a short row. The market maximum SHALL still take precedence: where the market's stake range has no room for six ascending values, only the values inside the range are offered.

#### Scenario: A high minimum still offers a full row

- **WHEN** a market's minimum invalidates the lower values of the shared quick-pick set
- **THEN** six quick picks are still offered
- **AND** each is larger than the one before it

#### Scenario: The row is the same width on every market

- **WHEN** a user compares the quick picks offered on markets with different minimum stakes
- **THEN** each market offers the same number of quick picks
- **AND** no market offers a visibly shorter row than another

#### Scenario: The market maximum outranks the row width

- **WHEN** a market's maximum stake leaves no room for six ascending quick picks above its minimum
- **THEN** only the quick picks inside the market's stake range are offered
- **AND** no quick pick above the maximum is added to fill the row

### Requirement: The quick picks are offered once, complete

Every quick pick is derived from the limits of the market being traded, and those limits are not known until that market has been priced. Until they are known, no quick pick SHALL be offered — not the shared preset set unfiltered, and not a ladder built on any other number, in particular not the raw market minimum, which is not the value the platform applies. When the limits arrive, the whole ladder SHALL appear in a single step.

While the wait lasts, a loading placeholder SHALL hold the quick-pick row's place, so the wait reads as loading rather than as the quick picks having gone missing, and the row does not resize under the user when the real quick picks arrive. The placeholder SHALL NOT be selectable.

The limits SHALL be resolved from the market's first pricing result that reports them, including when that result is absorbed to correct the stake and never becomes visible, so the wait is never longer than the market takes to be priced once.

#### Scenario: Nothing is offered before the market has been priced

- **WHEN** a user opens the stake quick picks on a market whose limits are not yet known — for example straight after switching market
- **THEN** no quick pick is offered
- **AND** the shared preset set is not offered unfiltered in the meantime

#### Scenario: A loading placeholder holds the row's place

- **WHEN** a user opens the stake quick picks on a market whose limits are not yet known
- **THEN** a loading placeholder is shown where the quick picks will appear
- **AND** nothing in it can be selected
- **AND** it is replaced by the quick picks, in the same place, once the limits arrive

#### Scenario: The stake text box is not editable while the quick picks load

- **WHEN** the mobile stake sheet is open while the market's limits are still being resolved
- **THEN** the stake text box is disabled
- **AND** it becomes editable when the quick picks arrive

#### Scenario: The stake text box defaults to the minimum quick pick when the ladder lands

- **WHEN** the market's limits arrive while the mobile stake sheet is open
- **THEN** the stake text box is filled with the minimum quick pick — the stake the platform settles on
- **AND** a stake the user types after that is never overwritten

#### Scenario: The ladder appears in one step

- **WHEN** the selected market's limits arrive
- **THEN** the whole ladder derived for that market appears at once
- **AND** no quick pick shown before it is replaced by a different value

#### Scenario: The raw minimum is never offered as a quick pick

- **WHEN** the derived default stake for a market is `10` because the market minimum is `8`
- **THEN** `8` is never offered as a quick pick, at any point during a market switch

#### Scenario: The limits are not waited for twice

- **WHEN** the first pricing result for a market is absorbed to correct the stake, so it never becomes visible
- **THEN** the quick picks for that market are offered from the limits that result reported
- **AND** they do not wait for the re-priced result that follows it

### Requirement: Desktop and mobile show the same quick picks

For the same market, trade type, sub-type and currency, the stake quick picks SHALL be identical on the desktop stake popover and the mobile stake sheet. Both surfaces SHALL apply the market's stake limits; neither SHALL show an unfiltered set. Both SHALL read the floor and the cap from a single derived source, so the two cannot drift apart or be a round trip out of step with each other.

#### Scenario: The two surfaces agree

- **WHEN** the same market and sub-type is open on desktop and on mobile
- **THEN** both surfaces offer the same ordered list of stake quick picks

#### Scenario: The desktop surface respects the market limits

- **WHEN** a market whose minimum invalidates the lower shared quick picks is opened on desktop
- **THEN** the desktop quick picks exclude those below-minimum values, exactly as the mobile quick picks do

### Requirement: No stake error is shown on a fresh load

Entering a market SHALL NOT surface a stake validation or pricing error caused by the platform's own initial stake choice. Because the market minimum only becomes known after the market has been priced once, the platform SHALL resolve the minimum, correct the stake and re-price **before** allowing that first result to become user-visible state.

The stake field SHALL NOT be shown in an error state, and no stake error message or error notification SHALL be raised, for a stake the user did not choose. This SHALL hold on every trade type.

#### Scenario: A market whose minimum rejects the initial stake

- **WHEN** a user enters a market whose minimum stake is above the account default, so the platform's initial priced stake is rejected
- **THEN** no stake error message, error styling or error notification is shown to the user
- **AND** the stake settles on the derived default for that market

#### Scenario: The correction applies on trade types other than Vanillas

- **WHEN** the market's first pricing result on Turbos, Rise/Fall or Multipliers reports a minimum above the stake the platform chose
- **THEN** the stake is corrected to the derived default and re-priced
- **AND** the rejected result never reaches the user as an error

#### Scenario: A stake error the user caused is still shown

- **WHEN** a user manually enters a stake below the market minimum or above the market maximum
- **THEN** the stake error is shown as it is today

### Requirement: A reported minimum is recorded even without a maximum

A market reports its stake limits only when it prices a contract, and a rejection commonly reports the minimum that rejected the stake without reporting any maximum. The minimum SHALL be recorded whenever it is reported, whether or not a maximum accompanies it: the minimum is what the default stake and the quick-pick floor are derived from, while the maximum only limits the top of the ladder.

Where a maximum has already been reported for the same contract type, it SHALL be retained when a later minimum-only report arrives, so a fully known band is never reduced to a partial one.

#### Scenario: A rejection that reports only a minimum

- **WHEN** a market rejects the platform's initial stake and reports only a minimum stake, with no maximum
- **THEN** that minimum is recorded for the market
- **AND** the default stake and the quick picks are derived from it
- **AND** the quick picks are shown rather than left in their loading state

#### Scenario: The corrected stake is always priced

- **WHEN** the platform corrects its own stake after a market reports its limits
- **THEN** the corrected stake is priced again
- **AND** no error raised against the stake it replaced is left standing to prevent that

#### Scenario: A market opened in a new tab beside an existing one

- **WHEN** a user opens a market in a new tab while another tab is already open and priced
- **THEN** the new tab's quick picks resolve from its own market's limits
- **AND** the tab it was opened beside keeps its own quick picks, rather than either tab losing them to the other

#### Scenario: Returning to a tab that was already priced

- **WHEN** a user returns to a tab whose market was priced earlier in the session
- **THEN** its quick picks are shown from the limits already known for that market
- **AND** they do not disappear while the tab is priced again

#### Scenario: A trade type that prices several sub-types at once

- **WHEN** a trade type prices more than one sub-type together — such as Turbos pricing Up and Down — and the sub-type the user has NOT selected is the first to report the market's limits
- **THEN** the quick picks for the selected sub-type still resolve from those limits
- **AND** they do not wait for the selected sub-type's own response before appearing

#### Scenario: The first pricing request is never sent missing a required value

- **WHEN** a trade type requires a contract value on every pricing request — as Turbos requires a payout per point — and the market is being priced for the first time
- **THEN** that value is taken from the contract information already loaded for the market before the first request is sent
- **AND** the request is not sent in a form whose rejection reports neither the limits nor the valid values, since nothing can recover from such a rejection

#### Scenario: Contract values carried alongside the limits are not lost

- **WHEN** the response the platform withholds also carries values describing the contract itself, such as the payout-per-point choices a Turbos market offers or the strikes a Vanillas market offers
- **THEN** those values are applied before the stake is priced again
- **AND** the market is able to price, rather than being left unable to quote because a value it requires was never set

#### Scenario: A rejection that reports the minimum only in its message arguments

- **WHEN** a market rejects the stake with a response whose structured details name only the failing field, carrying the minimum solely in the message's fill-in arguments
- **THEN** that minimum is still recorded
- **AND** the default stake and the quick picks update from it, whatever the trade type

#### Scenario: A rejection that also carries a pricing result

- **WHEN** a market rejects the stake and reports its limits alongside a pricing result in the same response
- **THEN** the reported minimum is still recorded
- **AND** the quick picks resolve from it, rather than the response being treated as carrying no limits

#### Scenario: A previously reported maximum survives a partial report

- **WHEN** a maximum has already been reported for a contract type and a later response reports only a minimum
- **THEN** the previously reported maximum is retained
- **AND** the quick picks stay capped by it

### Requirement: The platform's own probing stake never strands the trade panel

The response to the platform's first stake for a market SHALL NOT be allowed to leave the user with a stake they cannot act on. Because the market is probed only once per market and sub-type, a rejection allowed through on that single attempt would leave the rejected stake on screen with no further attempt to replace it.

Where that first response is a rejection, it SHALL be withheld from the user and the stake re-priced, whether or not the stake itself needed correcting. Only that first response is treated this way; any later rejection SHALL be shown as normal.

#### Scenario: A rejection that needs no stake correction

- **WHEN** the market's first response for a market rejects the platform's stake but the stake already matches the derived default
- **THEN** no error is shown for it
- **AND** the stake is priced again so the user is shown a real result

#### Scenario: The trade panel is never left unusable

- **WHEN** a user opens any market
- **THEN** they are never left with the platform's own stake shown as an error with no way to proceed
- **AND** the purchase action becomes available once the market has been priced

### Requirement: The stake is re-derived on every entry into a market

The default stake and quick picks SHALL be re-resolved whenever a market becomes active, not only on first load. A stake left over from a previously selected market or sub-type SHALL NOT be retained — not when it is below the newly active market's minimum, and not when it is above that market's lowest quick pick either. Because the minimum can differ between sub-types on the same market, resolution SHALL be per market **and** per sub-type.

#### Scenario: A stake carried in from a higher-minimum market

- **WHEN** a user leaves a market with a high minimum — where the stake, or a quick pick they tapped there, is well above the next market's minimum — and enters another market
- **THEN** the stake shown is the entered market's own lowest quick pick
- **AND** the stake from the previous market is not retained, even though that market's minimum would have accepted it

#### Scenario: Switching between sub-types

- **WHEN** a user switches between two sub-types of the same trade type — Vanilla Call and Vanilla Put, or Turbos Up and Down — on a market where the two have different minimum stakes
- **THEN** the stake shown is at or above the minimum of the newly selected sub-type
- **AND** no stake error is shown

#### Scenario: Switching market while staying on the same trade type

- **WHEN** a user switches from one market to another — including to Volatility 25 (1s) or Volatility 50 (1s)
- **THEN** the stake shown is at or above the newly selected market's minimum
- **AND** the quick picks are those derived for the newly selected market, not the previous one

#### Scenario: Entering a trade type from another trade type

- **WHEN** a user switches into a trade type from another one on a market whose minimum for the entered trade type is above the current stake
- **THEN** the stake shown is at or above that market's minimum for the entered trade type

#### Scenario: Navigating away and back

- **WHEN** a user navigates to another tab or page and returns to a market
- **THEN** the stake shown is still at or above that market's minimum
- **AND** no stake error is shown on return

#### Scenario: A stake the user chose above the minimum is not overwritten

- **WHEN** a user has set a stake above the market minimum and the same market and sub-type remain active
- **THEN** that stake is not replaced by the derived default

#### Scenario: A stake the user typed before the market was first priced

- **WHEN** a user changes the stake on a freshly entered market before that market's first pricing result arrives
- **THEN** the stake they typed is kept, not replaced by the derived default
- **AND** if it is below the market minimum, the stake error is shown as their own

### Requirement: The trade parameters show a loading state until the open market's contract information is loaded

Every trade parameter's own value is derived from the contract information (`contracts_for`) the market switch reloads — durations, barriers, the default stake, the payout choices. Until that information has been applied, the parameters row SHALL show a loading placeholder in place of the parameters that render as a chip, rather than values carried over from the market the user just left. The row SHALL NOT wait longer than that — in particular not for the market's first price, which the parameters' values do not depend on.

The placeholder SHALL occupy the same slot as the parameter it stands in for — the same height and the same corner radius as the chip — so the row does not resize or change shape when the values land; only the content changes. It SHALL NOT be selectable.

Because the contract information covers every trade type of a market, switching trade type or sub-type within the open market SHALL NOT return the row to a loading state. The loading state SHALL end whenever the market's contract information arrives — including for closed markets — so the row is never stranded.

#### Scenario: Opening a market whose contract information is not yet loaded

- **WHEN** a user opens a market whose contract information has not yet been applied
- **THEN** the trade parameters that render as a chip show a loading placeholder
- **AND** no value from the previously open market is shown in their place

#### Scenario: The row resolves when the contract information arrives, not the first price

- **WHEN** the market's contract information has been applied but its first price is still in flight
- **THEN** the trade parameters show their values
- **AND** only the price-derived surfaces (the purchase action, the stake quick picks awaiting their limits) keep waiting

#### Scenario: The row does not resize or change shape when the values land

- **WHEN** the contract information arrives and the real trade parameters replace the placeholders
- **THEN** the row's height is unchanged
- **AND** each placeholder had the same corner radius as the parameter that replaced it

#### Scenario: Switching trade type or sub-type does not reload the row

- **WHEN** a user switches trade type or sub-type within the open market — Allow equals, Up/Down, Call/Put, or another trade-type tab
- **THEN** the trade parameters continue to show their values
- **AND** the row does not return to a loading state

#### Scenario: A closed market ends the loading state

- **WHEN** a user opens a closed market
- **THEN** the loading placeholders are replaced once its contract information arrives
- **AND** the row is not left in a loading state indefinitely

### Requirement: The purchase action waits for a price of its own

Buying requires a price, which only exists once the market's first pricing result for the selected contract has arrived. The purchase action SHALL be unavailable while the contract has neither a price nor an error, and SHALL derive that wait from the contract's own pricing state rather than from the parameters row's loading state, which ends earlier.

#### Scenario: No price yet

- **WHEN** the trade parameters have loaded but the selected contract's first pricing result has not arrived
- **THEN** the purchase action is unavailable
- **AND** it becomes available when the price arrives

#### Scenario: A rejection the user must act on keeps the action available where it does today

- **WHEN** the pricing result is a rejection the platform deliberately lets the user act on, such as insufficient balance
- **THEN** the purchase action's behaviour is unchanged from today

### Requirement: The stake derivation is uniform across trade types

The stake derivation SHALL be implemented once and applied to every trade type, rather than gated to one. There SHALL NOT be a trade type for which the platform knowingly offers a quick pick below the active market's minimum, nor one on which the platform's own initial stake surfaces as the user's error.

Curated per-symbol stake tables SHALL NOT exist. The table that previously supplied hand-written stake values for the high-minimum markets SHALL be removed, along with the ability to look one up, so a market's ladder can only come from its own reported limits. The shared base preset set per trade type remains, as the shape a ladder starts from.

#### Scenario: A high-minimum market on any trade type is handled the same way

- **WHEN** a market's minimum exceeds the account default on Vanillas, on Turbos, or on any other trade type
- **THEN** the same derived default and the same quick-pick ladder rules apply
- **AND** the outcome does not depend on which trade type the user is on

#### Scenario: No hardcoded per-symbol table remains

- **WHEN** the change is inspected for per-symbol stake tables
- **THEN** no symbol-keyed table of literal stake values exists
- **AND** no lookup for one is exposed

#### Scenario: A previously curated market derives its own ladder

- **WHEN** a market that previously had hand-written stake values is opened
- **THEN** its quick picks are derived from its own reported minimum
- **AND** the lowest is at or near that minimum, as the hand-written set was
