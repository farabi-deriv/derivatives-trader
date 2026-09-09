## Open Questions

Answered with the recommended default below so the plan is implementable as-is. A reviewer may replace any answer; each note says what changes if they do.

### Q1 — Requirement 5 ("a new browser tab starts with a single default internal tab") conflicts with how the tab strip works today

`open_markets_manual` / `open_markets_automation` are seeded from **localStorage** at construction (`trade-store.ts:291-292` → `readOpenMarkets`), and `resolveInitialMarket` deliberately prefers the strip's most recent available tab over inventing a default symbol (`:2962-2968`). So today a new browser tab intentionally reopens your previous tab strip.

- **(a)** Move both the tab strip _and_ the params to sessionStorage. Satisfies requirement 5 literally; regresses tab persistence across browser restarts for every existing user.
- **(b) — originally recommended, NOT the shipped answer.** Keep the tab strip in localStorage; put only the params in sessionStorage. A new browser tab reopens your tabs, but every one of them starts at defaults. Requirements 1–4 are met exactly and requirement 5 is met for parameters, which is what the issue's Actual/Expected result is actually about.
- **RESOLVED as (a)** — see `design.md` D8 and task 8.1. Option (b) leaves a new browser tab showing another browser tab's markets, which does not satisfy requirement 5 as written and reads as a bug. Both the strip and the params are now in sessionStorage.
- **(c)** Move only the params to sessionStorage and change nothing else about the strip — identical to (b) in effect; listed separately in the ticket, kept here for traceability.

_If (a) is chosen instead:_ add tasks to move `OPEN_MARKETS_STORAGE_KEYS` reads/writes to sessionStorage (`open-markets-utils.ts:35-42`), revisit the compatibility note at `:13`, and revisit the strip-convergence branch at `trade-store.ts:3017-3025`, which assumes a restored strip exists.

### Q2 — sessionStorage means parameters no longer survive closing the browser

Today the global blob in `localStorage['trade_store']` survives a browser restart. Per-tab params in sessionStorage do not — a refresh keeps them, closing the browser drops them.

- **(i) — RECOMMENDED.** sessionStorage, single owner. Satisfies "a new browser tab starts from defaults"; accepts the loss on browser close. Requires the one-time localStorage cleanup (task 3.4).
- **(ii)** localStorage per-tab map. Params survive a browser restart, but a second browser tab then inherits the first one's parameters — requirement 5 would need a separate mechanism (e.g. a per-browser-tab id in sessionStorage namespacing the localStorage map).
- **(iii)** Dual-layer: sessionStorage per tab, falling back to the localStorage global blob when there is no entry. Rejected in `design.md` D2 — the precedence rules are the ambiguity that produced this bug.

_If (ii) is chosen instead:_ swap the storage medium in `tab-trade-params-utils.ts`, drop task 3.4, and rewrite the "new browser tab" scenarios in the spec.

### Q3 — Which user-editable params to add beyond today's `local_storage_properties` list

The ticket asks for a conscious decision on four params that are user-editable but currently **not** persisted.

- **RECOMMENDED:** add `expiry_time`, `cancellation_duration`, `payout_per_point`; exclude `contract_expiry_type`.
    - `expiry_time` pairs with `expiry_date`/`expiry_type`, which are already persisted — restoring an `endtime` expiry with a null time is incoherent.
    - `cancellation_duration` pairs with `has_cancellation`, already persisted — same argument.
    - `payout_per_point` is user-editable for Turbos and is symbol-and-type specific, which is exactly the tab's identity, so per-tab keying makes it safe to restore; `processContractsForV2:1037-1039` only seeds it when empty, so a restored value wins.
    - `contract_expiry_type` is derived from the `contracts_for` response via `ContractType.getContractValues`, not chosen by the user — recomputed for the active pair.
