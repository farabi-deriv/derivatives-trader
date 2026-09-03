## Why

On mobile web, switching between market tabs (the "tiles" on the Trade strip — Gold/USD and Step 200 Index in the report) raises the red error toast **"Please specify either duration or date_expiry."** on a tab where nothing is wrong, and the toast sits **on top of the Buy button**, blocking purchases ([issue #1246](https://github.com/deriv-com/derivatives-trader/issues/1246)). One tab in a bad duration state therefore blocks trading on a tab that is perfectly configured, and repeated switching makes the banner appear and vanish unpredictably.

Two independent defects combine here, and both are reproducible from the code:

1. **The client sends a proposal request the backend must reject.** `createProposalRequestForContract`'s `getDurationParams()` (`packages/trader/src/Stores/Modules/Trading/Helpers/proposal.ts:189-212`) returns `{}` when `expiry_type === 'endtime'` but `expiry_time` is falsy — so the outgoing `proposal` carries **neither** `duration` nor `date_expiry`, which is exactly the request shape the backend answers with "Please specify either duration or date_expiry.". The mobile Duration sheet is what puts the store into that state: its days-default effect (`packages/trader/src/AppV2/Components/TradeParameters/Duration/duration.tsx:103-117`) commits `{ expiry_date, expiry_type: 'endtime' }` **without** `expiry_time`, unlike its desktop counterparts, which both commit a time (`duration-desktop.tsx:287-294` → `expiry_time: '23:59:00'`; `duration-end-time-desktop.tsx:290-299` → `expiry_time: formattedTime`). A pre-existing `// TODO: Fix mobile duration param intermittently showing invalid duration error` sits directly above the offending helper (`proposal.ts:188`).

2. **The broken state — and its error — travel with the tab switch.** All market tabs share one `TradeStore`; a tab is only a `{symbol, contract_type}` pair (`AppV2/Utils/open-markets-utils.ts:3-6`). `handleTradeParamsResetOnSymbolChange` (`trade-store.ts:3306-3410`) only reconciles duration when the symbol's _duration support class_ changes, and `getSymbolDurationSupport` (`trade-store.ts:3277-3296`) classifies Gold/USD as `'ticks'` (it only special-cases `market === 'forex'`), the same class as Step 200 Index — so switching between them resets nothing and the invalid `endtime` + null `expiry_time` pair is carried straight onto the healthy tab, where it produces the same rejected request. `onProposalResponse` only drops responses from a stale `underlying_symbol` (`trade-store.ts:2178-2183`), so a rejection raised for the _new_ symbol is accepted and surfaced.

3. **Every trade-page error toast is positioned over the Buy button.** The snackbars pass `marginBottom: is_logged_in ? '48px' : '-8px'` (`ServicesErrorSnackbar:107`, `TradeErrorSnackbar:41`, `PurchaseButton:228`, `Duration:287`, plus flat `'48px'` in `Barrier:49` and `Day:144`). But the trade-params sheet is fixed at `bottom: 5.6rem` (`trade-parameters.scss:62`, = `HEIGHT.BOTTOM_NAV` 56px) and the Buy-button block is the bottom 72px of that sheet (`layout-utils.tsx:12-14`), so the Buy button occupies 56px–128px above the viewport edge. A snackbar anchored at 48px lands squarely on it. This is why an error — even a legitimate one — hides the primary action.

## What Changes

- **Never emit a proposal request without an expiry.** `getDurationParams()` gains a resolvable-expiry contract: for a duration-taking contract, if `expiry_type === 'endtime'` cannot resolve a `date_expiry`, fall back to the store's `duration`/`duration_unit`; if neither can be resolved, report "no expiry" so `requestProposal` **skips the request entirely** (clearing `proposal_info` / `proposal_requests` / `purchase_info` the same way its existing early-return guards do, `trade-store.ts:2118-2145`) rather than sending a request that is guaranteed to be rejected. Removes the "Please specify either duration or date_expiry." toast at source.
- **Close the state hole that creates it.** The mobile Duration sheet's days-default effect commits `expiry_time: '23:59:59'` alongside `expiry_date` / `expiry_type: 'endtime'`, matching the desktop writers and the value it already stores in local state (`duration.tsx:110`). Add a store-level invariant so an `endtime` expiry is never _committed_ without a usable `expiry_time` — it falls back to `expiry_type: 'duration'` instead.
- **A market-tab switch must not carry another tab's error.** `selectMarketAndTradeType` clears the outgoing tab's proposal error state (`proposal_info`, the trade-param `validation_errors`) and any pending `common.services_error` before the symbol/contract-type cascade, so nothing from the previous tab can be (re-)enqueued on the incoming one. `onProposalResponse`'s stale-response guard is extended to also drop responses whose `contract_type` is no longer among the current `trade_types` (a same-symbol trade-type switch).
- **An error toast never covers the page's primary action.** Add a single `getErrorSnackbarBottomOffset()` helper to `AppV2/Utils/layout-utils.tsx` (with a named `HEIGHT.PURCHASE_BLOCK = 72`) that returns an offset clearing the bottom nav **and** the Buy-button block on the trade page, and route all six `marginBottom` snackbar call sites through it. Replaces six copies of the magic `48px`.
- **Tests:** unit coverage for the malformed-request guard (`Helpers/__tests__/proposal.spec.ts`), the endtime invariant + tab-switch error clearing (`Trading/__tests__/trade-store.spec.ts`), the offset helper (`AppV2/Utils/__tests__/layout-utils.spec.ts`), and the snackbar components' use of it.

Explicitly **out of scope:** giving each market tab its own trade parameters (tabs share one `TradeStore` by design — see `design.md`); correcting `getSymbolDurationSupport`'s market classification for commodities (a broader duration-defaults change, tracked separately); and the underlying "duration bug" on Gold/USD beyond the `expiry_time` omission above. No API, dependency, or WebSocket-protocol changes; no breaking changes.

## Capabilities

### New Capabilities

- `proposal-request-integrity`: What the client guarantees about every outgoing `proposal` request — specifically that a duration-taking contract always carries a resolvable expiry (`duration`+`duration_unit` or `date_expiry`), and that when no expiry can be resolved no request is sent at all, so the user is never shown a backend rejection the client itself caused.
- `trade-error-notifications`: When a trade error notification (snackbar) is shown on mobile web, which market tab it belongs to, that switching market tabs clears the previous tab's error rather than carrying it over, and that an error notification never occludes the Buy button.

### Modified Capabilities

<!-- None. No existing spec under openspec/specs/ covers proposal request construction or error notifications: allow-equals-toggle, barrier-input, barrier-range-errors, contract-details-chart, duration-end-time-fields, market-descriptions, market-info-sync, positions-drawer and themed-scrollbars all cover unrelated surfaces. `duration-end-time-fields` is the closest neighbour but is scoped to the chevron affordance on the End time Date/Time trigger fields, not to expiry commitment. -->

## Impact

**Root cause (`inferred from code`):**

- `packages/trader/src/Stores/Modules/Trading/Helpers/proposal.ts:183-212` — `obj_expiry.date_expiry` is only populated when `store.expiry_time` is truthy (`:183`); `getDurationParams()` then falls through both branches and returns `{}` (`:211`) for `expiry_type === 'endtime'` with no time. The `// TODO: Fix mobile duration param intermittently showing invalid duration error` at `:188` documents the symptom.
- `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration.tsx:103-117` — the days-default effect calls `onChangeMultiple({ expiry_date, expiry_type: 'endtime' })` with no `expiry_time`, while setting the local `savedExpiryTime` to `'23:59:59'` at `:110`. `onChangeMultiple` (`trade-store.ts:1077-1086`) runs `processNewValuesAsync(values, true)`, whose tail calls `this.debouncedProposal()` (`trade-store.ts:2031`) — so the malformed request is sent immediately.
- Contrast (already correct): `duration-desktop.tsx:287-294` and `duration-end-time-desktop.tsx:290-299` both commit `expiry_time`.

**Tab-switch leakage (`inferred from code`):**

- `packages/trader/src/Stores/Modules/Trading/trade-store.ts:1097-1149` — `selectMarketAndTradeType` writes `symbol` then `contract_type` and clears no error state.
- `packages/trader/src/Stores/Modules/Trading/trade-store.ts:2175-2183` — `onProposalResponse`'s guard only compares `underlying_symbol`.
- `packages/trader/src/Stores/Modules/Trading/trade-store.ts:3277-3296` / `:3306-3410` — `getSymbolDurationSupport` / `handleTradeParamsResetOnSymbolChange`: Gold/USD and Step 200 Index both classify as `'ticks'`, so no duration/expiry reset happens between them.
- `packages/trader/src/AppV2/Components/MarketTabs/market-tabs.tsx:262-282` — `handleSelect` routes an inactive-tab tap to `selectMarketAndTradeType`; `packages/trader/src/AppV2/Utils/open-markets-utils.ts:3-6` — a tab is just a `{symbol, contract_type}` pair.

**Occlusion (`inferred from code`):**

- `packages/trader/src/AppV2/Components/ServicesErrorSnackbar/services-error-snackbar.tsx:107`, `packages/trader/src/AppV2/Components/TradeErrorSnackbar/trade-error-snackbar.tsx:41`, `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button.tsx:228`, `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration.tsx:287`, `packages/trader/src/AppV2/Components/TradeParameters/Barrier/barrier.tsx:49`, `packages/trader/src/AppV2/Components/TradeParameters/Duration/day.tsx:144` — six `marginBottom` sites.
- `packages/trader/src/AppV2/Utils/layout-utils.tsx:7-17` — `HEIGHT.BOTTOM_NAV = 56`, `HEIGHT.TRADE_PARAM_SHEET = 158` with the comment "8px top padding + params row (72) + **Buy button block (72)**".
- `packages/trader/src/AppV2/Components/TradeParameters/trade-parameters.scss:59-69` — `.trade-params__container { position: fixed; bottom: 5.6rem; }` and `--chart-maximized { bottom: 0; }`.
- `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button.scss:14-19` — the button is `height: var(--core-size-2400)` with `padding-block`, inside a wrapper padded `var(--core-spacing-600)` on mobile (`:88-91`).

**Which snackbar fires (`inferred from code`):** the message has no `error.details.field`, so `getProposalErrorField` returns `null` (`proposal.ts:71-79`), `error_field` is undefined, and `ServicesErrorSnackbar`'s `contract_error` branch (`services-error-snackbar.tsx:66-75`) is what enqueues it — not `TradeErrorSnackbar`, whose `TErrorFields` union (`Hooks/useTradeError.ts:7`) has no duration entry.

**Tests to add/update:**

- `packages/trader/src/Stores/Modules/Trading/Helpers/__tests__/proposal.spec.ts` (exists — already covers `createProposalRequestForContract`).
- `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` (exists).
- `packages/trader/src/AppV2/Utils/__tests__/layout-utils.spec.ts` (exists — imports `checkIsServiceModalError, getChartHeight, isTradeParamVisible`).
- `packages/trader/src/AppV2/Components/ServicesErrorSnackbar/__tests__/services-error-snackbar.spec.tsx`, `.../TradeErrorSnackbar/__tests__/trade-error-snackbar.spec.tsx`, `.../PurchaseButton/__tests__/purchase-button.spec.tsx` (all exist and already assert `delay: ERROR_SNACKBAR_DURATION` from the related fix c68fefec47 / #947).
- `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/` (exists).

**Docs:** No user-facing documentation describes the duration/expiry request shape or the snackbar offsets; `CLAUDE.md`'s "Gotchas" section documents purchase-button/error-message behaviour and gains a line about the shared snackbar offset helper (per `.buildwright/steering/philosophy.md`, "Documentation Is Part of Done").
