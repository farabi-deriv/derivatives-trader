## Context

`resolveInitialMarket` (`packages/trader/src/Stores/Modules/Trading/trade-store.ts:3790`) is the single owner of the initial (symbol, trade type) pair. Phase 1 resolves the symbol from the URL / session / default ladder; phase 2 evaluates a deep-linked `trade_type` against `contract_types_list_v2`; phase 3 records the pair as the one initial tab and stamps the URL.

`contract_types_list_v2` is written by exactly one production call site — `useContractsFor`'s processing effect (`packages/trader/src/AppV2/Hooks/useContractsFor.ts:174`) — but the value carries no identity. Phase 2's gate is `await when(() => !isEmptyObject(this.contract_types_list_v2))`: "some list exists", not "this market's list exists".

The bug surfaces when a new browser tab inherits the previous tab's `sessionStorage` (Chrome copies it on `window.open` / `target=_blank`). The store is rehydrated to `CRASH500` + `accumulator` one macrotask after construction, `contracts_for(CRASH500)` can settle before `active_symbols` does, and by the time phase 2 runs after the symbol has been switched to the URL symbol, the list in the store still describes Crash 500. Crash/Boom does not offer Rise/Fall, so a valid `rise_fall` deep link is judged unavailable and falls into `reconcileUrlTradeTypeWithSymbol`, which either shows the "Invalid trade type" modal (URL symbol == the compatible symbol) or silently switches the market to the account default (URL symbol != it).

The precondition in the issue report is exactly this: the previous market must be one whose contract list lacks Rise/Fall. With any volatility index as the previous market the stale list still offers `rise_fall`, so the reconcile never fires and the bug is invisible.

The codebase already has the correct pattern one function away. `resolveContractTypeAvailability(response_symbol, available_types)` (`trade-store.ts:1574`) is handed the symbol its response belongs to and opens with `if (response_symbol !== this.symbol) return;` — "the current symbol's own response drives its own resolution". The list itself was simply never given the same identity.

## Goals / Non-Goals

**Goals:**

- No trade-type availability decision is ever made against a contract list belonging to a different market.
- A deep link whose symbol offers its trade type loads exactly that pair, on both the account-default symbol and every other symbol.
- The genuine reconcile case (deep-linked trade type truly not offered by the deep-linked/restored symbol) keeps working unchanged.
- A contract list that never arrives degrades visibly-but-safely: keep the requested symbol, no modal, no substitution.

**Non-Goals:**

- Changing what `is_deep_link` means, the symbol ladder in phase 1, or the tab-strip rules in phase 3.
- Changing the number of `contracts_for` requests, their React Query keys, or `staleTime`.
- Clearing `contract_types_list_v2` on symbol change. The list is read by live UI (`useGuideContractTypes`, the trade-type selector); blanking it on every switch would flash empty trade-type lists. Stamping is additive and touches no renderer.
- Preventing `sessionStorage` inheritance across tabs. Per-tab trade params already depend on that inheritance (`tab_trade_params_v2`); the resolver must tolerate it, not fight it.

## Decisions

### D1 — Stamp the list with its market, rather than inferring freshness from `is_awaiting_contracts_for`

`contract_types_list_v2_symbol: string` is added next to `contract_types_list_v2` and written **only** inside `setContractTypesListV2(list, symbol)`, whose second parameter is required. `useContractsFor` passes the same `symbol` it already passes to `resolveContractTypeAvailability` two statements later, so the two reports cannot disagree about which market a response describes.

_Alternative considered — gate phase 2 on `!this.is_awaiting_contracts_for`._ Rejected: that flag is a proposal hold with several unrelated release paths (an errored `contracts_for`, an empty `available` array, `processContractsForV2` finishing). It goes false in cases where the list is still the outgoing market's, so it answers a different question. It is also re-armed by a reaction on `this.symbol`, which makes the phase-2 read order-sensitive in a way a stamp is not.

