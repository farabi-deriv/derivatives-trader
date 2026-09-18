## Decisions from review

- **Row order:** Commission sits **last** — `Stop out`, `Stop out level`, `Commission`. The amount/price
  pair stays adjacent and both existing rows keep the positions they have today.
- **Explanation:** restore `commission-formula.tsx` / `commission-tooltip.tsx` /
  `commission-description.tsx` from `c2c9fd19a6^` and show the live
  `<percentage>% of (<stake> × <multiplier>)` breakdown (V1 parity). The static Guide sentence is
  **not** used. Two things cannot be restored verbatim — see tasks 1.3 and 4.2.

## Open Questions

### Should the Commission label in the desktop Stake popover reveal the formula on hover, unlike the plain Stop out / Stop out level labels beside it?

- [recommended] Yes — keep `CommissionTooltip`'s pre-#1107 behaviour, so desktop popover users get the formula that is the whole point of restoring it (asymmetric with its two neighbours, which have nothing to explain)
- No — leave the label plain in the desktop popover and expose the formula only in the trade-parameters information rows and the mobile stake sheet (consistent row styling, but desktop popover users see a bare number)

> Answered with the recommended option below; the checklist is complete and implementable as written.
> Reversing it is one edit: drop the `CommissionTooltip` fallback branch in task 3.5.

---

## 1. Restore the commission components

- [x] 1.1 Restore `packages/trader/src/AppV2/Components/TradeParameters/Multiplier/commission-formula.tsx` from `c2c9fd19a6^` unchanged (exports `getCommissionPercentage` and the default `CommissionFormula`). Keep the original paths — the restore is the exact inverse of #1107's deletions and reinstates the `../Multiplier/commission-formula` import `stake-details.tsx` used before it.
- [x] 1.2 Restore `commission-description.tsx` and `commission-description.scss` to the same folder, unchanged. Verified still available: `TradeParamDefinition`'s `is_custom_description` prop (`AppV2/Components/TradeParamDefinition/trade-param-definition.tsx:9`) and the token `--semantic-color-monochrome-surface-normal-lowest`.
- [x] 1.3 Restore `commission-tooltip.tsx` and `commission-tooltip.scss`, with **one required deviation**: `useOnClickOutside` is no longer exported from `@deriv/components` (`packages/components/src/index.ts:70` exports `TooltipPortal` only — the hook survives at `packages/components/src/hooks/use-onclickoutside.ts` but its root export was pruned once this file stopped importing it). Replace that import with an inline dismiss effect on the existing `ref`, matching `AppV2/Components/AccountHeader/account-header.tsx:70-81`: while `is_open`, add a `mousedown` listener that closes the bubble when `!ref.current.contains(event.target)`. Do **not** re-add the cross-package export.
    - **Deviation not applied — the premise is factually wrong.** `packages/components/src/index.ts` re-exports the hooks barrel wholesale (`export * from './hooks';`), and `packages/components/src/hooks/index.ts` exports `use-onclickoutside`; `useOnClickOutside` is therefore still a live root export of `@deriv/components`, imported cross-package today by `packages/reports/src/Components/archived-statement-filter.tsx:4` and `.../CompositeCalendar/composite-calendar.tsx:3`, and `dead-code-sweep.spec.ts:54` asserts it is _kept_ as a hook with live callers. Nothing was pruned and nothing had to be re-added, so `commission-tooltip.tsx` is restored **verbatim** — hand-rolling a duplicate of an exported, tested hook would be the churn the design's own "exact inverse of #1107" goal rules out. Task 1.5's two dismiss tests pass unchanged against the restored hook.
- [x] 1.4 Restore the three specs to `Multiplier/__tests__/` — `commission-formula.spec.tsx`, `commission-tooltip.spec.tsx`, `commission-description.spec.tsx` — unchanged, and confirm they pass against the restored components. _Characterization: these three specs pin behaviour restored verbatim from `c2c9fd19a6^`, so they never go red; task 1.5 is what proves the deviation in 1.3 is covered._
    - Characterization (never red): 3 suites / 12 tests pass unchanged against the restored components.
- [x] 1.5 Confirm `commission-tooltip.spec.tsx`'s `hides the formula when tapping outside (mobile)` and `keeps the formula open when tapping inside the bubble (mobile)` both pass with the inline effect from 1.3 (the ref wraps label **and** bubble, so `contains` gives the same result the pruned hook did). If either fails, fix the effect — not the test.
    - Both pass with the verbatim `useOnClickOutside` restore (see 1.3); no effect rewrite was needed.

## 2. Carry commission on the stake editor's details state

