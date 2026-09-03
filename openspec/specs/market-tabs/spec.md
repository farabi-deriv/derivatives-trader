# market-tabs Specification

## Purpose

TBD - created by archiving change market-selector-left-blank-instead. Update Purpose after archive.

## Requirements

### Requirement: [MT-005] Entering Automate with no automate tabs seeds one supported default market

When the user enters Automate and the automation tab collection is empty (no persisted `open_markets_automation` and no automate tab created by other means), the system SHALL seed exactly one supported default market as the active tab: `Rise/Fall` on the app default symbol when `rise_fall` is supported, otherwise the first supported trade type on the app default symbol. The market strip SHALL never be left with zero tabs on a first Automate entry.

#### Scenario: First Automate entry with an empty persisted automate collection

- **WHEN** the automation tab collection is empty and the user enters Automate carrying over a manual `(symbol, contract_type)` pair (supported or not)
- **THEN** the strip seeds one supported default tab (`Rise/Fall` on the app default symbol when available, else the first supported trade type) and shows it as the active tab — the strip is never left blank

#### Scenario: Remembered automate pair equals the carried-over pair

- **WHEN** the remembered automate market equals the currently active `(symbol, contract_type)` pair, so the mode-flip reconciler makes no tab-creating call
- **THEN** the seed effect still runs and seeds a supported default tab, rather than relying on the reconciler — the strip is not left blank

#### Scenario: A supported market is already the active tab

- **WHEN** entering Automate with a supported market already open and active in the automation collection
- **THEN** no seed occurs and no duplicate tab is added — the existing supported tab stays active

### Requirement: [MT-006] The seed survives a concurrent supported-trade-types write

The seed of the first supported default market SHALL complete even when the automation-supported trade-type set is handed to the store on the same strip mount. A no-op or benign reallocation of the automation tab collection observable (from applying the supported-set guard) SHALL NOT permanently cancel the pending seed; the seed SHALL commit its resolved default symbol rather than latch "already seeded" and discard it.

#### Scenario: Supported set applied while the async default-symbol pick is in flight

- **WHEN** the strip mounts, hands the store a new supported-trade-types set (routing through the open-markets writer), and the asynchronous `pickDefaultSymbol` resolves after that write's re-render has run the effect's cleanup
- **THEN** the resolved default symbol is still committed and the seeded tab appears active — the commit is not discarded because a cleanup ran, and the "one seed at a time" latch does not block it forever

### Requirement: [MT-007] A failed seed commit does not permanently block seeding

If the asynchronous seed commit fails (e.g. a WebSocket drop mid-commit), the system SHALL NOT leave an unhandled promise rejection and SHALL release the "seed in flight" latch so a subsequent effect run (e.g. re-entering Automate) can retry the seed. Retries SHALL be bounded per Automate visit, so a persistently failing commit cannot retry on every dependency change; the budget SHALL be reset whenever the latch is (a supported market becomes active, or the supported set is cleared on leaving Automate).

#### Scenario: Seed commit rejects

- **WHEN** the async seed's `selectMarketAndTradeType` commit rejects
- **THEN** the rejection is caught (no unhandled rejection) and the seed latch is reset, so a later run can seed a supported default tab rather than the strip staying permanently blank

#### Scenario: Commit keeps failing

- **WHEN** the seed commit rejects repeatedly and observable churn re-runs the effect more times than the retry budget allows
- **THEN** no further seed attempt is made once the budget is spent — the strip stays blank for that visit rather than retrying on every dependency change (a persistently failing commit means the connection is down, which the app surfaces separately)

#### Scenario: Leaving and re-entering Automate after the budget is spent

- **WHEN** the retry budget has been spent and the user leaves Automate (the supported set is cleared, or the strip unmounts) and returns
- **THEN** the latch and the retry budget are both reset, so the seed is attempted again on the new visit

### Requirement: [MT-009] A seed commit never lands after Automate is left

The asynchronous seed SHALL NOT commit once the app is no longer in Automate. The check SHALL read the live mode at commit time, not a value captured (or mirrored into a ref) during render: `setActiveOpenMarkets` selects its collection from the live `is_automation_mode`, and on mobile leaving Automate unmounts the strip so no later render can refresh a captured value. A commit that lands after the mode flip would append the automation default to the **manual** collection and overwrite the user's manual market.

#### Scenario: The user returns to Manual while the default-symbol pick is in flight

