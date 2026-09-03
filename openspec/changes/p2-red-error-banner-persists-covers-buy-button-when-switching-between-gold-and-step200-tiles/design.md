## Context

See `proposal.md` — Why. Three structural facts constrain the approach:

1. **All market tabs share one `TradeStore`.** A tab is only a `{symbol, contract_type}` pair (`AppV2/Utils/open-markets-utils.ts:3-6`) and `selectMarketAndTradeType` (`trade-store.ts:1097-1149`) mutates the single store. There is no per-tab trade-parameter state, so "the Step 200 tab had Duration 15 minutes" is not something the store can restore — whatever duration/expiry the Gold tab left behind is what Step 200 gets. Any fix that relies on per-tab parameter isolation would be a redesign, not a bug fix.
2. **`requestProposal` already has an established "withhold the proposal" pattern.** It early-returns for a closed market, for `is_awaiting_contracts_for`, and for outstanding `validation_errors`, each time clearing `proposal_info` / `purchase_info` / `proposal_requests` after `forgetAllProposal()` (`trade-store.ts:2106-2156`). A fourth withholding condition fits that pattern exactly; the ordering comment at `:2122-2124` ("Forget before clearing… a stale map left next to an empty `proposal_info` makes the purchase wait's key-count comparison unsatisfiable") is a constraint any new branch must honour.
3. **One snackbar queue, one controller.** `ServicesErrorSnackbar` renders the only `SnackbarController` in the AppV2 tree and `TradeErrorSnackbar` deliberately renders none — a second controller portals the same queue twice and the lower copy swallows taps (documented at `trade-error-snackbar.tsx:11-21`, from #893/#947). Positioning is therefore per-`addSnackbar` `style.marginBottom`, not a container-level layout change.

`getSymbolDurationSupport` (`trade-store.ts:3277-3296`) misclassifies Gold/USD as tick-supporting (it only special-cases `market === 'forex'`, and `frxXAUUSD` is a commodity). That misclassification is what stops `handleTradeParamsResetOnSymbolChange` from reconciling duration between Gold/USD and Step 200 Index. Correcting the classification would change default durations across every commodity and metal symbol, so this change works around it rather than through it — see Non-Goals.

## Goals / Non-Goals

**Goals:**

- Make an invalid proposal request unrepresentable: the request builder either produces an expiry or reports that it cannot, and the caller withholds the request in the latter case.
- Make the "expiry mode = end time, no time" state unreachable through the mobile Duration sheet, and self-correcting if it is reached by any other path.
- Make a market-tab switch a clean slate for error state, without touching the tab strip's own ordering/activation logic.
- Replace six copies of the `48px` snackbar offset with one tested helper that knows the real page geometry.

**Non-Goals:**

- Per-tab trade parameters (each tab remembering its own duration/stake/barrier). Real, but a separate design.
- Fixing `getSymbolDurationSupport`'s commodity classification, or `handleTradeParamsResetOnSymbolChange`'s reset policy generally.
- Changing `ERROR_SNACKBAR_DURATION`, the snackbar queue, or the single-controller arrangement from #947.
- Changing `HEIGHT.TRADE_PARAM_SHEET` (158) — `getChartHeight` depends on it, and the chart height is not in scope.

## Decisions

### Decision 1: `getDurationParams()` returns a discriminated result; `requestProposal` withholds on "none"

Change the private `getDurationParams()` inside `createProposalRequestForContract` (`Helpers/proposal.ts:189-212`) so its three cases are explicit rather than collapsing into a bare `{}`:

- Accumulator / Multiplier → no expiry fields (unchanged; these legitimately take none).
- `expiry_type === 'endtime'` with a resolvable `date_expiry` → `{ date_expiry }`.
- Otherwise, when `duration` and `duration_unit` are usable → `{ duration, duration_unit }`. **This is the new fallback**: an unresolvable `endtime` no longer produces an empty object, it produces the duration the store still holds.
- Neither resolvable → the request is marked as having no expiry.

Expose the "has no expiry" verdict to the caller. The cleanest signal that does not change the request's wire shape is a small exported predicate — `hasResolvableExpiry(store)` in `Helpers/proposal.ts` — used by `requestProposal` as a fourth early-return guard, mirroring the existing three (forget, then clear `proposal_info` / `purchase_info` / `proposal_requests`, then return). `createProposalRequests` stays a pure builder.

- **Alternative — let the request go and swallow the resulting error in `onProposalResponse`:** rejected. It burns a round trip, and suppressing a backend error by message text is exactly the kind of guessing that leaves the real one hidden later.
- **Alternative — attach a sentinel field to the request object and filter in `requestProposal`:** rejected; it puts a non-API field on a shape that is spread straight onto the wire (`WS.subscribeProposal`).
- **Why a fallback to `duration` rather than only skipping:** the store's `duration`/`duration_unit` are always populated (`trade-store.ts` initialises them and `applyDefaultDuration` re-seeds them), so in the reported scenario the fallback yields a _working_ proposal rather than a blank Buy button. Skipping is the last resort, not the first.

### Decision 2: Fix the mobile writer, and add the invariant where every writer passes

Two layers, because they cover different failure classes:

- **The writer:** `duration.tsx:103-117` gains `expiry_time: '23:59:59'` in its `onChangeMultiple` payload — the same string it already writes to local state at `:110`, and the same shape `duration-desktop.tsx:287-294` already commits. This is the one-line fix for the reported reproduction.
- **The invariant:** `processNewValuesAsync` is the single funnel every trade-parameter commit passes through (`onChange`, `onChangeMultiple`, `processContractsForV2`, `handleTradeParamsResetOnSymbolChange` all route through it). Add a normalisation step there, alongside the existing symbol-change block at `:1918-1943`: if the resulting state would have `expiry_type === 'endtime'` with no usable `expiry_time`, rewrite it to `expiry_type: 'duration'`. That covers any future writer, and the several places that null `expiry_time` independently of `expiry_type` (`:1021`, `:1308`, `:1335`, `:1368`, `:3395`, `:3402`).

- **Alternative — a MobX `reaction` on `[expiry_type, expiry_time]`:** rejected. The store already carries five reactions around duration/expiry and their interleaving is delicate (see the `contract_expiry_type` reaction's own comment at `:763-769`); a reaction also fires _after_ the malformed proposal has been debounced, so it would fix the state a beat too late. Normalising inside the commit funnel fixes it before `debouncedProposal()` runs at `:2031`.
- **Alternative — only fix `duration.tsx`:** rejected as insufficient; Decision 1's guard would still be load-bearing for other paths, and the invariant is what makes the spec's "never committed without a time" requirement true rather than incidental.

### Decision 3: Clear error state at the start of `selectMarketAndTradeType`

`selectMarketAndTradeType` is the single entry point for every tab activation, tab replacement, and URL/automation-driven market change (its own docblock at `:1085-1096` says so, and `market-tabs.tsx:262-282` routes taps through it). Clear the error surfaces there, before `startSelectingMarket()`:

- `proposal_info = {}` and `validation_params = {}` — the same pair `processNewValuesAsync` already clears on a symbol change (`:1993-1996`), but done up-front so the window between the tap and the first `onChange` carries no error.
- The trade-parameter `validation_errors` entries — reuse the existing per-field clearing style (`clearBarrierValidationErrors`, `:3167`) rather than blanking the whole object, so nothing unrelated is dropped.
- `root_store.common.resetServicesError()` when a `services_error` is set — guarded by the same `isEmptyObject` check the portfolio store adopted in #947, so the action is not fired on every tab tap.

Extend `onProposalResponse`'s stale guard (`:2178-2183`) to also drop a response whose `contract_type` is no longer a key of `this.trade_types`. The existing `underlying_symbol` check does not catch a same-symbol trade-type switch, which the tab strip supports (a symbol can be open under several trade types — `open-markets-utils.ts:28-31`).

- **Alternative — clear inside `market-tabs.tsx`'s `handleSelect`:** rejected; it would miss the URL-reconcile, automation-pin and contract-type-availability paths that also call `selectMarketAndTradeType`.
- **Alternative — dismiss the visible snackbar via `useSnackbar().removeSnackbar` on tab change:** deferred, not adopted. It would remove an already-visible toast at the moment of the switch, but the quill `useSnackbar` API surface for removal is not verified in this repo (only a test mock references `removeSnackbar` — `AllowEquals/__tests__/allow-equals.spec.tsx:27`), and with the enqueue suppressed at source the remaining exposure is bounded by `ERROR_SNACKBAR_DURATION` (4s). Recorded as an Open Question below.

### Decision 4: One offset helper in `layout-utils.tsx`, six call sites

Add to `AppV2/Utils/layout-utils.tsx`:

- `HEIGHT.PURCHASE_BLOCK = 72` — the Buy-button block, the value already named in the `TRADE_PARAM_SHEET` comment at `:12-14`. `TRADE_PARAM_SHEET` itself stays 158.
- `getErrorSnackbarBottomOffset({ pathname, is_logged_in, is_chart_maximized, is_cancellable_multiplier })` returning a CSS length string:
    - Trade page (`routes.index`) and Automate: `PURCHASE_BLOCK + gap`, plus `BOTTOM_NAV` unless the chart is maximised (the sheet drops to `bottom: 0` then — `trade-parameters.scss:67-69`) or the user is logged out.
    - Contract details with a cancellable multiplier: the existing `104px` (preserves `services-error-snackbar.tsx:86-91`).
    - Everything else: today's `48px` logged in / `-8px` logged out.

Route all six `marginBottom` sites through it: `ServicesErrorSnackbar:107`, `TradeErrorSnackbar:41`, `PurchaseButton:228`, `Duration:287`, `Barrier:49`, `Day:144`. The last two currently hard-code a flat `'48px'` with no logged-out branch — they get the same treatment, which also fixes their logged-out placement.

- **Alternative — a CSS custom property set by the trade-params container and read by the snackbar style:** attractive (it would track the real rendered height), but the snackbar is portalled to `document.body` outside the container's subtree, so it would need the variable on `:root` and a component writing it — more machinery than the fixed, already-documented geometry warrants (KISS).
- **Alternative — measure the purchase wrapper with a ref/`ResizeObserver`:** rejected as premature; the page geometry is fixed by design (the sheet has a single fixed height and no expand affordance — `trade-parameters.scss:72-74`), and a measured value is untestable in jsdom.
- **Why a helper rather than editing six literals:** the literal has already drifted (four sites branch on `is_logged_in`, two do not), and the helper is the only form of this that a unit test can pin.

## Risks / Trade-offs

- **The duration fallback in Decision 1 changes what a stale `endtime` state quotes.** Previously such a state produced an error; now it quotes against the store's `duration`/`duration_unit`. → Decision 2's invariant means the state should not persist long enough to matter, and quoting a duration the user can see in the Duration field is strictly more honest than a rejected request. Covered by a unit test asserting the fallback's exact request shape.
- **Clearing `services_error` on every tab switch could swallow an error the user has not read.** → Guarded by `isEmptyObject`, and scoped to the tab-switch action only; errors raised _after_ the switch are unaffected. A purchase error the user is mid-way through reading survives, because a purchase does not switch tabs.
- **The offset helper hard-codes geometry that could drift from the SCSS.** → The values come from constants that already exist in `layout-utils.tsx` and are already relied on by `getChartHeight`; the new constant is the one the file's own comment already names. Unit-tested, and the SCSS comment at `trade-parameters.scss:61` already cross-references `HEIGHT.BOTTOM_NAV`.
- **`onProposalResponse`'s widened guard could drop a legitimate response during the window where `trade_types` is mid-update.** → `trade_types` is repopulated by `processContractsForV2` before `is_awaiting_contracts_for` is released (`trade-store.ts:1023-1045`), and `requestProposal` withholds while that flag is set, so no in-flight request exists for a `trade_types` the store has not yet applied.
- **The reported reproduction cannot be verified in this unattended run** (it needs an authenticated mobile-web session against live market data). → Every step is covered by unit tests at the layer where the defect lives, and `tasks.md` carries an explicit manual-QA checklist with the previous-vs-expected behaviour per surface.

## Migration Plan

No data migration, no feature flag. The change is behaviour-preserving for every configuration that already produced a valid proposal; the only observable differences are the ones the specs describe. Rollback is a plain revert of the branch — no persisted state is written or reshaped (the `localStorage` keys `handleTradeParamsResetOnSymbolChange` touches are untouched by this change).

## Open Questions

1. **Should an already-visible error toast be dismissed the instant the user switches tabs, in addition to suppressing new ones?** Deferring this does not change the specs (which require the error not to be _shown for_ another tab, satisfied by suppression plus the 4s auto-dismiss), the approach, or the task breakdown. Answering it needs the quill `useSnackbar` removal API confirmed against the installed `@deriv-com/quill-ui` (not installed in this workspace). If it is available and stable, it is a small follow-up inside `ServicesErrorSnackbar`.