- **Alternative:** inherit the current omission verbatim (persist only today's list, tab-scoped). Smaller diff; leaves the `endtime`-without-a-time and `has_cancellation`-without-a-duration inconsistencies in place.

_If the alternative is chosen instead:_ drop those three keys from `TAB_TRADE_PARAM_KEYS` in task 1.2 and from the tests in task 5.1.

---

## 1. New per-tab params util

- [x] 1.1 Create `packages/trader/src/AppV2/Utils/tab-trade-params-utils.ts`, mirroring the structure, comment style and export order of `packages/trader/src/AppV2/Utils/open-markets-utils.ts`. Import `TOpenMarket` / `TOpenMarketsMode` from it and `safeParse` from `@deriv/utils`.
- [x] 1.2 In that file, define `TAB_TRADE_PARAM_KEYS` (a `const` tuple) and the derived `TTabTradeParams` type, covering: `amount`, `basis`, `barrier_1`, `barrier_2`, `short_barriers`, `long_barriers`, `strike_price_choices`, `duration`, `duration_unit`, `expiry_date`, `expiry_time`, `expiry_type`, `start_date`, `start_time`, `growth_rate`, `multiplier`, `last_digit`, `payout_per_point`, `is_equal`, `has_take_profit`, `take_profit`, `has_stop_loss`, `stop_loss`, `has_cancellation`, `cancellation_duration`, `v2_params_initial_values`. Add a comment stating that `currency` and `is_trade_params_expanded` are deliberately excluded (account/UI-scoped) and `contract_expiry_type` is deliberately excluded (derived from `contracts_for`) — per Q3.
- [x] 1.3 Add `export const getMarketKey = ({ symbol, contract_type }: TOpenMarket) => \`${symbol}|${contract_type}\``with a comment explaining why an array index is never used (indices shift under`removeFromOpenMarkets`/`replaceInOpenMarkets`).
- [x] 1.4 Add `TAB_TRADE_PARAMS_STORAGE_KEYS: Record<TOpenMarketsMode, string>` (sessionStorage keys, one per mode), mirroring `OPEN_MARKETS_STORAGE_KEYS` — manual and automation are independent collections.
- [x] 1.5 Add `readTabTradeParams(mode)` / `writeTabTradeParams(mode, map)` against `sessionStorage`. Read must `safeParse` and then **filter**, following `readOpenMarkets` (`open-markets-utils.ts:35-38`): non-object root → `{}`, non-object entry → dropped, key not in `TAB_TRADE_PARAM_KEYS` or of the wrong primitive type → dropped. Never a blind cast (do not copy `BaseStore.retrieveFromStorage`, `packages/trader/src/Stores/base-store.ts:203-210`). Wrap the write in try/catch so a quota failure degrades to "not saved".
- [x] 1.6 Add `pickTabTradeParams(source)` — whitelist-project a store-shaped object down to `TTabTradeParams`, skipping `undefined` values.
- [x] 1.7 Add `pruneTabTradeParams(map, open_markets)` — return a map containing only entries whose key matches a pair in `open_markets` (returns the same reference when nothing was dropped, matching the no-op convention in `addToOpenMarkets`).

## 2. Store fields and helpers (`packages/trader/src/Stores/Modules/Trading/trade-store.ts`)

- [x] 2.1 Add `tab_trade_params_manual` / `tab_trade_params_automation`, seeded from `readTabTradeParams(...)` next to `open_markets_manual` / `open_markets_automation` (`:291-292`). Plain fields, **not** observable — they are read imperatively and never rendered (same rationale as `automation_supported_trade_types`, `:293-299`). Add a `get tab_trade_params()` mirroring the `open_markets` getter (`:2737-2739`).
- [x] 2.2 Add the transient `pending_tab_params: TPendingTabParams` field (`{ mode: 'restore'; params } | { mode: 'defaults' } | null`), private and non-observable, with a comment explaining it is a per-activation intent consumed exactly once.
- [x] 2.3 Add `private findMarketTab(symbol, contract_type)` — locate the strip entry for a pair using the existing `isSameTradeTypeGroup` (`:1172-1177`), so Allow-equals / Up-Down sub-toggles resolve to the same tab key (`design.md` D1).
- [x] 2.4 Add `saveTabTradeParams(market)` — `pickTabTradeParams(this)` into the active mode's map under `getMarketKey(tab)`, then `writeTabTradeParams`. No-op when the pair has no tab.
- [x] 2.5 Add `queueTabTradeParams(market)` — set `pending_tab_params` to `{ mode: 'restore', params }` when the active mode's map has an entry for the pair's tab, otherwise `{ mode: 'defaults' }`.
- [x] 2.6 Add `private consumePendingTabParams()` — return and clear `pending_tab_params` in one step (idempotent second call returns `null`).
- [x] 2.7 Add `private async applyRestoredTabParams(params)` — drop `duration`/`duration_unit` when `isValidPersistedDuration(...)` (`AppV2/Utils/trade-params-utils.tsx:763-816`) fails against the live `duration_min_max` / `duration_units_list`, then apply the rest via `onChangeMultiple`.
- [x] 2.8 Add `private async applyTabDefaults()` — reset `amount` to `default_stake` (or `getMinPayout(currency)` on crypto, matching `:1930-1947`) and clear `has_take_profit` / `take_profit` / `has_stop_loss` / `stop_loss` / `has_cancellation` / `cancellation_duration`, so a new tab cannot inherit the previous tab's customised stake when only the symbol changed.
- [x] 2.9 Add `private async applyPendingTabParams()` — consume the intent and dispatch to `applyRestoredTabParams` or `applyTabDefaults`; the duration half of `defaults` is handled by task 4.1.
- [x] 2.10 Register the new public actions in `makeObservable` (`:520-721`) alongside `addOpenMarket` / `removeOpenMarket` (`:678-680`).

## 3. Storage ownership migration

- [x] 3.1 Remove every key listed in task 1.2 from `local_storage_properties` in the constructor (`:483-509`), leaving `currency` and `is_trade_params_expanded`.
- [x] 3.2 Leave `session_storage_properties = ['contract_type', 'symbol']` (`:510`) untouched — the deep-link discrimination at `:2935-2941` compares URL params against `sessionStorage['trade_store']`.
- [x] 3.3 Verify no other module reads the removed keys out of `localStorage['trade_store']` directly (`grep -rn "trade_store" packages/ --include=*.ts --include=*.tsx`, excluding node_modules).
- [x] 3.4 Add a one-time, key-subtractive cleanup that rewrites `localStorage['trade_store']` without the now-tab-scoped keys, run in the constructor **before** `BaseStore`'s `setTimeout(0)` rehydrate (`packages/trader/src/Stores/base-store.ts:118-124`). Needed because `retrieveFromStorage` blind-assigns every key present in the stored snapshot, not just the configured list. Skip silently on unparseable JSON.

## 4. Duration default: remove the session-history flag

- [x] 4.1 In `processContractsForV2` (`:980-1049`): after the two existing `processNewValuesAsync` calls, call `consumePendingTabParams()`; apply a `restore` intent via `applyRestoredTabParams`; then rewrite `should_apply_default` (`:1002-1009`) to `pending?.mode === 'defaults' || !isValidPersistedDuration(this.duration, this.duration_unit, this.duration_min_max, this.duration_units_list)`. Apply `applyTabDefaults()` for a `defaults` intent before the duration block so `default_stake` (set by `useContractsFor`) is already current.
- [x] 4.2 Delete the `duration_default_applied_for` field (`:351-354`) and its writes at `:1028` and `:1304` (`applyDefaultDuration`). Keep `current_duration_group` (`:1288-1291`) — still read at `:1381`.
- [x] 4.3 Update the field's explanatory comment block (`:351-353`) so it no longer describes a flag that no longer exists; document that "apply the default" is now an explicit new-tab intent plus a stateless validity check.

## 5. Save / restore wiring

- [x] 5.1 In `selectMarketAndTradeType` (`:1097-1149`), before the strip mutations: capture the outgoing pair from `this.symbol` / `this.contract_type` and `saveTabTradeParams` it. Then, after the tab bookkeeping (`replaced_market` / `category_sibling_tab`, `:1104-1119`), call `queueTabTradeParams(next_market)` — but force `{ mode: 'defaults' }` when `replaced_market` is set, since a long-press replacement produces a new pair.
- [x] 5.2 In the same method's `try` block, after the `contract_type` `onChange` and the `this.selection_seq !== epoch` re-check (`:1130-1133`), add `if (!this.is_awaiting_contracts_for) await this.applyPendingTabParams();` — the same-symbol path, where `useContractsFor`'s effect (deps `[response, isLoading, …]`, `AppV2/Hooks/useContractsFor.ts:219`) never re-runs. Re-check the epoch before the apply so an overlapping cascade cannot interleave.
- [x] 5.3 In the `catch` block (`:1136-1145`), clear `pending_tab_params` alongside the optimistic tab rollback, so a failed commit leaves no stale intent.
- [x] 5.4 In `setActiveOpenMarkets` (`:1244-1258`), prune the active mode's params map with `pruneTabTradeParams(map, next)` and write it back — one hook covering every add, remove, replace and automation-guard filter (`design.md` D5).
- [x] 5.5 In `resolveContractTypeAvailability` (`:1214-1238`), set `{ mode: 'defaults' }` on the fallback branch (after the strip repair at `:1228-1230`, before the `onChange` at `:1235`) — the fallback produces a new pair.
- [x] 5.6 In `resolveInitialMarket` (`:2926-3028`), call `queueTabTradeParams({ symbol: this.symbol, contract_type: this.contract_type })` immediately before `recordActiveMarketTab()` (`:3026`), covering the cold-load path that does not go through `selectMarketAndTradeType`. Leave the existing `await new Promise(resolve => setTimeout(resolve, 0))` at `:2946` and the epoch re-checks untouched.
- [x] 5.7 Save the current tab's params on `reconcileTradeModeMarket` (`:2885-2902`) before the mode flip snapshots `leaving`, so switching manual ↔ automation is lossless for the mode being left.
- [x] 5.8 **Added during implementation** (gap in the plan as written): persist the active tab's params on every edit, via a store-owned `reaction` over `TAB_TRADE_PARAM_KEYS` in the constructor. Shrinking `local_storage_properties` (task 3.1) removed `BaseStore`'s `setupReactionForLocalStorage` coverage of these keys, so with saves wired only at switch time (5.1/5.7) the issue's core repro — edit, then refresh with no tab switch — still lost the values. Guarded by `is_selecting_market` / `is_reconciling_url_trade_type` / `is_awaiting_contracts_for` / an unconsumed `pending_tab_params` so it never records a mid-cascade hybrid pair or pre-restore state.
- [x] 5.9 **Added during implementation** (regression from 5.6/task 2.5): guard `root_store.ui` in the `is_automation_mode` getter (`:3025`). Queuing the cold-load intent synchronously in the constructor made `TradeStore`'s constructor the first reader of `root_store.ui`, which the trader `RootStore` assigns only _after_ constructing `ModulesStore` (`packages/trader/src/Stores/index.ts:23-24`) — so `queueInitialTabTradeParams` → `queueTabTradeParams` → `findMarketTab`'s default `mode = this.tab_params_mode` threw `Cannot read properties of undefined (reading 'is_mobile')` out of the constructor and every load fell through to the app `ErrorBoundary`. Optional-chained rather than reordering the RootStore; see `design.md` D7 for why the desktop fallback is correct and not merely safe.

## 6. Tests

Follow `.buildwright/framework/tdd-evidence.md`: write each test against the unfixed code first and cite the red in the PR body. Existing specs in `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` show the setup conventions (see the `processContractsForV2 duration reconciliation` block at `:1335`).

- [x] 6.1 Create `packages/trader/src/AppV2/Utils/__tests__/tab-trade-params-utils.spec.ts`, mirroring `__tests__/open-markets-utils.spec.ts`: `getMarketKey` distinguishes the same symbol under two trade types; read/write round-trips through sessionStorage; a non-JSON / non-object / array payload yields `{}`; malformed entries and out-of-whitelist or wrongly-typed keys are dropped; manual and automation use separate keys and never clobber each other; `pruneTabTradeParams` drops entries not on the strip and returns the same reference when nothing changed; `pickTabTradeParams` skips `undefined`.
- [x] 6.2 In `trade-store.spec.ts`, extend the `processContractsForV2 duration reconciliation` block (`:1335`): a valid saved duration is preserved on a cold load with no pending intent (this is the bug — assert it fails first); a `defaults` intent forces the configured default even when the retained duration is valid; an invalid saved duration falls back to the default. Update the existing `applies the configured default on first activation even when the retained duration is valid` case (`:1382`), which encodes the behaviour being fixed, and the `duration_default_applied_for` assertions at `:1396` and `:1409`.
- [x] 6.3 In `trade-store.spec.ts`, add a `per-tab trade params` block covering: switching away and back restores the saved values; opening a _new_ pair loads defaults even when another tab has customised params; a saved stake survives the stake/TP/SL reset at `:1920-1955` on a switch that changes both symbol and trade type; TP/SL are restored despite the `has_contract_type_changed` clear at `:1950-1955`; a saved duration survives `applyDefaultDuration()` at `:1381-1383` on a same-symbol trade-type switch.
- [x] 6.4 In `trade-store.spec.ts`, add the "deliberately chose the default" case: set `duration` to the trade type's configured default _and_ `amount` to `default_stake`, switch tabs and switch back, and assert both are still the saved values (guards against the `this.amount === this.default_stake` inference at `:1934` leaking into the restore path).
- [x] 6.5 In `trade-store.spec.ts`, add refresh and browser-tab cases: with sessionStorage pre-seeded, a newly constructed store restores the active tab's params via `resolveInitialMarket`; with sessionStorage empty but `localStorage[OPEN_MARKETS_STORAGE_KEYS.manual]` populated (the new-browser-tab case under Q1 option (b)), every tab loads defaults.
- [x] 6.6 In `trade-store.spec.ts`, add supersession and pruning cases: two overlapping `selectMarketAndTradeType` calls apply only the later tab's params (extend the existing `market selection supersession (phantom-tab races)` block at `:1794`); `removeOpenMarket` prunes the closed tab's entry; `resolveContractTypeAvailability`'s fallback (`:1846` block) yields defaults; the same symbol open under two trade types keeps independent entries.
- [x] 6.7 In `packages/trader/src/AppV2/Components/MarketTabs/__tests__/market-tabs.spec.tsx`, assert the close handler (`market-tabs.tsx:275-292`) leaves the surviving tabs' params untouched and that closing the active tab activates the neighbour with _its_ params.
- [x] 6.8 In `packages/trader/src/AppV2/Utils/__tests__/open-markets-utils.spec.ts`, add a case pinning the strip's storage medium so a later change to it is a deliberate edit, not a silent regression. **Updated by task 8.1:** now pins sessionStorage (Q1 option (a) / D8) instead of localStorage, plus the legacy-eviction and "leaves the global `trade_store` blob alone" cases.
- [x] 6.9 In `trade-store.spec.ts`, add a `construction before root_store.ui is attached` block (task 5.9): constructing with `root_store.ui` unset does not throw; `is_automation_mode` resolves from `active_trade_panel_tab` while `ui` is missing; and once `ui` is attached the getter reads `is_mobile` again (mobile takes `is_automation_page`, not the panel tab). Verified red against the unguarded getter — it reproduces the reported `TypeError: Cannot read properties of undefined (reading 'is_mobile')`. Note the "does not throw" case alone passes either way under the Jest harness, so the mode-resolution assertion is the one that pins the defect.

## 7. Verification and docs

- [x] 7.1 `npm run test:jest -- packages/trader/src/AppV2/Utils/__tests__/tab-trade-params-utils.spec.ts packages/trader/src/AppV2/Utils/__tests__/open-markets-utils.spec.ts`
- [x] 7.2 `npm run test:jest -- packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts packages/trader/src/AppV2/Components/MarketTabs/__tests__/market-tabs.spec.tsx`
- [x] 7.3 `npm run test` (stylelint + eslint + full jest) before pushing, per `CLAUDE.md`. First run surfaced 18 failing suites / 67 failing tests plus 17 `tsc` errors, all of the form `Property 'closeAction' does not exist on type 'HeaderProps'` across the action-sheet surfaces (`date-picker.tsx`, `barrier-input.tsx`, `stake-mobile.tsx`, the AutomationPanel sheets, …). **Not a code defect:** this branch bumps `@deriv-com/quill-ui` `1.24.6 → 1.24.9` (where `closeAction` / `saveAction` were added to `HeaderProps`) and `package-lock.json` already resolves `1.24.9`, but the local `node_modules` still had `1.24.6` installed. `npm install` reconciled it and all 18 suites plus the 17 type errors cleared with no source change. CI installs from the lockfile so it was never affected; noted here because a stale local install reads exactly like a regression in this change.
- [x] 7.5 Update the storage comment block in `packages/trader/src/AppV2/Utils/open-markets-utils.ts:9-17` to cross-reference the new params map, so the two storage surfaces are discoverable from each other.
- [x] 7.6 Record the browser-close trade-off (Q2) as a `before-production` finding per `.buildwright/framework/findings.md` if the reviewer accepts option (i) but wants it revisited.

## 8. Strip scoped to the browser tab (Q1 re-resolved as option (a))

Follow-up after review: a new browser tab must show a single default market tab, not the market tabs
belonging to another browser tab. See `design.md` D8.

- [x] 8.1 Move `readOpenMarkets` / `writeOpenMarkets` (`AppV2/Utils/open-markets-utils.ts:39-46`) from localStorage to sessionStorage, and update the storage comment block (`:9-17`) so the two surfaces still cross-reference each other. Wrap the write in a `try` (quota / blocked storage), matching the params writer — losing the strip must never break the page.
- [x] 8.2 Add `clearLegacyOpenMarketsFromLocalStorage()` and call it from `readOpenMarkets`, not from the store: `TradeStore` seeds `open_markets_manual` / `open_markets_automation` in FIELD INITIALISERS, which run after `super()`, so a constructor-body cleanup would come too late. Idempotent; never touches `localStorage['trade_store']`, which still holds `currency` / `is_trade_params_expanded`.
- [x] 8.2a The eviction is once-per-module-instance and performs no write unless a legacy key is actually present. Caught by `barrier-reset.spec.ts`, which pins the exact `localStorage.removeItem` call count for a market switch: an unconditional eviction on every `readOpenMarkets` added 4 calls per read. Exposes `resetLegacyOpenMarketsCleanupForTesting()` so the eviction cases can re-arm it.
- [x] 8.3 Confirm the two strip-dependent branches flagged in the Q1 option-(a) note need no logic change: `resolveInitialMarket`'s stale-symbol preference (`:3300`) already falls through to `pickDefaultSymbol` on an empty strip, and the strip-convergence branch (`:3351`) is already guarded by `this.open_markets.length`. Verified — no edit required.
- [x] 8.4 Update `open-markets-utils.spec.ts`: invert the storage-medium pin to sessionStorage, point the round-trip / garbage seeds at sessionStorage, clear BOTH stores in `beforeEach` (the strip now lives in sessionStorage while the eviction cases seed localStorage), and add the legacy-eviction cases.
- [x] 8.5 Update `trade-store.spec.ts`: point every strip seed at sessionStorage, clear both stores in the strip teardowns, and correct the stale "the strip is in localStorage" comment on `seedRestoredSession`.
- [x] 8.6 Replace the old "new browser tab, where the strip survives but the params do not" case with one that seeds a legacy localStorage strip and asserts none of its markets are adopted, plus a same-session case for a present strip with an absent params map. Note the harness cannot settle `contract_type` (that comes from `contracts_for`), so the new-browser-tab case asserts "at most one tab, and none of the inherited ones" rather than exactly one.
- [x] 8.6a Add the browser-tab isolation contract to `open-markets-utils.spec.ts`: a refresh (same sessionStorage) keeps the strip while a NEW browser tab (fresh sessionStorage) sees none of it, and `readOpenMarkets` performs no `localStorage` write when there is no legacy strip to evict.
- [x] 8.7 Record the lost-on-browser-close strip in `docs/before-production.md` alongside the existing params finding (Q2), so product can weigh both together.
