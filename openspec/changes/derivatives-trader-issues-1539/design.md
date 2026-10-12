## Context

See proposal.md (Why) for the user-facing defect. The evidence chain behind the root cause:

- **The rows are not disabled.** quill's base `WheelPicker` (`node_modules/@deriv-com/quill-ui/dist/components/Atom/WheelPicker/base/index.js`) renders each row as a `DropdownItem` `<li>` with `disabled: n[t].value !== y`, where `y` is the centred value. The flag only adds the `quill-dropdown-item__selected--false__disabled--true` class and `quill-typography__color--disabled` to the label. There is no `disabled` attribute and no `pointer-events: none`. Every non-centred row is grey by design. `getTicksWheelOptions` (`AppV2/Utils/trade-params-utils.tsx:352`) emits "1 tick" as a plain option whenever `contracts_for` allows 1t.
- **The tap never reaches quill's row `onClick`.** This was reproduced on production (`dtrader.deriv.com`, Over/Under, 1HZ100V, Playwright Chromium, Galaxy S9+ touch emulation at 360×640, 2026-10-06). With 2 ticks committed, tapping the visible "1 tick" row left "2 ticks" centred and Save disabled. A `stopPropagation`/`preventDefault` trace on the `click` event pointed to `engine.pointerClick` in the quill-ui vendor chunk.
- **Why `pointerClick` blocks it.** quill bundles `@use-gesture` in `dist/hooks/useSwipeBlock/index.js`. With `filterTaps: true` (line ~1002), `bind()` registers a capture-phase `click` handler, `pointerClick(t) { !this.state.tap && t.detail > 0 && (t.preventDefault(), t.stopPropagation()) }` (line ~509). `state.tap` is only set in `pointerUp` after the engine handled the matching `pointerDown`. `shouldDetectSwipingOnContainer` binds this engine to the whole sheet, and `useBlockSheetSwipe` (`AppV2/Hooks/useBlockSheetSwipe.ts`, added in #1169) stops `onPointerDown`/`onTouchStart` from propagating out of the wheel. The engine therefore never sees a wheel press, `state.tap` stays false, and React's capture phase kills the click before the row's bubble-phase `onClick` runs.
- **Why the reporter saw it only on "1 tick".** Off-screen rows can still be reached by scrolling, and Playwright's `tap()` itself scrolls an off-screen target into view first, which fires quill's scroll listener. A visible non-centred row, such as "1 tick" above a centred "2 ticks", has no such fallback.

A second hypothesis was checked and ruled out: the quill wheel re-seeding from a stale draft on open. A jsdom harness that mounts the wheel in the same commit as the parent's open effect did show quill writing a stale value back. Production, however, re-centred correctly on the committed value after a dismiss, because the real `ActionSheet` mounts its content a commit later. No change is planned for it.

## Goals / Non-Goals

**Goals:**

- Restore tap-to-select on every wheel row inside a swipe-to-close sheet, keeping the guarantee that wheel gestures never drag or close the sheet.
- Keep the fix in the one shared hook every wheel sheet already spreads, with no call-site edits.

**Non-Goals:**

- Commit-on-tap. The header Save and dismiss-is-discard contract from #1169 stays.
- Changing quill's grey styling of non-centred rows. quill built-ins come first, and designers use quill in Figma.
- Patching or upgrading `@deriv-com/quill-ui`.
- Desktop. The hook is used only by mobile sheets, and desktop duration inputs don't use wheels.

## Decisions

**Decision: replay the tap in `useBlockSheetSwipe` with a same-row `pointerdown` → `pointerup` pairing.**

`onPointerDown` keeps calling `stopPropagation()` and also records the wheel row under the press: `(event.target as Element).closest('.quill-wheel-picker__data-item')`, held in a ref. `onPointerUp` looks up the row under the release. If it is the same element recorded at `pointerdown`, it calls `row.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' })`, the identical call quill's row `onClick` makes. `onPointerCancel` clears the ref. The scroll fires quill's own scroll listener, which calls the wheel's `setInputValues` exactly as a drag would. Every wheel's existing draft logic is reused untouched, including `DurationTimeWheel.onWheelChange`'s finer-column following and the multiplier ref guard.

A touch that becomes a native scroll fires `pointercancel` (the browser takes over panning), so a scroll is never replayed as a tap. That makes a movement threshold unnecessary. A `pointerup` on a different row, or outside any row, is ignored.

_Alternative considered:_ stop only `pointermove`/`touchmove` and let `pointerdown` reach the engine, so it can classify taps itself. Rejected because it depends on undocumented engine internals: `pointerCapture` calls `setPointerCapture` on the row, and `pointercancel` routes into `pointerUp`, where a drag could still emit and close the sheet. It would also re-open the drag-to-close-from-wheel bug the hook exists to prevent.

_Alternative considered:_ fix it per wheel (in `DurationTicksWheel` only). Rejected because all eight wheel sheets share the same hook and the same defect (inferred from code: identical `useBlockSheetSwipe` + `shouldDetectSwipingOnContainer` pairing). Fixing one would leave the hook's documented promise ("its items still take taps") false everywhere else.

_Alternative considered:_ remove `filterTaps`/`shouldDetectSwipingOnContainer`. Rejected: both are quill-owned props, and dropping container swipe would remove swipe-to-dismiss, since `showHandlebar={false}` already removed the handlebar surface.

**Decision: no de-duplication with quill's own `onClick`.** If the engine's `state.tap` is stale-true, for example right after tapping a tab chip, the native click may get through. quill's `onClick` and the replay then both issue the same smooth `scrollIntoView` to the same row, which converges on the same position. Guarding against it would need engine state we can't read. Not worth it.

**Decision: tests drive the hook directly and the real quill wheel inside Duration.** jsdom 20 (Jest's environment) has no `PointerEvent`, and `@use-gesture` falls back to mouse events there. The swallowing guard can't be reproduced faithfully in jsdom, and a test-side `fireEvent.click` has `detail: 0`, which the guard never blocks. The red/green proof is therefore the replay behaviour itself:

- A hook unit test checks that a `pointerdown` + `pointerup` on the same row calls `scrollIntoView`, and that cancel, a different row or a non-row target don't.
- A Duration integration test with the real quill wheel taps "1 tick" with `pointerdown`/`pointerup` and asserts that row is scrolled to the centre. It then simulates the resulting scroll (`scrollTop = 24`, quill's centre for index 0 with 72px top padding and 48px rows), asserts Save enables, and asserts Save commits `{ duration: 1, duration_unit: 't', expiry_type: 'duration' }`.

## Risks / Trade-offs

- [Risk] A quill-ui upgrade renames `.quill-wheel-picker__data-item`, and the replay silently stops. → Mitigation: the class name is already a shared contract in this repo (`DurationTimeWheel.scrollColumnToValue`, `trade-parameters.scss:484`), and the new hook test pins it.
- [Risk] `day.tsx` spreads the hook onto `ActionSheet.Portal` itself, not onto a wheel wrapper, so the new `onPointerUp`/`onPointerCancel` also land there. → Mitigation: the handlers act only when both press and release land on the same wheel row, so non-wheel content in that sub-sheet is unaffected. The End-time time picker inside it gains working taps.
- [Trade-off] Taps are replayed rather than unblocked at the source, which is quill's engine. → Accepted: a source fix needs a quill-ui release (out of scope, see deferral). The replay is about 15 lines in one hook and becomes a harmless no-op if quill ever stops swallowing the click.

## Migration Plan

Pure client-side behaviour fix, with no persisted data, flag or API. It ships through the normal release, and rollback is a plain revert.
