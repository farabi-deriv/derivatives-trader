## Context

See `proposal.md` — Why, and the two normative plan docs (`docs/landscape-mode-accumulators-plan.md` + `docs/landscape-mode-accumulators-plan-condensed.md`), which are authoritative and must be read together. Key current-state facts that shape the approach, verified at HEAD:

- `useDevice().isMobile` is a **width query** (`max-width: 600px`), so a phone rotated to landscape (~844×390) already reports `isMobile: false`/`isTablet: true`: `trade.tsx:30` already renders `<TradeDesktop/>`, `app-shell.tsx:29` already renders the nav rail (`{!isMobile && <Sidebar/>}`), and `AppContent.tsx` already drops `<Header/>`/`<BottomNav/>`. The landscape _chrome_ is largely what renders today.
- `landscape-blocker.tsx:20-26` renders a full-screen `z-index: 9999` rotate-to-portrait overlay whenever `!isMobile && isMobileOs() && (path is /, /reports or /contract)`, overriding the trade page's own `DISABLE_LANDSCAPE_BLOCKER_ROUTES` opt-out. Nothing ships until this gate opens.
- Core cannot read `is_accumulator` (`packages/core/src/Stores/Modules/index.js` only defines `attachModule`/`detachModule`, never called), but the trader `RootStore` does `this.ui = core_store.ui` (the identical object) — the one available bridge, and the precedent `is_chart_maximized` already uses.
- `ui.is_chart_maximized` + `CHART_MAXIMIZE_ANIMATION_MS = 300` (`layout-utils.tsx:29`) is the closest existing analogue; there is no auto-hide/idle timer anywhere in the repo.
- `getChartHeight()` (`layout-utils.tsx:46`) computes an inline pixel height from `window.innerHeight` at render time with **no resize/orientationchange listener** — unusable when orientation change is the defining event. Desktop uses `height: 100%`.
- quill's `WheelPicker` hardcodes 48px rows, is unvirtualised, and re-centres to a stale index on any resize — but the confirmed interaction (scroll on the field, panel is a passive readout) means no scrolling wheel widget is built at all.
- `chart-profit-loss.scss` is the one existing floating blurred pill precedent; three `backdrop-filter` sites exist repo-wide.

## Goals / Non-Goals

**Goals:**

- One predicate shared by CSS and JS so they cannot drift; entry gated on Accumulators, enabled from portrait so a rotate never flashes the blocker.
- A rotation-surviving lifecycle so an in-flight purchase and proposal subscriptions survive a rotate.
- Reuse everything reusable verbatim (`AccountHeader`, `AccumulatorStats`, `PurchaseButton`, `MarketTabs`) — CSS-only fitting where possible.
- A value picker that is a nudge tool, built from a pure-function ladder and a passive three-row panel — no scroll container, no virtualisation, no float drift.
- The insufficient-balance contract honoured by construction (Buy never client-disabled; stake never capped; no client-side balance check in landscape).

