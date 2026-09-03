## Why

Theme control must belong to the app, not the OS (issue #1177): an explicit Light or Dark choice always wins over the OS appearance, and a **System** choice follows the OS theme live. The underlying engine for this already exists in the in-flight change `chart-remains-in-light-theme-while-the-rest-of-dtrader-follows-dark-system-theme-in-samsung-browser` (PR #1239, branch `bugfix/chart-remains-light-theme-rest-dtrader`, commit `f8f2cbe121`): a persisted `ui.theme_preference` (`'system' | 'light' | 'dark'`, default `'system'`), live re-resolution via a `matchMedia('(prefers-color-scheme: dark)')` `change` listener, and `color-scheme` declarations that stop Samsung Internet / Chrome auto-dark from force-darkening the page while the canvas chart stays light. That change deliberately deferred the user-facing "System" option (its Open Question 2 chose "no UI change"), so today `'system'` is an internal state a user can never get back to: the mobile menu still shows a two-state "Dark theme" `ToggleSwitch` (`packages/core/src/Modules/Menu/menu.tsx:112-131`), and any tap on it pins an explicit preference forever. This change ships that deferred half — the redesigned mobile theme selection offering **Light / Dark / System** per the Figma design — completing #1177.

## What Changes

- **Mobile (≤600px) menu — Settings section**: replace the "Dark theme" row + `ToggleSwitch` in `packages/core/src/Modules/Menu/menu.tsx` with a three-option **Light / Dark / System** theme selection per the Figma design (node `21919-130536` in "Akram — Multiple charts"). The current preference — not the resolved theme — is indicated as selected, so a user on System sees "System" selected even while the app renders dark.
- **New store action**: `ui.setThemePreference('light' | 'dark' | 'system')` on `packages/core/src/Stores/ui-store.js`, the single entry point for preference changes; `setDarkMode()` keeps its signature and becomes a thin delegate for the explicit values, so every existing caller (desktop sidebar, `?theme=` param in `app.jsx`) is untouched. Selecting `'system'` re-resolves from `prefers-color-scheme` immediately and resumes following it live. Type declarations in `packages/stores/types.ts` and the mock in `packages/stores/src/mockStore.ts` gain the new members.
- **Desktop (>600px) sidebar — no UI change**: the one-click toggle (`packages/trader/src/AppV2/Components/Layout/Sidebar/sidebar.tsx:68-70`) stays exactly as it is — no modal or side sheet just to expose a third option. Default behaviour (follow the OS until a manual click, then the explicit choice sticks) is already delivered by the engine, because the toggle calls `setDarkMode()` which records an explicit preference.
- **Cleanup**: delete the orphaned `packages/trader/src/AppV2/Components/Layout/Sidebar/theme-selector.tsx` and its spec — nothing imports it, the desktop sidebar has no `'theme'` flyout case, and the issue explicitly keeps desktop flyout-free.
- **Prerequisite**: the engine from PR #1239 must be on this branch (rebase once it merges, or cherry-pick `f8f2cbe121`). This change adds **no engine behaviour** — `resolveTheme()`, the `change` listener, the boot-script resolution order, and the migration ("legacy stored boolean = explicit") are consumed as-is.

No breaking changes. `ui.is_dark_mode_on` remains the resolved boolean every consumer reads (charts, `ThemeProvider`, GTM, mobile bridge, chart markers), so the chart keeps following the app theme on every path automatically.

## Capabilities

### New Capabilities

- `theme-selection`: The user-facing theme preference control — the Light / Dark / System selection on mobile, the one-click toggle on desktop — and the guarantees that an explicit selection is enforced app-wide regardless of OS appearance while a System selection follows the OS theme live, including re-selecting System after a previous explicit choice.

### Modified Capabilities

<!-- None. The theme *resolution* engine capability (`app-theme`) is introduced by the in-flight
     sibling change (PR #1239) and does not yet exist under openspec/specs/ on this branch; this
     change alters none of its requirements — selecting 'system' reuses the engine's existing
     `theme_preference === 'system'` path unchanged. `themed-scrollbars` covers scrollbar styling
     within a theme, not theme selection. -->

## Impact

- **Code**
    - `packages/core/src/Modules/Menu/menu.tsx` — replace the theme toggle row (L112-131) with the three-option selection; drop the now-unused `ToggleSwitch` import if nothing else uses it.
    - `packages/core/src/Stores/ui-store.js` — add `setThemePreference` (observable registration + `action.bound`), refactor `setDarkMode` to delegate to it; keep the GTM `'switch theme'` push firing on every preference change.
    - `packages/stores/types.ts` — add `theme_preference` and `setThemePreference` to the `UIStore` type (next to `is_dark_mode_on:319` / `setDarkMode:355`).
    - `packages/stores/src/mockStore.ts` — add `theme_preference: 'system'` and `setThemePreference: jest.fn()` (next to L115/L143).
    - Deleted: `packages/trader/src/AppV2/Components/Layout/Sidebar/theme-selector.tsx` + `__tests__/theme-selector.spec.tsx`; the stale `'theme'` flyout value in the `ui-store.js:17` comment and the `active_sidebar_flyout: 'theme'` fixture in `sidebar.spec.tsx:376-388`.
- **Unchanged consumers** — `trade-chart.tsx`, `replay-chart.tsx`, `AppContent.tsx` (`ThemeProvider` + `trading:config` bridge event), `gtm-store.js`, `contract-store.js`, `chart-markers.js`, `sidebar.tsx`.
- **Tests** — `packages/core/src/Modules/Menu/__tests__/menu.spec.tsx` (the `describe('Theme toggle')` block from the #1205 fix is replaced by selection tests); `packages/core/src/Stores/__tests__/ui-store.spec.ts` (`setThemePreference` cases on top of PR #1239's theme suite).
- **Storage** — no new keys beyond the engine's `theme_preference` (already in `ui_store`); selecting an option writes the same key.
- **Dependencies** — none added. Depends on PR #1239 landing first (or being cherry-picked); see design.md.
- **Design source of truth** — Figma node `21919-130536` ("Akram — Multiple charts"); not fetchable in this planning session (Figma MCP permission not granted), so the exact mobile layout is an Open Question in tasks.md with a recommended default the implementer must verify against Figma.
