## Open Questions

- **OQ1 — Does this change include Phase 2 (all remaining Category A sheets), or just Phase 1 (Duration)?**
    - (a) **[RECOMMENDED]** Both phases in this one change, phased with a mandatory review checkpoint after Phase 1 (Duration) — matches the plan doc's rollout and the confirmed decision to migrate all Category A in one pass. The checklist below is written to this default.
    - (b) Phase 1 only in this change; open a follow-up change `implement-action-sheet-header-actions-phase-2` for the rest. Choose this if the Duration review is expected to reshape the pattern.
    - _A reviewer may switch to (b) by deleting section 3 below and archiving after Phase 1; nothing in Phase 1 depends on Phase 2._

- **OQ2 — Nested picker (`day.tsx`) discard edge: recomputed custom time on cancel.** Restoring the date on dismiss re-runs the `[selected_expiry_date]` effect, recomputing (not restoring) a custom time picked _before_ browsing dates.
    - (a) **[RECOMMENDED]** Accept for Phase 1 (already decided 2026-08-18); still strictly better than today. Task 2.4 is written to this default.
    - (b) Snapshot and restore the exact expiry time too (extra state + guard the effect). Defer unless QA flags it.

## 1. Phase 1 — Duration store owner and wheels

- [x] 1.1 In `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration.tsx`, add `handleSave` that branches on the active tab: Ticks/Time runs today's `onClose` commit body (clamp `selected_time` via `clampTimeWheelSelection`, convert via `getDurationFromTimeWheelSelection`, guard `next.duration > 0`, sync saved expiry date/time, `onChangeMultiple({...next, expiry_type: 'duration'})`, fire the `ce_trade_types_form_v2` analytics event); End-time runs today's `container.tsx#onAction` (`setSavedExpiryDate/Time`, `onChangeMultiple({expiry_date, expiry_time, expiry_type: 'endtime'})`, analytics).
- [x] 1.2 In `duration.tsx`, add `is_save_disabled` computed per active tab from the existing "unchanged" logic: Ticks → `expiry_type==='duration' && duration_unit==='t' && duration===selected_ticks`; Time → `expiry_type==='duration'` and clamped selection equals `getTimeWheelSelectionFromDuration(duration, duration_unit)` element-wise (also disabled when the converted duration `<= 0`); End-time → `expiry_type==='endtime' && selected date/time === saved date/time`.
- [x] 1.3 In `duration.tsx`, reduce `onClose` to `setOpen(false)` only (remove the commit body — it now lives in `handleSave`); remove `pending_close`, `requestClose`, and the `useEffect` that ran `onClose` on `pending_close`. Confirm the existing `is_open` effect still re-initializes `selected_ticks`/`selected_time`/expiry drafts from committed values on open (this is what makes dismiss = discard).
- [x] 1.4 In `duration.tsx`, pass `onSave={handleSave}` and `is_save_disabled` into `DurationActionSheetContainer`; drop the `onRequestClose`, `setSavedExpiryTime`, `setSavedExpiryDate` props it no longer needs.
- [x] 1.5 In `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-wheel-picker.tsx`, remove the `handleItemClick` wrapper `<div onClick=...>` and the `onRequestClose` prop from both `DurationTicksWheel` and `DurationTimeWheel` (keep `WheelPickerContainer` + `setInputValues`, which already updates the draft on tap).

## 2. Phase 1 — Duration container, nested picker, header actions

