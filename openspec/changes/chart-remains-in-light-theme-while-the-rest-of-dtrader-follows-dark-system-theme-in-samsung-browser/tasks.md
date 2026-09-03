## Open Questions

Each has a recommended default, already applied throughout this plan — the plan is implementable as written. A reviewer may replace any answer before implementation starts.

1. **Do existing users (stored `is_dark_mode_on`, no `theme_preference`) migrate to "explicit" or to "system"?**
    - **(A) — RECOMMENDED — Explicit.** Map the stored boolean to `theme_preference: 'light' | 'dark'`. Nobody's theme changes on upgrade. They only gain system-following if they later use the theme selector. The chart/page consistency half of the bug is fixed for them regardless, by the `color-scheme` work.

2. **Does the theme selector gain a visible "System" option?**
    - **(A) — RECOMMENDED — No UI change.** `theme-selector.tsx` keeps its two Light/Dark buttons; `system` stays an internal initial state that any explicit tap leaves permanently. No design signoff needed, ships the fix now.

3. **Is `<meta name="color-scheme" content="light dark">` the right auto-dark opt-out, given the `color-scheme` property may say `light`?**
    - **(A) — RECOMMENDED — Ship both** (static `light dark` meta + resolved value on `:root`) and confirm on-device in task 6.1. Covers the "user explicitly picked Light on a dark-system device" case, which a resolved-only declaration would re-break.

---

## 1. Store: theme preference and system resolution

- [x] 1.1 In `packages/core/src/Stores/ui-store.js`, add a `theme_preference` field (`'system' | 'light' | 'dark'`, default `'system'`), register it as `observable` in the `makeObservable` block (next to `is_dark_mode_on: observable` at ~line 238) and add `'theme_preference'` to `local_storage_properties` (next to `'is_dark_mode_on'` at ~line 191). Verify: a new `ui-store.spec.ts` case asserts the default is `'system'`.
- [x] 1.2 In `packages/core/src/Stores/ui-store.js`, replace the class-field initialiser at line 25 (`window?.matchMedia?.('(prefers-color-scheme: dark)').matches && isMobile()`) with a system-preference read that has **no** `isMobile()` gate, and drop the now-unused `isMobile` import if nothing else in the file uses it. Verify: `ui-store.spec.ts` cases assert dark is resolved from a mocked `matchMedia` at both a narrow (≤600px) and a wide (>600px) `window.innerWidth`.
- [x] 1.3 In `packages/core/src/Stores/ui-store.js`, add a private resolver (e.g. `resolveTheme()`) that sets `is_dark_mode_on` from `theme_preference`: `'system'` → the current `prefers-color-scheme: dark` match, `'dark'` → `true`, `'light'` → `false`. Verify: `ui-store.spec.ts` covers all three preferences against both mocked system values.
- [x] 1.4 In `packages/core/src/Stores/ui-store.js`, register a `matchMedia('(prefers-color-scheme: dark)')` `change` listener in the constructor (beside the existing `window.addEventListener('resize', this.handleResize)`), guarded for absent `matchMedia` and falling back to `addListener` when `addEventListener` is unavailable, that re-runs the resolver. Verify: a `ui-store.spec.ts` case fires a mocked `change` event and asserts `is_dark_mode_on` flips while `theme_preference` is `'system'` and does **not** flip while it is `'light'`.
- [x] 1.5 In `packages/core/src/Stores/ui-store.js`, remove the listener in the store's existing unmount/dispose path so it does not leak across store re-creation. Verify: a `ui-store.spec.ts` case asserts `removeEventListener` (or `removeListener`) is called on dispose.
- [x] 1.6 In `packages/core/src/Stores/ui-store.js`, change `setDarkMode(is_dark_mode_on)` (~line 551) to also set `theme_preference` to `'dark'` / `'light'`, keeping its existing return value and the `gtm.pushDataLayer({ event: 'switch theme' })` call unchanged so `theme-selector.tsx`, `menu.tsx` and the `?theme=` path in `app.jsx` need no edits. Verify: `ui-store.spec.ts` asserts `setDarkMode(true)` sets `theme_preference` to `'dark'` and that a subsequent mocked system `change` to light leaves `is_dark_mode_on` true.
- [x] 1.7 In `packages/core/src/Stores/ui-store.js`, seed `theme_preference` by parsing `localStorage.ui_store` **synchronously** in the class-field initialiser: a valid stored `theme_preference` wins, else a stored `is_dark_mode_on` boolean with no `theme_preference` is read as `is_dark_mode_on ? 'dark' : 'light'`, else `'system'`; `is_dark_mode_on` is then seeded by resolving that preference. It must **not** be deferred until after `BaseStore.retrieveFromStorage()` — that is a MobX `action`, so the local-storage reaction created alongside it writes `theme_preference: 'system'` back before any timer queued behind it can read storage, which discards the stored theme (and flashes the wrong theme on the boot loader). Additionally queue `resolveTheme()` behind the rehydrate timer, so the stale persisted `is_dark_mode_on` that `retrieveFromStorage()` restores cannot outrank a `'system'` preference. Verify: `ui-store.spec.ts` cases seed `localStorage.ui_store` with (a) `{is_dark_mode_on:false}` on a dark-system mock → stays light both before and after rehydrate, (b) `{is_dark_mode_on:true, theme_preference:'system'}` on a light-system mock → resolves light, (c) `{is_dark_mode_on:true, theme_preference:'dark'}` on a light-system mock → stays dark, (d) empty storage on a dark-system mock → resolves dark. Each case must pass when run in isolation (`jest -t`), not only in a whole-file run.

