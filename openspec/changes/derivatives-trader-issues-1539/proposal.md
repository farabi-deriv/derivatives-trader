## Why

On mobile DTrader, tapping a row in the Duration wheel does nothing (issue #1539: "1 tick" looks disabled and repeated taps never select it, 164 affected users in 24 h, mostly Over/Under). The row is not disabled. quill greys out every row except the centred one, and "1 tick" is a valid, rendered option. The tap itself is lost. The Duration sheet uses `shouldDetectSwipingOnContainer`, so quill binds a `@use-gesture` drag engine to the whole sheet with `filterTaps: true`. That engine's capture-phase click guard (`pointerClick`) calls `preventDefault()` + `stopPropagation()` on any click it did not see start as a tap. `useBlockSheetSwipe` stops `pointerdown`/`touchstart` from leaving the wheel so a wheel scroll can't drag the sheet closed. As a result the engine never sees the press, and every tap on a wheel row is swallowed before quill's row `onClick` (which scrolls the row to the centre) can run. Users can only reach a value by dragging the wheel.

## What Changes

- `useBlockSheetSwipe` (`packages/trader/src/AppV2/Hooks/useBlockSheetSwipe.ts`) keeps blocking the sheet's drag-to-close from wheel gestures. It also replays a tap on a quill wheel row itself: a `pointerup` on the same `.quill-wheel-picker__data-item` that took the `pointerdown`, with no `pointercancel` in between, scrolls that row to the centre. It uses the exact `scrollIntoView` call quill's own row `onClick` makes, so quill's scroll listener reports the new value through the wheel's existing `setInputValues` path.
- The fix lives in the shared hook, so every mobile wheel sheet that uses it gets working taps. That covers Duration ticks, Duration time, the End-time time picker, Multiplier, Growth rate, Strike, Payout per point and Deal cancellation.
- Commit semantics are unchanged. A tap only moves the draft. The ActionSheet header Save still commits, and dismiss still discards (`duration.tsx` `handleSave`/`onClose`, from #1169).
- Wheel styling is unchanged. quill's built-in greyed non-centred rows stay as they are.
- The hook's doc comment (which wrongly promises that "its items still take taps") and the `CLAUDE.md` Gotchas list are updated.

## Capabilities

### New Capabilities

- `wheel-picker-tap-selection`: tapping a row of a quill wheel inside a swipe-to-close mobile action sheet centres that row and makes it the draft selection, while a drag on the wheel still never moves or closes the sheet.

### Modified Capabilities

None. `duration-time-wheel` (DTW-001..003) governs which time values render, and that is untouched. `action-sheet-header-actions` keeps its Save/dismiss contract unchanged.

## Impact

- Code: `packages/trader/src/AppV2/Hooks/useBlockSheetSwipe.ts` (behaviour). The call sites stay as they are because they already spread the hook's return value: `Duration/duration-wheel-picker.tsx`, `Duration/timepicker.tsx`, `Duration/day.tsx`, `Multiplier/multiplier-wheel-picker.tsx`, `GrowthRate/growth-rate-picker.tsx`, `Strike/strike-wheel.tsx`, `PayoutPerPoint/payout-per-point-wheel.tsx`, `RiskManagement/deal-cancellation.tsx`.
- Tests: new `packages/trader/src/AppV2/Hooks/__tests__/useBlockSheetSwipe.spec.tsx`, plus a Duration integration case in `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/duration.spec.tsx` that drives the real quill wheel.
- Docs: `CLAUDE.md` Gotchas.
- No API, store, dependency, or desktop change. `@deriv-com/quill-ui` stays at 1.24.12, and no upstream quill change is required.
