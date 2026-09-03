## Open Questions

Both are answered below with a RECOMMENDED default and the plan proceeds on that basis — neither blocks implementation. A reviewer may replace an answer; the affected tasks are named so the swap is mechanical.

**Q1. Should the fix also add a CSS `pointer-events: none` override on the third-party `.sc-interval__item--disabled` wrapper, on top of the callback guard?**

- **(a) RECOMMENDED — callback guard only.** Covers mouse, touch, keyboard and any future library path in one testable place; no dependence on third-party class names. Affects tasks 2.x only.
- (b) Guard **plus** a `pointer-events: none` override in `packages/trader/src/sass/app/modules/smart-chart.scss` (which already overrides `.sc-interval` internals). Belt-and-braces, but adds a stylelint/BEM-lint surface on classes we don't own and can mask a future upstream fix. Would add a task under §2 and a stylelint run under §5.
- (c) CSS override only. Rejected in `design.md` — leaves keyboard/programmatic activation open and is untestable in jsdom.

**Q2. Where should the guard predicate live?**

- **(a) RECOMMENDED — exported pure helper `shouldIgnoreGranularityChange` in `packages/trader/src/Modules/SmartChart/Utils/chart-utils.ts`,** next to the existing `getMarketsOrder` / `CHART_CONSTANTS`. Cheap TDD target, reusable if a second `ChartMode` consumer ever appears. Tasks 2.1–2.2 + 3.1.
- (b) Inline the two-term condition directly in `trade-chart.tsx` and cover it only through the component test. Slightly smaller diff; drop task 2.1 and 3.1 and fold the cases into 3.2.

## 1. Reproduce (Red — confirm the defect before changing code)

- [x] 1.1 Confirm the third-party root cause is still present in the installed version: `node -p "require('@deriv-com/smartcharts-champion/package.json').version"` (expect `1.10.1`), then extract `src/components/Timeperiod.tsx` from `node_modules/@deriv-com/smartcharts-champion/dist/smartcharts.js.map` and verify `onIntervalClick` early-returns only for `isLoading` and `key === 'tick' && chart_type_id !== 'line'` — i.e. the `!is_tick && allowTickChartTypeOnly` disabled branch still falls through to `changeGranularity(interval)`.
- [x] 1.2 Reproduce manually on `https://localhost:8443` (`npm run serve --workspace=@deriv/trader`): open the Trade page, select **Accumulators** (or a **Digits** trade type), open the chart's chart-mode/Time interval list, click a greyed-out interval such as **1 minute**, and record that the URL's `interval` query parameter flips from `1t` to `1m` while the chart still renders ticks. Also check `localStorage['contract_trade.granularity']` changed to `60`.
- [x] 1.3 Note the secondary symptom for the regression scenario: with `contract_trade.prev_granularity` at `0` (i.e. the tick chart was in use before Accumulators was selected), the `else if` restore branch in `packages/trader/src/Stores/Modules/Trading/trade-store.ts:1857-1866` is skipped because `prev_granularity && …` is falsy, so the bogus granularity survives the switch back to a candle-capable trade type.
- [x] 1.4 Write the failing unit test(s) first (see §3) and confirm they fail against unmodified source.

## 2. Implement the guard (Green)

