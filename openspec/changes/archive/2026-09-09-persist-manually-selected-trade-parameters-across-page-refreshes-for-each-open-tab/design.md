## Context

See `proposal.md` — Why for motivation, and `specs/tab-trade-params-persistence/spec.md` for the behaviour contract.

Constraints this design has to fit, all in `packages/trader/src/`:

- **Tabs have no id.** `TOpenMarket` is `{ symbol, contract_type }` (`AppV2/Utils/open-markets-utils.ts:3-7`); the pair _is_ the identity, and the same symbol can be open under several trade types. Tab equality is checked by exact pair (`isSameMarket`, `:31-32`) but tab _matching_ in the store is by trade-type **group** (`isSameTradeTypeGroup`, `Stores/Modules/Trading/trade-store.ts:1172-1177`) so the Allow-equals / Up-Down sub-toggles do not spawn a second tab.
- **One commit path.** Every internal-tab switch goes through `selectMarketAndTradeType` (`trade-store.ts:1097-1149`), guarded by the monotonic `selection_seq` epoch (`:317`) so overlapping cascades cannot interleave.
- **The cascade resets params on its way through.** `onChange({symbol})` → symbol-support cleanup (`handleTradeParamsResetOnSymbolChange`, `:3273-3318`, called from `:1906`); `processNewValuesAsync` → stake / TP / SL reset (`:1920-1955`); `onChange({contract_type})` → `applyDefaultDuration()` on a real duration-group change (`:1381-1383`); and later, when the new symbol's `contracts_for` lands, `processContractsForV2` → default duration (`:1002-1034`).
- **Duration limits arrive at two different moments.** Same-symbol trade-type switch: synchronously inside `processNewValuesAsync` → `processTradeParams` (`:1984`). Symbol switch: asynchronously, when `useContractsFor`'s effect fires `setDefaultStake` → `resolveContractTypeAvailability` → `processContractsForV2` (`AppV2/Hooks/useContractsFor.ts:171-207`). That effect's deps are `[response, isLoading, …]` — **not** `contract_type` — so a same-symbol trade-type switch does not re-run it.
- **Cold-load ordering is already delicate.** `resolveInitialMarket` is fired from the constructor (`:736`) and deliberately awaits one macrotask (`:2946`) because `BaseStore` wires its storage reactions and calls `retrieveFromStorage()` inside `setTimeout(…, 0)` (`Stores/base-store.ts:118-124`).
- **`BaseStore` persistence is a blunt instrument.** `saveToStorage` writes one JSON blob per store name (`base-store.ts:186-197`); `retrieveFromStorage` blind-assigns **every key present in the stored snapshot**, not just the configured property list (`:203-210`), with no validation and no versioning.

## Goals / Non-Goals

**Goals**

- One storage owner per parameter. A parameter is either tab-scoped (new map) or global (`BaseStore`), never both — no dual-write, no precedence rules to reason about.
- One decision point for "restore vs defaults", evaluated where the incoming pair's constraints are actually known.
- Reuse the existing tab identity and the existing epoch guard rather than inventing a parallel notion of "current tab".
- Validation on read, mirroring `readOpenMarkets`; the new map must not repeat `retrieveFromStorage`'s blind assign.

**Non-Goals**

- ~~Changing where the tab **strip** is stored. It stays in localStorage (`OPEN_MARKETS_STORAGE_KEYS`, `open-markets-utils.ts:14-17`); see Open Questions in `tasks.md`.~~ **Superseded by D8:** the strip moved to sessionStorage, so it is scoped to one browser tab alongside the parameters.
- Cross-browser-tab synchronisation, a `storage`-event listener, or conflict resolution between browser tabs.
- Reworking `BaseStore`, `useContractsFor`, or the `duration.tsx` safety net (`AppV2/Components/TradeParameters/Duration/duration.tsx:119-141`).
- Persisting parameters for markets that were never opened as tabs.

## Decisions

### D1 — Key the map on the tab's recorded pair, resolved through the existing group matcher

`getMarketKey({ symbol, contract_type })` → `` `${symbol}|${contract_type}` ``. Never an array index: indices shift under `removeFromOpenMarkets` / `replaceInOpenMarkets` (`open-markets-utils.ts:52-63`) and would mis-assign params to the wrong tab.

The key is built from the **tab entry found in `open_markets`**, located with the store's existing `isSameTradeTypeGroup`, not from `this.contract_type` directly. Toggling Allow equals moves `contract_type` `rise_fall ↔ rise_fall_equal` via `setTradeSubType` (`:1400-1411`) without changing the tab's recorded pair; keying off the live `contract_type` would split one tab across two entries.