**Non-Goals (design-level boundaries beyond the proposal's scope):**

- No new colour token; `scripts/generate-colors.js` untouched.
- No reuse of `is_chart_maximized` for the landscape flags (its five CSS consumers are portrait chrome; six other components read it for snackbar offsets and would mis-position; `trade-mobile.tsx` resets it on unmount and would race).
- Full-range traversal of the stake ladder via drag is a non-goal (uniform `0.10` step makes the wheel a nudge tool; distant values are reached by rotating to portrait). Velocity acceleration mitigates but does not remove this.
- No change to `useTabletLandscape()` (unreachable by a phone) or the `smart-chart.scss` `100vw` barrier rules (Reset Call/Put only) beyond a marker comment.

## Decisions

**D1 — The predicate: `(orientation: landscape) and (max-height: 500px) and (min-width: 568px)` AND `isMobileOs()`.** `max-height: 500px` sits in the empty band between the tallest phone landscape (~450px) and the shortest tablet landscape (600px). `min-width: 568px` rejects the Chrome-Android soft-keyboard false positive (a portrait 390×844 shrunk to 390×350). Rejected `isMobileOrTabletLandscape` (matches iPad + sub-1280px desktop) and `screen.orientation` (iOS < 16.4, reports device not viewport). A `@mixin phone-landscape` emits the byte-identical query so SCSS and JS stay in lockstep. The hook uses `matchMedia` + `change` with an `addListener` fallback (the dual path `@deriv-com/ui` itself uses), re-reads on subscribe to close the mount race, and is `typeof window`-guarded for jsdom.

**D2 — A new flag, not `is_chart_maximized`.** Two session-only observables (`is_landscape_trade_enabled`, `is_landscape_chrome_hidden`) beside `is_chart_maximized`, never persisted. Rationale in Non-Goals D above. `is_landscape_trade_enabled` is driven by `is_accumulator` alone (not orientation) and set from `trade.tsx` in portrait so the blocker never flashes on rotate.

**D3 — Hoist `onMount`/`onUnmount` into `trade.tsx` (highest-risk change).** Both `trade-mobile.tsx` and `trade-desktop.tsx` run their own `useEffect(() => { onMount(); return onUnmount; })`. A rotate swaps the branch, so React tears one down and mounts the other, firing `onUnmount()` then `onMount()` and re-subscribing proposals mid-flight. Lifting that one effect into `trade.tsx` (which survives rotation) is the difference between a purchase-in-flight surviving a rotate and not. Deserves its own review pass; run the full trader suite after.

**D4 — Size with CSS flex/`100dvh`, never `getChartHeight()`.** `height: 100dvh` with a `100vh` fallback declared first also handles the iOS Safari landscape toolbar that `100vh` overstates. Core guard: one `@include phone-landscape` block in `app-layouts.scss` (`.app-contents { height: 100dvh }`, since L67 hardcodes `100vh`) plus pinning the `ThemedScrollbars` overflow that `!isMobile` introduces.

**D5 — Auto-hide via one timer + one flag + a capture-phase passive listener.** `document.addEventListener('pointerdown', reset, { capture: true, passive: true })` runs before Flutter's glass-pane handler; never calling `preventDefault`/`stopPropagation` means the event still reaches its target, so a tap on Buy both buys and restores. Guard the un-hide action to fire only when hidden (else every tap re-renders every observer). Pause via an `is_paused` prop from `<LandscapeTradeParams onOverlayOpenChange>` (not a third global) — works despite the wheel portalling and covers the virtual keyboard. Cleanup resets the flag so the rail can never be stuck hidden on another page. Arm a local `--landscape-animating` class for `CHART_MAXIMIZE_ANIMATION_MS` on each flip to neutralise SmartCharts' `.chartContainer { transition: height .4s }` — the identical fix `trade.scss` already applies for maximize.

**D6 — The value picker is a pure-function ladder + a passive three-row panel, not a wheel.** The confirmed interaction (gesture on the field, panel is a passive magnified readout) removes the retargeting problem entirely — a browser locks a touch gesture's scroll target at `touchstart`, but here nothing needs retargeting because the panel never scrolls. Uniform `0.10` step for both params matches the mockups (`$9.90/$10.00/$10.10`) and makes the ladder a pure function over integer tenths — no array, no `Map`, no memoisation concern, no float drift. Per-param logic lives in adapter **hooks** (not sibling components) because the pill must render every chip simultaneously and enforce one-open-at-a-time — impossible with today's self-owning portrait pattern. Commit only on settle (120ms debounce or `pointerup`), idempotent via `last_committed_ref`, and never on open (a fractional `10.55` survives until a drag settles). Drop `useProposal` from the landscape editors — landscape commits, so the streaming proposal already validates; a second request per settle doubles wire traffic for nothing.

**D7 — Balance contract by construction.** The client-provable balance gate is forbidden: no cap, Buy never disabled. Landscape runs **no client-side balance check** — no hint, no suppressed commit — so an unaffordable stake commits and Buy's server-reported `ServiceErrorSheet` reports the shortfall. (An earlier suppressed-commit analogue to portrait's disabled Save was dropped: it refused a value with only a hint to explain it.) Enforced structurally: no landscape param file reads balance or the hint; the chip takes no error prop; `PurchaseButton` is unmodified. The portrait editors' hint is extracted once into `useStakeBalanceHint`. Rejected clamping the ladder max to the balance (a client cap the contract forbids, and it silently removes values).

**D8 — `PurchaseButton` reused verbatim; do NOT swap its `isMobile`.** Every state it handles is internal/store-driven. Its `has_no_button_content` at `purchase-button.tsx:136-137` is true for a fresh accumulator when `isMobile` is false — which in landscape gives the spec's label-only `showDetails=false` for free. Swapping `isMobile → useIsPhoneViewport()` there (as Workstream 5 does in `trade-chart.tsx` for touch reasons) would flip it false, restore the payout caption, and break the 120×56 spec. A comment marks the non-swap; a test asserts the caption is absent in landscape. Fit with CSS only (wrapper + skeleton width to 120px).

