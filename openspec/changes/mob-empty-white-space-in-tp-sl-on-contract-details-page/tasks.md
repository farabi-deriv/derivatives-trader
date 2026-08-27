## Open Questions

Neither blocks implementation — the recommended default is what the specs, `design.md` and the checklist below already assume. A reviewer may replace an answer; only the noted lines change if they do.

1. **Where should the Total profit/loss row sit in the TP/SL editor sheet now that the 23.6rem box is gone?**
    - **(a) RECOMMENDED — Directly under the amount input, one standard `gap: var(--core-spacing-800)` between them.** Matches `.risk-management__tp-sl__wrapper` in the sibling trade-page sheet, so both TP/SL editors read the same. This is what task 1.2 implements.
    - (b) Keep it visually separated with a larger gap (e.g. `--core-spacing-1200`) or a divider, so it reads as a distinct summary band rather than part of the form.
    - (c) Pin it to the bottom of the sheet with `margin-block-start: auto` — only meaningful if a `min-height` is also added, which option 2(b) below would supply.
    - (d) Drop it from the sheet entirely; the amount already appears on the Contract Details card behind the sheet.

2. **Should the sheet keep a minimum height so it does not feel very short (input only, no profit figure) and does not resize when a validation message appears?**
    - **(a) RECOMMENDED — No floor; the sheet is content-sized.** This is the post-#1169 behaviour of every other AppV2 value-editor sheet (`Duration`, `Stake`, `Multiplier`, `GrowthRate`, `PayoutPerPoint`, `Strike`, `RiskManagement` all use `height: auto`), and a floor is the exact mechanism that produced #1226.
    - (b) Add `min-height` sized to the tallest state (input + validation message + P/L row) so the sheet never resizes mid-interaction. Costs a hardcoded value that will drift again.
    - (c) Content-sized, but reserve the validation-message line only (e.g. a fixed-height message slot) so the sheet is stable while typing but still short when the P/L row is absent.

## 1. Fix the TP/SL editor sheet height

- [x] 1.1 In `packages/trader/src/AppV2/Components/RiskManagementItem/risk-management-item.scss`, delete `height: 23.6rem;` from `.risk-management-item__action-sheet-content` (line 30). Verify by loading the compiled trader CSS (or DevTools on the open sheet) and confirming no `height` is declared on that class — the Quill `.quill-action-sheet--root` has no height of its own, so the sheet then sizes to its content.
- [x] 1.2 In the same block, remove `justify-content: space-between;` and add `gap: var(--core-spacing-800);`, keeping `display: flex; flex-direction: column;`. Verify in DevTools that the Total profit/loss row sits directly beneath the amount input with a single 16px gap, not pushed to the sheet's bottom edge.
- [x] 1.3 In the same block, replace `padding: var(--component-actionSheet-spacing-padding-sm) var(--component-actionSheet-spacing-padding-md) 0;` with `padding-block-start: 0;` so Quill's own `.action-sheet--content { padding: var(--component-actionSheet-spacing-padding-md) }` supplies the inline and bottom spacing that the deleted `ActionSheet.Footer` used to provide. Verify the last row in the sheet has ~16px of space below it and its left/right inset matches the Duration and Stake sheets.
- [x] 1.4 Leave the nested `.total-profit-loss { position: relative; inset: unset; z-index: unset; background-color: unset; padding: unset; }` overrides and `&__label` colour untouched. Verify the Total profit/loss row inside the sheet still renders inline (not sticky at the top) and on the sheet background, matching its appearance before this change.
- [x] 1.5 Add a short SCSS comment above the block naming issue #1226 and stating that no fixed height belongs here because the commit action moved to `ActionSheet.Header` in #1169 and no footer sits below the content. Verify the comment is present and `npm run test:stylelint` passes.
- [x] 1.6 Confirm the sheet markup in `packages/trader/src/AppV2/Components/RiskManagementItem/risk-management-item.tsx` (header `closeAction`/`saveAction`, `ActionSheet.Content`, no `ActionSheet.Footer`) is already correct and is left unmodified by this change.
- [x] 1.7 In the same file, stop hiding the Total profit/loss row when the figure is exactly `0`: the `!!total_profit` guard also dropped the row on the tick where the live figure crosses zero, so the row was removed and restored and the content-sized sheet resized with it — a flicker on mobile. Render the row whenever `getProfit` yields a finite number, keeping it hidden when there is no figure (a multiplier contract without a bid price yet computes to `NaN`). Verify with the tests in task 2.5.

## 2. Regression coverage

