## Context

See `proposal.md` — Why. The relevant current state:

`MarketTab` (`packages/trader/src/AppV2/Components/MarketTabs/market-tab.tsx`) is a presentational component. It renders `SymbolIconsMapper`, then a two-line label inside two nested reveal wrappers (`market-tab__reveal` → `market-tab__clip` → `market-tab__text`), then the remove "✕" in its own reveal:

```tsx
<Text size='sm' bold>{getSymbolDisplayName(market.symbol)}</Text>
{trade_type_title && (
    <CaptionText className='market-tab__subtitle' size='sm'>
        {trade_type_title}
        {has_profit && <span className='market-tab__profit'>…<ProfitAmount …/></span>}
    </CaptionText>
)}
```

Two constraints from `market-tabs.scss` shape the approach:

1. **Mobile** collapses inactive tabs to a 56px icon square by animating each `market-tab__reveal` grid track `0fr → 1fr`; the active tab is the only one showing a label at all. So on mobile a chevron placed inside the label is automatically hidden on inactive tabs — no extra gating needed there.
2. **Desktop** shows every tab's label, caps the tab at `26.4rem` with `flex: 0 1 auto`, and truncates via `&__text > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`. That rule targets the _whole_ `CaptionText` subtitle, so anything appended after the trade-type text (the chevron, and today's inline P/L) is the first thing clipped when tabs shrink. This is why the subtitle row needs restructuring rather than just an appended icon.

Interaction, from `market-tabs.tsx` `handleSelect`: tapping an **inactive** tab activates it; tapping the **active** tab sets `setReplacingMarket(market)` and opens `MarketSelection`. A **disabled** tab routes to `onDisabledClick` (snackbar). Only the active tab's tap opens the selector — which is what the chevron signifies.

