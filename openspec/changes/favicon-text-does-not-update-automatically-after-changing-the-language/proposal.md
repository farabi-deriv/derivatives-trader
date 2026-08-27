## Why

Switching the app language leaves the browser tab label — what [issue #951](https://github.com/deriv-com/derivatives-trader/issues/951) calls the "favicon text", i.e. `document.title` — showing the previous language ("Trade | Deriv" instead of "Handel | Deriv"). It only corrects itself on a manual page refresh. Every other visible string re-translates immediately, so the stale tab is the one place the switch visibly fails; with several tabs open it also mislabels which app is which.

The tab title is written as a **render-phase side effect** inside each router's `render` prop, and nothing in that path is subscribed to i18next. The write does happen once during the switch — but too early to be correct, and never again:

1. `changeSelectedLanguage(key)` (`packages/core/src/Stores/common-store.js:95`) clears the socket cache, rewrites the `lang` URL parameter, `await`s `setLocale(key)` (dayjs only — `packages/shared/src/utils/date/dayJs-config.ts:33`) and sets the MobX observable `current_language`. **It never touches i18next.**
2. The observable change re-renders the `observer` route containers, so `renderFactory` re-runs and writes `document.title` from `getTitle()` → `localize(...)` → `i18next.t(...)` — while i18next is still on the **old** language. Stale title written.
3. Only then does the caller run `switchLanguage(lang)` (`language-selector.tsx:21`, `language-link.tsx:36`), which calls `i18n.changeLanguage` — asynchronous: i18next emits `languageChanged` (and updates `i18n.language`) from inside the `loadResources` callback, once the new bundle has downloaded (`node_modules/i18next/dist/cjs/i18next.js:1986-1993`).
4. When `languageChanged` finally fires, react-i18next force-updates only components that called `useTranslation` (`bindI18n: 'languageChanged'`, `node_modules/react-i18next/dist/commonjs/defaults.js:9`). None of the three route components do — they call the module-level `localize`. So no further render occurs and the stale title survives until reload.

## What Changes

- The browser tab title SHALL re-derive itself when the active language finishes changing, with no page refresh — for every route in `@deriv/core`, `@deriv/trader` (AppV2) and `@deriv/reports`.
- A new shared hook `useDocumentTitle(getTitle?)` lands in `@deriv/components` (`src/hooks/use-document-title.ts`, exported through the existing `src/hooks/index.ts` barrel). It owns the one line of `` `${title} | ${getBrandName()}` `` formatting that is currently copy-pasted into three route components, and subscribes to the i18next instance's `languageChanged` event so a completed language switch re-runs the title write.
- The three route components stop composing and assigning `document.title` themselves and call the hook instead:
    - `packages/core/src/App/Components/Routes/route-with-sub-routes.jsx`
    - `packages/components/src/components/route-with-subroutes/route-with-subroutes.tsx` (used by the trader AppV2 router)
    - `packages/reports/src/Components/Routes/route-with-sub-routes.tsx`
- `packages/reports/src/Containers/reports.tsx` also calls the hook, with the sub-route it already resolves via `getSelectedRoute`. The reports sub-pages are **not** rendered through `RouteWithSubRoutes` — desktop resolves them inside `VerticalTab is_routed` (`vertical-tab-content-container.tsx:60-70`, a plain `<Route>`) and mobile renders `selected_route.component` directly — so before this change `/reports/statement`, `/reports/positions`, `/reports/profit` and `/reports/archived-statement` all read "Reports | Deriv". This is what makes the _Nested routes resolve to the innermost title_ requirement true rather than aspirational.
- Title precedence therefore matters and is handled by keeping the write in the render phase: on `/reports/statement` core's `/reports` router writes "Reports", the `@deriv/reports` router writes "Reports" again, and the `Reports` container — a descendant of both — writes "Statement". Render runs parent-first, so the deepest writer wins. React runs effects child-first, which would invert this, so the hook must not be "cleaned up" into a `useEffect`.
- The empty-title fallback is unified on the `@deriv/reports` behaviour (`document.title = getBrandName()` when a route has no `getTitle`), replacing core's and `@deriv/components`' "leave the previous title alone". Every route config in the repo defines `getTitle`, so this is a latent-path change only.
- `__mocks__/translation.mock.js` (the repo-wide `@deriv-com/translations` mock, wired in `jest.config.base.js:15`) gains the `instance` and `switchLanguage` fields the real `useTranslations()` returns, so the subscription is exercisable in tests.
- Regression coverage: a unit test for the hook (fires `languageChanged` on a fake i18next instance and asserts `document.title` re-derives) plus a test per route component.

No breaking changes. No API, WebSocket, dependency or build changes. The favicon _image_ is a single static asset (`packages/core/build/config.js:66-70,234-259`) with no per-language variant, so nothing about the icon itself changes — see Open Questions in `tasks.md` for that reading of the issue title.

## Capabilities

### New Capabilities

- `page-title`: What the browser tab shows for each route — how the localized route title is composed with the brand name, which router wins when routes are nested, and the requirement that the title tracks the active language without a page refresh.

### Modified Capabilities

<!-- None. openspec/specs/ currently holds allow-equals-toggle, barrier-input, barrier-range-errors, contract-details-chart, duration-end-time-fields, market-descriptions, market-info-sync, positions-drawer and themed-scrollbars — none of them covers document titles, routing or language switching. -->

## Impact

**Root cause evidence (`inferred from code`, plus `backed by docs/external source` for the two libraries):**

- `packages/core/src/App/Components/Routes/route-with-sub-routes.jsx:60-61` — `const title = route.getTitle?.(); if (title) document.title = \`${title} | ${getBrandName()}\`;`inside`renderFactory`, the `<Route render>`prop. Component is`observer(...)` (MobX) but has no translations subscription.
- `packages/components/src/components/route-with-subroutes/route-with-subroutes.tsx:88-89` — the same two lines; plain function component, no subscription. Consumed only by `packages/trader/src/AppV2/Routes/router.tsx:27`.
- `packages/reports/src/Components/Routes/route-with-sub-routes.tsx:36-37` — same, with the `: getBrandName()` fallback. Consumed only by `packages/reports/src/Components/Routes/binary-routes.tsx:19`.
- `packages/core/src/Stores/common-store.js:95-119` (`changeSelectedLanguage`) — `setLocale` is dayjs-only; the action never calls `i18n.changeLanguage`. `changeCurrentLanguage` (`:84-93`) sets `current_language` and a 2.5s `is_language_changing` flag.
- `packages/trader/src/AppV2/Components/Layout/Sidebar/language-selector.tsx:19-23` and `packages/core/src/App/Components/Routes/language-link.tsx:34-38` — both `await changeSelectedLanguage(lang)` **then** `switchLanguage(lang)`, which is the ordering that guarantees the MobX-driven render happens before i18next has switched. `packages/core/src/App/AppContent.tsx:43-54` also calls `switchLanguage(current_language)` from an effect on `current_language`.
- `node_modules/@deriv-com/translations/dist/provider/translation-provider.js` — `switchLanguage` calls `i18n.changeLanguage(t)` and sets context state synchronously; the context value change re-renders only context consumers, and `children` is a stable element so the subtree below `TranslationProvider` does not re-render.
- `node_modules/@deriv-com/translations/dist/hooks/use-translations.js` — `useTranslations()` wraps react-i18next's `useTranslation()` and returns `{ ready, localize, instance, switchLanguage, currentLang }`. `instance` is the live i18next object, so `instance.language` is the authoritative post-switch language.
- `node_modules/i18next/dist/cjs/i18next.js:1976-2027` (v26.3.1) — `changeLanguage` emits `languageChanged` from `done()`, inside the `loadResources` callback, after `setLngProps` has updated `this.language`. Re-rendering on that event is therefore guaranteed to see the new bundle.
- `node_modules/react-i18next/dist/commonjs/defaults.js:9` (v17.0.8) — `bindI18n: 'languageChanged'`; `useTranslation.js:63` registers the re-render handler.

**Files this change touches:**

- New: `packages/components/src/hooks/use-document-title.ts` and `packages/components/src/hooks/__tests__/use-document-title.spec.tsx` (the `__tests__` directory already exists alongside `use-device.spec.tsx`).
- Modified: `packages/components/src/hooks/index.ts` (add the barrel export — `packages/components/src/index.ts:85` already re-exports `./hooks`).
- Modified: the three route components listed above.
- Modified: `__mocks__/translation.mock.js`.
- New tests: `packages/components/src/components/route-with-subroutes/__tests__/route-with-subroutes.spec.tsx` (no test file exists for this component today).
- Extended tests: `packages/core/src/App/Components/Routes/__tests__/route-with-sub-routes.spec.tsx` and `packages/reports/src/Components/Routes/__tests__/route-with-sub-routes.spec.tsx` (the latter already asserts both the `Test Title | Default Title` and bare-brand cases at `:80-89`).

**Not changed:**

- `packages/core/src/index.html:243` — the static `<title>Derivatives Trader | Deriv</title>` shell title, overwritten by the first route render.
- Route configs (`packages/core/src/App/Constants/routes-config.js`, `packages/trader/src/AppV2/Routes/routes.tsx`, `packages/reports/src/Constants/routes-config.tsx`). Their `getTitle: () => localize('…')` arrows already resolve at call time; the module-level `routesConfig` memo caches the config object, not the strings.
- `common-store.js`, the language selectors, and `AppContent.tsx`. Reordering `switchLanguage` before `changeSelectedLanguage` would narrow the window but not close it — `i18n.changeLanguage` is asynchronous, so no synchronous ordering fixes this. The event subscription is the only correct trigger.
- The favicon assets and their `<link>` tags.