- [x] 2.1 In `packages/trader/src/Modules/SmartChart/Utils/chart-utils.ts`, export a pure predicate `shouldIgnoreGranularityChange(granularity: number, is_tick_chart_type_only: boolean): boolean` returning `is_tick_chart_type_only && granularity !== 0`, with a TSDoc comment stating that `0` is the tick granularity (see `packages/trader/src/Modules/SmartChart/Adapters/types.ts:28`) and that the predicate exists because SmartCharts fires `onGranularity` for intervals it renders as disabled (issue #1037). _(Skip if Q2(b) is chosen.)_
- [x] 2.2 In `packages/trader/src/AppV2/Containers/Chart/trade-chart.tsx`, name the existing condition once — `const is_tick_chart_type_only = show_digits_stats || is_accumulator;` — and use it for the `granularity` prop (`:253`) and the `allowTickChartTypeOnly` prop (`:255`) in place of the two inline duplicates, so the guard cannot drift from what the chart disables.
- [x] 2.3 In the same file, add a memoised `handleGranularityChange` (`React.useCallback` over `[updateGranularity]`) that returns early when `shouldIgnoreGranularityChange(new_granularity, is_tick_chart_type_only_ref.current)` is true and otherwise calls `contract_trade.updateGranularity(new_granularity)`. Include a short comment pointing at issue #1037 and at `Timeperiod.tsx`'s missing guard.
- [x] 2.3a Keep the flag in a ref (`is_tick_chart_type_only_ref`, reassigned on every render) and read it inside the callback instead of capturing it — see §6. `updateGranularity` needs no ref: it is `action.bound`, so its identity is stable.
- [x] 2.4 Pass `updateGranularity={handleGranularityChange}` to `<ToolbarWidgets …>` in the `toolbarWidget` render prop (`:263-265`). Leave `updateChartType` untouched.
- [x] 2.5 Do **not** change `packages/core/src/Stores/contract-trade-store.js` (`updateGranularity` at `:274-287`), `packages/shared/src/utils/contract/trade-url-params-config.ts`, or `packages/trader/src/Modules/SmartChart/Components/toolbar-widgets.tsx` — `design.md` explains why the store and the URL writer are the wrong choke points, and the toolbar component needs no new prop.
- [x] 2.6 Verify by inspection that the programmatic callers are unaffected: `packages/trader/src/Stores/Modules/Trading/trade-store.ts:1855` (`updateGranularity(0)` on Accumulators/Digits), `:1863` (`updateGranularity(prev_granularity)` on leaving), `:2484` (`setChartModeFromURL`), and `:2692` (`chartStateChange` / `SET_CHART_MODE`) all call the store action directly and never go through `handleGranularityChange`.

## 3. Tests

- [x] 3.1 Add `packages/trader/src/Modules/SmartChart/Utils/__tests__/chart-utils.spec.ts` (new file) covering `shouldIgnoreGranularityChange`: `(60, true) → true`, `(86400, true) → true`, `(0, true) → false`, `(60, false) → false`, `(0, false) → false`. Keep or add existing `getMarketsOrder` coverage in the same file if it has none. _(Skip if Q2(b) is chosen.)_
- [x] 3.2 In `packages/trader/src/AppV2/Containers/Chart/__tests__/trade-chart.spec.tsx`, add a `jest.mock('Modules/SmartChart/Components/toolbar-widgets', …)` that captures the props it receives (mirroring the existing `mockSmartChartProps` capture for `Modules/SmartChart`), then render `TradeChart` and invoke the captured `updateGranularity`.
- [x] 3.3 Add the tick-only case: build a `mockStore` whose `modules.trade.contract_type` is a Digits trade type (or `ACCUMULATOR`) with `contract_trade.updateGranularity` as a `jest.fn()`; render, invoke the captured `updateGranularity(60)`, and assert `contract_trade.updateGranularity` was **not** called. Assert in the same test that `SmartChart` received `allowTickChartTypeOnly: true` and `granularity: 0`.
- [x] 3.4 Add the pass-through case: with a candle-capable `contract_type` (e.g. `TRADE_TYPES.RISE_FALL`), invoke the captured `updateGranularity(60)` and assert `contract_trade.updateGranularity` was called with `60`. Add a tick case in tick-only mode — `updateGranularity(0)` **is** forwarded — so the guard is proven to be granularity-specific, not a blanket block.
- [x] 3.5 Run the focused suites and confirm green: `npm run test:jest -- packages/trader/src/AppV2/Containers/Chart/__tests__/trade-chart.spec.tsx packages/trader/src/Modules/SmartChart/Utils/__tests__/chart-utils.spec.ts`.
- [x] 3.6 Run the neighbouring suites that touch this wiring and confirm no regressions: `npm run test:jest -- packages/trader/src/Modules/SmartChart/Components/__tests__/toolbar-widgets.spec.tsx packages/trader/src/Stores/Modules/Trading/__tests__/trade-store.spec.ts`.

## 4. Manual verification (spec scenarios)

- [x] 4.1 **Disabled interval is inert** — Trade page → Accumulators (then repeat with a Digits trade type) → chart mode → click several greyed-out intervals: the `interval` query parameter stays `1t`, `localStorage['contract_trade.granularity']` stays `0`, the chart keeps rendering ticks, and the tick item stays marked active.
- [x] 4.2 **Enabled intervals still apply** — Rise/Fall → select `1 minute`, then `5 minutes`: chart re-renders at each interval and the URL reads `interval=1m` then `interval=5m`; reload and confirm the interval is restored.
- [x] 4.3 **Tick interval on candle chart types** — with a candles/hollow/OHLC chart type selected, click the disabled tick interval: URL `interval` unchanged (pre-existing library guard; assert no regression). Then switch chart type to area and select the tick interval: chart shows ticks and URL reads `interval=1t`.
- [x] 4.4 **No resurrected interval** — from a candle interval (e.g. `5m`), select Accumulators (URL → `1t`), click disabled `1 minute` (URL must stay `1t`), then switch back to Rise/Fall: the chart and URL return to `5m`, never `1m`. Repeat the run starting from the tick interval so `prev_granularity` is `0` (the case from task 1.3) and confirm the chart stays on ticks.
- [x] 4.5 **URL param on load still honoured** — open `/?symbol=<open symbol>&trade_type=rise_fall&interval=5m&chart_type=candle` and confirm the chart loads at the 5-minute interval.
- [x] 4.6 Spot-check both breakpoints (desktop and mobile via `useDevice`), since `ToolbarWidgets` collapses behind the vertical-ellipsis button on mobile and `trade-chart.tsx` serves both.
- [x] 4.7 Spot-check the unrelated look-alike is untouched: the Duration **time grid picker** (`packages/trader/src/AppV2/Components/TradeParameters/Duration/time-grid-picker.tsx`) still disables out-of-hours hours/minutes and writes no URL params.

## 5. Lint, docs and wrap-up

- [x] 5.1 Run `npm run test:eslint-all` (or the trader-scoped equivalent) and `npm run prettify` over the touched files; fix anything introduced.
- [x] 5.2 Run `npm run test:stylelint` only if Q1(b) was chosen and SCSS was touched; otherwise record that no SCSS changed.
- [x] 5.3 Documentation check (steering: "Documentation Is Part of Done"): no README/CLAUDE.md/user-facing doc describes the chart interval selector's disabled behaviour, so no doc update is expected — state this explicitly in the PR description rather than leaving it implicit.
- [x] 5.4 Raise the upstream follow-up noted in `proposal.md`: report to `@deriv-com/smartcharts-champion` that `Timeperiod.onIntervalClick` lacks an early return for the `!is_tick && allowTickChartTypeOnly` disabled branch (and that `.sc-interval__item--disabled` sets `pointer-events: none` on the inner `<span>` only). Link issue #1037. Do not block this change on it.
- [x] 5.5 Open the PR against `master` from `bugfix/disabled-time-intervals-update-url-query`, referencing issue #1037, and include the before/after `interval` query-parameter evidence from tasks 1.2 and 4.1.

## 6. Revision — the guard was frozen at mount (QA feedback)

QA reported the first cut behaving inconsistently: sometimes an **enabled** interval did nothing when clicked, sometimes a **disabled** interval still rewrote `interval` in the URL — on the same build, depending on which trade type the page was opened with.

- [x] 6.1 Root cause: `Chart.tsx` in `@deriv-com/smartcharts-champion@1.10.1` memoises our render prop with `const ToolbarWidget = React.useCallback(toolbarWidget, [t.lang]);`, and `TimeperiodStore.updateProps` stores the `onGranularity` it was given. The toolbar therefore keeps calling the `handleGranularityChange` instance created on the chart's **first** render, whose closure held `is_tick_chart_type_only` from that render. Mount on Digits/Accumulators → flag stuck `true` → enabled intervals blocked after switching to a candle-capable trade type. Mount on a candle-capable trade type → flag stuck `false` → the original defect returns after switching to Digits/Accumulators.
- [x] 6.2 Red: two tests in `trade-chart.spec.tsx` (`granularity changes after the trade type changed`) that capture `toolbarWidget` before the trade type changes and invoke it after — one per direction. Against the first cut they failed with exactly the two reported symptoms: `updateGranularity` called 0 times for the enabled `60`, and called with `60` for the disabled one.
- [x] 6.3 Green: read the flag from `is_tick_chart_type_only_ref.current` inside the callback (task 2.3a). `shouldIgnoreGranularityChange`, `toolbar-widgets.tsx`, `contract-trade-store.js` and `trade-url-params-config.ts` are all unchanged by the revision.
- [x] 6.4 Verified the disabled-interval click has no second route into the store: `changeGranularity` is the only caller of `onGranularityChange` for a click, and SmartCharts has no `SET_CHART_MODE` state (its `STATE` constant list stops at `CROSSHAIR_CLICK`), so `chartStateChange`'s `updateGranularity` branch in `trade-store.ts:2690` is never reached from the interval list.
- [x] 6.5 `npm run test:jest -- packages/trader/src/AppV2/Containers/Chart packages/trader/src/Modules/SmartChart` — 145 tests green; ESLint over the two touched files reports 0 errors and `prettier --check` is clean.
- [x] 6.6 Re-run the manual checks in §4 for both mount orders: open the Trade page **on** Accumulators/Digits and switch away, then open it **on** Rise/Fall and switch to Accumulators — the guard must follow the current trade type in both directions.

## 7. Revision — cover the Digits disjunct at component level (review feedback)

Review noted that `is_tick_chart_type_only = show_digits_stats || is_accumulator` was only ever driven through `ACCUMULATOR` in `trade-chart.spec.tsx`, so the `show_digits_stats` disjunct had no component-level coverage (task 3.3 allowed either branch and Accumulators was the one chosen).

- [x] 7.1 `mockedTradeChartWithToolbar` now also sets `store.modules.trade.show_digits_stats` from `isDigitTradeType(contract_type)`, mirroring the real trade-store's computed (`trade-store.ts:2024`) — the mock store has no computed properties and omits the field entirely.
- [x] 7.2 Two cases added under `granularity changes coming from the chart` with `TRADE_TYPES.MATCH_DIFF`: the disabled `60` is swallowed (with `allowTickChartTypeOnly: true` and `granularity: 0` asserted, so the flag is proven to come from the Digits path — `isAccumulatorContract('match_diff')` is `false`), and the tick `0` is still forwarded.
- [x] 7.3 `npx jest packages/trader/src/AppV2/Containers/Chart/__tests__/trade-chart.spec.tsx` — 11 tests green. No source file changed: the guard, the ref, `shouldIgnoreGranularityChange`, the store and the URL writer are all untouched by this revision.

## Status notes (implementation run)

- **Red evidence (task 1.4):** `shouldIgnoreGranularityChange › ignores candle granularities while only the tick chart type is allowed` — `TypeError: shouldIgnoreGranularityChange is not a function`; `TradeChart › granularity changes coming from the chart › ignores a candle granularity while only the tick chart type is allowed` — expected `contract_trade.updateGranularity` to have 0 calls, received 1 call with `60`. Both green after the guard landed (12 tests in the two focused suites, 143 in the neighbouring suites).
- **Characterization (not red→green):** the two pass-through tests (`updateGranularity(0)` in tick-only mode, `updateGranularity(60)` on Rise/Fall) and the new `getMarketsOrder` cases passed before the change — they are regression guards, declared as such rather than presented as red→green.
- **Task 1.1 result:** installed `@deriv-com/smartcharts-champion` is `1.10.1`; `Timeperiod.onIntervalClick` (recovered from `dist/smartcharts.js.map`) early-returns only for `isLoading` and `key === 'tick' && chart_type_id !== 'line'`, confirming the defect. Recorded as an upstream finding in `docs/spec-to-pr/findings/smartcharts-timeperiod-disabled-interval-fires-ongranularity.md`.
- **Task 5.1 scope:** ESLint over the four touched files reports 0 errors (only pre-existing `no-explicit-any` / unused-var warnings matching the surrounding file style) and `prettier --check` is clean. The repo-wide `test:eslint-all` run belongs to the verification stage.
- **Open — needs a browser and an authenticated dev server (not available in this unattended run):** 1.2 and 4.1–4.7 (manual QA), 5.4 (filing the report with `@deriv-com/smartcharts-champion`; the finding file above carries the write-up), 5.5 (PR — handled by the shipping stage).
