## Purpose

Defines how each tab on the Trade page's market strip presents itself, so a user can see at a glance which market and trade type is selected and — critically — where to tap to change them.

## ADDED Requirements

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
