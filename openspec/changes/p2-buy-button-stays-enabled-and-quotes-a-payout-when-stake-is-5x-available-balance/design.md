## Context

See `proposal.md` → **Why** for the motivation and the reported case. What shapes the approach:

- `PurchaseButton` (`packages/trader/src/AppV2/Components/PurchaseButton/purchase-button.tsx`) is a single self-contained unit rendered as one node by both containers — mobile at `Components/TradeParameters/trade-parameters-container.tsx:44-48`, desktop at `Containers/Trade/trade-desktop.tsx:175`. Anything added inside it lands on both breakpoints with no container plumbing.
- Its top-level return is already a `React.Fragment` (`:284-398`), and desktop styles the button by direct-child selector — `.trade-params__content > .purchase-button__wrapper { flex-shrink: 0 }` (`Components/TradeParameters/trade-parameters.scss:46-49`). A new node must therefore be a **Fragment sibling** of `.purchase-button__wrapper`, never a wrapper around it.
- `ClosedMarketMessage` is the established precedent for an inline message in the same slot: both containers render it immediately before `PurchaseButton`, and it self-hides by returning `null` (`Components/ClosedMarketMessage/closed-market-message.tsx:103`).
- `proposal_info[type].stake` is `proposal.ask_price.toString()` (`Stores/Modules/Trading/Helpers/proposal.ts:87-89`, returned `:134`) and is `''` when there is no priced proposal. `purchase-button-content.tsx:50-53` documents that for multipliers this value already includes base stake + commission + deal-cancellation fee.
- `getInsufficientBalanceMessage` and `parseAmount` (`AppV2/Utils/insufficient-balance-utils.tsx`) already resolve both balance sentences at per-currency precision and already guard `formatMoney`'s `undefined → "0.00"` coercion. Its current consumers are the two stake inputs.
- A deposit affordance exists on the trade page independently of **Buy** on both breakpoints: `AppV2/Components/AccountHeader/account-header.tsx:104,178-190` on desktop, and the shell header's `packages/core/src/App/Components/Layout/Header/account-actions.tsx:50,73-90` on mobile.

## Goals / Non-Goals

**Goals:**

- One implementation, both breakpoints, no container edits and no change to the existing desktop direct-child CSS contract.
- Compare the sum that will actually be debited, so the gate is basis-agnostic and fee-accurate without a `basis` guard.
- Reuse the existing helper and its two existing sentences, so no string is added and the Buy gate and the stake hint can never report different balances.
- Fail open: every unreadable input leaves `PurchaseButton` byte-for-byte as it behaves today.

**Non-Goals:**

- Any change to the stake inputs, their hint, or the mobile/desktop Save divergence.
- Any change to `ServiceErrorSheet`, `mapErrorMessage`, or the automation **Run** control.
- A new deposit call-to-action. See "The inline reason is text; deposit stays where it already is".
- A store-level rule, computed, or observable. See "The gate is component-level, not a validation rule".

## Decisions

### The compared amount is `proposal_info[trade_type].stake`, not `TradeStore.amount`

The stake-input hint had to read the drafted amount because its whole point was immediacy — it fires before any proposal round-trip, and `proposal` never rejects on balance. `PurchaseButton` has the opposite constraint: it is only meaningfully live once a proposal exists (it renders the payout from that same `info` object), so the price is already in hand. Reading `info.stake` therefore costs nothing and buys three things the drafted amount cannot give:

1. **Basis independence.** `ask_price` is the charge whether `basis` is `stake` or `payout`. The hint needed `basis === 'stake'` to avoid warning about an affordable Rise/Fall trade whose field holds a target payout; the Buy gate needs no such guard and so covers `payout` basis correctly instead of going silent on it.
2. **Fee accuracy.** Multiplier commission and the deal-cancellation fee are inside `ask_price`. The hint documented `balance 5 / stake 5 / fee 0.5` as an accepted blind spot; here it is simply caught.
3. **Self-consistency.** The quote being suppressed and the affordability verdict come from the same `info` object, so the button cannot show a payout while disagreeing about whether it is buyable.

**Rejected: `TradeStore.amount`.** Needs the `basis` guard, misses the fees, and is not what gets debited.

**Rejected: a dedicated balance-check API call.** No such endpoint is used anywhere in this codebase, it would add latency to a hot control, and `ask_price` already answers the question.

### The gate is component-level, not a validation rule

