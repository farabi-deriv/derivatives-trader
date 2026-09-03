# fix: red error banner persists and covers Buy when switching market tabs

Fixes #1246

## Root cause

Three independent defects combined to produce the reported symptom.

1. **The client sent a proposal request the backend had to reject.** `getDurationParams()` in
   `Stores/Modules/Trading/Helpers/proposal.ts` returned `{}` when `expiry_type === 'endtime'` but
   `expiry_time` was falsy, so the outgoing `proposal` carried **neither** `duration` nor
   `date_expiry` — exactly the request shape the backend answers with "Please specify either
   duration or date_expiry.". A stale `// TODO: Fix mobile duration param intermittently showing
invalid duration error` sat directly above the helper.
2. **The mobile Duration sheet was what created that state.** `Duration/duration.tsx`'s days-default
   effect committed `{ expiry_date, expiry_type: 'endtime' }` **without** `expiry_time`, unlike both
   desktop writers (`duration-desktop.tsx`, `duration-end-time-desktop.tsx`), which commit a time.
3. **The broken state and its error travelled with the tab switch.** All market tabs share one
   `TradeStore`; `selectMarketAndTradeType` cleared no error state, and `onProposalResponse`'s stale
   guard only compared `underlying_symbol`, so a rejection raised for one tab surfaced on the next.

Separately, every trade-page error toast was anchored at `marginBottom: 48px` while the Buy button
occupies 56px–128px above the viewport edge — so any error, legitimate or not, landed on top of the
primary action.

## What changed

- **`Helpers/proposal.ts`** — `getDurationParams()` falls back to the store's `duration`/
  `duration_unit` when an `endtime` expiry cannot resolve a `date_expiry`; new exported
  `hasResolvableExpiry(store)` reports when no expiry is resolvable at all. Stale TODO removed.
- **`trade-store.ts` / `requestProposal`** — a fourth early-return guard withholds the request when
  `hasResolvableExpiry` is false, clearing `proposal_info` / `purchase_info` / `proposal_requests`
  after `forgetAllProposal()`, matching the three existing withholding branches.
- **`trade-store.ts` / `processNewValuesAsync`** — a commit that would leave `expiry_type: 'endtime'`
  with no usable `expiry_time` is rewritten to `expiry_type: 'duration'`, before the tail's
  `debouncedProposal()`.
- **`Duration/duration.tsx`** — the days-default effect now commits `expiry_time: '23:59:59'`
  alongside the date, matching the desktop writers and its own local state.
- **`trade-store.ts` / `selectMarketAndTradeType`** — clears the outgoing tab's `proposal_info`,
  `validation_params` and trade-parameter `validation_errors`, and resets `common.services_error`
  when one is actually set, before the symbol/contract-type cascade.
- **`trade-store.ts` / `onProposalResponse`** — the stale-response guard also drops a response whose
  `contract_type` is no longer among `trade_types` (a same-symbol trade-type switch).
- **`AppV2/Utils/layout-utils.tsx`** — new `HEIGHT.PURCHASE_BLOCK = 72` and
  `getErrorSnackbarBottomOffset()`; all six `marginBottom` snackbar call sites route through it
  (`ServicesErrorSnackbar`, `TradeErrorSnackbar`, `PurchaseButton`, `Duration`, `Barrier`, `Day`).
  The last two previously hard-coded a flat `48px` with no logged-out branch, and gain one.

## Proof of red

Per `.buildwright/framework/tdd-evidence.md`, each behaviour change's test was run against the
unfixed code first. Captured failures:

```
Red: Proposal Helper Functions › expiry resolution › createProposalRequestForContract › falls back to
     the duration when an endtime expiry has no usable expiry_time
     — expected objectContaining({ duration: 15, duration_unit: 'm' }),
       got a request with neither `duration` nor `date_expiry`

Red: Proposal Helper Functions › expiry resolution › hasResolvableExpiry › returns false when neither
     an expiry time nor a usable duration is available
     — TypeError: hasResolvableExpiry is not a function (the export did not exist)

Red: TradeStore › end-time expiry invariant › falls back to a duration expiry when an endtime commit
     carries no expiry_time
     — expected expiry_type "duration", got "endtime"

Red: TradeStore › Purchase button recovery › requestProposal › sends nothing when the expiry cannot
     be resolved
     — expected WS.subscribeProposal calls: 0, received: 1

Red: TradeStore › selectMarketAndTradeType clears the outgoing tab error state › drops the previous
     tab's proposal error and resets a pending services_error
     — expected resetServicesError calls: >= 1, received: 0

Red: TradeStore › selectMarketAndTradeType clears the outgoing tab error state › clears the
     trade-parameter validation errors but leaves unrelated keys alone
     — validation_errors.duration still held the previous tab's message after the switch

Red: TradeStore › onProposalResponse staleness guard › ignores a response for a contract type the
     current tab no longer trades
     — expected proposal_info {}, got the stale MULTUP entry written in

Red: getErrorSnackbarBottomOffset › clears the bottom nav and the purchase block on the trade page
     — TypeError: getErrorSnackbarBottomOffset is not a function (the export did not exist)

