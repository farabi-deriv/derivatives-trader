## Why

On the Trade page the market strip (`MarketTabs`) is the only way to change the selected market or trade type: tapping the **active** tab opens the market selector so the pair can be replaced. Nothing in the tab signals that — it renders as a plain two-line label (market name + trade type) with an icon and a remove "✕", so users discover the interaction by trial and error (issue #1050). Design has approved a fix: a small `chevron-down` on the trade-type row of the active tab, marking the tab as a tappable "change this" control.

The chevron placement is a settled design decision (Design 2 of three variants, approved by @ashkan-deriv on 17 Aug): inline on the **trade-type** row, because tapping the tab opens the selector where trade type is chosen first, and because an inline chevron costs no extra tab width as the tab count grows.

## What Changes

- Render a `chevron-down` cue on the market tab's trade-type row, so the tab reads as `Vol. 100 (1s) Index` / `Rise/Fall ⌄` — visually marking the tab as the control that changes market + trade type.
- Show the cue on the **active** tab only. Only the active tab's tap opens the selector; an inactive tab's tap just activates it, and a disabled tab's tap surfaces a snackbar — a chevron on those would signify the wrong action.
- Keep the chevron visible when the trade-type label truncates: the subtitle row becomes a flex row where the trade-type text ellipsises and the chevron (and the existing inline P/L) do not shrink. Today the whole subtitle is a single `text-overflow: ellipsis` block, so an appended chevron would be the first thing clipped on a narrow desktop tab.
- Expose the same cue to assistive tech: the active tab announces that it opens the market selector (`aria-haspopup`), with the decorative chevron hidden from the accessibility tree.
- No change to tab behaviour, tab count limits, tab widths (the chevron is inline on an existing row), or to the market selector itself.

No breaking changes; this is a presentation-only change to one component.

## Capabilities

### New Capabilities

- `market-tabs`: The Trade page market strip's per-tab presentation — including the visual and assistive-tech affordance that identifies the active tab as the control for changing the selected market and trade type.

### Modified Capabilities

<!-- None. No existing spec under openspec/specs/ covers the market tab strip. -->

## Impact

- **Code**
    - `packages/trader/src/AppV2/Components/MarketTabs/market-tab.tsx` — render the chevron after the trade-type title on the active tab; add `aria-haspopup`/`aria-label` wording for the active tab.
    - `packages/trader/src/AppV2/Components/MarketTabs/market-tabs.scss` — make `.market-tab__subtitle` a flex row so the chevron and P/L never shrink or get ellipsised; the desktop `&__text > *` truncation rule needs to target the trade-type text rather than the whole subtitle.
    - Tests: `packages/trader/src/AppV2/Components/MarketTabs/__tests__/market-tab.spec.tsx` (and `market-tabs.spec.tsx` if strip-level assertions are affected).
- **Dependencies**: none new. Reuses `LabelPairedChevronDownCaptionRegularIcon` from `@deriv/quill-icons` (12px caption chevron), already used by `AppV2/Components/ChartProfitLoss/profit-loss-pill.tsx`.
- **Stores / APIs**: none. `MarketTab` stays a presentational component driven by its existing props.
- **Surfaces**: mobile and desktop AppV2 Trade page (`trade-mobile.tsx` / desktop header strip). On mobile only the active tab shows its label at all, so the cue appears exactly where the tab is expanded; on desktop every tab shows a label but only the active one gains the chevron.
- **E2E / docs**: `playwright/flows/market-selection/flow.md` documents the tab-strip journeys (Flow 1b/2 — "clicking the already-active tab opens the picker") and gains the new cue as an expected result. The existing Playwright locators in `playwright/pages/TradeBasePage.ts` and `playwright/pages/MarketSelectionPage.ts` key off `dt_market_tab` / `aria-current` / visible text, not the tab's accessible name, so the new `aria-label` is expected to be non-breaking — verified, not assumed.
- **Adjacent, unchanged**: the onboarding guide step that spotlights `.market-tabs` (`AppV2/Components/OnboardingGuide/GuideForPages/steps-config.tsx`) keeps working — it targets the strip, not the tab internals.
- **Out of scope** (parked in the source issue): raising the tab cap from 4 to 10 (not approved).
- **Added after review (#1168):** the inline P/L separator moves from the shipped `•` to the Figma's 1×12px divider, desktop only. Originally parked as out of scope; QA's Figma comparison confirmed it as a mismatch, so the scope call was reversed.
