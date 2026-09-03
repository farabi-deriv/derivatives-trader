## Open Questions

None blocks implementation — the recommended answer is what the specs, `design.md` and the checklist below already assume. A reviewer may pick a different option; only the noted tasks change if they do.

1. **Should the Stop out row be restored on desktop too, or only on mobile where the information disappears entirely?**
    - **(a) RECOMMENDED — Both, because they are the same component.** `StakeDetails` is mounted by `stake-input.tsx` (mobile sheet) and `stake-input-desktop.tsx` (desktop popover); the gate is one predicate serving both. Desktop already shows the same figure unconditionally in its below-params `MultipliersInformation` row, so restoring it in the popover removes an inconsistency rather than creating one. This is what tasks 2.1–2.3 implement.
    - (b) Mobile only, by threading a breakpoint flag into the predicate. Smaller behavioural blast radius, but adds a new by-breakpoint divergence to explain and leaves the desktop popover contradicting the row below it.

2. **With Stop loss set, should the Stop out row be annotated (e.g. "Stop out (or your SL, whichever is hit first)")?**
    - **(a) RECOMMENDED — No annotation; show the plain figure.** Matches the desktop `MultipliersInformation` row exactly, needs no new translated copy, and is precisely what issue #1305 asks for. The tapped explanation already tells the trader what stop out means.
    - (b) Annotate the label or add a helper line when SL is set. New copy to translate, and it puts a second interpretation of the same number in front of the trader — a product decision beyond this bug.

3. **When a drafted stake produces no priced proposal, should the Stop out row fall back to the store's committed value instead of showing `-`?**
    - **(a) RECOMMENDED — Keep `-`.** The amount deliberately lives on `details` so it tracks the _drafted_ stake (see the comment at `stake-details.tsx:50-55`); a committed-stake figure shown beside a different drafted stake would be wrong, not merely stale. `-` matches how the Stop out level row already behaves when unknown. See `design.md` D3.
    - (b) Fall back to the store's `stop_out`, so a number is always present. Requires reversing the documented split between the two values.

---

## 1. Reproduce and capture the red

- [ ] 1.1 Reproduce issue #1305 against the current branch build: mobile viewport, Multipliers, enable Stop loss with a valid amount under Risk management, then open the Stake action sheet. Verify the Stop out row is absent while the Stop out level row is still shown — and that turning Stop loss off makes the Stop out row reappear. Capture a before screenshot for the PR.
    - Left unchecked: needs a running build with a funded Multipliers account, like section 4. The defect was instead reproduced at code level (`!has_stop_loss` at `stake-details.tsx:111`; mobile has no fallback row because `trade-parameters.tsx:114` renders `MultipliersInformation` only when `!isMobile`) and then reproduced executably by the reds in 1.2 and 1.3.
- [x] 1.2 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake-details.spec.tsx`, add a failing case asserting the Stop out row renders for the multipliers variant when the trader has Stop loss set (today: pass `has_stop_loss: true` through `base_props`; after task 2.2 the prop is gone and the case becomes the unconditional "renders for multipliers" assertion — see task 3.1). Run `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake-details.spec.tsx` and verify it fails on the missing `Stop out` text, not on a render or import error. Record the failing test name and assertion — that line is the cited red for the PR body, per `.buildwright/framework/tdd-evidence.md`.
    - Red: `StakeDetails multiplier info › renders the Stop out row when the trader has Stop loss set` — `expect(screen.getByText('Stop out')).toBeInTheDocument()` → "Unable to find an element with the text: Stop out"; the printed DOM held only the Stop out level row, and the other 10 cases in the file passed.
- [x] 1.3 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake.spec.tsx`, add a failing case in the mobile sheet describe block (`Stake - Mobile header actions` or a new `Multipliers stop out` block) that mounts `Stake` with a multipliers store carrying `has_stop_loss: true`, `stop_out: -10` and `stop_out_level: '8160.12'`, opens the sheet, and asserts both the `Stop out` and `Stop out level` labels are present. Run that file and verify the new case fails on the missing `Stop out` label while the existing cases stay green. Record it as the second cited red.
    - Red: `Multipliers stop out (mobile sheet) › shows the Stop out and Stop out level rows with Stop loss set` — `expect(screen.getByText('Stop out')).toBeInTheDocument()` → "Unable to find an element with the text: Stop out", with `Stop out level` / `8160.12` present in the same sheet. The two explanation cases that tap the label failed on the same missing label; the pre-existing 64 cases in the file stayed green.

