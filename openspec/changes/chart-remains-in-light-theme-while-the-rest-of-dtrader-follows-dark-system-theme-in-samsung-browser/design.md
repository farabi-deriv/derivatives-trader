## Context

See `proposal.md` — _Why_ for the diagnosis. The design-relevant constraints in the current code:

- **One observable, many consumers.** `ui.is_dark_mode_on` (`packages/core/src/Stores/ui-store.js:25`) is read by both charts, `ThemeProvider` (`AppContent.tsx:68`), the mobile-bridge `trading:config` event (`AppContent.tsx:57-65`), GTM (`gtm-store.js:43`), contract/chart markers (`contract-store.js`, `Helpers/chart-markers.js`), `base-store.onThemeChange` reactions in three packages, and `theme-selector.tsx`. Any redesign that changes its name, type, or semantics ripples across all of them, so it stays exactly as it is.
- **Three writers of theme DOM state today.**
    1. `packages/core/src/index.html` inline boot script — sets `<html class="dark|light">` and inline `--color-surface-primary` / `--color-text-primary` on `documentElement`, before React.
    2. `packages/core/src/Stores/ui-store.js:381-389` `changeTheme()` in a MobX `autorun` — toggles `theme--dark` / `theme--light` on `document.body`. This is the only writer that reacts to runtime changes.
    3. `packages/core/src/App/app.jsx:80-92` — a `React.useEffect` with `[]` deps that sets the `<html>` class once at mount and never again.
       So `<html>`'s class and inline variables go stale the moment the theme changes at runtime. Since `color-scheme` belongs on `:root`, this staleness has to be fixed before the browser-facing fix can be trusted.
- **Persistence is snapshot-based and key-present.** `BaseStore.retrieveFromStorage()` (`packages/core/src/Stores/base-store.js`) copies only the keys present in the stored `ui_store` snapshot over the class defaults, and `setupReactionForLocalStorage()` re-writes the whole snapshot whenever any persisted property changes. Consequence: `is_dark_mode_on` is written on the very first state change of the session, so "no value stored" is only true on a genuine first visit — a boolean alone cannot distinguish "defaulted" from "user chose".
- **Rehydration is deferred.** The `retrieveFromStorage()` call is inside a `setTimeout(..., 0)` in the `BaseStore` constructor, so the store's first React render uses class-field defaults. That is why `app.jsx:30` falls back to reading `localStorage` directly.
- **The chart is canvas.** SmartCharts (`@deriv-com/smartcharts-champion`) is a Flutter Web build loaded through canvaskit or skwasm (renderer preload block in `index.html`). It receives `settings.theme` as a plain string; it does not read the app's CSS.

## Goals / Non-Goals

**Goals:**

- The browser stops force-darkening DTrader, so the app's own theme is the only thing painting colours — chart and page can no longer disagree.
- "No preference yet" genuinely means "follow the system", live, on every viewport.
- Exactly one code path owns applying a resolved theme to the DOM at runtime.
- Zero change to the `ui.is_dark_mode_on` / `ui.setDarkMode()` contract, so no consumer needs touching.

**Non-Goals:**

- Redesigning the theme selector UI. It stays a two-option Light/Dark control; a visible "System" option is deferred (see _Open Questions_ in `tasks.md`).
- Reworking the SmartCharts theme integration. `settings.theme` already tracks `is_dark_mode_on` correctly; the chart is a symptom, not the defect.
- Changing any colour token, or adding a `prefers-contrast` / `prefers-reduced-motion` story.
- Making the boot script share code with the store. It runs before any bundle loads and must stay inline vanilla JS.

## Decisions

### 1. Add `theme_preference` next to `is_dark_mode_on`, rather than replacing it

`theme_preference: 'system' | 'light' | 'dark'` becomes a new persisted observable on `UIStore`, defaulting to `'system'`. `is_dark_mode_on` remains a persisted observable and remains the resolved output that everything reads:

- while `theme_preference === 'system'` → `is_dark_mode_on` mirrors `prefers-color-scheme: dark`, re-evaluated on every media-query `change`;
- while it is `'light'` / `'dark'` → `is_dark_mode_on` is pinned to that value.

_Alternative considered:_ make `is_dark_mode_on` a `computed` derived from `theme_preference` + a `system_prefers_dark` observable. Cleaner in MobX terms, but it must then be removed from `local_storage_properties`, which breaks the two consumers that read the raw persisted boolean out of `localStorage` before the store exists — the `index.html` boot script and `app.jsx:30`. Keeping it a persisted observable preserves both and keeps the diff small (KISS, and `is_dark_mode_on` staying writable is what makes the migration below possible).

### 2. Resolution order: URL param → explicit preference → system

