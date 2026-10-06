## Purpose

Defines the immersive auto-hide behaviour of the landscape trade surface: the nav rail, header row and pill collapse after four seconds so the chart grows, a single tap anywhere restores them, editing pauses the timer, and cleanup guarantees chrome can never be left stuck hidden on another page.

## ADDED Requirements

### Requirement: [LAH-001] Chrome auto-hides after four seconds

A new `AppV2/Hooks/useAutoHideChrome.ts`, called from `trade-landscape.tsx`, SHALL arm a single 4-second `setTimeout` (armed on mount and after each reset) that sets `ui.is_landscape_chrome_hidden` to true. The flag has three consumers: the nav rail, the header row, and the pill's collapsed state. The flip SHALL be animated by arming a local `--landscape-animating` class for `CHART_MAXIMIZE_ANIMATION_MS` (300ms, reusing the existing constant) to neutralise SmartCharts' own `.chartContainer { transition: height .4s }`, transitioning `max-height`/`opacity`.

#### Scenario: Chrome hides at 4 seconds

- **WHEN** the landscape surface has been mounted (or last reset) for 4000ms with no qualifying pointer event
- **THEN** `is_landscape_chrome_hidden` becomes true, the nav rail and header collapse, the pill collapses to Stake + Buy, and the chart grows

### Requirement: [LAH-002] A single tap anywhere restores chrome and passes through to its target

Restore SHALL be wired as `document.addEventListener('pointerdown', reset, { capture: true, passive: true })`. Because the listener runs in the capture phase and never calls `preventDefault()` or `stopPropagation()`, the event still reaches its real target: a tap on Buy both buys and restores in one tap, and a chart pan restarts the timer while still panning. The MobX un-hide action SHALL fire **only** when currently hidden, so a tap while chrome is already visible does not re-render every observer. No transparent backdrop SHALL be added (it would kill chart interaction).

#### Scenario: Tap restores and still reaches the underlying control

- **WHEN** chrome is hidden and a `pointerdown` occurs anywhere
- **THEN** `is_landscape_chrome_hidden` becomes false, the timer restarts, and the event still reaches its target handler with `defaultPrevented === false`

#### Scenario: Tap while already visible does not thrash observers

- **WHEN** chrome is visible and a `pointerdown` occurs
- **THEN** the un-hide action is not dispatched (no redundant re-render), and the timer restarts

### Requirement: [LAH-003] The timer is paused while a parameter editor or overlay is open

The hook SHALL accept an `is_paused` input supplied by `<LandscapeTradeParams onOverlayOpenChange={…} />` (a prop, not a third global). While paused, the timer SHALL NOT hide chrome, so the pill cannot collapse mid-edit. This also covers the virtual keyboard, which only appears with an editor open.

#### Scenario: Editing prevents auto-hide

- **WHEN** a parameter editor is open (pause is active) and more than 4 seconds pass
- **THEN** `is_landscape_chrome_hidden` stays false and nothing collapses

#### Scenario: Timer resumes after the editor closes

- **WHEN** the editor closes and pause is released
- **THEN** the 4-second timer is armed again from that moment

### Requirement: [LAH-004] Cleanup can never leave chrome stuck hidden

On unmount the hook SHALL clear the timer, remove the `pointerdown` listener, **and** reset `is_landscape_chrome_hidden` to false — mirroring how `trade-mobile.tsx` resets `is_chart_maximized`. This covers rotate-back, navigation away, and leaving Accumulators, so the nav rail can never be left hidden on another page.

#### Scenario: Unmount resets the hidden flag and listeners

- **WHEN** `trade-landscape.tsx` unmounts (rotate back, navigate away, or trade type changes off Accumulators)
- **THEN** the timer is cleared, the `pointerdown` listener is removed, and `is_landscape_chrome_hidden` is false
