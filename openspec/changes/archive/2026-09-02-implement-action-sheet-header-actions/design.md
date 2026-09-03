## Context

See `proposal.md` — Why. `ActionSheet.Header` (quill-ui 1.24.9) exposes `closeAction`, `saveAction`, `isSaveActionDisabled`, and `shouldCloseOnSaveActionClick` (`node_modules/@deriv-com/quill-ui/dist/components/ActionSheet/header/index.d.ts`). `HeaderActionType = { icon?, onAction?, ariaLabel?, size? }`; the buttons are icon-only (check / X) with `ariaLabel` as the accessible name — there is no `content` (visible text) and no color override. `saveAction.onAction` runs only on button click; overlay/handlebar/close dismissal never invokes it — the same contract as the footer's `primaryAction`, so it is safe for committing.

Every Category A sheet already keeps a draft in local React state separate from the committed store value, so the changed-value gate needs no new plumbing beyond comparing the two. The sharp case is Duration:

- `duration.tsx#onClose` currently commits on **any** dismissal (drag-close), then `setOpen(false)`.
- The wheels' `handleItemClick` wrappers (`duration-wheel-picker.tsx`) commit-and-close on tap via `onRequestClose` → `pending_close` → `onClose` in `duration.tsx`.
- `container.tsx` renders a title-only `ActionSheet.Header` plus a separate End-time `ActionSheet.Footer` whose `onAction` commits an `endtime` change.
- `duration.tsx` already contains exact "unchanged" comparison logic inside `onClose` (normalized ticks/time comparison via `getTimeWheelSelectionFromDuration`), which is exactly what the dirty gate needs.

## Goals / Non-Goals

**Goals:**

- One reusable pattern — header `closeAction`/`saveAction` + `isSaveActionDisabled = !is_dirty || has_error` + `shouldCloseOnSaveActionClick` — applied consistently to every Category A sheet.
- For Duration, invert commit semantics (dismiss discards; save is the only commit path) while reusing the existing clamp/convert/compare logic verbatim.
- Keep the store owner (`duration.tsx`) as the single place that computes `handleSave` and `is_save_disabled`; `container.tsx` stays a dumb renderer.

**Non-Goals:**

- No store/API changes; no new persisted fields.
- No desktop editors (`DurationDesktop` and other `screen-large` paths) — mobile ActionSheet path only.
- No migration of Category B (informational), C (filter/reset), or D (coral error) sheets.
- No re-theming of the header actions beyond passing localized `ariaLabel`s.

## Decisions

**Decision: Compute `handleSave` and `is_save_disabled` in the store-owning component and pass them into the header renderer.**
For Duration, `duration.tsx` owns the store data, so `handleSave` and `is_save_disabled` (branching on the active tab) live there and are passed to `container.tsx` as props; `container.tsx` loses `onRequestClose`, `setSavedExpiryTime`, `setSavedExpiryDate` and gains `onSave` + `is_save_disabled`. Rationale: keeps commit logic co-located with the data it reads, mirroring today's `onClose`. Alternative — computing disabled state inside `container.tsx` — rejected: it would have to re-derive store values it doesn't own.

**Decision: `onClose` becomes dismissal-only; move the commit body into `handleSave`.**
`duration.tsx#onClose` reduces to `setOpen(false)`. The existing commit body (clamp `selected_time` via `clampTimeWheelSelection`, convert via `getDurationFromTimeWheelSelection`, guard `next.duration > 0`, sync saved expiry date/time, `onChangeMultiple({...next, expiry_type: 'duration'})`, analytics) moves into `handleSave`'s Ticks/Time branch; the End-time branch is exactly today's `container.tsx#onAction`. Drafts need no explicit reset because the existing `is_open` effect re-initializes `selected_ticks`/`selected_time`/expiry from committed values on every open. Rationale: the discard requirement falls out for free from the existing open-effect.

**Decision: Reuse the existing "unchanged" comparison to drive `is_save_disabled`.**
The normalized comparison already in `onClose` becomes the disabled predicate, per active tab: Ticks → `expiry_type==='duration' && duration_unit==='t' && duration===selected_ticks`; Time → `expiry_type==='duration'` and clamped wheel selection equals `getTimeWheelSelectionFromDuration(duration, duration_unit)` element-wise (also disabled when converted duration `<= 0`); End-time → `expiry_type==='endtime' && selected date/time === saved date/time`. Rationale: no new comparison logic, and it matches the previous commit-skip condition exactly.

**Decision: Remove wheel tap-to-select commit, not just its close call.**
Delete the `handleItemClick` wrapper `<div onClick=...>` and the `onRequestClose` prop from both `DurationTicksWheel` and `DurationTimeWheel`, and remove `pending_close`/`requestClose` from `duration.tsx`. Rationale: quill's `WheelPickerContainer` already scrolls a tapped item into place and fires `setInputValues`, which updates the draft — the manual index math existed only to commit synchronously before closing, which the new model forbids. Keeping it would double-apply the selection.