Same order the boot script and `app.jsx` already imply, made explicit and shared in spirit (not in code) between the two:

1. `?theme=dark|light` — wins, and is recorded as an explicit preference via the existing `setDarkMode()` call in `app.jsx`. This is how the native mobile app hands its theme in (`useMobileBridge` / `trading:config`), so it must keep winning.
2. Stored `theme_preference` of `'light'` / `'dark'`.
3. `prefers-color-scheme: dark`.

### 3. Migration: a stored `is_dark_mode_on` with no `theme_preference` means "explicit"

If the stored snapshot has `is_dark_mode_on` but no `theme_preference`, read it as `is_dark_mode_on ? 'dark' : 'light'`. A returning user therefore keeps exactly the theme they had.

_Alternative considered:_ treat a missing `theme_preference` as `'system'`, which would give every existing user system-following immediately. Rejected as the default: the stored boolean cannot be distinguished from a deliberate choice, so this would silently flip the theme of every user who had picked one. The consistency half of the bug (chart vs. page) is fixed for these users regardless, by decision 4 — they just do not gain system-following until they use the selector. Reviewer-overridable; see _Open Questions_ in `tasks.md`.

The migration cannot be deferred until after rehydration. `retrieveFromStorage()` is a MobX `action`, so the local-storage `reaction` set up moments earlier in the same `setTimeout` fires at the end of it and writes the whole snapshot back — `theme_preference: 'system'` included. Any migration queued behind that timer reads an already-migrated snapshot, never takes its legacy branch, and leaves the returning user on the system theme. So the snapshot is parsed **synchronously in the class-field initialiser** (`readStoredThemePreference()`), which needs no `this` and runs before the constructor's `autorun` paints the DOM — which also removes the wrong-theme flash an explicit-preference user would otherwise see on the boot loader.

`retrieveFromStorage()` still blanket-assigns the snapshot afterwards, and the persisted `is_dark_mode_on` boolean it restores is the value captured on the _last_ visit. A `resolveTheme()` call queued behind the rehydrate timer therefore re-derives `is_dark_mode_on` from `theme_preference`, so a stale boolean cannot outrank a `'system'` preference whose OS theme has changed since.

### 4. `changeTheme()` becomes the single DOM writer, and owns `color-scheme`

The existing `autorun(() => this.changeTheme())` already fires on every `is_dark_mode_on` change. Extend `changeTheme()` to apply the complete resolved theme in one place:

- `document.body.classList` — `theme--dark` / `theme--light` (unchanged).
- `document.documentElement.classList` — `dark` / `light`, matching what the boot script wrote.
- `document.documentElement.style.colorScheme` — `'dark'` / `'light'`.
- The two inline loader variables the boot script set on `documentElement.style`, kept in step so a runtime switch does not leave a light loader colour behind.
- `<meta name="theme-color">` — currently a hard-coded `#414652` in `index.html`; set it to the theme's surface colour so the browser chrome matches.

The mount-only `<html>` effect in `app.jsx:80-92` is then deleted — two writers for one piece of state is what let it go stale.

_Alternative considered:_ put `color-scheme` in CSS only, on `.theme--light` / `.theme--dark` in `semantic.scss`. Those classes live on `<body>`, and `color-scheme` on `<body>` does not reliably drive the root canvas background or the browser's auto-dark decision. A CSS declaration is still worth adding as a backstop, but the JS declaration on `:root` is the authoritative one.

### 5. Declare support for both schemes via `<meta name="color-scheme" content="light dark">`, and the resolved one via the `color-scheme` property

Two declarations doing two jobs:

- The `<meta>` in `index.html` states "this page supports light and dark" from the very first byte, which is the signal a Chromium auto-dark implementation checks before deciding to force-darken. It must be static, because at parse time the resolved theme is not yet known for the meta to be useful as an opt-out.
- The `color-scheme` property on `:root` states which one is currently in use, so browser-painted UI (native scrollbars, form controls, the root canvas background) matches.

_Alternative considered:_ set only `color-scheme: <resolved>` and no `<meta>`. That leaves a user who explicitly picks Light on a dark-system device declaring `color-scheme: light`, which is exactly the signal that re-enables force-dark and reproduces the bug for them. Declaring both-supported in the meta covers that case. This is the part of the design that most needs on-device verification (see _Risks_).

### 6. Drop the `isMobile()` gate on system detection

`is_dark_mode_on = matchMedia(...).matches && isMobile()` gates system-theme following on `window.innerWidth <= 600`. Removing the gate is required for correctness — the same Samsung device crosses that threshold just by rotating — and it extends system-following to desktop, which is the behaviour users expect and what the issue's expected result describes.

