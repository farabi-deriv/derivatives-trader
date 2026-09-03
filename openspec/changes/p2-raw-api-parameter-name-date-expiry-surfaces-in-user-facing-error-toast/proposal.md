## Why

A retail user drafting a trade sees the toast **"Please specify either duration or date_expiry."** — `date_expiry` is a raw snake*case API parameter name, not English ([#1247](https://github.com/deriv-com/derivatives-trader/issues/1247), reported by Prakash from a Lagos/Nigeria VPN geo; Chris G in-thread: *"We need to ensure error messages have English statements too… not `date_expiry`"\_).

The leak is structural, not a typo. `mapErrorMessage` (`packages/shared/src/utils/error-mapping/error-message-mapper.ts`) is the single funnel every user-facing backend error passes through — ~20 call sites across toasts, action sheets, modals, inline field errors and the Reports stores — and it has three paths that emit raw API identifiers verbatim:

1. **`code_args` are interpolated untouched.** `MissingEither` renders `'Please specify either {{param_1}} or {{param_2}}.'` from `code_args: ['duration', 'date_expiry']` (line 316-320) — that is the reported toast, exactly. Six other subcodes interpolate parameter names the same way (`DuplicateExpiry`, `InvalidInput`, `MissingRequiredContractParams`, `OrderUpdateNotAllowed`, `IncorrectBarrierOffsetDecimals`, `WrongAmountType*`).
2. **The unmapped fallback returns `error.message` verbatim** (lines 19-21, 583-584), so any backend rejection whose subcode is absent or unmapped passes its raw prose — field names and all — straight to the UI.
3. **One authored template hardcodes the identifier**: `InvalidExpiry` reads `'Invalid input (duration or date_expiry) for this contract type ({{param_1}}).'` (line 218). A source scan of the mapper's `localize(...)` templates finds exactly this one offender today.

Fixing only the Gold/USD duration blocker that triggered this instance fixes one path; the next backend rejection on any surface leaks again. This change fixes the mapping layer and adds a guard so authored copy cannot regress.

## What Changes

- **Add an API-parameter glossary to the error-mapping layer** — a localized map from the raw parameter names this app actually sends (grounded in `createProposalRequestForContract` in `Helpers/proposal.ts` and `buildContractTemplate` in `Helpers/contract-template.ts`) to the labels the UI already uses for those fields: `date_expiry` → "end time" (the app's own **End time** tab), `take_profit` → "take profit", `barrier2` → "second barrier", and so on.
- **Substitute parameter names inside `code_args` before interpolation.** Token-level replacement, not whole-string equality, so a comma-joined arg (`"take_profit, stop_loss"`) is handled as well as a bare one. Values that are not glossary keys — amounts, currencies, dates, symbol codes, contract-type codes — pass through untouched.
- **Sanitize the unmapped-fallback message with the same substitution**, so a backend rejection with no subcode (or an unmapped one) cannot leak a known parameter name either.
- **Replace an unmapped fallback message that still contains a raw snake_case identifier with the generic message.** After substitution, a residual lowercase snake_case token means an identifier we do not have a label for is about to reach a retail user; the generic "An error occurred. Please try again later." is preferred over leaking it. Applies **only** to the unmapped path — authored templates are covered by the guard test instead. The raw message stays on the error object for logging.
- **Fix the one hardcoded identifier in authored copy** (`InvalidExpiry`) and reword the two templates whose grammar assumed a single-token parameter (`IncorrectBarrierOffsetDecimals`, `OrderUpdateNotAllowed`) so a multi-word label reads correctly.
- **Add a guard test that scans the mapper's own `localize(...)` templates** for lowercase snake_case tokens other than `param_N`, so a future copy edit cannot reintroduce a raw field name in authored English.
- No backend change, no new dependency, no feature flag, no API-shape change.

## Capabilities

### New Capabilities

- `api-error-copy`: How backend rejections become user-facing copy — the contract that a message shown to a retail user is human-readable English with no raw API parameter names, on every surface that renders a backend error (toasts, action sheets, service-error sheets/modals, inline trade-parameter errors, Reports errors).

### Modified Capabilities

<!-- None. openspec/specs/ has no existing spec covering backend-error copy. `barrier-range-errors` governs whether a barrier message states its accepted range — a different requirement, unchanged by this change. -->

## Impact

- **Code (the fix):**
    - `packages/shared/src/utils/error-mapping/error-message-mapper.ts` — humanize `code_args` at the single `params` assignment (line 24); sanitize + guard the two fallback returns (lines 19-21, 583-584); fix the `InvalidExpiry` template (line 218); reword `IncorrectBarrierOffsetDecimals` (164-168) and `OrderUpdateNotAllowed` (396-399).
    - **New file** `packages/shared/src/utils/error-mapping/api-parameter-labels.ts` — the glossary (a function returning the map, so labels resolve in the active language, mirroring `getLocalizedBasis` in `utils/constants/contract.ts`), plus `humanizeApiParameterNames` and `hasRawApiParameterName`.
    - `packages/shared/src/utils/error-mapping/index.ts` — export the two helpers (re-exported package-wide by `packages/shared/src/index.ts:31`).
- **Surfaces fixed transitively (no edits needed — all already route through `mapErrorMessage`):** the duration toast (`AppV2/Components/TradeParameters/Duration/duration.tsx:281`, `day.tsx:138`), `TradeErrorSnackbar` via `AppV2/Hooks/useTradeError.ts:23`, the barrier toast (`Barrier/barrier.tsx:45`, `barrier-error-utils.ts:65`), stake / take-profit / stop-loss inputs (mobile + desktop), `ServiceErrorSheet`, Reports' `ServicesErrorModal`, `portfolio-store`, `contract-trade-store`, `common-store`, `socket-general.js`, and `getProposalInfo`'s `message` (`Helpers/proposal.ts:129`).
- **Tests:** extend `packages/shared/src/utils/error-mapping/__tests__/error-message-mapper.spec.ts`; **new** `packages/shared/src/utils/error-mapping/__tests__/api-parameter-labels.spec.ts`.
- **Translations:** three authored strings change and one glossary set is added, so those keys are new to Crowdin and render in English until the next translation sync. No key is deleted that anything else reads.
- **Not affected:** no routing, store-shape, request-shape, or dependency changes. `error.details.field` keeps its raw value (it is a matching key in `useTradeError` / `getProposalErrorField`, never rendered).
