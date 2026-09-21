## Why

On mobile web, the Duration action sheet's merged hour/minute/second wheel (`DurationTimeWheel` in `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-wheel-picker.tsx`) renders each column's option list independently of the other columns' _current_ selection. `getTimeWheelColumnOptions` (`packages/trader/src/AppV2/Utils/trade-params-utils.tsx` ~L417-440) computes a column's floor from the other visible columns' full natural _capacity_, not what is actually dialled in. For a contract whose intraday minimum is 15 seconds and whose duration picker offers hours + minutes + seconds, the hours/minutes columns' capacity easily covers the 15s floor on their own, so the seconds column renders from 0 even while hours and minutes both sit at 0. The user can scroll into 0-14 seconds, a range that is never a valid selection at that hour/minute combination, and ~300ms after scrolling stops `clampTimeWheelSelection` silently snaps it back to 15. This reads as a glitch (GitHub #1077) and only affects seconds combined with a coarser unit — a contract offering seconds alone already starts its wheel at the minimum, and the equivalent ticks wheel (`getTicksWheelOptions`/`getTickWheelRange`) already bounds its list to `[min, max]`.

## What Changes

- `getTimeWheelColumnOptions` stops deriving its floor from the other columns' maximum capacity and instead reuses `getTimeWheelColumnRange`'s existing formula — the same one already used to clamp a settled selection — so a column's rendered floor reflects what the _currently selected_ coarser units (hours, then minutes) actually leave for it, plus the finer columns' untouched maximum capacity as before. `getTimeWheelColumnOptions` takes the current selection as a parameter and no longer duplicates the natural-cap/others-capacity calculation `getTimeWheelColumnRange` already performs.
- `DurationTimeWheel` recomputes each column's rendered option list whenever the selection changes (not just when the visible units or intraday bounds change), so a coarser-column edit that relaxes or tightens a finer column's floor is reflected immediately in what's rendered, not only in the post-settle clamp.
- No visible values fall outside `[intraday.min, intraday.max]` for the currently selected coarser units: for the reported case (hours=0, minutes=0, 15s minimum), the seconds wheel now renders 15-59 instead of 0-59, with nothing below 15 to scroll into.
- The now-redundant post-scroll snap-back for a column's own out-of-range floor no longer fires in the common case, because the invalid values are never rendered; `clampTimeWheelSelection` is unchanged and keeps handling genuine cross-column recombination (e.g. a stored selection from before this fix, or reaching the top of the intraday max).

## Capabilities

### New Capabilities

- `duration-time-wheel`: bounds on what the mobile Duration action sheet's merged hour/minute/second wheel renders per column, given the contract's intraday min/max and the other columns' current selection.

### Modified Capabilities

(none — no existing spec covers this wheel's rendered range today)

## Impact

- `packages/trader/src/AppV2/Utils/trade-params-utils.tsx` — `getTimeWheelColumnOptions` signature and implementation change (now takes `selected`); `getTimeWheelColumnRange`, `clampTimeWheelSelection`, `getTicksWheelOptions`/`getTickWheelRange` unchanged.
- `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-wheel-picker.tsx` — `DurationTimeWheel`'s `data` memo gains `selected_time` as a dependency and passes it through to `getTimeWheelColumnOptions`.
- `packages/trader/src/AppV2/Utils/__tests__/trade-param-utils.spec.tsx` — new/updated cases for `getTimeWheelColumnOptions`.
- No API, desktop, or ticks-wheel impact: desktop already validates inline (per the issue's technical notes) and the ticks wheel already bounds its rendered list.
