## Purpose

Defines when and how the DTrader AppV2 trade page enters an immersive landscape surface for Accumulators — the orientation predicate, the suppression of the rotate-to-portrait blocker on the trade page, the three-way page branch whose lifecycle survives rotation, the landscape layout composition, the trade-type lock, and chart correctness under a phone-landscape viewport.

## ADDED Requirements

### Requirement: [LTM-001] Phone-landscape detection predicate

The system SHALL expose a single phone-landscape predicate shared between CSS and JavaScript so the two cannot drift. The predicate is the media query `(orientation: landscape) and (max-height: 500px) and (min-width: 568px)` combined (in JS) with `isMobileOs()` returning true.

- `@deriv/shared` SHALL export `PHONE_LANDSCAPE_MEDIA_QUERY` (the media-query string) and `isPhoneLandscape()` (the query match AND `isMobileOs()`) from `packages/shared/src/utils/os/os_detect.ts`, re-exported from the package barrel, beside `isMobileOs`/`isTabletOs`.
- `packages/shared/src/styles/devices.scss` SHALL add a `@mixin phone-landscape` emitting the byte-identical media query.
- `@deriv/trader` SHALL provide `AppV2/Hooks/useIsPhoneLandscape.ts` using `matchMedia` with a `change` listener and an `addListener` fallback (for iOS Safari < 14), re-reading on subscribe to close the mount race, and guarded by `typeof window` for jsdom.

The predicate SHALL NOT use `useDevice().isMobileOrTabletLandscape` (matches an iPad in landscape and any sub-1280px desktop window) or `screen.orientation` (unavailable on iOS Safari before 16.4 and reports device rather than viewport orientation). `max-height: 500px` sits in the empty band between the tallest phone in landscape (~450px) and the shortest tablet in landscape (600px); `min-width: 568px` rejects the Chrome-Android soft-keyboard false positive on a portrait viewport.

#### Scenario: Predicate true only for a phone-sized landscape viewport on a mobile OS

- **WHEN** `isMobileOs()` is true and the viewport matches `(orientation: landscape) and (max-height: 500px) and (min-width: 568px)`
- **THEN** `isPhoneLandscape()` returns true and `useIsPhoneLandscape()` reports true

#### Scenario: Predicate false when not on a mobile OS

- **WHEN** the same viewport query matches but `isMobileOs()` is false (a small desktop window)
- **THEN** `isPhoneLandscape()` returns false

#### Scenario: Soft-keyboard portrait viewport is rejected

- **WHEN** an Android portrait viewport is shrunk by the soft keyboard to a short height but its width stays below 568px
- **THEN** `isPhoneLandscape()` returns false because `min-width: 568px` fails

#### Scenario: Hook re-renders on orientation change and cleans up

- **WHEN** the media query result flips while `useIsPhoneLandscape()` is mounted
- **THEN** the consuming component re-renders, and on unmount the `change`/`addListener` listener is removed

### Requirement: [LTM-002] Landscape trade mode is gated on Accumulators and enabled from portrait

`ui.is_landscape_trade_enabled` SHALL be driven by `is_accumulator` alone — **not** by orientation — and SHALL be set from `trade.tsx` while the app is still in portrait, so that rotating to landscape never flashes the blocker. It is a session-only observable (see [LTM-010]).

#### Scenario: Flag tracks accumulator selection

- **WHEN** the active trade type is Accumulators on the trade page
- **THEN** `is_landscape_trade_enabled` is true regardless of current orientation

#### Scenario: Flag clears for non-accumulator types

- **WHEN** the active trade type is not Accumulators, or the trade page unmounts
- **THEN** `is_landscape_trade_enabled` is false

### Requirement: [LTM-003] The rotate-to-portrait blocker is suppressed only for the trade page in landscape trade mode

`packages/core/src/App/Components/Elements/LandscapeBlocker/landscape-blocker.tsx` SHALL add one early return **before** the existing conditional: `if (is_landscape_trade_enabled && pathname === routes.index) return null;`. All other routes retain today's behaviour byte-for-byte.

#### Scenario: Blocker hidden on the trade page for accumulators in landscape

- **WHEN** `is_landscape_trade_enabled` is true and `pathname === routes.index`
- **THEN** `LandscapeBlocker` renders nothing

#### Scenario: Blocker still shows on reports and contract details

- **WHEN** the device is in phone landscape and `pathname` is `/reports` or `/contract/123`
- **THEN** `LandscapeBlocker` still renders the rotate-to-portrait overlay, unchanged from today

#### Scenario: Blocker still shows on the trade page for non-accumulator types

- **WHEN** `pathname === routes.index` but `is_landscape_trade_enabled` is false (a non-accumulator type)
- **THEN** the blocker behaves exactly as it does today

### Requirement: [LTM-004] The trade page branches three ways

`packages/trader/src/AppV2/Containers/Trade/trade.tsx` SHALL select its child as `is_phone_landscape && is_accumulator ? <TradeLandscape/> : isMobile ? <TradeMobile/> : <TradeDesktop/>`, where `is_phone_landscape` comes from `useIsPhoneLandscape()`.

#### Scenario: Landscape accumulator renders the landscape page

- **WHEN** `useIsPhoneLandscape()` is true and the trade type is Accumulators
- **THEN** `<TradeLandscape/>` renders (not `<TradeMobile/>` or `<TradeDesktop/>`)

#### Scenario: Phone landscape but a non-accumulator type does not render landscape

- **WHEN** `useIsPhoneLandscape()` is true but the trade type is not Accumulators
- **THEN** the branch falls through to `isMobile ? <TradeMobile/> : <TradeDesktop/>` and the blocker safety net applies

