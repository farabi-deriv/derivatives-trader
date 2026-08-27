## Context

See `proposal.md` — Why for the defect and the four-step trace of why the tab title goes stale. Three constraints shape the approach:

1. **Three independent copies of the same write.** `@deriv/core`, `@deriv/components` (for trader AppV2) and `@deriv/reports` each own a `RouteWithSubRoutes` that ends its `<Route render>` prop with `document.title = \`${title} | ${getBrandName()}\``. Fixing one leaves the other two stale; the trade page and the contract-details page are actually rendered by two of them nested.
2. **No writer knows the reports sub-page, and the ordering between writers matters.** On `/reports/*` two `RouteWithSubRoutes` instances are nested — core's `/reports` route renders `@deriv/reports`, which runs its own `<Switch>` — but _both_ declare the same `/reports` path and the same "Reports" title. The sub-pages are resolved further down, by `VerticalTab is_routed` (`vertical-tab-content-container.tsx:60-70`, a plain `<Route>`) on desktop and by `selected_route.component` on mobile, neither of which writes a title. So `/reports/statement` reads "Reports | Deriv" today. Fixing this means giving `Containers/reports.tsx` — the component that already resolves the innermost route via `getSelectedRoute` — a title write of its own, and it must land _after_ the two routers'. Render runs parent-first and `Reports` is a descendant of both, so render-phase writes give the right precedence; React runs effects child-first, so moving the write into `useEffect` **inverts** it and puts all four reports pages back on "Reports | Deriv".
3. **`current_language` is not a usable trigger.** `common.current_language` (MobX) flips _before_ `i18n.changeLanguage` is even called, and `useTranslations().currentLang` (React context state) flips synchronously inside `switchLanguage`, before the bundle downloads. Both are "the user picked a language"; neither is "the translations are ready". The only signal that means the latter is i18next's `languageChanged` event, emitted from the `loadResources` callback after `this.language` is updated (`node_modules/i18next/dist/cjs/i18next.js:1986-1993`).

## Goals / Non-Goals

**Goals:**

- One shared owner of the tab-title string, replacing three copies.
- A trigger tied to _translations ready_, not to _language selected_.
- Byte-identical title output for every existing route except the four reports sub-pages, which move from the parent "Reports" title to their own (spec: _Nested routes resolve to the innermost title_).
- A directly testable mechanism — a test can fire `languageChanged` and assert the resulting title, without depending on undocumented react-i18next internals.

**Non-Goals:**

- Changing when or how the language itself is switched (`common-store.js`, `AppContent.tsx`, the two language selectors stay as-is).
- Introducing a title/head manager dependency (`react-helmet` and friends).
- Making the favicon _image_ language-aware — there is one static icon set and no per-language variant.
- Localizing the static shell title in `packages/core/src/index.html:243`; the first route render replaces it.

## Decisions

### D1 — A shared hook in `@deriv/components`, not three local fixes

`useDocumentTitle(getTitle?: () => string)` in `packages/components/src/hooks/use-document-title.ts`, exported via the existing `src/hooks/index.ts` barrel (which `src/index.ts:85` already re-exports).

`@deriv/components` is the only package all three consumers already depend on (`core`, `trader` and `reports` each list it), it already hosts a `src/hooks/` directory with the same one-concern-per-file shape (`use-previous.ts`, `use-device.ts`), and it already imports `getBrandName` from `@deriv/shared` in `route-with-subroutes.tsx` — so no new package edge is created.

_Alternatives considered._ `@deriv/shared`: no React dependency layer for hooks and no existing hooks directory. `@deriv/api`: has hooks (`useIsRtl`) but is the WebSocket/React-Query package — a document-title hook there is misfiled. Duplicating the fix in all three route components: rejected, it is the duplication that caused the bug to need three fixes.

### D2 — Keep the `document.title` write in the render phase

The hook assigns `document.title` in its body, not in `useEffect`. This is deliberate and is the reason the hook is a hook rather than a `useEffect` one-liner: parent-first render ordering is what lets the deepest caller — `Containers/reports.tsx`, nested inside both `/reports` routers — have the last word, so nested reports routes resolve to the innermost title (spec: _Nested routes resolve to the innermost title_).

_Alternatives considered._

- `useEffect(() => { document.title = ... })` — cleaner React, but effects run child-first, so `/reports/statement` would settle on "Reports | Deriv". Fixing that would need an explicit depth/priority protocol between two packages' routers and the reports container: more machinery than the bug warrants.
- A single top-level title owner in `AppContent` that resolves the deepest matched route itself — would require re-implementing route matching across three route configs owned by three packages.