### 7. Listener lifecycle

Register the `matchMedia('(prefers-color-scheme: dark)')` `change` listener in the `UIStore` constructor, next to the existing `window.addEventListener('resize', this.handleResize)`, and remove it in the store's existing unmount/dispose path. Use `addEventListener('change', ...)` with a guarded fallback to the deprecated `addListener` — the store already guards `window?.matchMedia?.` for the jsdom/SSR case, and the same defensiveness applies here.

## Risks / Trade-offs

- **The auto-dark opt-out cannot be proven from this repo.** Jest/jsdom cannot exercise Samsung Internet's force-dark. → The automated tests cover theme _resolution_ and _application_ (including that `color-scheme` is written and updated); the browser-level effect is a named manual QA step in `tasks.md`, run on the reporter's configuration (Android, system Dark, Samsung Internet).
- **Appearance changes for every force-dark user, not just the reporter.** Users on Samsung Internet / Chrome auto-dark currently see an algorithmically darkened DTrader; after this change they see DTrader's own theme. For a user with no stored preference on a dark device that is a strict improvement (real dark theme, dark chart). For a returning user whose stored preference is Light it means a genuinely light app where they previously saw a dark-ish one. → Called out in the proposal's Impact; the alternative (keep force-dark) cannot fix the chart, because canvas content is out of its reach.
- **`<meta name="color-scheme" content="light dark">` conflicting with an explicit override.** Declaring dark support while rendering light is precisely the state that keeps auto-dark off, but a browser could in principle honour the system preference for UA-painted widgets against the app's light surfaces. → The `color-scheme` property on `:root` carries the resolved value and takes precedence for those widgets; the app already themes its own scrollbars (`openspec/specs/themed-scrollbars/spec.md`).
- **Migration heuristic mislabels a defaulted boolean as a choice.** A user who never opened the theme selector but whose `is_dark_mode_on: false` was persisted as a side effect of some other UI state will be treated as having chosen Light. → Conservative by design (never flips anyone), and one visit to the theme selector puts them back in control. Flagged as an _Open Question_ so a reviewer can choose the aggressive migration instead.
- **Removing the `isMobile()` gate changes desktop first-visit behaviour.** Desktop users on a dark OS with no stored preference will now land in dark. → Intended, and consistent with the spec's "regardless of viewport width" requirement; called out for QA so it is not filed as a regression.
- **Two implementations of the resolution order** (inline boot script, store). → Unavoidable — the boot script cannot import. Mitigated by keeping the order short and documenting it in one place (this file), and by a test that asserts the store's resolution matches the documented order.

## Migration Plan

1. Ship store + DOM changes and the `index.html` changes together; they are meaningless apart (see _Why_ in the proposal).
2. No data migration job. `theme_preference` is written lazily on first rehydrate, per decision 3; a snapshot without it is always interpretable.
3. Rollback is a plain revert. An already-written `theme_preference` key is ignored by the old code (`retrieveFromStorage` assigns it, nothing reads it) and `is_dark_mode_on` still holds the correct resolved value, so a revert leaves users on the theme they were last showing.

## Amendments (code review, 2026-08-27)

A branch-wide review revised three decisions above; the code is the source of truth:

- **Decision 1 (keep persisting `is_dark_mode_on`) is reversed.** The boolean is derived-only now: it was dropped from `local_storage_properties`, and `BaseStore.retrieveFromStorage()` was hardened to assign only keys declared in the `*_storage_properties` lists — so a stale boolean in an old snapshot can no longer overwrite a freshly resolved value. This also removed the constructor's post-rehydrate `setTimeout(resolveTheme, 0)` and its timer-ordering dependency. The two pre-store readers the decision protected are unaffected: the boot script and the legacy migration read old snapshots (which still carry the boolean) but new snapshots persist `theme_preference` alone.
- **`changeTheme()` clears the boot script's inline `--color-surface-primary`/`--color-text-primary` instead of rewriting them.** Once the stylesheets are loaded the `.theme--*` token blocks own those values; rewriting them from JS duplicated brand hex literals (they had already drifted: inline light text `#000000` vs the token's `#181c25`). `<meta name="theme-color">` now reads the resolved token via `getComputedStyle`, with hex fallbacks only for jsdom.
- **`?theme=` became a session-only override (`ui.url_theme_override`), read synchronously in the store, and the `app.jsx` mount-effect handler was removed.** Routing the param through `setDarkMode()` persisted a deep link as the user's explicit preference — erasing a stored System choice on every parameterised launch (native shells append the param on each open) — and the mount effect raced `retrieveFromStorage()`. The override loses to an explicit in-app choice and is never written to storage, matching the boot script's param-first resolution order exactly.