_Alternatives:_ a synthetic `tab_id` added to `TOpenMarket` — rejected: it changes the persisted strip shape (a compatibility surface, per the comment at `open-markets-utils.ts:13`) for no gain, since the pair is already unique on the strip.

### D2 — sessionStorage, per mode, as the single owner of tab-scoped params AND of the strip

`TAB_TRADE_PARAMS_STORAGE_KEYS: Record<TOpenMarketsMode, string>`, mirroring `OPEN_MARKETS_STORAGE_KEYS`, in **sessionStorage**. Manual and automation are independent collections (`open_markets` getter, `:2737-2739`), so their params are too.

**Superseded by D8:** the tab STRIP (`OPEN_MARKETS_STORAGE_KEYS`) is now in sessionStorage as well, so the whole Trade page is scoped to one browser tab. The paragraph below about "a new browser tab would show the last-used params" is unchanged in intent and now applies to the strip too.

The tab-scoped keys are **removed** from `local_storage_properties` (`:483-509`) rather than left there as a fallback. Keeping both would mean the localStorage blob still rehydrates on a cold load and a new browser tab would show the last-used params instead of defaults — the exact behaviour the spec forbids. Single owner also keeps the deep-link discrimination at `:2935-2941` intact, since `symbol`/`contract_type` stay in `session_storage_properties`.

Because `retrieveFromStorage` assigns every key found in the stored snapshot, shrinking the property list is not enough to evict values already written by previous releases — a **one-time cleanup** rewrites `localStorage['trade_store']` without the tab-scoped keys before `BaseStore`'s `setTimeout(0)` rehydrate runs.

_Alternatives:_ keep params in localStorage keyed per tab — survives a browser restart but a new browser tab then inherits another tab's parameters. Dual-layer (localStorage global + sessionStorage per tab) — rejected as the precedence rules are exactly the ambiguity that produced this bug.

### D3 — Express the outcome as an intent, consumed once, where the constraints are known

The store carries a small transient field:

```ts
type TPendingTabParams = { mode: 'restore'; params: TTabTradeParams } | { mode: 'defaults' } | null;
```

`selectMarketAndTradeType` sets it **before** the cascade — `restore` when the incoming pair already has a tab, `defaults` when it does not (or when it is a long-press replacement). The intent is consumed exactly once by `applyPendingTabParams()`, called from:

1. `processContractsForV2` — the symbol-changed path. By then `duration_min_max`, `duration_units_list` and `default_stake` are the incoming pair's.
2. the tail of `selectMarketAndTradeType`, guarded by `if (!this.is_awaiting_contracts_for)` — the same-symbol trade-type switch, where no new `contracts_for` response arrives and so `useContractsFor`'s effect never re-runs. `is_awaiting_contracts_for` is re-armed by the symbol reaction (`:747-753`) and cleared at the end of `processContractsForV2` (`:1042-1044`), so it is exactly the "a round trip is still pending" signal. Consumption is idempotent, so whichever fires first wins and the other is a no-op.

Both call sites sit **after** every reset listed in Context, so the restore is the last write and no reset needs to be disabled — the deliberate stake-survives-symbol-change / TP-SL-clears-on-type-change behaviour at `:1920-1955` is preserved for the paths that do not carry an intent.

`resolveInitialMarket` also sets the intent for the pair it resolves, immediately before `recordActiveMarketTab()` (`:3026`), covering the cold-load path that does **not** go through `selectMarketAndTradeType`. It already awaits the macrotask that `BaseStore` needs (`:2946`), so no new ordering is introduced.

_Alternatives:_ restore inline right after each `onChange` — rejected: on a symbol change the incoming pair's duration limits have not landed, so validation would run against the outgoing pair's. A MobX reaction on `duration_min_max` — rejected: it fires on every `contracts_for` and cannot tell an activation from a background refresh.

### D4 — Delete `duration_default_applied_for`; make the default an explicit intent plus a stateless check

`should_apply_default` (`:1002-1009`) becomes:

```ts
should_apply_default =
    pending?.mode === 'defaults' ||
    !isValidPersistedDuration(this.duration, this.duration_unit, this.duration_min_max, this.duration_units_list);
```

The flag (`:354`, written at `:1028` and `:1304`, read at `:1003`) encodes session history — which a refresh destroys by construction — and being the left operand of the `||` it short-circuits past the correct check on every cold load. Removing it makes the cold-load path purely stateless, and requirement "a new tab always gets defaults" is carried by the explicit `defaults` intent rather than by a flag that happens to be empty.

