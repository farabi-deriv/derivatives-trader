## Context

See `proposal.md` — Why. The mechanics that constrain the design:

**Where the stake comes from today.** `useContractsFor` reads `contract.default_stake` off the `contracts_for` response and pushes it into the store (`packages/trader/src/AppV2/Hooks/useContractsFor.ts:172` → `setDefaultStake`, `trade-store.ts:1413`). `processNewValuesAsync` then writes it into `amount` on symbol / trade-type change (`trade-store.ts` ~1920-1957):

```ts
if (this.default_stake && this.is_dtrader_v2) {
    const has_symbol_changed = ...;
    const has_contract_type_changed = ... && !this.isSameTradeTypeGroup(old, new);
    if (has_symbol_changed || has_contract_type_changed) {
        const stake_override = !is_crypto && preset_key ? getStakePresetOverride(preset_key, symbol) : undefined;
        if (stake_override) obj_new_values.amount = stake_override[0];
        else if (should_reset_amount) obj_new_values.amount = is_crypto ? default_crypto_value : this.default_stake;
    }
}
```

**Where the minimum comes from.** Nowhere on `contracts_for` — `packages/api/types.ts:104-115` augments the entry with `default_stake` and `payout_choices` only. `min_stake` / `max_stake` arrive only on a `proposal` result and are written to `stake_boundary` via `setStakeBoundary` (`trade-store.ts:2774`), keyed by `response.echo_req.contract_type`, i.e. the **`CONTRACT_TYPES`** form (`VANILLALONGCALL`), while `this.contract_type` holds the **`TRADE_TYPES`** form (`vanillalongcall`). Both stake surfaces already bridge that gap with `getDisplayedContractTypes(trade_types, contract_type, trade_type_tab)` and read limits out of `validation_params[contract_types[0]].stake`.

**Two live gaps on the error path.** (Described here on the Vanillas path, where the bug was reported; neither is Vanillas-specific — see decision 6.)

1. `onProposalResponse` writes `proposal_info[contract_type]` and `validation_params[contract_type]` **before** it reaches any Vanillas-specific branch (`trade-store.ts:2173-2180`), and then calls `setValidationErrorMessages(getProposalErrorField(response), ...)`. Both feed `useTradeError` (`proposal_info[...].has_error` / `validation_errors`), which is what red-styles the Stake field and gates the snackbar in `trade-mobile.tsx` / `trade-desktop.tsx`. So by the time the "stake too low" response is inspected, the error is already user-visible state.
2. The Vanillas branch that stores the boundary from an error is gated on `barrier_choices` being present (`trade-store.ts:2270`), so a plain stake-field rejection can carry `min_stake` in `error.details` and still be dropped.

**Two existing patterns to reuse rather than reinvent.**

- **The proposal hold.** `is_awaiting_contracts_for` (`trade-store.ts:468`, gate at `2101-2108`) already suppresses proposals until a symbol's `contracts_for` values are applied, and `processContractsForV2` releases it. The Vanillas stake gate is the same shape one step later in the sequence.
- **`duration_default_applied_for`.** `trade-store.ts:354` records the trade-type group a default duration was applied for, so a manual value survives a symbol change while the configured default still lands on first load. The stake reconciliation needs exactly this idempotency, keyed one level finer.
- **`getStakePresetValues`.** `packages/trader/src/AppV2/Utils/trade-params-utils.tsx:502` already filters a base preset array to `[min, max]`, prepends the minimum as a one-tap floor, and falls back to multiples of the minimum when fewer than three survive. It is already wired into the mobile surface. The only thing it lacks is a _round_ floor.

## Goals / Non-Goals

**Goals**

- Make "resolve the minimum → derive the default and the ladder → then render" the actual order of operations, client-side, with no new API dependency.
- Keep the derivation in **pure, unit-testable helpers**; keep the store's job to sequencing and idempotency.
- One source of truth for the derived floor **and cap**, consumed by both stake surfaces, so desktop and mobile cannot drift.
- Apply the derivation **uniformly across trade types** (decision 6), so there is no trade type on which the platform knowingly offers a stake the market rejects.

**Non-Goals**

- Changing the shared base preset sets themselves (`TRADE_PARAMETER_PRESETS.stake.*`). They stay as the shape a ladder starts from; only the floor, the cap and the top-up change.
- Changing `stake_boundary`'s shape or key, the `contracts_for` query, or the proposal request builder.
- Changing crypto-currency stake behaviour — the existing `isCryptocurrency` branch in the reset block keeps precedence.
- Adding min stake to `contracts_for` (see Risks → follow-up).

