## Why

On mobile AppV2, opening **Take profit** or **Stop loss** from the Contract Details page shows a large empty white band inside the editor action sheet ([issue #1226](https://github.com/deriv-com/derivatives-trader/issues/1226)). `.risk-management-item__action-sheet-content` still pins `height: 23.6rem` with `justify-content: space-between` (`packages/trader/src/AppV2/Components/RiskManagementItem/risk-management-item.scss:29-34`), a height that was sized when the sheet still had an `ActionSheet.Footer` Save button below the content. PR [#1169](https://github.com/deriv-com/derivatives-trader/pull/1169) (`67d5bdb962`) moved every value-editor sheet onto `ActionSheet.Header` `saveAction`/`closeAction` and deleted that footer, and in the same pass replaced fixed sheet heights with `height: auto` across `Duration`, `Multiplier`, `GrowthRate`, `PayoutPerPoint`, `Strike`, `Stake` and `RiskManagement` — but `risk-management-item.scss` was never touched (it is absent from that commit's SCSS file list). The Contract Details TP/SL sheets are therefore the last sheets still reserving footer space that no longer exists.

## What Changes

- Make the Contract Details Take profit / Stop loss action-sheet content **hug its content** instead of reserving a fixed `23.6rem`, so the Quill sheet (`.quill-action-sheet--root`, which has no fixed height and only a `max-height: 90dvh`) sizes to the amount input plus the optional Total profit/loss row. The empty white band disappears for both TP and SL.
- Replace `justify-content: space-between` — which pushed the Total profit/loss row to the bottom of the over-tall box and created the visible gap — with normal flow plus an explicit `gap`, so the P/L row sits directly under the amount input.
- Align the content padding with the post-#1169 convention already used by `.risk-management__picker` (`padding-block-start: 0`, letting Quill's own `.action-sheet--content` padding supply the inline and bottom spacing), so the last row no longer needs the `padding-bottom: 0` that the removed footer used to compensate for.
- Keep all TP/SL behaviour unchanged: toggle on/off, header save gating (`is_save_disabled`), validation messages, `updateLimitOrder()` commit, discard-on-dismiss, the accumulator read-only amount path, and the deal-cancellation variant.
- Add regression coverage asserting the sheet content no longer declares a fixed height / space-between distribution.

No breaking changes. No store, API, analytics or dependency changes.

## Capabilities

### New Capabilities

- `contract-details-risk-management-sheet`: Layout contract for the mobile Contract Details risk-management rows (Take profit, Stop loss, Deal cancellation) and their editor action sheet — the sheet hugs its content with no reserved footer space, the amount input and Total profit/loss row are adjacent, and existing commit/validation behaviour is preserved.

### Modified Capabilities

<!-- None. `openspec/specs/` has no existing spec covering Contract Details TP/SL or action-sheet
     content sizing. The adjacent `action-sheet-header-actions` spec (commit/dismiss semantics)
     still lives under `openspec/changes/implement-action-sheet-header-actions/` and is not yet
     promoted to `openspec/specs/`, so it cannot be delta'd here; this change is additive to it
     and contradicts none of its requirements. -->

## Impact

- **Code (the fix):** `packages/trader/src/AppV2/Components/RiskManagementItem/risk-management-item.scss` — `.risk-management-item__action-sheet-content` drops `height: 23.6rem` and `justify-content: space-between`, gains a `gap`, and switches to `padding-block-start: 0`. Loaded via `packages/trader/src/AppV2/Components/RiskManagementItem/index.ts:3`.
- **Component (unchanged behaviour, explains the markup):** `packages/trader/src/AppV2/Components/RiskManagementItem/risk-management-item.tsx:214-244` — `ActionSheet.Content` holds the `TextFieldWithSteppers` (rendered only while `isSheetOpen`) and, when `getProfit(contract_info)` is truthy, `TotalProfitLoss`. Its header already carries `closeAction` + `saveAction` and there is no `ActionSheet.Footer`.
- **Consumers (all three share the same class):** `packages/trader/src/AppV2/Components/TakeProfit/take-profit.tsx`, `packages/trader/src/AppV2/Components/StopLoss/stop-loss.tsx` (both rendered from `packages/trader/src/AppV2/Containers/ContractDetails/contract-details.tsx:98-103`), and `packages/trader/src/AppV2/Components/DealCancellation/deal-cancellation.tsx` (read-only variant whose sheet is never opened).
- **Reference for the convention:** `packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/risk-management.scss:95-98` (`height: auto` + `padding-block-start: 0`) — the trade-page TP/SL sheet already fixed by #1169.
- **Library contract relied on:** `@deriv-com/quill-ui` `.action-sheet--content { padding: var(--component-actionSheet-spacing-padding-md); flex-grow: 1; overflow-y: auto }` and `.quill-action-sheet--root { max-height: 90dvh; ... }` — no fixed root height, so the sheet is content-sized.
- **Tests:** `packages/trader/src/AppV2/Components/RiskManagementItem/__tests__/risk-management-item.spec.tsx` (existing header-save/close, validation and toggle cases must stay green); a style-level regression assertion is added here or as a stylelint-visible SCSS comment.
- **Scope:** mobile AppV2 Contract Details only. The trade-page Risk management sheet, the desktop TP/SL inputs (`TradeParameters/RiskManagement/take-profit-stop-loss-desktop.tsx`), and Contract Details page-level layout (`contract-details.scss`, `card-wrapper.scss`) are untouched.