`current_duration_group` stays: it is still read at `:1381` to decide whether a `contract_type` change crossed duration groups.

`resolveContractTypeAvailability` (`:1193-1239`) sets a `defaults` intent on the branch where it falls back to `available_types[0]` and repairs the strip — that branch produces a new pair, so it is a new tab.

_Alternatives:_ persist the flag — rejected for the reason above. Copy the stake heuristic `this.amount === this.default_stake` (`:1934`) — rejected: it infers "untouched" from equality with the default, which silently fails whenever the user deliberately picks the default. Rare for stake, common for duration, which comes from a short preset list.

### D5 — Prune in `setActiveOpenMarkets`, the single strip writer

`addOpenMarket` / `removeOpenMarket` / `replaceOpenMarket` (`:1260-1275`) all route through `setActiveOpenMarkets` (`:1244-1258`), which is also where the automation-supported guard lives. Pruning the active mode's map to the pairs in `next` there covers every add, remove, replace and automation-guard filter in one place, with no hook to forget.

_Alternatives:_ hook `removeOpenMarket` / `replaceOpenMarket` individually (as the ticket suggests) — same effect but two places to keep in sync and it misses the guard-driven filter at `:1251`.

### D6 — Validate on read and on apply, drop rather than throw

`readTabTradeParams(mode)` follows `readOpenMarkets` (`:35-38`): `safeParse`, then filter — a non-object root yields `{}`, a non-object entry is dropped, and within an entry any key outside the whitelist or of the wrong primitive type is dropped. Never a blind cast, never a throw: corrupt storage degrades to "no saved params", which the spec requires.

`applyRestoredTabParams` re-validates duration against the live constraints with `isValidPersistedDuration` (`AppV2/Utils/trade-params-utils.tsx:763-816`) and drops it if invalid, letting the default land instead.

Note a structural benefit of D1: because a tab's entry is keyed by _its own_ symbol, params saved for one symbol can never be applied to another. That removes the class of bug `handleTradeParamsResetOnSymbolChange` exists to clean up (`:3286-3306`, which deletes the raw `deriv_duration`, `deriv_barrier_*`, `deriv_v2_params_initial_values` keys). That function is left untouched — it still guards the non-tab paths — but the new map deliberately needs no equivalent cross-symbol invalidation.

### D7 — Tolerate a missing `root_store.ui` in `is_automation_mode`, rather than reordering the RootStore

Queuing the cold-load intent synchronously in the constructor (D3, task 5.6/5.9) made `TradeStore`'s
constructor the first code in the app to read `root_store.ui`. The trader `RootStore` assigns it
_after_ it builds `ModulesStore` (`packages/trader/src/Stores/index.ts:23-24`):

```ts
this.modules = new ModulesStore(this, core_store); // constructs TradeStore HERE
this.ui = core_store.ui; // assigned AFTER
```

`queueInitialTabTradeParams` → `queueTabTradeParams` → `findMarketTab` resolves its default
`mode = this.tab_params_mode` argument, which reads `is_automation_mode` → `root_store.ui.is_mobile`.
With `ui` still `undefined` that threw `Cannot read properties of undefined (reading 'is_mobile')`
out of the constructor, so `initStore` never returned and every load hit the app-level
`ErrorBoundary` ("An unexpected error occurred"). The ordering itself is pre-existing and unchanged
by this change; what is new is a constructor-time reader of `ui`.

`is_automation_mode` therefore optional-chains `ui`. The desktop fallback is not merely safe, it is
_correct_ at that point: `is_automation_page` initialises to `false` and `active_trade_panel_tab` is
a field initialiser (already restored from localStorage before the constructor body runs), so both
branches are readable; and a mobile cold load is never on the `/automate` route, which is exactly
what the mobile branch would report. Once `ui` is attached the getter reads `is_mobile` normally.

_Alternatives:_ move `this.ui = core_store.ui` above the `ModulesStore` construction — a one-line fix
that works, but it only relocates the trap: the next constructor-time read of `root_store.portfolio`
or `contract_trade` reintroduces it, and the ordering constraint would live in a file that gives no
hint why. Guarding the getter puts the tolerance where the assumption is. Deferring the queue to a
microtask was also rejected: it reintroduces exactly the `contracts_for`-wins race that queuing
synchronously exists to remove (D3).

### D8 — Put the tab strip in sessionStorage too, so a new browser tab starts from one default tab