Adding a `balance` rule to `getValidationRules()`'s `amount` entry (`Stores/Modules/Trading/Constants/validation-rules.ts:21-26`) looks attractive — `useTradeError({ error_fields: ['stake','amount'] })` would light up the Stake chip on both breakpoints (`Stake/stake-mobile.tsx:207`, `stake-desktop.tsx:134`) and `TradeErrorSnackbar` already listens on `amount`. It is rejected because `requestProposal()` tears down **all** proposals on any non-empty `validation_errors` entry (`trade-store.ts:2135-2145`): it calls `forgetAllProposal()` and empties `proposal_info`, `purchase_info` and `proposal_requests`.

That would be self-defeating and actively worse:

- With `proposal_info` empty, `info.stake` is gone — the gate's own input disappears, so the rule cannot sustain itself.
- `is_disabled` reads `info.has_error`, which is `false` on an empty `info`, so **Buy would stay enabled** — the exact bug — while `PurchaseButtonContent` shimmers its skeleton forever (`purchase-button-content.tsx:101-108`).
- The price stream would stop for a user who is merely over budget, blanking the payout, the chart's price display and the stake sheet's details.

A component-level derivation keeps proposals flowing, which is what makes the "affordable again the moment the charge drops" behaviour work.

### The message is a Fragment sibling rendered above `.purchase-button__wrapper`

`PurchaseButton` already returns a Fragment, and Fragments emit no DOM, so a sibling node keeps `.trade-params__content > .purchase-button__wrapper` matching on desktop and keeps the mobile `section.trade-params--minimized` stack unchanged. Wrapping the button in a new div would silently break that direct-child rule — the failure mode is a squashed Buy row, which is easy to miss in review.

The node is its own file, `purchase-button-balance-message.tsx`, mirroring the existing `purchase-button-content.tsx` sibling convention rather than growing the 400-line `purchase-button.tsx`. It is purely presentational: it takes the already-resolved `React.ReactNode` and returns `null` when there is nothing to say, exactly like `ClosedMarketMessage`.

It renders only in the non-accumulator branch. The `has_open_accu_contract` branch is a **Close** control for an open position (`purchase-button.tsx:286-303`), not a purchase — a balance message there would be nonsense.

### The payout is withheld via the existing `-` placeholder, not a new state

`PurchaseButtonContent` already has a three-way value slot: the amount when priced, `-` once the proposal has errored, and a skeleton while in flight (`:101-108`). The gate routes to the existing `-` branch through one new optional prop. This is deliberate reuse over invention:

- `-` already reads as "no amount to show here", and its comment records that the skeleton must never be reachable in a terminal state — a shimmering payout under a permanently disabled button would be that bug again.
- The basis label (`Payout` / `Total cost` / `Max payout`) is kept, because `:69-74` records that hiding the label alongside a missing amount is what produced the blank-row regression in #1142.

**Rejected: leaving the payout visible.** The issue names the quote as part of the defect, and a payout under a disabled button is a promise the account cannot collect.

### The inline reason is text; deposit stays where it already is

Disabling **Buy** removes the click that used to open `ServiceErrorSheet`, and with it that sheet's **Deposit now** button — for the client-detectable case only. This is acceptable rather than a regression to design around, because a **Deposit** button is already on screen on both breakpoints (`account-header.tsx:178-190` on desktop, `core/.../account-actions.tsx:73-90` on mobile), so the user is not stranded.

**Rejected: a Deposit action inside the inline message.** It needs the `getBrandUrl()` + `sendBridgeEvent('trading:transfer', …)` + currency + language redirect, which already exists in two copies (`service-error-sheet.tsx:63-70`, `account-header.tsx:120-126`). Adding a third — or extracting a util and rewiring tested components — is more change than the issue asks for, and it would need its own virtual-account branch (a demo account cannot deposit; the existing sheet shows **OK** instead). If review wants the CTA inline it is additive on top of this change.

### `client.balance` / `client.currency`, parsed through the existing guard

The balance is the account's, so it comes from `ClientStore` — `client.balance` and `client.currency`, aliased to avoid colliding with `useTraderStore()`'s own `currency` already destructured at `purchase-button.tsx:64`. `PurchaseButton` already destructures `client` from `useStore()` (`:45-51`), so this is an additive read on an `observer` component that re-renders on every price tick anyway.

