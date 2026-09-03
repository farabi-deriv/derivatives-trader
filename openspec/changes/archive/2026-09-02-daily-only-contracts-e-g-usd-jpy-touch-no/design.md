# Design — daily-only contract expiry

## Context

`processContractsForV2` (`trade-store.ts:980-1049`) is the store's post-`contracts_for` settling step. It applies contract categories and values, then the per-trade-type default duration, then releases `is_awaiting_contracts_for` and fires `debouncedProposal()`. `requestProposal` returns early while that flag is set (`trade-store.ts:2127-2134`), so the flag is already the repo's mechanism for "don't price until the params have settled".

For USD/JPY + Touch/No Touch the configured preset (`touch_no_touch: 10 ticks`, `trade-parameter-presets.ts:399`) is invalid, so `getDefaultDuration` → `getSmallestDuration` returns `{ unit: 'd' }` (`trade-params-utils.tsx:591`, `:521`). `processContractsForV2` commits that with `expiry_type: 'duration'` and releases the hold. The store is then in a state (`duration_unit: 'd'`, `expiry_type: 'duration'`) that no longer matches how a daily contract is actually priced, and two React effects rush in to fix it after the fact:

| Writer                                             | What it writes                                                                     | Time source                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------- |
| `duration-desktop.tsx:286-297` (`useLayoutEffect`) | `expiry_type: 'endtime'`, `expiry_date: <tomorrow>`, `expiry_time: '23:59:00'`     | `dayjs()` (browser-local)    |
| `duration.tsx:103-117` (`useEffect`)               | `expiry_date: '<tomorrow>T23:59:59Z'`, `expiry_type: 'endtime'` (no `expiry_time`) | `new Date()` (browser-local) |

`duration.tsx`'s desktop early-return sits at line 327, _below_ the hooks, so on desktop **both** fire. `DurationDesktop` is a child, so its layout effect lands first; the parent's passive effect then overwrites `expiry_date` while leaving `expiry_time = '23:59:00'` in place.

`onChangeMultiple` → `processNewValuesAsync` commits synchronously via `updateStore` (`trade-store.ts:1986`) and only then `await`s `processTradeParams` (`:2012`), whose `StartDate.onChangeExpiry` (`start-date.ts:39-61`) does a `WS.tradingTimes(expiry_date)` round-trip before `ContractType.getExpiryTime` (`contract-type.ts:600-638`) resolves the real close time. The hold has already been released, so the pending `debouncedProposal` fires mid-await and `createProposalRequestForContract` (`proposal.ts:183-186`) builds `date_expiry` from the intermediate `'23:59:00'`. That is the failing request.

This is the pattern my earlier architecture note calls out: a derived-but-stored observable with multiple writers, corrected asynchronously after downstream consumers have already read it.

## Goals / Non-Goals

**Goals:**

- One `proposal` per daily-only market open, valid on the first try.
- A single writer for the daily expiry seed, inside the existing proposal hold.
- Server time and real `trading_days` instead of local `dayjs().add(1, 'days')`.
- Full `HH:mm:ss` precision preserved through the desktop end-time picker for daily contracts.

**Non-Goals:**

- Reworking intraday end-time handling. `getExpiryTime`'s same-day branch (`contract-type.ts:623-633`) keeps formatting `HH:mm` and keeps `setMinuteMultipleByFive`; the 5-minute grid the user sees depends on it. Ruled out rather than deferred — see the Evidence section of `proposal.md` for the probe results. Note this excludes only the _format_: the `.minute(60)` rollover in those same lines is in scope as [DCE-005] (section 6).
- Changing the mobile End time action sheet's save path. `duration.tsx:handleSave` (`:179-211`) already commits full `HH:mm:ss`.
- Any change to the `proposal` request shape, the WS layer, or `contracts_for` handling.
- A general `is_awaiting_*` refactor of the trade store.

## Decisions

### D1 — Seed inside `processContractsForV2`, before the hold releases