**Decision: Nested picker (`day.tsx`) snapshots on open and restores on dismiss.**
`handleDate` writes `selected_expiry_date`/time live (it drives proposal validation), so the sub-sheet snapshots `selected_expiry_date` + expiry time when it opens; save keeps the browsed value (today's "Done" behavior) and is disabled until browsed ≠ snapshot and while the proposal error `is_disabled` is set; X/drag restores the snapshot. Rationale: the header X must not silently keep a browsed-but-cancelled date, which today's drag-dismiss does.

**Decision: Pass localized `ariaLabel`s; drive disabled state via `isSaveActionDisabled`, not by omitting `onAction`.**
`closeAction={{ ariaLabel: localize('Close') }}`, `saveAction={{ onAction: handleSave, ariaLabel: localize('Save') }}`, `isSaveActionDisabled={is_save_disabled}`, `shouldCloseOnSaveActionClick`. Rationale: matches the footer contract already used (`shouldCloseOnPrimaryButtonClick`), and tests can target `getByRole('button', { name: 'Save' })` on the aria-label.

**Decision (Phase 2): carousel-hosted sheets drop the Carousel; sheet-level descriptions become a title-icon tooltip.**
Confirmed 2026-08-18 (Farabi, with Growth-rate/Risk-management screenshots). 10 of the 14 Phase-2 sheets are hosted by the shared `Carousel`/`CarouselHeader`, which owns the `ActionSheet.Header` and uses its edge icon slot for page navigation (ⓘ on page 0 → description page; back arrow on inner pages). Since the header now needs `closeAction`/`saveAction`, these sheets replace the `Carousel`/`CarouselHeader` with a plain `ActionSheet.Header`. A **sheet-level** description page (one `TradeParamDefinition` describing the sheet's parameter) moves to a click-triggered dark tooltip on an info icon (`LabelPairedCircleInfoMdRegularIcon` wrapped in quill-ui's `Tooltip`, `variant='base'`, `hasArrow`) — composed **inline into the `title` ReactNode**, not the Header `icon` prop (quill absolutely-positions that slot at the row edge, where it would collide with the check). **Multi-description** sheets (Risk management: Take profit + Stop loss) get **no** header icon; each item label carries its own info-icon tooltip. **Detail pages reached from content rows** (Growth rate's underlined "Barrier" / "Max duration") **keep** the carousel navigation with back arrow + retitling; only the header-info description page converts to a tooltip. `CarouselHeader`/`carousel_index` are removed only where no detail pages remain; `Carousel` itself stays for non-param components. Rationale: the header actions and the carousel nav both claim the header edges, so they cannot coexist; the tooltip is the approved affordance for the description that no longer has a page. Alternative — keeping the carousel and finding a third slot for the check — rejected: the screenshots show no carousel for these sheets and quill offers no such slot.

**Decision (Phase 2): wheel sheets that keep their draft in `useRef` move it to `useState` for a reactive dirty gate.**
`strike-wheel`, `multiplier-wheel-picker`, and `growth-rate-picker` hold the draft in a `useRef`, which does not re-render when it changes, so `isSaveActionDisabled` cannot react to it. The draft moves to `useState` (or a mirrored state value) so the changed-value comparison drives the header check. Rationale: the header check must enable/disable live as the wheel moves; a ref cannot trigger that re-render.

**Decision (Phase 2): `LastDigitPrediction` gains a header (it has none today).**
It renders `ActionSheet.Root` → `Content` + `Footer` with no `Header`. Migrating adds an `ActionSheet.Header` with `closeAction`/`saveAction` and removes the footer, matching the other value editors. Rationale: parity of the commit affordance across Category A.

## Risks / Trade-offs

- **Users accustomed to drag-to-commit lose their change on dismiss.** → Intended per the confirmed design; the enabled check is the clear commit affordance and the disabled-until-dirty state signals "nothing to save".
- **Nested picker discard edge:** restoring `selected_expiry_date` re-runs the `[selected_expiry_date]` effect, which recomputes the time by its normal rules — a hand-picked custom time set _before_ browsing dates is recomputed, not restored. → Accepted for Phase 1 (Farabi, 2026-08-18); still strictly better than today (no restore at all). Revisit only if QA flags it.
- **Phase 2 sheets vary** (some have extra disable conditions). → Each sheet's commit/dismiss semantics are verified individually before swapping; the dirty gate is AND-ed with, never replaces, existing conditions.
- **quill-ui 1.24.8 regression.** → Pinned to 1.24.9 across all three packages (already done); 1.24.8 must never be reintroduced.

## Migration Plan

Phased, matching the plan doc's rollout:

1. **Phase 0 — version bump:** done ✅ (all packages on 1.24.9).
2. **Phase 1 — Duration:** `duration.tsx`, `container.tsx`, `duration-wheel-picker.tsx`, `day.tsx` + tests, matching the approved screenshots. **Review checkpoint** before Phase 2.
3. **Phase 2 — remaining Category A sheets:** verifying each sheet's semantics individually. Only 2 sheets (`risk-management-item`, `date-picker`) are clean own-header prop-swaps; 10 are hosted by the shared `Carousel`/`CarouselHeader` (whose trailing/leading edge already carries the info/back-nav icon), 1 is headerless (`LastDigitPrediction`), and TP/SL is nested. Carousel sheets drop the `Carousel`/`CarouselHeader` for a plain `ActionSheet.Header` with `saveAction`/`closeAction` and move each **sheet-level** `TradeParamDefinition` description into a click-triggered tooltip on an info icon composed inline into the `title` ReactNode (never the Header `icon` slot, which quill pins to the row edge under the check). **Multi-description** sheets (Risk management) get a per-item info-icon tooltip on each label instead of a header icon. **Detail pages reached from content rows** (Growth rate's Barrier / Max duration) keep the carousel navigation. See the carousel decisions below and `docs/action-sheet-header-actions-plan.md`.

Pure front-end change; no data migration or feature flag. Rollback is a straightforward revert of the code changes (the 1.24.9 pin stays, since 1.24.9 is a strict bug-fix over 1.24.7-era usage).

## Open Questions

None that change the specs or approach. The single scoping decision (whether Phase 2 rides in this change) is surfaced in `tasks.md` — Open Questions with a recommended default, and the task list is written to that default so it is complete as-is.