## 2. Remove the Stop loss gate

- [x] 2.1 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-details.tsx`, change the Stop out row's `is_displayed` (line 111) from `!has_stop_loss && is_multiplier && !should_show_payout_details` to `is_multiplier && !should_show_payout_details`, so it matches the Stop out level row directly below it. Verify by re-running the task 1.2 test — it now passes.
- [x] 2.2 In the same file, remove `has_stop_loss` from `TStakeDetailsProps` (the `Pick<TTradeStore, …>` at line 13) and from the destructured parameter list (line 42), since nothing reads it any more. Verify `npx tsc -p packages/trader/tsconfig.json --noEmit` reports no new errors in the Stake directory (the four pre-existing inline-message errors and the shared-tsconfig spec-file noise are baseline — compare against a run on `master`).
    - `npx tsc -p packages/trader/tsconfig.json --noEmit` reports zero errors under `TradeParameters/Stake`.
- [x] 2.3 Remove the now-invalid `has_stop_loss={has_stop_loss}` prop from both call sites — `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx:660` and `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input-desktop.tsx:488` — and drop `has_stop_loss` from each file's `useTraderStore()` destructuring (`stake-input.tsx:167`, `stake-input-desktop.tsx:149`) after confirming with a file-wide search that nothing else in either file reads it. Verify the same `tsc` run is clean and `grep -rn "has_stop_loss" packages/trader/src/AppV2/Components/TradeParameters/Stake/` returns no hits outside tests.
    - `StakeDetails` has exactly the two call sites; both were the only `has_stop_loss` readers in their files. The remaining grep hit is `stake.spec.tsx`, where it is set on the mock store (the app-level path, per design D5).
- [x] 2.4 Add a short comment above the Stop out row in `stake-details.tsx` recording that its visibility is deliberately independent of Take profit / Stop loss — stop out is the platform's own liquidation point, an SL is an additional trader limit — and naming issue #1305. Verify the comment is present and `npm run test:eslint-all` (or the Stake-scoped lint) reports no new findings; if ESLint is unrunnable locally in this environment, note that in the PR and rely on CI.
    - ESLint is unrunnable in this environment (`EPERM: operation not permitted, scandir '/Users/.../GitHub'` from `import/no-unresolved`), the known local baseline — flagged for the PR, relying on CI. Prettier was run over the changed files and they conform.

## 3. Regression coverage

- [x] 3.1 Rework the task 1.2 case for the prop-free component: remove `has_stop_loss: false` from `base_props` in `stake-details.spec.tsx` (it is no longer a prop) and keep an assertion that the Stop out row renders for the multipliers variant with its formatted amount. Verify the file passes and that temporarily restoring `!has_stop_loss` in the source makes only the intended case fail.
    - Mutation check: with the prop gone the component cannot observe SL at all, so the gate was restored in the faithful post-fix form — reading `has_stop_loss` off `useTraderStore()` and re-adding `!has_stop_loss` to the row. That killed exactly the four SL-set cases in `stake.spec.tsx` and left all 12 `stake-details.spec.tsx` cases green, which is the split design D5 predicts: the store-level SL condition now lives in the integration file.
- [x] 3.2 Verify the existing `stake-details.spec.tsx` cases all stay green — Stop out / Stop out level labels tappable via `onOpenStopOut` / `onOpenStopOutLevel`, plain label on desktop, level rendered without a currency symbol, the level re-read from the store on rerender, the amount rendered as `$10.00`, no Commission row, the `-` placeholders for a missing level and an empty stake, and neither row for non-multipliers. Label them as characterization in the PR (they never went red), per `.buildwright/framework/tdd-evidence.md`.
- [x] 3.3 Add a case to `stake-details.spec.tsx` covering the placeholder path now reachable with SL set: with the multipliers variant and `details.stop_out` absent/zero, the Stop out row is still rendered showing `-` rather than being dropped. Verify it passes and that it fails if the row is made conditional on a truthy value.
    - Mutation check: `is_displayed: !!details.stop_out && …` failed exactly one case — `keeps the Stop out row visible with a placeholder when no stop out amount is priced` — with the other 79 green.
- [x] 3.4 Extend the task 1.3 case in `stake.spec.tsx` to also assert the in-sheet explanation is reachable with Stop loss set: tap the `Stop out` label and verify the Stop out explanation page is shown (the percentage sentence when the mocked proposal supplies `limit_order.stop_out.order_amount` and `stake`, the generic sentence otherwise), then tap the `Stop out level` label and verify its explanation. Verify the whole file passes.
    - Both explanation cases assert on the _active_ carousel item, since every page is mounted at once and merely translated — page presence alone would prove nothing.
- [x] 3.5 Run `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/Stake` and verify every Stake suite is green, including the balance-hint, preset-ladder, stale-seed and header-save blocks — none of which this change should touch.
    - 2 suites, 80/80 passing.
- [x] 3.6 Run `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/MultipliersInformation` and verify the desktop below-params suite is untouched and green, confirming the two surfaces now agree.
    - 1 suite, 24/24 passing.

## 4. Manual verification (not run in the implementation stage)

> These need a running build with a funded account on Multipliers — the reviewer's QA steps.
> Left unchecked deliberately; 4.1 depends on the before-state captured in task 1.1.

- [ ] 4.1 Mobile viewport, Multipliers, Stop loss enabled: open the Stake action sheet and verify the Stop out row is present with a currency-prefixed positive amount (e.g. `$10.00`) and the Stop out level row is present with a bare price (no `$`, no `USD`). Compare against the task 1.1 before screenshot and attach the after screenshot to the PR.
- [ ] 4.2 In the same sheet, tap **Stop out** and verify the explanation page opens reading "Your contract will be closed automatically when your loss reaches N% of your stake" with a plausible N (100% on most symbols, ~90% on CRASH1000), and that the back arrow returns to the stake input. Repeat for **Stop out level**.
- [ ] 4.3 Verify the rows in every risk-management combination on mobile: SL only, TP only, TP + SL, Deal cancellation on (which disables TP/SL), and nothing set. Both rows must be present in all five states, with the same values in each.
- [ ] 4.4 Verify the amount tracks the draft: with SL set, change the stake in the sheet to a larger valid value and confirm the Stop out amount rises with it and the Stop out level updates, before saving. Then save and confirm the committed values match.
- [ ] 4.5 Verify the placeholder path: with SL committed against a larger stake, draft a much smaller stake so the SL is no longer valid for it. Confirm the Stop out row stays visible showing `-` (it must not disappear), the Stop out level row behaves consistently, and the sheet does not break. Note in the PR whether the trader gets any message explaining the rejected draft — if not, log it as a separate defect rather than widening this change.
- [ ] 4.6 Verify the empty-input case: clear the stake input and confirm both rows remain visible showing `-`, then retype a valid stake and confirm both repopulate.
- [ ] 4.7 Desktop: with SL set, open the Stake popover's amount input and verify the Stop out and Stop out level rows are shown there, that their labels are plain text (no tap target, no in-popover explanation page), and that the values match the below-params `MultipliersInformation` row on the page behind.
- [ ] 4.8 Verify no leakage to other trade types: open the Stake surface on Rise/Fall (payout rows shown, no stop-out rows), Accumulators, Turbos and Vanillas, on both breakpoints, and confirm none of them gained a Stop out row.
- [ ] 4.9 Spot-check light and dark themes on the mobile Stake sheet with SL set, confirming the restored row's label and value use the same text styles as the Stop out level row beside it.

## 5. Wrap-up

> The full gate, the commit and the PR are handled downstream; 5.2's answer is already settled.

- [ ] 5.1 Run `npm run test` (stylelint + eslint + jest) and verify it passes before pushing, per the repo workflow in `CLAUDE.md`. If ESLint cannot run in this environment, say so explicitly in the PR rather than reporting a clean gate.
    - Left unchecked: the full gate runs in the separate verification stage. ESLint is unrunnable locally here (see 2.4), so CI owns it.
- [x] 5.2 Confirm no user-facing documentation needs updating — no copy, command, config, API or public workflow change; the restored row and its explanations use strings that already exist and are already translated — and state that explicitly in the PR description, per the "Documentation Is Part of Done" steering rule.
    - Confirmed. The diff adds no user-facing wording: `Stop out`, `Stop out level` and both explanation sentences are pre-existing `Localize` strings, reached rather than written. Nothing to run the content style guide over, and no README/docs/config/API surface is touched.
- [ ] 5.3 In the PR description: link issue #1305, name commit `4fdc5d2c0d` (#16486) as the origin of the `!has_stop_loss` gate, cite the reds from tasks 1.2 and 1.3 (test name + failing assertion), label the pre-existing `stake-details.spec.tsx` cases as characterization, and attach the before/after mobile screenshots from tasks 1.1 and 4.1.
    - Left unchecked: the PR is opened by the separate shipping stage. The reds are recorded verbatim under 1.2 and 1.3 above for it to quote.
