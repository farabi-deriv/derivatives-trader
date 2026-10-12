## Open Questions

The recommended option is baked into the checklist below, so the plan is complete and implementable as-is. These are the only choices that genuinely change the built code; a reviewer can override any of them.

### What should `STEP_PX` and its velocity curve be for the drag-to-step gesture?

- [recommended] `STEP_PX = 24` base with velocity acceleration so a flick covers larger ranges while a slow drag resolves single tenths (matches the plan; a uniform 0.10 step makes acceleration mandatory, and 24px is a comfortable phone default to tune on device)
- `STEP_PX = 24` with no acceleration (simpler, but crossing the range by drag becomes impractical and the wheel is purely a ±few-tenths nudge)
- `STEP_PX = 16` with velocity acceleration (more sensitive; risks accidental steps during a tap)

### When an accumulator contract is open and the Buy button becomes `Close $X`, how should the fixed 120px width behave?

- [recommended] Widen the pill in the open-contract state so `Close $X` fits without truncation (a longer amount stays readable; the collapsed 318px / expanded 482px geometry only applies to the fresh-contract state)
- Truncate the `Close $X` label at 120px with an ellipsis (keeps the pill width fixed but can hide digits of the amount)
- Keep 120px and let the label shrink its font (avoids truncation and width change but is visually inconsistent with other states)

### Are the chips' faint neighbour values always visible, or only while that param is being dragged?

- [recommended] Always visible, rendered in the pill's 16px padding band and clipped by `overflow: hidden`, exactly as every mockup shows (each chip is a mini-wheel; this reads as the intended design and needs no drag-state branch)
- Visible only while that chip is actively being dragged (less visual noise at rest, but adds a drag-state branch to the chip render and diverges from the mockups)

## 1. Shared orientation primitives (@deriv/shared)

- [x] 1.1 Add `PHONE_LANDSCAPE_MEDIA_QUERY` (`(orientation: landscape) and (max-height: 500px) and (min-width: 568px)`) and `isPhoneLandscape()` (query match AND `isMobileOs()`) to `packages/shared/src/utils/os/os_detect.ts`, beside `isMobileOs`/`isTabletOs`; export both from the package barrel (`packages/shared/src/index.ts` via `utils/os`).
- [x] 1.2 Add `@mixin phone-landscape` emitting the byte-identical query to `packages/shared/src/styles/devices.scss`.
- [x] 1.3 Write `packages/shared/src/utils/os/__tests__/os_detect.spec.ts` coverage (or extend the existing one) FIRST for `isPhoneLandscape`: true only when the query matches AND `isMobileOs()`; false when `isMobileOs()` is false; run it red against the missing export. Record inline: `Red: <test name> — expected <x>, got <y>`.
    - Red: `isPhoneLandscape [LTM-001] is true only when the media query matches and isMobileOs() is true` — expected `true`, got `TypeError: isPhoneLandscape is not a function` (export missing).

## 2. UI-store flags + trader hooks

- [x] 2.1 Add `is_landscape_trade_enabled` and `is_landscape_chrome_hidden` observables + `action` setters to `packages/core/src/Stores/ui-store.js`, declared beside `is_chart_maximized` (registered in `makeObservable`), default `false`, and **not** added to `local_storage_properties`.
    - Covered by `UIStore landscape trade flags [LTM-010]` in `ui-store.spec.ts` (characterization guard for the new store contract — flags default false, setters mutate, neither in `local_storage_properties`).
