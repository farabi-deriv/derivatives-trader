## Context

C6 (issue [#1271](https://github.com/deriv-com/derivatives-trader/issues/1271)) fixes 16 independent latent bugs the modernization audits surfaced; it is gated on C5 ([#1270](https://github.com/deriv-com/derivatives-trader/issues/1270)) and, like the earlier Workstream-C runs, ships as **one revert unit** (one branch, one PR, one commit). The programme spec is not committed here — the issue body is the authoritative brief and every file/line below was re-confirmed against HEAD during planning (see the per-bug evidence summarised in the tasks). The C0 oracle (`knip:check`, `baseline:check`, wired into CI/VERIFY) is the shipping gate alongside a green build/test/`check-imports`. See proposal.md — Why for motivation.

## Goals / Non-Goals

**Goals:**

- Correct each of the 15 present bugs with the smallest change that fixes the observable defect, plus a co-located regression test where feasible.
- Keep the batch revertible as a unit and green at every grouped phase boundary.
- Record the one not-present bug (14) as a discrepancy rather than fabricating a change.

**Non-Goals (design-level boundaries):**

- Rewiring chart layout, countdown or asset-info into real user controls (bugs 10, 12) — feature requests, explicitly out of scope per the 26 Aug 2026 decision.
- Reviving an `ext_platform_url` external-return feature (bug 9) — there is no `setExternalParams` implementation and nothing else consumes external params; the branch is removed, not implemented.
- Correcting the `Analytics.reset()` _semantics_ beyond preserving today's behaviour (bug 11) — deferred (see Open Questions and the deferral note).
- The broader C5/C7/C8 store and package sweeps.

## Decisions

- **One new capability `audit-bug-fixes`, not deltas onto `store-member-cleanup`/`dead-code-removal`.** Bugs 10, 11, 15 are resolved by deletion and could extend SMC/DCR, but C6 is framed and reverted as one audit-bug batch, and most of the sixteen are behavioural fixes (leaks, dropped args, wrong source, crash) rather than routine dead-member sweeps. Housing all fixes in one capability keeps the change reviewable as a single unit and archives into one coherent spec. _Alternative:_ scatter across SMC/DCR + a new capability — rejected; it fragments one revert unit across three specs and adds MODIFIED/ADDED deltas to two archived capabilities for no traceability gain.
- **One requirement per code-changing bug (ABF-002…016) + one discipline requirement (ABF-001).** ABF-001 carries the re-verify-at-HEAD + green-gate + discrepancy-recording discipline (the home for bug 14). Bug 14 gets no ABF-0xx of its own because there is no behaviour to change. _Alternative:_ an ABF requirement asserting "StudyLegend/Share render on desktop" — rejected as inventing a requirement to satisfy validation for behaviour that already holds.
- **Bug 3 resolves by removing the dead branch, not by making it reachable.** Reports always seed a non-null `date_to`, so `has_selected_date` is effectively always true and the generic no-filter empty state is unreachable. Removing the unreachable branch (and the always-true gate) changes nothing users see; making it reachable would invent a new empty state users have never seen — a product/feature change out of scope, consistent with the bug-10 "rewiring is a feature request" stance. See Open Questions.
- **Bug 11 preserves current observable behaviour when deleting `email`.** `email` is always `undefined`, so `gtm-store`'s `email` payload field carried no data (removed cleanly) and `app.jsx`'s effect calls `Analytics.reset()` exactly once on mount (`!undefined` → true, deps never change). The fix decouples that mount-time reset from the deleted `email` (an unconditional `Analytics.reset()` on mount), preserving behaviour; correcting whether reset-on-mount is even desirable is a separate analytics concern, deferred. See Open Questions.
- **Bug 6 splits into the fix (always in scope) and the refactor (cuttable).** The observable bug — desktop dropping the persisted vanilla strike — is a one-clause fix at `contract-type.ts:252` (drop `&& root_store?.ui.is_mobile`). The dead always-`true` `is_dtrader_v2` getter (8 files, ~15 call sites) and the divergent device predicates are a refactor with no additional observable behaviour; per the issue (§0.4) it is the final phase and, if it exceeds a reviewable diff at implement time, its remnant deletion is deferred to its own issue via `docs/spec-to-pr/deferrals/`.
- **Bug 11 cookie removal is auditable, not grep-proven.** Deleting the region/client-info cookie writes rests on the human confirmation (Nijil) that no other deriv-com property reads them — a repo grep cannot prove absence of an external reader, so the provenance is stated in the PR description.
- **Green gate scales to the change.** Deletion phases (10, 11, 15, 16) run the full `knip:check`; per the epic's baseline protocol a `knip:check` red on a genuine deletion means "delete the newly-orphaned code too" (done in-phase for bug 11's `getRegion`/`getTrustedDomainName`), and `knip:baseline`/`baseline:update` are run only for a deliberate keep or an intended ship-set change, committed in the same PR.

## Risks / Trade-offs

- **[Bug 4 fix is latent-only — adding the observable could change nothing user-visible]** → true today (the only reader is synchronous-imperative), so the fix is low-risk hardening; the regression test asserts observability (`isObservableProp` / a reaction fires) rather than a UI change.
- **[Bug 11 `email` deletion breaks the build via two live consumers]** → `gtm-store.js:39` and `app.jsx:74-78` are edited in the same phase; the phase gate requires `build:all` + `test:jest` green and the app-mount reset preserved.
- **[Bug 6 refactor overruns the reviewable diff]** → it is the last phase and cuttable at the boundary; a deferral is filed and the strike-restore fix (earlier phase) still ships.
- **[A "dead" member has a dynamic `this[name]` consumer]** → ABF-001 mandates `\bmember\b` grep across all packages before each removal; `build:all`/`knip:check` catch a broken graph.
- **[Bug 15 deletes the wrong twin]** → module resolution selects `.ts` before `.tsx`, so `index.tsx` is the shadowed dead file; the kept `index.ts` is byte-identical, so consumers are unaffected and the build proves it.
- **[Bug 8/7 stores have no existing spec, masking regressions]** → new co-located spec files are created for `contract-store`, `contract-replay-store`, `common-store`, `client-store`, `contract-trade-store`; existing consumer tests that hardcode `contract_update: undefined` are updated so they no longer mask the fix.

## Migration Plan

No data/runtime migration. Rollout is the single squashed commit; rollback is a straight revert of that commit (the whole issue is one revert unit). Verification is per grouped phase: `bootstrap` + `build:all` + `test:jest` + `check-imports` + `knip:check`; deletion phases additionally confirm the knip diff shows only intended removals and `@deriv/stores` types/mocks compile. The PR description records the bug-11 cookie provenance and the informational Analytics notes (bugs 11, 12).

## Open Questions

Two questions are product/analytics-facing; both are resolved with the recommended option so the plan is implementable as-is (the questions and options are mirrored in tasks.md).

- **Bug 3 resolution** — recommended: remove the unreachable no-filter empty-state branch and the always-true `has_selected_date` gate (no user-visible change). Making the generic empty state reachable is a deferred product decision, not built here.
- **Bug 11 `app.jsx` Analytics.reset** — recommended: preserve current behaviour with an unconditional `Analytics.reset()` on mount after deleting `email`. Correct reset semantics are deferred (`docs/spec-to-pr/deferrals/analytics-reset-on-mount-email-gate.md`).
