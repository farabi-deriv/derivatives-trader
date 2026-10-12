## Why

On a real phone rotated to landscape the DTrader AppV2 trade page today shows a full-screen **"Please rotate your device to portrait view."** blocker, because `useDevice()` is width-only (`isMobile = max-width: 600px`) and `landscape-blocker.tsx` overrides the trade page's own opt-out for any `isMobileOs()` device that is not `isMobile`. Design (Figma — Landscape) asks instead for an immersive landscape quick-trade surface for **Accumulators**: an auto-hiding chrome, the chart growing to fill the viewport, and a floating frosted-glass pill carrying Stake, Take profit and Buy, where each parameter is adjusted by a drag gesture on the chip with a passive magnified readout. This change delivers that surface for Accumulators only, per the two normative plan docs (`docs/landscape-mode-accumulators-plan.md` and `docs/landscape-mode-accumulators-plan-condensed.md`), which must be read together.

## What Changes

- **Orientation primitives.** Add a phone-landscape predicate — `PHONE_LANDSCAPE_MEDIA_QUERY` + `isPhoneLandscape()` in `@deriv/shared`'s `os_detect.ts` and a matching `@mixin phone-landscape` in `devices.scss` (identical query, so SCSS and JS cannot drift) — plus a `useIsPhoneLandscape` hook and a `useIsPhoneViewport` (`isMobile || useIsPhoneLandscape()`) hook in `@deriv/trader`. Query: `(orientation: landscape) and (max-height: 500px) and (min-width: 568px)` **AND** `isMobileOs()`.
- **UI-store flags.** Add two **session-only** observables + actions beside `is_chart_maximized`: `is_landscape_trade_enabled` and `is_landscape_chrome_hidden`. Mirror both in `packages/stores/types.ts` and `mockStore.ts`. Neither is added to `local_storage_properties`.
- **Unblock landscape on the trade page for accumulators.** Add one early return to `landscape-blocker.tsx`: `if (is_landscape_trade_enabled && pathname === routes.index) return null;`. `/reports` and `/contract/:id` keep today's blocker behaviour byte-for-byte.
- **Three-way trade page branch + lifecycle hoist.** `trade.tsx` becomes `is_phone_landscape && is_accumulator ? <TradeLandscape/> : isMobile ? <TradeMobile/> : <TradeDesktop/>`, and the `onMount`/`onUnmount` effect is **hoisted out of `trade-mobile.tsx`/`trade-desktop.tsx` into `trade.tsx`** so a rotate does not tear down proposal subscriptions. Sets/clears `is_landscape_trade_enabled` from `is_accumulator`.
- **New landscape layout.** New `trade-landscape.tsx` + SCSS composing `MarketTabs`, `AccountHeader`, `AccumulatorStats`, the chart and the floating params slot — sized with CSS flex/`100dvh`, never `getChartHeight()`. Shell chrome (nav rail, header, `app-layouts.scss`) gets `@include phone-landscape` blocks; `accumulator-stats.scss` gets one block to reset its desktop absolute positioning to static flow.
- **Auto-hide chrome.** New `useAutoHideChrome` hook: 4s timer hides nav rail + header + collapses the pill to `Stake + Buy`; a capture-phase, passive `pointerdown` restores everything and restarts the timer (so a tap on Buy both buys and restores); the timer is paused while an editor is open; unmount clears the timer, removes the listener and resets the hidden flag.
- **Floating pill + custom value picker.** New `AppV2/Components/TradeParameters/Landscape/` directory: an `observer` pill owning `active_param`, mini-wheel chips, a passive frosted-glass panel (a **sibling** of the pill so `overflow: hidden` clipping works), a pointer-drag hook that turns vertical travel into a ladder index, and per-param adapter hooks for stake and take profit. The ladder is a **pure function over integer tenths** (uniform `0.10` step, no materialised array, no float drift). `PurchaseButton` is reused verbatim.
- **Balance contract, honoured.** Landscape runs no client-side balance check: the panel shows no balance hint and an unaffordable stake commits like any other; Buy stays pressable and surfaces the server-reported `ServiceErrorSheet`; the chip carries no error class; the stake is never capped. The portrait editors keep their hint via a shared `useStakeBalanceHint` hook extracted from `stake-input.tsx`. `getErrorSnackbarBottomOffset` gains an `is_landscape` branch (offset kept inside the helper).
- **Trade-type lock + chart correctness.** Lock the trade-type selector in `MarketTabs` in landscape (symbol switching preserved); swap `isMobile` for `useIsPhoneViewport()` on the eight touch-modality/accumulator-geometry props in `trade-chart.tsx` (but **not** in `purchase-button.tsx`, where `isMobile === false` is load-bearing for `showDetails=false`); harden `isSmallScreen()` with an `(orientation: portrait)` term.
- **Docs.** Update `CLAUDE.md` with the new landscape gotchas (the ui-store flags, the `purchase-button.tsx` non-swap, the landscape snackbar offset branch, the orientation predicate) so the invariants survive.

## Capabilities

### New Capabilities

- `landscape-trade-mode`: When the app enters the immersive landscape trade surface (orientation + accumulator predicate), how the blocker is suppressed only for the trade page, the three-way page branch with a rotation-surviving lifecycle, the landscape layout composition, the trade-type lock, and chart correctness under a phone-landscape viewport.
- `landscape-auto-hide-chrome`: The 4-second auto-hide of nav rail, header and pill, tap-anywhere restore with event pass-through, pause-while-editing, and cleanup that can never leave chrome stuck hidden on another page.
- `landscape-trade-params`: The floating pill and its drag-driven value picker for Accumulator stake and take profit — the pure-function ladder, the three-row passive panel, commit semantics, the take-profit "off" sentinel, the balance contract, the reused Buy button, and the theme-aware design tokens.

### Modified Capabilities

None. Portrait behaviour of the existing stake/take-profit editors, the purchase button, and the snackbar offset is preserved unchanged — the shared `useStakeBalanceHint` extraction (portrait editors only) and the `is_landscape` snackbar branch leave existing requirements unaltered.

## Impact

**Packages touched:** `@deriv/trader` (primary), `@deriv/shared` (`os_detect.ts`, `devices.scss`, barrel), `@deriv/core` (`landscape-blocker.tsx`, `ui-store.js`, `app-layouts.scss`), `@deriv/stores` (`types.ts`, `mockStore.ts`).

**Public API:** `@deriv/shared` gains `PHONE_LANDSCAPE_MEDIA_QUERY` and `isPhoneLandscape`; `TCoreStores`/`ui` gains `is_landscape_trade_enabled` and `is_landscape_chrome_hidden`; `getErrorSnackbarBottomOffset` gains an `is_landscape` argument.

**Scope boundaries:** Accumulators only. Not shipped in this change (see `docs/spec-to-pr/deferrals/`): the chart-team-owned growth-rate control, installed-PWA landscape (`manifest.json` stays `portrait`), crypto-denominated stake stepping (fiat-only assumption), and the placement of the desktop-only `AccumulatorsInformation` readouts in landscape.

**Not changed:** `useTabletLandscape()` (fires only on `isTabletPortrait && isTabletOs`, unreachable by a phone) is untouched; the `width: 100vw` barrier rules in `smart-chart.scss` (emitted only for Reset Call/Put, never accumulators) are left with a marker comment; `manifest.json` orientation stays `portrait`; no new colour token and `scripts/generate-colors.js` is untouched.
