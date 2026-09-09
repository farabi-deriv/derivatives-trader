## Why

`@deriv/shared` is the last large reservoir of dead code left by the C1–C2 extraction sweep (`dead-code-removal`, DCR-001…DCR-008). It still carries ~1,700 lines that nothing outside the package references: whole files (`clone.js`, `analytics.ts`, `src/loaders/`), dead exports across `object`/`url`/`brand`/`browser`/`route`, thirteen dead validation rules with their KYC validators, ten trade-type configs for types the platform permanently filters out, a byte-identical copy of `market-icons.ts` in `@deriv/trader`, and a FeatureFlags store subsystem whose flag set is empty — so `getContractTypeFeatureFlag` always returns `''`, `filterDisabledPositions` always returns `true`, and three position stores run a filter that filters nothing.

This is the C7 slice of GitHub issue [#1272](https://github.com/deriv-com/derivatives-trader/issues/1272) (depends on C1–C2, already merged). The FeatureFlags decision was settled on 26 Aug 2026 (Nijil): **delete** — there is no populate path. The C7e cut was approved the same day, limited to the `getContractTypesConfig` entries.

## What Changes

- **C7a — whole files and directories (717 LOC measured).** Delete `utils/object/clone.js`, `utils/analytics/analytics.ts`, `src/loaders/`, `utils/constants/translation-flag.tsx`, `utils/digital-options/`, `utils/location/`, `utils/validation/regex-validation.ts`, `utils/constants/error.ts`, and the five barrel lines that point at them.
- **C7b — dead exports and entries (~115 LOC).** Remove 4 dead `object.ts` exports, 4 dead `url/helpers.ts` exports, `url.ts`'s `legacyUrlForLanguage`, 7 dead `brand.ts` exports, `browser_detect.isSafari`, `route.tsx`'s `isRouteVisible`, the 12 dead `getCardLabels`/`getCardLabelsV2` entries (6 names × 2 maps), and 3 dead SCSS variables in `styles/constants/layout.scss`. De-export the symbols that survive only as intra-file helpers.
- **C7c — FeatureFlags subsystem removed end-to-end (~400 LOC across shared/stores/api/core/trader).** Deletes `packages/stores/src/stores/` in full (`FeatureFlagsStore.ts` + its only client `BaseStore.ts`), `TStores.feature_flags`, `useFeatureFlags`, both name-shadowed `FeatureFlagsSection` components in core, and shared's no-op trio. **BREAKING for `useStore()` consumers:** `feature_flags` is no longer a member of `TStores`. **Behaviour change:** open positions, statements and the profit table are no longer passed through `filterDisabledPositions` — a filter that has been a constant `true` for every position, so the rendered set is unchanged.
- **C7d — validation-rules completion (~160 LOC, one atomic deletion).** 13 dead `initPreBuildDVRs` entries, their 8 KYC validators plus 5 private helpers, 12 dead `TFormErrorMessagesTypes` keys, and the matching entries in core's `FORM_ERROR_MESSAGES`. The `Validator` mechanism and the live `req`/`number`/`barrier`/`custom` rules stay.
- **C7e — approved cut only (~75 LOC).** Delete the 10 `getContractTypesConfig` entries for the permanently-filtered trade types, and follow the cascade into `getContractCategoriesConfig` (two categories go empty). All 38 `tradeTypeIcons` keys, the `icon-trade-types.tsx` switch arms, `trade-categories.tsx` descriptions and `unsupported_contract_types_list` are a settled **KEEP**.
- **C7f — consolidation (~234 LOC).** Delete `packages/trader/src/AppV2/Utils/market-icons.ts` (byte-identical to shared's) and repoint its single importer. **The `mockContractInfo` fixture relocation is deferred** — see `docs/spec-to-pr/deferrals/`.
- **C7g — cascade (~6 LOC).** Delete the two `signup_query_param` read branches; nothing writes that key.
- **Verification.** Regenerate and commit `docs/baselines/knip-baseline.json` and `docs/baselines/alias-usage.json`; add `.spec-to-pr/` to `.gitignore`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dead-code-removal`: adds the C7 `@deriv/shared` sweep requirements (DCR-009…DCR-019) and amends DCR-007, whose "reserved for C7" carve-out for the `FeatureFlagsStore`/`useFeatureFlags` subsystem is discharged here.

## Impact

**Packages touched:** `@deriv/shared` (primary), `@deriv/stores`, `@deriv/api`, `@deriv/core`, `@deriv/trader`, `@deriv/reports`.

**Dependencies:** `mobx-persist-store` is removed from `packages/stores/package.json` (its only importer, `BaseStore.ts`, is deleted). **`mobx` stays** — `packages/stores/src/index.ts:1` exports `observer` from `mobx-react-lite@3.4.3`, which declares `mobx ^6.1.0` as a peer dependency.

**Public API:** `@deriv/shared`'s barrel loses ~30 exports; `@deriv/api` loses `useFeatureFlags`; `@deriv/stores` loses `TStores.feature_flags` and the `stores/` sub-barrel.

**Docs:** `packages/stores/README.md` and `packages/api/README.md` lose their FeatureFlags/`useFeatureFlags` sections.

**Not touched (verified live at HEAD `aa81abf71c`):** `error-mapping/`, `storage.ts`, `helpers/` (except `filterDisabledPositions`), `trade-url-params-config.ts`, all 38 `tradeTypeIcons` keys, `getMarketNamesMap`, `WS`/`setWebsocket`/`useWS`, `risk-disclosure.ts`, `Validator`/`getPreBuildDVRs`/`initFormErrorMessages`, `packages/core/src/types/feature-flags.ts` and `packages/core/src/Utils/Analytics/index.ts` (the unrelated RudderStack/PostHog remote-config gating).
