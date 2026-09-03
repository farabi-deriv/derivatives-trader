## Revision: gate scope reverted

Sections 2-4 below (wiring the balance-aware copy into `ServiceErrorSheet` and its tests) were implemented, then **reverted** in response to review feedback that the new message is only intended for the mobile/desktop stake inputs, not the **Buy**/automation-**Run** gate. `service-error-sheet.tsx` and `service-error-description.tsx` are back to their pre-change behaviour (unconditional `mappedMessage`), and their spec cases were rewritten to assert the backend/generic message is shown as-is. They are kept below, struck through, for traceability rather than deleted — the helper and its tests (section 1, still consumed by the stake inputs) and the stake-input hint (sections 5-6) are unaffected and remain in force. `specs/insufficient-balance-gate/spec.md` has been removed from this change; the `insufficient-balance-gate` capability is no longer proposed.

## Open Questions

These are the issue's own open questions, each answered with a default so the plan is implementable as written. A reviewer can replace any answer; the affected task is named so the change is cheap.

~~1. **Gate title** — should the title change with the state?~~ **Moot** — the gate is out of scope for this change (see "Revision: gate scope reverted" above); its title is untouched.

~~2. **Demo accounts** — "Deposit funds to buy this contract" is not actionable on a virtual account, which can only reset its balance.~~ **Moot** — same reason; the gate's virtual-account copy and actions are untouched.

3. **Stake vs. ask price** — which amount is compared against the balance for the stake-input hint?
    - **RESOLVED** — (a) the local display amount (mobile `displayAmount`, desktop `proposal_request_values.amount`), **guarded by `basis === 'stake'`** so the comparison only runs while that amount is the sum being charged. Review raised that `TradeStore.amount` is a target payout on `payout` basis — reachable on Rise/Fall, which `PurchaseButton` deliberately exempts from the switch to `stake` — which would warn about an affordable trade. See section 7 and `specs/balance-aware-stake-warning/spec.md`.
    - Not chosen: comparing against `proposal.ask_price`. It would also cover the `payout` case _and_ the multiplier deal-cancellation fee, but it costs the hint its immediacy (the whole point of task 5.1: no proposal round-trip) and would go silent whenever the proposal is in flight. The guard keeps the immediacy and trades a small amount of coverage for never being wrong.

