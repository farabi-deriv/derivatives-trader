# Design — Commission alongside Stop out level on Multipliers

## Context

Two components render the Multipliers "information" figures today, and both were rewritten by #1107
when Commission was swapped for Stop out level:

| Surface                                     | Component                | Rendered when                                                                          |
| ------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| Information rows under the trade parameters | `MultipliersInformation` | desktop only — `trade-parameters.tsx:114` gates the block on `!isMobile`               |
| Stake editor details                        | `StakeDetails`           | inside `stake-input.tsx` (mobile action sheet) and `stake-input-desktop.tsx` (popover) |

Each already renders exactly the two rows this change extends, so the work is additive: one more
entry in each list, fed from a field the proposal already carries.

Where each figure comes from today:

- `MultipliersInformation` reads `proposal_info` straight from `useTraderStore()`. Stop out amount
  uses an Up→Down fallback (`any_proposal`), Stop out level is taken from the selected side only
  because it is direction-specific.
- `StakeDetails` takes the stop out **amount** from its `details` prop (the stake editor's own
  reducer state, re-priced per keystroke) and the stop out **level** live from the store, because the
  level is stake-independent while the amount is not.
- `commission` is already returned by `getProposalInfo`
  (`Stores/Modules/Trading/Helpers/proposal.ts:136,145`) and is therefore present on every
  `proposal_info[<type>]` entry, typed through `TProposalInfo = { [key: string]: ReturnType<typeof
getProposalInfo> }` (`trade-store.ts:258`). #1107 removed the `commission` **store observable**, not
  the proposal field.

Constraint from the repo's own rules: _"derived-but-stored observables with multiple writers"_ are
the documented root cause of a bug streak (memory: trade-state-architecture), and CLAUDE.md's
one-owner-per-parameter rule applies. That rules out re-adding `TradeStore.commission`.

## Goals / Non-Goals

**Goals:**

- Commission visible before purchase on both Multipliers surfaces, beside Stop out and Stop out level.
- Value tracks the stake being drafted in the stake editor, as the stop out amount does.
- Placeholder rather than removal while unpriced, matching each surface's existing convention.
- Zero change to any existing row, to the stake editor's draft/validation/save machinery, or to the
  proposal traffic.

- Restore the dynamic commission formula deleted by #1107, so the figure is explainable rather than
  a bare number (review decision Q2).

**Non-Goals:**

- The commission line inside the multiplier wheel-picker, also deleted by #1107. Its
  `does not render a commission row or explanation page` test
  (`Multiplier/__tests__/multiplier.spec.tsx:173`) must keep passing unchanged.
