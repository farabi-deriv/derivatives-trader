## Why

The cashier, KYC/onboarding, MT5 and multi-account-signup features were extracted out of derivatives-trader upstream, but their remnants remain: an entire dead `@deriv/api-v2` package (~2.7k LOC), nine unused `@deriv/components`, dead KYC/upload utilities in `@deriv/shared`, dead chat (Intercom/WhatsApp/LiveChat) entry points, and ~450 LOC of orphaned members still declared on the live MobX stores. This is issue [#1268](https://github.com/deriv-com/derivatives-trader/issues/1268) (Workstream C, tracking [#1019](https://github.com/deriv-com/derivatives-trader/issues/1019)) — the first destructive cleanup run gated on the C0 safety net ([#1267](https://github.com/deriv-com/derivatives-trader/issues/1267)). It removes ~5,450 LOC of proven-dead code so the codebase reflects only what ships.

## What Changes

- **C1a — kill `@deriv/api-v2`.** Move the one still-used export (`useDebounce`) into `@deriv/api`'s hooks and repoint its 2 consumers (`barrier-input.tsx`, `barrier-content-desktop.tsx`); then delete `packages/api-v2` in full plus trader's dependency entry, its webpack/tsconfig/jest references and root workspace artifacts. Its now-orphaned deps (`md5`, `uuid`) and dead files (`onfido.ts`, `file-utils.ts`, `constants/platforms.ts`) die with it. The live `useRemoteConfig` is `@deriv/api`'s and is unaffected.
- **C1b — delete 9 dead `@deriv/components`** (~2,060 LOC): `Numpad`, `Autocomplete`, `ButtonToggle`, `RadioGroup`, `TickPicker`, `ErrorModal`, `RelativeDatepicker`, `InformationBanner`, `PopoverMessageCheckbox` — each with its directory, `src/index.ts` export line, tests and scss. Remove dead deps `embla-carousel-react` and `react-dropzone` and their transitive orphans (`dropdown-list/`, `utils/helper.js`, `use-onlongpress`, `triangle-warning.webp`).
- **C1c — delete dead KYC/upload utilities in `@deriv/shared`**: `utils/files/`, `utils/config/adapters.ts`, `utils/validation/form-validations.ts` and their barrel re-exports. `risk-disclosure.ts` is regulatory (kept, not KYC).
- **C1d — delete standalone dead core/api files**: `platform-config.ts`, `menu-links.jsx` (+scss+barrel), the `@deriv/api` `usePaginatedFetch` (+spec+barrel), orphan callback assets, stale trader webpack aliases, dead reports externals regex; both dead chat entry points (`WhatsApp/`, `LiveChat/`); `packages/api/src/hooks/useIntercom.ts` in full (both `useIntercom` and `useIsIntercomAvailable`) + its barrel line + the commented-out block in `AppContent.tsx`; `packages/utils/src/chat.ts` (+`Chat` export + spec); the chat scss (`live-chat.scss` + `app.scss` import + two header rules); the `cs_chat_intercom`/`cs_chat_whatsapp` remote-config keys from the `FeatureFlags` interface, `isFeatureFlags` guard and `remote_config.json`; and `usehooks-ts` from `packages/api/package.json`.
- **C1 docs** — update `CLAUDE.md` to drop `@deriv/api-v2`.
- **C2 — store surgery in ACTIVE files** (~450 LOC, sequential, highest care): remove orphaned members from `trader/Stores/Modules/index.ts` (`cashier`), `common-store.js` (`withdraw_url`/`setWithdrawURL`, `setAppstorePlatform`), `ui-store.js` dead modal/signup clusters + their mirrors in `packages/stores/types.ts`/`mockStore.ts`, `base-store.js` (`RealAccountSignupEnd` machinery), `client-store.js` (cashier deep-link `action_param` branch — surgical, shares an array with the live `reset_password` branch), `notification-store.js` (`p2p_order` filter, stale "cashier" copy), `gtm-store.js` (deposit/withdrawal branch — **DELETE**, decided 26 Aug 2026), and route constants `callback_page`/`error404`.

**Non-goals (explicitly out of scope, reserved elsewhere):** the rest of `common-store` platform cluster (C5); the `FeatureFlagsStore`/`useFeatureFlags` subsystem (C7); demo top-up, `is_try_real_modal_visible`/`toggleTryRealModal`, account-status trade gating, `risk-disclosure`, and intentional external Deposit/"Try real" redirects — all verified live and **kept**.

## Capabilities

### New Capabilities

- `dead-code-removal`: The contract for C1's whole-unit deletions — which packages, components, utilities, chat surfaces and dependencies are removed, the do-not-touch live surfaces that must survive, the per-unit re-verification requirement, and the green-gate (`bootstrap` + `build:all` + `test:jest` + `check-imports` + `knip:check` all pass, zero `api-v2`/chat references repo-wide).
- `store-member-cleanup`: The contract for C2's store surgery — which orphaned MobX store members, their `packages/stores` type/mock mirrors, and route constants are removed; the member-grep verification method (`\bmember\b` across all packages, not dotted access); and the live members deliberately preserved.

### Modified Capabilities

<!-- None: openspec/specs/ contains no existing spec covering these packages, components, stores or utilities. -->

## Impact

- **Deleted package:** `packages/api-v2` (whole workspace) + root `package.json` workspace/`package-lock.json` artifacts.
- **Dependencies removed:** `md5`, `uuid` (with api-v2); `embla-carousel-react`, `react-dropzone` (`@deriv/components`); `usehooks-ts` (`@deriv/api` only — `@deriv/components`' copy stays for `use-device.ts`/`video-player.tsx`).
- **Deleted directories/files:** 9 component dirs under `packages/components/src/components/`, `packages/shared/src/utils/{files/,config/adapters.ts,validation/form-validations.ts}`, `packages/core/src/App/Components/Elements/{WhatsApp,LiveChat}/`, `packages/api/src/hooks/useIntercom.ts`, `packages/api/src/usePaginatedFetch.ts` (+spec), `packages/utils/src/chat.ts` (+spec), `packages/core/src/App/Constants/platform-config.ts`, `packages/core/src/App/Components/Layout/Header/menu-links.jsx` (+scss).
- **Edited barrels/config:** `packages/components/src/index.ts`, `packages/shared/src/utils/index.ts` (and sub-barrels), `packages/api/src/{index.ts,hooks/index.ts}`, `packages/utils/src/index.ts`, trader/reports webpack + tsconfig + jest configs, `packages/api/src/remote_config.json`, `packages/core/src/types/feature-flags.ts`.
- **Edited stores + mirrors:** `packages/core/src/Stores/{common-store,ui-store,base-store,client-store,notification-store,gtm-store}.js`, `packages/trader/src/Stores/Modules/index.ts`, `packages/stores/types.ts`, `packages/stores/mockStore.ts`, `packages/shared/src/utils/routes/routes.ts`.
- **Edited styles:** `packages/core/src/sass/app.scss`, `packages/core/src/sass/app/_common/components/live-chat.scss` (deleted), `packages/core/src/sass/app/_common/layout/header.scss` (two rules).
- **Docs:** `CLAUDE.md`.
- **Analytics (informational, non-blocking):** the `gtm-store` deposit/withdrawal branch deletion is noted in the PR description to inform Analytics; the events already stopped arriving when cashier was extracted.
