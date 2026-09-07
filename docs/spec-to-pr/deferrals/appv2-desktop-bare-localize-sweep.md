# Deferred: AppV2 desktop components outside the trade Parameters panel still render text through the unsubscribed `localize`

## What was deferred

The change `duration-parameter-remains-previous-3` fixes the stale-after-language-switch defect only for the desktop **trade Parameters panel** — `Duration/duration-desktop.tsx`, `Duration/duration-unit-selector.tsx` and `RiskManagement/risk-management-desktop.tsx`. It does **not** fix the same defect class elsewhere in AppV2, where a component renders user-visible text with the module-level `localize` from `@deriv-com/translations` while being subscribed to nothing that fires when i18next finishes a language change.

Known sites carrying user-visible text (not exhaustive; `rg -l "localize\(" packages/trader/src/AppV2` lists ~40 files, most of which are utilities, `aria-label`s, or components that unmount when their flyout/action sheet closes and therefore self-heal):

- `packages/trader/src/AppV2/Components/Layout/PositionsDrawer/positions-drawer-closed-content.tsx:100` — `closed position` / `closed positions` in the desktop positions drawer, which stays mounted across a language switch.
- `packages/trader/src/AppV2/Components/CompactHeader/compact-header.tsx:83` — the `Log in` button text shown to logged-out users.
- `packages/trader/src/AppV2/Components/ChartMaximizeButton/chart-maximize-button.tsx:32` and `packages/trader/src/AppV2/Components/MarketTabs/market-tabs.tsx:82,314,316,326` — `aria-label`s and disabled-reason strings; not visually stale, but stale to assistive technology.

Carries the same hazard this change hardened against, and must stay **in** the sweep: `packages/trader/src/AppV2/Components/TradeParameters/Barrier/barrier-type-selector.tsx:24-33` is structurally the pre-fix `duration-unit-selector.tsx` — module-level `localize`, labels built in `useMemo(…, [support])`, rendered through the same `VerticalTabSelector`, reached from `barrier-desktop.tsx:32` via `TradeParameterPopover`. Unmount-on-close does **not** clear it: per D3, the defect that survives is a later `React.memo` on the component or an ancestor severing the re-render cascade while the popover is open, which no remount-on-open protects against.

Already safe, and recorded here so a follow-up does not re-audit them: `packages/trader/src/AppV2/Components/Layout/Sidebar/sidebar.tsx` calls `useTranslations()` at `:40` (for `currentLang`), so its `localize`-built menu labels re-derive on the same re-render; and the whole mobile Duration path takes `localize` from `useTranslations()` (`Duration/duration.tsx:81`). Components rendering inside `InputPopover` are safe only from the **stays-mounted** form of the defect — `input-popover.tsx:38` renders `null` while closed, so they remount on each open — and remain exposed to the `React.memo` hazard above; classify them on that basis, not as blanket-safe.

## Why

Issue #960 reports the Duration field and its immediate neighbours in the Parameters section, and only on desktop. Widening the change to every AppV2 call site would mean auditing ~40 files whose stale-language behaviour is unverified against a reproduction, mixing a11y-only strings and non-component utilities into a targeted bug fix, and reviewing a diff far larger than the defect. The per-file cost is low but the verification cost is not — each site needs its own "does this component stay mounted across a switch?" answer.

## Follow-up required

A future change should sweep AppV2 (and, by the same argument, `@deriv/core`'s desktop shell) for the pattern and eliminate it systematically:

1. Enumerate every component that renders a string produced by the **module-level** `localize` import from `@deriv-com/translations`, and classify each as (a) stays mounted across a language switch → defect, (b) unmounts with its flyout/sheet → safe from the stays-mounted defect only, (c) already calls `useTranslations()` → safe. Treat (b) as still requiring the fix wherever a `React.memo` on the component or an ancestor could sever the cascade while it is open — that is what D3 hardened `duration-unit-selector.tsx` against, and `barrier-type-selector.tsx` is the known outstanding instance.
2. For each (a) — and each (b) meeting the memo criterion — take `localize` from `useTranslations()`, **pin its identity**, and list the pinned value in every `useMemo`/`useCallback` dependency array that closes over it:

    ```ts
    const { localize: localizeForLanguage, instance } = useTranslations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const localize = useCallback(localizeForLanguage, [instance.language]);
    ```

    All three steps are required. The subscription alone leaves memoised callbacks holding the previous language's closure; listing the _raw_ hook value fixes that but memoises nothing, since the hook returns a fresh identity every render — `exhaustive-deps` is satisfied either way and gives no signal, so this cannot be caught by lint. The reference implementations are `Duration/duration.tsx` (mobile) and, after `duration-parameter-remains-previous-3`, `Duration/duration-desktop.tsx` and `RiskManagement/risk-management-desktop.tsx`.

3. Do **not** use `common.current_language` or `useTranslations().currentLang` as the trigger — both flip before the Crowdin bundle has downloaded, so text derived at that moment is still the old language. See `packages/components/src/hooks/use-document-title.ts:25-30` (issue #951) for the full explanation.
4. Consider whether a mechanical guard is worth it at that scale — for example an ESLint rule (or a `no-restricted-imports` entry) that flags the module-level `localize` inside `packages/*/src/**/*.tsx` component bodies, with an allowance for `aria-label`s and non-render call sites. `duration-parameter-remains-previous-3` deliberately skipped this for two call sites (design.md, Non-Goals); it becomes worthwhile once the sweep establishes how many legitimate exceptions exist.
5. Add regression coverage in the same shape as that change's: fire the shared `fireLanguageChanged(lang)` helper from `__mocks__/translation.mock.js` and assert the visible text re-renders. The helper and the global `resetTranslationMock` (`setupTests.js:32-34`) already exist.

**Tracked:** https://github.com/deriv-com/derivatives-trader/issues/1342