- Re-introducing `TradeStore.commission` or its error-message-scraping fallback (the regex that
  recovered a commission out of a `stop_loss` validation error string, `trade-store.ts` pre-#1107).
- Commission anywhere outside Multipliers, and any change to the contract-details commission.

## Decisions

### D1 — Read `commission` from `proposal_info`, do not restore a store observable

`getProposalInfo` already surfaces it, so both surfaces can read it from the proposal object they
already hold. Re-adding `commission: observable` to `TradeStore` would add a second derived-but-stored
field written from `onProposalResponse` for no benefit, contradicting the one-owner rule and the
store-shrinking direction already recorded for this repo.

_Alternative considered:_ restore the observable so `createInitialState` can destructure it the way
it destructures `stop_out`. Rejected — `stop_out` is grandfathered; new state should not follow it.
`createInitialState` already receives the whole `trade_store`, so reading
`proposal_info[contract_types[0]]?.commission` there costs one expression.

### D2 — Up→Down fallback for the value, like the stop out **amount**

Commission is identical for `MULTUP` and `MULTDOWN` — the comment #1107 deleted said so explicitly
("commission and cancellation.`ask_price` is the same for MULTUP/MULTDOWN"), and it follows from
commission being a function of stake and multiplier, not direction. So it uses `any_proposal` in
`MultipliersInformation` (selected side, else Up, else Down) and the same `contract_types[0] ??
contract_types[1]` fallback in the stake editors. It must **not** copy the Stop out _level_'s
selected-side-only rule, which exists because a price is direction-specific.

### D3 — In the stake editor, carry commission on `details`, mirroring `stop_out` exactly

Commission scales with the stake, so it belongs on the editor's re-priced reducer state, not on the
store (which holds the committed stake's proposal). Concretely, in both `stake-input.tsx` and
`stake-input-desktop.tsx`:

- add `commission?: string | number` to `TStakeState['details']`;
- seed it in `createInitialState` from `proposal_info`;
- extend the existing `UPDATE_DETAILS` dispatch in `handleProposalResponse` — destructure
  `commission` off the proposal beside `limit_order`, and include it in the same
  `is_multiplier && order_amount` spread that sets `stop_out`;
- extend the `else if (!proposal && is_multiplier)` reset from `{ stop_out: 0 }` to
  `{ stop_out: 0, commission: 0 }`, so a failed re-price clears both.

`StakeDetails` then formats it through the same `getDisplayedValue`/`displayed_values` pipeline
`stop_out` uses (`Math.abs(Number(...))`, `-` when falsy or `is_empty`), which gives requirement
MCD-004's `-` placeholder for free and keeps the currency symbol prefixed by the existing
`row.has_no_currency || row.value === '-'` branch at render.

_Alternative considered:_ read commission from the store in `StakeDetails` the way `stop_out_level`
is read. Rejected — that would freeze the figure at the committed stake while the trader drafts a
different one, which is wrong for a stake-proportional amount.

### D4 — Row order: Commission last

`Stop out` (an amount) and `Stop out level` (a price) are the same concept in two units and read as a
pair; commission is a separate cost. Appending Commission after them also leaves both existing rows'
positions and every existing assertion about them untouched. Confirmed by review decision Q1.

### D5 — Restore the three commission components at their original paths (review decision Q2)

`commission-formula.tsx`, `commission-tooltip.tsx` (+ `.scss`) and `commission-description.tsx`
(+ `.scss`) come back from `c2c9fd19a6^` into
`AppV2/Components/TradeParameters/Multiplier/`, the paths they were deleted from. Restoring in place
keeps the diff an exact inverse of #1107's deletions, preserves blame continuity, and reinstates the
import `../Multiplier/commission-formula` that `stake-details.tsx` already used before #1107.
Their three specs come back with them, unchanged.

_Alternative considered:_ relocate them to `TradeParameters/Shared/` (which exists and already
exports `AutomationLockOverlay`), on the grounds that the wheel-picker — the only in-folder consumer
— is no longer one. Rejected as churn: the components remain Multipliers-only, and a move would turn
a reviewable revert into a rename plus a rewrite.

Two things cannot be restored verbatim:

- **`useOnClickOutside` is no longer exported from `@deriv/components`.** The hook still exists at
  `packages/components/src/hooks/use-onclickoutside.ts`, but `packages/components/src/index.ts:70`
  exports only `TooltipPortal` of the two — the root export was pruned once commission-tooltip was
  its last consumer. Rather than reopen a cross-package export that the ongoing components-shrinking
  work removed, `commission-tooltip.tsx` dismisses its mobile bubble with the same inline
  `mousedown` + `ref.contains(...)` effect AppV2 already uses in
  `AppV2/Components/AccountHeader/account-header.tsx:70-81`. Behaviourally identical for the restored
  tests: the ref wraps both the label and the bubble, so a tap inside keeps it open.
- **The stake used for the percentage** — see D9.

### D6 — Label affordance per surface, gated on the formula being derivable

| Surface          | Desktop                                      | Mobile                                                               |
| ---------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| Information rows | `TooltipPortal` with `<CommissionFormula />` | `ActionSheet` page with the formula — a third `TDescriptionKey`      |
| Stake editor     | `CommissionTooltip` hover portal             | carousel page `COMMISSION_PAGE = 3` with `<CommissionDescription />` |

`MultipliersInformation` already keys its explanations off a `TDescriptionKey` union with a
`descriptions` record and one `renderLabel(key)` that branches desktop-tooltip vs mobile-ActionSheet;
Commission becomes a third key — no new sheet. The mobile Stake sheet already runs a carousel with
`STAKE_PAGE`/`STOP_OUT_PAGE`/`STOP_OUT_LEVEL_PAGE` and a `getSheetTitle()` switch; Commission becomes
`COMMISSION_PAGE = 3` with an `onOpenCommission` prop threaded `stake-mobile.tsx → stake-input.tsx →
stake-details.tsx`, exactly as `onOpenStopOutLevel` is today.

The one place this change **diverges** from its siblings: `stake-input-desktop.tsx` does not pass
`onOpenCommission`, and in that no-handler branch `stake-details.tsx` wraps the label in
`CommissionTooltip` (its pre-#1107 behaviour) rather than leaving it plain. So in the desktop Stake
popover the Commission label reveals the formula on hover while Stop out and Stop out level beside it
stay plain. That asymmetry is deliberate — it is what restoring the formula buys on desktop — and is
carried as an Open Question in `tasks.md` for a reviewer who would rather have consistency.

Everywhere, the affordance is gated on `getCommissionPercentage(...) !== null`: when the formula
cannot be derived the label is plain, non-interactive text and no reveal exists (MCD-009).
`CommissionTooltip` and `CommissionDescription` already self-gate; `MultipliersInformation`'s
`renderLabel` and `stake-details.tsx`'s `renderLabel` must gate explicitly, and
`MultipliersInformation` must also close an open commission sheet when the percentage stops being
derivable, or the controlled `isOpen` survives the conditional unmount and re-opens on its own.

### D7 — Copy comes back with the restored components

- Label: `Commission` — the same string `contract-details.tsx:192` localizes.
- Formula: `<0>{{commission_percentage}}%</0> of (<1/> × {{multiplier}})` and the sentence
  _"Commission is calculated as {{commission_percentage}}% of your stake multiplied by the
  multiplier."_ — both restored verbatim from the deleted components, so their translations already
  exist.
- The static Guide sentence considered for the rejected option
  (`multipliers-trade-description.tsx:55`) is **not** used here; the Guide keeps it, unchanged.

### D8 — Formatting via `formatAmountWithSymbol` / the existing symbol prefix

`MultipliersInformation` already renders the stop out amount with
`formatAmountWithSymbol(currency, Math.abs(stop_out))`; Commission uses the same call. In
`StakeDetails` the symbol is prefixed at render for any row without `has_no_currency`, so Commission
simply omits that flag. Neither surface uses `<Money show_currency />` — `currency-utils.tsx` records
why (it splits symbol and value across elements, breaking text queries).

### D9 — The percentage divisor uses the drafted stake, fixing a flaw in the restored code

`getCommissionPercentage(commission, multiplier, amount)` divides by `multiplier × amount`, and its
own docblock insists `amount` be the **base stake**, not the proposal `ask_price` (which bundles
commission and the DC fee). Pre-#1107 `stake-details.tsx` satisfied that by reading `amount` straight
off the store — but the `commission` it paired with came from `details`, i.e. the stake being
_drafted_. Draft 100 against a committed 10 and the numerator is the drafted stake's commission while
the divisor still holds 10, inflating the displayed percentage ten-fold.

So the restore is not verbatim here: `details` gains a `drafted_amount`, set in the same
`UPDATE_DETAILS` dispatch that sets `commission` (from `proposal_request_values.amount`, already in
scope in `handleProposalResponse`) and seeded from the store's `amount` in `createInitialState`.
`stake-details.tsx` derives the percentage from `details.drafted_amount ?? amount`. Numerator and
divisor then always describe the same stake.

`MultipliersInformation` needs no equivalent: it reads both the commission and the stake from the
committed trade-page proposal, so they already agree.

_Alternative considered:_ restore verbatim and accept the skew. Rejected — it misstates a
percentage on a financial figure, which is precisely what the formula exists to clarify.

## Risks / Trade-offs

- **A third row lengthens both surfaces** → Both are simple flex lists that already vary in length by
  trade type (payout surfaces render up to four rows); no fixed height is involved. The mobile sheet
  pages are sized by `.stake__carousel` to fill the sheet, so page height does not shift.
- **A Playwright locator matching "Stop out" loosely could now match "Commission"** → It cannot:
  `TradeMultipliersPage.ts:94,115` filter on `getByText('Stop out', { exact: true })` and
  `'Stop out level'` exactly, which is why those exact matchers were introduced. No selector change is
  needed; only the two prose comments that claim commission is absent from the trade panel.
- **`commission` can be `0` legitimately** → A zero commission is indistinguishable from "unpriced"
  under the falsy-checked `getDisplayedValue` the stop out amount already uses, so a genuine zero
  renders `-`. Accepted: it matches the neighbouring row's long-standing behaviour, and the stake
  editor's `{ stop_out: 0, commission: 0 }` reset depends on `0` meaning "no value" on this surface.
- **Existing specs count skeletons** → `multipliers-information.spec.tsx` asserts
  `getAllByTestId('dt_skeleton')` has length 2. That assertion moves to 3 in the same change; it is a
  deliberate update, not an unrelated test edit.
- **Restoring deleted code can drift from the tree it left** → Two drifts are known and handled
  (`useOnClickOutside`'s pruned export in D5, the percentage divisor in D9). The remaining
  dependencies were checked and still resolve: `TooltipPortal` (`components/src/index.ts:70`),
  `TradeParamDefinition`'s `is_custom_description` prop
  (`TradeParamDefinition/trade-param-definition.tsx:9`), and the SCSS tokens
  `--semantic-color-monochrome-surface-normal-lowest`, `--color-surface-inverse`,
  `--color-text-inverse`.
- **The desktop Stake popover gains a hover tooltip its neighbours lack** → Deliberate (D6), and the
  Open Question in `tasks.md` gives a reviewer a one-line way to reverse it (drop the
  `CommissionTooltip` fallback branch, leaving the label plain).

## Migration Plan

None — presentational, additive, behind no flag. Reverting is deleting the added rows and
re-deleting the four restored files.

## Open Questions

Tracked in `tasks.md` (`## Open Questions`), answered with the recommended option so this plan is
implementable as written.
