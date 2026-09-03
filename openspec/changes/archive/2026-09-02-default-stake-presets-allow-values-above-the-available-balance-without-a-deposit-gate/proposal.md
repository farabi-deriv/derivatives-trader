## Why

The insufficient-balance experience in DTrader tells the user nothing actionable ([#1055](https://github.com/deriv-com/derivatives-trader/issues/1055)). The stake flow reads as valid right up to the last step: `getStakePresetValues` clamps the preset chips to the contract's `min_stake`/`max_stake` only (`packages/trader/src/AppV2/Utils/trade-params-utils.tsx:494-519`, consumed at `.../TradeParameters/Stake/stake-input.tsx:374-378`), so a USD 4 account is still offered `1 / 5 / 10 / 20 / 50 / 100`; `onSave` (`stake-input.tsx:477-509`) blocks only on proposal errors, FE format errors and an empty field, and `proposal` is a pricing call that never rejects on balance — so an unaffordable stake saves cleanly and the user only finds out after tapping **Buy**.

**Revised scope.** An earlier iteration of this change also split the **Buy**/automation-**Run** insufficient-balance gate (`ServiceErrorSheet`) into the same two balance-aware states. Review feedback ("the new error message is only intended for the desktop and mobile stake") narrowed that: the gate keeps rendering today's mapped/backend message unconditionally, on every breakpoint and for the automation Run path, exactly as before this change. The balance-aware copy is scoped to the stake input's inline hint only.

## What Changes

- **Warn at the point of stake selection, not only at Buy.** Both stake inputs gain a balance-aware hint in their existing `message` slot (`stake-input.tsx:559`, `stake-input-desktop.tsx:455`) when the drafted stake exceeds the active account's balance — informational only on the desktop modal, and additionally blocking the mobile action sheet's header **Save** for as long as it shows (see the Save bullet below):
    - `balance <= 0` → _"Balance is empty. Deposit funds to buy this contract."_
    - `0 < balance < stake` → _"You only have {{balance}} {{currency}} left. Try a lower stake."_
    - otherwise (an unaffordable-but-unknown stake, an unknown balance, or an affordable stake) → no hint; the input's existing range hint (or a real error) shows as before.
- A new pure helper, `getInsufficientBalanceMessage` in `AppV2/Utils/insufficient-balance-utils.tsx`, selects that copy from the balance, the stake and the currency, and is consumed only by the two stake inputs.
- **Correct per-currency precision.** The balance is rendered with `formatMoney(currency, balance, true)` and `getCurrencyDisplayCode(currency)` (`packages/shared/src/utils/currency/currency.ts:51-76`, `:271-275`), so USD shows 2 dp and crypto up to 8 — no hardcoded decimals. `client.currency` (the account currency the balance is denominated in) is used, not `trade_store.currency`.
- **A single parameterised `Localize` template.** No concatenation, so `{{balance}}`/`{{currency}}` survive extraction.
- **Unknown balance renders no hint, never a malformed sentence.** `client.balance` is a computed getter returning `string | undefined` (`packages/core/src/Stores/client-store.js:125-130`; typed `string | number` at `packages/stores/types.ts:205`) and `formatMoney` silently turns `undefined`/`NaN` into `"0.00"` — so the helper validates the balance _before_ formatting, using the guard already established in `AppV2/Components/AccountHeader/account-header.tsx:87-92`.
- **Save is blocked on mobile while the hint is showing; the desktop modal's Save is not.** The codebase's established stance is to inform rather than disable (the Buy button stays enabled on `InsufficientBalance` by design: `purchase-button.tsx:319-325`), and the desktop stake modal keeps that stance unchanged — a user may legitimately set a stake there and then deposit. Post-implementation review asked for the opposite on the mobile action sheet specifically: its single header **Save** action is disabled for as long as `balance_hint` is showing, and `onSave` itself is a no-op while it shows (not just the header button), re-enabling the moment the drafted amount is affordable again. See `design.md`'s "The mobile action sheet blocks Save; the desktop modal does not" for the rationale for the divergence. Preset chips are **not** clamped to the balance (see `## Open Questions` in `tasks.md`).
- **The insufficient-balance gate (`ServiceErrorSheet`) is unchanged.** It keeps rendering `mapErrorMessage()`'s output as-is on both breakpoints and for the automation Run path — no balance-aware substitution there. `service-error-description.tsx`'s `services_error_message` prop is back to `string` (its original type).
- No API, store-shape, routing, persistence or dependency changes. No feature flag: this is one informational hint on the two stake inputs.

## Capabilities

### New Capabilities

- `balance-aware-stake-warning`: The contract that the stake input warns about an unaffordable stake at selection time rather than at **Buy** — a balance-aware hint on both the mobile and desktop stake inputs, which never suppresses a real proposal error. It blocks **Save** on the mobile action sheet for as long as it shows; the desktop modal's **Save** is never disabled by it. The insufficient-balance gate itself (**Buy** / automation **Run**) is out of scope for this change and keeps its existing mapped/backend message unconditionally.

### Modified Capabilities

<!-- None. `openspec/specs/` holds allow-equals-toggle, barrier-input, barrier-range-errors, contract-details-chart, duration-end-time-fields, market-descriptions and positions-drawer — none of which describe insufficient-balance messaging or stake-input feedback. -->

## Impact

**New code**

- `packages/trader/src/AppV2/Utils/insufficient-balance-utils.tsx` — the pure helper `getInsufficientBalanceMessage({ balance, stake, currency, fallback })`, consumed by the two stake inputs. `.tsx` because it returns a `<Localize>` element (matching the existing `layout-utils.tsx` / `contract-description-utils.tsx` naming and extension convention).
- `packages/trader/src/AppV2/Utils/__tests__/insufficient-balance-utils.spec.tsx` — unit tests for every branch.

**Modified code**

- `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx` — mobile: add the balance hint to the `message` chain at `:559`, leaving `status` (`:566`) and `is_save_disabled` (`:530-536`) untouched. Needs `useStore()` from `@deriv/stores` for `client.balance`/`client.currency` (the component currently reads `useTraderStore()` only, `:159`).
- `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input-desktop.tsx` — desktop: the same hint in its `message` chain at `:455`. (This file renders no preset chips — `getStakePresetValues` is mobile-only — so only the hint applies.)

**Tests**

- `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/` — currently `stake.spec.tsx` and `stake-details.spec.tsx`; the stake-hint cases land here.

**Explicitly unaffected**

- `packages/trader/src/AppV2/Components/ServiceErrorSheet/service-error-sheet.tsx` and `service-error-description.tsx` — reverted to their pre-change behaviour; the gate keeps showing `mapErrorMessage()`'s output unconditionally on both breakpoints, with the same title and actions (**Deposit now** for real, **OK** for virtual).
- `packages/shared/src/utils/error-mapping/error-message-mapper.ts:177` — left as the generic fallback; it has no store access and is shared with `@deriv/reports`.
- `packages/reports/src/Components/Elements/Modals/ServicesErrorModal/insufficient-balance-modal.tsx` — out of scope; keeps the mapped message.
- `packages/trader/src/AppV2/Hooks/useRunControls.ts:95-105` — no code change; the automation Run gate is served by the unchanged `ServiceErrorSheet` and shows the same message it always did.
- `packages/trader/src/AppV2/Utils/trade-params-utils.tsx` — `getStakePresetValues` keeps its contract-limit-only inputs.

**Translations** — the repo has no local extraction step (strings ship via `@deriv-com/translations` + Crowdin CI), so "extracted with placeholders intact" means authoring them as single `Localize`/`localize` templates; there is no generated file to regenerate.