- [x] 2.2 Mirror both flags (and their setters) in `packages/stores/types.ts` (`TUiStore`/`TCoreStores`) and `packages/stores/src/mockStore.ts`.
- [x] 2.3 Write `packages/trader/src/AppV2/Hooks/__tests__/useIsPhoneLandscape.spec.ts` FIRST asserting: exact query string used; false when `isMobileOs()` is false; re-renders on `change`; `addListener` fallback path; listener removed on unmount. Add a query-aware `matchMedia` test helper (keys on the query string, tracks `change` listeners, can fire them inside `act()`) since `__mocks__/globals.js` returns `{ matches: false }`. Record red inline.
    - Red: `useIsPhoneLandscape [LTM-001] re-renders when the media query flips while mounted` — expected `true`, got `Cannot find module '../useIsPhoneLandscape'` (hook missing). Helper added at `AppV2/test-utils/match-media.ts`.
- [x] 2.4 Implement `packages/trader/src/AppV2/Hooks/useIsPhoneLandscape.ts` (`matchMedia` + `change` with `addListener` fallback, re-read on subscribe, `typeof window` guarded) to turn 2.3 green.
- [x] 2.5 Implement `packages/trader/src/AppV2/Hooks/useIsPhoneViewport.ts` (`isMobile || useIsPhoneLandscape()`) with a co-located test.
    - Red: `useIsPhoneViewport [LTM-007]` — expected `true`, got `Cannot find module '../useIsPhoneViewport'` (hook missing).

## 3. Unblock the landscape blocker

- [x] 3.1 Write `packages/core/src/App/Components/Elements/LandscapeBlocker/__tests__/landscape-blocker.spec.tsx` FIRST: blocker hidden only when `is_landscape_trade_enabled` && `pathname === routes.index`; still shown on `/reports` and `/contract/123` with the flag set; still shown on `/` when the flag is false. Record red inline.
    - Red: `LandscapeBlocker [LTM-003] renders nothing on the trade page when landscape trade mode is enabled` — expected `null`, got the rendered `.landscape-blocker` overlay (no early return yet).
- [x] 3.2 Add the early return `if (is_landscape_trade_enabled && pathname === routes.index) return null;` **before** the existing conditional in `packages/core/src/App/Components/Elements/LandscapeBlocker/landscape-blocker.tsx` (read the flag from `ui` via `useStore`). Turn 3.1 green.

## 4. Trade page three-way branch + lifecycle hoist (highest risk)

- [x] 4.1 Write `packages/trader/src/AppV2/Containers/Trade/__tests__/trade.spec.tsx` FIRST: three-way branch `is_phone_landscape && is_accumulator → TradeLandscape`, incl. **phone-landscape + non-accumulator → not landscape (falls through to mobile/desktop)**; `is_landscape_trade_enabled` set on mount for accumulators, cleared on unmount / non-accumulator. Record red inline.
    - Red: `Trade three-way branch [LTM-004] renders TradeLandscape when phone-landscape and accumulator` — expected `trade-landscape-surface`, got the mobile surface (no landscape branch). `[LTM-002] sets is_landscape_trade_enabled on mount` — expected `setLandscapeTradeEnabled(true)`, got 0 calls.
- [x] 4.2 In `packages/trader/src/AppV2/Containers/Trade/trade.tsx`: add the three-way branch (`useIsPhoneLandscape()` + `is_accumulator`) rendering a new `<TradeLandscape/>`, and an effect that sets/clears `ui.is_landscape_trade_enabled` from `is_accumulator` (runs in portrait too).
- [x] 4.3 **Hoist the `onMount`/`onUnmount` effect out of `trade-mobile.tsx` and `trade-desktop.tsx` into `trade.tsx`** so a rotate (child swap) no longer tears down proposal subscriptions; remove the now-duplicated effect from both children. Add a test asserting `onMount`/`onUnmount` fire only on `trade.tsx` mount/unmount, not on the child swap.
    - Red: `Trade lifecycle survives rotation [LTM-005]` — expected `onMount` called once from `trade.tsx`, got 0 (effect not yet hoisted). Relocated the now-stale `should call onMount on component mount` case out of `trade-mobile.spec.tsx` (behaviour moved to `trade.tsx`).