## 2. Apply the resolved theme to the DOM in one place

- [x] 2.1 In `packages/core/src/Stores/ui-store.js`, extend `changeTheme()` (lines 381-389) so that in addition to the `document.body` `theme--dark` / `theme--light` toggle it sets `document.documentElement.classList` to `dark` / `light`, matching what `packages/core/src/index.html` writes at boot. Verify: a `ui-store.spec.ts` case toggles `is_dark_mode_on` and asserts `document.documentElement.classList` follows.
- [x] 2.2 In `changeTheme()`, set `document.documentElement.style.colorScheme` to `'dark'` / `'light'`. Verify: a `ui-store.spec.ts` case asserts the property is `'dark'` in dark mode, `'light'` in light mode, and that it changes on a runtime toggle (spec: "Declaration follows a runtime theme switch").
- [x] 2.3 In `changeTheme()`, keep the two inline loader variables the boot script sets on `documentElement.style` (`--color-surface-primary`, `--color-text-primary`) in step with the resolved theme, so a runtime switch does not leave the boot-time light values behind. Verify: a `ui-store.spec.ts` case asserts both inline properties match the theme after a toggle in each direction.
- [x] 2.4 In `changeTheme()`, update `<meta name="theme-color">` (currently hard-coded to `#414652` in `packages/core/src/index.html`) to the resolved theme's surface colour, creating the element defensively if absent. Verify: a `ui-store.spec.ts` case asserts the meta `content` differs between light and dark and is updated on toggle.
- [x] 2.5 In `packages/core/src/App/app.jsx`, delete the mount-only `<html>` class effect at lines 80-92 (and the now-unused `is_dark_mode` local at line 30 if nothing else reads it), so `changeTheme()` is the sole runtime writer of `<html>` theme state. Verify: `npm run test:jest -- packages/core/src/App` passes and no `documentElement.classList` theme write remains in `app.jsx` (grep).

## 3. Declare colour-scheme support to the browser

- [x] 3.1 In `packages/core/src/index.html`, add `<meta name="color-scheme" content="light dark">` in `<head>` alongside the other meta tags (near `<meta name="theme-color" ...>`), so the declaration is present from the first parsed bytes. Verify: the tag is present in the built `index.html` after `npm run build --workspace=@deriv/core`.
- [x] 3.2 In the inline boot script in `packages/core/src/index.html`, extend the existing resolution (currently `theme` URL param → `ui_store.is_dark_mode_on`) to the full order from `design.md` decision 2: `theme` param → `ui_store.theme_preference` when `'light'` / `'dark'` → legacy `ui_store.is_dark_mode_on` when `theme_preference` is absent → `window.matchMedia('(prefers-color-scheme: dark)').matches`, all inside the existing try-tolerant vanilla-JS style (no optional chaining assumptions beyond what is already there). Verify manually in a browser with `localStorage` cleared and the OS in dark mode: the initial loader paints dark, with no light-to-dark flash.
- [x] 3.3 In the same boot script, set `document.documentElement.style.colorScheme` to the resolved value next to the existing `dark` / `light` class and CSS-variable writes, so the declaration is correct before React mounts. Verify: with `localStorage` cleared on a dark OS, `getComputedStyle(document.documentElement).colorScheme` reads `dark` before the app bundle finishes loading.
- [x] 3.4 (Backstop) In `packages/shared/src/styles/tokens/semantic.scss`, add `color-scheme: light;` to the `.theme--light` block and `color-scheme: dark;` to the `.theme--dark` block (~lines 30-64). Verify: `npm run test:stylelint` passes and the compiled tokens contain both declarations.

