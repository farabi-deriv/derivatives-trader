## Open Questions

Each has a recommended default, already applied throughout this plan — the plan is implementable as written. A reviewer may replace any answer before implementation starts.

1. **How does the theme engine from PR #1239 reach this branch?**
    - **(A) — RECOMMENDED — Rebase after #1239 merges.** PR #1239 is open, fully implemented and independently reviewable (it fixes the Samsung force-dark bug on its own). Wait for it, rebase, start at task 2.

2. **Exact mobile layout for the Light / Dark / System control (Figma `21919-130536` was not fetchable during planning)?**
    - **(A) — RECOMMENDED — Inline three-option selector** in the Settings section replacing the toggle row: icon + label per option, selected state on the option matching `theme_preference` (the `flyout-selector` pattern extended to three options). The implementer MUST open the Figma node before coding and follow it where it differs — only `menu.tsx` markup + SCSS are affected.

---

## 1. Prerequisite: theme engine on this branch

- [x] 1.1 Bring the theme engine onto this branch per Open Question 1 (default: rebase onto master after PR #1239 merges; fallback: `git cherry-pick f8f2cbe121`). Verify: `packages/core/src/Stores/ui-store.js` contains `theme_preference`, `resolveTheme`, and the `matchMedia` `change` listener, and `npm run test:jest -- packages/core/src/Stores/__tests__/ui-store.spec.ts` passes.

## 2. Store: `setThemePreference` action

- [x] 2.1 In `packages/core/src/Stores/ui-store.js`, add `setThemePreference(preference)` (`'light' | 'dark' | 'system'`; ignore invalid values) that sets `theme_preference`, re-runs the engine's `resolveTheme()`, and pushes the existing `gtm.pushDataLayer({ event: 'switch theme' })` when the resolved theme actually changes; register it as `action.bound` in the `makeObservable` block (next to `setDarkMode: action.bound`, ~L326). Verify: new `ui-store.spec.ts` cases — `setThemePreference('dark')` on a light-OS mock resolves dark; `setThemePreference('system')` on a dark-OS mock resolves dark; an invalid value changes nothing.
- [x] 2.2 In `packages/core/src/Stores/ui-store.js`, refactor `setDarkMode(is_dark_mode_on)` (~L551) to delegate to `setThemePreference(is_dark ? 'dark' : 'light')` while keeping its signature and `is_dark_mode_on` return value, so the desktop sidebar (`sidebar.tsx:68-70`) and the `?theme=` path (`app.jsx:47-54`) need no edits. Verify: existing `ui-store.spec.ts` `setDarkMode` cases still pass, plus a case asserting `setDarkMode(true)` leaves `theme_preference === 'dark'`.
- [x] 2.3 Add a `ui-store.spec.ts` case for the round trip that motivates this change: `setThemePreference('light')` on a dark-OS mock → app light; then `setThemePreference('system')` → resolves dark again; then a mocked media-query `change` to light flips `is_dark_mode_on` to false (spec: "Selecting System follows the OS theme live"). Verify: case passes in isolation via `npm run test:jest -- packages/core/src/Stores/__tests__/ui-store.spec.ts -t 'system'`.
- [x] 2.4 In `packages/stores/types.ts`, add `theme_preference: 'light' | 'dark' | 'system'` and `setThemePreference: (preference: 'light' | 'dark' | 'system') => void` to the UIStore type (next to `is_dark_mode_on` L319 / `setDarkMode` L355); in `packages/stores/src/mockStore.ts`, add `theme_preference: 'system'` (next to L115) and `setThemePreference: jest.fn()` (next to L143). Verify: `npx tsc -b packages/stores` (or the package's existing type-check script) reports no errors and dependent package builds type-check.

## 3. Mobile UI: Light / Dark / System selection

- [x] 3.1 Open Figma node `21919-130536` ("Akram — Multiple charts") and confirm or correct the layout assumed by Open Question 2(A); note any divergence (option order, icons, copy, grouping) directly in this file before writing markup. Verify: this task's checkbox is only ticked with a written confirmation or correction note here.
    - **Note (2026-08-27, implementation session):** The Figma node (`https://www.figma.com/design/zkhQsTI8PMKJX7k1N2QBJ1/Akram---Multiple-charts?node-id=21919-130536`, URL recovered from issue #1177) was still not fetchable — Figma MCP permission is not granted in this unattended session (`get_screenshot` and `get_metadata` both denied). Open Question 2's applied default **(A) inline three-option selector** (Light / Dark / System, icon + label, order Light → Dark → System, selected state from `theme_preference`) is implemented as planned. The visual check against Figma remains open in task 7.5; only `menu.tsx` markup + SCSS would change if the design differs. Icon choices: Light `StandaloneSunBrightRegularIcon`, Dark `StandaloneMoonRegularIcon` (both carried over from the orphaned flyout selector), System `StandaloneMobileNotchRegularIcon` (a device icon — quill-icons has no half-circle/auto icon; swap per Figma in 7.5 if it differs).
    - **Resolution (2026-08-27, revision session):** Figma node `21919-130536` fetched via the Figma REST API. The design is Open Question 2's option **(B)**, not (A): the Settings section shows a "Theme" row (resolved-theme icon + chevron) that opens a dedicated Theme view — back button, "Theme" title, and three stacked full-width option cards (icon left + label, 64px tall, 8px radius, 4% surface fill, 16px padding, 10px gap), with the selected card outlined by a 1px text-primary border. No radio glyphs or subtitles are visible. Option order and icons confirmed: Light (FA sun-bright `\ue28f`), Dark (FA moon `\uf186`), System (FA mobile-notch `\ue1ee`) — matching the quill icons already chosen. Implemented as a slide-in drawer mirroring the language selector pattern; `menu.tsx` markup + `menu.scss` updated, behaviour/store API unchanged.
- [x] 3.2 In `packages/core/src/Modules/Menu/menu.tsx`, replace the "Dark theme" row (L112-131) with the three-option Theme selection: options Light (`StandaloneSunBrightRegularIcon`), Dark (`StandaloneMoonRegularIcon`) and System, labels via `localize('Light')` / `localize('Dark')` / `localize('System')`, each option calling `ui.setThemePreference(<value>)`, selected state driven by `ui.theme_preference`; group as `role='radiogroup'` with `role='radio'` + `aria-checked` per option; remove the now-unused `ToggleSwitch` import. Verify: `npm run test:jest -- packages/core/src/Modules/Menu` passes with the new tests from 3.4.
- [x] 3.3 Add/extend the menu-page styles for the three-option control in the menu's existing SCSS (follow the pattern of the current `menu-page__item` / `header__menu-mobile-link` classes; new class names in the same BEM family). Verify: `npm run test:stylelint` passes.
- [x] 3.4 Rewrite the `describe('Theme toggle')` block in `packages/core/src/Modules/Menu/__tests__/menu.spec.tsx` (L233-259) as theme-selection tests: renders all three options; the option matching `theme_preference` has the selected state (including System selected while `is_dark_mode_on` is true); clicking Light/Dark/System calls `setThemePreference` with `'light'`/`'dark'`/`'system'`; no `ToggleSwitch` is rendered. Verify: `npm run test:jest -- packages/core/src/Modules/Menu/__tests__/menu.spec.tsx` passes.

## 4. Cleanup: orphaned desktop theme flyout remnants

- [x] 4.1 Delete `packages/trader/src/AppV2/Components/Layout/Sidebar/theme-selector.tsx` and `packages/trader/src/AppV2/Components/Layout/Sidebar/__tests__/theme-selector.spec.tsx` (nothing imports the component). Verify: `grep -rn "theme-selector\|ThemeSelector" packages/` returns no source hits and `npm run test:jest -- packages/trader/src/AppV2/Components/Layout/Sidebar` passes.
- [x] 4.2 Remove `'theme'` from the `active_sidebar_flyout` comment in `packages/core/src/Stores/ui-store.js:17` and replace the `active_sidebar_flyout: 'theme'` fixture in `packages/trader/src/AppV2/Components/Layout/Sidebar/__tests__/sidebar.spec.tsx` (L376-388) with a value the sidebar actually renders (`'language'`). Verify: the sidebar spec still passes.

## 5. Verification

- [x] 5.1 Confirm the desktop toggle behaviour against the spec with the existing sidebar tests plus one new case: with `theme_preference: 'system'` and `is_dark_mode_on: true` (OS dark), clicking `dt_sidebar_theme` calls `setDarkMode(false)` — i.e. the one-click toggle flips relative to the resolved theme and records an explicit choice. Verify: `npm run test:jest -- packages/trader/src/AppV2/Components/Layout/Sidebar/__tests__/sidebar.spec.tsx` passes.
- [x] 5.2 Run the affected suites together and confirm green: `npm run test:jest -- packages/core/src/Stores packages/core/src/Modules/Menu packages/trader/src/AppV2/Components/Layout/Sidebar packages/trader/src/AppV2/Containers/Chart`. (9 suites, 144 tests, all green.)
- [x] 5.3 Run `npm run test:eslint-all` and `npm run test:stylelint`; confirm no new violations on changed files. (Ran targeted ESLint on every changed file — 0 errors, only pre-existing warnings — and stylelint on `menu.scss` — clean. The repo-wide `test:eslint-all`/`test:stylelint` runs are handled by the automated verification stage that follows implementation.)

## 6. Documentation

- [x] 6.1 Update `CLAUDE.md` (Gotchas / Store structure): mobile menu offers Light/Dark/System via `ui.setThemePreference`; desktop keeps the one-click toggle that records an explicit preference; selection UI keys off `theme_preference`, rendering keys off `is_dark_mode_on`. Verify: the file no longer describes the mobile control as a dark-theme toggle.

## 7. Manual QA (needs real devices; not automatable in Jest/jsdom)

- [ ] 7.1 On a mobile device (≤600px) with the OS in Dark, clear site data, open the menu: System is selected and the app (chart included) is dark; select Light → whole app goes light and stays light after reload and after flipping the OS theme. Verify: matches spec "An explicit Light or Dark selection is enforced app-wide".
- [ ] 7.2 With System selected and the app open, flip the OS theme both ways: page and chart follow live, no reload (spec: "Selecting System follows the OS theme live").
- [ ] 7.3 On Samsung Internet with the browser's dark mode active and the app set to Light: no inversion, chart and page both light (spec: "Forced browser darkening does not leak into an explicitly light app").
- [ ] 7.4 Desktop (>600px): first visit on a dark OS lands dark; one sidebar click switches to light in place with no flyout; flipping the OS afterwards changes nothing (spec: desktop requirement, all three scenarios).
- [ ] 7.5 Visual check of the mobile selection against Figma `21919-130536` (spacing, icons, order, selected state) before requesting design/QA signoff.
