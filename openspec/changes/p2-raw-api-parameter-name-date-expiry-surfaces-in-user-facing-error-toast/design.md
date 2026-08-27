## Context

See `proposal.md` — Why, for the defect and its three leak paths.

The relevant constraint is that `mapErrorMessage` (`packages/shared/src/utils/error-mapping/error-message-mapper.ts`) is already the **single funnel**: a flat `switch (error.subcode)` over ~180 subcodes, reached by ~20 call sites in `trader`, `core`, `reports` and `shared` (toasts, snackbars, sheets, modals, inline field errors, `getProposalInfo`'s `message`, `socket-general`). Nothing renders a backend error without going through it — `getBarrierErrorMessage` and `getAutomationStopMessage` both special-case a few subcodes and then delegate to it. That means a change inside the mapper fixes every surface at once, and no surface needs editing.

Three shapes matter:

- `error.code_args?: Array<string | number>` (`types.ts`) — positional args interpolated as `{{param_N}}`. The mapper reads them once, at `const params = error.code_args || []` (line 24). This is the only place args enter the copy.
- `error.message` — the backend's own prose, returned verbatim on both fallback paths (no `subcode`, line 19-21; unmapped `subcode`, line 583-584).
- The authored `localize('…')` templates. A source scan finds exactly one containing a raw identifier today (`InvalidExpiry`, line 218).

The parameter names a rejection can actually name are knowable: they are the request fields this app sends, enumerated in `createProposalRequestForContract` (`packages/trader/src/Stores/Modules/Trading/Helpers/proposal.ts:176-250`) and `buildContractTemplate` (`Helpers/contract-template.ts:26-80`) — `amount`, `basis`, `contract_type`, `currency`, `underlying_symbol`, `date_start`, `duration`, `duration_unit`, `date_expiry`, `barrier`, `barrier2`, `payout_per_point`, `limit_order.{take_profit,stop_loss}`, `growth_rate`, `multiplier`, `cancellation`, plus `last_digit` / `selected_tick` for digit and tick-prediction contracts.

## Goals / Non-Goals

**Goals:**

- One mechanism, applied at the funnel, that covers all three leak paths — so a rejection nobody has seen yet cannot leak either.
- A glossary grounded in the request fields the app sends, using the labels the UI already shows for those fields.
- A guard that makes the authored-copy class of this bug non-recurring without human review.

**Non-Goals:**

- A broader jargon pass on error copy. `'Basis must be {{param_1}} for this contract.'` says "Basis", and `MissingConfig` names an expiry type — these are English words, not raw parameter names, and rewriting them is a separate content review.
- Localizing values. Amounts, currencies, dates and codes keep whatever formatting the backend sent (see the spec's preservation requirement — `barrier-range-errors` depends on it).
- Touching `error.details.field`. It is a matching key (`useTradeError`, `getProposalErrorField`), never rendered, and `getProposalErrorField` maps it to DOM `name` attributes — humanizing it would break field matching.
- Backend work. Asking the API to send display-ready copy is the right long-term fix but needs cross-team coordination; the client cannot rely on it and must sanitize regardless.

## Decisions

- **Fix at the funnel, not at the toast.** The substitution goes into `mapErrorMessage` rather than into `duration.tsx`'s snackbar. Rationale: the issue explicitly asks for the mapping layer, and the same rejection reaches the user through at least four different components (toast, snackbar, inline field error, service sheet) — a component-level fix would have to be repeated at each and would still miss the next surface.
    - _Alternative considered:_ sanitize at each `addSnackbar` call site — **rejected**, four copies of the same logic and no coverage for the non-toast surfaces or for Reports/portfolio.

- **A glossary function, not a module-level constant.** `getApiParameterLabels()` returns the map on each call, so `localize` runs in the active language. Mirrors `getLocalizedBasis()` (`packages/shared/src/utils/constants/contract.ts:10`). A module-level `const` would freeze every label in the boot language — the exact failure mode a language switch would expose, and one no test that mocks `localize` would catch.
    - _Alternative considered:_ a plain `Record<string, string>` of English strings, localized at the call site — **rejected**, it moves the `localize` call away from the literal and breaks Crowdin extraction.

- **Token-level regex replacement, not exact-string equality.** `humanizeApiParameterNames(text)` replaces every glossary key at word boundaries, so it handles a bare arg (`'date_expiry'`), a comma-joined arg (`'take_profit, stop_loss'` — the real shape of `OrderUpdateNotAllowed`), and prose (`'…either duration or date_expiry.'`) with one function. Exact equality would fix the reported toast and miss the other two.
    - _Longest-key-first ordering_ matters: without it `barrier2` could be partially consumed. Word-boundary anchoring keeps `payout_per_point` from being rewritten by a hypothetical `payout` entry.

- **Apply to `code_args` at the single `params` assignment.** One line — `const params = (error.code_args || []).map(arg => typeof arg === 'string' ? humanizeApiParameterNames(arg) : arg)` — covers all seven parameter-name-bearing subcodes and every future one, with no per-subcode allow-list to maintain. Safe for the ~40 value-bearing subcodes because a value is never a glossary key: the glossary holds only wire identifiers, and numeric args skip the call entirely.
    - _Alternative considered:_ a per-subcode allow-list of "which args are field names" — **rejected** as the maintenance burden that caused the bug (a new subcode is added and nobody remembers to list it), and unnecessary given key-only matching.

- **Keep the glossary to identifiers whose label differs from the identifier.** `duration`, `multiplier`, `barrier`, `currency` already read as their own labels, so they get no entry; `amount` is deliberately excluded because its meaning flips with `basis` (stake vs payout) and a wrong guess would be worse than the identifier. This keeps the map small and makes every entry defensible.

- **Residual-identifier check only on the unmapped fallback, and only for lowercase snake_case.** The detector is `/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/` — anchored lowercase so `R_100`, `1HZ100V` and `MULTUP` are structurally exempt (they are the values the preservation requirement protects). If a token survives substitution on the fallback path, the generic message is returned instead. Mapped templates are authored English and are covered by the guard test, so the check never runs against them (where `{{param_N}}` would false-positive anyway).
    - _Trade-off accepted:_ an unmapped error with an unlabelled field loses its specific prose. That prose was already unlocalized and written for API consumers, and the raw `error.message` is still on the error object for logging. Preferring generic-but-clean over specific-but-leaking is the issue's stated requirement.

- **Guard the authored copy with a source-scanning test.** The test reads `error-message-mapper.ts`, extracts `localize('…')` string literals, and asserts none contains a lowercase snake_case token other than `param_N`. Verified to find exactly one offender (`InvalidExpiry`) against the current file, so it goes red before the copy fix and green after.
    - _Alternative considered:_ refactor the `switch` into an exported `Record<subcode, template>` so the test could iterate data instead of source — **rejected** for this change (a 586-line mechanical refactor, with a translation-extraction risk, for the same assertion). The trade-off is that the test is coupled to the file path and to templates being written as a direct `localize('literal')` call; a template built by string concatenation would slip past it. Documented in the test.

- **No feature flag.** A flag would let the leak persist in one branch and there is no partial-rollout safety argument for showing users `date_expiry`.

## Risks / Trade-offs

- [A glossary key collides with a legitimate value, rewriting data] → Keys are snake_case wire identifiers plus `barrier2`; no amount, currency, date, symbol or contract-type code takes that shape. Locked in by the preservation scenarios in the spec (`+207.90` / `-207.60`, `R_100`, `MULTUP`).
- [The residual check swallows a genuinely useful unmapped message] → Scoped to the unmapped path only, and only when an identifier is actually present; every mapped subcode is unaffected. Widening the glossary is the remedy when a real case appears, and the raw message is still logged.
- [A multi-word label lands in a template whose grammar assumed one token] → Two known cases (`IncorrectBarrierOffsetDecimals`, `OrderUpdateNotAllowed`) are reworded in this change, with a spec scenario each; the rest interpolate into positions where a noun phrase reads correctly.
- [New/changed strings are untranslated until Crowdin syncs] → Four English strings change or are added; they render in English in the interim, which is strictly better than the identifier they replace.
- [The source-scanning test breaks if the mapper file is renamed or restructured] → It fails loudly (file-not-found) rather than silently passing; the fix is a one-line path update. Called out in a comment in the test.
- [Backend keeps sending API-shaped prose] → Out of scope here, but recorded as a `report-upstream` finding per `.buildwright/framework/findings.md` so the source fix is not lost.

## Migration Plan

Pure client-side copy/mapping change inside one shared module. No migration, no data change, no store or request-shape change. Rollback is reverting the commit; the only user-visible effect of a rollback is the identifier reappearing. Deploys with the normal release — no coordination with the backend, and no dependency on the Gold/USD duration blocker being fixed first (this change makes that rejection readable whether or not it still occurs).

## Open Questions

None that affect the specs, approach, or task breakdown. Two deferrable items:

1. Whether the backend should stop sending API-shaped prose in `error.message` at all (tracked as a `report-upstream` finding, not a blocker — the client must sanitize regardless).
2. Whether the glossary should later grow to cover `contract_update` / account-level parameters beyond the trading request fields. Additive; a new entry needs no design change.