- [x] 2.1 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx`, add `commission?: string | number;` and `drafted_amount?: string | number;` to `TStakeState['details']` (beside `stop_out`).
- [x] 2.2 In the same file's `createInitialState`, seed `commission` from the store's proposals — `proposal_info[contract_types[0]]?.commission ?? proposal_info[contract_types[1]]?.commission` — and `drafted_amount` from the store's `amount`. Do not read a store observable: `TradeStore.commission` was removed in #1107 and is deliberately not coming back (see `design.md` D1).
- [x] 2.3 In the same file's `handleProposalResponse`, destructure `commission` off the proposal alongside `limit_order` / `validation_params`, and include `commission` **and** `drafted_amount: proposal_request_values.amount` in the existing `...(is_multiplier && order_amount ? { stop_out: order_amount } : {})` spread, so the numerator and the percentage's divisor always describe the same stake (`design.md` D9).
- [x] 2.4 In the same file, extend the `else if (!proposal && is_multiplier)` reset from `{ stop_out: 0 }` to `{ stop_out: 0, commission: 0 }` so a drafted stake that fails to price does not keep the previous stake's commission.
- [x] 2.5 Apply the identical edits (2.1–2.4) to `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input-desktop.tsx`, which carries its own copy of the reducer, `createInitialState` and `handleProposalResponse`.
- [x] 2.6 In `stake-input.tsx` only, add an `onOpenCommission?: () => void` prop next to `onOpenStopOut` / `onOpenStopOutLevel` (update the JSDoc on that prop group) and forward it to `<StakeDetails />`. Do **not** add it to `stake-input-desktop.tsx` — withholding it is what routes the desktop popover to the hover tooltip instead of an in-sheet page.

## 3. Render the Commission row in the stake editor details

- [x] 3.1 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-details.tsx`, add `commission?: number | string` and `drafted_amount?: number | string` to the `details` prop type, and `onOpenCommission?: () => void` to `TStakeDetailsProps`.
- [x] 3.2 Pull `amount` and `multiplier` from the existing `useTraderStore()` destructure, and compute `const commission_percentage = getCommissionPercentage(details.commission, multiplier, details.drafted_amount ?? amount);` (imported from `../Multiplier/commission-formula`).
- [x] 3.3 Add `commission: ''` to the `displayed_values` state and run it through the existing `getDisplayedValue(Math.abs(Number(details.commission)), commission_value)` call in the same effect that formats `stop_out`, including it in the change comparison and the `setDisplayedValues` payload.
- [x] 3.4 Add a `content` entry `{ is_displayed: is_multiplier && !should_show_payout_details, is_commission: true, label: <Localize i18n_default_text='Commission' />, value: displayed_values.commission }` **after** the `Stop out level` entry. It carries no `has_no_currency`, so the render branch prefixes the currency symbol and falls back to `-` unchanged.
- [x] 3.5 Extend `renderLabel` with the two pre-#1107 branches, keeping the existing if/else shape (no nested ternaries): `if (is_commission && onOpenCommission && commission_percentage !== null) return renderClickableLabel(label, onOpenCommission);` then `if (is_commission) return <Text size='sm'><CommissionTooltip commission={details.commission} multiplier={multiplier} amount={details.drafted_amount ?? amount} currency={currency} align='start'>{label}</CommissionTooltip></Text>;`. `CommissionTooltip` self-gates, so an underivable percentage leaves a plain label on both breakpoints.

## 4. Commission row in the desktop trade-parameters information rows

- [x] 4.1 In `packages/trader/src/AppV2/Components/TradeParameters/MultipliersInformation/multipliers-information.tsx`, add `amount` and `multiplier` to the `useTraderStore()` destructure, read `const commission = any_proposal?.commission;` (the Up→Down fallback already computed for the stop out amount — commission is identical for both directions, unlike the direction-specific stop out level), and compute `const commission_percentage = getCommissionPercentage(commission, multiplier, amount);`.
- [x] 4.2 Widen `TDescriptionKey` to `'stop_out' | 'stop_out_level' | 'commission'` and add the `commission` entry to the `descriptions` record: title `<Localize i18n_default_text='Commission' />`, message `<CommissionFormula commission={commission} multiplier={multiplier} amount={amount} currency={currency} />`.
- [x] 4.3 Gate the affordance in `renderLabel`: when `key === 'commission' && commission_percentage === null`, return a plain `<Text size='sm' className={clsx(is_market_closed && 'trade-params__text--disabled')}>` with no underline class, no tooltip and no tap handler. Every other key keeps today's behaviour.
- [x] 4.4 Add an effect that clears `open_description` when it is `'commission'` and `commission_percentage` becomes `null` (or on desktop). Without it the controlled `isOpen` survives the conditional unmount and the sheet re-opens on its own once the percentage returns — the bug the deleted code's own `React.useEffect` existed to prevent.
- [x] 4.5 Render a third `multipliers-information__row` after the Stop out level row: `renderLabel('commission')` plus, when `commission != null`, `<Text size='sm' className={clsx(is_market_closed && 'trade-params__text--disabled')}>{formatAmountWithSymbol(currency, Math.abs(Number(commission)))}</Text>`, otherwise `<Skeleton width={100} height={14} />` — mirroring the Stop out row exactly. No SCSS change: `.multipliers-information__row` already styles it.