## Decisions

### 1. Derive with pure helpers; a dedicated ladder helper replaces the old filter

Add to `packages/trader/src/AppV2/Utils/trade-params-utils.tsx`:

- `roundUpToRoundStake(min: number): number` — a **per-decade round-value ladder**. `step = 10 ** Math.floor(Math.log10(min))`, then the first of `step * [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]` that is `>= min`. Yields `6.5 → 8`, `8 → 8`, `11 → 15`, `25 → 25`, `34.06 → 40`, `2 → 2`, `0.35 → 0.4`. Self-scaling across currencies and magnitudes, always round, and monotonic — it can never return a value below the input.

    **Revised after QA.** This began as a 1‑2‑5‑10 ladder, whose gaps let a minimum be rounded up to nearly double itself (`34.06 → 50`, `25 → 50`). That was tolerable only while the high-minimum symbols were served by a curated table; once every market derives its own floor, the rounding is what decides whether the lowest quick pick sits near the minimum or twice it. The denser steps cap the overshoot at ~1.36x and reproduce the deleted tables at the bottom of the ladder (`25 → 25`, `34.06 → 40`, against hand-written sets opening at 25 and 35).

- `getDerivedDefaultStake(api_default_stake, min_stake, max_stake): number | undefined` — `Math.max(api_default_stake, roundUpToRoundStake(min_stake))`, falling back to the **raw minimum** when that rounded value would overshoot `max_stake` (a narrow band is the one case where the round value is not available). `undefined` when no usable minimum is known, so callers keep today's behaviour.

The `max(...)` is deliberate: markets whose `contracts_for` default is already valid keep **USD 2 exactly as today**, so the blast radius is only the markets the ticket is about. Deriving purely from the minimum would _lower_ the default to 1 on min‑1 markets — a behaviour change nobody asked for.

**The quick-pick ladder is then `getStakeLadderValues(base, derived_default, max_stake)`** — the same shape as `getStakePresetValues`, called with the derived default in place of the raw minimum, but leading with its floor **unconditionally**. On a min‑8 market: base `[1, 5, 10, 20, 50, 75]` filtered at floor 10 → `[10, 20, 50, 75]` — first chip _is_ the default, nothing below the minimum, all round. On a min‑2 market → `[2, 5, 10, 20, 50, 75]`, a one-value diff from today. On a min‑34.06 market only `[50, 75]` survive, so the `floor * [1, 2, 5, 10, 15, 25]` fallback takes over from the _derived_ floor: `[50, 100, 250, 500, 750, 1250]` capped by `max_stake`.

A dedicated helper rather than the older `getStakePresetValues`: that one prepended the floor only when the base presets reached below it, so a floor _under_ the lowest preset (a sub‑1 minimum, e.g. `0.35 → 0.5`) dropped off the ladder and left the chips starting at `1` while the applied stake was `0.5`. Making the floor the ladder's first element by construction is what turns "the default equals the lowest quick pick" from two derivations that agree into one number used twice.

**Revised — `getStakePresetValues` is deleted, not kept alongside.** Once decision 6 routes every trade type through the ladder, the old filter has no production caller left. Keeping it would leave two helpers that answer the same question differently, which is precisely how the desktop/mobile divergence arose in the first place. Its unit tests are removed with it; `roundUpToRoundStake` keeps its own coverage.

**Revised after QA — the top-up rungs are tighter, and rounded.** `STAKE_LADDER_MULTIPLIERS` multiplies the _floor_, so the original `[1, 2, 5, 10, 15, 25]` — sensible from a floor of 2 — offered a `1000` chip on a market whose minimum is 34. The curated tables it replaces climbed roughly linearly (35, 40, 45 …), so the rungs are now `[1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20]`, each passed through `roundUpToRoundStake` before being offered — a raw multiple of an already-rounded floor is not itself round (`1.25 × 25 = 31.25`). The list runs long precisely because that rounding collapses neighbouring rungs into duplicates and the row still has to come out six wide.

