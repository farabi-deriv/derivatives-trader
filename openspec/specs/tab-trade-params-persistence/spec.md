# tab-trade-params-persistence Specification

## Purpose

Defines how manually chosen trade parameters (Duration, Stake, Take profit / Stop loss, barriers and related presets) are remembered independently for each open market tab on the Trade strip — surviving a page refresh and a switch away and back, while a newly opened tab and a fresh browser tab always start from that trade type and market's defaults.

## Requirements

### Requirement: Trade parameters are scoped to the market tab that owns them

Each open market tab on the Trade strip SHALL own an independent set of trade parameters. A tab's identity for this purpose SHALL be the `(symbol, contract_type)` pair the tab is recorded under on the strip — the same identity the strip itself uses — never the tab's position in the strip, which shifts when tabs are closed or replaced.

Editing a parameter in a tab SHALL save that value against that tab only, and SHALL NOT change the saved parameters of any other tab, including another tab showing the same symbol under a different trade type.

The tab-scoped parameter set SHALL cover the user-editable parameters: stake, basis, duration, duration unit, expiry date, expiry time, expiry type, start date, start time, both barriers, growth rate, multiplier, last digit, payout per point, the "Allow equals" selection, the take-profit / stop-loss / deal-cancellation toggles and their values, deal-cancellation duration, and the barrier and strike choice lists that back those inputs. Account-scoped and layout-scoped state — the trading currency and whether the trade-parameters panel is expanded — SHALL remain global and SHALL NOT be tab-scoped.

Parameters derived from the contract offering rather than chosen by the user — notably the contract expiry type resolved from `contracts_for` — SHALL NOT be tab-scoped; they are recomputed for the active pair.

#### Scenario: Editing one tab does not disturb another

- **WHEN** two tabs are open, the user sets the stake to 25 and the duration to 8 ticks in tab A, then switches to tab B
- **THEN** tab B shows its own parameters, unaffected by tab A's edits
- **AND** tab A's saved parameters still read stake 25 and duration 8 ticks

#### Scenario: The same symbol under two trade types keeps independent parameters

- **WHEN** Volatility 100 Index is open both under Rise/Fall and under Higher/Lower as two tabs, and the user sets the duration to 10 ticks on the Rise/Fall tab
- **THEN** the Higher/Lower tab for the same symbol keeps its own duration, unchanged

#### Scenario: Closing a tab does not re-assign another tab's parameters

- **WHEN** three tabs are open with distinct parameters and the user closes the first one
- **THEN** each remaining tab still shows the parameters it had before the close, with no values shifted between tabs

### Requirement: Switching back to an existing tab restores that tab's saved parameters

Activating a tab whose `(symbol, contract_type)` pair is already on the strip SHALL restore that tab's most recently saved parameters, not the trade type and market's defaults.

The restore SHALL take effect after every parameter reset the activation itself triggers — the stake / take-profit / stop-loss reset applied on a symbol or trade-type change, the per-trade-type default duration applied on a real trade-type switch, and the barrier/duration cleanup applied when the outgoing and incoming symbols differ in barrier or duration support. The user's saved values are the final state the tab settles on.

Restoring SHALL be applied only once the incoming pair's contract constraints are known, so a restored value is never validated against the outgoing pair's limits.

The outgoing tab's current parameters SHALL be saved before the switch begins, so a switch away and back is lossless.

When two tab activations overlap (rapid tab taps), the system SHALL NOT interleave one activation's restore with another's commit: only the most recent activation's parameters SHALL be applied.

Restoring SHALL be applied only once the activation has finished writing BOTH halves of the incoming pair. While the symbol has been committed but the trade type has not, the parameters SHALL stay queued — a contract offering already held for the incoming symbol (so answered without a round trip) SHALL NOT settle the tab against the outgoing trade type.

#### Scenario: Switch away and back returns the saved values

- **WHEN** the user sets the stake to 25 and the duration to 8 ticks in tab A, switches to tab B, and switches back to tab A
- **THEN** tab A shows stake 25 and duration 8 ticks