- [x] 4.4 Gate: run the trader specs touching the hoisted paths (`Containers/Trade/__tests__/*` — trade, trade-mobile, trade-market-change-reactivity — all green, 24 tests); the exhaustive `packages/trader` run is the automated verify stage's job (run's resource guardrail forbids an unbounded full-suite run here). A repo-wide grep confirms only these three specs reference `trade-mobile`/`trade-desktop`.

## 5. Shell chrome for landscape

- [x] 5.1 In `packages/trader/src/AppV2/Containers/AppShell/app-shell.tsx`, add an `app-shell--chrome-hidden` class driven by `ui.is_landscape_chrome_hidden` (keep the rail mounted, do not change the `{!isMobile && <Sidebar/>}` condition); collapse the rail with CSS scoped under `@include phone-landscape`.
- [x] 5.2 Add a `@include phone-landscape` block to `packages/core/src/sass/app/_common/layout/app-layouts.scss` for `.app-contents { height: 100dvh }` (L67 hardcodes `100vh`) and to pin the `ThemedScrollbars` overflow that `!isMobile` introduces.

## 6. Landscape layout container

- [x] 6.1 Write `packages/trader/src/AppV2/Containers/Trade/__tests__/trade-landscape.spec.tsx` FIRST: renders `MarketTabs` + `AccountHeader` + `AccumulatorStats` + chart + params slot; does **not** render `OnboardingGuide` / `CompactHeader` / `TradeParametersContainer`; never calls `getChartHeight`. Record red inline.
    - Red: `TradeLandscape [LTM-006] renders MarketTabs, AccountHeader, AccumulatorStats, the chart and the params slot` — expected `market-tabs` in the DOM, got nothing (placeholder rendered only an empty `.trade--landscape`). The omits/getChartHeight cases are characterization guards (declared as such — they can never go red since those pieces are simply not imported).
- [x] 6.2 Create `packages/trader/src/AppV2/Containers/Trade/trade-landscape.tsx` + `trade-landscape.scss`: flex column `100dvh` (with a `100vh` fallback declared first) — collapsible `header` (`MarketTabs` + `AccountHeader`), always-visible `AccumulatorStats`, chart region (`flex:1; min-height:0; position:relative`) with `TradeChart` at `height:100%` and a stubbed `<LandscapeTradeParams/>` slot (absolute, bottom-right) behind the agreed prop contract. Turn 6.1 green.
- [x] 6.3 Add a `@include phone-landscape` block to `packages/trader/src/AppV2/Components/AccumulatorStats/accumulator-stats.scss` resetting the desktop `position: absolute; bottom: 10.2rem; right: calc(50% - 22.8rem)` back to static flow (no TSX change to `accumulator-stats.tsx`).
- [x] 6.4 Add a defensive `body` overflow reset in the landscape mount effect (quill portals set `body` overflow), and close any open sidebar flyout on entering landscape (`ui.closeSidebarFlyout()`).

## 7. Auto-hide chrome

- [x] 7.1 Write `packages/trader/src/AppV2/Hooks/__tests__/useAutoHideChrome.spec.tsx` FIRST (fake timers): hides at 4000ms; `pointerdown` restores and restarts; **the event still reaches an inner handler with `defaultPrevented === false`**; `is_paused` → never hides; unmount clears timer + listener + resets the flag; un-hide action fires only when currently hidden. Record red inline.
    - Red: `useAutoHideChrome [LAH-001] hides chrome after 4000ms` — expected `setLandscapeChromeHidden(true)`, got `Cannot find module '../useAutoHideChrome'` (hook missing).