**Revised after QA — the row is always `STAKE_PRESET_COUNT` (6) wide.** Filtering at the floor only ever _removes_ values, so a min‑8 market showed a 4-chip row (`[10, 20, 50, 75]`) and a min‑11 market a 3-chip row — read in review as quick picks having gone missing next to the 6 every other trade type shows. The base presets above the floor are now topped up from the top with `floor * [1, 2, 5, 10, 15, 25]` values above everything already offered: min‑8 → `[10, 20, 50, 75, 100, 150]`, min‑11 → `[20, 50, 75, 100, 200, 300]`, min‑34.06 → `[50, 75, 100, 250, 500, 750]`. Topping up from _above_ rather than switching wholesale to the multiplier ladder keeps the curated base values that are still valid, and keeps the row strictly ascending with no repeats. `max_stake` still outranks the width: a band with no room for six ascending values (`floor 10 / max 60`) offers the ones that fit rather than a value the market would reject — the alternative, denser sub-multiples (`30`, `40`) to pad such a band, buys nothing on any range a real Vanillas market reports.

Alternatives considered:

- _Compute the ladder from scratch by continuing the 1‑2‑5 decade ladder from the default_ (`10, 20, 50, 100, 200, 500`) — rejected as the default: it duplicates logic `getStakePresetValues` already owns, throws away the curated Vanillas base shape, and widens the spread. Kept as the fallback in Open Questions.
- _Multiply the derived default by the `[1, 2, 5, 10, 15, 25]` shape unconditionally_ — rejected: on the common min‑2 market it produces `[2, 4, 10, 20, 30, 50]`, replacing today's chips wholesale and introducing the un-round `4`.
- _Round up to the next multiple of 5 (or 10)_ — rejected: does not scale. Fine at `8 → 10`, wrong at `0.35` and clumsy at `3400`.

### 2. Absorb the first proposal for a market as a limits probe

Add a guarded block in `onProposalResponse` **after** the stale-symbol and `MarketIsClosed` guards but **before** the `proposal_info` / `validation_params` writes at `trade-store.ts:2173`:

```ts
// min/max stake exist only on a proposal result, so the first response for a
// (symbol, contract_type) is what reveals them. Absorb that response — record the boundary,
// settle the stake on the derived default + quick-pick floor, and re-price — so a stake the
// platform itself chose can never reach proposal_info and surface as the user's error.
```

The block — extracted as `absorbStakeLimitsProbe`, with the payload parsing in `getStakeLimitsFromResponse` beside the other response utilities in `Helpers/proposal.ts` — fires when **both**: the response carries `min_stake` (see decision 8 for the three places responses actually put it); and `probed_stake_keys` does not yet hold `` `${symbol}:${contract_type}` ``. It is **not** gated on trade type — see decision 6. It then:

1. `setStakeBoundary(contract_type, min_stake, max_stake)` — recorded from every response carrying a band, fenced or not;
2. adds the key to `probed_stake_keys` (before any await, so a re-entrant response cannot loop);
3. computes `getDerivedDefaultStake(this.default_stake, min_stake, max_stake)` and `is_stake_in_play` — whether the response was priced against the stake the store still holds (`echo_req.amount === this.amount`); only a stake still in play can be settled, so a value the user typed while the probe was in flight is theirs;
4. **needs correction** (in play, differs from the derived default): applies the derived default, clears the stake error the rejected probe left standing (`requestProposal` bails while any validation error stands, and `processNewValuesAsync` does not re-validate on `amount`), applies the contract choices riding the same payload (`applyAbsorbedContractChoices`), re-prices, and absorbs;
5. **clean success at the settled stake**: falls through — the price becomes visible;
6. **a rejection with nothing to correct, stake still in play**: absorbed and re-priced anyway — the fence has closed, so letting it through would strand the platform's own entry stake in an error state with no retry;
7. **a rejection answering a stake the user has since replaced**: swallowed with NO side effects — its choices were priced against the old stake and any standing error belongs to the new draft; the user's own proposal is already in flight and delivers their state.

`onProposalResponse` itself guards staleness on two dimensions before the probe runs: the symbol (pre-existing), and the trade type — a response whose contract type has no outstanding request in `proposal_requests` is a straggler from a tab the user has left (subscriptions are forgotten on a switch, but a response already in flight still lands) and is dropped before it can settle anything for a contract shape no longer on screen.

Step 4 settles the stake in **both** directions, not only upwards from a below-minimum value. A stake carried in from a higher-minimum market or sub-type — or a quick pick tapped there, e.g. `500` on a min‑34.06 market — can be perfectly valid on the market being entered and still sit far above its lowest quick pick, which is what makes the starting stake look arbitrary. Because the block is fenced per `(symbol, contract_type)`, "the stake when this key was entered" is the only thing it can touch; a stake the user sets afterwards on the same key is theirs and is priced as typed.

