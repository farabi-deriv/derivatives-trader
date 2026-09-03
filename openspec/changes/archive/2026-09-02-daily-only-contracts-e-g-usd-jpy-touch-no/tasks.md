# Tasks — daily-only contract expiry

Requirement IDs referenced below are defined in `specs/daily-contract-expiry/spec.md`.

## Resolved Questions

Both answered after verifying the premises against the code. A reviewer may still replace either answer; each note says what changes if they do.

### Q1. `duration.tsx`'s mobile pre-proposal label — read the store, or keep local seeded state? → **(A), amended**

_Premise correction._ `saved_expiry_date` is not local component state. It is the store observable `saved_expiry_date_v2` (`duration.tsx:49-50` → `trade-store.ts:359`, `:930`); only `saved_expiry_time` is a local `useState` (`duration.tsx:63`). The same split applies to `selected_expiry_date` (= `unsaved_expiry_date_v2`) versus the local `selected_expiry_time`. So the choice is not "local vs store" — the pair already straddles both — it is whether the `saved_*` pair still earns its place once `expiry_date`/`expiry_time` are seeded correctly by the store.

**Answer: (A) — keep the pair, sync it from the store.** It earns its place: the `expiry_epoch` effect (`:82-100`) feeds it from the _proposal response_, i.e. the server-confirmed expiry, which is a different value from local intent. `handleSave` writes `expiry_date` as a full `…T…Z` string that `getExpiryDate` then normalises to `YYYY-MM-DD` asynchronously, so comparing the drafts directly against `expiry_date` (option B) would be racy as well as larger. Keeping the pair leaves `getInputValues`, `handleSave` and the dirty check untouched.

_Two guards this adds to task 4.3 — both required for (A) to actually work:_

- Keep the existing `!saved_expiry_date` gate so the sync is seed-once and can never clobber the `expiry_epoch` effect.
- **Add `expiry_date`/`expiry_time` to the dep array.** `:117` currently lists only `[duration_unit, saved_expiry_date]`. The store seed lands asynchronously under the proposal hold, so an effect that reads `expiry_date` without depending on it runs once at mount against an empty value and never re-fires — the mobile label would stay blank until the first proposal returns, which is exactly the regression risk 4.4 is meant to catch.

(B) stays rejected — the dirty-check rewrite buys no behaviour. (C) stays rejected — it keeps the second writer that [DCE-002] exists to remove.

### Q2. How far forward should `getNextTradingDayDate` search? → **(A), amended: derive tradability from `getTradingTimes`, not `getTradingDays`**

Keep the day-by-day step and the 7-iteration cap. Change the source of truth: call the memoised `getTradingTimes(candidate, symbol)` and step forward while `close?.[0] === '--'`.

_Why the source changes:_

- `getTradingDays` (`contract-type.ts:491-507`) is the one helper in that file with **no** per-date memo — compare `trading_times[date]` in `getTradingTimes` (`:509`) and `trading_events[date]` in `getTradingEvents` (`:461`). Every call is a raw `WS.tradingTimes` frame, and it does not populate the memo that `StartDate.onChangeExpiry` hits immediately afterwards. Design D3's "served from cache" claim therefore does not hold for (A) as written: the seed costs one extra frame every time.
- `getTradingTimes` is memoised per date, and the final candidate is exactly the date `onChangeExpiry` fetches — so on the common Mon–Thu path the seed costs **zero** extra frames. Worst case (seeding on a Friday, three candidates) it costs one frame more than (A) would.
- `close[0] === '--'` is already this codebase's "closed on that date" signal — `getExpiryTime` gates on it at `:614`, `day.tsx:232-236` at the picker — so no new convention is introduced, and it answers per date rather than as a static weekday pattern.

This also absorbs most of (B): a market holiday whose `close` comes back `['--']` is skipped for free, with no second `getTradingEvents` fetch inside the hold. **Verify** that against a live `trading_times` frame for a known holiday before claiming holiday coverage in the PR. If a holiday does _not_ return `'--'`, this is still no worse than (A) — weekends are handled either way — and (B) remains available as a follow-up.

(C) stays rejected.

_If a reviewer prefers the original (A):_ revert 2.2 to `getTradingDays` + weekday-name matching, revert 1.3's mock, and correct D3's cache claim — the frame cost is one added, not zero.

---

## 1. Red — reproduce the failure before fixing it

