## Context

See `proposal.md` → _Why_ for the defect and its mechanism. The design-relevant constraints:

- `@deriv-com/translations` exposes two translators. The **module export** `localize(str, values)` is `i18next.t(crc32(str), { defaultValue: str })` (`node_modules/@deriv-com/translations/dist/utils/localize.js`) — it reads the language at call time and carries no React subscription. The **hook** `useTranslations()` (`dist/hooks/use-translations.js`) wraps react-i18next's `useTranslation()`, so its `localize` both translates and force-updates the calling component; `useTranslation()` binds to `languageChanged` by default (`node_modules/react-i18next/dist/es/defaults.js:3`, react-i18next 17.0.8).
- The `<Localize>` component is `withTranslation()(…)` (`dist/components/localize.js`), which is why the chip _labels_ already re-translate correctly and only the _values_ are stale.
- A language switch has two distinct moments, and they are not the same instant: `changeSelectedLanguage` flips the MobX `common.current_language` (`packages/core/src/Stores/common-store.js:94-118`), and only afterwards does the caller run `switchLanguage(lang)` → `i18n.changeLanguage` → async bundle load → `languageChanged` (`packages/trader/src/AppV2/Components/Layout/Sidebar/language-selector.tsx:19-23`). `packages/components/src/hooks/use-document-title.ts:25-30` already documents, from issue #951, that the first moment is too early to derive translated text from.
- `TradeDesktop` is an `observer` reading `common.current_language` (`packages/trader/src/AppV2/Containers/Trade/trade-desktop.tsx:40`), so the Parameters panel _does_ re-render at that first, too-early moment. Any fix that relies on "something re-renders it eventually" is therefore already disproved by the bug report.
- `duration_units_list` needs no change: its `text` field is never rendered in AppV2 — every read destructures `value` (`duration-desktop.tsx:297`, `trade-params-utils.tsx:381,474,663`), and mobile takes its unit words from `getUnitMap()` in `@deriv/shared`, a call-time function.
- The test harness already has what this needs: `__mocks__/translation.mock.js` exports an i18next-shaped `instance` plus a `fireLanguageChanged(lang)` helper, reset globally by `setupTests.js:32-34`. Both were added by the issue #951 fix; no mock changes are required.

## Goals / Non-Goals

**Goals**

- Make the desktop Duration and Risk management parameter values re-derive on `languageChanged`, using the pattern the mobile Duration path already uses, so the two breakpoints stop diverging.
- Keep the fix legible: a reader must be able to see _why_ the hook is used rather than the module import, and why the MobX language observable is not the trigger.
- Leave a regression guard that fails if the subscription (or the dependency wiring that makes it effective) is removed.

**Non-Goals**

- No shared abstraction (a `useLocalizedTradeParam` hook, a localization HOC, an ESLint rule banning the module-level `localize` in components). Two call sites do not justify one, and a rule would need a whitelist for every legitimate non-render use (`aria-label`s, snackbar strings, `@deriv/shared` helpers).
- No sweep of the rest of AppV2 desktop. Other bare-`localize` sites outside the Parameters panel are deferred; see `docs/spec-to-pr/deferrals/appv2-desktop-bare-localize-sweep.md`.
- No change to how a language switch itself is sequenced. Reordering `changeSelectedLanguage`/`switchLanguage` in `language-selector.tsx` would touch every consumer of `current_language`; the per-component subscription is correct regardless of that ordering.

## Decisions

### D1 — Source `localize` from `useTranslations()` in the affected components

`duration-desktop.tsx` and `risk-management-desktop.tsx` replace the module-level `localize` import with `const { localize } = useTranslations();`.

_Why:_ it fixes the cause (no i18next subscription) with the mechanism the repo already uses for the working mobile twin (`duration.tsx:81`), and the hook's return value is genuinely consumed — so nobody later "tidies away" a hook call that appears to do nothing. `Localize` stays as-is for the chip labels; there is no reason to convert JSX that already works.

_Alternatives:_

- **Call `useTranslations()` and discard the result**, keeping the module `localize`. This actually works — the module `localize` reads i18next at call time, so a `languageChanged`-driven re-render is sufficient on its own. Rejected because the fix then reads as dead code and silently depends on react-i18next's `bindI18n` default staying `'languageChanged'`. (The same trade-off was weighed in the issue #951 change; the explicit form won there too.)
- **Subscribe to `instance.on('languageChanged', …)` by hand**, as `use-document-title.ts` does. Justified there because the hook writes `document.title` during render and needed a hand-rolled force-update; here `useTranslations()` already provides exactly that re-render, so hand-rolling it is redundant machinery.
- **`key={currentLang}` remount**, the pattern at `packages/reports/src/Containers/statement.tsx:234`. Rejected twice over: `currentLang` flips before the bundle loads (so the remount happens at the wrong moment), and remounting `DurationDesktop` destroys its `selectedUnit`/`selectedDuration`/`activeTab` local state.
- **A MobX reaction in `TradeStore` on `current_language`.** Wrong layer (display formatting is not store state) and wrong trigger, for the same reason.

### D2 — Add `localize` to the dependency arrays that close over it

`formatTickValue`, `formatSecondsValue`, `formatMinutesValue`, `formatHoursValue` and `getDisplayValue` in `duration-desktop.tsx`, and `getRiskManagementText` in `risk-management-desktop.tsx`, must list `localize`.

_Why this is not optional:_ the hook's `localize` is a fresh arrow function per render (`dist/hooks/use-translations.js`), closing over that render's react-i18next `t`. A `useCallback` whose dependency array omits it keeps returning the closure built at the previous language, so the component would re-render on `languageChanged` and still produce the old string — the subscription alone does not fix the bug. `packages/reports/src/Containers/archived-statement.tsx:184` sets the same precedent (`[raw_data, localize, current_language]`).

