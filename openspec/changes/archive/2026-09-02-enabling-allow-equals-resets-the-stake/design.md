## Context

See proposal.md — Why. The mechanics: the Allow equals control calls `onChange({ target: { name: 'is_equal', value } })` (`packages/trader/src/AppV2/Components/TradeParameters/AllowEquals/allow-equals.tsx`, both the desktop toggle and the mobile minimized field). In `TradeStore.onChange`, after `processNewValuesAsync` applies `is_equal`, a pipeline step flips the sub-type:

```ts
if (name === 'is_equal' && this.contract_type?.includes(TRADE_TYPES.RISE_FALL)) {
    await this.setTradeSubType(this.is_equal ? TRADE_TYPES.RISE_FALL_EQUAL : TRADE_TYPES.RISE_FALL);
}
```

`setTradeSubType` is the fenced writer for same-category sub-toggles; it calls `onChange({ name: 'contract_type', value: <rise_fall|rise_fall_equal> })`, passing the prior contract type as `obj_old_values`. That second pass reaches the stake-reset block in `processNewValuesAsync` (~lines 1922–1956):

```ts
const has_contract_type_changed =
    obj_new_values.contract_type &&
    obj_old_values?.contract_type &&
    obj_new_values.contract_type !== obj_old_values.contract_type;
```

`rise_fall` ≠ `rise_fall_equal`, so `has_contract_type_changed` is true, `should_reset_amount` is true, and `obj_new_values.amount` is overwritten with `default_stake` (or a preset override). That is the reset.

Duration does **not** reset on the same toggle, because the store already guards duration by group: `applyDefaultDuration` only runs when `current_duration_group` changes, and `mapContractTypeToDurationPresetKey` maps both `rise_fall` and `rise_fall_equal` to the same `'rise_fall'` group. The stake reset simply lacks the equivalent guard. The store already has the right predicate for it: `isSameTradeTypeGroup(a, b)` (~line 1172), which returns true for `rise_fall` vs `rise_fall_equal` via `checkContractTypePrefix` / `isRiseFallContract`.

## Goals / Non-Goals

**Goals**

- Preserve the user's stake across an Allow equals toggle, matching how duration already behaves.
- Fix at the root (the stake-reset gate), reusing an existing predicate rather than adding a special case.

**Non-Goals**

- Changing the Allow equals UI, the `is_equal` value, or the `setTradeSubType` identity fence.
- Changing stake behaviour for genuine trade-type switches (different group) or symbol switches.
- Reworking how `default_stake` is sourced from `contracts_for`.

## Decisions

- **Gate the stake reset on the trade-type group, reusing `isSameTradeTypeGroup`.** Make `has_contract_type_changed` false when the old and new contract types are in the same trade-type group, so a within-family sub-type flip (Allow equals) no longer triggers the reset:

    ```ts
    const has_contract_type_changed =
        obj_new_values.contract_type &&
        obj_old_values?.contract_type &&
        obj_new_values.contract_type !== obj_old_values.contract_type &&
        !this.isSameTradeTypeGroup(obj_old_values.contract_type, obj_new_values.contract_type);
    ```

    This is the smallest change that fixes the root cause and mirrors the existing duration-group guard. `has_symbol_changed` is untouched, so symbol switches still reset. Alternatives considered:
    - _Narrow, Rise/Fall-only guard_ (`!(isRiseFallEqual(old) && isRiseFallEqual(new))` using the existing helper in `Helpers/allow-equals.ts`) — rejected as the default because it hard-codes one family and leaves the identical latent bug for other same-group sub-toggles; kept as the fallback in Open Questions for reviewers who want zero collateral behaviour change.
    - _Suppress the reset from the Allow equals call site_ (e.g. pass a flag through `setTradeSubType`) — rejected: threads new state through a fenced writer and the pipeline for a condition the store can already derive from the two contract types.
    - _Snapshot and restore the stake around the toggle in the component_ — rejected: papers over the store bug in the UI and would need repeating for every same-group sub-toggle.

- **Let the group guard also cover the co-located take-profit / stop-loss reset.** The `if (has_contract_type_changed) { reset TP/SL }` branch shares the same flag. For Rise/Fall this is a no-op (no TP/SL). For other same-group direction toggles it means TP/SL is preserved too, which is consistent with "a sub-type toggle is not a trade-type switch." This is a deliberate, beneficial consequence, not an accident.

## Risks / Trade-offs

- **Collateral behaviour change for other same-group sub-toggles (Turbos Long↔Short, Vanilla Call↔Put, Multipliers Up↔Down).** With the group guard, those direction toggles preserve the stake (and TP/SL) instead of resetting to default. → This is the same class of fix as the reported bug and is the desirable behaviour; the stake preset override for high-min Turbos symbols still applies on the symbol-switch path (`has_symbol_changed`), so a switched-to symbol still starts at a valid stake. Reviewers who want to keep the change strictly limited to Allow equals can adopt the narrow Rise/Fall-only variant (Open Questions).
- **A test somewhere asserts the old "reset on any contract_type change" behaviour.** → Grep of `trade-store.spec.ts` shows the `setTradeSubType` / `is_equal` tests assert the sub-type flip only, not a stake reset; run the trader Jest suite to confirm nothing else depends on the old reset.

## Migration Plan

- Single-file logic change plus added unit tests. No data migration, config, or flag.
- Rollback: revert the added `&& !this.isSameTradeTypeGroup(...)` clause.

## Open Questions

- **Scope of the guard — same-group (recommended) vs Rise/Fall-only.** The recommended fix gates on `isSameTradeTypeGroup`, which also preserves stake for Turbos/Vanilla/Multipliers direction toggles. A reviewer who wants to limit the fix strictly to the reported Allow equals bug can instead gate on the existing `isRiseFallEqual` helper for both old and new contract types, leaving all other trade types byte-for-byte as they are today. Recorded here (and in tasks.md) because it changes blast radius, not the specs — the `allow-equals-toggle` spec holds under either choice. **Recommended default: the same-group guard.**