#### Scenario: A restored stake survives the activation's own stake reset

- **WHEN** the user activates an existing tab whose saved stake differs from the trade type's default stake, and the activation changes both the symbol and the trade type
- **THEN** the tab settles on the saved stake, not the default stake

#### Scenario: A restored take profit and stop loss survive a trade-type change

- **WHEN** the user activates an existing tab that has take profit and stop loss enabled with saved values, and the activation changes the trade type
- **THEN** the tab settles with take profit and stop loss still enabled at their saved values

#### Scenario: A restored duration survives the per-trade-type default duration

- **WHEN** the user activates an existing tab whose saved duration is valid for that tab's trade type but differs from that trade type's configured default duration
- **THEN** the tab settles on the saved duration, not the configured default

#### Scenario: Revisiting a symbol whose contract offering is already held still restores

- **WHEN** the user customises tab A, opens tab B on a different symbol and trade type, and switches back to tab A while tab A's symbol contract offering is still held from earlier in the session
- **THEN** tab A shows its saved parameters, not the trade type and market defaults

#### Scenario: Rapid switching applies only the latest activation

- **WHEN** the user taps tab A and then immediately taps tab B before tab A's activation has settled
- **THEN** the parameters shown are tab B's saved parameters
- **AND** no parameter from tab A's restore is applied on top of tab B

### Requirement: A newly opened tab always starts from the trade type and market defaults

Opening a tab for a `(symbol, contract_type)` pair that is not already on the strip SHALL load that trade type and market's default parameters. It SHALL NOT inherit the parameters of the previously active tab and SHALL NOT restore parameters from any earlier tab, including one for the same pair that was closed earlier in the session.

The defaults applied SHALL include the trade type's configured default duration and the market's default stake, and SHALL clear the take-profit, stop-loss and deal-cancellation selections.

When an existing tab's pair is replaced — through the long-press "replace this tab" flow, or when the trade type the tab carries is no longer offered by its symbol and the system falls back to the first available trade type — the resulting pair SHALL be treated as a new tab and SHALL load defaults.

#### Scenario: A new tab ignores the current tab's customised values

- **WHEN** the active tab has a customised stake of 25 and a duration of 8 ticks, and the user opens a new tab for a different symbol under the same trade type
- **THEN** the new tab shows that trade type and market's default stake and default duration, not 25 and 8 ticks

#### Scenario: Reopening a previously closed tab starts from defaults

- **WHEN** the user customises a tab's parameters, closes that tab, and then opens a tab for the same symbol and trade type again
- **THEN** the reopened tab shows defaults, not the parameters the closed tab had

#### Scenario: Replacing a tab loads the replacement pair's defaults

- **WHEN** the user long-presses the active tab and selects a different market or trade type to replace it with
- **THEN** the replaced tab shows the new pair's default parameters

#### Scenario: An unavailable trade type falls back with defaults

- **WHEN** a tab's trade type turns out not to be offered by its symbol and the system falls back to the first available trade type for that symbol
- **THEN** the tab shows the fallback trade type's default parameters

### Requirement: A sub-type toggle stays on the same tab and keeps its parameters

Toggling a sub-type within one trade type — "Allow equals" on Rise/Fall, and the direction toggles on the trade types that offer them — SHALL be treated as a change on the ACTIVE tab, not as opening or switching a tab. It SHALL NOT reset any tab-scoped parameter, SHALL NOT add a second tab for the same market and trade type, and the resulting values SHALL be saved against the tab the toggle was made on.

#### Scenario: Allow equals keeps a customised stake

- **WHEN** the user sets a stake different from the default on a Rise/Fall tab and then turns "Allow equals" on
- **THEN** the tab still shows that stake, along with its duration and every other parameter it had
- **AND** the strip still shows one Rise/Fall tab for that market

#### Scenario: Turning Allow equals back off also keeps the stake

