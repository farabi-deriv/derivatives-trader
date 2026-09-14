## Open Questions

### Should the desktop Martingale validation floor be tightened to MULTIPLIER_MIN (2) as part of this change?

- [recommended] Yes — align desktop with mobile so the new "Range 2 - 10" hint is enforceable and both breakpoints behave identically (the mismatch is directly exposed by adding the hint)
- No — add only the visual hint and leave desktop accepting values down to 1 in a follow-up change (keeps the diff purely presentational but leaves hint and validation contradictory)

> **Resolved:** neither option — the range is now schema-resolved (`exclusiveMinimum: 1`, `maximum: 10`, i.e. `> 1 and <= 10`), not a fixed `MULTIPLIER_MIN` of 2.

## 1. Implement desktop range hint and validation (superseded by schema-driven design)

> **Note:** Tasks 1.1–1.4 below were the original implementation steps and are kept as a
> historical record. The shipped design superseded them: bounds are resolved from the
> `auto_list_strategies` schema via `getParamBounds(key)`, validation uses the shared
> `getStakeMultiplierError` branching on `param_key` (not strategy), and the copy reads
> "The value must be greater than 1 and no more than 10." (inclusive max). `MULTIPLIER_MIN`
> and `MULTIPLIER_MAX` are module-private fallbacks, never imported by either editor.

- [x] 1.1 ~~Add `MULTIPLIER_MIN` to the import~~ → bounds now come from the schema; the constant is a private fallback.
- [x] 1.2 ~~Build a strategy-aware `range_message`~~ → `range_message` derives from `getStakeMultiplierRangeText(bounds, localize)`, keyed on `param_key` not strategy.
- [x] 1.3 Wire `message={error || range_message}` into the input. _(This step shipped as described.)_
- [x] 1.4 ~~Change the floor check to `num < MULTIPLIER_MIN`~~ → replaced by `getStakeMultiplierError(value, param_key, localize, bounds)` with `isWithinBounds`, honouring the schema's inclusive max.

## 2. Test coverage

- [x] 2.1 Create `packages/trader/src/AppV2/Components/AutomationPanel/StakeMultiplier/__tests__/stake-multiplier-desktop.spec.tsx` mirroring the mobile spec's structure.
- [x] 2.2 Assert the `multiplier` editor renders the "The value must be greater than 1 and no more than 10." hint and the `unit` editor renders "Minimum 1" when no error is present.
- [x] 2.3 Assert entering an out-of-range multiplier and saving shows "The value must be greater than 1 and no more than 10." and does not call `onSelect`; assert an in-range value (including `10`, the inclusive maximum) calls `onSelect` and closes the popover.
- [x] 2.4 Assert the desktop-only branch behaviours the mobile spec already covers: the above-max rejection via `isWithinBounds`, the D'Alembert floor staying at 1, and error recovery (Save re-enables once the value is corrected).

## 3. Verify

- [x] 3.1 Run `npm run test:jest -- packages/trader/src/AppV2/Components/AutomationPanel/StakeMultiplier` and confirm the new desktop spec and the existing mobile spec pass.
- [x] 3.2 Run `npm run test:eslint-all` (or lint the two touched files) and `npm run prettify` on the changed files to confirm no lint/format errors.