Design source: Figma `Tabs with chevron` ([node 21702:539617](https://www.figma.com/design/zkhQsTI8PMKJX7k1N2QBJ1/Akram---Multiple-charts?node-id=21702-539617)) — 12px `chevron-down` on the trade-type row only; the market-name chevron instance in the same frame is hidden. The Figma file could not be read directly in this planning session (the Figma MCP read was not authorised), so the spec is grounded in the design details transcribed onto issue #1050 by the designer and the approver, not in a first-hand node inspection. Whoever implements should open the Figma link to confirm the exact icon size/colour token against the rendered result.

## Goals / Non-Goals

**Goals:**

- Add the chevron with the smallest possible change to one component + its stylesheet, keeping `MarketTab` presentational (no new store reads).
- Make the cue robust under truncation, which is where an appended icon would silently disappear.
- Reuse the existing 12px caption chevron already used elsewhere in AppV2 rather than introducing a new icon size.

**Non-Goals:**

- Rotating/flipping the chevron while the selector is open. That would require `MarketTab` to know the selector's open state (a new prop threaded from `MarketTabs`, or a store read in a presentational component) for a cue nobody asked for. Not in the Figma.
- ~~Replacing the existing `•` P/L separator with the Figma's 1×12px divider (parked — see Open Questions in `tasks.md`).~~ **Now in scope** — QA's Figma comparison filed the surviving `•` as a mismatch (#1168), so Open Question 2 was re-answered (b) and the swap landed under task 3.6. See the Decision below.
- Any change to the market/trade-type selector itself, tab caps, or tab widths.
- A new onboarding step or tooltip. The existing `.market-tabs` spotlight step in `OnboardingGuide/GuideForPages/steps-config.tsx` already covers first-run education; this change fixes the _persistent_ cue.

## Decisions

**Decision: reuse `LabelPairedChevronDownCaptionRegularIcon` from `@deriv/quill-icons`.**
The caption-size paired chevron is 12px, matching the Figma spec, and there is a direct in-repo precedent for exactly this "tap to open" cue: `AppV2/Components/ChartProfitLoss/profit-loss-pill.tsx` renders it with `fill='var(--component-textIcon-normal-prominent)'`.

- Alternative: `StandaloneChevronDownBoldIcon` (used by `market-changes-dropdown.tsx`) — rejected: it needs an explicit `iconSize` and is a heavier, bolder glyph than the Figma's 12px chevron.
- Colour: use the subtitle's own token (`--component-textIcon-normal-default`, which `.market-tab__subtitle` already applies) so the chevron reads as part of that row. Issue #1050's open point 1 flags that the caption row is the lower-contrast line; if the cue reads too faintly at device scale, the escalation is to bump the chevron alone to `--component-textIcon-normal-prominent` (as the P/L pill does) without touching the text — a one-token change, no layout impact.

**Decision: gate the chevron on a dedicated `opens_selector` prop in the component, not in CSS.**
The cue's meaning is "tapping me opens the selector", so `MarketTab` is told that fact rather than inferring it. `is_active` is _not_ a safe proxy for it: `market-tabs.tsx` passes `is_active={isActiveMarket(market) && !is_disabled}`, so a disabled tab is indeed never active — but while an automation run locks the strip, `handleSelect` returns early with the "Tab switching is locked until automation is stopped." snackbar **before** its open-the-selector branch, and the running tab is `is_active` with `is_disabled === false`. Gating on `is_active` would therefore advertise a picker (chevron + `aria-haspopup='dialog'` + "Change market and trade type…") on the one tab where tapping cannot open one. `opens_selector` defaults to `is_active` (so the common case needs no extra prop) and `MarketTabs` passes `is_active && !is_automation_market_locked`. Rendering the cue conditionally also keeps it out of the accessibility tree and the DOM otherwise, so tests can assert absence directly.

- Alternative: always render and hide with CSS (the pattern used for the desktop "✕", which is `visibility: hidden` so the tab doesn't resize). Rejected here: that trick exists because the ✕ must _reserve_ width; the chevron must not reserve anything, and a CSS-hidden chevron would still be in the DOM for every tab.

**Decision (revised 2026-08-19, QA finding): append the chevron to `.market-tab__subtitle` as an inline box and leave the row truncating as one text line.**
The row keeps the desktop `&__text > *` ellipsis rule applying to it, exactly as before this change: its parts are inline boxes in reading order (trade type → chevron → divider → amount), so a shrinking tab drops them from the end. The chevron and `.market-tab__profit` carry their own `margin-inline-start` (which disappears with them) and `vertical-align: middle` (so an icon-only inline box doesn't ride high on the text baseline).

- Rationale: this is production's truncation, and QA compared the two side by side. What was originally shipped instead — the subtitle as `display: flex` with a `.market-tab__trade-type` span carrying the ellipsis and `flex-shrink: 0` on the chevron and the P/L — inverted the order of degradation: at 5 tabs the trade-type text was squeezed to a leading character while the cue and the amount stayed whole, so the tab read `R… | +412.98 USD` and no longer said which trade type it was. A tab's job is to identify its market and trade type; the cue and the live amount are secondary to that, so they are what should go first.
- Consequence, accepted: on a shrunk tab the chevron can be truncated away with the amount. It is only ever rendered on the ACTIVE tab, which is `flex: 0 0 auto` on desktop (never shrinks) and content-width on mobile, so in practice the cue is never reached — the trade-off costs the cue nothing.
- Alternative: keep the flex row but let the P/L absorb the shrink first (a large `flex-shrink` on `.market-tab__profit`). Rejected — it hard-clips the amount mid-number instead of ellipsising the line, and it keeps two layout models for one row.
- Alternative: leave the subtitle as-is and place the chevron after the whole `market-tab__text` block. Rejected — that is Figma "Design 3", explicitly ruled out on layout (needs its own column, widens the tab).

**Decision: express the affordance for assistive tech with `aria-haspopup='dialog'` plus an active-tab `aria-label`.**
The tab root is already `role='button'` with `aria-current`/`aria-disabled`. Add `aria-haspopup='dialog'` when active (the selector renders as a full-screen modal on mobile / popover on desktop), and give the active tab an `aria-label` that names the action (e.g. `Change market and trade type: <market>, <trade type>`) via `localize()`. Mark the chevron `aria-hidden` (decorative).

- Rationale: the issue is about discoverability; a purely visual chevron leaves screen-reader users with the same problem. Cheap and additive.
- Alternative: no ARIA change. Rejected — spec requirement "The cue is available to assistive technology".

**Decision (revised 2026-08-18, QA finding #1168): draw the P/L separator as a CSS rule inside `.market-tab__profit`, not as a `|` character.**
The Figma specifies a 1×12px vertical divider between the chevron and the inline P/L; the shipped `•` was a text glyph. #1168 permits either a `|` or a rule — a rule is chosen because it is what the Figma actually is (a 1px shape, not a character), it scales with the token system (`--semantic-color-monochrome-border-normal-mid`, the same token the existing inter-tab divider uses, so both themes come free), and it contributes **no text content**. That last point matters concretely: the E2E strip locators match tabs by `textContent` (`hasText`/`toHaveText` in `MarketSelectionPage`/`verify-trade-tabs.spec.ts`), and a `|` would put a decorative character back into that string — the exact coupling the chevron was deliberately kept clear of.

- Keeping the divider as the first child of `.market-tab__profit` (where the `•` sat) rather than a sibling of the chevron is what makes "desktop only" and "no orphaned separator" fall out of existing rules: that span is `display: none` off `.market-tabs--desktop`, and it only renders under `has_profit`. A sibling of the chevron would need both conditions restating.
- Alternative: a `:before` pseudo-element on `.market-tab__profit`. Rejected — with no element there is nothing for a test to assert on, and this row's contract (order: text → chevron → divider → amount) is worth pinning.

**Decision: no new tests file; extend `__tests__/market-tab.spec.tsx`.**
The component's tests already cover active/inactive/disabled/profit permutations with a mocked `SymbolIconsMapper`; the chevron assertions belong alongside them. Assert on a `data-testid` on the chevron wrapper rather than on the quill-icons SVG internals, so the test doesn't couple to the icon library's markup.

## Risks / Trade-offs

- **Loosening the desktop `&__text > *` truncation rule could let a long market name overflow its tab.** → Resolved by the revised decision above: the rule is back to covering every label line, so the name keeps its ellipsis and the trade-type row regains one too. Verify at a shrunk desktop tab (5+ tabs open) with a long symbol name (e.g. a synthetic index) that both lines still truncate.
- **The 12px chevron on the lower-contrast caption row may not read as a strong enough cue** — issue #1050's own open point. → Mitigation: the escalation path is a colour-token bump on the chevron only (see Decisions); flag it for design sign-off at real device scale rather than guessing now.
- **Adding ~16px (icon + gap) to the active tab's content width on mobile.** → The active tab is content-width inside a scrolling strip with a 56px floor, so nothing overflows; the existing `glideIntoView` effect already scrolls a grown active tab into view. The Figma's 228px mobile active-tab width accommodates the chevron by design.
- **`aria-label` on the tab root replaces the announced text content**, so the market name and trade type must be included in that label or they stop being announced. → The label composes both values; covered by a test.
- **Existing tests query the subtitle with `getByText('Vanillas')`.** → Wrapping the text in a span keeps `getByText` matching (it is still the sole text node of that element), so no test churn is expected; confirm when running the suite.

## Migration Plan

Pure presentational front-end change: no data migration, no feature flag, no API surface. Rollback is a revert of the single component + stylesheet change.