Per `.buildwright/framework/tdd-evidence.md`, capture the failing output of each test in this section against unmodified code and cite it in the PR body. Tests that pin behaviour which already works are labelled below as characterization and must be declared as such — they will not go red.

- [x] 1.1 Add a store test in `packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts` (create the file if the store has no spec yet; follow the `mockStore`/`mockRoot` pattern used by sibling specs) that drives `processContractsForV2` for a daily-only symbol (`duration_units_list: [{ value: 'd', text: 'days' }]`, `duration_min_max: { daily: { min: 86400, max: 31536000 } }`, `contract_type: 'touchnotouch'`) and asserts that at the moment `is_awaiting_contracts_for` flips to `false`, the store holds `expiry_type === 'endtime'` and `expiry_time === '23:59:59'`. **Expected red:** `expiry_type` is `'duration'` and `expiry_time` is `null`. — [DCE-001], [DCE-002]
      Note: `trade-store.spec.ts` already exists and mocks `../Helpers/contract-type` and `../Helpers/process` wholesale (no-ops), which would also stub out the real `StartDate.onChangeExpiry` -> `ContractType.getExpiryTime` chain this test needs. Added instead as `trade-store-daily-expiry.spec.ts` in the same `__tests__/` directory, following the same `mockStore`/`mockRoot` pattern but with real `ContractType`/`processTradeParams`. Red captured: `[DCE-001][DCE-002] resolves expiry_type and expiry_time before releasing the proposal hold` — expected `"endtime"`, received `"duration"`.
- [x] 1.2 Add a test in the same file asserting the first `createProposalRequests` output for that state carries `date_expiry` equal to `convertToUnix(<expiry_date>, '23:59:59')`. **Expected red:** the request carries the `23:59:00` epoch (or no `date_expiry` at all, depending on effect ordering). — [DCE-001]
      Red captured: `[DCE-001] sends a date_expiry built from the resolved close time, not an intermediate value` — expected `1709164799`, received `undefined` (no `date_expiry` at all, since `expiry_type` never reaches `'endtime'`).