- **WHEN** the user turns "Allow equals" off again on that tab
- **THEN** the stake and the other parameters are still the user's, and the strip still shows one Rise/Fall tab for that market

#### Scenario: The toggled state and the stake both survive a tab round trip

- **WHEN** the user customises the stake on a Rise/Fall tab, turns "Allow equals" on, switches to another tab, and switches back
- **THEN** the tab shows that stake with "Allow equals" still on

### Requirement: Deliberately choosing a default value counts as a user choice

A parameter SHALL be treated as saved for its tab whenever the user sets it, including when the value the user picks happens to equal the current default. The system SHALL NOT infer "the user did not choose this" from a value being equal to the default.

#### Scenario: Explicitly picking the default duration is preserved

- **WHEN** the user opens the duration picker, explicitly selects the value that is also the trade type's configured default, switches to another tab, and switches back
- **THEN** the tab shows that duration, and it is not re-derived or replaced by any other default

#### Scenario: Explicitly picking the default stake is preserved

- **WHEN** the user types a stake equal to the market's default stake, switches to another tab, and switches back
- **THEN** the tab shows that stake

### Requirement: Saved parameters survive a page refresh

Refreshing the page SHALL restore, for the tab that becomes active on reload, the parameters that tab had before the refresh. Every other tab that was open before the refresh SHALL likewise still hold its own saved parameters, restored when the user switches to it.

The parameters restored on reload SHALL be those of the tab that is activated, and SHALL NOT be the values most recently written by any other tab.

#### Scenario: The active tab's parameters survive a refresh

- **WHEN** the user sets the duration to 8 ticks and the stake to 25 in the active tab and refreshes the page
- **THEN** after the reload the active tab shows duration 8 ticks and stake 25

#### Scenario: Each tab keeps its own values across a refresh

- **WHEN** tab A has duration 8 ticks, tab B has duration 3 minutes, tab B was last edited, and the user refreshes the page while tab A is active
- **THEN** tab A shows 8 ticks after the reload
- **AND** switching to tab B shows 3 minutes

#### Scenario: A refresh does not re-apply the configured default duration

- **WHEN** the active tab's saved duration is valid for its trade type and market but differs from the trade type's configured default duration, and the user refreshes the page
- **THEN** the tab shows the saved duration after the reload

#### Scenario: A saved duration that is no longer valid falls back to the default

- **WHEN** the active tab's saved duration is outside the duration range or uses a duration unit the trade type and market no longer offer, and the user refreshes the page
- **THEN** the tab shows that trade type and market's default duration, and no duration validation error blocks pricing

### Requirement: A new browser tab starts from a single default market tab

Both the market tab strip and the per-tab parameters SHALL be scoped to the browser tab that produced them. Opening the application in a new browser tab or window SHALL show a single default market tab — it SHALL NOT reopen the market tabs belonging to another browser tab, and SHALL NOT restore any parameters saved in another browser tab. Every market tab it shows SHALL start from that trade type and market's defaults.

Closing the browser SHALL discard both the saved per-tab parameters and the tab strip. This is a deliberate trade-off against the previous behaviour, in which the strip was shared by every browser tab and survived a browser restart.

A strip persisted by an earlier release into storage shared across browser tabs SHALL NOT be adopted, and SHALL be discarded rather than left behind indefinitely.

#### Scenario: A second browser tab does not inherit the first one's market tabs

- **WHEN** the user has several market tabs open in one browser tab and then opens the application in a second browser tab
- **THEN** the second browser tab shows one default market tab, and none of the first browser tab's market tabs

#### Scenario: A second browser tab does not inherit the first one's parameters

- **WHEN** the user customises parameters in one browser tab and then opens the application in a second browser tab
- **THEN** the second browser tab shows default parameters

#### Scenario: A strip saved by an earlier release is not adopted

- **WHEN** the application starts and a tab strip persisted by an earlier release is present in storage shared across browser tabs
- **THEN** that strip is not restored, the browser tab starts from a single default market tab, and the stale entries are discarded