Q1 originally chose option (b): strip in localStorage, params in sessionStorage — so a new browser
tab reopened your tabs but each started at defaults. That satisfied the issue's Actual/Expected
result, which is about parameter values. It does not satisfy the requirement as stated ("a new
browser tab starts with a single default internal tab"), and in practice the split reads as a bug:
the new browser tab shows another browser tab's markets.

This is Q1 option **(a)**, adopted deliberately after the fact. Both surfaces now live in
sessionStorage, so the strip and its parameters share one lifetime and one scope — no asymmetry to
explain, and "what belongs to this browser tab" has a single answer.

Two things the option-(a) note in `tasks.md` asked to revisit, both of which turned out to need no
logic change:

- `resolveInitialMarket`'s stale-symbol preference for a strip symbol (`:3300`) already falls through
  to `pickDefaultSymbol` when the strip yields nothing.
- The strip-convergence branch (`:3351`) is already guarded by `this.open_markets.length`, so an
  empty strip skips it and the resolved pair is recorded as the one initial tab.

The abandoned localStorage entries are evicted by `clearLegacyOpenMarketsFromLocalStorage`, called
from `readOpenMarkets` rather than from the store: `TradeStore` reads the strip in a FIELD
INITIALISER, which runs after `super()` and therefore before any constructor-body cleanup could run.
Putting the eviction at the read makes it impossible to sequence wrong (cf. D7, where a
constructor-order assumption was the defect). It runs at most once per module instance and writes
nothing when there is no legacy key present, because `readOpenMarkets` is on the market-switch path —
`barrier-reset.spec.ts` pins that path's exact `localStorage.removeItem` count and caught the
unconditional version.

_Alternatives:_ keep (b) and treat the reported behaviour as working-as-intended — rejected, the
requirement is explicit. Namespace the strip in localStorage by a per-browser-tab id held in
sessionStorage — survives a browser restart AND isolates tabs, but needs a tab-id lifecycle and a
reaper for abandoned namespaces; revisit only if losing the strip on browser close proves unpopular.

## Risks / Trade-offs

- **Params no longer survive closing the browser.** → Deliberate; it is what scopes them to a browser tab. Called out in the spec and raised as Open Question 2 in `tasks.md` so a reviewer can overrule it.
- **The tab strip no longer survives closing the browser.** → Accepted with D8; it is the cost of "a new browser tab starts from a single default tab". Recorded as a before-production finding so product can weigh it, and reversible via the per-tab-id namespacing alternative without touching consumers.
- **The one-time localStorage cleanup runs against a blob written by an older release.** → Cleanup is key-subtractive (rewrite the blob minus the tab-scoped keys), never a `removeItem` of the whole store, so `currency` and `is_trade_params_expanded` survive. If the blob is unparseable, skip silently — `retrieveFromStorage` would have thrown on it anyway.
- **A restore lands after the cascade, so a customised stake can be visible as the default for a frame.** → The panel is already behind `is_awaiting_contracts_for` / `setChartStatus(true)` on a symbol change (`:1356`); for the same-symbol path the tail restore is in the same microtask chain as the `onChange`, so no paint occurs between them.
- **`is_awaiting_contracts_for` as the "round trip pending" signal could leave an intent unconsumed** if a `contracts_for` request fails — `useContractsFor` releases the flag via `setIsAwaitingContractsFor(false)` on error without calling `processContractsForV2` (`useContractsFor.ts:206-224`). → The intent is cleared (not applied) whenever a newer selection sets one, so it cannot leak into a later, unrelated activation; the tab shows defaults, which is the correct degradation for a market whose contracts never loaded.
- **Two overlapping activations could each set an intent.** → The intent is overwritten by the newer selection and every consumer re-checks `selection_seq` before writing, matching the existing supersession contract at `:1130` / `:1141`.
- **Queuing in the constructor means constructor-time reads of `root_store`.** → `root_store.ui` is not assigned until after `ModulesStore` is built (D7), so `is_automation_mode` optional-chains it. Any further store state the queue path comes to need must be either a field initialiser or similarly guarded; pinned by a regression test that constructs a store with no `ui`.
- **sessionStorage quota.** → The map is capped implicitly by `MAX_OPEN_MARKETS` (7) per mode and pruned on every strip write; a write failure is caught and ignored, degrading to "not saved".

## Migration Plan

1. Ship the util + store wiring together; there is no intermediate state where both storage owners are live.
2. On first load after deploy, the one-time cleanup subtracts the tab-scoped keys from `localStorage['trade_store']`. Existing users see their single global parameter set replaced by defaults once, then per-tab persistence from that point on.
3. Rollback is a straight revert: the sessionStorage keys are new and unread by the previous release, and the previous release rewrites its own localStorage blob on the first parameter change.