- [x] 2.1 Run `npm run test:jest -- packages/trader/src/AppV2/Components/RiskManagementItem/__tests__/risk-management-item.spec.tsx` and verify every existing case stays green: label + info modal render, toggle opens the sheet, read-only amount field value, header save disabled on open, save enabled after a change, save calls `updateLimitOrder`, close does not commit, and the accumulator read-only amount path.
- [x] 2.2 Add a stale-fixed-height guard. Preferred: a small assertion in `packages/trader/src/AppV2/Components/RiskManagementItem/__tests__/risk-management-item.spec.tsx` (or a co-located `*.scss.spec.ts`) that reads `../risk-management-item.scss` with `fs` and asserts the `__action-sheet-content` block declares neither a `height:` in `rem`/`px` nor `justify-content: space-between`. Verify the new test fails when `height: 23.6rem` is temporarily restored and passes after. If the repo has no precedent for stylesheet assertions and a reviewer prefers not to add one, skip this and rely on task 1.5's comment plus the manual QA in section 3 — state that choice in the PR description.
- [x] 2.3 Run `npm run test:jest -- packages/trader/src/AppV2/Containers/ContractDetails/__tests__/contract-details.spec.tsx` and verify the Contract Details page suite stays green (it mocks `RiskManagementItem`, so this only confirms nothing upstream broke).
- [x] 2.4 Run `npm run test:stylelint` and verify the touched SCSS reports no errors.
- [x] 2.5 In `risk-management-item.spec.tsx`, cover the zero-profit row: the row renders showing `0.00` when the profit is exactly zero, stays mounted across a profit → zero → loss re-render sequence, and is still omitted when no figure is available. Verify the first two fail against the old `!!total_profit` guard and pass after task 1.7.

## 3. Manual verification (mobile AppV2)

> Not run in the implementation stage: every item here needs a running build on a mobile viewport,
> signed in, with a live contract that has Take profit / Stop loss set. Left unchecked deliberately —
> these are the reviewer's QA steps, and 3.2/3.3 need the before/after screenshots task 4.3 asks for.
> The automatable part of this section (the sheet declares no fixed height and no `space-between`) is
> covered by task 2.2's guard.

- [ ] 3.1 Reproduce issue #1226 on the current `master`/branch build first: mobile viewport → open a contract with Take profit set → Contract Details → tap the Take profit amount field. Verify the empty white band is visible, so the after-state is a real comparison.
- [ ] 3.2 With the fix applied, repeat 3.1 and verify the Take profit sheet shows the title row, the amount input and the Total profit/loss row with no empty band anywhere, and that the sheet's height hugs that content.
- [ ] 3.3 Repeat 3.2 for Stop loss and verify the same — including that the amount is still displayed as a negative value in the read-only field on the card behind the sheet.
- [ ] 3.4 With the sheet closed, verify the Contract Details page itself is unchanged: Take profit and Stop loss still share one card below the chart with the existing spacing, each row on a single line with its label, info icon and toggle. If a _second_, page-level gap is visible here, do not fold it into this change — report it as a separate defect (it would live in `card-wrapper.scss` / `contract-details.scss`).
- [ ] 3.5 Verify behaviour in the resized sheet: header save is disabled on open, enables after changing the amount, saves and closes; clearing the amount or entering a below-minimum / above-maximum value shows the validation message under the input and the sheet grows to fit it without clipping; dismissing via X, overlay tap or drag leaves the committed amount unchanged.
- [ ] 3.6 Verify a contract with no profit figure yet (`getProfit` unavailable) so the Total profit/loss row is absent: the sheet contains only the title row and the amount input, is correspondingly shorter, and shows no leftover space where the row would have been.
- [ ] 3.10 Verify the zero case does not flicker: keep the sheet open on a live contract and watch the Total profit/loss figure cross zero (or open the sheet while it reads 0.00). The row stays visible showing 0.00, and neither the row nor the sheet height blinks as the figure crosses zero.
- [ ] 3.7 Verify the read-only variants are visually unchanged: an open accumulator contract's Take profit row still shows the formatted read-only amount with no toggle and no sheet, and a multiplier contract still valid to cancel still shows the Deal cancellation row with its remaining-time badge.
- [ ] 3.8 Verify no regression on the adjacent, already-fixed sheet: open the trade page's Risk management sheet (Take profit & Stop loss tab) and confirm it is unaffected by this change.
- [ ] 3.9 Spot-check both themes (light and dark) on the Take profit sheet, since the touched block also carries the `.total-profit-loss__label` colour token.

## 4. Wrap-up

> Not run in the implementation stage: the full gate, the commit and the PR are handled downstream.
> 4.2's answer is already settled — no user-facing documentation is affected (SCSS-only layout fix:
> no copy, command, config or public workflow change).

- [ ] 4.1 Run `npm run test` (stylelint + eslint + jest) and verify it passes before pushing, per the repo workflow in `CLAUDE.md`.
- [ ] 4.2 Confirm no user-facing documentation needs updating (SCSS-only layout fix, no copy, command, config or public workflow change) and state that explicitly in the PR description, per the "Documentation Is Part of Done" steering rule.
- [ ] 4.3 In the PR description, link issue #1226, name PR #1169 / commit `67d5bdb962` as the origin of the stale height, and attach before/after mobile screenshots of both the Take profit and Stop loss sheets.