4. **Scope of the preset/validation work** — the issue offers (a) copy only, (b) also warn/block in the stake sheet, (c) also clamp the preset chips.
    - **RECOMMENDED** — a **non-blocking** variant of (b), scoped to the stake inputs only (see "Revision" above for why the gate copy itself, part of the issue's option (a), was dropped): sections 5-6 add the informational stake hint that the issue's requirement 7 asks for, without disabling **Save**. Blocking Save contradicts the codebase's deliberate "inform, don't disable" stance on `InsufficientBalance` (`purchase-button.tsx:319-325`, and the `CLAUDE.md` gotcha) and would strand a user who wants to set a stake then deposit.
    - To drop the stake hint entirely, delete sections 5-6 and `specs/balance-aware-stake-warning/spec.md`. To take the issue's literal option (b) instead, add the hint to `is_save_disabled` in task 5.2 — but note this conflicts with the convention above.
    - (c) clamping the chips is rejected in `design.md` (the chips describe contract validity, not affordability; they are also mobile-only, so clamping would desync the breakpoints).

5. **Balance exactly equal to the stake** — treated as affordable, so the hint shows nothing. **RECOMMENDED**, confirming the issue's assumption: the backend accepts it. Encoded in task 1.2 branch 5 and task 4.2.

## 1. The message helper (new, pure, tested first)

- [x] 1.1 Create `packages/trader/src/AppV2/Utils/insufficient-balance-utils.tsx` exporting `getInsufficientBalanceMessage({ balance, stake, currency, fallback })`. Types: `balance?: string | number`, `stake?: string | number`, `currency?: string`, `fallback: React.ReactNode`; returns `React.ReactNode`. `.tsx` because it returns a `<Localize>` element — matches `layout-utils.tsx` / `contract-description-utils.tsx` in the same directory. Consumed only by the two stake inputs (sections 5-6) — no gate call site.
- [x] 1.2 Implement the five branches **in this order** (see `specs/balance-aware-stake-warning/spec.md`): (1) balance not a finite number → `fallback`; (2) balance `<= 0` → empty-balance copy; (3) stake not a finite number `> 0` → `fallback`; (4) balance `<` stake → balance-aware copy; (5) else → `fallback`. Both stake-input call sites pass `fallback: null`, so branches 1, 3 and 5 render no hint in practice. Parse both amounts with `Number(String(v).replace(/,/g, ''))` and `Number.isFinite`, mirroring the guard at `AppV2/Components/AccountHeader/account-header.tsx:87-92` — balances reach components comma-grouped. The finite check must precede formatting: `formatMoney` coerces `undefined`/`NaN` to `"0.00"` (`packages/shared/src/utils/currency/currency.ts:59`).
- [x] 1.3 Empty-balance copy: `<Localize i18n_default_text='Balance is empty. Deposit funds to buy this contract.' />`. (Reachable in the helper, but both stake-input call sites gate the hint on `balance > 0` — task 5.3/5.4 — so this branch never surfaces there today; it stays as a documented, tested branch of the pure helper.)
- [x] 1.4 Balance-aware copy: a **single** `<Localize i18n_default_text='You only have {{balance}} {{currency}} left. Try a lower stake.' values={{ balance: formatMoney(currency, balance, true), currency: getCurrencyDisplayCode(currency) }} />` — no concatenation, no hardcoded decimals. Import both from `@deriv/shared`, as `stake-input.tsx:355-360` already does.
- [x] 1.5 Add a short JSDoc block stating that the helper only chooses copy, and why the balance guard precedes the stake check.

## ~~2. Wire the gate (both breakpoints, one computation)~~ — REVERTED

Implemented, then reverted (see "Revision" above). `service-error-sheet.tsx` no longer imports the helper; `display_message` was removed and both render sites (desktop `Modal` message, mobile `ActionSheet` via `ServiceErrorDescription`) use `mappedMessage` directly again, exactly as before this change. `service-error-description.tsx`'s `services_error_message` prop is back to `string`.

- [x] ~~2.1 Add `balance` to the `client` destructure and `amount` to the `useTraderStore()` destructure in `service-error-sheet.tsx`.~~
- [x] ~~2.2 Derive `display_message` from the helper when `is_insufficient_balance` and use it at both render sites.~~
- [x] ~~2.3 Confirm `service-error-description.tsx` needs no change.~~
- [x] ~~2.4 Confirm the title and `getActionButtonProps()` are untouched.~~ (Still true, and still the case post-revert — trivially, since the component is unchanged.)
- [x] ~~2.5 Confirm `error-message-mapper.ts` and the reports `InsufficientBalanceModal` are not modified.~~ (Still true.)

## ~~3. Verify the automation Run gate inherits the empty-balance copy~~ — REVERTED

Moot: the gate the Run path renders through (`ServiceErrorSheet`) is unchanged, so the automation Run gate keeps showing exactly what it did before this change — no empty-balance substitution.

- [x] ~~3.1 Confirm `useRunControls.ts` needs no code change and now resolves through the helper's `<= 0` branch.~~
- [x] ~~3.2 Note the `fallback` difference between the Run path and the Buy path.~~

## ~~4. Tests for the gate~~ — REVERTED

`service-error-sheet.spec.tsx` was rewritten instead: the "Balance-aware messages" describe block became "Backend error message is shown as-is, without balance-aware substitution" (4 cases — desktop/mobile × empty/below-stake balance), each asserting the backend/generic message renders and the balance-aware strings do **not** appear. The non-balance-code case and the automation-shape case (formerly 4.7/4.8) were removed as no longer meaningful once the substitution itself was removed. The seven original fallback-path tests are untouched throughout.

- [x] ~~4.1-4.3 (helper unit tests)~~ — not reverted; see section 1, tests live in `insufficient-balance-utils.spec.tsx` and remain in force.
- [x] ~~4.4-4.10 (gate-specific spec cases and TDD evidence)~~ — superseded by the rewritten "shown as-is" cases described above.
- [x] ~~4.11 Run the gate + helper suites and confirm both pass.~~ — superseded by the current suite; re-run as part of task 7.2/7.3 below.

## 5. The stake-input hint (see Open Question 4 before starting)

- [x] 5.1 In `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input.tsx` (mobile), add `import { useStore } from '@deriv/stores';` and read `const { client: { balance, currency: account_currency } } = useStore();` alongside the existing `useTraderStore()` read (line 159). Derive the hint from **`displayAmount`** (the local display value, line 366) — not `proposal_request_values.amount` — so it appears the moment a preset is tapped or an amount typed, with no proposal round-trip.
- [x] 5.2 Insert the hint into the existing `message` chain at line 559, ranked below real errors and above the range hint: `message={fe_stake_error || (should_show_stake_error && stake_error) || balance_hint || getInputMessage()}`. Leave `status` (line 566) at its current expression and leave `is_save_disabled` (lines 530-536) **unchanged** — the hint must not disable Save.
- [x] 5.3 Build `balance_hint` by calling `getInsufficientBalanceMessage({ balance, stake: displayAmount, currency: account_currency, fallback: null })` and rendering it only when it is not the fallback — i.e. gate on the helper returning something. **Revised (QA):** a zero/negative balance now surfaces the helper's empty-balance branch here too — selecting a preset on a `0` balance was showing no hint at all, which read as valid up to Buy. The gate condition is now `basis === 'stake' && Number.isFinite(parsed_balance)`, with no `parsed_balance > 0` floor.
- [x] 5.4 Apply the same two edits to `packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-input-desktop.tsx`: the `message` chain at line 455 and the `useStore()` read next to `useTraderStore()` at line 143. Its `getInputMessage()` uses a different range string (`Range: {{min_stake}} to {{max_stake}} {{currency}}`, line 333) — leave that alone.
- [x] 5.5 Confirm `packages/trader/src/AppV2/Utils/trade-params-utils.tsx` `getStakePresetValues` (lines 494-519) is **not** modified and `ValueChips` (`stake-input.tsx:571-577`) still receives the unclamped `preset_values` — preset chips stay balance-blind per `design.md`. Verify by reading; do not edit.

## 6. Tests for the stake-input hint

- [x] 6.1 Add cases to `packages/trader/src/AppV2/Components/TradeParameters/Stake/__tests__/stake.spec.tsx` (or a new `stake-input.spec.tsx` alongside it if the existing mock setup does not reach `StakeInput`): with `client.balance: '4.00'`, `currency: 'USD'`, typing/selecting `10` renders `You only have 4.00 USD left. Try a lower stake.`; drafting `4` or `1` renders no hint and keeps the `Range …` text.
- [x] 6.2 Add a no-block assertion: with balance `4.00` and a drafted `10` that the proposal accepts, the Save control is **not** disabled and invoking it commits the amount (`onChange` called with `{ name: 'amount', value: '10' }`) and closes the sheet.
- [x] 6.3 Add precedence cases: a front-end format error (trailing separator) and a proposal `stake_error` each render instead of the balance hint; the balance hint renders instead of the range hint.
- [x] 6.4 Add an unknown-balance case: `client.balance: undefined` → no hint, range hint unchanged, and no `0.00` rendered.
- [x] 6.5 Capture and cite the red for section 6 too: run the 6.1 assertions against the unmodified stake inputs and record that the hint is absent (expected `You only have 4.00 USD left. Try a lower stake.`, received the `Range …` text). Then apply section 5 and confirm green.
- [x] 6.6 Run `npm run test:jest -- packages/trader/src/AppV2/Components/TradeParameters/Stake` and confirm the suite passes.

## 7. Verification and docs

- [x] 7.1 Run `openspec validate default-stake-presets-allow-values-above-the-available-balance-without-a-deposit-gate` and confirm no structural errors.
- [x] 7.2 Run `npm run test:eslint-all` (or `npx eslint` scoped to the touched files from `packages/trader`) and `npm run prettify` on the touched files.
- [x] 7.3 Run the wider affected suites: `npm run test:jest -- packages/trader/src/AppV2/Components/PurchaseButton packages/trader/src/AppV2/Hooks/__tests__/useRunControls packages/reports/src/Components/Elements/Modals/ServicesErrorModal` to confirm nothing downstream of the shared error path regressed — expected to be a no-op now that `ServiceErrorSheet` is unchanged, but re-run after the revert to be sure.
- [x] 7.4 Confirm the below-stake string is a single `Localize` template with `{{balance}}`/`{{currency}}` intact. There is no local extraction step (strings ship via `@deriv-com/translations` + Crowdin CI), so no generated file needs regenerating — state this in the PR rather than looking for one. Note: the helper's empty-balance branch and copy (task 1.3) is now reachable from both stake inputs (see task 5.3's revision) — a zero/negative balance shows it there, while `ServiceErrorSheet` still never calls the helper at all.
- [x] 7.5 Documentation check per `.buildwright/steering/philosophy.md` ("Documentation Is Part of Done"): the `CLAUDE.md` **Gotchas** entry was updated, then re-updated after the revert — it now states the purchase-button modal keeps its existing unconditional message, while the mobile/desktop stake inputs separately show the balance-aware hint. This `tasks.md`, `proposal.md`, `design.md` and the `specs/` directory (with `insufficient-balance-gate/spec.md` removed) were updated to match the reverted scope.
- [x] 7.6 Manual check against the issue's acceptance criteria on a real low-balance account and a crypto account: drafting a stake of `10` with balance `4.00 USD` shows `You only have 4.00 USD left. Try a lower stake.` on both the mobile stake sheet and the desktop stake modal without blocking Save; crypto balance renders the hint at its own precision; tapping **Buy** with that stake still shows the gate's existing (unchanged) message; a non-balance rejection keeps its own message; automation **Run** on a zero balance shows the gate's existing (unchanged) message, not a new empty-balance string.

