## Open Questions

### Should the tap fix live in the shared `useBlockSheetSwipe` hook or only in the Duration wheels?

- [recommended] Shared hook (all eight mobile wheel sheets have the same swallowed-tap defect, and the hook's own comment promises taps work)
- Duration ticks/time wheels only (smallest blast radius, but leaves Multiplier, Growth rate, Strike, Payout per point, Deal cancellation and the End-time time picker broken)

### Should tapping a wheel row commit the value immediately?

- [recommended] No: a tap only moves the draft, and header Save still commits (keeps the #1169 Save/dismiss-is-discard contract, so no product sign-off is needed)
- Yes: commit on tap for the ticks wheel only (reverses #1169 for one sheet, so product must agree)

Plan below uses the recommended answers. See `design.md` for the root-cause evidence (live trace to quill's bundled `@use-gesture` `pointerClick` guard).

## 1. Failing tests first

- [x] 1.1 [WPT-001][WPT-002] Create `packages/trader/src/AppV2/Hooks/__tests__/useBlockSheetSwipe.spec.tsx`. Build a harness component that spreads `useBlockSheetSwipe()` onto a `div`. The `div` wraps a `ul` of `li.quill-wheel-picker__data-item` rows plus one non-row `span`, and the whole thing sits inside a parent `div` with `onPointerDown`/`onTouchStart` spies. Spy on `HTMLElement.prototype.scrollIntoView`. Use `fireEvent.pointerDown`/`pointerUp`/`pointerCancel`; jsdom 20 has no `PointerEvent`, but React still receives the native `pointerdown` type. Cases:
    - (a) `[WPT-001]` a press and release on the same row calls `scrollIntoView` once, on that row (`mock.contexts[0]`), with `{ block: 'center', behavior: 'smooth', inline: 'nearest' }`.
    - (b) `[WPT-002]` `pointerDown` and `touchStart` on a row never reach the parent spies.
    - (c) `[WPT-002]` a `pointerCancel` between press and release produces no call.
    - (d) `[WPT-002]` a press on one row released on another produces no call.
    - (e) `[WPT-002]` a press and release on the non-row `span` produces no call.

    Record proof-of-red inline here (expected for (a): `Red: tap on the same row scrolls it to centre — expected scrollIntoView called once, got 0 calls`). (b) passes before the change, since stopPropagation already exists; note that as `characterization: existing propagation block, guarded so the rewrite can't drop it`.

    Red: `[WPT-001] scrolls a tapped row to the centre the way the wheel row click does` — expected scrollIntoView called once, got 0 calls.
    Characterization: (b) `[WPT-002] keeps a press on a row from reaching the sheet` (existing propagation block); (c)–(e) also pass pre-fix since nothing replays taps yet — they guard the replay against over-firing.

- [x] 1.2 [WPT-001] In `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/duration.spec.tsx`, add a mobile case that uses the existing `mockDurationMobile()` helper and the real quill wheel. Set `duration: 2`, `duration_unit: 't'`, `expiry_type: 'duration'`, `duration_min_max.tick: { min: 1, max: 10 }`, and stub `HTMLElement.prototype.scrollIntoView` with `jest.fn()`. Then:
    1. Open Duration.
    2. Fire `pointerDown` + `pointerUp` on `within(screen.getByTestId('dt_duration_ticks_wheel')).getByRole('option', { name: '1 tick' })` and assert `scrollIntoView` ran on that row.
    3. Emulate the resulting scroll: set the wheel's `.quill-wheel-picker__data-items` `scrollTop = 24` (index 0 centred: 72px top padding, 48px rows) and `fireEvent.scroll` it.
    4. Assert the header Save button is enabled, click it, and assert `mockOnChangeMultiple` was called with `{ duration: 1, duration_unit: 't', expiry_type: 'duration' }`.

    Add a sibling case where the same tap and scroll are followed by `dt-actionsheet-overlay` instead of Save, and assert `mockOnChangeMultiple` is not called. That sibling is a characterization case (dismiss already discards). Record `Red:` for the first case inline here.

    Red: `[WPT-001] selects the tapped "1 tick" row and commits it on Save (mobile)` — expected scrollIntoView called on the "1 tick" row, got no calls (`mock.contexts` `[]`).
    Characterization: `[WPT-001] commits nothing when the sheet is dismissed after the tap (mobile)` — dismiss already discards; it fails pre-fix only at the shared tap assertion.

- [x] 1.3 [WPT-001] In `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/container.spec.tsx` (real quill, `scrollIntoView` already mocked), render with `tab: 'time'` and `selected_time: [0, 30, 0]`. Fire `pointerDown` + `pointerUp` on a visible non-centred minutes row, e.g. the "31 min" option (labels come from `getTimeWheelColumnOptions`) in the minutes column of `dt_duration_time_wheel`, and assert `scrollIntoView` ran on that row. Then set the minutes list's `scrollTop` to that row's centred offset and `fireEvent.scroll` it, and assert `setSelectedTime` was called with minutes `31`. Record `Red:` inline here.

    Red: `[WPT-001] centres a tapped minutes row and makes it the minutes draft` — expected scrollIntoView called on the "31 min" row, got no calls (`mock.contexts` `[]`).

## 2. Implementation

- [x] 2.1 [WPT-001][WPT-002] In `packages/trader/src/AppV2/Hooks/useBlockSheetSwipe.ts`, keep `onTouchStart` as a plain `stopPropagation`. Change `onPointerDown` to also store `(event.target as Element).closest?.('.quill-wheel-picker__data-item')` in a `useRef`. Add `onPointerUp`: if the row under the release is the stored row (and non-null), call `row.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' })`, then clear the ref. Add `onPointerCancel`, which clears the ref. Keep all handlers `useCallback`-stable, return `{ onPointerDown, onPointerUp, onPointerCancel, onTouchStart }`, and do not add `mousedown` (per the existing comment). Rewrite the doc comment tersely: say the sheet's `filterTaps` click guard cancels clicks whose press it never saw, so the hook replays a same-row tap the way quill's row `onClick` does. Remove the false "its items still take taps" sentence. Run 1.1, 1.2 and 1.3 green.
- [x] 2.2 Confirm the eight call sites need no edit and still type-check against the widened return. The call sites are `Duration/duration-wheel-picker.tsx`, `Duration/timepicker.tsx`, `Duration/day.tsx` (spread onto `ActionSheet.Portal`), `Multiplier/multiplier-wheel-picker.tsx`, `GrowthRate/growth-rate-picker.tsx`, `Strike/strike-wheel.tsx`, `PayoutPerPoint/payout-per-point-wheel.tsx` and `RiskManagement/deal-cancellation.tsx`, all under `packages/trader/src/AppV2/Components/TradeParameters/`. Run their co-located specs as a targeted check: `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/{Duration,Multiplier,GrowthRate,Strike,PayoutPerPoint,RiskManagement}`.

## 3. Documentation

- [x] 3.1 Add one Gotchas bullet to `CLAUDE.md`. It should cover four points. First, in a `shouldDetectSwipingOnContainer` sheet, quill's bundled `@use-gesture` (`filterTaps`) cancels every click whose `pointerdown` it didn't see. Second, `useBlockSheetSwipe` therefore both blocks the press and replays a same-row tap via `scrollIntoView`. Third, a new wheel or tappable child inside such a sheet must spread `useBlockSheetSwipe()` rather than stopping `pointerdown` itself. Fourth, the repo's own handlers can't rely on `onClick` there.

## Closing gates

No checkboxes. The engine's VERIFY stage runs the repo's full gates (`npm run test`, `npm run test:typescript`), and SHIP validates the OpenSpec change. QA owns the on-device check: Android Chrome under 480px, tapping "1 tick" on Over/Under, Matches/Differs, Even/Odd and Rise/Fall, then Save.