#### Scenario: Portrait is unaffected

- **WHEN** `useIsPhoneLandscape()` is false
- **THEN** the branch is exactly today's `isMobile ? <TradeMobile/> : <TradeDesktop/>`

### Requirement: [LTM-005] Trade lifecycle survives rotation

The `onMount`/`onUnmount` effect currently duplicated in `trade-mobile.tsx` and `trade-desktop.tsx` SHALL be hoisted into `trade.tsx` — the component that survives a rotation — so that swapping the rendered child on rotate does not fire `onUnmount()` then `onMount()` and re-subscribe proposals mid-flight.

#### Scenario: A rotate does not remount trade data subscriptions

- **WHEN** the device rotates and the rendered child swaps between `TradeLandscape`, `TradeMobile` or `TradeDesktop`
- **THEN** `onMount`/`onUnmount` run only on the mount/unmount of `trade.tsx` itself, not on the child swap, so proposal subscriptions stay alive across the rotate

### Requirement: [LTM-006] Landscape layout composition

`trade-landscape.tsx` SHALL compose a full-height (`100dvh`, with a `100vh` fallback declared first) flex column of: a collapsible header (`MarketTabs` + `AccountHeader`), an always-visible `AccumulatorStats` strip, and a chart region (`flex: 1; min-height: 0; position: relative`) containing the chart at `height: 100%` and the floating landscape params slot positioned bottom-right. Chart height SHALL be sized by CSS flex only, never by `getChartHeight()`.

The layout SHALL deliberately omit `CompactHeader`, `ChartMaximizeButton`, `ChartProfitLoss`, `TradeParametersContainer` and `OnboardingGuide`. `AccountHeader` and `AccumulatorStats` SHALL be reused without TSX change; `accumulator-stats.scss` SHALL add a `@include phone-landscape` block resetting its desktop `position: absolute` offsets back to static flow. The nav rail (`app-shell.tsx`) SHALL stay mounted and be collapsed by a `app-shell--chrome-hidden` class under `@include phone-landscape`, not unmounted.

#### Scenario: Landscape page renders the intended pieces

- **WHEN** `<TradeLandscape/>` mounts
- **THEN** it renders `MarketTabs`, `AccountHeader`, `AccumulatorStats`, the chart, and the landscape params slot

#### Scenario: Landscape page omits portrait-only chrome

- **WHEN** `<TradeLandscape/>` mounts
- **THEN** it does not render `OnboardingGuide`, `CompactHeader` or `TradeParametersContainer`

#### Scenario: Chart is sized without the JS height helper

- **WHEN** `<TradeLandscape/>` renders the chart
- **THEN** `getChartHeight()` is never called and the chart fills its flex parent

### Requirement: [LTM-007] Chart is configured for touch modality and accumulator geometry in landscape

`packages/trader/src/AppV2/Containers/Chart/trade-chart.tsx` SHALL use a new `AppV2/Hooks/useIsPhoneViewport.ts` (`isMobile || useIsPhoneLandscape()`) for every prop about touch modality and accumulator geometry, so those props are correct in landscape where `isMobile` is false: `isMobile → true`, `settings.minimumLeftBars → 3`, `isVerticalScrollEnabled → false`, `enabledNavigationWidget → false`, `drawingToolFloatingMenuPosition → mobile position`, `yAxisMargin.top → 76`, `leftMargin → 80`, and a bounded `maxTick` (kept at the phone value `8`, never `undefined`). Any open sidebar flyout SHALL be closed on entering landscape.

#### Scenario: Chart receives touch-mode props in landscape

- **WHEN** the chart renders inside `<TradeLandscape/>` (where `useDevice().isMobile` is false)
- **THEN** `useIsPhoneViewport()` is true, and the chart is given the touch-modality/accumulator-geometry values above rather than the desktop values

#### Scenario: maxTick stays bounded

- **WHEN** the landscape chart is configured
- **THEN** `maxTick` is a defined value (8), never `undefined`

### Requirement: [LTM-008] Trade-type selector is locked in landscape while symbol switching is preserved

In landscape, `MarketTabs` SHALL disable the trade-type selector so the user cannot leave Accumulators, while leaving symbol switching available. The blocker is retained as a safety net for any path that still lands a non-accumulator type on screen (a restored tab, a deep link).

#### Scenario: Trade type cannot be changed in landscape

- **WHEN** the user is on the landscape trade surface and interacts with the trade-type selector
- **THEN** the selector is disabled and the trade type remains Accumulators

#### Scenario: Symbol switching still works in landscape

- **WHEN** the user switches symbol from the market tabs in landscape
- **THEN** the symbol change proceeds normally

### Requirement: [LTM-010] Landscape UI-store flags are session-only

`ui.is_landscape_trade_enabled` and `ui.is_landscape_chrome_hidden` SHALL be added to `packages/core/src/Stores/ui-store.js` as observables with actions beside `is_chart_maximized`, and mirrored in `packages/stores/types.ts` and `packages/stores/src/mockStore.ts`. Neither SHALL be added to `local_storage_properties` — they do not persist across sessions.

#### Scenario: Flags exist on the store and its types/mocks

- **WHEN** a consumer reads `ui.is_landscape_trade_enabled` or `ui.is_landscape_chrome_hidden`
- **THEN** the observable exists on the real store, in `TCoreStores`, and on `mockStore`

#### Scenario: Flags are not persisted

- **WHEN** the flags change and the session ends
- **THEN** neither flag is written to `local_storage_properties` and both start at their default `false` next session
