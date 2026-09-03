## Why

On Multipliers, enabling **Stop loss** makes the **Stop out** row vanish from the Stake action sheet ([issue #1305](https://github.com/deriv-com/derivatives-trader/issues/1305)). The row is gated on `!has_stop_loss` in `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-details.tsx:111`:

```ts
is_displayed: !has_stop_loss && is_multiplier && !should_show_payout_details,
```

On mobile that gate removes the information entirely. `packages/trader/src/AppV2/Components/TradeParameters/trade-parameters.tsx:109-124` renders the below-params info rows — `MultipliersInformation`, which is the desktop home of Stop out / Stop out level — only when `!isMobile`, and its own comment states why: _"on responsive these below-params info rows are dropped … the rest already live in an action sheet (Stake: Stop out, Stop out level …)"_. So the Stake sheet is the sole mobile surface for Stop out, and the gate makes it unreachable — including the tappable **Stop out** explanation page inside the sheet carousel (`stake-mobile.tsx:26,110-160`), which is opened from that very label.

The gate is also internally inconsistent: the desktop `MultipliersInformation` component shows Stop out unconditionally — it never reads `has_stop_loss` (`multipliers-information.tsx:19-130`) — so desktop keeps the figure with SL set while the Stake sheet drops it. The gate dates back to the original V2 Stake implementation (commit `4fdc5d2c0d`, [#16486](https://github.com/deriv-com/derivatives-trader/pull/16486)), where the same block also carried a Commission row since removed in `c2c9fd19a6`; nothing since has revisited it.

Hiding it is wrong on the product side too. Stop out is the platform's own liquidation point — a function of stake and multiplier — while Stop loss is an _additional, user-chosen_ limit that may sit anywhere between zero and the stop out. Suppressing the stop out once an SL exists hides the harder of the two limits precisely when a user is reasoning about loss.

## What Changes

- **Show the Stop out row on the Stake surface whenever the multiplier details are shown**, regardless of whether Stop loss is enabled. The row's display condition becomes the same as the Stop out level row beside it (`is_multiplier && !should_show_payout_details`).
- **Remove the now-unused `has_stop_loss` prop** from `TStakeDetailsProps` and from its two call sites (`stake-input.tsx`, `stake-input-desktop.tsx`), so no caller keeps threading a value nothing reads.
- **Restore the in-sheet Stop out explanation page** on mobile: with the label rendered again, `STOP_OUT_PAGE` in the stake carousel is reachable, and the percentage-derived description ("…when your loss reaches N% of your stake") is shown as before.
- **Keep everything else about the two rows unchanged**: order (Stop out, then Stop out level), the currency symbol on the amount and its absence on the level, `Math.abs()` on the negative `order_amount`, the `-` placeholder while the stake input is empty or the value is unknown, and the desktop-vs-mobile plain-label / tappable-label split.
- **Add regression coverage** asserting that both rows render with `has_stop_loss: true`, that the Stop out explanation is still reachable in that state, and that a non-multiplier trade type still renders neither row.

No breaking changes. No store, API, proposal-request, analytics, copy or dependency changes — the values displayed already flow through `details.stop_out` and the store's `stop_out_level` in the SL case; only the visibility condition changes.

## Capabilities

### New Capabilities

- `multipliers-stop-out-info`: The Stop out and Stop out level information shown for Multipliers — where each is displayed (mobile Stake action sheet, desktop Stake popover, desktop below-params row), that both stay visible independently of the Take profit / Stop loss risk-management settings, how each value is formatted, what is shown while a value is unavailable, and the explanation each label opens.

### Modified Capabilities

<!-- None. `openspec/specs/` currently holds allow-equals-toggle, barrier-input,
     barrier-range-errors, contract-details-chart, duration-end-time-fields,
     market-descriptions, market-info-sync, positions-drawer and themed-scrollbars —
     none of which covers the Stake sheet or multiplier information rows. The in-flight
     `stake-defaults`, `balance-aware-stake-warning` and `action-sheet-header-actions`
     capabilities live under `openspec/changes/` and are not promoted to `openspec/specs/`,
     so they cannot be delta'd here; this change is additive to them and contradicts none
     of their requirements. -->

## Impact

- **Code (the fix):** `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-details.tsx` — line 111 drops `!has_stop_loss` from the Stop out row's `is_displayed`; `has_stop_loss` leaves `TStakeDetailsProps` (line 13) and the destructured parameter list (line 42).
- **Call sites (prop removal only):** `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx:660` and `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input-desktop.tsx:488` stop passing `has_stop_loss={has_stop_loss}`; each also drops `has_stop_loss` from its `useTraderStore()` destructuring (`stake-input.tsx:167`, `stake-input-desktop.tsx:149`) if nothing else in the file uses it.
- **Surfaces affected:** the mobile Stake action sheet (`stake-mobile.tsx` → `stake-input.tsx` → `StakeDetails`) and the desktop Stake popover's input tab (`stake-desktop.tsx` → `stake-input-desktop.tsx` → `StakeDetails`). Both mount the same `StakeDetails`.
- **Unchanged, but explains the values:** `packages/trader/src/Stores/Modules/Trading/trade-store.ts:2327-2336` sets `stop_out` (the loss amount) and `stop_out_level` (the price) from the streaming proposal with no reference to `has_stop_loss`; `packages/trader/src/Stores/Modules/Trading/Helpers/proposal.ts:182-190` adds `limit_order.stop_loss` to the request when SL is on, and the response still carries `limit_order.stop_out`, which is what `stake-input.tsx:322-339` reads into `details.stop_out`.
- **Unchanged sibling (the consistency reference):** `packages/trader/src/AppV2/Components/TradeParameters/MultipliersInformation/multipliers-information.tsx` — the desktop below-params row, already unconditional.
- **Tests:** `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake-details.spec.tsx` (its `base_props` currently pins `has_stop_loss: false`, which is exactly why the defect was never caught) and `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake.spec.tsx`.
- **Out of scope:** the Risk management sheet itself, the Stop loss validation and commit path, the Contract Details page's stop-out display, the purchase button, and any change to the stop out _value_ or its label.