- [x] 2.1 In `packages/trader/src/AppV2/Components/TradeParameters/Duration/container.tsx`, replace the title-only `<ActionSheet.Header title={...} />` with `closeAction={{ ariaLabel: localize('Close') }}`, `saveAction={{ onAction: onSave, ariaLabel: localize('Save') }}`, `isSaveActionDisabled={is_save_disabled}`, and `shouldCloseOnSaveActionClick`; add `onSave` + `is_save_disabled` to the component's props/typedef and remove the now-unused `onRequestClose`/`setSavedExpiry*` props.
- [x] 2.2 In `container.tsx`, delete the End-time tab's `<ActionSheet.Footer ... primaryAction={{ content: 'Save', onAction }}>` and its local `onAction` (folded into the header save via `handleSave`'s End-time branch).
- [x] 2.3 In `packages/trader/src/AppV2/Components/TradeParameters/Duration/day.tsx`, replace the nested sub-sheet's `<ActionSheet.Footer ... primaryAction={{ content: 'Done', ... }}>` with header `closeAction`/`saveAction`: save keeps the browsed value (today's Done body: `setOpen(false)`, `setOpenTimePicker(false)`, `setSelectedExpiryTime(browsing_expiry_time)`) and is disabled until browsed ≠ snapshot and while `is_disabled` (proposal error) is set; wire `shouldCloseOnSaveActionClick`.
- [x] 2.4 In `day.tsx`, snapshot `selected_expiry_date` + expiry time when the sub-sheet opens; on X/overlay/drag dismiss restore the snapshot (accept the recomputed-time edge per OQ2 default).

## 3. Phase 2 — remaining Category A sheets (re-scoped to the carousel-drop/tooltip design)

> ✅ **Checkpoint cleared 2026-08-18.** The Phase-1 review passed and the carousel design questions are
> resolved (plan Decisions log; plan "Open questions: None"). Phase-1 verification established the true
> structure — only **2** sheets are clean own-header swaps, **10** are `Carousel`/`CarouselHeader`-hosted,
> **1** is headerless (`LastDigitPrediction`), and TP/SL is nested — so §3 is re-scoped from the stale
> "mechanical prop swap" to the confirmed **carousel-drop + tooltip** design. Rules (see `design.md`
> Decisions and `docs/action-sheet-header-actions-plan.md` "Carousel sheets → info-icon tooltip"):
> a **sheet-level** description → click-triggered tooltip on an info icon composed **inline into the
> `title` ReactNode** (never the Header `icon` slot); a **multi-description** sheet → per-item info-icon
> tooltip, no header icon; a **content-row detail page** (e.g. growth-rate Barrier/Max duration) → keep
> the carousel page. Every sheet: still verify its commit/dismiss semantics individually before swapping,
> and AND the dirty gate with (never replace) existing disable conditions. Wheel sheets that keep the
> draft in `useRef` (`strike`, `multiplier`, `growth-rate`) move it to `useState` so the gate is reactive.

### 3A. Clean own-header swaps (land first — no carousel)

- [x] 3.1 `packages/trader/src/AppV2/Components/RiskManagementItem/risk-management-item.tsx` — own `ActionSheet.Header title` + footer Save. Move `primaryAction` → `closeAction`/`saveAction`/`shouldCloseOnSaveActionClick`; add `isSaveActionDisabled` = dirty gate (`stepperValue` ≠ committed value).
- [x] 3.2 `packages/trader/src/AppV2/Components/DatePicker/date-picker.tsx` — own `ActionSheet.Header title` + footer "Apply". Move to header actions; keep the existing `!chosenRangeString` disable AND-ed with a dirty gate (`chosenRange` ≠ committed range).

### 3B. Headerless — add a header

- [x] 3.3 `packages/trader/src/AppV2/Components/TradeParameters/LastDigitPrediction/last-digit-prediction.tsx` — renders `ActionSheet.Content` + `Footer` with **no** `Header` today. Add an `ActionSheet.Header` with `closeAction`/`saveAction`/`shouldCloseOnSaveActionClick`; remove the footer; `isSaveActionDisabled` = `selected_digit === committed digit` (also keep the `invalid_digit` guard). Confirm dismiss re-initialises `selected_digit` from the committed value on open (discard semantics).

### 3C. Carousel-hosted, single sheet-level description → drop carousel + title-icon tooltip

