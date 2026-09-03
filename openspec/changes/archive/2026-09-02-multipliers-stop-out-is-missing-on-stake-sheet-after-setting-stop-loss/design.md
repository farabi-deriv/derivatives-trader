## Context

See `proposal.md` — Why. The relevant mechanics, in one place:

- `StakeDetails` (`packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-details.tsx`) builds a `content` array of rows, each with an `is_displayed` predicate, and renders the ones that pass. The Stop out row's predicate carries an extra `!has_stop_loss` term the Stop out level row beside it does not (lines 109-123).
- One component serves both breakpoints: mobile mounts it from `stake-input.tsx` inside the Stake action sheet, desktop from `stake-input-desktop.tsx` inside the Stake popover. Only mobile passes `onOpenStopOut` / `onOpenStopOutLevel`, which is what turns the two labels into tappable links to the carousel's explanation pages (`stake-mobile.tsx:24-27, 141-160`).
- The two values reach the component by different routes, deliberately (documented at `stake-details.tsx:50-55`): the **amount** comes from `details.stop_out`, fed by the surface's own one-shot proposal so it tracks the stake being drafted; the **level** is read live from the store's `stop_out_level`, fed by the trade page's streaming proposal so it tracks the spot.
- Neither route is conditioned on `has_stop_loss`. The store sets both from the proposal unconditionally (`trade-store.ts:2327-2336`), and the request only gains a `limit_order.stop_loss` field (`Helpers/proposal.ts:182-190`) — the response's `limit_order.stop_out` is unaffected. So the values exist in the SL case; only the render predicate suppresses one of them.

Constraint worth naming: `has_stop_loss` is a _committed store_ value, not a draft. The Stake surface never edits it, so within the surface it is a constant — there is no interaction between the drafted stake and the SL toggle to preserve.

## Goals / Non-Goals

**Goals:**

- Make the Stop out row's visibility depend only on "is this the multipliers variant of the stake details", matching the Stop out level row and the desktop `MultipliersInformation` component.
- Leave both value pipelines (`details.stop_out`, store `stop_out_level`) exactly as they are — this is a visibility fix, not a data fix.
- Remove the prop that becomes dead, rather than leaving a `has_stop_loss` that nothing reads threaded through two call sites.
- Land regression coverage that fails on today's code, so the gate cannot be reintroduced silently.

**Non-Goals:**

- Reworking `StakeDetails`'s row model (the `content` array + `is_displayed` predicates + `renderLabel` switch). It is small and readable; restructuring it would enlarge the diff and the review surface for no behavioural gain.
- Deduplicating `stake-input.tsx` and `stake-input-desktop.tsx`, which are near-identical by history. Real, but a separate change.
- Any change to what Stop out _means_ alongside Stop loss — no relabelling, no "whichever comes first" annotation, no computing an effective loss cap. The issue asks for the figure back, nothing more.

## Decisions

### D1 — Delete the `!has_stop_loss` term rather than invert it or make it configurable

The Stop out row's predicate becomes `is_multiplier && !should_show_payout_details`, identical to the Stop out level row's.

_Alternatives considered:_

- **Keep the term but flip it to a new prop** (e.g. `should_hide_stop_out_with_sl`, defaulted off) — an extension point for a behaviour nobody has asked for; YAGNI. The steering doc's KISS/YAGNI principles say the simplest thing that solves the current need, and the current need is "always show it".
- **Show a different Stop out row when SL is set** (e.g. showing SL as the effective cap, or annotating the label) — a product change beyond the issue, and it would put a second interpretation of the same number in front of the trader. The desktop `MultipliersInformation` row is the in-repo precedent and it shows the plain figure with no annotation.
- **Fix it only on mobile** (thread a breakpoint flag) — mobile is where the information disappears entirely, so it is the urgent half, but the desktop popover hides it for the same wrong reason while the below-params row two inches away shows it. Splitting the behaviour by breakpoint would be a new inconsistency to explain.

### D2 — Remove `has_stop_loss` from `TStakeDetailsProps` and both call sites