`parseAmount` is imported from the helper rather than re-implemented: `Number('')` is `0`, not `NaN`, and balances reach components comma-grouped (`insufficient-balance-utils.tsx:12-13`). The finite check must precede any formatting because `formatMoney` coerces `undefined`/`NaN` to `"0.00"` — an account whose balance has not loaded must never be reported as empty. `client.balance` genuinely returns `undefined` before the account resolves (`packages/core/src/Stores/client-store.js:125-130`).

### A zero balance engages the gate; an unknown balance does not

`getInsufficientBalanceMessage` orders its branches so `balance <= 0` resolves before the stake is read (`insufficient-balance-utils.tsx:41-48`). The Buy gate keeps that: a readable `0` disables **Buy** even before a price arrives, since no charge can be met from it. This matches the automation **Run** control, which already refuses to start at `Number(balance) <= 0` (`AppV2/Hooks/useRunControls.ts:95-105`) — so the two action controls agree instead of diverging.

An unreadable balance is the opposite case and stays inert, per the spec's inert-states requirement.

### `is_switching_account` suppresses the message

`ui.is_switching_account` already disables **Buy** (`purchase-button.tsx:323`), but the balance in hand mid-switch may still be the previous account's. Suppressing the message (not just relying on the button already being disabled) avoids quoting a number that belongs to a different account for the duration of the switch. Cheap, and it removes the only way this change can display a wrong figure.

### The server path keeps `Buy` enabled — the two mechanisms are not merged

`is_insufficient_balance` (`:317-319`) is left exactly as it is: **Buy** stays enabled and the click opens the sheet. Folding it into the new gate would look tidier but would delete the **Deposit now** flow for the cases the client cannot predict — a rejection while the balance is still `undefined`, a non-balance limit surfacing under the same code, or a balance that moved between the last price and the buy. Two mechanisms with a clear boundary (client-provable vs. server-decided) is the honest model; the spec's last-but-one requirement pins that boundary down so it cannot drift.

## Risks / Trade-offs

- **Reverses a documented deliberate stance.** `CLAUDE.md`'s **Gotchas** entry states the purchase button does not disable on insufficient balance. → The issue asks for exactly this reversal, and the reversal is scoped to the client-provable case only; the entry is rewritten in the same change to describe both paths, so the next reader is not misled.
- **The sheet's `Deposit now` CTA is no longer reached in the gated case.** → The header's **Deposit** button is present on both breakpoints; recorded as an accepted trade-off above, with the inline-CTA option costed out.
- **A stale `ask_price` could gate a trade that is affordable at the current price** (balance credited, or the price moved, between ticks). → Self-correcting on the next proposal tick, which arrives continuously; nothing is committed or sent, so the worst case is a briefly disabled button.
- **A stale `client.balance` could gate a trade after a deposit lands.** → Balance is a subscribed observable; the message and the disable clear on the next update without any user action. Related known issue: the balance action sheet not showing the latest balance is tracked separately (`openspec/changes/account-balance-action-sheet-does-not-show-the-latest-balance/`) and is not made worse here.
- **Demo accounts see `Balance is empty. Deposit funds to buy this contract.` at zero balance**, though a virtual account resets rather than deposits. → Pre-existing copy: the same sentence already shows in the stake inputs, and the server sheet says much the same. Recorded as an open question with a default rather than silently adding a virtual-account string.
- **Automation Run and Buy now differ**: Run blocks only at `balance <= 0`, Buy blocks at `charge > balance`. → Deliberate; a run's stake evolves over the session, so a single opening charge is not the right thing to gate it on. Called out in the proposal's "Explicitly unaffected".
- **Two-line message wrapping could grow the mobile trade-params sheet upward.** → The sheet is `position: fixed` with content-driven height (`trade-parameters.scss:58-77`), the same way `ClosedMarketMessage` already grows it; the SCSS task pins a single-line-first layout and the manual check covers the longest translation.

## Migration Plan

Not applicable — no data, schema, API, or persisted-state change, and no feature flag. Rollback is a straight revert of `purchase-button.tsx`, `purchase-button-content.tsx`, `purchase-button.scss`, the new component and its spec, and the `CLAUDE.md` entry.

## Open Questions

Carried in `tasks.md` above the checklist, each with a recommended default so the plan is implementable as written: demo-account copy at zero balance, and whether the Buy gate should later be mirrored onto the automation **Run** control.