## 4. Automated tests

- [x] 4.1 Extend `packages/core/src/Stores/__tests__/ui-store.spec.ts` with a `matchMedia` mock helper (returns a controllable `matches` plus recorded `addEventListener` / `removeEventListener` handlers) reusable by the cases in groups 1 and 2, following the existing file's plain-`new UIStore({ common: {}, client: {} } as never)` construction style. Verify: `npm run test:jest -- packages/core/src/Stores/__tests__/ui-store.spec.ts` passes.
- [x] 4.2 In `packages/trader/src/AppV2/Containers/Chart/__tests__/trade-chart.spec.tsx`, add cases asserting the `settings.theme` passed to `SmartChart` is `'dark'` when the mocked store's `ui.is_dark_mode_on` is true and `'light'` when false, and that a re-render with the flag flipped updates it (spec: "Switching theme re-themes the chart without a reload"). Verify: `npm run test:jest -- packages/trader/src/AppV2/Containers/Chart/__tests__/trade-chart.spec.tsx` passes.
- [x] 4.3 Run `npm run test:jest -- packages/core/src/Stores packages/core/src/App packages/trader/src/AppV2/Containers/Chart` and confirm green.
- [x] 4.4 Run `npm run test:eslint-all` and `npm run test:stylelint` on the changed files and confirm no new violations.

## 5. Documentation

- [x] 5.1 Update the theme section of `CLAUDE.md` (Store structure / Gotchas) to record that `ui.theme_preference` is the source of truth and `ui.is_dark_mode_on` is its resolved output, that `changeTheme()` is the single DOM writer, and that `color-scheme` must stay in step. Verify: the file describes the new resolution order and no longer implies `is_dark_mode_on` is set only by the user.
- [x] 5.2 Note in `CLAUDE.md` that `@deriv-com/smartcharts-champion` is at `1.10.4` (the entry currently says `1.9.6`, contradicting `node_modules/@deriv-com/smartcharts-champion/package.json`), since the chart-theme note sits beside it. Verify: the stated version matches `package.json`.

## 6. Manual verification (issue #1177 repro)

> Not run during implementation: every item below needs a physical Android device with Samsung
> Internet (and 6.6 needs Chrome for Android with force-dark on), which the implementation
> environment does not have. Left for QA. 6.1 is also what resolves Open Question 3.

- [ ] 6.1 On an Android device with the system theme set to **Dark**, open DTrader in **Samsung Internet Browser** with site data cleared. Expected: the whole app, _including the chart_, renders dark, and the darkening is DTrader's own theme (not the browser's force-dark). Record whether the `<meta name="color-scheme">` was needed for the opt-out, resolving Open Question 3.
- [ ] 6.2 Same device/browser with the system theme set to **Light**. Expected: the whole app including the chart renders light, with no leftover dark surfaces.
- [ ] 6.3 With DTrader open in Samsung Internet on the default landing page, switch the Android system theme from Dark to Light and back. Expected: page and chart follow, live, without a reload (spec: "System preference changes while the app is open").
- [ ] 6.4 In the sidebar theme selector, pick **Light** while the system theme is Dark, then reload. Expected: app and chart stay light across the reload, and the system theme no longer overrides it (spec: "Explicit choice is not overridden by a system change").
- [ ] 6.5 Open a contract's details page in dark mode and confirm the replay/contract-details chart matches the page (spec: "Contract-details chart matches the page").
- [ ] 6.6 Regression sweep on Chrome for Android (with "Auto dark theme" / `#enable-force-dark` on), desktop Chrome, and desktop Firefox: confirm no surface is left mismatched, and that a desktop first visit on a dark OS now lands in dark (expected new behaviour from removing the `isMobile()` gate — do not file as a regression).
- [ ] 6.7 Open DTrader with `?theme=light` on a dark-system device and with `?theme=dark` on a light-system device; confirm the URL parameter wins in both and the chart matches.