With the term gone, the prop has no reader. Removing it keeps the component's contract honest and means TypeScript flags any future caller that tries to reintroduce the coupling. Both call sites also destructure `has_stop_loss` out of `useTraderStore()` purely to forward it; those destructurings go too (`stake-input.tsx:167`, `stake-input-desktop.tsx:149`) — after checking nothing else in each file reads it, which nothing currently does.

_Alternative considered:_ leave the prop in place and accept an unused parameter. It would keep the diff to one line, but leaves a prop that reads as if SL still matters here — precisely the misreading that produced the bug.

### D3 — Do not substitute the store's committed `stop_out` when the drafted stake has no priced proposal

When a drafted stake produces no proposal, `stake-input.tsx:334-339` sets `details.stop_out` to `0` and the row renders `-`. Now that the row is always visible, that `-` becomes reachable in a state it previously never was — notably when an SL committed against a larger stake is rejected against a much smaller drafted one, whose error is a `stop_loss`-field error and so is not even surfaced under the stake input.

Falling back to the store's committed `stop_out` would fill the gap, but it would show the stop out for the _committed_ stake next to a _drafted_ one — contradicting the deliberate split recorded at `stake-details.tsx:50-55`, where the amount is kept on `details` precisely because it must scale with the drafted stake. A wrong-but-populated number is worse than an honest placeholder, and the placeholder already matches how the Stop out level row behaves when its value is unknown. So: `-` stands, and the spec states that visibility never depends on value availability.

### D4 — Test at the `StakeDetails` level, with one integration-level case for the mobile explanation page

`stake-details.spec.tsx` already renders the component directly with a `base_props` object — adding `has_stop_loss: true` cases there is the smallest test that fails today. The one thing that file cannot cover is that the carousel's Stop out page is reachable again, since the page lives in `stake-mobile.tsx`; that gets a case in `stake.spec.tsx`, which already mounts the whole mobile sheet through `Stake`.

Proof of red (per `.buildwright/framework/tdd-evidence.md`): the `has_stop_loss: true` cases must be run against the unfixed component first and observed to fail on the missing `Stop out` text — not on a render error. The `has_stop_loss: false` cases that already pass are characterization, and are labelled as such.

### D5 — `base_props` in the existing spec keeps `has_stop_loss: false` only until the prop is removed

Once D2 lands, `has_stop_loss` is not a prop of `StakeDetails` at all, so it must come out of `base_props` and the new cases cannot pass it either. The "with SL set" condition therefore has to be expressed through the store (`mockStore({ modules: { trade: { has_stop_loss: true, … } } })`) rather than through props — which is a better test anyway, since it exercises the same path the app uses. For `stake-details.spec.tsx`, whose subject takes no store SL input any more, the SL-set/SL-unset distinction collapses: the correct assertion becomes "the Stop out row renders for the multipliers variant, full stop", plus the `stake-input`/`stake.spec` level cases that do set the store flag.

## Risks / Trade-offs

- **The `-` placeholder is now reachable in a state QA has not seen** (D3) → It is the same placeholder the empty-stake and no-level cases already produce, so it is not a new visual. Manual step 3.6 in `tasks.md` exercises it deliberately so it is observed rather than discovered.
- **Desktop now shows the stop out amount twice with SL set** — once in the Stake popover, once in the below-params row → Both already appear twice when SL is off, so this is the existing desktop layout, not a new duplication. The alternative (mobile-only fix) is worse per D1.
- **Removing the prop touches three files instead of one** → All three changes are mechanical and type-checked; `tsc` catches any missed call site. The alternative leaves a misleading prop in place.
- **A test that asserts "no `has_stop_loss` term"** could ossify the current row model → Avoided: the tests assert the rendered rows for a store with SL set, not the shape of the predicate.
- **Regression in the shared component reaches both breakpoints at once** → `StakeDetails` is only mounted by the two stake inputs, and the full existing `stake.spec.tsx` / `stake-details.spec.tsx` suites are re-run as part of the checklist.

## Migration Plan

None required — a render-condition change with no persisted state, no API contract, no stored preference and no copy change. Rollback is reverting the commit; nothing is written that would outlive it.
