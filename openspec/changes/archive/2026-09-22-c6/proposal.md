## Why

The modernization audits (Workstream C, tracking [#1019](https://github.com/deriv-com/derivatives-trader/issues/1019)) surfaced 16 small, independent latent bugs in live MobX stores, contract/chart wiring, a route crash-on-arrival, dead observables frozen at their defaults, a per-render perf hot spot, a duplicate module file and package-manifest gaps. Each ships broken today; each is cheap to fix in isolation. This is issue [#1271](https://github.com/deriv-com/derivatives-trader/issues/1271) (C6), gated on the C5 store deep-clean ([#1270](https://github.com/deriv-com/derivatives-trader/issues/1270)). The whole change is **one revert unit** — one branch, one PR, one commit — so reverting merely restores the known-buggy shipped behaviour.

Bugs 10, 11 and 12 were resolved by a human (Nijil, 26 Aug 2026) toward delete/constant-ify rather than rewire — rewiring any of them into a real control is a feature request and out of scope. One of the sixteen (bug 14) was re-verified at HEAD during planning and found **not present as reported** — it becomes a recorded discrepancy, not a code change.

## What Changes

Every path below was re-confirmed against HEAD during planning (evidence in `design.md`). Numbering follows the issue's 16-item checklist.

- **Reports store lifecycle (1–3).** `StatementStore`/`ProfitTableStore` `onUnmount()` overrides SHALL chain `super.onUnmount()` so the base network-status/logout/client-init/theme disposers stop leaking per tab visit; the two response handlers SHALL clear `this.error` on success and reset `is_loading` on the error branch so one transient error no longer bricks the tab; and the unreachable no-filter empty-state branch (dead because `has_selected_date` is effectively always true) SHALL be removed with no change to what users see.
- **Trader positions (4–5).** `PositionsStore.filteredContractTypes` SHALL be registered in `makeObservable` (it is read cross-package from `@deriv/reports`); `clearLimitOrderBarriers` SHALL read `root_store.portfolio.barriers` (the populated source) instead of the never-populated store-own `this.barriers`, so multiplier limit-order chart lines actually clear after purchase.
- **V1/V2 gating (6).** The desktop persisted-strike restore for vanilla Call/Put SHALL run on desktop (drop the `&& root_store?.ui.is_mobile` clause). The dead always-`true` `is_dtrader_v2` getter and its now-unconditional branches SHALL be collapsed and the divergent gating predicates unified — a **refactor**; if the remnant deletion exceeds a reviewable diff it is deferred to its own issue per §0.4.
- **Contract wiring (7–8).** `createBarriersArray` SHALL accept and honour the `is_dark_mode` argument its call sites already pass (dark-mode barrier colour is currently dropped); `contract-replay.tsx` SHALL read `contract_update` from the store that populates it (`contract_replay`) rather than `contract_store`, where it is permanently `undefined`.
- **Core stores (9).** The `ext_platform_url` branch that calls the nonexistent `client.setExternalParams` SHALL no longer throw — the dead, non-functional external-return branch is removed.
- **Dead observables → constants (10, 12).** `is_chart_layout_default`/`is_chart_countdown_visible` (setters have zero callers) SHALL become constants — observables, dead `setChartLayout`/`setChartCountdown` setters, `local_storage_properties` entries and `@deriv/stores` mirrors removed, consumers reading the inlined values. The GTM `chart_asset_info` field SHALL be the constant it always resolves to (`'hidden'`), with the commented-out `is_chart_asset_info_visible` block and its dead `local_storage_properties` string removed.
- **Cookie cluster removal (11).** `setEmail` (no callers) → `email` (always `undefined`) → `setCookieAccount` (never writes) → `has_cookie_account` (permanently `false`) SHALL be deleted whole, its constructor reaction and now-orphaned `getRegion`/`getTrustedDomainName` imports pruned, and its two `email` consumers (`gtm-store` payload field, `app.jsx` Analytics-reset effect) reworked. **Provenance:** deleting the region/client-info cookie writes rests on the human confirmation (Nijil) that no other deriv-com property reads them — recorded in the PR description.
- **Perf (13).** `contract-trade-store` SHALL parse `sessionStorage['trade_store']` once per evaluation instead of up to 4×.
- **Duplicate file (15).** The byte-identical shadowed `LandscapeBlocker/index.tsx` SHALL be deleted (module resolution picks `index.ts`).
- **Manifest hygiene (16).** `@deriv/quill-icons` SHALL be declared in `@deriv/components` and `@deriv/reports`, `@deriv/utils` in `@deriv/reports`, and the three undeclared devDeps required by trader's `build/constants.js` (`stylelint-webpack-plugin`, `webpack-bundle-analyzer`, `eslint-formatter-pretty`) SHALL be declared.
- **Discrepancy, no code change (14).** `toolbar-widgets.tsx` was re-verified: `isDesktopOs()` is called and `isTabletOs` is a boolean constant, so `!isTabletOs` is a valid negation and StudyLegend/Share DO render on real desktop. The reported function-reference-negation bug is **absent at HEAD**; the finding is recorded under `docs/spec-to-pr/findings/`.

**Non-goals (out of scope):** rewiring chart layout/countdown/asset-info into real controls (feature requests); correcting the `Analytics.reset()` semantics beyond preserving current behaviour (deferred); reviving an `ext_platform_url` external-return feature; the broader C5/C7/C8 sweeps.

## Capabilities

### New Capabilities

- `audit-bug-fixes`: The behaviour contract for C6's 16 audit-surfaced fixes — the corrected observable behaviour of each (leak-free reports lifecycle, recoverable reports errors, reactive positions filter, cleared limit-order barriers, desktop strike restore, dark-mode barriers, correct `contract_update` source, crash-free `ext_platform_url`, chart layout/countdown/asset-info as fixed constants with their dead setters gone, the deleted cookie cluster, single-parse contract-trade computeds, the de-duplicated `LandscapeBlocker` module, and complete package manifests), plus the per-fix green gate and the re-verify-at-HEAD discipline (including recording bug 14 as a not-present discrepancy).

### Modified Capabilities

<!-- None. No existing spec in openspec/specs/ covers these stores, contract wiring, chart observables, cookie cluster, perf path, duplicate module or manifests. The store-member deletions (bugs 10, 11) are latent-bug fixes tracked as part of this one revert unit rather than folded into store-member-cleanup (see design.md). -->

## Impact

- **Edited stores:** `packages/reports/src/Stores/Modules/{Statement/statement-store.js,Profit/profit-store.js}`; `packages/trader/src/Stores/Modules/Positions/positions-store.ts`; `packages/trader/src/Stores/Modules/Trading/{trade-store.ts,Helpers/contract-type.ts}`; `packages/core/src/Stores/{contract-store.js,contract-replay-store.js,common-store.js,ui-store.js,client-store.js,gtm-store.js,contract-trade-store.js}`.
- **Edited components/containers:** `packages/reports/src/Components/{empty-trade-history-message.tsx,placeholder-component.tsx}` + `Containers/{statement.tsx,profit-table.tsx}`; `packages/trader/src/Modules/Contract/Containers/contract-replay.tsx`; `packages/core/src/App/app.jsx`.
- **Deleted file:** `packages/core/src/App/Components/Elements/LandscapeBlocker/index.tsx` (shadowed duplicate).
- **Deleted store members (dead):** `is_chart_layout_default`/`is_chart_countdown_visible` + `setChartLayout`/`setChartCountdown` (ui-store); `email`/`setEmail`/`setCookieAccount`/`has_cookie_account` + cookie reaction (client-store); mirrors in `packages/stores/{src/mockStore.ts,types.ts}`.
- **Dependencies added (declared, already resolved via hoist):** `@deriv/quill-icons` → `packages/components/package.json`, `packages/reports/package.json`; `@deriv/utils` → `packages/reports/package.json`; `stylelint-webpack-plugin`, `webpack-bundle-analyzer`, `eslint-formatter-pretty` (devDeps) → `packages/trader/package.json`.
- **Analytics (informational, non-blocking):** the GTM payload's always-`undefined` `email` field (bug 11) and the always-`'hidden'` `chart_asset_info` field (bug 12) carried no live data; their removal/inlining is noted in the PR description for Analytics.
- **Docs:** a findings note for bug 14 under `docs/spec-to-pr/findings/`; a deferral note for the `Analytics.reset()` semantics under `docs/spec-to-pr/deferrals/`.
- **Tests:** co-located regression specs added/extended per fix; new spec files created where a store has none (`contract-store`, `contract-replay-store`, `common-store`, `client-store`, `contract-trade-store`).
