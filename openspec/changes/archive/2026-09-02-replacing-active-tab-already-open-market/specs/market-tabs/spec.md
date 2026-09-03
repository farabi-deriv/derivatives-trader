## ADDED Requirements

### Requirement: [MT-001] Replacing the active tab with an already-open market activates it instead of deleting the tapped tab

When the market picked in the "replace this tab" selector (opened by tapping the **active** tab) is a `(symbol, contract_type)` pair that is **already open as a different tab**, the system SHALL drop the replace intent and treat the commit as a plain switch: the tapped tab SHALL NOT be removed, no tab SHALL be added, and the already-open tab SHALL become active in its existing position.

#### Scenario: Selecting an already-open market via the active-tab replace flow

- **WHEN** exactly two tabs are open — tab 1 `Gold Basket · Rise/Fall` (inactive) and tab 2 `Volatility 100 Index · Rise/Fall` (active) — the user taps active tab 2 to open the market selector, and selects `Gold Basket · Rise/Fall`
- **THEN** the selector closes, tab 1 becomes active, tab 2 remains open and unmoved, and the strip still shows exactly two tabs: `[Gold Basket · Rise/Fall (active), Volatility 100 Index · Rise/Fall]`

#### Scenario: Tab positions and count are unaffected regardless of which tab was tapped

- **WHEN** three or more tabs are open and the user taps the active tab, then selects a pair that matches another, non-active, already-open tab
- **THEN** the tab count after the commit equals the tab count before it, and every tab other than the one activated keeps its pre-commit position

### Requirement: [MT-002] Replacing the active tab with a market not already open still swaps it in place

When the target pair of a "replace this tab" commit is **not** already open as another tab, the system SHALL replace the tapped tab with the new pair at the tapped tab's existing position, exactly as before this change.

#### Scenario: Replacing the active tab with a brand-new market

- **WHEN** the active tab is tapped to open the selector and the user selects a `(symbol, contract_type)` pair that matches no currently open tab
- **THEN** the tapped tab is replaced in place by the new pair (same position, tab count unchanged) and the new tab becomes active

#### Scenario: Toggling a same-category sub-type (e.g. Allow equals) still swaps the tapped tab itself in place

- **WHEN** the active tab's pair is `(symbol, rise_fall)` and the commit selects `(symbol, rise_fall_equal)` for the same symbol
- **THEN** the tapped tab itself is updated in place to the new pair (its own trade type is in the same category as the selected one, so it is the target — not a different already-open tab) and no other tab is affected

### Requirement: [MT-003] A failed replace commit never corrupts the tab strip

If the underlying market/trade-type commit fails after the tab strip has already been optimistically updated, the system SHALL restore the strip to its pre-commit state **only when a replace actually took place**; a commit whose replace intent was dropped (per requirement MT-001, because the target was already open as another tab) SHALL NOT trigger any rollback mutation, since the strip was never changed for it.

#### Scenario: A failed commit whose replace was skipped leaves the strip untouched

- **WHEN** the target pair is already open as another tab (so no tab was added, removed, or replaced per MT-001), and the subsequent market/trade-type commit then fails (e.g. the connection drops)
- **THEN** the tab strip after the failure is identical to the strip before the commit was attempted — no tab is re-added, re-removed, or re-replaced

#### Scenario: A failed genuine in-place replace rolls back

- **WHEN** the target pair was not already open elsewhere, so the tapped tab was replaced in place per MT-002, and the subsequent market/trade-type commit then fails
- **THEN** the original tapped tab is restored at its original position and the newly-added pair is removed, leaving the strip exactly as it was before the commit was attempted

### Requirement: [MT-004] Opening the selector via "+" is unaffected by a pending replace intent

Opening the market selector through the "+" control SHALL always clear any pending "replace this tab" intent before the selector opens, so a selection made from that entry point never triggers the tap-to-replace behavior described in MT-001-MT-003.

#### Scenario: Adding a new tab via "+" after tapping the active tab was cancelled

- **WHEN** the user taps the active tab (setting a pending replace intent) then dismisses the selector without selecting, and afterwards opens the selector via "+" and selects a market
- **THEN** the selection is appended as a new tab (or activates an existing matching tab) — it does not replace the previously-active tab