The trade-off is accepted with eyes open: the write is idempotent, touches only `document.title`, and is already how all three call sites behave today. This is documented in the hook's TSDoc so the next reader does not "clean it up" into an effect.

### D3 — Subscribe to `languageChanged` explicitly, via `instance` from `useTranslations()`

The hook reads `{ instance }` from `useTranslations()` and, in a `useEffect`, registers a listener on `instance.on('languageChanged', …)` that bumps a `useReducer` counter, forcing one re-render — during which the render-phase write recomputes the title from the now-current bundle. The listener is removed on unmount with `instance.off`.

In production this is _partly_ redundant: `useTranslations()` internally calls react-i18next's `useTranslation()`, whose default `bindI18n: 'languageChanged'` already force-updates consumers. The explicit subscription is kept anyway because (a) it makes the fix's mechanism legible and reviewable rather than a side effect of calling a hook for its side effect, (b) it does not depend on a third-party default that a future `react-i18next` config change could flip, and (c) it is what makes the hook unit-testable — a test can hand in a fake emitter as `instance` and fire the event. The cost is at most one extra render per language switch, batched by React 18 with react-i18next's own update.

_Alternatives considered._ Depending on `currentLang` or `instance.language` in a dependency array: both mistime — `currentLang` changes on the _first_ (stale) render and not on the second, so an effect keyed on it would never re-run with the loaded bundle. Adding a MobX `i18n_ready` observable to `common-store`: more moving parts, and the store would still have to subscribe to the same event.

### D4 — Unify the empty-title fallback on `getBrandName()`

`@deriv/reports` writes `getBrandName()` when a route has no `getTitle`; `@deriv/core` and `@deriv/components` skip the write entirely. The hook adopts the reports behaviour (always write; brand name alone when there is no title) because "leave whatever the previous route set" is not a defensible tab title. Every route config in the repo defines `getTitle` (`routes-config.js`, `routes.tsx`, `routes-config.tsx`, including each `route_default`), so no live route changes behaviour; the existing reports test at `route-with-sub-routes.spec.tsx:80-83` already pins this branch.

### D5 — Extend the repo-wide translations mock rather than mock per test

`jest.config.base.js:15` maps `@deriv-com/translations` to `__mocks__/translation.mock.js`, whose `useTranslations()` returns only `{ localize, currentLang }`. Once the route components call `useDocumentTitle`, every test that renders one needs `instance` to exist. Adding `instance` (a minimal i18next-shaped stub with `on`/`off`/`language`) and `switchLanguage` to the shared mock is a single edit that keeps all existing suites working and brings the mock closer to the real hook's return shape. Per-test local mocks would have to be added to every current and future suite that renders a route.

Existing suites that mock `@deriv-com/translations` locally with a partial object (e.g. `packages/core/src/App/Containers/Routes/__tests__/routes.spec.jsx:19`, `packages/api/src/hooks/__tests__/useIsRtl.spec.tsx`) must be checked and topped up where they render a route component — enumerated in `tasks.md`.

## Risks / Trade-offs

- **Render-phase side effect is a React anti-pattern; React 18 StrictMode double-invokes render.** → The write is idempotent (same inputs → same string), so a double invoke is harmless. Documented in TSDoc with the reason (D2) so it is not "fixed" into an effect later. If the app ever moves to concurrent rendering with interruptible renders, a title written by an abandoned render would simply be overwritten by the committed one.
- **Nested-route precedence is behaviour nothing currently tests, so a refactor could silently invert it.** → The spec pins it (_Nested routes resolve to the innermost title_) and `tasks.md` adds an explicit reports-page manual check, a hook test that renders outer-then-inner, and three tests on `Containers/reports.tsx` that fail if its write is removed.
- **Extending the shared translations mock touches every package's test run.** → Additive only (two new fields), no existing field changed. Full `npm run test:jest` is in the task list, not just the focused suites.
- **`instance` may be absent under a partial local mock in some suite, throwing on `instance.on`.** → The hook guards with optional access (`instance?.on`), so a missing instance degrades to "title written once on render" — exactly today's behaviour — rather than a crash.
- **Double render on language switch (explicit listener plus react-i18next's own).** → Accepted; React 18 batches both, and the render does nothing but recompute one string.
- **The trade page's title is written twice (core's router, then trader's).** → Both resolve to the same localized string from different route configs; already true today and unchanged. Flagged in `tasks.md` so a reviewer seeing two writes in a trace knows it is expected.
