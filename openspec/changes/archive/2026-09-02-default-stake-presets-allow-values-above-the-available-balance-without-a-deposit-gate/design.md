## Context

**Scope was narrowed after the first pass.** The initial implementation also rewired the insufficient-balance gate (`ServiceErrorSheet`, `packages/trader/src/AppV2/Components/ServiceErrorSheet/service-error-sheet.tsx`) to render the same balance-aware copy on **Buy** and automation **Run**. Review feedback was that the new message belongs on the stake inputs only, not the gate — so that part was reverted: `ServiceErrorSheet` and `service-error-description.tsx` are back to computing and rendering `mapErrorMessage()`'s output unconditionally, on both breakpoints, exactly as they did before this change. The rest of this document (and the `insufficient-balance-gate` capability originally proposed alongside `balance-aware-stake-warning`) reflects that reduced scope: only the stake inputs' inline hint is in scope.

The hint lives in two places — `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx` (mobile) and `stake-input-desktop.tsx` (desktop) — and is resolved through one pure helper, `getInsufficientBalanceMessage` (`packages/trader/src/AppV2/Utils/insufficient-balance-utils.tsx`), so the two breakpoints cannot disagree about the string.

## Goals / Non-Goals

**Goals:**

- Warn at stake selection, driven by the value the user is looking at (the local display amount), so the flow stops reading as valid up to the last step.
- Correct per-currency precision, driven by the currency config rather than a hardcoded `2`.
- A hint that is impossible to show wrongly: unknown balance, unaffordable-but-unknown stake, or an affordable stake all render no hint.
- Never mask a real proposal or format error. On desktop, never block **Save** either — the hint is purely informational there. On the mobile action sheet, block **Save** for exactly as long as the hint is showing (see "The mobile action sheet blocks Save; the desktop modal does not" below).

**Non-Goals:**

- Changing the insufficient-balance gate (`ServiceErrorSheet`) at all — its title, actions, and message computation are unchanged on **Buy** and automation **Run**. (This was in scope in an earlier iteration; see Context above for why it was reverted.)
- Changing `mapErrorMessage` (no store access; shared with `@deriv/reports`).
- Changing `@deriv/reports`' `InsufficientBalanceModal`.
- Clamping or filtering the preset chips to affordable values.
- Disabling **Buy** on an unaffordable stake — that stays the codebase's established "inform, don't disable" stance, unchanged by this document. (Disabling the mobile action sheet's **Save** on an unaffordable stake is, after review, in scope — see below.)

## Decisions

### The helper is consumed only by the two stake inputs

`getInsufficientBalanceMessage({ balance, stake, currency, fallback })` is called from `stake-input.tsx` and `stake-input-desktop.tsx` with `fallback: null`, so an out-of-range branch renders nothing rather than falling back to a gate message — there is no gate consumer to keep in sync with. The helper's shape (a `fallback` parameter) is a holdover from the reverted gate integration; it is kept because both call sites already rely on "no branch matched → `null` → no hint" and changing the signature would touch both inputs for no behavioural gain.

### The stake compared is the local display amount, and only on `stake` basis