_And why the raw hook value is not what gets listed:_ that identity changes every render, so listing it directly would leave these `useCallback`s memoising nothing and `DurationPopoverContent`'s `config` `useMemo` (which lists the formatters) rebuilding its five object literals and five JSX elements on every render — re-rendering the whole datepicker on any unrelated update while the popover is open. Both files therefore pin it first:

```ts
const { localize: localizeForLanguage, instance } = useTranslations();
// eslint-disable-next-line react-hooks/exhaustive-deps
const localize = useCallback(localizeForLanguage, [instance.language]);
```

and list the **pinned** value in the dependency arrays. This is correct because i18next assigns `this.language` before it emits `languageChanged`, so on the render that event triggers, `instance.language` already holds the new value: the dep invalidates on exactly the renders where `t` changes language, and on no others. Shadowing the raw hook value as `localizeForLanguage` also means neither file can regress by accident — the unpinned identity is not in scope to be listed. Note `exhaustive-deps` is satisfied by the unpinned shape too, so it gives no signal here; the suppression above is deliberate, since listing `localizeForLanguage` would restore the churn.

### D3 — Make the unit selector self-sufficient: hook-sourced `localize`, no memos

`duration-unit-selector.tsx` takes `localize` from `useTranslations()` and computes its five unit labels — and the `availableUnits` filter derived from them — inline, with no `useMemo` at all.

_Why the hook:_ an earlier revision left the module-level `localize` here and relied on the ancestor `DurationDesktop` re-rendering on `languageChanged` and cascading a fresh render down through `DurationPopoverContent`. That works, but nothing in this file enforces the coupling: a later perf pass wrapping this component (or its parent) in `React.memo` — a natural-looking change, since its props are primitives and a small array — would stop the cascade and silently reintroduce #960 here with no compiler or lint signal. Sourcing `localize` from the hook gives the component its own subscription, so its correctness is self-contained. This is verified, not assumed: with `React.memo` applied, TPL-004 passes on the hook version and fails on the module-level version.

_Why no memos:_ five string lookups per render need no memo, and an empty dependency array around `localize()` is the one shape in this component tree that stays stale even when the component _does_ re-render. The derived `DURATION_UNITS` filter also drops its `useMemo`: once the label array is rebuilt each render, a memo listing that array as a dependency recomputes every render regardless of `availableUnits`, so it costs a comparison for zero benefit and misleads the next reader about what is cached.

_Honest scope note:_ the stale-label defect is latent, not currently visible. `InputPopover` returns `null` when closed (`AppV2/Components/InputPopover/input-popover.tsx:38`), so the selector unmounts on close and re-derives its labels on the next open; `VerticalTabSelector` additionally renders its `label` prop through `<Localize>`. It is fixed because a frozen mount-time string is the one shape that would stay stale if the popover were ever kept mounted, and because the hook removes the silent-failure mode described above.

### D4 — Test by firing `languageChanged`, with a shared language-aware translator

The existing global mock's `localize` is identity-like (`mockFn` returns the default text with values interpolated), so it cannot express "the same key in two languages". Each new spec therefore layers a `jest.mock('@deriv-com/translations', …)` that spreads the shared mock and swaps `useTranslations().localize` for one that prefixes by the stubbed `instance.language`, then drives the switch with the shared `fireLanguageChanged('ES')`.

That layer is factored into `__mocks__/language-aware-translations.mock.js` (`createLanguageAwareTranslationsMock()`) rather than duplicated in each spec, so the two specs' language-switch semantics cannot drift apart as one is edited. It is `require`d lazily inside the `jest.mock` callback because `jest.mock` is hoisted above imports. It is deliberately _not_ wired into `jest.config.base.js` — see below.

_Why not extend the global mock:_ `translation.mock.js` is mapped into every package by `jest.config.base.js`; making its `localize` language-dependent would perturb hundreds of unrelated assertions that match on English default text. The new helper is therefore opt-in per spec — a shared factory, not a new default.

_Red evidence (per `.buildwright/framework/tdd-evidence.md`):_ the same specs must be run against unmodified source first and observed failing — the assertion after `fireLanguageChanged` reports the English string. That is the bug itself, not a missing module, so it is a genuine red rather than a compile error.

## Risks / Trade-offs

- **[The re-render is now driven by an upstream library default]** → `useTranslations()` inherits react-i18next's `bindI18n: 'languageChanged'`. Mitigation: the regression tests fire `languageChanged` on the mocked `instance` and assert the visible text, so a default change surfaces as a failing test in this repo rather than as a silent reappearance of the bug. Version pinned and recorded in the tasks.
- **[Lost memoisation causes extra renders in the Duration popover]** → see D2. Mitigation: the recomputed work is five object literals; the popover is open only while the user is interacting with it. If profiling ever shows this matters, the fix is a stable `localize` from the provider, not reverting the dependency arrays.
- **[Un-hooked siblings still exist elsewhere in AppV2 desktop]** → the panel is fixed but the pattern is not eliminated repo-wide. Mitigation: the CLAUDE.md gotcha entry records the rule for the next author, and the deferral file names the remaining sites so the sweep is actionable.
- **[Locale-sensitive plural rules]** → the display code chooses singular/plural in JS (`value === 1 ? localize('tick') : localize('ticks')`) rather than through i18next's plural machinery. That predates this change and is unchanged by it; languages with more than two plural forms will still be approximate. Out of scope, and not the reported defect.

## Migration Plan

None required — a behaviour fix in three presentational components with no data, storage, API or contract change. Rollback is a revert of the change; a revert restores the previous (stale-text) behaviour and nothing else.
