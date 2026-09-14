## Context

C5 is the second destructive run of Workstream C (see `proposal.md — Why`), gated on the C0 deletion oracle (`knip:check` + baselines) and C1–C2. The spec is not in this repo; issue [#1270](https://github.com/deriv-com/derivatives-trader/issues/1270) is the authoritative brief, and the issue itself mandates member-by-member re-verification at HEAD. During planning, every path/member below was re-confirmed against HEAD by five parallel audits, which surfaced several **corrections to the brief's premises** that shape this design:

- The two JS `BaseStore` copies are **not** byte-identical — the core copy carries a `retrieveFromStorage` declared-keys fix the reports copy lacks.
- `onRealAccountSignupEnd`/`disposeRealAccountSignupEnd` are **already removed** at HEAD (C1–C2); only the theme-listener machinery is left to strip.
- The `getItem(undefined)` bug is in **both** JS copies, not reports alone; the trader TS copy already avoids it.
- The trader `BaseStore`→`getValidationRules` coupling is **type-only** (`ReturnType<typeof getValidationRules>` at `base-store.ts:9`), not a runtime call — rules are injected via the constructor.
- The trade-store `is_dtrader_v2` getter returns a constant `true` with **no else-arms**, so C5b is ~180 LOC, well below the brief's ~515 (several members the brief assumed dead — `loadActiveSymbols`, `is_trade_enabled`, `contract_types_list`, `exportLayout`, `is_vanilla_fx` — are live at HEAD and kept).
- A latent defect: live code calls the already-removed `client.setPreventRedirectToHub`/`setExternalParams`.

## Goals / Non-Goals

**Goals**

- One shared `BaseStore` in `@deriv/stores`, every subclass repointed, the two JS copies gone, dead machinery stripped, `retrieveFromStorage` hardened.
- Remove the re-verified-dead store surface across trade-store, core stores, trader helpers and reports stores, leaving the tree green after each phase.
- Fix the two reports defects and the orphaned-caller latent bug.
- Ship as an ordered sequence of independently-green phases so a run that stops mid-way leaves a coherent branch; the whole issue is one revert unit (one branch/PR/commit).

**Non-Goals**

- Any product-behavior change. The only behavior deltas are the two reports defect fixes (RSF-001/002) and removing calls to non-existent methods — all corrections toward intended behavior.
- The `archived-statement.tsx` `useState` consolidation (deferred — see the deferral file).
- Touching the generic `BaseStore<T>` / `FeatureFlagsStore` (C7 territory), the theme system, demo top-up, or any KEEP surface listed in the specs.

## Decisions

- **BaseStore lands at `packages/stores/src/base-store.ts`, exported from `src/index.ts` as `BaseStore`.** The pre-existing generic `BaseStore<T>` at `src/stores/BaseStore.ts` is a different class exported only from `src/stores/index.ts` (not the package root), so a package-root `BaseStore` export does not collide, and the distinct filename (`base-store.ts` vs `stores/BaseStore.ts`) is safe even on a case-insensitive filesystem. _Alternative:_ relocate to `@deriv/shared` — rejected; `@deriv/stores` is the store-infrastructure home and already owns `StoreProvider`/`useStore`/`mockStore`.
- **The consolidation target is the trader TS copy**, generalized. It already has `store_name = ''` + `String(getItem(...))` (no `getItem(undefined)`), typed lifecycle and validation. The move: (1) generalize the trader-local `TValidationRules` type (`ReturnType<typeof getValidationRules>`) to a structural/generic validation-rules type so the base imports nothing from trader; subclasses keep passing rules via the constructor `validation_rules` option (already the mechanism — no runtime change). (2) Add `@deriv/shared` to `@deriv/stores`'s dependencies for `isEmptyObject`/`isProduction`/`Validator` (no cycle: `@deriv/shared` does not depend on `@deriv/stores`). (3) Carry core's declared-keys filter into `retrieveFromStorage` so the consolidated store keeps that protection (per the CLAUDE.md `retrieveFromStorage` note) while also never reading an undefined key. _Alternative:_ keep the trader copy in place and shim core/reports to import it — rejected; that points `@deriv/core`→`@deriv/trader`, the wrong dependency direction.
- **`is_dtrader_v2` getter is removed last.** Every reader is collapsed first (guards made unconditional, `processPurchase` param dropped, `useGuideContractTypes` arm dropped); only then are the getter and its `computed` registration deleted, so the tree never references a removed getter mid-phase.
- **`\bmember\b`-grep across all packages before every store-member removal** (inherited from SMC-001). Members reach consumers via `useStore()` destructuring and dynamic `this[name]`, so a dotted `store.member` grep misses real usages. Any member found live is left in place and the discrepancy surfaced.
- **CANDIDATE items ship only if the re-verify holds.** The audits separated CONFIRMED-DEAD from CANDIDATE (write-only observables with possible MobX-reaction side effects, cross-store dedup, the ui-store duration cluster that touches trade-store + persistence). Each candidate task re-verifies at implement time; if a candidate proves live or unsafe, it is skipped and noted, not forced.
- **The orphaned-caller latent bug is fixed in-scope.** Two of the three sites (`client.setPreventRedirectToHub`) live inside the dead ui-store methods and vanish with SMC-014; the third (`common-store.js` `client.setExternalParams` in the `?ext_platform_url=` branch) is a call to an already-removed method that would throw if reached — the dead call is removed. This is a correction toward intended behavior, not a feature change.
- **`knip`/bundle baselines are the shipping gate, not code review** (inherited from C0/§0.2). Deletions shrink `knip-baseline.json`, so it is regenerated (`npm run knip:baseline`) and committed in this PR; `knip:check` + `baseline:check` + `build:all` + `test:jest` + `check-imports` + per-package `tsc` + `test:eslint-all` + `test:scripts` gate each phase.

## Risks / Trade-offs

- **[Moving BaseStore breaks a subclass's storage/validation/lifecycle behavior]** → BSC-001 requires the full jest suite green after repointing; the type-only coupling means no runtime injection change; `check-imports` proves no cycle.
- **[A dynamic/`this[name]` consumer is missed and a "dead" member is actually live]** → every removal re-greps `\bmember\b` across all packages; `build:all` + `test:jest` + `tsc` + `knip:check` catch a broken graph before ship.
- **[A write-only observable removal drops a MobX-reaction side effect]** → CANDIDATE items (contract-store `sell_info`/`is_static_chart`/`is_chart_scaling`, common-store `platform`/`app_router`/`was_socket_opened`, ui-store duration cluster) are re-verified for observer side effects before removal and skipped if any exists.
- **[The sell-flow dedup regresses the portfolio mobile-gating/banner/validation]** → SMC-017 preserves those exact behaviors; if a safe extraction is not achievable the dedup is deferred (a deferral filed) rather than shipped, so no product-behavior change is risked.
- **[`is_dtrader_v2` mid-phase reference error]** → the getter is deleted only after all readers; each phase is independently green.
- **[Run stops mid-IMPLEMENT and ships partial]** → the multi-run protocol: tick `- [x]` the instant a phase lands, never ship a partially-ticked plan, stop at a phase boundary, and file a deferral if remaining work will not fit.
- **[Unbanked knip shrink fails `knip:check`]** → the baseline is regenerated and committed in the same PR (expected direction for a cleanup, per CSN-002).

## Migration Plan

No data or runtime migration — this is deletion of dead code plus two defect fixes and a BaseStore relocation. Rollout is the single squashed commit; rollback is a straight revert (one revert unit). Order: C5a (BaseStore consolidation) first — it shrinks the M1 merge and is the precondition for the store edits that reference the base — then C5b (trade-store), C5c (helpers), C5d (core stores), C5e (reports). Verification per phase: `build:all` + `test:jest` + `check-imports` + per-package `tsc` + `test:eslint-all` + `knip:check` + `baseline:check` + `test:scripts`, with `mockStore`/`types` compiling and the knip diff showing only intended removals.

## Open Questions

The two decision-changing forks (the BaseStore relocation scope/coupling approach, and whether the live-code sell-flow dedup belongs in this cleanup) are resolved in `tasks.md`'s `## Open Questions` block with recommended answers and are already reflected in the specs and tasks above. No remaining unknowns block implementation.