_Alternative considered — a `computed` "list is fresh"._ Rejected under the store-growth rule in `CLAUDE.md`: the response symbol is an **input** carried by the response, not something derivable from other store state. A computed would have nothing to derive it from. The field has exactly one writer, which is the rule the gotcha actually enforces.

_Why `symbol` and not `underlying_symbol`._ The hook keys the request on `getUnderlyingSymbol(symbol)`, but `this.symbol` in AppV2 already **is** an underlying symbol (phase 1 validates it against `active_symbols[].underlying_symbol`), so the two are the same value; passing the store `symbol` keeps the stamp directly comparable to `this.symbol` and matches `resolveContractTypeAvailability`'s existing argument.

### D2 — One bounded wait helper, used by both decision sites

```ts
/** Resolves true once the store's processed V2 list is the one built from `symbol`'s own response. */
private async hasContractTypesFor(symbol: string) {
    try {
        await when(
            () => this.contract_types_list_v2_symbol === symbol && !isEmptyObject(this.contract_types_list_v2),
            { timeout: SELECTION_WAIT_TIMEOUT }
        );
        return true;
    } catch {
        return false;
    }
}
```

Returning a boolean rather than letting `when` reject keeps both call sites branch-free and keeps "timed out" distinguishable from "arrived but lacks the type" — the two outcomes must behave differently (D4). The existing local `WAIT_TIMEOUT = 30000` inside `reconcileUrlTradeTypeWithSymbol` is hoisted to a module-level `SELECTION_WAIT_TIMEOUT` so the resolver and the reconcile share one number.

The helper's `true` is a claim about the moment `when` resolved, not the moment the caller resumes: `when` fires synchronously at the end of the setter action, the caller continues a microtask later, and a second `setContractTypesListV2` in between (a late response for the outgoing market) leaves the store holding another market's list. Each decision site therefore re-reads `contract_types_list_v2_symbol` against the symbol it is judging immediately before `isTradeTypeOfferedInV2List`, and treats a mismatch exactly like a timeout (D4). This makes the D1 invariant hold at the read, not only by the setter being the sole writer.

Phase 2 becomes:

```ts
if (url_trade_type && is_deep_link) {
    const has_own_list = await this.hasContractTypesFor(this.symbol);
    if (this.selection_seq !== epoch) return;
    if (!has_own_list || this.contract_types_list_v2_symbol !== this.symbol) {
        // D4: leave the type to resolveContractTypeAvailability; never decide on another market's list.
    } else if (this.isTradeTypeOfferedInV2List(url_trade_type)) {
        /* commit, unchanged */
    } else if (!Object.keys(getContractTypesConfig()).includes(url_trade_type)) {
        /* modal, unchanged */
    } else {
        await this.reconcileUrlTradeTypeWithSymbol(url_trade_type, epoch);
    }
}
```

The epoch re-check moves to immediately after the new await, preserving the existing rule that a user selection made mid-resolve always wins. Phase 3 is untouched and still runs in the degraded branch, so the tab strip is recorded either way.

### D3 — The reconcile's two branches collapse into one wait-then-check

Today the reconcile waits for the type to appear in _whatever_ list when the compatible symbol differs, and fail-fasts to the modal against _whatever_ list when it does not. Both branches want the same thing: the compatible market's own list.

```ts
if (compatible_symbol !== this.symbol) {
    await this.onChange({ target: { name: 'symbol', value: compatible_symbol } });
}
const has_own_list = await this.hasContractTypesFor(compatible_symbol);
if (this.selection_seq !== epoch) return;
if (!has_own_list || this.contract_types_list_v2_symbol !== compatible_symbol) return; // D4 — degrade, no modal
if (!this.isTradeTypeOfferedInV2List(trade_type)) {
    this.root_store.ui.toggleUrlUnavailableModal(true, 'trade_type');
    return;
}
```

Comparing against `compatible_symbol` rather than `this.symbol` is deliberate: it is the symbol the reconcile just asked for, so the condition reads as "the market I switched to has answered", independent of when `onChange`'s cascade lands. The already-current case still fails fast (its list is already stamped, so the `when` resolves on its first evaluation) — the behaviour the existing fail-fast comment and its test protect.