- [x] 7.2 Implement `packages/trader/src/AppV2/Hooks/useAutoHideChrome.ts` (single `setTimeout` ref armed on mount + each reset; capture-phase `passive` `document` `pointerdown` listener that never `preventDefault`/`stopPropagation`; `is_paused` input; cleanup resets `is_landscape_chrome_hidden`). Call it from `trade-landscape.tsx`. Turn 7.1 green.
- [x] 7.3 Arm a local `--landscape-animating` class for `CHART_MAXIMIZE_ANIMATION_MS` (reuse the constant from `layout-utils.tsx`) on each flip to neutralise SmartCharts' `.chartContainer` transition; transition `max-height`/`opacity` on rail, header and the collapsing TP chip, mirroring `.trade__market-tabs--collapsed`. (Chart neutralise = `.trade--landscape--animating .chartContainer`; header + rail transitions added; TP-chip transition lands with the pill in §9.5.)

## 8. Value-ladder logic + drag hook + rows renderer (standalone, before wiring)

- [x] 8.1 Write `packages/trader/src/AppV2/Utils/__tests__/landscape-wheel-utils.spec.ts` FIRST: `valueAt`/`indexOf` exact inverses across the range; `valueAt(i)*10` always integer (float-drift guard); `min = 0.35` floors to `0.40` (never below the server minimum); `max` clamps downward; `indexOf` clamps at both ends. Record red inline.
    - Red: `landscape-wheel-utils [LTP-003] valueAt and indexOf are exact inverses across the range` — got `Cannot find module '../landscape-wheel-utils'` (module missing).
- [x] 8.2 Implement `packages/trader/src/AppV2/Utils/landscape-wheel-utils.ts` (the five-line integer-tenths ladder: `floor_t`, `ceil_t`, `count`, `valueAt`, `indexOf` + clamp) reading bounds from `validation_params[ACCUMULATOR].{stake,take_profit}.{min,max}`. Add a comment recording the **fiat-only** assumption (a `0.10` step does not suit a crypto account; see `docs/spec-to-pr/deferrals/`). Turn 8.1 green. (`buildLadder({min,max})` is the pure numeric core; the adapters in §9 feed it the `validation_params` bounds.)
- [x] 8.3 Write `packages/trader/src/AppV2/Components/TradeParameters/Landscape/__tests__/use-param-drag.spec.tsx` FIRST: 48px drag at `STEP_PX: 24` emits exactly 2 steps; a 2px move emits none and still counts as a tap; the sub-step remainder carries into the next `pointermove`; `pointercancel` releases the capture. Record red inline.
    - Red: `useParamDrag [LTP-004] a slow 48px drag at STEP_PX 24 emits exactly 2 steps` — got `Cannot find module '../use-param-drag'` (hook missing).
- [x] 8.4 Implement `packages/trader/src/AppV2/Components/TradeParameters/Landscape/use-param-drag.ts` (`pointerdown` capture + mark active; `pointermove` → `trunc(dy/STEP_PX)` with carried remainder + velocity acceleration; `pointerup`/`pointercancel` release + settle; `touch-action: none` on the chip; <4px = tap). `STEP_PX = 24`. Turn 8.3 green.
- [x] 8.5 Implement `packages/trader/src/AppV2/Components/TradeParameters/Landscape/landscape-value-rows.tsx` (shared prev/current/next renderer used by both chip and panel) with a co-located test asserting exactly three rows and correct clamping at both ends.
    - Red: `LandscapeValueRows [LTP-005] renders exactly three value rows` — got `Cannot find module '../landscape-value-rows'` (component missing).

## 9. Pill, chips, adapters, balance hint, snackbar offset

- [x] 9.1 Extract the balance-hint logic (`basis === 'stake'` guard + `getInsufficientBalanceMessage`) from `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx` into a shared `packages/trader/src/AppV2/Hooks/useStakeBalanceHint.ts`; repoint `stake-input.tsx` and `stake-input-desktop.tsx` to it. Keep the existing `Stake`/`TakeProfit` specs green (portrait behaviour unchanged).
    - Characterization: pure extraction (no behaviour change) — the existing `Stake` suites (86 tests) stay green, covering the portrait hint/error/Save gating unchanged.
