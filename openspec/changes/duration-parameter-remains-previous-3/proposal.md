## Why

On desktop, switching the app language leaves the **Duration** chip in the trade Parameters panel showing the previous language — `10 ticks` stays `10 ticks` instead of becoming `10 Ticks`/`10 tiques`/etc. — until the user manually refreshes the page ([issue #960](https://github.com/deriv-com/derivatives-trader/issues/960)). Every neighbouring label re-translates immediately, so the stale chip reads as a broken language switch on the most-used control of the trade page. Mobile is unaffected.

The desktop Duration component renders its displayed text with the **module-level** `localize` from `@deriv-com/translations` and is subscribed to nothing but MobX:

1. `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-desktop.tsx:6` imports `localize` as a bare function. That export is `i18next.t(hash, { defaultValue })` evaluated at call time (`node_modules/@deriv-com/translations/dist/utils/localize.js`) — correct on any _fresh_ render, but it carries no React subscription of its own.
2. `DurationDesktop` is wrapped only in `observer()` (`:267`). Its displayed value comes from `getDisplayValue()` (`:512-584`) via `formatTickValue`/`formatSecondsValue`/`formatMinutesValue` (`:470-495`), all called during render. Nothing in that path is bound to i18next.
3. `changeSelectedLanguage` (`packages/core/src/Stores/common-store.js:94-118`) clears the socket cache, rewrites the `lang` URL parameter, sets the dayjs locale and flips the MobX observable `current_language`. **It never touches i18next.** i18next is changed afterwards by the caller's `switchLanguage(lang)` (`packages/trader/src/AppV2/Components/Layout/Sidebar/language-selector.tsx:20-21`), which is asynchronous — `languageChanged` is emitted only once the new bundle has downloaded.
4. `TradeDesktop` is an `observer` that reads `common.current_language` (`packages/trader/src/AppV2/Containers/Trade/trade-desktop.tsx:40`), so the observable flip _does_ re-render the whole params panel — but at step 3's midpoint, while i18next is still on the old language. The stale string is written then, and no later signal re-renders the chip. This is the same trap already documented for the browser tab title in `packages/components/src/hooks/use-document-title.ts:25-30` (issue #951): `common.current_language` and `useTranslations().currentLang` both flip _before_ the translations are available, so neither is a usable trigger.

Mobile is unaffected for exactly the complementary reason: `duration.tsx:81` takes `localize` from `useTranslations()`, whose underlying react-i18next `useTranslation()` force-updates its caller on `languageChanged` (`node_modules/react-i18next/dist/es/defaults.js:3` — `bindI18n: 'languageChanged'`, react-i18next 17.0.8). The desktop path is the only one missing that subscription.

The same defect exists on one sibling chip in the same panel — **Risk management**, whose `DC: 5 minutes` value is built with the bare `localize('minutes')` at `RiskManagement/risk-management-desktop.tsx:85` — which is what the issue means by "some related content in the Parameters section".

## What Changes

- **Bind the desktop Duration parameter to i18next.** `duration-desktop.tsx` takes `localize` from `useTranslations()` instead of the module import, so a completed language change re-renders it. The memoised formatters and `getDisplayValue` gain `localize` in their dependency arrays — without that they keep returning the closure captured at the previous language and the re-render changes nothing.
- **Bind the desktop Risk management parameter the same way.** `risk-management-desktop.tsx`'s `getRiskManagementText` uses the hook's `localize` and lists it as a dependency, so `DC: 5 minutes` re-translates in place.
- **Remove the one mount-time string cache inside the Duration parameter.** `duration-unit-selector.tsx:21-30` freezes its five unit labels (`Ticks`/`Seconds`/`Minutes`/`Hours`/`End time`) in a `useMemo(..., [])`, so they can never be re-derived for the lifetime of the component. Today the popover unmounts on close (`AppV2/Components/InputPopover/input-popover.tsx:38`) so it self-heals — this closes the latent trap rather than fixing a currently-visible symptom, and is stated as such.
- **Add regression tests** that fire i18next's `languageChanged` (via the existing `fireLanguageChanged` helper in `__mocks__/translation.mock.js`) and assert both chips re-render with the new language's text — plus a test that the _early_ `current_language` flip alone does not leave them stale.
- **Not changed:** the mobile `duration.tsx` path (already correct), the `<Localize>`-rendered chip labels (`withTranslation`-subscribed, already correct), the trade store and `duration_units_list` (its `text` field is never rendered in AppV2 — verified: every AppV2 read destructures `value` only), and the components that live _inside_ the Duration popover, which unmount on close and therefore re-derive their strings on the next open.
- No API, dependency, store or styling change. No **BREAKING** change.

## Capabilities

### New Capabilities

- `trade-params-localization`: how the desktop trade Parameters panel keeps its rendered parameter text in sync with the user's chosen language — which parameters must re-translate without a page refresh, and on which signal (translations loaded, not language selected).

### Modified Capabilities

None. `duration-end-time-fields` (the only existing Duration spec) covers the mobile End time trigger fields' iconography and is untouched by this change.

## Impact

**Code**

- `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-desktop.tsx` — hook-sourced `localize`, dependency arrays.
- `packages/trader/src/AppV2/Components/TradeParameters/Duration/duration-unit-selector.tsx` — drop the empty-dependency label memo.
- `packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/risk-management-desktop.tsx` — hook-sourced `localize`, dependency array.

**Tests**

- `packages/trader/src/AppV2/Components/TradeParameters/Duration/__tests__/duration.spec.tsx` — already renders `DurationDesktop`; gains a language-switch block.
- New `packages/trader/src/AppV2/Components/TradeParameters/RiskManagement/__tests__/risk-management-desktop.spec.tsx` — no spec exists for this component today.
- No change needed to `__mocks__/translation.mock.js`: `instance`, `fireLanguageChanged` and the global `resetTranslationMock` (`setupTests.js:32-34`) already exist, added by the issue #951 fix.

**Docs**

- `CLAUDE.md` gains a Gotchas entry recording that desktop trade-parameter components which render text through `localize` must source it from `useTranslations()`, and why `current_language`/`currentLang` are the wrong trigger.

**Not affected**

Trade store, WebSocket/proposal flow, routing, bundle size, mobile AppV2, `@deriv/shared`'s `getUnitMap` (a call-time function, already correct).