#### Scenario: Parameters saved in another browser tab never leak in

- **WHEN** the user edits parameters in a second browser tab and then returns to the first browser tab and switches between its market tabs
- **THEN** each market tab in the first browser tab shows its own saved parameters, unaffected by the second browser tab

### Requirement: A deep link's market and trade type win, and its tab follows the normal rule

A deep link that names a symbol and/or a trade type SHALL still determine which market and trade type the application opens on. Because a deep link carries no parameter values, the pair it lands on SHALL follow the ordinary rule: a pair already on the strip restores its saved parameters, and a pair that is not on the strip loads defaults.

Distinguishing a genuine deep link from the application's own URL stamp written on a previous navigation SHALL continue to work unchanged.

#### Scenario: A deep link to a market not on the strip loads defaults

- **WHEN** the user arrives from an external link naming a symbol and trade type that are not on the strip
- **THEN** the application opens that market and trade type with default parameters

#### Scenario: A deep link to an already-open tab restores that tab

- **WHEN** the user arrives from an external link naming a symbol and trade type that already have a tab with saved parameters
- **THEN** the application opens that tab with its saved parameters

#### Scenario: A refresh is not mistaken for a deep link

- **WHEN** the user refreshes the page while the URL still carries the application's own symbol and trade-type stamp from the current session
- **THEN** the reload is treated as a refresh, and the active tab's saved parameters are restored

### Requirement: Restoring a tab's parameters never prevents the Trade page from loading

Determining which tab's parameters to restore SHALL NOT depend on state that is unavailable at that point, and MUST NOT be able to raise an error out of construction. That determination happens during store construction, before the application's UI state is available, and a failure there aborts application start-up and replaces the entire Trade page with the generic error screen — a strictly worse outcome than starting from defaults.

#### Scenario: The page loads when UI state is not yet available

- **WHEN** the application starts and the per-tab restore intent is determined before the UI state (including the mobile/desktop distinction) has been attached
- **THEN** the Trade page loads normally and the tab's saved parameters are restored, and no error screen is shown

#### Scenario: Manual and automation collections are still told apart during start-up

- **WHEN** the restore intent is determined at start-up and the mode cannot be read from UI state
- **THEN** the mode is taken from the persisted trade-panel selection, so a cold load restores from the same collection it saved to

### Requirement: Stored parameters are validated on read and pruned to the open tabs

Stored per-tab parameters SHALL be validated when read: a malformed, non-object, or unrecognised entry SHALL be discarded rather than assigned to the store, and unrecognised or wrongly-typed parameter keys within an entry SHALL be dropped. Corrupt or absent storage SHALL yield an empty set and MUST NOT prevent the Trade page from loading.

Entries whose `(symbol, contract_type)` pair is no longer on the strip SHALL be pruned whenever the strip changes, so the stored set cannot grow unbounded.

Manual and automated trading keep independent tab collections; their saved parameters SHALL likewise be kept in independent collections, so switching modes never lets one mode's parameters reach the other mode's tabs.

#### Scenario: Corrupt storage does not break the page

- **WHEN** the stored per-tab parameters are not valid JSON, or are a value that is not an object
- **THEN** the application starts with no saved parameters and every tab loads defaults, with no error surfaced to the user

#### Scenario: Unknown keys in a stored entry are ignored

- **WHEN** a stored entry contains a key that is not one of the tab-scoped parameters, or a value whose type does not match the parameter
- **THEN** that key is dropped and the remaining valid parameters in the entry are still restored

#### Scenario: Closing a tab prunes its stored entry

- **WHEN** the user closes a tab that had saved parameters
- **THEN** the stored set no longer contains an entry for that tab's pair

#### Scenario: Manual and automation tabs keep separate parameters

- **WHEN** the same symbol and trade type is open as a tab in both manual and automated trading, with different parameters in each
- **THEN** switching between the two modes shows each mode's own parameters, and neither overwrites the other