- **WHEN** the seed's `pickDefaultSymbol` is still awaiting and the user leaves Automate (mobile: the `/automate` route unmounts the strip; desktop: the Automation panel tab is switched away)
- **THEN** the resolved symbol is not committed — the manual collection, its persisted value, and the active `(symbol, contract_type)` are all unchanged

#### Scenario: Re-entering Automate after a blocked commit

- **WHEN** a seed was blocked because Automate had been left, and the user enters Automate again
- **THEN** the seed runs afresh on the new visit and seeds a supported default tab

### Requirement: [MT-008] A no-op tab-collection write is elided

The active open-markets writer SHALL skip reassigning and persisting the tab collection when the next list is element-wise identical to the current one, so a no-op write does not reallocate the observable array or invalidate observers that depend on it.

#### Scenario: Re-applying the automation supported-set guard filters nothing out

- **WHEN** the automation-supported trade-type set is applied and every currently open automation tab is already supported (nothing is filtered out)
- **THEN** the writer leaves the automation tab collection observable unchanged (no reassignment, no re-persist) rather than allocating a new equal array and notifying every observer

#### Scenario: A genuine change still writes

- **WHEN** an add, remove, or replace produces a tab collection that differs from the current one
- **THEN** the writer reassigns and persists the new collection as before

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

### Requirement: The active market tab shows a chevron cue on its trade-type row

The tab representing the currently selected market SHALL display a downward chevron immediately after the trade-type text on the tab's second (trade-type) line, so the tab reads as `<market name>` / `<trade type> ⌄`. The chevron marks the tab as the control that changes the selected market and trade type.

The chevron SHALL be presentational only: the whole tab remains the tap target, and the chevron itself is not a separate button.

#### Scenario: Active tab renders the chevron beside the trade type

- **WHEN** a market tab is rendered as the active tab (e.g. `Vol. 100 (1s) Index` / `Rise/Fall`)
- **THEN** a downward chevron is rendered on the trade-type line, positioned after the trade-type text

#### Scenario: Tapping the chevron behaves exactly like tapping the tab

- **WHEN** the user taps the chevron on the active tab
- **THEN** the same action fires as tapping anywhere else on that tab (the market selector opens to replace the tab), and no additional or duplicate action is triggered

#### Scenario: Chevron is omitted when the tab has no trade-type line

- **WHEN** a tab's trade type cannot be resolved to a display name, so no trade-type line is rendered
- **THEN** no chevron is rendered for that tab

### Requirement: The chevron cue appears only where tapping opens the selector

The chevron SHALL be shown only on a tab whose tap actually opens the selector. An inactive tab's tap merely activates that tab, a disabled tab's tap surfaces an explanation, and while the strip is locked by a running automation no tab's tap — not even the active one's — opens the selector; none of these SHALL display the chevron. The same rule SHALL govern the assistive-technology affordance (the `haspopup` hint and the "changes market and trade type" label), so a tab never announces an action its tap will not perform.

#### Scenario: Inactive tab shows no chevron

- **WHEN** a market tab is rendered while another tab is active
- **THEN** no chevron is rendered on that tab

#### Scenario: Disabled tab shows no chevron

- **WHEN** a market tab is rendered as disabled (its trade type is unsupported in the current mode)
- **THEN** no chevron is rendered on that tab, even if it would otherwise be the selected pair

#### Scenario: The active tab shows no chevron while an automation run locks the strip

- **WHEN** the strip is locked by a running automation, so tapping the active (running) tab surfaces the "locked until automation is stopped" explanation instead of opening the selector
- **THEN** no chevron is rendered on that tab and it does not announce that it opens the selector, even though it is still rendered as the active tab (keeping its highlight and live profit/loss)

### Requirement: A narrow tab keeps its trade-type text readable

The trade-type row SHALL truncate as a single line of text, in reading order: the trade-type text first, then the chevron, then the divider and the inline profit/loss amount. On a tab too narrow for the whole row, the parts SHALL therefore be dropped from the end — the amount, then the chevron — and the trade-type text SHALL keep its width and remain readable, truncating with an ellipsis only once it alone exceeds the tab. The trade-type text SHALL NOT be reduced to a leading character or two in order to keep the chevron or the amount visible.