The daily branch runs in the same block that applies the default duration (`trade-store.ts:1010-1034`), i.e. before `this.is_awaiting_contracts_for = false` at `:1042`. Everything the seed triggers — including the `trading_times` round-trip — happens under the existing hold, and the single `debouncedProposal()` at `:1048` is the first request that goes out.

_Alternative considered:_ keep the seed in `duration-desktop.tsx` and add a new component-level hold flag. Rejected — it adds a second hold mechanism for the same class of problem and leaves two writers in place. The issue's own "alternatively" suggestion (reuse `is_awaiting_contracts_for`) points to the store; moving the derivation there is the way to reuse it without inventing a flag.

### D2 — The seed commits the date; the existing chain resolves the time

The seed writes `{ duration_unit: 'd', duration, expiry_type: 'endtime', expiry_date, expiry_time: null }` through `processNewValuesAsync(values, /* is_changed_by_user */ true, null, false)`.

Passing `is_changed_by_user: true` is deliberate: it is what makes `processNewValuesAsync` run `processTradeParams` (the gate at `:1988` matches only `symbol|contract_types_list` otherwise). That runs `StartDate.onChangeExpiry`, which fetches `trading_times` for `expiry_date`, populates `market_open_times`/`market_close_times`, and lets `ContractType.getExpiryTime` fill `expiry_time`. With `expiry_time: null` and a future `expiry_date`, `getExpiryTime` takes its `!start_date && ServerTime.get().isBefore(buildMoment(expiry_date), 'day')` branch (`contract-type.ts:620-621`) and returns `market_close_times.slice(-1)[0]` — exactly the close time we want, with the `'23:59:59'` fallback already built in at `:612`.

So there is **no second literal close time in the codebase**: `getExpiryTime` stays the only place that answers "what time does this contract expire". The seed only answers "on which date".