Red: Duration - Mobile › commits an end time alongside the defaulted date when the duration unit
     becomes days (mobile)
     — expected objectContaining({ expiry_time: '23:59:59', expiry_type: 'endtime' }),
       got { expiry_date: '…T23:59:59Z', expiry_type: 'endtime' }

Red: ServicesErrorSnackbar › positions the trade-page toast clear of the Buy button
Red: TradeErrorSnackbar › positions the toast clear of the Buy button
Red: PurchaseButton › should show an error snackbar with an auto-dismiss delay when the proposal
     contains an error
     — all three: expected style.marginBottom "136px", got "48px" (i.e. on top of the Buy button)
```

**Characterization tests** (never went red — they pin behaviour that already worked, or the positive
half of a new contract, so the fix cannot over-reach):

- `end-time expiry invariant › keeps the endtime expiry when a time is committed alongside the date`
- `end-time expiry invariant › keeps an already-committed endtime expiry when an unrelated value changes`
- `selectMarketAndTradeType … › does not reset the services error when none is set`
- `onProposalResponse staleness guard › accepts a response for a contract type the current tab does trade`
- `createProposalRequestForContract › still sends the absolute expiry when the endtime resolves`

## Gates

| Gate                                                                                     | Result                                                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run test:jest -- packages/trader/src/Stores/Modules/Trading …/layout-utils.spec.ts` | 21 suites, 369 tests — pass                                               |
| `npm run test:jest -- packages/trader/src/AppV2`                                         | 217 suites, 1961 tests — pass                                             |
| `npx tsc -p packages/trader/tsconfig.json --noEmit`                                      | 4 errors, all the known `inline-message.tsx` baseline — **no new errors** |
| `npx eslint` (touched files)                                                             | 0 errors, 42 pre-existing warnings                                        |
| `npx prettier` (touched files)                                                           | clean                                                                     |
| `npx -y @fission-ai/openspec validate …`                                                 | valid                                                                     |

## Notes

- `Helpers/contract-template.ts` (the autotrader template) already mirrors the corrected logic — it
  guards on `store.expiry_date && store.expiry_time` and otherwise emits `duration`/`duration_unit`
  — so it is intentionally left alone. No other caller depends on `getDurationParams` returning `{}`
  (`preview-proposal.ts` and `AppV2/Utils/trade-params-utils.tsx` both only forward the request).
- `trade-store.spec.ts`'s `proposal hold until contracts_for is applied` helper now seeds
  `duration_unit`, which `processContractsForV2` normally supplies from the API but the suite mocks
  away. Those tests exercise the contracts_for hold, not the expiry, and their intent is unchanged.
- Open Question 1 resolved as recommended: suppress at source only. No `removeSnackbar` call is
  added, so the residual exposure is one already-visible toast bounded by `ERROR_SNACKBAR_DURATION`
  (4s). Open Question 2: 8px gap (trade-page offset 136px logged in). Open Question 3: all six call
  sites.

## Manual QA — previous vs expected

### 1. Mobile web, two market tabs (the issue's reproduction)

Open Vol 100 (1s) Rise/Fall → switch its symbol to Gold/USD → add a second tab via "+" set to
Step 200 Index (Duration 15 minutes) → switch between the two tabs several times.

- **Previously:** the toast "Please specify either duration or date_expiry." fires on the Step 200
  tab and sits over the Buy button; repeated switching makes it appear and disappear.
- **Expected:** no toast on either tab; both tabs quote a payout and the Buy button is tappable
  throughout.

### 2. Mobile web, Duration sheet, days unit

Open Duration on a symbol offering days and pick the Days tab without setting an end time.

- **Previously:** the store lands on an end-time expiry with no time and the proposal is rejected.
- **Expected:** the end time defaults to 23:59:59 and a price quotes.

### 3. Mobile web, any genuine trade error

Trigger an error on the Trade page (e.g. a stake below the minimum).

- **Previously:** the red toast sits on top of the Buy button.
- **Expected:** the toast sits above the Buy button, the Buy button stays fully visible and
  tappable, and the toast still auto-dismisses after ~4s.

### 4. Mobile web, chart maximised

Trigger an error with the chart maximised.

- **Previously:** the toast overlaps the purchase block at its raised position.
- **Expected:** the toast stays clear of the purchase block (the bottom nav has collapsed, so the
  offset drops with the sheet).

### 5. Logged out, Trade page

Trigger an error while logged out.

- **Previously:** a flat `-8px` — and, for the Barrier and Day sheets, `48px` regardless of auth.
- **Expected:** the toast clears the logged-out purchase block on all six surfaces.

### 6. Contract details, cancellable multiplier

Trigger a service error on contract details for a multiplier that is still cancellable.

- **Previously and expected (unchanged):** the toast sits at the existing 104px offset above the
  Cancel action.

### 7. Regression sweep — end-time expiry still works

Set an explicit end time (desktop End time fields, and the mobile End time tab). The trade must stay
on an end-time expiry and quote against `date_expiry`, not silently fall back to a duration.