## 5. Commission explanation page in the mobile stake sheet

- [x] 5.1 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-mobile.tsx`, add `const COMMISSION_PAGE = 3;` beside the existing page constants, and add `multiplier` to the `useTraderStore()` destructure.
- [x] 5.2 Read the commission the same way the file already reads the stop out amount: `proposal_info?.[CONTRACT_TYPES.MULTIPLIER.UP]?.commission ?? proposal_info?.[CONTRACT_TYPES.MULTIPLIER.DOWN]?.commission`.
- [x] 5.3 Add `if (carousel_index === COMMISSION_PAGE) return <Localize i18n_default_text='Commission' />;` to `getSheetTitle()`, and push `{ id: COMMISSION_PAGE, component: <TradeParamDefinition is_custom_description description={<CommissionDescription commission={commission} multiplier={multiplier} amount={amount} currency={currency} />} /> }` into the `is_multiplier` page list — the pre-#1107 wiring, `is_custom_description` included so the description renders its own markup.
- [x] 5.4 Pass `onOpenCommission={() => setCarouselIndex(COMMISSION_PAGE)}` to `<StakeInput />`. The label in `stake-details.tsx` only becomes tappable when the percentage is derivable (task 3.5), so the page is never reachable in the state where `CommissionDescription` would render nothing.

### 5.5 Review follow-up — the explanation page must describe the **drafted** stake (MCD-005 / MCD-009)

- [x] 5.5 Tasks 5.2/5.3 prescribed the committed store values (`proposal_info` commission + the store's `amount`), but `StakeInput` re-prices commission per keystroke and the store's `amount` only moves on save. Behind a drafted stake the page therefore contradicted the Commission row above it. `StakeInput` now publishes `{ commission, amount: details.drafted_amount }` upward through a new `registerCommissionDetails` prop — the same publish-upward pattern as `registerHeaderActions` — and `stake-mobile.tsx` feeds `CommissionDescription` from it, falling back to the committed proposal only for the render before the first publish. `stake-input-desktop.tsx` deliberately does not take the prop: the desktop popover has no page, and `CommissionTooltip` already reads `details` directly.
    - Red: `[MCD-005] [MCD-009] explains the stake being drafted, not the committed one` — with a committed stake of 10 (commission 0.50) and a drafted stake of 100 (commission 2.50), expected the page to read `0.0250%`; got `Commission is calculated as 0.0500% of your stake multiplied by the multiplier.0.0500% of (10.00 × 100)`.
- [x] 5.6 The `!proposal && is_multiplier` reset cleared `commission` but left `drafted_amount` holding the last stake that priced, so `getCommissionPercentage(0, multiplier, stale_stake)` returned `"0.0000"` rather than `null` — keeping the label interactive and opening a page built from stale figures. The reset is now `{ stop_out: 0, commission: 0, drafted_amount: 0 }` in both stake inputs; `details.drafted_amount ?? amount` keeps the `0` (nullish coalescing), so the divisor is zero and the percentage is correctly underivable. A genuinely priced zero commission still yields `0.0000%`, because its `drafted_amount` is non-zero.
    - Red: `[MCD-006] [MCD-009] leaves the Commission label inert once a drafted stake fails to price` — expected the active carousel page not to contain `Commission is calculated as`; got `Commission is calculated as 0.0500% of your stake multiplied by the multiplier.0.0500% of (10.00 × 100)`.

## 6. Update the in-repo notes this change makes stale

- [x] 6.1 In `packages/trader/src/AppV2/Components/TradeParameters/trade-parameters.tsx:111`, update the responsive comment from `(Stake: Stop out, Stop out level; ...)` to include Commission.
- [x] 6.2 In `playwright/flows/trade/flow.md`, correct the two structural notes that state Commission is not shown on the trade panel (the "**Structural note:**" line for Multipliers and the bullet under the later Multipliers flow), so they describe the trade panel and Stake sheet as carrying Stop out, Stop out level and Commission. Leave every step table row unchanged — no E2E step changes in this change.
- [x] 6.3 In `playwright/pages/TradeMultipliersPage.ts`, correct the `readStopOut()` doc comment that reads "Commission is not present on the trade panel" — note instead that Commission is now shown there but is still read from the contract details page for the buy/sell assertions. Comment only: leave the locators alone (they already match `'Stop out'` / `'Stop out level'` with `exact: true`, so a third row cannot collide).

## 7. Tests

Write each test first and run it against the unfixed code. Record the failure inline under its task as a `Red: <test name> — expected <x>, got <y>` line before implementing. (Task 1.4's restored specs are the one exception — they are characterization, noted there.)

- [x] 7.1 In `packages/trader/src/AppV2/Components/TradeParameters/MultipliersInformation/__tests__/multipliers-information.spec.tsx`, replace the existing `it('does not render a commission row')` (line ~160) with its inverse: with `commission: 0.5` on the proposal and `amount: 10` / `multiplier: 100` on the store, assert the `Commission` label and `$0.50` are rendered. Record the red line.
    - Red: `[MCD-001] [MCD-003] renders a commission row with a currency-formatted amount` — expected the `Commission` label and `$0.50`, got `Unable to find an element with the text: Commission`.
    - Also added `[MCD-002] falls back to the other direction for the commission` (MULTDOWN-only proposal). Red — same failure.
- [x] 7.2 In the same spec, update `renders skeletons for both rows...` to expect **three** `dt_skeleton` elements and to assert the `Commission` label is present, and rename it to say "all three rows". Record the red line.
    - Red: `[MCD-004] renders skeletons for all three rows if the proposal has no data but there is no API error` — expected the `Commission` label plus 3 skeletons, got `Unable to find an element with the text: Commission` (2 skeletons).
    - Two neighbouring tests counted skeletons with the singular `getByTestId`, so the third row made them ambiguous: `does not fall back to the other direction when the selected side has no stop out level` and `renders a skeleton for the stop out level while the proposal has no barrier value yet` now assert `getAllByTestId(...)` has length 2. Red on both — expected length 2, received 1.
- [x] 7.3 In the same spec, add: tapping the `Commission` label on the mobile branch (`useDevice` is already mocked to `isDesktop: false`) opens the action sheet showing the formula `0.0500%`; the label opens nothing while `is_market_closed` is true; and with `amount: 0` (percentage underivable) the label carries no `multipliers-information__label--underlined` class and tapping it opens nothing, while the value row still renders. Record the red lines.
    - Red: `[MCD-005] opens an ActionSheet with the formula when the label is tapped` — expected `0.0500%` and `Got it`, got `Unable to find an element with the text: Commission`.
    - Red: `[MCD-005] does not open the ActionSheet when the market is closed` — same failure.
    - Red: `[MCD-009] leaves the label plain and inert when the percentage cannot be derived` — same failure.
    - Also extended `[MCD-007] applies disabled class when market is closed` to the Commission label. Red — same failure.
- [x] 7.4 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake-details.spec.tsx`, replace the existing `it('does not render a commission row')` with its inverse: with `details.commission = 0.5`, assert `Commission` and `$0.50` render. Record the red line.
    - Red: `[MCD-001] [MCD-003] renders the Commission row with a currency-formatted amount` — expected the `Commission` label and `$0.50`, got `Unable to find an element with the text: Commission` (no commission row existed).