Also **drop the `barrier_choices` gate** on the existing Vanillas error branch's boundary read (`trade-store.ts:2270`) so `min_stake` / `max_stake` are recorded from any error that carries them, not just barrier-choice errors. The `barrier_choices` handling itself stays gated, and the Vanillas strike reconciliation is applied inside the absorb block before the re-price — otherwise the early `return` would skip it and `barrier_1` would stay on a strike the market rejected.

Alternatives considered:

- _Reconcile after the fact, once `stake_boundary` lands (issue option 1)._ Rejected as the primary: the error has already been written to `proposal_info` by then, so the user sees a red stake field and a snackbar that self-corrects a moment later — which the acceptance criteria explicitly forbid. Suppressing it afterwards means unwinding `proposal_info`, `validation_params` and `validation_errors`, which is strictly more surface area than not writing them.
- _Gate the whole stake field behind a spinner until `stake_boundary` is populated (issue option 3)._ Rejected as the mechanism for the stake correction: the absorb approach is invisible when nothing needs correcting. Note that a loading state **is** shown for the trade parameters row on a tab switch (decision 7), but that is a different problem — stale values from the previous tab — and it ends as soon as the tab is priced once.
- _Ask the backend for `min_stake` on `contracts_for` (issue option 2)._ The right long-term fix and the only one that removes the round-trip; out of scope here because it needs an API change. Recorded as a follow-up.

### 3. Key the idempotency per (symbol, contract type)

New observable `probed_stake_keys` on `TradeStore`: a set of every `` `${symbol}:${contract_type}` `` whose own proposal has reported a stake band this session — per contract type because sub-types (Vanilla Call / Put, Turbos Up / Down) carry separate minimums, and per symbol because the store is one while tabs are per-market. `stake_boundary` itself is keyed the same market-qualified way, and set membership is its provenance: it says the band under that key came from that market's own proposal.

(This began as a single last-probed string, `stake_default_applied_for`, mirroring `duration_default_applied_for`. A single key cannot serve per-market tabs — whichever tab priced most recently took it over and the tab beside it lost its ladder, the defect recorded below — so the set replaced it outright rather than living beside it.)

Consequences that fall out for free, matching the spec's re-entry scenarios:

- **Symbol switch** and **entering a trade type from another one** change the key → the next proposal probes again.
- **Sub-type flips (Call ↔ Put, Up ↔ Down)** change the key → probe again. This matters because the recently-merged same-group guard (`!this.isSameTradeTypeGroup(...)`, `trade-store.ts:1930`) means a Call↔Put flip no longer resets the stake at all, so the probe is now the _only_ thing that can raise a stake below the new sub-type's minimum. Reconciliation deliberately lives on the proposal path rather than in the reset block for exactly this reason.
- **Tab navigation back into a market** re-mounts and re-prices; if the key still matches and the stake is still valid, nothing happens (no flicker); if the store was reset, it probes again.
- **A user stake is never overwritten while the same market and sub-type stay active**, because the key is already reconciled by the time the user can touch the field; step 4 fires at most once per key.

Alternative considered: keying on the preset key (`'vanillas'`, `'turbos'`) rather than the contract type — rejected, it cannot distinguish the sub-types and so fails the Call↔Put criterion.

### 4. One store-side floor and cap, consumed by both surfaces

Add a computed on `TradeStore` — initially `vanilla_stake_preset_floor` — returning the derived default for the active (symbol, contract type) when `is_vanilla` and a boundary is known, and `undefined` otherwise. Both surfaces read it and pass it as the `min_stake` argument to `getStakePresetValues`:

- `stake-input.tsx:373-377` (mobile) already calls `getStakePresetValues(...)`; only the floor argument changes — `floor ?? details.min_stake`.
- `stake-desktop.tsx:51-52` (desktop) currently calls `getStakePresets(presetKey, symbol)` **raw, with no limit filtering at all** — this is the desktop/mobile inconsistency the ticket calls out. It is switched onto `getStakePresetValues` with the same floor and `max_stake`.

Deriving the floor once in the store — rather than in each component from `validation_params` — is what makes the desktop/mobile-parity requirement structural rather than a coincidence two components have to keep re-earning.