## 7. Review follow-ups (post-revert)

- [x] 7.1 Guard both hints with `basis === 'stake'` (`stake-input.tsx`, `stake-input-desktop.tsx`), adding `basis` to each component's `trade_store` destructure. The drafted amount is the charged sum only on that basis; on `payout` it is a target payout whose real charge is the lower `ask_price`, so the hint would warn about an affordable trade. `payout` is reachable — `purchase-button.tsx:196-201` switches every type _except_ Rise/Fall to `stake`, and `basis` is persisted (`trade-store.ts:488`). Treat `multiplier` and `''` the same way: unknown semantics stay silent.
- [x] 7.2 Verify the guard costs nothing for the trade types AppV2 offers: accumulators, multipliers, turbos and vanillas declare `basis: ['stake']` and the classic types declare `['stake', 'payout']` defaulting to the first (`packages/shared/src/utils/constants/contract.ts`), so only a persisted `payout` on Rise/Fall is suppressed.
- [x] 7.3 Export `parseAmount` from `insufficient-balance-utils.tsx` and consume it in both stake inputs, replacing the two inline copies of the same guard. Three identical implementations existed; one remains in `account-header.tsx`, which is out of scope for this change.
- [x] 7.4 Add `it.each(['payout', 'multiplier', ''])` cases to both the mobile and desktop `Balance-aware hint` describes in `stake.spec.tsx`, asserting no hint and the range hint intact. Red captured first: with the guard removed all six fail, each finding `You only have 4.00 USD left. Try a lower stake.` where none is expected.
- [x] 7.5 Re-run `packages/trader/src/AppV2`, `tsc --noEmit` and eslint on the touched files; update `specs/balance-aware-stake-warning/spec.md` with the new requirement and the PR body's "Known limitation" section (the payout case is now fixed; the multiplier deal-cancellation fee remains, and is now covered by the same guard only insofar as multipliers stay on `stake` basis — the fee itself is still not modelled).