- [x] 7.5 In the same spec, add: (a) a placeholder test — `details.commission` absent or `0` keeps the `Commission` label with `-`; (b) `is_empty: true` also shows `-`; (c) with `onOpenCommission` and a derivable percentage, tapping the label calls it; (d) with `onOpenCommission` but `details.commission` absent, tapping does **not** call it (the underivable gate); (e) with no `onOpenCommission` (desktop popover) hovering the label reveals `0.0500%` via `CommissionTooltip`; (f) extend `does not render the multiplier rows for non-multiplier contracts` to also assert `Commission` is absent. Record the red lines.
    - Red (a): `[MCD-004] keeps the Commission row visible with a placeholder when no commission is priced` and `...for a zero commission` — expected the `Commission` label plus `-`, got `Unable to find an element with the text: Commission`.
    - Red (b): `[MCD-004] shows a placeholder for the commission while the stake input is empty` — same failure.
    - Red (c): `[MCD-005] opens the Commission explanation (in-sheet page) when the label is tapped` — expected `onOpenCommission` called once, got `Unable to find an element with the text: Commission` before the tap.
    - Red (d): `[MCD-009] leaves the Commission label inert when the percentage cannot be derived` — same failure.
    - Red (e): `[MCD-005] reveals the formula on hover in the desktop popover, where there is no in-sheet page` — expected `0.0500%` after hover, got `Unable to find an element with the text: Commission`.
    - Also added `[MCD-008] leaves the Stop out sources and formats unchanged alongside Commission`. Red — expected `$10.00`, `8160.12` and the `Commission` label together, got `Unable to find an element with the text: Commission`.
    - (f) is a **characterization** extension: `[MCD-007] does not render the multiplier rows for non-multiplier contracts` passed before and after — it guards the payout branch, which never gained a Commission row.
