# Daily-only contracts must price on the first proposal

Tracks [deriv-com/derivatives-trader#1262](https://github.com/deriv-com/derivatives-trader/issues/1262).

## Why

For a symbol/trade-type pair whose `contracts_for` returns `daily` as the only duration unit (e.g. **USD/JPY → Touch/No Touch**), every load of the Trade page sends a `proposal` with `date_expiry` = `<tomorrow> 23:59:00 GMT`, which the API rejects with `ContractBuyValidationError` ("Contracts on this market with a duration of more than 24 hours must expire at the end of a trading day"). Only the follow-up `proposal` — built after the store has asynchronously corrected the value to `23:59:59` — actually prices the contract.

The cause is that the daily expiry is **derived in React components after the store is already live**, not owned by the store. Two component effects race the in-flight `debouncedProposal`:

- `duration-desktop.tsx:286-297` seeds a hardcoded `expiry_time: '23:59:00'` from local `dayjs()` time in a `useLayoutEffect`.
- `duration.tsx:103-117` separately seeds `expiry_date: '<tomorrow>T23:59:59Z'` (no `expiry_time`) from a local `new Date()`; because the desktop early-return sits _below_ the hooks, this effect runs on desktop too.

Both write through `onChangeMultiple`, which commits synchronously via `updateStore` and only _then_ awaits `processTradeParams` → `StartDate.onChangeExpiry` → `ContractType.getExpiryTime`, where the correct market close time is finally derived (`contract-type.ts:612-621`). The already-queued `debouncedProposal` fires inside that await window and reads the intermediate, wrong `expiry_time` (`proposal.ts:183-186`).

Cost per load: one guaranteed-to-fail round-trip, a `ContractBuyValidationError` in the WS stream, and a visible error window on the duration/price params. The seeded value also contradicts what the app already promises the user — _"Contracts will expire at exactly 23:59:59 GMT on your selected expiry date"_ (`contract-description-utils.tsx:94`).

Two adjacent defects in the same seed compound it: the date comes from **browser local time** (off-by-one near the GMT day boundary) and is a blind **`+1 day`** (lands on Saturday when seeded on a Friday, a non-trading day for forex).

## What Changes

- **Move ownership of the daily-only expiry seed out of the components and into `TradeStore.processContractsForV2`**, applied _before_ `is_awaiting_contracts_for` is released. The existing proposal hold (`trade-store.ts:2127`) then covers the seeding step, so no proposal is ever built from an intermediate value.
- **Derive the expiry date from server time and the next _available trading day_**, not from local `dayjs().add(1, 'days')`. A new helper consults `ContractType.getTradingDays(date, symbol)` and steps forward past non-trading weekdays.
- **Stop hardcoding the close time.** The seed writes `expiry_time: null` and lets the already-correct `StartDate.onChangeExpiry` → `ContractType.getExpiryTime` chain resolve the symbol's real close time (`trading_times.close.slice(-1)[0]`, falling back to `23:59:59`) — one derivation path instead of two.
- **Remove the two competing component seeds**: the `useLayoutEffect` in `duration-desktop.tsx` and the `duration_unit === 'd'` effect in `duration.tsx`. Both become pure readers of store state.
- **Stop truncating end times to `HH:mm` in the desktop end-time picker for daily contracts** (`duration-end-time-desktop.tsx:101, 144, 255, 257` and `handleSave`'s `${timeToSave}:00`), so an explicit end-date pick saves the actual close time rather than `23:59:00`.
- Fix the `duration_unit === 'd'` display fallback in `duration-desktop.tsx:573-582`, which independently recomputes `dayjs().add(1,'day').hour(23).minute(59)` instead of reading the store.

Not a breaking change: no API contract, route, or store field is added or removed. The observable _values_ of `expiry_date`/`expiry_time` for daily-only contracts change from wrong to correct.

## Capabilities

### New Capabilities

- `daily-contract-expiry`: How DTrader V2 chooses and commits the expiry date and time for contracts whose only duration unit is `daily` — who owns the derivation, when it is allowed to reach the `proposal` request, and how much precision is preserved through the end-time picker.

### Modified Capabilities

None. No requirement in `openspec/specs/` covers daily expiry derivation; `duration-end-time-fields` only specifies chevron affordances on the mobile End time fields and is untouched by this change.

## Impact

**Code**

- `packages/trader/src/Stores/Modules/Trading/trade-store.ts` — `processContractsForV2` (the default-duration block, ~1010-1034) and `applyDefaultDuration` (~1296-1311) gain a daily-only branch.
- `packages/trader/src/Stores/Modules/Trading/Helpers/contract-type.ts` — new exported `getNextTradingDayDate` alongside the existing `getTradingDays`/`getTradingTimes`.
- `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-desktop.tsx` — remove the seeding `useLayoutEffect`; make `getDisplayValue`'s `'d'` branch read the store.
- `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration.tsx` — remove the `duration_unit === 'd'` seeding effect; sync local `saved_expiry_*` state from the store instead.
- `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-end-time-desktop.tsx` — preserve `HH:mm:ss` for non-intraday contracts.

**Behaviour / observability**

- One fewer `proposal` frame and zero `ContractBuyValidationError` responses per daily-only market open. The error snackbar wired to `proposal_info[...].error_field === 'duration'` (`duration.tsx:276-292`) no longer flashes on load.

**Tests**

- `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/duration.spec.tsx`, `.../__tests__/duration_container.spec.tsx`, `packages/trader/src/Stores/Modules/Trading/Helpers/__tests__/contract-type.spec.ts`, `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.*` — new coverage plus updates where the removed component effects were implicitly relied on.

**Not affected**

- The mobile End time action sheet's own save path (`duration.tsx:handleSave`) already writes full `HH:mm:ss` and is unchanged.
- `ContractType.getExpiryTime`'s same-day/intraday branch still formats `HH:mm` (`:626`, `:633`). Investigated and **ruled out as a defect** — not deferred. The rollover bug found in those same lines **is** in scope, see [DCE-005].

## Evidence — why the same-day `HH:mm` format is not a defect

Issue [#1262](https://github.com/deriv-com/derivatives-trader/issues/1262) lists the zeroed seconds on the same-day branch as a related problem. Two independent checks say otherwise, and both are recorded here so the question is not re-raised against `:626`.

**1. No same-day path can express seconds.** `TimeGridPicker` — the only same-day time input — offers hours `00-23` and minutes in 5-minute steps (`time-grid-picker.tsx:18-21`). `adjusted_start_time` and `getClosestTimeToCurrentGMT` (`AppV2/Utils/trade-params-utils.tsx:312-343`) are `HH:mm` throughout, and the time field is gated on `is_24_hours_contract` (intraday **and** today), so a symbol's seconds-bearing close time never reaches a same-day selection. Zeroing seconds discards nothing the user asked for.

**2. The API accepts seconds on a same-day expiry and does not round them.** Three `proposal` requests against `wss://api-core.deriv.com/options/v1/ws/public` (2026-08-26, unauthenticated), differing only in the seconds of `date_expiry` — same minute, ~1h ahead:

| seconds | `R_100`                             | `frxUSDJPY`                         |
| ------- | ----------------------------------- | ----------------------------------- |
| `:00`   | accepted, echoed exactly (delta 0s) | accepted, echoed exactly (delta 0s) |
| `:30`   | accepted, echoed exactly (delta 0s) | accepted, echoed exactly (delta 0s) |
| `:59`   | accepted, echoed exactly (delta 0s) | accepted, echoed exactly (delta 0s) |

No rejection, no normalisation. The "must expire at the end of a trading day" rule applies only to durations over 24 hours, which by construction never reach this branch.

The same session confirmed the bug this change fixes, which had until then only been read off the code — `frxUSDJPY` CALL expiring the next day:

```
23:59:00 -> ContractBuyValidationError: Contracts on this market with a duration of more than
            24 hours must expire at the end of a trading day.   details={"field":"date_expiry"}
23:59:59 -> OK   date_expiry=1787875199   ask=10
```

**Do not "fix" `:626`/`:633` by emitting `HH:mm:ss`.** `setMinuteMultipleByFive` exists to keep the committed value on the 5-minute grid the pickers show (`:632`), and `TimeGridPicker`, `adjusted_start_time` and `getClosestTimeToCurrentGMT` all assume `HH:mm`. Changing the format ripples through the intraday pickers on both breakpoints to buy no behavioural change.