## 8. Review follow-up: zero/low balance stayed silent on preset selection

- [x] 8.1 QA found that selecting a stake preset on a `0` (or otherwise empty) balance showed no hint at all — the `parsed_balance > 0` floor at both call sites (task 5.3) suppressed the helper's own empty-balance branch, so the input read as valid right up to Buy for exactly the account this change was meant to help. Removed the `> 0` floor in `stake-input.tsx` and `stake-input-desktop.tsx`; the gate is now `basis === 'stake' && Number.isFinite(parsed_balance)`.
- [x] 8.2 Added a zero-balance case to each `Balance-aware hint` describe in `stake.spec.tsx`: tapping a preset (mobile) / typing an amount (desktop) on `client.balance: '0.00'` shows `Balance is empty. Deposit funds to buy this contract.`. Red captured first (both failed to find the text with the old gate); green after the fix.
- [x] 8.3 Updated `proposal.md`, `design.md` and `specs/balance-aware-stake-warning/spec.md` to document the empty-balance branch as reachable from both stake inputs. The gate (`ServiceErrorSheet`) is still untouched and out of scope.

## 9. Review follow-up: mobile Save now blocked while the hint shows — spec/design updated to match

- [x] 9.1 A later review asked that the mobile action sheet's header **Save** be disabled for as long as the balance hint is showing (superseding task 5.2's original "leave `is_save_disabled` unchanged" decision for that one breakpoint): `is_save_disabled` in `stake-input.tsx` now includes `balance_hint`, and `onSave` short-circuits on it too, so invoking the commit handler directly is also a no-op. `stake-input-desktop.tsx` was **not** touched — its footer Save keeps committing an unaffordable stake, per the original design.
- [x] 9.2 QA/review then flagged that this landed as a code-only change: `proposal.md`, `design.md` and `specs/balance-aware-stake-warning/spec.md` still said the hint "never blocks Save" on both breakpoints, and gave no account of why mobile and desktop now disagree. Updated all three:
    - `specs/balance-aware-stake-warning/spec.md` — replaced the "warning never blocks Save" requirement (and its "Save still commits" scenario, written against both breakpoints) with a narrower "warning never masks a real error" requirement, plus a new "The mobile action sheet's Save is blocked while the warning shows; the desktop modal's is not" requirement carrying one scenario per breakpoint.
    - `design.md` — renamed/rewrote "The stake-sheet hint informs rather than blocks" to "The mobile action sheet blocks Save; the desktop modal does not", explaining why the mobile header check was an easy, safe place to add the gate (it already gates on a dirty-check) while **Buy**/automation **Run**/the desktop modal keep the original "inform, don't disable" stance; added a Risks entry noting the divergence is deliberate, not drift to reconcile.
    - `proposal.md` — updated the "Save is deliberately not blocked" bullet and the `balance-aware-stake-warning` capability description to state the per-breakpoint behaviour instead of a single blanket "never disables Save".
    - `CLAUDE.md`'s **Gotchas** entry for the purchase button / stake inputs was also updated to state the per-breakpoint Save behaviour.