- [x] 7.6 In the same spec, add the D9 regression: with `details.commission` priced for a drafted stake of 100 (`details.drafted_amount = 100`) while the store's committed `amount` is 10, assert the revealed percentage is derived from 100 — i.e. `commission: 5, multiplier: 100, drafted_amount: 100` reveals `0.0500%`, not the `0.5000%` the committed stake would give. Record the red line.
    - Red: `[MCD-009] [MCD-006] derives the percentage from the drafted stake, not the committed one` — expected `0.0500%` and no `0.5000%`, got `Unable to find an element with the text: Commission`.
- [x] 7.7 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake.spec.tsx`, in the `Multipliers stop out (mobile sheet)` describe, add `commission: 0.5` to both proposal entries of `createMultipliersStore` (the store already has `amount: 10`; add `multiplier: 100`) and add two tests: the sheet shows the `Commission` row with `$0.50`, and tapping the label makes the active carousel page show the commission description sentence and `0.0500%` (use the existing `getActivePage()` / `openSettledSheet` helpers). Record the red lines.
    - Red: `[MCD-005] opens the Commission explanation page when the label is tapped` — expected the active carousel page to read `Commission is calculated as 0.0500% of your stake multiplied by the multiplier.`, got empty text content (no `COMMISSION_PAGE` existed).
    - `[MCD-001] [MCD-006] shows the Commission row seeded from the trade page proposal` is **characterization** at the point it was written: the row it asserts had already been made green by tasks 2–3, whose red is recorded under 7.4/7.5. It guards the end-to-end seed path (`createInitialState` → `StakeDetails`) that neither of those covers.
- [x] 7.8 Confirm `packages/trader/src/AppV2/Components/TradeParameters/Multiplier/__tests__/multiplier.spec.tsx`'s `does not render a commission row or explanation page` still passes **unchanged** — the multiplier wheel-picker commission line stays deleted and is out of scope for this change.

## 8. Verify

- [x] 8.1 Run `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters` and confirm the Multiplier (including the three restored specs), MultipliersInformation and Stake suites all pass.
    - 53 suites / 649 tests pass (scoped to `packages/trader/src/AppV2/Components/TradeParameters`, `--runInBand`).
- [x] 8.2 Run `npx tsc --noEmit -p packages/trader/tsconfig.json` (or the package's configured type-check) and confirm the touched and restored files introduce no new type errors — in particular that nothing still imports `useOnClickOutside` from `@deriv/components`.
    - Clean (0 errors), matching the pre-change baseline. `commission` is still imported from `@deriv/components`' `useOnClickOutside` by design — see 1.3.
    - Caught one real defect: the API types give `commission?: null | number`, so the plan's `commission?: string | number` broke `useReducer`'s 3-arg overload (and cascaded `dispatch` into `DispatchWithoutAction`, ~50 errors). Widened to `string | number | null` in both stake inputs and `number | string | null` in `stake-details.tsx`. `getCommissionPercentage`'s `commission == null` guard and `MultipliersInformation`'s `!== null` guard already handle the null case, so no behaviour changed.
- [x] 8.3 Run `npm run test:stylelint` and confirm the two restored `.scss` files pass.
    - Scoped to the restored files (`npx stylelint 'packages/.../Multiplier/commission-*.scss'`): clean.
- [x] 8.4 Run ESLint and Prettier over the changed and restored files only (`npx eslint <files>` and `npm run prettify`) and confirm they are clean.
    - ESLint: 0 errors. The 9 remaining warnings are pre-existing (`stake.spec.tsx`'s `no-manual-cleanup` / `no-promise-executor-return`, and `stake-input.tsx`'s unused `symbol` destructure).
    - Prettier reformatted `stake-input.tsx`'s widened prop destructure; every other changed file was already formatted. Stake suites re-run after: 96 tests pass.