**D9 — Panel is a sibling of the pill.** Geometry is exactly self-consistent: pill 318×90 collapsed (`1+16+148+16+120+16+1 = 318` box; height `1+16+56+16+1 = 90`), the 16px vertical padding is exactly where the mockups' dimmed neighbour rows live, so the pill needs `overflow: hidden` to clip them against its 999px radius — which forces the panel above it to be a sibling under a shared `position: relative` wrapper, or it would be clipped out of existence. Expanded pill width is derived (`1+16+148+16+148+16+120+16+1 = 482px`). Panel is `198×136`, `padding 16`, `gap 8`, `radius 16`, `blur(4px)`, four inset shadows in one `box-shadow` declaration (four separate declarations would override each other).

**D10 — Colours map to existing tokens.** The Figma token names don't exist in this repo and each hex is the light-theme half of a pair, so pasting hex would leave glaring-white chips over a dark chart. The panel bg is already what `chart-profit-loss.scss` uses; the chip bg is already what `trade-parameters.scss` uses for the portrait params surface. An `@supports not (backdrop-filter)` opaque fallback is mandatory for both surfaces (the pill has no background at all).

## Risks / Trade-offs

- **[Chart remounts on every rotate]** → already today's behaviour (a rotate currently swaps `TradeMobile → TradeDesktop`); the `onMount` hoist keeps data subscriptions alive so only the canvas reloads, and SmartCharts restores drawings via `importedLayout`/`onExportLayout`.
- **[`backdrop-filter` recompositing a live Flutter canvas every frame on low-end Android]** → `@supports` fallback ready; this is the trigger for switching to an opaque panel (a QA measurement on real hardware, not an agent task).
- **[Drag pans the chart / scrolls the page instead of stepping]** → `touch-action: none` on the chip + pointer capture; `touch-action: manipulation` on the rest of the pill.
- **[Drag conflicts with the shell's capture-phase `pointerdown`]** → that listener only restores chrome and never calls `preventDefault`/`stopPropagation`, so the chip still gets the full gesture (asserted by a test).
- **[Store clamps a committed value ⇒ panel out of sync]** → after settle, compare store vs last emitted; if they differ, re-derive the index from the store value (a plain state write, no scroll position to correct).
- **[Open accumulator contract while a param is active — TP cannot be adjusted mid-contract]** → an effect clears `active_param` and fires `onOverlayOpenChange(false)` when the param becomes disabled.
- **[Panel nested inside the pill is clipped away]** → panel is a sibling under a shared wrapper; a structural test asserts it.
- **[A future `is_phone_viewport` swap in `purchase-button.tsx` silently restores the payout caption]** → comment at `purchase-button.tsx:137` plus a test asserting the caption is absent in landscape.
- **[`Close $X` overflows the fixed 120px Buy width]** → open question (see below); default is to widen the pill in the open-contract state.
- **[Param sheet / market selector open at rotate]** → the branch swap unmounts them; a defensive `body` overflow reset in the landscape mount effect covers quill's portal setting overflow.
- **[Notch / safe area]** → `index.html` has no `viewport-fit=cover`, so iOS already insets the layout viewport in landscape and safe margins come free; do **not** add `cover` (zero `env()` usage repo-wide, it would push content under the notch app-wide).
- **[jsdom's global `matchMedia` stub returns `{ matches: false }`]** → no existing spec can observe a media-query change, so a query-aware `matchMedia` test helper is needed that keys on the query string, tracks `change` listeners, and can fire them inside `act()`.

## Migration Plan

Steps 1–3 are independently shippable and reversible; step 4 is the highest-risk change and is the only one touching shared code paths. Build order (mirrors the condensed plan §6): (1) shared primitives; (2) ui-store flags + `types.ts`/`mockStore.ts` + `useIsPhoneLandscape`; (3) unblock the blocker (landscape then shows `TradeDesktop`, verifying the gate in isolation); (4) `trade.tsx` three-way branch + the `onMount`/`onUnmount` hoist; (5) shell chrome; (6) `trade-landscape.tsx` with a stubbed params slot; (7) `useAutoHideChrome` + animating class; (8) `landscape-wheel-utils` + `use-param-drag` + `landscape-value-rows` standalone with unit tests before wiring; (9) pill, chips, adapters, `useStakeBalanceHint`, snackbar offset; (10) trade-type lock + `useIsPhoneViewport` chart swap + `isSmallScreen` hardening. Rollback: the feature is inert until step 3, and each step is a self-contained revert.

## Open Questions

Answered inline in `tasks.md` (## Open Questions) with recommended defaults so the plan is implementable as-is; the genuinely external/out-of-scope items (chart-team growth-rate control, native-webview orientation lock, crypto stake stepping, `AccumulatorsInformation` placement) are recorded as deferrals under `docs/spec-to-pr/deferrals/`.
