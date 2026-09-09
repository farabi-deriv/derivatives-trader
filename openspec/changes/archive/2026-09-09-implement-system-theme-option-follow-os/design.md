## Context

See `proposal.md` — _Why_. Design-relevant state of the code this change lands on:

- **The engine ships separately and first.** PR #1239 (change `chart-remains-in-light-theme-while-the-rest-of-dtrader-follows-dark-system-theme-in-samsung-browser`, commit `f8f2cbe121`) adds to `packages/core/src/Stores/ui-store.js`: persisted `theme_preference` (`'system' | 'light' | 'dark'`, default `'system'`, seeded synchronously from `localStorage.ui_store` with the legacy migration "stored `is_dark_mode_on` with no `theme_preference` = explicit"), a private `resolveTheme()` that derives `is_dark_mode_on`, a live `matchMedia('(prefers-color-scheme: dark)')` `change` listener that only acts while the preference is `'system'`, a `changeTheme()` that is the single DOM writer (body + `<html>` classes, `color-scheme`, loader variables, `<meta name="theme-color">`), and the extended `index.html` boot-script resolution (`?theme=` → stored `theme_preference` → legacy boolean → `prefers-color-scheme`). That change also decided `setDarkMode()` records an explicit preference. **None of that is on this branch yet** (`f8f2cbe121` is not an ancestor of HEAD).
- **Two theme-control surfaces, split by breakpoint.** The mobile Menu page (`packages/core/src/Modules/Menu/menu.tsx`) redirects away above 600px (`useDevice().isMobile`, L53) and holds the "Dark theme" `ToggleSwitch` row (L112-131, shaped by the #1205 fix: static label, static moon icon). The AppV2 sidebar renders only above 600px (`app-shell.tsx:29`) and its theme item is a plain one-click button (`sidebar.tsx:68-70, 166-177`) — `getFlyoutContent()` has no `'theme'` case. Tablets (601–1279px) therefore get the desktop treatment.
- **One resolved observable, many consumers.** `ui.is_dark_mode_on` feeds `trade-chart.tsx:129` (`settings.theme`), `replay-chart.tsx:38-50`, `ThemeProvider` and the `trading:config` bridge event (`AppContent.tsx:57-68`), GTM, and chart markers. Anything that only writes `theme_preference` and lets `resolveTheme()` update `is_dark_mode_on` re-themes all of them for free.
- **Dead code**: `packages/trader/src/AppV2/Components/Layout/Sidebar/theme-selector.tsx` (a two-button Light/Dark flyout selector) is imported by nothing except its own spec; `ui-store.js:17` still documents a `'theme'` flyout value and `sidebar.spec.tsx:376-388` still fixtures it.
- **Figma** (node `21919-130536`, "Akram — Multiple charts") is the source of truth for the mobile UI but was not fetchable during planning (Figma MCP permission not granted in this session).

## Goals / Non-Goals

**Goals:**

- A mobile user can pick Light, Dark **or System**, and can get back to System after an explicit choice.
- The selection UI reflects the stored _preference_ (`theme_preference`), never just the resolved boolean.
- Desktop stays a one-click toggle; zero desktop UI change.
- No engine changes: this layer only writes `theme_preference` through one new action.

**Non-Goals:**

- Re-implementing or altering anything PR #1239 ships (resolution order, migration, `color-scheme`, boot script, listener lifecycle). If a reviewer wants the aggressive "migrate everyone to System" behaviour, that is PR #1239's Open Question 1, not this change's.
- A desktop System option or theme flyout — the issue explicitly rules out a modal/side sheet on desktop.
- Any change to chart theme plumbing (`settings.theme` already tracks `is_dark_mode_on`).
- Tablet-specific UI: 601–1279px keeps the sidebar toggle, matching the current split.

## Decisions

### 1. Depend on PR #1239's engine; bring it onto this branch as the first task

Rebase this branch once PR #1239 merges; if #1239 is instead abandoned in favour of this change, cherry-pick `f8f2cbe121` here (it is self-contained: store + boot script + tests). _Alternative considered:_ re-implement the engine inside this change — rejected: it would produce two conflicting in-flight edits to `ui-store.js`/`index.html` for the same issue (#1177) and duplicate a reviewed design.

### 2. One new action, `setThemePreference(preference)`, and `setDarkMode` delegates to it

`setThemePreference('light' | 'dark' | 'system')` validates the value, sets `theme_preference`, calls the engine's `resolveTheme()`, and pushes the existing GTM `'switch theme'` event when the resolved theme actually changes. `setDarkMode(is_dark)` keeps its signature and becomes `setThemePreference(is_dark ? 'dark' : 'light')` returning `is_dark_mode_on` — so the desktop sidebar, the `?theme=` handling in `app.jsx`, and every test double keep working unmodified. _Alternative considered:_ have the mobile UI call `setDarkMode` for Light/Dark and a separate `resetToSystemTheme()` for System — rejected: two entry points for one piece of state, and the selection UI reads more naturally as one setter keyed by the option value (KISS).

### 3. The mobile control is a Theme row opening a dedicated selection view (per Figma)

**Superseded on 2026-08-27 after the Figma node became fetchable:** the design shows alternative (a) below — a Settings "Theme" row (icon + chevron) opening a dedicated view with three stacked option cards (Light / Dark / System), the selected card outlined. Implemented as a slide-in drawer mirroring the language selector in the same menu; the original inline-selector reasoning is kept below for history.

Replace the toggle row in `menu.tsx` with a "Theme" row containing three selectable options (Light / Dark / System, each an icon + label, selected state on the option matching `theme_preference`) rendered inline in the Settings section — the same interaction shape as the orphaned `flyout-selector` pattern, extended to three options, with `localize('Light')` / `localize('Dark')` / `localize('System')`. _Alternatives considered:_ (a) a slide-in drawer like the language selector — heavier interaction for a three-value choice; (b) a quill-ui ActionSheet — that pattern lives in AppV2/trader, not the core menu page. **The Figma node is authoritative**: the implementer must open it before coding and follow it if it disagrees with this default (tracked as Open Question 1 in tasks.md).

### 4. Selected state derives from `theme_preference`, resolved rendering from `is_dark_mode_on`

The three options highlight by comparing against `theme_preference` (so System stays selected while the app renders dark), while everything visual continues to key off the resolved `is_dark_mode_on`. No component other than the selector needs to know `theme_preference` exists.

### 5. Delete the orphaned `theme-selector.tsx` rather than extending it

It targets the desktop sidebar flyout (`flyout-selector` classes), which the issue explicitly keeps closed, and nothing renders it. Extending it to three options would keep dead desktop code alive to serve a mobile design (YAGNI). Its useful pattern (active-option buttons) is carried into the new mobile markup. Also remove the stale `'theme'` value from the `active_sidebar_flyout` comment (`ui-store.js:17`) and the `'theme'` flyout fixture in `sidebar.spec.tsx`.

### 6. Types and mocks move in lockstep

`packages/stores/types.ts` gains `theme_preference: 'light' | 'dark' | 'system'` and `setThemePreference(...)`; `packages/stores/src/mockStore.ts` gains `theme_preference: 'system'` and `setThemePreference: jest.fn()`. Menu tests assert calls on `setThemePreference` instead of `setDarkMode`.

## Risks / Trade-offs

- **[Figma mismatch]** The planned inline three-option layout may differ from the design (e.g. a card/segmented style, different ordering, helper text). → The layout decision is isolated to `menu.tsx` markup + SCSS; behaviour, store API and tests are layout-agnostic. Implementer verifies against Figma before coding (Open Question 1).
- **[PR #1239 changes under us]** Review on #1239 could rename the engine internals (e.g. `resolveTheme`). → Only `setThemePreference` touches engine internals; everything else goes through the public observables. Rebase before starting, re-run its `ui-store.spec.ts` suite.
- **[Users stuck on a pre-System explicit preference]** The engine migration marks every returning user's stored boolean as explicit, so nobody is on System until they choose it. → That is exactly what the new mobile option exists to fix; the desktop story (no System button) is accepted by the issue ("keep the simple one-click toggle").
- **[Accessibility of the three-option control]** A row of buttons is not announced as a radio group by default. → Give the group `role='radiogroup'` with an accessible name and each option `role='radio'` + `aria-checked`, mirroring how the option markup renders selection.

## Migration Plan

1. Land PR #1239 (or cherry-pick `f8f2cbe121`) first; this change is meaningless without the `theme_preference` engine.
2. Ship store action + mobile UI + cleanup together in one PR; no data migration (the action writes the key the engine already persists and migrates).
3. Rollback is a plain revert of this change: the engine keeps working, users keep whatever `theme_preference` they last stored, and the mobile menu falls back to the two-state toggle.

## Open Questions

See `tasks.md` — both open questions (engine delivery path, exact Figma layout) are listed there with applied defaults, because the apply phase must resolve them before or during its first tasks.

## Amendment (code review, 2026-08-27)

Decision 2's claim that "the `?theme=` handling in `app.jsx` keeps working unmodified" is superseded: the review moved the param into a session-only `ui.url_theme_override` read synchronously by the store, and removed the `app.jsx` mount-effect handler — routing the param through `setDarkMode()` persisted every deep link as an explicit preference, erasing a stored System choice on each parameterised launch. See the amendments in the sibling `chart-remains-in-light-theme-…` design doc for the full list of engine revisions.
