## Why

With a balance of `0.77 USD` and a committed stake of `4.00 USD` (~5x the balance), the trade page reads as fully tradeable: the Buy button is enabled, it quotes `Payout 7.69 USD`, and nothing anywhere on the page says the trade cannot be afforded ([#1245](https://github.com/deriv-com/derivatives-trader/issues/1245)). The user only finds out after tapping **Buy** — the client sends a real `buy`, the server rejects it with `InsufficientBalance`, and the error sheet appears a round-trip later.

The gap is structural, not cosmetic. `PurchaseButton` derives its insufficient-balance state **only** from a server rejection: `is_insufficient_balance` is true when `proposal_info[type].error_code === 'InsufficientBalance'` or `common.services_error.code` is that code (`packages/trader/src/AppV2/Components/PurchaseButton/purchase-button.tsx:317-319`). `proposal` is a pricing call — it priced `4.00` happily and returned the `7.69` payout — so neither source fires before the buy, `is_disabled` stays false (`:320-323`), and the button quotes a payout for a contract the account cannot pay for.

The stake-input hint added by [#1209](https://github.com/deriv-com/derivatives-trader/pull/1209) does not cover this. It only renders **inside** the stake sheet/modal while an amount is being drafted (`stake-input.tsx:584-589`, `stake-input-desktop.tsx:455`). Once a stake is committed — from the desktop modal, whose footer Save is deliberately never blocked; from a persisted `amount`; from trade URL params; or simply because the balance fell below an already-good stake after some losing trades — the trade page itself carries no balance signal at all.

## What Changes

- **The Buy control gains a balance gate.** When the amount the account will actually be charged exceeds the available balance, **Buy** is disabled and an inline reason is rendered directly above it. This is a deliberate, issue-driven departure from the codebase's previous "inform, don't disable" stance on `InsufficientBalance` (`purchase-button.tsx:344`, and the corresponding `CLAUDE.md` **Gotchas** entry, both updated by this change).
- **The gate compares the charge, not the drafted stake.** It reads `proposal_info[trade_type].stake`, which is `proposal.ask_price.toString()` (`packages/trader/src/Stores/Modules/Trading/Helpers/proposal.ts:87-89`, returned at `:134`) — the exact sum the buy will debit. Because `ask_price` is the charge on every basis and already includes multiplier commission and the deal-cancellation fee (`purchase-button-content.tsx:50-53`), the Buy gate needs no `basis === 'stake'` guard and covers the two cases the stake hint documented as accepted limitations.
- **No payout is quoted for a trade that cannot be bought.** While the gate is active, `PurchaseButtonContent` renders its existing `-` placeholder in the value slot instead of the payout / total-cost amount (`purchase-button-content.tsx:101-108`) — the same treatment an errored proposal already gets. No new visual state.
- **The inline reason reuses the existing translated sentences.** `getInsufficientBalanceMessage` (`packages/trader/src/AppV2/Utils/insufficient-balance-utils.tsx:29-63`) already resolves `Balance is empty. Deposit funds to buy this contract.` for `balance <= 0` and `You only have {{balance}} {{currency}} left. Try a lower stake.` for `0 < balance < charge`, at correct per-currency precision. The Buy gate becomes its third consumer — **no new strings, no new copy to translate**.
- **Fail-safe by construction.** An unreadable balance (the `client.balance` getter returns `undefined` until the account resolves — `packages/core/src/Stores/client-store.js:125-130`), an unpriced or errored proposal (`stake` is `''`), a logged-out user, or an account switch in flight all leave the gate off and `PurchaseButton` behaving exactly as it does today.
- **The server-driven path is untouched.** `is_insufficient_balance` keeps its two existing sources, keeps leaving **Buy** enabled, and keeps opening `ServiceErrorSheet` with **Deposit now** / **OK** on click — that remains the authority for every rejection the client cannot predict (balance not yet known, non-balance limits, race between the last proposal and the buy).
- **NOT capping the stake.** The issue offers "cap the stake at the available balance" as an alternative; it is rejected — see `design.md`. Silently rewriting a user's committed stake is worse than telling them, and a cap is frequently invalid anyway (the reported `0.77 USD` sits below the typical `1.00 USD` minimum stake, so the capped value could not be bought either).
- No API, store-shape, validation-rule, routing, persistence or dependency change. No feature flag.

## Capabilities

### New Capabilities

- `balance-aware-buy-gate`: The contract that the **Buy** control on the trade page is balance-aware — it disables itself and states an inline reason when the proposal's charge exceeds the available balance, stops quoting a payout it cannot deliver, and stays completely inert whenever the balance or the charge cannot be read. It also fixes the boundary with the existing server-driven `InsufficientBalance` path, which keeps **Buy** enabled and keeps owning every rejection the client cannot predict.

### Modified Capabilities

<!-- None. `openspec/specs/` holds allow-equals-toggle, barrier-input, barrier-range-errors,
     contract-details-chart, duration-end-time-fields, market-descriptions, market-info-sync,
     positions-drawer and themed-scrollbars — none of which describe the Buy control or
     insufficient-balance behaviour. The closely related `balance-aware-stake-warning` capability is
     still an unarchived change (`openspec/changes/default-stake-presets-allow-values-above-the-
     available-balance-without-a-deposit-gate/`), not a published spec, so it cannot be declared
     modified here; this change adds no requirement to it and leaves both stake inputs untouched. -->

## Impact

**New code**

- `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button-balance-message.tsx` — the inline reason rendered above **Buy**. A presentational sibling of the existing `purchase-button-content.tsx`, taking the resolved `React.ReactNode` message as a prop.
- `packages/trader/src/AppV2/Components/PurchaseButton/__tests__/purchase-button-balance-message.spec.tsx` — render/no-render cases for the new component.

**Modified code**

- `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button.tsx` — read `balance` and `currency` from the already-destructured `client` (`:45-51`); derive `is_stake_above_balance` + `balance_message` from `info.stake`; add the flag to `is_button_disabled` (`:328`); render `<PurchaseButtonBalanceMessage />` as a Fragment sibling **before** `.purchase-button__wrapper`, so desktop's `.trade-params__content > .purchase-button__wrapper` direct-child rule (`TradeParameters/trade-parameters.scss:46-49`) keeps matching.
- `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button-content.tsx` — one new optional prop that routes the value slot to the existing `-` placeholder while the gate is active.
- `packages/trader/src/AppV2/Components/PurchaseButton/purchase-button.scss` — layout for the message row on both breakpoints.
- `packages/trader/src/AppV2/Components/PurchaseButton/index.ts` — unchanged public export; the new component is internal to the directory.
- `CLAUDE.md` — the **Gotchas** entry stating the purchase button "allows attempts with insufficient balance … doesn't disable button" is now only true of the server-driven path; updated to describe both.

**Tests**

- `packages/trader/src/AppV2/Components/PurchaseButton/__tests__/purchase-button.spec.tsx` — new `describe` for the gate. Existing cases are unaffected: `mockStore`'s `client.balance` defaults to `''` (`packages/stores/src/mockStore.ts:31`), which `parseAmount` maps to `NaN`, so the gate is off in every current test.

**Explicitly unaffected**

- `packages/trader/src/AppV2/Utils/insufficient-balance-utils.tsx` — consumed as-is; no signature or branch change.
- `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx`, `stake-input-desktop.tsx` — the stake hint and the mobile/desktop Save divergence are unchanged. In particular the desktop modal's footer Save keeps committing an unaffordable stake; the new Buy gate is what makes that state visible on the trade page.
- `packages/trader/src/AppV2/Components/ServiceErrorSheet/service-error-sheet.tsx` — unchanged title, message (`mapErrorMessage`) and actions.
- `packages/shared/src/utils/error-mapping/error-message-mapper.ts:177-178` — `Your account balance is insufficient to buy this contract.` stays the server-path copy.
- `packages/trader/src/AppV2/Hooks/useRunControls.ts:95-105` — the automation **Run** control keeps its own `Number(balance) <= 0` gate; extending it to stake-above-balance is out of scope (a run's stake evolves over the session).
- `packages/trader/src/Stores/Modules/Trading/trade-store.ts` — no validation rule is added. Any non-empty `validation_errors` entry tears down every proposal subscription and empties `proposal_info` (`:2135-2145`), which would blank the price stream and strand the button on its skeleton; see `design.md`.
- `packages/reports/src/Components/Elements/Modals/ServicesErrorModal/insufficient-balance-modal.tsx` — out of scope.

**Translations** — no new strings. Both sentences already ship via `@deriv-com/translations` + Crowdin CI from the `#1209` work; there is no local extraction step to re-run.