- [x] 9.2 Implement adapters `use-landscape-stake.ts` and `use-landscape-take-profit.ts` under `.../Landscape/adapters/`, each returning `{ key, label, display_value, is_disabled, buildLadder, selected_value, commit, hint, should_block_commit }`. Stake commits `onChange({ target: { name: 'amount', value } })`; take profit commits `onChangeMultiple({ has_take_profit, take_profit, …(enabled ? { has_cancellation: false } : {}) })`, mirroring `RiskManagement/take-profit-and-stop-loss-input.tsx`. Only `use-landscape-stake.ts` imports `client.balance`/`useStakeBalanceHint`. Take-profit "off" is a sentinel (`value: ''`, label `Off`) below the TP minimum; the chip shows `-` while off. (Adapter shape refined to an index-based contract in `types.ts` — `last_index`/`selected_index`/`labelAt`/`commit(index)`/`getHint`/`shouldBlockCommit` — so the TP off sentinel and the per-index balance hint compose cleanly; the off row displays `-` to match portrait.) (Later superseded: the off sentinel was replaced by an on/off switch in the take-profit panel, per the revised LTP-007 — the ladder now holds amounts only, and the adapter contract gains `is_on`/`toggle`.) (Later superseded: per the revised LTP-008, landscape runs no client-side balance check — `getHint`/`shouldBlockCommit` were removed from the contract and the stake adapter no longer reads `client.balance`.)
    - Red: `useLandscapeTakeProfit [LTP-007] committing the sentinel turns take profit off` — expected `onChangeMultiple({ has_take_profit: false, take_profit: '' })`, got `Cannot find module '../use-landscape-take-profit'` (adapter missing).
- [x] 9.3 Implement `packages/trader/src/AppV2/Components/TradeParameters/Landscape/landscape-param-chip.tsx` (bespoke `landscape-params__chip`, `role="spinbutton"` + `aria-valuenow`/`aria-valuetext` + arrow-key stepping; hosts the drag; renders the small mirror of `landscape-value-rows`; honours `prefers-reduced-motion` by cross-fading). It takes no error/status prop. (Later superseded: the drag moved from the chip to the glass panel, so the chip only opens the panel — tap, or arrow keys to step — and no longer renders neighbour rows.)
    - Red: `LandscapeParamChip [LTP-012] arrow keys step the ladder` — expected `onStep(1)`, got `Cannot find module '../landscape-param-chip'` (component missing).
- [x] 9.4 Implement `packages/trader/src/AppV2/Components/TradeParameters/Landscape/landscape-value-panel.tsx` (frosted glass, sibling of the pill, three rows via `landscape-value-rows`, renders the hint + error-coloured row when `should_block_commit` — later removed per the revised LTP-008) and `landscape-trade-params.tsx` (`observer`; owns `active_param`, one-open-at-a-time; renders chips + panel + `<PurchaseButton/>`; `onOverlayOpenChange` prop; effect clears `active_param` + fires `onOverlayOpenChange(false)` when a param becomes disabled, e.g. an open contract). Commit on settle (120ms debounce / `pointerup`), idempotent via `last_committed_ref`, never on open; re-derive index from the store after a clamp. Do **not** call `useProposal`. (Commit state machine lives in the testable `use-landscape-param-editor.ts`; commits on `pointerup`/keyboard settle — no debounce needed since a settle always follows a step.)
    - Red: `useLandscapeParamEditor [LTP-006] settle commits once on a new value` — expected `commit` called once, got module-missing before implementation.