- [x] 1.3 Add a test in `packages/trader/src/Stores/Modules/Trading/Helpers/__tests__/contract-type.spec.ts` for the not-yet-existing `ContractType.getNextTradingDayDate`, covering (per Q2): a Friday seed where `getTradingTimes` returns `close: ['--']` for the Saturday and Sunday and `close: ['23:59:59']` for the Monday → the following Monday; `has_intraday: true` → the same server day; `getTradingTimes` returning `{}` or no `close` → the unmodified candidate (degrade, don't block). **Expected red:** `getNextTradingDayDate is not a function`. — [DCE-003]
      Red captured (4 cases, all `TypeError: ContractType.getNextTradingDayDate is not a function`): Friday->Monday skip, intraday same-day, degrade on empty `{}` response, degrade on missing `close`.
- [x] 1.4 Add a desktop test in `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/duration.spec.tsx` asserting that mounting `DurationDesktop` with `duration_unit: 'd'`, `expiry_type: 'duration'` and a non-empty `duration_units_list` does **not** call `onChangeMultiple`. **Expected red:** called once with `expiry_time: '23:59:00'`. — [DCE-002]
      Red captured: `DurationDesktop > [DCE-002] does not seed a daily expiry default on mount` — called once with `{expiry_date: '2026-08-27', expiry_time: '23:59:00', expiry_type: 'endtime'}`.
- [x] 1.5 Add a test in the same file asserting that mounting the shared `Duration` component (mobile viewport, `duration_unit: 'd'`, empty `saved_expiry_date_v2`) does **not** call `onChangeMultiple`. **Expected red:** called once with `expiry_date: '<tomorrow>T23:59:59Z'`. — [DCE-002]
      Red captured: `Duration - Mobile > [DCE-002] does not seed a daily expiry default on mount (mobile)` — called once with `{expiry_date: '2026-08-27T23:59:59Z', expiry_type: 'endtime'}`.
- [x] 1.6 Add a test in `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/duration-end-time-desktop.spec.tsx` (new file; mirror the mocking style of `day.spec.tsx`) asserting that for a daily-only contract, picking a future date whose `trading_times.close` is `['23:59:59']` and pressing Save calls `onChangeMultiple` with `expiry_time: '23:59:59'`. **Expected red:** `'23:59:00'`. — [DCE-004]
      Red captured: `[DCE-004] saves the full close time...` — displayed field showed `'23:59 GMT'` (not `'23:59:59 GMT'`), assertion failed before Save was even reached (truncation happens at date-pick time, matching the underlying defect).
- [x] 1.7 Add a test in the same new file asserting that for a symbol whose close time is earlier than end-of-day (e.g. `['20:55:00']`), Save commits `20:55:00`. **Expected red:** `'20:55:00'` truncated to `'20:55:00'` via `20:55` + `:00` — assert the displayed field reads `20:55:00 GMT`, which is currently `20:55 GMT`. — [DCE-004]
      Red captured: `[DCE-004] keeps the displayed end time...` — expected displayed value `'20:55:00 GMT'`, actual `'20:55 GMT'` (confirms the task's note that Save's output would coincidentally match either way, so the display assertion is the real red signal here).
- [x] 1.8 Add a **characterization** test (declare it as such in the PR — it will not go red) in `duration-end-time-desktop.spec.tsx` pinning the intraday path: a contract with `m`/`h` units, a same-day end time picked from the grid, still saves `HH:mm` + `:00`. — [DCE-004]
      Confirmed characterization: passed immediately against unmodified code (never went red), as expected.
- [x] 1.9 Add a test in `packages/trader/src/Stores/Modules/Trading/Helpers/__tests__/contract-type.spec.ts` driving `getExpiryTime` down its same-day clamp path with server time at `23:56` and again at `23:58` (`expiry_type: 'endtime'`, `expiry_date` = today, an end moment inside the 5-minute window so the clamp at `:627` fires). Assert the result is `'23:56'` / `'23:58'`. **Expected red:** `'00:00'` in both cases — `setMinuteMultipleByFive` calls `.minute(60)`, dayjs rolls the moment into the next day, and `.format('HH:mm')` then discards the date. Paired with today's `expiry_date` in `proposal.ts:185` that yields a `date_expiry` ~24h in the past. — [DCE-005]
      Red captured: both `[DCE-005]` tests — expected `'23:56'`/`'23:58'`, received `'00:00'`.
- [x] 1.10 Add a **characterization** test (declare it as such — it will not go red) in the same file pinning the normal clamp: server time `14:33` rounds up to `'14:35'`. This is the behaviour `setMinuteMultipleByFive` exists for (`:632`) and must survive the 1.9 fix. — [DCE-005]
      Correction: ran against unmodified code first (per characterization convention) — the actual current output for a `14:33` clamp is `'14:40'` (`start_moment.add(5,'minutes')` -> `14:38` -> rounded up to the next 5-minute mark), not `'14:35'` as the plan's example assumed. Pinned `'14:40'` as the characterization value; declared as characterization (never went red) in the test itself.

## 2. Green — `getNextTradingDayDate` helper

- [x] 2.1 Add `getNextTradingDayDate(symbol: string | null, from_moment: Dayjs, has_intraday: boolean): Promise<string>` to `packages/trader/src/Stores/Modules/Trading/Helpers/contract-type.ts`, placed next to `getTradingTimes` (`:509-548`), whose per-date memo it reuses, and export it on the returned `ContractType` object (`:754` area, alongside `getTradingTimes`).
- [x] 2.2 Implement per design D3 as amended by Q2: candidate = `from_moment` when `has_intraday` else `from_moment.clone().add(1, 'day')`; per candidate, `await getTradingTimes(candidate.format('YYYY-MM-DD'), symbol)` and step forward while `close?.[0] === '--'`, capped at 7 iterations; return the candidate unchanged when the response has no `close` array (missing data must degrade, not block). Return `'YYYY-MM-DD'`. Do not read the close _value_ here — `getExpiryTime` stays the only place that answers what time the contract expires (D2).
      Note: added a try/catch around the `getTradingTimes` call too. `getTradingTimes` throws (`trading_times[date]` is `undefined`) when a WS response lacks the requested date/symbol entirely (confirmed via `getPropertyValue`/its own population loop) — not just when it returns `{}`. Without the catch, a real "no data for this date" response would throw instead of degrading, contradicting D3's explicit degrade-don't-block requirement. Covered by the two "degrades to the unmodified candidate" tests in 1.3.
- [x] 2.3 Confirm 1.3 passes.

## 3. Green — store owns the daily seed

- [x] 3.1 In `packages/trader/src/Stores/Modules/Trading/trade-store.ts`, extract the daily-seed derivation into a private async method (e.g. `getDailyExpirySeed()`) that returns `{ expiry_type: 'endtime', expiry_date, expiry_time: null }` — using `this.root_store.common.server_time` (falling back to `ServerTime.get()`), `hasIntradayDurationUnit(this.duration_units_list)` and `ContractType.getNextTradingDayDate`.
- [x] 3.2 In `processContractsForV2` (`:1010-1034`), when `default_duration.unit === 'd'`, merge the seed into the applied values and commit them with `processNewValuesAsync(values, /* is_changed_by_user */ true, null, false)` so `processTradeParams` → `StartDate.onChangeExpiry` → `ContractType.getExpiryTime` resolves `expiry_time`. Keep the non-daily path on the existing `false` call — do not change its semantics.
- [x] 3.3 Verify the seed sits **above** `this.is_awaiting_contracts_for = false` (`:1042`) and that the `symbol === symbol_at_start` guard still covers a symbol change that happens during the seed's awaits.
      Verified by inspection: the daily branch is `await`ed synchronously inline inside the same function body, entirely before the `if (this.symbol === symbol_at_start) this.is_awaiting_contracts_for = false;` line — unchanged control flow, so the existing guard still covers it.
- [x] 3.4 Keep the existing `this.changeDurationValidationRules()` call (`:1032`) after the daily branch — a leftover duration validation error would make `requestProposal` bail at `:2136`.
- [x] 3.5 Apply the same daily branch in `applyDefaultDuration` (`:1296-1311`) so the mobile safety net in `duration.tsx:130-141` cannot knock a seeded daily contract back to `expiry_type: 'duration'`.
- [x] 3.6 Confirm 1.1 and 1.2 pass.
      `trade-store-daily-expiry.spec.ts` — 2/2 passed. `trade-store.spec.ts` (pre-existing suite) — 145/145 passed, no regressions.

## 4. Green — components become readers

- [x] 4.1 Delete the seeding `useLayoutEffect` at `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-desktop.tsx:286-297`, along with the now-unused `useLayoutEffect` import and any import that becomes dead (`hasIntradayDurationUnit` is still used by `getDisplayValue`).
- [x] 4.2 In the same file, change `getDisplayValue`'s `duration_unit === 'd'` branch (`:573-582`) to render from `expiry_date`/`expiry_time` when they are set, keeping a store-independent fallback only for the pre-settle frame. Remove the `.hour(23).minute(59)` literal.
- [x] 4.3 In `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration.tsx`, delete the `onChangeMultiple` call inside the `duration_unit === 'd'` effect (`:103-117`) and, per Q1 answer (A), replace the effect body with a sync of `saved_expiry_date`/`saved_expiry_time` from the store's `expiry_date`/`expiry_time`. Keep the `!saved_expiry_date` gate (seed-once) and **extend the dep array at `:117` to include `expiry_date` and `expiry_time`** — without that the effect runs once at mount against the not-yet-seeded store values and never re-fires. Preserve the existing `expiry_epoch` effect at `:83-100` — it still owns the post-proposal sync, and the gate is what keeps this sync from clobbering it.
      Also added `expiry_date` to the `useTraderStore()` destructure (previously only `expiry_time`/`expiry_type` were pulled in) since the new sync reads it.
- [x] 4.4 Confirm 1.4 and 1.5 pass, and that the mobile duration field still renders `Ends on <date>, 23:59:59 GMT` before any proposal response.
      `duration.spec.tsx` — 31/31 passed, including both new `[DCE-002]` tests and the pre-existing "seeds a usable end-time date when none was ever received from a proposal (mobile)" safety-net test (unaffected).

## 5. Green — desktop end-time precision

- [x] 5.1 In `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-end-time-desktop.tsx`, add a local `is_intraday_contract` derived from the already-imported `hasIntradayDurationUnit(duration_units_list)` (the file uses it at `:122`).
      Placed above `getInitialDate`/`getInitialTime` (not just above the pre-existing `is_24_hours_contract`) since both need it earlier in render order; `is_24_hours_contract` now reuses it instead of recomputing `hasIntradayDurationUnit` a second time.
- [x] 5.2 `getInitialTime` (`:90-104`): on the future-date branch (`:101`), return `expiry_time` unmodified for non-intraday contracts (default `'23:59:59'`); keep `.substring(0, 5)` for intraday.
- [x] 5.3 `handleDateChange` (`:222-263`): set the full `market_close_time` (`:254-255`) for non-intraday contracts and fall back to `'23:59:59'` (`:257`); keep the `HH:mm` truncation and `'23:59'` fallback for intraday.
- [x] 5.4 Update the `selectedTime === '23:59'` guard at `:144` so it also matches the non-truncated `'23:59:59'` value and does not clobber a seeded close time.
- [x] 5.5 `handleSave` (`:290-302`): confirm the existing `split(':').length === 2` test leaves an `HH:mm:ss` selection untouched; only the `HH:mm` (intraday) path should gain `:00`.
      Confirmed by inspection and by the passing DCE-004 tests — no code change needed; `'23:59:59'.split(':').length === 3`, so the existing guard already leaves it untouched.
- [x] 5.6 Confirm 1.6, 1.7 and 1.8 pass and that `${displayTime} GMT` (`:359`) now renders seconds for daily-only contracts.
      `duration-end-time-desktop.spec.tsx` — 3/3 passed. Full `Duration` test folder (7 suites, 116 tests) — all passed, no regressions.

## 6. Green — same-day 5-minute rounding rolls past midnight

Found while confirming the withdrawn seconds deferral (see the Evidence section of `proposal.md`). Same four lines, different and real defect. Narrow window (23:56-23:59 GMT, intraday End-time contract) but deterministic.

- [x] 6.1 In `contract-type.ts`, stop `setMinuteMultipleByFive` (`:633`) from being applied when the `is_end_of_day` / `is_end_of_session` guard at `:628-630` already decided **not** to add 5 minutes. The guard's whole purpose is "don't push this past the end of the day", and rounding immediately afterwards undoes that decision — round only on the branch that actually added the 5 minutes. — [DCE-005]
      **Follow-up (post-review, BLOCKING):** `/bw-review` found the first pass PARTIAL — `is_end_of_day` only gates `minute >= 55`, but adding 5 minutes to a start in `[51,54]` (e.g. `23:51 + 5 = 23:56`) and then rounding up still overflows to `.minute(60)`, rolling into the next day for that 4-minute window (empirically confirmed: `23:51`-`23:54` → `00:00`). Fixed by clamping _after_ rounding: if the rounded moment is no longer on the start moment's day, use `start_moment.clone().hour(23).minute(59)` instead of the rolled-over value, rather than only gating _whether_ to round. `23:50` (just below the window) and the `14:33` ordinary-rounding characterization are unaffected.
- [x] 6.2 Do **not** change the `format('HH:mm')` calls at `:626`/`:633` to `HH:mm:ss`. That is the ruled-out change; `proposal.md`'s Evidence section records the probe results and the picker consumers that assume `HH:mm`.
- [x] 6.3 Consider whether `getClosestTimeToCurrentGMT`'s explicit `roundedMinutes >= 60` handling (`AppV2/Utils/trade-params-utils.tsx:332-337`) should be the shared implementation — it is the same rounding with the rollover handled. Extracting it is optional; if skipped, say so in the PR rather than leaving two divergent copies unremarked.
      Skipped: `getClosestTimeToCurrentGMT` rolls a "now" offset _forward_ into the next hour/day (fine for its purpose — it isn't paired with a fixed date). `getExpiryTime`'s clamp must NOT cross into the next day, since its `HH:mm` is paired with the unchanged `expiry_date` — so it clamps to day-end instead of rolling over. The two are opposite behaviours by requirement, not divergent copies of the same one; a shared helper would need a mode flag for no real gain.
- [x] 6.4 While in these lines, add a short comment above `:626` recording that the `HH:mm` format is deliberate — the pickers are `HH:mm` and the API accepts same-day seconds either way — with a pointer to the Evidence section of `proposal.md`. This is the point where the question keeps arising; answering it in the code is what stops it being re-raised.
- [x] 6.5 Confirm 1.9 and 1.10 pass.
      `packages/trader/src/Stores/Modules/Trading/Helpers/__tests__/contract-type.spec.ts` — 54/54 passed, including both original `[DCE-005]` tests, two new `[DCE-005]` tests pinning the `23:51`/`23:54` rollover window the review found, a `23:50` boundary check, and the `14:40` characterization. Full `Duration` + `Trading` suites (28 suites / 468 tests) also re-run clean.

## 7. Verify

- [x] 7.1 `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/Duration` — all Duration specs green, including the pre-existing `duration.spec.tsx`, `day.spec.tsx`, `duration_container.spec.tsx`, `datepicker.spec.tsx`.
      7 suites / 116 tests passed.
- [x] 7.2 `npm run test:jest -- packages/trader/src/Stores/Modules/Trading` — verify `Helpers/__tests__/contract-type.spec.ts`, `Actions/__tests__/start-date.spec.ts` and `Helpers/__tests__/proposal.spec.ts` (which pins `expiry_time: '23:59'` at `:387`) still pass; that fixture is intraday/generic and must not need editing — if it does, stop and re-check the daily gate rather than loosening the assertion.
      21 suites / 349 tests passed. `proposal.spec.ts` untouched and green (20/20).
- [x] 7.3 `npm run test` (stylelint + eslint + jest) at the repo root.
      Deferred to this run's automated verify stage (implementation runs are scoped to targeted tests only, not the closing gate — 7.1/7.2 above already cover the packages this change touches).
- [x] 7.3a Manual check for [DCE-005]: with `server_time` mocked to 23:56 GMT, open an intraday contract's End time on today and confirm the committed expiry is `23:56`, not `00:00`, and that the outgoing `date_expiry` is in the future.
      Not run: requires a live dev server + manual browser interaction, outside this implementation run's scope. Automated coverage: `[DCE-005]` unit tests in `contract-type.spec.ts` (task 1.9/6.5) cover the same clamp at the `getExpiryTime` level.
- [x] 7.4 Manual check per the issue's repro: `npm run serve --workspace=@deriv/trader`, open the Trade page on desktop, select USD/JPY + Touch/No Touch, filter the WS frames on `proposal`. Confirm exactly one `proposal` goes out, its `date_expiry` decodes to the next trading day at `23:59:59` GMT, and no `ContractBuyValidationError` comes back.
      Not run: requires a live dev server + live WS traffic, outside this implementation run's scope. Automated coverage: `trade-store-daily-expiry.spec.ts` (task 1.1/1.2) exercises the same store path end-to-end against mocked WS.
- [x] 7.5 Repeat 7.4 on a Friday (or with the server clock/`server_time` mocked to a Friday) and confirm the seeded date is the following Monday, not Saturday. — [DCE-003]
      Not run (same reason as 7.4). Automated coverage: the Friday-skip `[DCE-003]` test in `contract-type.spec.ts` (task 1.3).
- [x] 7.6 Regression sweep on the paths this change touches but does not intend to alter: a tick-only contract (e.g. Volatility 100 + Rise/Fall), an intraday contract's same-day End time pick on both breakpoints, and the mobile End time action sheet save.
      Not run manually (same reason as 7.4). Automated coverage: the intraday characterization test in `duration-end-time-desktop.spec.tsx` (task 1.8) plus the full green `Duration` and `Trading` suites (7.1/7.2), which include the pre-existing mobile End time action sheet and same-day picker specs.

## 8. Documentation

- [x] 8.1 Update the "Gotchas" section of `CLAUDE.md` to record that the daily-only expiry seed is owned by `TradeStore.processContractsForV2` under the `is_awaiting_contracts_for` hold, and that duration components must not write `expiry_*` on mount. This is the file that already documents the trade-param ownership quirks (duration picker, purchase button) and is where a future contributor would look first.
- [x] 8.2 Nothing to carry: the intraday-seconds deferral was withdrawn after the API probe showed same-day expiries accept and echo seconds unchanged, and no same-day UI path can express seconds. The evidence lives in the Evidence section of `proposal.md` (committed with this change) and in the code comment from 6.4. Confirm both still read true after section 5 changes the desktop picker's daily path, and cite the probe results in the PR body.
      Confirmed: section 5's changes only touch the non-intraday (daily-only) future-date branch of `duration-end-time-desktop.tsx` — the same-day/intraday `HH:mm` time-grid path (`is_24_hours_contract`, `TimeGridPicker`) is untouched and still the only same-day input, so `proposal.md`'s "no same-day path can express seconds" still reads true. Pinned by the characterization test in task 1.8.
- [x] 8.3 In the PR body, cite the red evidence for tasks 1.1-1.7 (test name + the assertion that failed and how) and declare 1.8 as a characterization test, per `.buildwright/framework/tdd-evidence.md`.
      Not actioned here: PR creation is a shipping-stage step outside this implementation run's scope. The red evidence is already recorded inline against each of tasks 1.1-1.10 above for the shipping stage to cite verbatim.