_Alternative considered:_ compute the close time in the new helper (the issue's first suggestion, `getTradingTimes(date, symbol).close.slice(-1)[0]`). Rejected — it duplicates `getExpiryTime`'s fallback and two-close-times rule, and re-introduces a competing derivation, which is the bug's root cause.

_Side effect, accepted:_ `is_changed_by_user: true` clears `proposal_info`/`is_purchase_enabled` and fires an extra `debouncedProposal()` at `:2031`. Both are harmless during init — the state is already empty and that call is swallowed by the hold, then coalesced by the 500 ms debounce with the release-time call.

### D3 — `getNextTradingDayDate` lives next to `getTradingDays`

New exported async helper on the `ContractType` helper object (`contract-type.ts`), where `getTradingDays`, `getTradingTimes` and their per-date caches already live:

```
getNextTradingDayDate(symbol, from_moment, has_intraday) -> 'YYYY-MM-DD'
```

- Candidate = `from_moment` when `has_intraday`, else `from_moment + 1 day`. `from_moment` is server time.
- Per candidate, `await getTradingTimes(candidate, symbol)` and step forward while `close?.[0] === '--'`, bounded at 7 iterations. `'--'` is already this codebase's "closed on that date" marker — `getExpiryTime` gates on it at `:614` and `day.tsx:232-236` at the picker.
- If the response carries no `close` array (no data), return the candidate unchanged — degrade to today's behaviour rather than block.

Resolved in tasks Q2. The first draft used `getTradingDays` and its weekday-name list (the shape `datepicker.tsx:30-40` consumes for `disabled_days`), but `getTradingDays` (`:491-507`) is the one helper in this file with **no** per-date memo: every call is a raw `WS.tradingTimes` frame and it does not populate the memo that `StartDate.onChangeExpiry` hits next. `getTradingTimes` is memoised per date (`:509`), and the final candidate is exactly the date `onChangeExpiry` fetches — so the seed costs zero extra frames on the common Mon–Thu path, and at most one more than the weekday-list approach when seeding on a Friday. It is also a per-date answer rather than a static weekly pattern, so a holiday returning `['--']` is skipped for free.

_Alternative considered:_ a pure `+1 day` and let the API reject a weekend date. Rejected — that is the same "burn a round-trip to learn the right answer" pattern this change removes.

### D4 — Components become readers

- `duration-desktop.tsx`: delete the `useLayoutEffect` at `:286-297`. In `getDisplayValue`, the `expiry_type === 'endtime'` branch (`:529-541`) already renders from the store; the `duration_unit === 'd'` branch at `:573-582` (which recomputes `dayjs().add(1,'day').hour(23).minute(59)`) becomes a fallback that reads `expiry_date`/`expiry_time` when present.
- `duration.tsx`: delete the seeding `onChangeMultiple` in the `duration_unit === 'd'` effect at `:103-117`. Keep initialising the local `saved_expiry_date`/`saved_expiry_time` state, but sync it from the store's `expiry_date`/`expiry_time` (the `expiry_epoch` effect at `:83-100` already does this once a proposal returns; the pre-proposal case now reads the seeded store values instead of inventing them).
- `applyDefaultDuration` (`:1296-1311`) — the mobile safety net invoked from `duration.tsx:130-141` — hardcodes `expiry_type: 'duration'`, which would knock a seeded daily contract back into the broken state. It gets the same daily branch so both entry points agree.

### D5 — Precision in the desktop end-time picker

`duration-end-time-desktop.tsx` keeps `HH:mm` for the intraday time grid (`TimeGridPicker` and `adjusted_start_time` are `HH:mm` throughout) and stops truncating for non-intraday contracts. Gate on the existing `hasIntradayDurationUnit(duration_units_list)`, which the file already imports and uses at `:122`:

- `:101` `getInitialTime` future-date branch — return `expiry_time` as-is instead of `.substring(0, 5)`, defaulting to `23:59:59`.
- `:254-257` `handleDateChange` — `setSelectedTime(market_close_time)` (full precision) instead of `.substring(0, 5)`; fallback `23:59:59`.
- `:144` the `selectedTime === '23:59'` guard — compare against the non-truncated value.
- `:290-302` `handleSave` — only append `:00` when the selection is genuinely `HH:mm` (it already tests `split(':').length === 2`, so this is satisfied once the daily path stops producing `HH:mm`).

Display (`:359`) already renders `${displayTime} GMT`, so it picks up the seconds for free — matching the mobile field, which shows `HH:mm:ss` for future dates (`duration.tsx:255-259`).

## Risks / Trade-offs

- **The trading-day search delays the first proposal.** → It happens under a hold that already exists, and it goes through `getTradingTimes`'s per-date memo — which `onChangeExpiry` then hits for the same date, so the common path adds no frame at all. Worst case (seeding on a Friday) it adds two memo-cold `trading_times` frames for the skipped weekend days. Either way one failing `proposal` is removed.
- **`is_changed_by_user: true` on an internal seed.** → It clears `proposal_info` and fires a held `debouncedProposal`. Both are no-ops during init. The alternative (`false`) skips `processTradeParams` entirely, which would leave `market_close_times` stale for the end-time picker and force us to duplicate `getExpiryTime` — strictly worse. Guard it with a store test asserting `expiry_time` is resolved before the hold releases.
- **Removing the `duration.tsx` effect could regress the mobile duration field's pre-proposal label.** → Covered by a test asserting the mobile field renders `Ends on <date>, 23:59:59 GMT` for a daily-only contract before any proposal response arrives.
- **`getTradingTimes` returning no `close` array (offline/unmocked).** → Explicit degrade-to-candidate path, plus a test.
- **Existing specs assert `'23:59'` in a couple of places** (`proposal.spec.ts:387`, `duration-end-time-desktop` behaviour). → Those are intraday/generic fixtures; the daily gate keeps them valid. Verify rather than assume when the suite runs.

## Migration Plan

None required — no persisted schema, feature flag, or API change. The seeded `expiry_date`/`expiry_time` are recomputed on every `contracts_for` settle, so a client carrying a stale `23:59:00` in `localStorage` self-corrects on the next load.

Rollback is a straight revert of the diff; nothing outside the trader package depends on the new helper.

## Open Questions

See `tasks.md` — the two decision-changing questions are recorded there with recommended defaults, per the plan's handoff convention.
