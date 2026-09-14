## Context

The Automate Stake multiplier editor is split into two breakpoint variants that share `automation-config.ts` constants and copy but not their render bodies:

- Mobile: `StakeMultiplier/stake-multiplier-mobile.tsx` builds `range_message` (`Range {{min}} - {{max}}` for Martingale, `Minimum 1` for D'Alembert) and passes `message={error || range_message}` to the input `TextField` (line 137). Its Martingale validation floor is `MULTIPLIER_MIN` (line 75).
- Desktop: `StakeMultiplier/stake-multiplier-desktop.tsx` passes `message={error || undefined}` (line 81) — no hint — and its Martingale validation floor is `1` (line 48), inconsistent with mobile.

Both import from `../automation-config`. The bounds are no longer client constants: `auto_list_strategies` sends `multiplier: { exclusiveMinimum: 1, maximum: 10 }`, so the enforced rule is `> 1 and <= 10` — the upper bound is _inclusive_. `MULTIPLIER_MIN`/`MULTIPLIER_MAX` survive only as a private fallback behind `DEFAULT_MULTIPLIER_BOUNDS`, used before the schema resolves or for a bound it omits. The strings already ship for mobile, so no new translation keys are needed. See proposal.md — Why.

## Goals / Non-Goals

**Goals:**

- Desktop input renders the same strategy-aware `range_message` as mobile.
- Both editors enforce the bounds resolved per parameter from the schema, matching each other and the shown hint.
- Add the missing desktop co-located test.

**Non-Goals:**

- The multiplier bounds are now schema-resolved (exclusive min, inclusive max). Presets are filtered against them. D'Alembert bounds unchanged.
- No refactor to merge the mobile/desktop variants into one component (out of scope; each keeps its own sheet vs popover chrome).
- `buildStrategyParameters` now emits params in their schema-declared JSON type. `TAutoStrategyParameterProperty` gains `exclusiveMinimum`.

## Decisions

- **Mirror the mobile `range_message` in the desktop component rather than extract a shared helper.** The two variants already duplicate copy and constants and diverge in chrome; a one-liner ternary matched to the existing mobile code (lines 42–46) is the smallest, most readable change (KISS/DRY-by-consistency) and keeps the diff reviewable against the mobile source of truth. A shared extraction is a larger refactor with no behavior gain — deferred as a Non-Goal.
- **Enforce the resolved bounds on both save paths** via the shared `getStakeMultiplierError`, which branches on the _parameter key_ rather than the strategy and returns one message — "The value must be greater than 1 and no more than 10." with the current schema — for a blank, non-numeric, under- or over-shooting multiplier. The lower bound is exclusive (`exclusiveMinimum`), the upper inclusive (`maximum`), so `10` is valid. The `unit` increment keeps its `num < 1` floor and "Increment must be at least 1" copy, and does not consume the resolved bounds.
- **Resolve bounds from the schema, not constants.** `useAutomationConfig.getParamBounds(key)` reads `parameters.properties[key]`, preferring `exclusiveMinimum` over `minimum` and falling back _per end_ to `DEFAULT_MULTIPLIER_BOUNDS`, so a partial schema cannot leave an end unbounded. Results are cached per key so the object identity stays stable and consumers' `useMemo`s hold.
- **`TStakeMultiplierBounds` carries the lower bound's inclusivity** as a flag, since the schema can express that end either way; the upper bound is always inclusive (`maximum`).
- **Copy is derived, never hardcoded.** `getStakeMultiplierRangeText(bounds, localize)` produces one sentence used by the hint, the inline error and the tooltip, so the three cannot disagree.
- **Preset chips are filtered** through `getStakeMultiplierPresets(bounds)`: chips commit directly, bypassing the input's validation, so an unfiltered list could offer values the schema rejects.

## Risks / Trade-offs

- [Existing desktop drafts of `1` become invalid under the exclusive floor] → Acceptable and intended: `1` is not strictly greater than the schema's `exclusiveMinimum`, so it falls outside the range the server itself enforces (`auto_start` returns `InvalidArgument: must be > 1 and <= 10`). No persisted value is silently mutated — the user must re-save a valid value.
- [The `unit` (increment) field receives a `bounds` prop it does not consume] → Deliberate: `unit` has no bounds in the schema, so a resolved value for it would be the _multiplier's_ fallback, and applying that would cap the increment at 10 and reject `1` — reintroducing the parameter/strategy conflation this change removed. The increment keeps its fixed floor of 1 until the schema describes it.
- [Copy drift between the two duplicated variants] → Mitigated by using the identical `i18n_default_text` / `localize` strings mobile already uses, and by the new desktop test asserting the rendered hint text.

## Migration Plan

Pure front-end component change; no data migration. Rollback is reverting the component and test edits.
