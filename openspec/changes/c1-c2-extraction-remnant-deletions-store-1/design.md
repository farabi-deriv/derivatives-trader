## Context

This change is the first destructive run of Workstream C (dead-code cleanup, tracking [#1019](https://github.com/deriv-com/derivatives-trader/issues/1019)). It depends on C0 ([#1267](https://github.com/deriv-com/derivatives-trader/issues/1267)), which committed the deletion oracle: a `knip` baseline, a bundle baseline and structural snapshots, plus `knip:check`/`baseline:check` wired into CI. That oracle — not code review — is the shipping gate here (§0.2 of the brief). C1 and C2 were merged into one issue deliberately to reduce issue count, accepting that a single `spec-to-pr` run may not finish IMPLEMENT (~5,450 LOC across 20 items). The whole issue is one revert unit: one branch, one PR, one commit.

The spec file for the programme is **not** committed to this repository; the issue body ([#1268](https://github.com/deriv-com/derivatives-trader/issues/1268)) is the authoritative brief and every path below was re-confirmed against HEAD during planning.

## Goals / Non-Goals

**Goals:**

- Remove ~5,000 LOC of whole-unit dead code (C1: `@deriv/api-v2`, 9 components, KYC utils, chat surfaces, standalone core/api files) and ~450 LOC of orphaned store members (C2), leaving the tree green after each phase.
- Ship as an ordered sequence of independently-green phases so a run that stops mid-way leaves a coherent branch.
- Preserve every verified-live surface listed in the brief's "Do-NOT-touch".

**Non-Goals:**

- The rest of the `common-store` platform cluster (reserved for C5).
- The `FeatureFlagsStore`/`useFeatureFlags` subsystem (reserved for C7) — only the remote-config chat _gating keys_ are removed here.
- Any product-behaviour change: this is deletion of proven-dead code, not a refactor of live behaviour.

## Decisions

- **Order C1 before C2, whole-unit deletions before store surgery.** C1's deletions are disjoint files with clear import graphs; C2's edits are the most delicate in the programme (surgical branch edits sharing arrays with live code). Doing the safe bulk first keeps the risky, small edits isolated at the end where a stop-boundary is cleanest. _Alternative:_ interleave by subsystem — rejected; it entangles green-gates and muddies the revert unit.
- **C1a is atomic: move `useDebounce` first, then delete `api-v2`.** Deleting `packages/api-v2` before repointing `barrier-input.tsx`/`barrier-content-desktop.tsx` would break the build mid-phase. The move + repoint + delete land as one phase so the tree is green at the boundary. _Alternative:_ leave `useDebounce` in a shim — rejected (YAGNI; leaves a second dead package).
- **Member-grep with `\bmember\b` across all packages for C2.** Store members reach consumers via `useStore()` destructuring and dynamic `this[name]` assignment, so a `store.member` dotted grep misses real usages. Every C2 removal re-greps word-boundary across the monorepo immediately before deleting. _Alternative:_ trust the audit list — rejected; the brief mandates re-verification at HEAD.
- **`knip:check` + `build:all` are the gate, not code review.** Per the brief (§0.2), correctness of "is this actually dead?" is proven by the C0 oracle plus a green build/test/`check-imports`, not by a reviewer eyeballing 5k LOC of deletions.
- **`gtm-store` deposit/withdrawal branch is DELETED, not gated.** Decided 26 Aug 2026 (Nijil): cashier is extracted, the path is unreachable, and the events already stopped arriving, so no non-zero analytics data is lost. Analytics is _informed_ via the PR description — a notification, not a blocking sign-off.
- **`usePaginatedFetch` in C1d refers to the `@deriv/api` copy.** `packages/api/src/usePaginatedFetch.ts` (+spec +barrel export) is dead and deleted here; `packages/api-v2`'s own copy dies with the whole package in C1a. Both are confirmed to have no live consumer in `packages/*/src`.
- **`usehooks-ts` removed from `@deriv/api` only.** `useIntercom.ts` was that package's sole importer; `@deriv/components` still uses `usehooks-ts` (`use-device.ts`, `video-player.tsx`), so its declaration stays.

## Risks / Trade-offs

- **[A dynamic/lazy importer is missed and a "dead" unit is actually live]** → DCR-001 mandates grepping lazy/`makeLazyLoader`/`React.lazy` patterns, not just static imports; `build:all` + `test:jest` + `check-imports` + `knip:check` catch a broken graph before ship.
- **[`RadioGroup` confusion]** → the deleted one is `@deriv/components`; live `RadioGroup` imports are from `@deriv-com/quill-ui` (different symbol) and are explicitly out of scope (DCR-003).
- **[client-store surgical edit breaks the shared `reset_password` array]** → SMC-007 requires the cashier branch be excised without disturbing `reset_password`, backed by a targeted test on the `reset_password` path.
- **[`mockStore`/`types` drift after ui-store cluster removal]** → every C2 sub-diff removes the mirrored `packages/stores/types.ts`/`mockStore.ts` lines in the same diff and the phase gate requires both to compile.
- **[Run stops mid-IMPLEMENT and ships partial]** → the multi-run protocol: tick `- [x]` the instant each phase lands, never ship a partially-ticked plan, stop at a phase boundary, and file a deferral under `docs/spec-to-pr/deferrals/` if remaining work will not fit.
- **[Deleting a component's scss leaves a dangling `@import`]** → each component/chat deletion removes its `@import`/barrel line in the same phase; stylelint + the build catch a dangling reference.

## Migration Plan

No data or runtime migration — this is deletion of dead code. Rollout is the single squashed commit; rollback is a straight revert of that commit (the whole issue is one revert unit). Verification per phase: `bootstrap` + `build:all` + `test:jest` + `check-imports` + `knip:check`; C1 additionally asserts the components bundle shrinks vs the C0 baseline and zero `api-v2`/chat references remain; C2 additionally asserts the knip diff shows only intended removals and `mockStore`/`types` compile.

## Open Questions

None blocking. `usePaginatedFetch` package ambiguity is resolved above (the `@deriv/api` copy). The `gtm-store` deletion is a settled decision (26 Aug 2026), recorded in the PR description for Analytics as a notification.
