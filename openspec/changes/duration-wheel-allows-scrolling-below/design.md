## Context

`DurationTimeWheel` (`packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-wheel-picker.tsx`) renders up to three quill wheel columns (hours, minutes, seconds) from `data`, a `useMemo` keyed only on `[visible_units, intraday]`. Each column's option array comes from `getTimeWheelColumnOptions(unit, visible_units, intraday)` (`packages/trader/src/AppV2/Utils/trade-params-utils.tsx` ~L417-440), which computes a floor for `unit` from `intraday.min` minus the _maximum natural capacity_ of every other visible unit. Because hours and minutes can cover almost any intraday minimum on their own, this floor collapses to 0 for seconds whenever seconds is combined with a coarser unit, even though the actually-selected hours/minutes are both 0. The wheel renders 0-59 seconds; scrolling below the true floor (e.g. 15) is visually possible but gets corrected 300ms after scrolling stops by `clampTimeWheelSelection`, which uses a _different_, already-correct formula (`getTimeWheelColumnRange`, ~L391-408) that accounts for the coarser units' actual current selection.

The static `[visible_units, intraday]` memo key was a deliberate choice: recomputing a column's options only when the set of visible units or the contract's bounds change means scrolling one column never rebuilds another, so no column's scroll position jumps as a side effect of an unrelated column's live scroll. Any fix has to keep that property for the column the user is actively touching.

## Goals / Non-Goals

**Goals:**

- Never render a value on the merged time wheel that is unreachable given the intraday min/max and the other columns' current selection.
- Preserve today's guarantee that scrolling a column never changes that same column's own rendered option list mid-scroll.
- Reuse the existing, already-tested `getTimeWheelColumnRange` formula rather than maintaining two divergent range calculations.

**Non-Goals:**

- Changing the ticks wheel (`getTicksWheelOptions`/`getTickWheelRange`) — it already bounds its list correctly.
- Changing desktop's duration inputs — they already validate inline per the issue's technical notes.
- Removing `clampTimeWheelSelection` — it remains the safety net for a stored/carried-over combination that starts outside range (DTW-003).
- Re-architecting how `selected_time` is owned or persisted.

## Decisions

**Decision: `getTimeWheelColumnOptions` takes the current `selected` array and delegates its bounds to `getTimeWheelColumnRange`.**

`getTimeWheelColumnRange(unit, visible_units, intraday, selected)` already computes exactly the right floor — seconds contributed by strictly-coarser selected units subtracted from `intraday.min`, with strictly-finer units' maximum capacity (59 each) still covering the remainder — and the right ceiling, and it's covered by existing tests (`trade-param-utils.spec.tsx` `describe('getTimeWheelColumnRange')`). Rather than keep two formulas in sync, `getTimeWheelColumnOptions` becomes a thin wrapper: call `getTimeWheelColumnRange` for `{min, max}`, then build the `{value, label}` array over that range. This is a net simplification (removes the `getNaturalCap`/`others_capacity` duplicate logic) as well as the bug fix.

_Alternative considered:_ keep `getTimeWheelColumnOptions`'s own formula and just change what it treats as "capacity" for coarser units. Rejected — it would still duplicate `getTimeWheelColumnRange`'s logic with a second, slightly different implementation to maintain, which is exactly the kind of drift that let this bug ship (the two functions already disagreed).

**Decision: a column's own selected value never appears in its own bound.**

`getTimeWheelColumnRange` already excludes `unit` itself from both `prefix_seconds` (strictly coarser) and `finer_capacity_seconds` (strictly finer). So even though `DurationTimeWheel`'s `data` memo now depends on `selected_time` as a whole, the _value_ of `data[column]` a given column computes is unaffected by that same column's own current selection — only a change to a _coarser_ column's value can move a finer column's floor. This is what preserves "scrolling a column never rebuilds that column's own list."

_Alternative considered:_ key the memo more narrowly, e.g. only on the coarser prefix relevant to each column, to avoid recomputing at all when an unrelated finer column changes. Rejected as unnecessary complexity — the recomputation is a handful of small array builds (≤60 items each) triggered by user-paced wheel events, not a hot path, and narrower memoization would need per-column keys that reintroduce exactly the kind of bespoke bookkeeping this fix is trying to remove. Revisit only if profiling shows it matters.

**Decision: recompute `data` on every `selected_time` change, accepting that a coarser-column edit reflows finer siblings' rendered ranges live.**

When hours or minutes changes, the newly-computed floor for the finer column(s) can change _while the user is mid-drag on the coarser column_, since quill fires `setInputValues` per settled item during a drag gesture, not just on release. This is the issue's own suggested direction ("bounding the lowest rendered value using the current selection of coarser units rather than their full natural capacity") and is judged acceptable because: (a) `onWheelChange` (duration-wheel-picker.tsx ~L130-140) already has to keep a finer column's _selected_ value in sync with a relaxed/tightened floor when a coarser column changes, so the finer column's rendered range changing at the same moment is consistent with, not additional to, existing behavior; (b) the user's attention and touch point are on the coarser column being dragged, not the finer column being silently corrected; (c) the alternative — leaving the bug in place for the sake of untouched sibling columns during a coarser drag — is strictly worse UX than the reported bug. This trade-off is inherent to the fix the issue asks for, not an open design choice.

## Risks / Trade-offs

- [Risk] Rebuilding a finer column's option array while the user is actively dragging a coarser column could cause a visible reflow of a column the user isn't touching → Mitigation: the reflow only occurs when the coarser column's _value_ actually changes (not on every pixel of scroll), matches the existing follow-the-floor behavior already in `onWheelChange`, and is scoped to the rare case of combining hours/minutes with seconds; single-unit and two-unit-without-crossing-the-floor cases are unaffected. No further mitigation is planned in this change; a follow-up can revisit if manual/QA testing surfaces jank (see deferral).
- [Risk] `getTimeWheelColumnOptions`'s signature change could be missed by any other caller → Mitigation: it has exactly one call site (`duration-wheel-picker.tsx`'s `data` memo); grep confirms this before implementation.
- [Trade-off] `data` is no longer referentially stable across `selected_time` changes (previously a single stable array for the sheet's lifetime) → Accepted: quill's `WheelPickerContainer` already re-renders on `inputValues`/`data` changes for other reasons (e.g. `clampTimeWheelSelection` already mutates `selected_time` after settle), so this is not a new class of re-render, only a higher frequency of harmless ones.

## Migration Plan

Not applicable — this is a pure client-side rendering fix behind existing component boundaries, no persisted data shape changes, no feature flag. Ship behind the normal PR/release process; rollback is a plain revert.