The hint reads `displayAmount` (`stake-input.tsx`'s own drafted value), not `proposal_request_values.amount` and not `TradeStore.amount`. This is what makes it appear the instant a preset is tapped or a digit is typed, with no proposal round-trip — `proposal` is a pricing call that never rejects on balance, so waiting for it would reintroduce the same "reads as valid until the last step" problem this change fixes.

That amount is the sum being charged only while `TradeStore.basis` is `stake`, so the hint is guarded on exactly that. On `payout` basis the field holds a target payout and the charge is the lower `ask_price` — comparing it against the balance would warn about a trade the user can afford. This is reachable rather than theoretical: `purchase-button.tsx:196-201` switches `basis` to `stake` for every trade type **except** Rise/Fall, and `basis` is persisted to localStorage (`trade-store.ts:488`). `multiplier` and the empty string (before the contract config resolves) are treated the same way — unknown semantics stay silent rather than risk a wrong number. The `multiplier` literal is not the Multiplier product, which declares `basis: ['stake']`; it comes only from the Lookback trade types (`LB_CALL`/`LB_PUT`/`LB_HIGH_LOW`, `contract.ts:127,133,139`), which AppV2 does not offer — so that branch is defensive rather than reachable today.

The guard costs nothing in the common case: accumulators, multipliers, turbos and vanillas declare `basis: ['stake']`, and the classic types declare `['stake', 'payout']` and default to the first (`packages/shared/src/utils/constants/contract.ts`), so only a persisted `payout` on Rise/Fall is suppressed.

**Rejected: comparing against `proposal.ask_price`.** It would cover the `payout` case _and_ the multiplier deal-cancellation fee exactly, and the ask price is available whenever the hint renders (a proposal error outranks it). But it costs the hint its immediacy — the entire point of reading the drafted value — and would blank the hint while any proposal is in flight. The `basis` guard keeps the immediacy and gives up a little coverage in exchange for never being wrong.

**Known limitation, accepted:** for a multiplier with deal cancellation, the charged amount is stake + cancellation fee, so balance `5` / drafted stake `5` / fee `0.5` shows no hint (the drafted stake is not above the balance) even though the backend will reject it. The user finds out at **Buy**, where the gate — unchanged by this change — shows its usual message. That is the correct degradation, not a regression: the hint is an early, best-effort signal, and the gate remains the authority.

### Branch order puts the balance guard before the stake requirement

`formatMoney` coerces `undefined`/`NaN` to `"0.00"` (`packages/shared/src/utils/currency/currency.ts:59` — `money = isNaN(+money) ? 0 : Math.abs(+money)`), so an unguarded helper would confidently report a `0.00` balance for an account whose balance simply had not loaded. `client.balance` is a computed getter that returns `undefined` when `current_account.balance` is nullish (`packages/core/src/Stores/client-store.js:125-130`), and it is typed `string | number` (`packages/stores/types.ts:205`), so this is reachable. The finite-number check therefore runs _first_.

Numbers are parsed with `Number(String(v).replace(/,/g, ''))`, the guard already used at `AppV2/Components/AccountHeader/account-header.tsx:87-92`, because balances reach components comma-grouped. `parseAmount` is exported from the helper and consumed by both stake inputs, so this change adds no new copy of the rule; the pre-existing inline copy in `account-header.tsx` is left alone as out of scope.

### The empty-balance case now warns on the stake input too

QA found that a zero (or negative) balance rendered no hint at all while drafting or tapping a preset — the input read as valid right up to **Buy**, the exact problem this change set out to fix. Both stake inputs now surface the helper's empty-balance branch (`Balance is empty. Deposit funds to buy this contract.`) whenever the balance is `<= 0`, alongside the below-stake copy for a funded-but-insufficient balance. The gate at **Buy** is unchanged and still shows its own message; the stake input's hint is an earlier, best-effort signal.

### `.tsx` helper returning a `Localize` element

The helper returns JSX, so the file is `insufficient-balance-utils.tsx` — matching `layout-utils.tsx` and `contract-description-utils.tsx` in the same directory. Both stake inputs accept a `ReactNode` in their `message` slot, and the string must be a single parameterised `Localize` template, which rules out returning a plain string built by concatenation.

### The mobile action sheet blocks Save; the desktop modal does not

The original design rejected blocking **Save** anywhere, reasoning by analogy to **Buy**: it is deliberately left enabled on `InsufficientBalance` and opens the gate on click (`purchase-button.tsx:319-325`, and noted as a gotcha in `CLAUDE.md`). That reasoning still holds for **Buy**, for automation **Run**, and for the desktop stake modal's footer **Save** — none of those are touched here.

Review of the mobile action sheet asked for the opposite on that one surface: the header **Save** (`stake-input.tsx`'s `registerHeaderActions`) is a single, deliberate commit action gated on a dirty-check already (`is_save_disabled`, `stake-input.tsx:559-565`), so folding `balance_hint` into that existing gate is a small, consistent addition rather than a new blocking mechanism — unlike **Buy**, which has no such per-value gate to extend. `onSave` (`stake-input.tsx:483-517`) also short-circuits on `balance_hint` directly, so calling the commit handler bypasses nothing: the balance hint gates the commit itself, not just the header button's disabled state.

The desktop modal keeps the original informing-only behaviour: its footer **Save** (`stake-input-desktop.tsx:499-508`) is disabled only by `is_loading_proposal`/`fe_stake_error`/`stake_error`, unchanged, and `balance_hint` there only feeds the `message`/`status` slot. This is an intentional divergence between the two breakpoints, not an oversight — no desktop regression test pins it down yet, since a desktop Save-blocking implementation is expected in a later change; that future work is the right place to add the desktop-side assertions.

Both surfaces still reuse the existing single `message` slot (`stake-input.tsx:559`, `stake-input-desktop.tsx:455`), ranked below real errors and above the range hint, and both style it with `status: 'error'` — no new component in either case.

Consequence: while the hint shows, the `Range …` hint is hidden, exactly as a real error already hides it. Accepted; the balance is the more urgent fact.

### Preset chips stay balance-blind

Clamping chips to affordable values is rejected. `getStakePresetValues` documents its own contract as "the trade type's base presets filtered to the contract's [min, max] stake limits so only valid values are offered"; the balance is not a validity limit but a fundable one. Clamping would make the chip list shift as the balance moves (and re-derive from multiples of the minimum once fewer than three survive), hiding valid choices from a user who intends to deposit. Note the chips are mobile-only — `stake-input-desktop.tsx` renders no `ValueChips` — so clamping would also make the two breakpoints offer different values.

## Risks / Trade-offs

- **Multiplier deal-cancellation fee can push the charge above the balance while `balance >= stake`.** → No hint shows; the user still meets the (unchanged) gate at **Buy**. Documented above.
- **`client.balance: undefined` (balance not yet loaded).** → No hint shows and no `0.00` renders, matching today's behaviour with no hint at all.
- **Adding `useStore()` to the stake inputs pulls `ClientStore` into a hot component.** → Both are already `observer`-wrapped and re-render on every keystroke; reading two rarely-changing observables adds no meaningful work.
- **Hiding the range hint while the balance hint shows.** → Mirrors existing error behaviour; if content objects, the range hint could move to a second line, which is a layout change and would be a separate task.
- **Copy is taken verbatim from the issue and not yet content-reviewed.** → The string is a single `Localize` template, so a copy revision is a one-line change in one file.
- **The gate's Buy-path message stays a raw backend string, not a translated one, and the automation Run gate keeps its generic message.** → Not a regression (it is today's behaviour, unchanged by this narrower scope). Worth noting as a follow-up candidate if the gate copy is revisited later.
- **Mobile and desktop now disagree on whether the hint blocks Save.** → Deliberate, per post-implementation review (see "The mobile action sheet blocks Save; the desktop modal does not" above), not an inconsistency to reconcile. A future request to bring desktop in line with mobile (or vice versa) is a one-line change per breakpoint — `is_save_disabled`/`onSave` on mobile, the footer `Button`'s `disabled` prop and `onSave` on desktop — but is out of scope here.

## Migration Plan

Not applicable — no data, schema, API or persisted-state change. The change is one informational hint on the two stake inputs, shipped behind no flag; rollback is a straight revert of the two touched components and the new helper.

## Open Questions

Carried in `tasks.md` above the checklist, with a recommended default for each so the plan is implementable as written: stake-vs-ask-price, scope of the preset/validation work, and the balance-equals-stake boundary. (The gate-title and demo-account-copy questions from the original issue no longer apply — the gate itself is out of scope for this change.)