### D4 — A wait that times out degrades; it does not open the modal and does not substitute a market

"Unsupported trade type" is a claim about the market. A list that never arrived supports no claim, so the modal would be a lie and a market switch would be the very substitution this change exists to remove. The resolver keeps the deep-linked symbol and lets `resolveContractTypeAvailability` settle the trade type if and when the response lands — which is the same mechanism that already corrects a stale restored trade type. The reconcile's timeout path already behaved this way (its `when` rejected into a catch that logs and leaves state alone); D4 only makes that explicit and extends it to phase 2.

### D5 — Tests name the market their list belongs to

The nine `store.contract_types_list_v2 = <list>` assignments in `trade-store.spec.ts` bypass the setter and would leave the stamp empty, so every one moves to `store.setContractTypesListV2(<list>, '<symbol>')`. This is not incidental churn: the symbol each fixture list belongs to is precisely the fact the bug turned on, and writing it makes the stale-list scenario expressible at all.

### D6 — The resolver holds the loader for a deep link over a restored session

QA found (issue #1536) that the wait in D2 lengthened a window that already existed: BaseStore's deferred rehydrate puts the inherited (symbol, trade type) pair into the store before `active_symbols` arrive, that pair's own `contracts_for` lands first, and `resolveContractTypeAvailability` — seeing the current type offered — mirrors the inherited pair into the URL and the page renders it until the deep link settles. The fix reuses the reconcile's existing loader flag rather than adding a second one: `resolveInitialMarket` raises `is_reconciling_url_trade_type` before its first await when the link is a deep link **and** the session holds a pair to restore, and releases it in a `finally` around the phases (split into `resolveInitialMarketBody` so every early `return` and any throw passes through the release). The take-if-free / release-only-what-you-took rule lives in one private helper, `withLoaderHold`, which both the resolver and `reconcileUrlTradeTypeWithSymbol` run their bodies through, so the nested reconcile leaves the flag to whoever already holds it without a second copy of the guard. The flag's consumers already do the right thing: the trade page shows its loader, `resolveContractTypeAvailability` defers and re-evaluates against the settled pair, and `processContractsForV2` defers the tab-params intent instead of consuming it against the inherited market. A fresh tab with nothing restored does not hold the flag — its store already names the URL symbol, and the symbol-only seeding hop in `resolveContractTypeAvailability` has to run before phase 3 records the tab.

## Risks / Trade-offs

- **[A deep link now waits for a network round trip that it previously skipped]** → The wait is bounded by the same 30s already used for the reconcile's `active_symbols` wait, and it is the same `contracts_for` the page must load before it can price anything; phase 2 previously "skipped" it only by reading the wrong market's answer. The page loader covers this window: `is_awaiting_contracts_for` for a fresh tab, and the D6 hold on `is_reconciling_url_trade_type` when a restored session pair would otherwise show through.
- **[A contracts_for error now lands in the D4 degraded branch instead of the old reconcile]** → Previously an errored response left the stale list in place and phase 2 acted on it (the bug). Now the deep-linked symbol is kept and the trade type falls to the market's default. Strictly better: the user gets the market they clicked.
- **[The stamp and `this.symbol` could drift if a future caller reports a list for a symbol the store never held]** → The setter's required second argument and its single call site make that a visible, reviewable change rather than a silent one; the `CLAUDE.md` gotcha records the invariant.
- **[Test churn across nine fixtures]** → Contained to one describe block in one spec; each edit is mechanical and adds information rather than removing it.

## Migration Plan

No data migration, no feature flag, no persisted-shape change — `contract_types_list_v2_symbol` is transient store state, absent from both `local_storage_properties` and `session_storage_properties`. Rollback is a plain revert of the commit.

## Open Questions

Tracked in `tasks.md` (`## Open Questions`), resolved with the recommended option so this design is implementable as written.
