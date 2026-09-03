## Context

See `proposal.md` — Why (issue #1226, regression from PR #1169 / `67d5bdb962`).

**Current state (inferred from code and library CSS):**

- `packages/trader/src/AppV2/Components/RiskManagementItem/risk-management-item.scss:29-34`

    ```scss
    &__action-sheet-content {
        height: 23.6rem;
        padding: var(--component-actionSheet-spacing-padding-sm) var(--component-actionSheet-spacing-padding-md) 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    ```

    The class is applied to `<ActionSheet.Content className='risk-management-item__action-sheet-content'>` in `risk-management-item.tsx:214`.

- That content region renders at most two children (`risk-management-item.tsx:215-243`): the `TextFieldWithSteppers` amount input (only while `isSheetOpen`) and, when `getProfit(contract_info)` is truthy, `TotalProfitLoss`. Roughly 5.6rem + ~2rem of content in a 23.6rem box.

- `@deriv-com/quill-ui` sizing contract (`node_modules/@deriv-com/quill-ui/dist/assets/index.css`, `index30.css`):
    - `.action-sheet--content { padding: var(--component-actionSheet-spacing-padding-md); flex-grow: 1; overflow-y: auto }`
    - `.quill-action-sheet--root { display: flex; flex-direction: column; max-height: 90dvh; overflow-y: auto; ... }` — **no fixed height**.

    Because the root has no height of its own, the content region's declared `height: 23.6rem` is what sets the sheet's height. `flex-grow: 1` is a no-op here.

- `justify-content: space-between` then distributes the two children to the top and bottom of that 23.6rem box, which is exactly the gap in the issue screenshots. When there is no profit figure, the single input sits at the top with ~18rem of blank sheet below it.

- `padding: … 0` (bottom `0`) was correct while `ActionSheet.Footer` sat below the content and supplied the bottom spacing. #1169 deleted that footer (`risk-management-item.tsx`, `-ActionSheet.Footer` hunk) and replaced it with `ActionSheet.Header` `saveAction`/`closeAction`, but did not revisit this stylesheet — `risk-management-item.scss` does not appear in that commit's SCSS file list.

- The same PR established the replacement pattern in the sibling trade-page sheet, `packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/risk-management.scss:95-98`:

    ```scss
    &__picker {
        height: auto;
        // Top only: quill's `.action-sheet--content` pads all four sides and the bottom one is wanted.
        padding-block-start: 0;
    ```

    and did the same (`height: auto`, fixed heights deleted) for `Duration`, `Multiplier`, `GrowthRate`, `PayoutPerPoint`, `Strike`, `Stake` and `TradeParamDefinition`.

- Token values (`@deriv-com/quill-tokens/dist/quill.css:7271-7273`): `--component-actionSheet-spacing-padding-sm: var(--core-spacing-400)`, `-md: var(--core-spacing-800)`, `-lg: var(--core-spacing-1200)`.

- The stylesheet is loaded through `packages/trader/src/AppV2/Components/RiskManagementItem/index.ts:3` (`import './risk-management-item.scss'`), which is the module `TakeProfit`, `StopLoss` and `DealCancellation` all import — so one SCSS edit covers all three consumers.

## Goals / Non-Goals

**Goals:**

- Fix the dead space with a SCSS-only change in `risk-management-item.scss`, matching the convention #1169 already applied to every other AppV2 value-editor sheet.
- Let the Quill sheet size itself from content, so the sheet height also stays correct when the Total profit/loss row is absent or a validation message appears.
- Restore the bottom spacing that the deleted footer used to provide, without hand-rolling a padding value — reuse Quill's own `.action-sheet--content` padding.

**Non-Goals:**

- No change to `risk-management-item.tsx` markup, props, state, validation, or the `updateLimitOrder()` commit path. The defect is purely a stale height in CSS.
- No change to the trade-page Risk management sheet (`TradeParameters/RiskManagement/*`), the desktop TP/SL inputs, or the `action-sheet-header-actions` commit/dismiss semantics.
- No change to the Contract Details page-level layout (`contract-details.scss`, `card-wrapper.scss`) — the reported gap is inside the sheet, and the page-level card spacing is correct today.
- No `min-height` floor and no re-introduction of a footer button; the sheet is allowed to be short.
- No sweep for other stale fixed heights beyond this file (a grep of AppV2 SCSS after #1169 leaves this as the only `ActionSheet.Content` class still pinning a `rem` height).

## Decisions

**Decision: fix `.risk-management-item__action-sheet-content` to hug its content — drop `height`, drop `justify-content`, add a `gap`.**

```scss
&__action-sheet-content {
    // No fixed height: the sheet's Quill root has none of its own, so this box sets the sheet
    // height. The footer Save button this used to leave room for was removed in #1169 (commit
    // moved to the header), so a reserved height is now dead space — see issue #1226.
    display: flex;
    flex-direction: column;
    // Rows flow top-down with one standard gap; `space-between` pushed Total profit/loss to the
    // bottom of the over-tall box, which was the visible gap.
    gap: var(--core-spacing-800);
    // Top only: quill's `.action-sheet--content` pads all four sides and the bottom one is wanted
    // now that no footer sits below the content.
    padding-block-start: 0;
    ...
}
```

- `gap: var(--core-spacing-800)` (16px) matches `.risk-management__tp-sl__wrapper` in the sibling sheet, so the two TP/SL editors read the same.
- Keep `display: flex; flex-direction: column` — the `.total-profit-loss` overrides nested in this class (resetting its `position: sticky` to `relative`) rely on it being a normal in-flow block, and a column flex container is the least-change way to hold the gap.
- Keep the nested `.total-profit-loss { position: relative; inset: unset; … }` overrides verbatim; they neutralise `total-profit-loss.scss`'s sticky/padding defaults inside the sheet and are unrelated to the height bug.

Alternatives considered:

- `height: auto` instead of deleting the declaration. Equivalent in effect; the literal form used by `.risk-management__picker`. Deleting the line is preferred here because there is no inherited height to override — but an implementer may write `height: auto` with the same comment if they prefer parity with the sibling file, and the spec scenarios still hold.
- Keep `justify-content: space-between` and only drop the height. Rejected: with a content-sized box `space-between` is a no-op today, but it re-encodes the "pin the P/L row to the bottom" intent and would resurrect the gap the moment any height re-enters the box. Removing it makes the intent explicit.
- Keep the explicit `padding: sm md 0` and just change the bottom to `md`. Rejected as the primary form: `padding-block-start: 0` is fewer declarations, inherits Quill's inline/bottom padding, and is the pattern the rest of AppV2 now follows. Trade-off is a 16px top pad instead of the previous 8px — acceptable, and it matches the other sheets. If visual QA insists on 8px, `padding-block-start: var(--component-actionSheet-spacing-padding-sm)` is a one-token adjustment that does not affect any spec scenario.
- Add `min-height` so the sheet does not feel too short when there is no P/L row. Rejected — no other AppV2 sheet has one after #1169, and a floor is exactly the mechanism that produced this bug.
- Fix in `risk-management-item.tsx` (e.g. conditionally rendering a spacer, or moving `TotalProfitLoss` out of the content region). Rejected: no behavioural defect exists in the component, and the change would be larger and riskier than the stylesheet edit.

**Decision: regression coverage is a style-level assertion plus manual mobile QA.**

jsdom does not resolve design tokens or compute layout, so no RTL assertion can prove "no white band". Cover it two ways instead:

1. Keep the existing `risk-management-item.spec.tsx` behaviour suite green (header save enable/disable, save commits, close discards, toggle, validation, accumulator read-only path). This is what guards the "behaviour unchanged" requirement.
2. Guard the stale-height class of bug directly by asserting the compiled stylesheet no longer pins a height on `.risk-management-item__action-sheet-content` — a small `fs`-read test over the SCSS file, or, if the repo has no precedent for stylesheet assertions, a load-bearing SCSS comment naming issue #1226 plus an explicit manual QA step. Prefer (2a) only if it stays trivial; the comment + QA route is acceptable and is what the comparable `allow-equals-toggle` change chose.

**Decision: no store, API, analytics, dependency or i18n changes.** Nothing in the fix touches the `contract_update_take_profit` / `contract_update_stop_loss` flow, `validation_params`, or any translated string.

## Risks / Trade-offs

- **[Risk] The sheet now resizes when a validation message appears or the P/L row toggles, which some reviewers may read as jitter.** → Mitigation: this is the post-#1169 behaviour of every other AppV2 value-editor sheet, so it is consistent rather than novel; the alternative (a floor) is the bug being fixed. Confirm during QA that the resize animates acceptably.
- **[Risk] Top padding grows 8px → 16px by inheriting Quill's `md`.** → Mitigation: matches the sibling Risk management sheet; if QA objects, override with `padding-block-start: var(--component-actionSheet-spacing-padding-sm)` — a single token, no spec impact.
- **[Risk] The screenshots in #1226 might additionally show a page-level gap in the TP/SL card rather than only the sheet.** → Mitigation: the spec includes a page-level "layout unchanged" requirement and QA step 3 checks the card explicitly with the sheet closed; if a second gap is found there, it is a distinct defect in `card-wrapper.scss` / `contract-details.scss` and should be reported rather than folded in silently. Evidence today points to the sheet: the 23.6rem box is measurable in the stylesheet, while the page card uses only `gap` between real children.
- **[Risk] A future edit re-adds a fixed height, reproducing the bug.** → Mitigation: the SCSS comment names issue #1226 and the reason the footer space is gone; the optional stylesheet assertion makes it a test failure.
- **[Risk] `.risk-management-item__action-sheet-content` is shared with the Deal cancellation row.** → Mitigation: that variant (`is_deal_cancellation`, no `type`) renders no toggle and never opens the sheet (`deal-cancellation.tsx:21-27`), so it is unaffected; QA step 4 confirms the row itself is visually unchanged.

## Migration Plan

Front-end SCSS only. No feature flag, no data migration, no dependency bump. Ships with the normal `@deriv/trader` bundle. Rollback is a revert of the single SCSS block.
