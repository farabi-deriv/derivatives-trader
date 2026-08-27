## Context

`selectMarketAndTradeType` in `packages/trader/src/Stores/Modules/Trading/trade-store.ts` (~L1097-L1149) is the single writer for every market/trade-type commit, including the "replace this tab" flow started by tapping the active tab (`market-tabs.tsx` L252-266 sets `this.replacing_market`, cleared on the next commit or on selector close).

At commit time it already computes two pieces of state before deciding what to do to the strip:

- `replaced_market` — the tab that was tapped (`this.replacing_market`), non-null only for the tap-to-replace flow.
- `category_sibling_tab` — an existing tab in `open_markets` whose `(symbol, trade-type category)` already matches the commit, found by `Array.find` (so it is a reference to the actual array element, not a copy).

Today the branch is:

```
if (replaced_market) {
    this.replaceOpenMarket(replaced_market, next_market);
    this.setReplacingMarket(null);
} else if (!category_sibling_tab) {
    this.addOpenMarket(next_market);
}
```

`replaced_market` unconditionally wins, so `category_sibling_tab` is only consulted for the non-replace (`+`/switch) path. `replaceOpenMarket` → `replaceInOpenMarkets` (`open-markets-utils.ts` L55-63) deliberately dedupes: it removes **both** `old` (the tapped tab) and `next` (the target) from the list before reinserting `next` once. When `next` is already open as some _other_ tab, that other tab **is** the dedupe target — so both the tapped tab and the pre-existing tab collapse into one, which is exactly the reported bug. `replaceInOpenMarkets` itself is correct for its actual job (a genuine in-place swap must not leave a duplicate if the new pair happens to already exist); the bug is that `selectMarketAndTradeType` calls it in a case it was never meant to handle.

## Goals / Non-Goals

**Goals:**

- When a tap-to-replace commit's target is already open as a _different_ tab, skip the replace entirely and let the normal symbol/contract_type write (which follows in the same method) activate that existing tab.
- Keep the failure-path rollback (L1136-1145) correct: it must only undo a replace that actually happened.
- Zero behavior change for every other path through this method (add, in-place replace, same-category sibling toggle such as "Allow equals").

**Non-Goals:**

- Changing `replaceInOpenMarkets`'s dedupe semantics — it stays correct for genuine in-place replaces (e.g. a stale response resolving to a pair that happens to coincide with another tab, handled elsewhere via `resolveContractTypeAvailability`, which is unaffected by this change).
- Changing the market selector's UI (which markets are selectable/disabled) — already correct per the issue: an already-open market stays selectable.
- Touching `market-tabs.tsx`'s tap handlers or the `+` flow — both are unaffected; `+` already clears `replacing_market` before opening the selector (L111-113).

## Decisions

**Detect "target already open elsewhere" using the two values already computed, no new lookup.** `category_sibling_tab` matches by `(symbol, category)` against `open_markets` _before_ any mutation. When `replaced_market` is set, distinguish two cases by comparing `category_sibling_tab` to `replaced_market` with the existing `isSameMarket` (exact `contract_type` equality, already imported in this file for `replaceOpenMarket`):

- `category_sibling_tab` is the **same** tab as `replaced_market` (or absent) → genuine in-place replace, unchanged behavior. This covers the "Allow equals" toggle: the tapped tab's own pair (`rise_fall`) is itself the category match for the commit (`rise_fall_equal`), so `category_sibling_tab === replaced_market` by reference.
- `category_sibling_tab` is a **different** tab than `replaced_market` → the bug case: the target is already open elsewhere. Skip `replaceOpenMarket`, still clear `replacing_market`, and do nothing else to the strip — the symbol/contract_type write below then makes that existing tab the active one, because `isActiveMarket` in `market-tabs.tsx` derives "active" from `(store.symbol, store.contract_type)`, not from any strip mutation.

Alternative considered: add a dedicated "does this pair already have a tab, and is it a _different_ tab" helper in `open-markets-utils.ts`. Rejected — the two facts needed already exist as local variables at the exact point of the decision; a new helper would just re-derive them with an extra list scan and extra surface area for no behavioral gain.

**Track whether a replace actually happened, explicitly, for the rollback.** The current failure branch assumes `replaced_market` truthy implies a replace was made. Once that is no longer always true, introduce a `did_replace` boolean set only inside the branch that calls `replaceOpenMarket`, and use it (not `replaced_market`) to decide whether to reverse the strip on failure. The `else if (!did_replace && !replaced_market && !category_sibling_tab)` add-rollback condition mirrors the forward-path `addOpenMarket` gate unchanged.

Alternative considered: leave the rollback keyed on `replaced_market` and make it a no-op replace (`replaceOpenMarket(next_market, replaced_market)` where neither pair actually moved). Rejected — `next_market` was never inserted in the skip case (it was already present as `category_sibling_tab`'s tab), so calling `replaceOpenMarket` on failure would incorrectly try to remove the pre-existing tab's entry and reinsert `replaced_market`, reintroducing a variant of the same bug on the failure path.

## Risks / Trade-offs

- **Risk:** a future edit to this method re-adds a branch that assumes `replaced_market` truthy ⇒ a replace happened. **Mitigation:** the new `did_replace` variable is set at the single call site of `replaceOpenMarket` in this method, and the spec (MT-003) plus new tests pin both the skip-then-fail and replace-then-fail cases.
- **Risk:** the `isSameMarket(category_sibling_tab, replaced_market)` comparison silently stops distinguishing "same tab" from "different tab" if `category_sibling_tab`'s matching rule (category) ever diverges further from `isSameMarket`'s rule (exact type). **Mitigation:** both already coexist today for the "Allow equals" case and are exercised by existing tests (`setTradeSubType` describe block); the new tests add the cross-tab case explicitly.

## Migration Plan

Single-file logic fix behind no flag; ships in the next normal release. No persisted-state shape change (`TOpenMarket`/localStorage format untouched), so no migration or rollback step beyond a normal revert of the commit.