**Revised after QA (#1227).** The computed is `stake_preset_limits`, returning `{ floor, max }` or `undefined`, and both surfaces read both values from it. Two reasons the floor alone was not enough:

- **The cap has to travel with the floor.** With the maximum still coming from each surface's own state, the floor could land a round trip before it and reshape the ladder twice — a second flicker behind the one QA reported.
- **The limits are known a round trip before `validation_params` repopulates.** The first response for a market is absorbed to correct the stake (decision 2) and returns before writing `validation_params`, but it has already recorded the limits it carried. The computed reads the market-qualified `stake_boundary` as a second source, fenced by `probed_stake_keys` — the same provenance check decision 5's reset block makes — so the ladder resolves as soon as the market is priced once instead of waiting for the re-price.

`undefined` now means "this market has not been priced yet", and both surfaces render **no** quick picks for it: the ladder is derived entirely from the floor, so anything shown before it is a value that is about to be replaced.

**Revised after QA — the wait is a skeleton, not an empty row.** "No quick picks" rendered as a collapsed, empty row, which reads as chips missing rather than chips loading, and the surface resized when they landed. A new `ValueChipsSkeleton` (`AppV2/Components/InputPopover`) holds the row's grid with a full row of chip-sized placeholder blocks; it takes the caller's variant class, so the mobile sheet's pill row is a row of pills and the desktop popover's is a row of blocks. Desktop reaches it through a new `isLoading` prop on `ChipsWithInputToggle` (the `input` tab is unaffected — the sheet's own input never waits on the limits); mobile swaps it in at the `ValueChips` call site. Both gate it on `!preset_values.length` alone: after decision 6 every trade type derives its ladder from the market's limits, so every trade type has the same wait and the same placeholder. (The earlier revision gated this on `preset_key === 'vanillas'`, which is exactly the divergence decision 6 removes.)

### 5. Apply the derived default in the reset block too

In the `default_stake` reset block (~`trade-store.ts:1920-1957`), when a boundary is already known for the target (symbol, contract type) — e.g. returning to a market probed earlier in the session — use `getDerivedDefaultStake(...)` instead of the raw `this.default_stake`. When no boundary is known yet, the account default is applied and the probe corrects it against the entered market's own proposal. The boundary read is fenced by `probed_stake_keys` holding the target key: `stake_boundary` is never cleared, so membership is what says the band under the market-qualified key came from that market's own proposal.

**The stake resets on every switch, on every trade type**, not only when the current stake still equals the account default: because the resolution is per market and per sub-type, a stake customised on the previous market has no standing on the next one. This mirrors the curated Turbos override directly above, which likewise replaces a customised stake on a switch.

This makes `should_reset_amount` unconditionally true, so the flag and its `user_amount_is_default` input are removed rather than left as dead code. **This is a behaviour change beyond the reported bug** — previously only Vanillas force-reset — and is called out in `proposal.md` under Impact.

The `getStakePresetOverride` branch above it keeps precedence, so the three curated Turbos symbols still start from their override's first value.

### 6. Apply the derivation to every trade type, not only Vanillas

**Revised after review.** The original design gated every new path on the Vanillas preset key, on the reasoning that a narrow blast radius is the safer change. Implementing it that way surfaced the opposite: the gate is what creates the inconsistency.

The ordering gap has nothing to do with Vanillas. `contracts_for` omits `min_stake` for **every** trade type, so on every trade type the platform picks a stake before the number that would validate it exists. Turbos already hit this and was patched with `STAKE_PRESET_SYMBOL_OVERRIDES` — a hardcoded per-symbol table for `1HZ25V`, `1HZ50V` and `R_75`, i.e. the workaround this ticket explicitly rules out. Shipping a Vanillas-only derivation would mean landing the correct mechanism directly alongside the hack it supersedes, and leaving every other trade type offering quick picks its market rejects (Turbos on `R_100`, min 3, offered `$1` and `$2`).

So the gates are removed:

- the limits probe in `onProposalResponse` no longer checks `this.is_vanilla`;
- `stake_preset_limits` resolves for any trade type;
- both stake surfaces call `getStakeLadderValues` unconditionally, instead of branching on `preset_key === 'vanillas'`;
- the reset block applies the derived default for any trade type.

What this costs, honestly: every trade type now waits for its market to be priced once before its quick picks appear (decision 4's skeleton covers the wait), and curated presets below a market's minimum are no longer offered. Both are the intended corrections — the alternative is knowingly showing a value the API will reject — but they change chips on markets that were not in the original bug report, so they are called out in `proposal.md` and covered by updated characterization tests rather than left for review to discover.

The Vanillas-specific pieces that remain are genuinely Vanillas: the strike/`barrier_choices` reconciliation inside the absorb block, and `applyVanillaBarrierChoices`.

### 7. Hold the trade parameters in a skeleton until the open tab's contract information is loaded

Every trade parameter's own value — durations, barriers, the default stake, the payout choices — is
derived from the `contracts_for` response the market switch reloads, so on a switch the row would
otherwise show the previous tab's values until the new data lands. The skeleton is gated on
`is_awaiting_contracts_for`: armed by the symbol reaction on every market switch, released by
`processContractsForV2` once the response is applied — including for closed markets and for pairs
with nothing to price, so the row cannot strand.

**Revised — this began as a proposal-gated state.** The first cut derived `is_awaiting_first_proposal`
from a settled `(symbol, trade-type category)` pair, ending the skeleton only when the first price
arrived. That held the row a full round trip longer than its values need (the params come from
`contracts_for`, not from the price), and it cost real machinery: two settled-pair observables, a
`settleTradeParamsLoading()` that had to be called from every path that decided no proposal was
coming (closed market, validation errors, nothing to price) or the row stranded, and a category-match
rule so sub-type toggles did not re-skeleton the row. Gating on `contracts_for` deletes all of it:
the hold and its release already exist for the proposal pipeline, a trade-type toggle within a
symbol never re-arms it (contracts_for covers all trade types of a symbol), and no per-outcome
settling is needed because the response always arrives.

Only parameters that render as a chip are replaced: the inline digit grid and the Allow equals
toggle are not chips, and Trade type tabs stay live so the sub-type can still be switched while the
data loads.

**The placeholder matches the chip's shape, not just its height.** `trade-params__skeleton` pins
quill's field height with `border-box` so the chip's border is counted inside it, and carries
quill's own `--component-field-border-radius-md`, which the inner `Skeleton.Square` inherits — that
block is square by default and would otherwise show square corners inside a rounded slot. The row is
therefore the same height _and_ the same shape before and after the values land; only the content
changes.

**The purchase button's "no price yet" gate is its own, not the row's.** Buying genuinely needs a
price, so the button cannot borrow the row's contracts_for gate. It derives the wait locally from
the contract's own proposal info — no `id` and no error yet — which keeps the insufficient-balance
flow's inform-don't-disable behaviour (an error response also has no id, but it sets `has_error`).

### 8. Record a stake band from a partial response, and absorb the probe unconditionally

**Revised after QA — this is the defect behind the reported screenshot.** `setStakeBoundary` wrote nothing unless a response carried **both** a minimum and a maximum:

```ts
if (min_stake && max_stake) { ... }
```

A stake rejection carries the minimum that rejected it and frequently no maximum at all — which is exactly what Vanillas on Volatility 75 returns. The whole payload was therefore dropped, including the one number the derivation hangs on. Everything downstream failed together: `stake_preset_limits` stayed `undefined`, so the quick picks never left their loading skeleton; no correction ran, so the stake stayed on the rejected default in an error state with Buy disabled; and `stake_default_applied_for` had already been set, so nothing retried for as long as the market stayed open.

`min_stake` alone is now enough to record. The minimum drives the floor and the default; the maximum only trims the top of the ladder. An existing value is preserved when a later partial response arrives, so a band learned in full is never narrowed back to half by a subsequent rejection.

The absorb block gains a second exit for the same reason. Its correction only fires when the stake differs from the derived default, so a rejection could otherwise fall through to `proposal_info` while the fence blocked any re-price — the same stranded state by a different route. When the probe carries an error and no correction is needed, the response is now swallowed and re-priced instead. Only the first probe per key is treated this way, so a genuine error on the re-priced stake still surfaces.

**A second read of the same limits was wrong in a different way.** The block took them as `response.proposal ?? response.error?.details`, i.e. whichever half was present. But a rejection can carry _both_: Turbos prices the contract and rejects the stake in one payload, so `proposal` is an object with no limits on it, `??` stops there, and `error.details.min_stake` is never read. The limits are now taken from wherever they actually appear, per field, so the read does not depend on exactly one half being absent.

**A third failure, specific to Turbos, came from the early return itself.** The absorb block returns before the error branches further down, and those branches apply the contract-shape values that ride on the _same_ payload as the limits. Vanillas' `barrier_choices` was already handled inside the block for exactly this reason; Turbos' `payout_per_point_choices` was not. Absorbing the probe therefore left `payout_choices` empty and `payout_per_point` unset, so the re-price went out with no payout per point and the panel could not price at all — the stalled Turbos panel, reached without any limits bug being involved. Both are now applied by one `applyAbsorbedContractChoices` helper, which is the general form of a rule the Vanillas case was only satisfying by hand: **whatever the skipped branches would have applied has to be applied here.**

**A fourth, and the one that kept Turbos broken after the other three.** The computed fenced its `stake_boundary` read on the whole `symbol:contract_type` key. But trade types that price several sub-types at once — Turbos subscribes a proposal for Up _and_ Down together — write that fence from whichever sub-type answered first, which is routinely not the selected one. With Up selected and Down answering first, the fence read `1HZ50V:TURBOSSHORT` while the computed looked for `TURBOSLONG`, so it returned `undefined` and the quick picks stayed empty no matter how correctly the limits had been recorded.

The fence answers "was this boundary written while the current market was open", so it is now matched on the **symbol** alone. The boundary is still read per contract type, so sub-types keep their own minimums; where the selected sub-type has not answered yet, the read falls back to the entry the fence names — the band is a property of the market and currency, not the direction. It falls back only to that entry, never to any entry: `stake_boundary` is never cleared, so an arbitrary one can outlive the market that wrote it.

This is also the answer to "why does it work on Vanillas but not Turbos": Vanillas prices one sub-type at a time, so its fence and its read always agreed.

**A fifth, and the one behind "works when I switch market inside a tab, not when I open a new one".** Two pieces of state were single-valued while tabs are per-market and the store is one:

- The fence was a single `symbol:contract_type` string. Opening a second tab moved it there, so the first tab's boundary was rejected the moment another tab priced.
- `stake_boundary` is keyed by contract type alone, so two tabs on the same trade type share an entry and the second to price overwrites the first.

Switching market _inside_ a tab never exposed either: there is only one market in play, so the single fence always names it. Opening a second tab is what makes them two.

The fence is now `probed_stake_keys`, a set of every `(symbol, contract type)` whose own proposal reported a band, and `setStakeBoundary` records under `symbol:contract_type` as well as the bare type. Both reads in the computed are market-qualified, so a tab can neither lose its band to a sibling tab nor borrow one from it. The bare key stays for the other readers in the store.

**A sixth, and the one the Network trace actually shows.** A stalled market's frames are: `proposal` at the entry stake, a `forget_all`, and then nothing — no second proposal. `requestProposal` bails before sending whenever `validation_errors` holds anything, and `processNewValuesAsync` re-validates only on a `contract_type` or `currency` change, never on `amount`. So the stake error raised against the rejected probe outlived the corrected write and blocked the very re-price meant to replace it. Both exits of the absorb block now clear that error before re-pricing. This is also why the failure looked intermittent rather than tab-shaped: it depends on whether a stake error was standing when the probe answered, not on how the market was opened.

**A seventh — the Turbos-only dead end, found by probing the live API rather than the code.** A Turbos proposal sent with no `payout_per_point` is rejected with `ContractCreationFailure: "Missing required contract parameters"` carrying **no limits and no choices** — nothing in the store, old code or new, can recover from that payload. The request builder falls back to the store's `payout_choices`, but nothing ever wired those in from `contracts_for`: they only ever arrived on proposal _responses_, so the first Turbos entry of a session had neither a value nor a fallback and sent the doomed request. (The initialisation comment in `processContractsForV2` even says "from contracts*for payout_choices" — the wiring it describes was missing.) A previous Turbos visit left stale choices behind, which produced a \_recoverable* invalid-value rejection instead — hence "sometimes it works". Vanillas needs no payout_per_point, which is the whole Vanillas/Turbos asymmetry.

`useContractsFor` now pushes the active contract's `payout_choices` into the store alongside `default_stake`, and the pre-proposal initialisation also replaces a value carried in from another market (one not in the new market's own list), so the first proposal is never sent unpriceable.

**An eighth — the rejection that reports the minimum does not carry it where the code looked.** QA captured the live `InvalidMinStake` payload: `details` is just `{ field: "amount" }`, and the number exists only in `code_args` (`["8.00"]`) and the human message. Every reader of the limits — this change's and the pre-existing branches' — read `details.min_stake` only, so the one rejection whose entire purpose is to report the minimum was invisible, on every trade type. The richer shape the fixtures assumed (`details` carrying `min_stake`/`max_stake`) is real, but it arrives on _other_ rejections — the barrier rejection carries the limits alongside `barrier_choices` — which is why a request with a stale barrier (Vanillas on the test link) recovered while a request wrong only in its stake (Turbos after decision 7's wiring; Vanillas on master) did not: the cleaner the request, the poorer the rejection. The extraction now also reads `code_args[0]` when the subcode is `InvalidMinStake`, and only then — on other subcodes `code_args` holds the message's own fill-ins (the barrier list, for one) and must never be mistaken for a limit.

These defects predate the generalisation in decision 6: the Vanillas path was byte-for-byte identical before it. They survived because every store fixture supplied both limits on a single half of the response, so neither a min-only payload nor a dual proposal+error payload was ever exercised. The fixtures now include both.

## Risks / Trade-offs

- **One extra proposal round-trip on markets that need correcting.** The probe is rejected, then the corrected stake is priced. → On any trade type now, but still only on the minority of markets whose minimum exceeds the default, and only once per (symbol, sub-type) per session. The corrected stake goes out through `debouncedProposal`, so it coalesces with any other pending change.
- **A brief window with no price while the probe is absorbed.** The rejected response never populates `proposal_info`, so the purchase buttons stay disabled a little longer than today (they are already disabled during `is_awaiting_contracts_for`). → Acceptable, and strictly better than today's visible error. Verify manually that the trade panel shows its normal loading state, not an empty/error state.
- **`min_stake` absent from the error payload.** If a stake rejection ever arrives with no `min_stake` in `error.details`, the probe cannot fire and the user sees today's behaviour. → Fail-open by design: the guard requires `min_stake`, so the change can only ever be neutral-or-better. Assert this fallback in a unit test so it stays deliberate.
- **Re-entrancy / infinite loop.** The reconciliation writes `amount`, which triggers a new proposal, which re-enters `onProposalResponse`. → the key joins `probed_stake_keys` **before** the await, and the guard checks membership, so the probe runs at most once per key. Cover with a test that a second response for the same key is a no-op.
- **Currency scale.** `roundUpToRoundStake` is magnitude-relative, so it behaves for low-unit currencies without a per-currency table. Crypto keeps its existing `getMinPayout` branch and is not routed through the new helper. → Add a unit test at sub‑1 magnitudes (`0.35 → 0.5`).
- **Chip-set churn on ordinary markets.** The leading `1` chip becomes `2` on min‑2 markets, because the spec requires the ladder to start at the default. → Intended and required by acceptance criterion 3; called out here so it is not read as a regression in review.
- **Churn beyond Vanillas, from decision 6.** Curated presets below a market's minimum are dropped on every trade type (Turbos on `R_100`, min 3: `[$1, $2, $5, $10, $15, $25]` → `[$5, $10, $15, $25, $30, $40]`), and a customised stake no longer survives a market switch on any trade type.
- **The three previously-curated Turbos symbols change chips.** `1HZ25V` `[35, 40, 45, 50, 55, 60]` → `[40, 50, 60, 80, 100, 150]`, `1HZ50V` `[25, 30, 35, 40, 45, 50]` → `[25, 40, 50, 80, 100, 150]`, `R_75` `[10, 15, 20, 25, 30, 35]` → `[8, 10, 15, 25, 40, 50]`. → Each still opens at or near the market minimum, which is the property that matters; the derived rows reach further above it than the hand-written ones. Worth a product eye in QA (6.4) — it is the visible cost of removing the hardcoded tables. → Both are the corrections the ticket asks for, generalised; both are covered by updated characterization tests so the new expectation is explicit rather than incidental.
- **Every trade type now waits for the first price before showing quick picks.** → Covered by the skeleton (decision 4); the wait is exactly one round trip, the same one the trade parameters row already waits for (decision 7).
- **Follow-up (report upstream / API).** Two backend requests would delete most of this machinery. (1) The client-side probe exists only because `contracts_for` does not expose min/max stake — add them to the augmented `contracts_for` entry (`packages/api/types.ts:104-115`), and `absorbStakeLimitsProbe`, the `probed_stake_keys` fence and `getStakeLimitsFromResponse` can be deleted outright, the derivation moving to where `default_stake` and `payout_choices` are read in `useContractsFor`. (2) The `InvalidMinStake` rejection carries the minimum only in its message's `code_args` (`details` is just `{ field: "amount" }`) — add `min_stake`/`max_stake` to its `details`, matching the barrier rejection's shape, and the client's coupling to a message template's argument order goes away.

## Migration Plan

No data, config or flag migration. Sequence: pure helpers + their tests → store probe/reconcile + tests → both stake surfaces + tests → cross-trade-type characterization updates.

Rollback is per-layer and independent: reverting the two component call sites restores today's chips; reverting the `onProposalResponse` block restores today's ordering; the pure helpers are inert if unreferenced.

`packages/stores/src/mockStore.ts` gains a `stake_preset_limits` default so that component tests which do not care about stake limits still render a chip row rather than the loading skeleton; tests asserting a specific ladder override it.