This matches the truncation the strip has always had, and it keeps the row within its own tab: no part of it SHALL paint over the tab strip or a neighbouring tab. The truncation SHALL sit on the label's lines, not on the tab, whose active-state corner fillets are drawn outside its own box.

The active tab is exempt in practice: it never shrinks, so its chevron and amount are never reached.

#### Scenario: Crowded strip keeps each tab's trade type readable

- **WHEN** more than 4 tabs are open on desktop, so tabs shrink below the width of their full label, and a tab shows an inline profit/loss amount for a running position
- **THEN** that tab shows its trade-type text (truncated with an ellipsis only if the text alone overflows) and drops the amount, rather than showing a clipped trade type next to a whole amount

#### Scenario: Crowded strip keeps the inline P/L inside its own tab

- **WHEN** more than 4 tabs are open on desktop, so tabs shrink past the width their label needs, and a tab shows an inline profit/loss amount for a running position
- **THEN** nothing on the trade-type row overlaps the tab strip or a neighbouring tab

#### Scenario: Active tab with a running position keeps both cue and P/L

- **WHEN** the active tab shows an inline profit/loss amount for its open positions alongside the trade type
- **THEN** the chevron and the profit/loss amount are both fully visible — the active tab keeps its full width — with the chevron between the trade-type text and the profit/loss amount, and the divider between the chevron and the amount

### Requirement: A vertical divider separates the chevron cue from the inline P/L

Where the active tab shows an inline profit/loss amount, a thin vertical divider SHALL sit between the chevron and that amount, so the trade-type row reads `<trade type> ⌄ | +$12.98`. The divider SHALL be a drawn rule (1px wide, 12px tall, in the standard border colour), NOT a text character — so it contributes nothing to the tab's text content and is not announced by assistive technology.

The divider SHALL appear only where the amount itself appears: alongside a rendered profit/loss amount, and only in the layout that shows that amount inline. A tab with no open positions SHALL show no divider.

#### Scenario: Divider sits between the cue and the amount

- **WHEN** the active tab is rendered with an inline profit/loss amount for its open positions
- **THEN** a vertical divider is rendered after the chevron and before the amount, and the tab's text content contains no separator character

#### Scenario: No divider without a profit/loss amount

- **WHEN** the active tab has no open positions, so no inline profit/loss amount is rendered
- **THEN** no divider is rendered either, and the trade-type row ends after the chevron

### Requirement: The chevron does not change the tab's size or layout

Adding the chevron SHALL NOT introduce a new layout column or otherwise widen the tab beyond the inline space it occupies on the existing trade-type row, so tab dimensions and the number of tabs that fit remain as before. The mobile collapsed (icon-only) inactive tab SHALL be unaffected.

#### Scenario: Inactive mobile tab stays an icon-only square

- **WHEN** the strip is rendered on mobile with several tabs open
- **THEN** each inactive tab still renders collapsed to its icon-only square with no visible label or chevron

#### Scenario: No dedicated chevron column is added

- **WHEN** the active tab is rendered
- **THEN** the chevron sits inline on the trade-type row (not in a separate column to the right of the label block), and the tab's icon, label rows and remove control keep their existing positions

### Requirement: The cue is available to assistive technology

The active tab SHALL announce that activating it opens the market selector, so the affordance is not visual-only. The chevron graphic itself SHALL be hidden from the accessibility tree as decorative.

#### Scenario: Active tab announces that it opens a selector

- **WHEN** the active tab is reached with a screen reader or keyboard
- **THEN** it is announced as a control that opens the market selector (in addition to being announced as the current tab)

#### Scenario: Chevron is not announced separately

- **WHEN** a screen reader traverses the active tab's contents
- **THEN** the chevron graphic is not announced as separate content or as an extra focus stop

### Requirement: Existing market tab behaviour is unchanged

Introducing the cue SHALL NOT alter any existing tab behaviour: tapping an inactive tab activates it, tapping the active tab opens the selector to replace that pair, the remove control still removes the tab without activating it, and disabled tabs stay non-selectable. The per-tab profit/loss amount itself — when it shows, what it shows, and its colour — is unchanged; only the separator preceding it changes, per the divider requirement above.

#### Scenario: Tapping an inactive tab still activates it

- **WHEN** the user taps an inactive tab
- **THEN** that market and trade type become active and the market selector does not open

#### Scenario: Remove control still removes without selecting

- **WHEN** the user taps the remove control on the active tab
- **THEN** the tab is removed and no selector opens
