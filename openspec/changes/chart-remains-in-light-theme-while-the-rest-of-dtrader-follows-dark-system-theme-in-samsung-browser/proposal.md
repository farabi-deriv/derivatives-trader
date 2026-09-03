## Why

On an Android device with the system theme set to Dark, DTrader opened in Samsung Internet Browser renders most of the UI dark while the chart stays light (issue #1177). The app cannot produce that split on its own: the chart's theme is derived from the _same_ observable as the rest of the UI — `ui.is_dark_mode_on` feeds `settings.theme` in `packages/trader/src/AppV2/Containers/Chart/trade-chart.tsx:126` and `packages/trader/src/Modules/Contract/Containers/replay-chart.tsx:38-50`, the `ThemeProvider` in `packages/core/src/App/AppContent.tsx:68`, and the `theme--light`/`theme--dark` body class in `packages/core/src/Stores/ui-store.js:381-389`. A light chart next to a dark page therefore means the darkening of the page is **not** coming from DTrader.

Two defects combine to produce it:

1. **DTrader never declares `color-scheme`.** A grep for `color-scheme` across `packages/` matches exactly one line — the `prefers-color-scheme` media query in `packages/core/src/Stores/ui-store.js:25`. There is no `<meta name="color-scheme">` in `packages/core/src/index.html` and no `color-scheme` CSS property in the token sheets (`packages/shared/src/styles/tokens/semantic.scss`). A Chromium-based browser with an automatic dark-theme feature (Samsung Internet's "Dark mode", Chrome for Android's "Auto dark theme") reads that as "this site is light-only" and algorithmically force-darkens the page. Force-darkening rewrites CSS/DOM-painted colours; it does not touch pixels painted into a `<canvas>`. SmartCharts is a Flutter Web build rendered through canvaskit/skwasm into a canvas (see the renderer preload block in `packages/core/src/index.html`), so the chart is exempt — dark page, light chart.

2. **DTrader does not actually follow the system theme.** `ui-store.js:25` samples `prefers-color-scheme` once, at class-field initialisation, and only when `isMobile()` is true (`window.innerWidth <= 600`, `packages/shared/src/utils/screen/responsive.ts:22`). There is no `change` listener on the media query, `is_dark_mode_on` is persisted to `localStorage` (`ui-store.js:191`) so the first sampled value is pinned forever with no way back to "follow the system", and the pre-React boot script in `index.html` resolves the theme from the `theme` URL param and `ui_store.is_dark_mode_on` only — never from `prefers-color-scheme`.

The two must be fixed together. Declaring `color-scheme` on its own switches off the browser's force-dark, which would leave a dark-system user staring at a genuinely all-light DTrader — consistent, but the opposite of the issue's expected result ("display in Dark theme when Dark mode is active").

## What Changes

- **Declare colour-scheme support to the browser.** Add a `color-scheme` declaration that tracks the resolved app theme (on `:root`, plus a `<meta name="color-scheme">` in `packages/core/src/index.html`), so Samsung Internet / Chrome auto-dark stop force-darkening DTrader and the app's own theme becomes the single visible source of truth for chart and page alike.
- **Introduce an explicit theme preference with a `system` default.** A new persisted `theme_preference` (`'system' | 'light' | 'dark'`) sits alongside the existing `is_dark_mode_on`. While the preference is `system`, `is_dark_mode_on` is resolved from `prefers-color-scheme` and re-resolved live via a `matchMedia` `change` listener, so flipping the device theme with DTrader open re-themes the whole app including the chart. Choosing Light or Dark in the theme selector (or passing `?theme=`) records an explicit preference that wins over the system.
- **Drop the `isMobile()` width gate** on system-theme detection, so the same device following the system theme in portrait does not stop following it in landscape (601px+), and desktop follows the OS theme too.
- **Migrate existing users without changing what they see.** A stored `ui_store` that has `is_dark_mode_on` but no `theme_preference` is read as an explicit preference for that value, so an upgrade never flips a returning user's theme.
- **Keep the `<html>` theme state in sync after boot.** `packages/core/src/index.html` sets `<html class="dark|light">` plus inline `--color-surface-primary` / `--color-text-primary` overrides before React loads, and the only code that updates them afterwards is a mount-only effect in `packages/core/src/App/app.jsx:80-92` (`[]` deps). Theme switching at runtime therefore leaves `<html>` stale. Theme application moves into the single `changeTheme()` writer in `ui-store`, which will also maintain `color-scheme` and `<meta name="theme-color">`.
- No breaking API change. `ui.is_dark_mode_on` and `ui.setDarkMode()` keep their current signature and meaning, so every existing consumer (charts, `ThemeProvider`, GTM, the mobile-bridge `trading:config` event, chart markers) is untouched.

## Capabilities

### New Capabilities

- `app-theme`: How DTrader resolves its active light/dark theme (system preference vs. explicit user choice vs. `?theme=` URL param), how that resolution is announced to the browser via `color-scheme` so automatic dark-theme features do not force-darken the page, and the guarantee that every surface — including the canvas-rendered chart — renders in that one resolved theme.

### Modified Capabilities

<!-- None. No existing spec under openspec/specs/ covers app theming; `themed-scrollbars` covers scrollbar styling within a theme, not theme resolution. -->

## Impact

- **Code**
    - `packages/core/src/index.html` — add `<meta name="color-scheme" content="light dark">`; extend the pre-React boot script to resolve `theme` param → `theme_preference` → legacy `is_dark_mode_on` → `prefers-color-scheme`, and to set `color-scheme` alongside the existing `<html>` class and loader colour variables.
    - `packages/core/src/Stores/ui-store.js` — add the persisted `theme_preference` observable and its setter, resolve `is_dark_mode_on` from the system preference while the preference is `system`, register/dispose a `matchMedia('(prefers-color-scheme: dark)')` `change` listener, make `setDarkMode()` record an explicit preference, apply the legacy migration on rehydrate, and extend `changeTheme()` to also write the `<html>` class, `color-scheme`, the inline loader variables and `<meta name="theme-color">`.
    - `packages/core/src/App/app.jsx` — remove the mount-only `<html>` class effect (lines 80-92) now that `changeTheme()` owns it; the existing `?theme=` handling stays and now records an explicit preference.
    - `packages/shared/src/styles/tokens/semantic.scss` — optional `color-scheme` on the `.theme--light` / `.theme--dark` token blocks as a CSS-side backstop for the JS declaration.
- **Consumers (read-only, no change required)** — `packages/trader/src/AppV2/Containers/Chart/trade-chart.tsx`, `packages/trader/src/Modules/Contract/Containers/replay-chart.tsx` (and `AppV2/Containers/Chart/contract-details-chart.tsx` through it), `packages/core/src/App/AppContent.tsx`, `packages/core/src/Stores/gtm-store.js`, `packages/core/src/Stores/contract-store.js`, `packages/core/src/Stores/Helpers/chart-markers.js`, `packages/trader/src/AppV2/Components/Layout/Sidebar/theme-selector.tsx`.
- **Tests** — `packages/core/src/Stores/__tests__/ui-store.spec.ts` (system resolution, live `change`, explicit override, migration, DOM application); `packages/trader/src/AppV2/Containers/Chart/__tests__/trade-chart.spec.tsx` (chart `settings.theme` follows the resolved theme).
- **Storage** — `localStorage.ui_store` gains a `theme_preference` key. Backward compatible: absent means "legacy explicit" when `is_dark_mode_on` is present, and "system" on a first visit.
- **Dependencies** — none added.
- **User-visible risk** — turning off browser force-dark changes DTrader's appearance for every user of Samsung Internet / Chrome auto-dark, not just those hitting this bug. A returning user whose stored preference is Light on a dark-system device goes from force-darkened-and-inconsistent to genuinely light-and-consistent.
- **Verification limit** — Samsung Internet's force-dark behaviour cannot be exercised from this repo's Jest/jsdom suite; the browser-level half of the fix needs manual verification on an Android device (see `tasks.md`).
