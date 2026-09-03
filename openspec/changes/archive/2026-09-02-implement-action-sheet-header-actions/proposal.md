## Why

Quill-ui `ActionSheet.Header` (1.24.9) now supports title-row header actions — a leading `closeAction` (X) and a trailing `saveAction` (check) — and the new design moves value-editor sheets (Duration, Stake, Barrier, wheels, automation panels, …) off their footer Save/Done/Apply button onto these header actions. The check is disabled by default and lights up only once the selected value differs from the committed one; the X (and any other dismissal) discards. This makes "did I actually change something?" visible before committing and unifies commit/dismiss semantics across every value-editor sheet in AppV2.

## What Changes

- **BREAKING (UX/behavior):** In migrated value-editor sheets, dismissing via the X, overlay tap, or drag no longer commits the draft — it discards. Committing happens **only** by tapping the header check. Previously the Duration sheet committed on any dismissal.
- Migrate **Category A** value-editor sheets from a footer `primaryAction` (Save/Done/Apply) to `ActionSheet.Header` `closeAction` + `saveAction`, removing the footer commit button.
- Gate every migrated `saveAction` with `isSaveActionDisabled = !is_dirty || has_validation_error`: disabled on open, enabled only when the draft differs from the committed value; sheets with existing disable conditions (stake/barrier validation, date-picker empty range) keep them, AND-ed with the dirty gate.
- **Duration sheet (Phase 1):** dismiss = discard; move the commit logic out of `duration.tsx#onClose` into a `handleSave` wired to the header `saveAction`; drop tap-to-select auto-commit (`handleItemClick` + `onRequestClose`/`pending_close`) from both wheels so a tap only updates the draft; fold the End-time tab's footer Save into the single header check (branching on the active tab).
- **Nested end-date/time picker (`day.tsx`):** migrate its "Done" footer to header actions with snapshot-on-open / restore-on-dismiss, since date browsing writes live proposal state.
- Bump already done ✅ — all three packages pinned to `@deriv-com/quill-ui@1.24.9` (1.24.8 is broken and skipped).
- **Out of scope (kept on footer, confirmed):** informational "Got it" sheets (icon-only check reads as "save" — wrong semantics), two-button filter/reset sheets (secondary text button has no header slot), and coral error/status sheets (`primaryButtonColor='coral'` has no header equivalent).

## Capabilities

### New Capabilities

- `action-sheet-header-actions`: The commit/dismiss behavior contract for AppV2 value-editor action sheets — header save/close actions, the dirty-gated save, discard-on-dismiss, Duration tap-to-select and single-save-for-tabs, the nested picker's snapshot/restore, and which sheet categories are explicitly excluded from the migration.

### Modified Capabilities

<!-- None. The only adjacent spec, openspec/specs/duration-end-time-fields/spec.md, covers
     removal of the trailing chevron on the End-time Date/Time trigger fields and is unaffected
     by this change's commit/dismiss behavior. No other existing spec covers action-sheet
     header/footer commit semantics. -->

## Impact

- **Dependency:** `@deriv-com/quill-ui@1.24.9` (already pinned in `packages/{core,trader,reports}/package.json`); no further bump. 1.24.8 must never be used (dist module-scope TDZ bug).
- **Phase 1 code (Duration):**
    - `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration.tsx` — owns store data; adds `handleSave` + `is_save_disabled`, `onClose` becomes `setOpen(false)`, removes `requestClose`/`pending_close`.
    - `packages/trader/src/AppV2/Components/TradeParameters/Duration/container.tsx` — header gains `closeAction`/`saveAction`/`isSaveActionDisabled`/`shouldCloseOnSaveActionClick`; drops the End-time footer and the `onRequestClose`/`setSavedExpiry*` props it no longer needs.
    - `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-wheel-picker.tsx` — remove `handleItemClick` wrapper `<div>`s and `onRequestClose` from both wheels.
    - `packages/trader/src/AppV2/Components/TradeParameters/Duration/day.tsx` — nested sub-sheet header actions with snapshot/restore.
    - Tests: `__tests__/duration.spec.tsx`, `__tests__/duration_container.spec.tsx`, `__tests__/day.spec.tsx`.
- **Phase 2 code (remaining Category A, same pattern):** `Stake/stake-input.tsx`, `Barrier/barrier-input.tsx`, `Strike/strike-wheel.tsx`, `Multiplier/multiplier-wheel-picker.tsx`, `GrowthRate/growth-rate-picker.tsx`, `PayoutPerPoint/payout-per-point-wheel.tsx`, `LastDigitPrediction/last-digit-prediction.tsx`, `RiskManagement/take-profit-and-stop-loss-input.tsx`, `RiskManagementItem/risk-management-item.tsx`, `DatePicker/date-picker.tsx`, and the four `AutomationPanel/*` mobile sheets (`StrategySelector`, `MaxTradeStake`, `ThresholdInput`, `StakeMultiplier`), each with its co-located test.
- **Stores/APIs:** none — every migrated sheet already keeps a local draft separate from the committed store value; no new store fields.
- **Scope:** mobile AppV2 only (the ActionSheet path; desktop `DurationDesktop` and other desktop editors unchanged). Category B/C/D sheets untouched.