- [x] 9.5 Add `.../Landscape/landscape-trade-params.scss`: pill `318×90` collapsed / `482px` expanded, `1px` border, `blur(4px)`, no background, `overflow: hidden`, `radius 999px`, logical properties for RTL; panel `198×136`, `padding 16`, `gap 8`, `radius 16`, `blur(4px)`, one `box-shadow` with four inset layers; chip `148×56` solid; all colours from the existing semantic tokens (per LTP-011); `@supports not (backdrop-filter)` opaque fallback for **both** surfaces; collapsed state animates the TP chip out via `max-width`+`opacity`; per the open questions, widen the pill in the open-contract state and keep chip neighbour values always visible. (Collapsed state conditionally renders the TP chip out — the required "collapsed renders one chip" test asserts a single spinbutton — while the pill-width transition still animates the collapse; the chip's own `max-inline-size`/`opacity` transition is declared for when it is present.) (Later superseded: the TP chip now stays mounted and collapses in place via `--collapsed` — width, padding, border and opacity to zero, then `visibility: hidden` — so it animates out and back instead of popping.)
- [x] 9.6 Fit `<PurchaseButton/>` in landscape with CSS only — override `__wrapper { width: 100% }` to `120px` and the skeleton width with it. Do **not** modify `purchase-button.tsx`. Add a comment at `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button.tsx:137` warning that `isMobile` must NOT be swapped for `useIsPhoneViewport()` (it would flip `has_no_button_content` and restore the payout caption).
- [x] 9.7 Add an `is_landscape` argument to `getErrorSnackbarBottomOffset` in `packages/trader/src/AppV2/Utils/layout-utils.tsx` returning the pill height + inset + gap (keep the number in the helper — no hard-coded offset at call sites); wire the landscape error snackbar to pass it. (`TradeErrorSnackbar` reads `useIsPhoneLandscape()` → `is_landscape`; also rendered in `trade-landscape.tsx`.)
- [x] 9.8 Write the wiring/contract specs and turn them green:
    - `.../Landscape/__tests__/landscape-value-panel.spec.tsx`: renders exactly three values however large the range; clamps at both ends; settle commits once; re-settle on the same value is a no-op; **opening on a fractional stored value does not commit**.
    - `.../Landscape/__tests__/landscape-trade-params.spec.tsx`: the panel is a **sibling** of the pill, not a descendant (guards the `overflow: hidden` clipping trap); collapsed state renders one chip + Buy.
    - `.../Landscape/__tests__/landscape-stake.spec.tsx` (**the contract spec**): balance 5, wheel at 50 ⇒ hint renders, `onChange` **not** called, Buy present and **not** disabled, chip carries no error class. (Later revised with LTP-008: no hint, `onChange` **is** called, Buy present and enabled, chip neutral.)
    - Extend `packages/trader/src/AppV2/Components/PurchaseButton/__tests__/purchase-button.spec.tsx`: in landscape (`isMobile: false`, accumulator, no open contract) the payout caption is **absent**.
    - Extend `packages/trader/src/AppV2/Utils/__tests__/layout-utils.spec.ts`: the landscape snackbar offset; every existing case unchanged.
      Record red inline for each behaviour spec (the panel/commit/contract specs are red→green; the sibling-structure and payout-absent specs are characterization guards — declare them as such inline).
    - Red (commit): `useLandscapeParamEditor [LTP-006] settle commits once` — red on module-missing (see 9.4). Contract spec `Landscape stake balance contract [LTP-008]` — red on `landscape-trade-params` module-missing before the pill existed. Snackbar `[LTP-010]` — red on the `is_landscape` arg before it was added.
    - Characterization (declared): `landscape-trade-params.spec [LTP-002] panel is a sibling` and `[LTP-001] collapsed renders one chip + Buy` guard the structure; `purchase-button.spec [LTP-009]` guards the payout caption absent; `landscape-param-chip.spec [LTP-008] chip takes no error prop` and `landscape-tokens.spec [LTP-011]` guard invariants — none go red (they pin behaviour that is correct by construction).

## 10. Trade-type lock, chart correctness, isSmallScreen hardening

- [x] 10.1 In `MarketTabs` (`packages/trader/src/AppV2/Components/MarketSelector`/market-tabs) disable the trade-type selector in landscape (read `useIsPhoneLandscape()` or the store flag) while leaving symbol switching available; add a test for both. The blocker stays as the safety net. (Locked at the actual selector — `MarketSelection/trade-type-tabs.tsx`, opened by MarketTabs — which reads `useIsPhoneLandscape()`; Favourites/symbol navigation stays enabled.)
    - Red: `TradeTypeTabs [LTM-008] locks the trade-type tabs in landscape` — expected the Rise/Fall tab `disabled`, got it enabled (no lock yet).
- [x] 10.2 In `packages/trader/src/AppV2/Containers/Chart/trade-chart.tsx`, swap `isMobile` for `useIsPhoneViewport()` on the touch-modality/accumulator-geometry props: `isMobile → true`, `settings.minimumLeftBars → 3`, `isVerticalScrollEnabled → false`, `enabledNavigationWidget → false`, `drawingToolFloatingMenuPosition → mobile`, `yAxisMargin.top → 76`, `leftMargin → 80`, and keep `maxTick` bounded at `8` (never `undefined`). Add a test asserting the landscape prop values.
    - Red: `TradeChart phone-landscape chart props [LTM-007]` — expected `isMobile=true`/`maxTick=8`/`minimumLeftBars=3`/`yAxisMargin.top=76`, got the desktop values (props still gated on `isMobile`).
- [x] 10.3 Harden `isSmallScreen()` in `packages/trader/src/AppV2/Utils/trade-params-utils.tsx` with an `(orientation: portrait)` term; add/extend a test that it is not true purely because of landscape height, and unchanged in portrait. (Later dropped: its consumers never render in landscape, and a short screen needs the compact carousel in either orientation, so `isSmallScreen()` stays height-only, unchanged from master; LTM-009 was removed from the spec.)
    - Red: `isSmallScreen [LTM-009] does not return true purely because of landscape height` — expected `false` at height 390 landscape, got `true` (height-only check).
- [x] 10.4 Add a marker comment at the `width: 100vw` barrier rules in `smart-chart.scss` noting they are emitted only for Reset Call/Put and are a landmine for the day landscape expands beyond accumulators (no behavioural change).

## 11. Documentation (in-scope)

- [x] 11.1 Update `CLAUDE.md`: add Gotchas for the landscape mode — the two session-only ui-store flags and why they are not `is_chart_maximized`; the `purchase-button.tsx:137` `isMobile` non-swap; the `getErrorSnackbarBottomOffset` `is_landscape` branch; the `PHONE_LANDSCAPE_MEDIA_QUERY`/`isPhoneLandscape` predicate and the `phone-landscape` SCSS mixin kept in lockstep; and the `onMount`/`onUnmount` hoist into `trade.tsx`. Add the new key file locations under Reference.
- [x] 11.2 Confirm the deferral files exist under `docs/spec-to-pr/deferrals/` (growth-rate control, installed-PWA orientation, crypto stake stepping, `AccumulatorsInformation` placement). All four present with What/Why/Follow-up sections.

## 12. Final gate

- [ ] 12.1 Run `npm run test:jest -- packages/trader`, then `npm run test` (stylelint + eslint + jest) and `npm run check-imports`; confirm all green, with `Stake`, `TakeProfit`, `PurchaseButton`, `Duration` and `trade-store` suites still passing.
    - Deferred to the automated verify stage (this run is implementation-only; the full-suite gate is not run as a closing gate). Scoped verification done during implementation: targeted ESLint across every touched trader/core/shared file = **0 errors**; targeted Jest across all new/affected specs = green (incl. `Stake` 86, `PurchaseButton`, `RiskManagement`, `trade-chart`, the three `Containers/Trade` suites); Stylelint clean on all changed SCSS.
- [x] 12.2 Run `npx -y @fission-ai/openspec@1.7.0 validate landscape-view-implementation --strict` and confirm it passes.
    - `Change 'landscape-view-implementation' is valid`.