- [x] 3.4 `packages/trader/src/AppV2/Components/TradeParameters/Barrier/barrier.tsx` + `barrier-input.tsx` — replace `Carousel`/`CarouselHeader` (pages `[input, description]`) with a plain `ActionSheet.Header`; move the description page to a title info-icon tooltip. Lift the commit handler + dirty flag to the host; delete `barrier-input.tsx`'s footer. Keep the existing `show_validation_error || isLoadingProposal` disable AND-ed with the dirty gate.
- [x] 3.5 `packages/trader/src/AppV2/Components/TradeParameters/Multiplier/multiplier.tsx` + `multiplier-wheel-picker.tsx` — carousel pages `[picker, definition]` → header + title tooltip. **Move the `useRef` draft (`selected_multiplier`) to `useState`** so `isSaveActionDisabled` (`selected` ≠ `initial_multiplier`) is reactive; delete the child footer.
- [x] 3.6 `packages/trader/src/AppV2/Components/AutomationPanel/StrategySelector/strategy-selector-mobile.tsx` — carousel `[list, preview+description]` → header + title tooltip. Footer button is **"Select"** today; the header action is icon-only (aria-label `Save`), so drop the visible text. `isSaveActionDisabled` = `preview_value` ≠ committed.
- [x] 3.7 `packages/trader/src/AppV2/Components/AutomationPanel/MaxTradeStake/max-trade-stake-mobile.tsx` — carousel `[input, definition]` → header + title tooltip; `isSaveActionDisabled` = value/`is_enabled` unchanged.
- [x] 3.8 `packages/trader/src/AppV2/Components/AutomationPanel/ThresholdInput/threshold-input-mobile.tsx` — carousel `[input, definition]` → header + title tooltip; preserve the current `shouldCloseOnPrimaryButtonClick={false}` behaviour on `shouldCloseOnSaveActionClick`; `isSaveActionDisabled` = value unchanged.
- [x] 3.9 `packages/trader/src/AppV2/Components/AutomationPanel/StakeMultiplier/stake-multiplier-mobile.tsx` — carousel `[input+presets, definition]` → header + title tooltip; keep the existing `!inputValue || !!error` disable AND-ed with the dirty gate.

### 3D. Carousel-hosted, description + content-row detail page(s) → tooltip for the description, KEEP the carousel for the detail pages

- [x] 3.10 `packages/trader/src/AppV2/Components/TradeParameters/GrowthRate/growth-rate.tsx` + `growth-rate-picker.tsx` — pages `[picker, definition, barrier, max duration]`. Convert only the **definition** page to a title info-icon tooltip; **keep** the carousel navigation (back arrow + retitling) for the "Barrier" / "Max duration" content-row pages. **Move the `useRef` draft to `useState`** for a reactive gate; delete the child footer.
- [x] 3.11 `packages/trader/src/AppV2/Components/TradeParameters/PayoutPerPoint/payout-per-point.tsx` + `payout-per-point-wheel.tsx` — pages `[picker, definition, barrier]`. Definition → title tooltip; **keep** the "Barrier" detail page. Preserve the `is_api_response_received_ref`/`shouldCloseOnPrimaryButtonClick={false}` behaviour; `isSaveActionDisabled` = value unchanged.
- [x] 3.12 `packages/trader/src/AppV2/Components/TradeParameters/Strike/strike.tsx` + `strike-wheel.tsx` — pages `[picker, strike definition, payout-per-point definition]`. **Move the `useRef` draft (`selected_value_ref`) to `useState`.** Apply the per-page rule: the sheet-level (strike) description → title tooltip; if the payout-per-point description is reached from a content row, keep it as a carousel page (else it is a second title tooltip). **Verify which before swapping.**

### 3E. Multi-description / nested (per-item tooltip, no header icon)

- [x] 3.13 `packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/{risk-management.tsx, take-profit-and-stop-loss-input.tsx}` and `TakeProfit/take-profit.tsx` — the header is owned up the tree (input → container → picker) via `Carousel`/`CarouselHeader`. Remove the TP/SL description carousel pages and give each item label ("Take profit", "Stop loss") its own info-icon tooltip; **no** header info icon. Lift the commit + a state-backed dirty flag to the header owner; keep the existing ref-based disable (`take-profit-and-stop-loss-input.tsx` lines ~227-229) AND-ed with the gate; delete the child footer.

### 3F. Stake (headerless input inside a config carousel)

- [x] 3.14 `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-mobile.tsx` + `stake-input.tsx` — the carousel pages are stop-out **config** (`[input, stop out, stop out level]`), not descriptions, and the host uses a custom `StakeSheetHeader` (info icon already omitted on page 0). **Keep** the carousel; attach `closeAction`/`saveAction`/`isSaveActionDisabled`/`shouldCloseOnSaveActionClick` to page 0's `StakeSheetHeader`; remove the headerless `stake-input.tsx` footer. Keep the existing `isPrimaryButtonDisabled` conditions (`!displayAmount || is_loading_proposal || fe_stake_error || (should_show_stake_error && stake_error)`) as `isSaveActionDisabled`, AND-ed with a changed-value gate. No title tooltip (no description page).

## 4. Tests

- [x] 4.1 Update `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/duration.spec.tsx`: assert the header save is disabled on open, enabled after a wheel/tab change, commits the correct `onChangeMultiple` payload per tab on save, and that X/overlay dismissal does NOT call `onChangeMultiple`.
- [x] 4.2 Update `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/duration_container.spec.tsx`: switch footer-button assertions to `getByRole('button', { name: 'Save' })` on the header aria-label; assert the End-time footer Save is gone and the header save commits the `endtime` change.
- [x] 4.3 Update `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/day.spec.tsx`: assert header save keeps the browsed date/time and that dismiss restores the snapshot; save disabled while proposal error is set.
- [x] 4.4 For each Phase 2 sheet touched in section 3, cover the header behaviour in its co-located `__tests__/*.spec.tsx`: check disabled-on-open, enabled-after-change, commit-on-save (correct payload), and no-commit-on-dismiss (X/overlay/drag); convert footer-button-by-text queries (`Save`/`Apply`/`Select`/`Done`) to `getByRole('button', { name: 'Save' })` on the header aria-label. For carousel-drop sheets, assert the description tooltip opens on the info icon (title icon for single-description; per-item icon for Risk management) and that the check does not collide with it; for detail-page sheets (growth-rate, payout-per-point, and strike if applicable), assert the "Barrier"/"Max duration" carousel navigation still works.
- [x] 4.5 The four AutomationPanel mobile sheets (`strategy-selector-mobile`, `max-trade-stake-mobile`, `threshold-input-mobile`, `stake-multiplier-mobile`) have **no** co-located spec today — create `__tests__/*.spec.tsx` for each covering the same four header assertions.
- [x] 4.6 Run `npm run test:jest -- <path>` per touched spec during work, then `npm run test` (stylelint + eslint + jest) before pushing.

## 5. Docs & validation

- [x] 5.1 Reconcile `docs/action-sheet-header-actions-plan.md` with the final implementation (note any deviations discovered during Phase 1/2 verification). _"Implementation status" section: Phase 1 done; Phase 2 unblocked and re‑scoped to the carousel‑drop/tooltip design after the Phase‑1 review. The structural map is in `docs/spec-to-pr/findings/phase-2-carousel-header-actions-blocker.md` (now marked resolved); §3 below is re‑scoped to match._
- [x] 5.2 Run `npx -y @fission-ai/openspec validate implement-action-sheet-header-actions` and fix any structural errors. _Change is valid._

## 6. Verify (manual QA)

- [x] 6.1 Duration (matches approved screenshots): open on mobile → check disabled; change a wheel value → check enabled; tap check → commits and closes; reopen, change, dismiss via X/overlay/drag → value unchanged. Tap-to-select a wheel item → only moves the wheel, does not close/commit.
- [x] 6.2 End-time tab: single header check commits the end date/time; switching from a `duration` contract to End-time enables the check.
- [x] 6.3 Nested end date/time picker: save keeps the browsed value; dismiss restores the snapshot.
- [x] 6.4 Spot-check the Category B/C/D sheets still show their footer buttons (unchanged) to confirm scope was respected.
