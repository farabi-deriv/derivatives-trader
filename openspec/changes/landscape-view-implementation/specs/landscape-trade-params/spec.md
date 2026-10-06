## Purpose

Defines the floating frosted-glass pill on the landscape trade surface and its drag-driven value picker for Accumulator stake and take profit: the pure-function value ladder, the passive three-row glass panel, commit semantics, the take-profit on/off switch, the insufficient-balance contract, the reused Buy button, and the theme-aware design tokens.

## ADDED Requirements

### Requirement: [LTP-001] A floating pill carries the parameters and Buy over the chart

A new `AppV2/Components/TradeParameters/Landscape/landscape-trade-params.tsx` (an `observer`) SHALL render, positioned bottom-right over the chart, a pill containing the parameter chips and `<PurchaseButton/>`. It owns a single `active_param` and enforces "one wheel open at a time". Per-param logic SHALL live in adapter hooks (`adapters/use-landscape-stake.ts`, `adapters/use-landscape-take-profit.ts`), not in sibling components, each returning one shape: `{ key, label, display_value, is_disabled, buildLadder, selected_value, commit, hint, should_block_commit }`. When `ui.is_landscape_chrome_hidden` is true the pill SHALL collapse from the expanded width (Take profit + Stake + Buy) to the collapsed width (Stake + Buy) by animating the take-profit chip out via `max-width` + `opacity`; any tap restores the full row.

Chips SHALL be a bespoke `landscape-params__chip` element, not a quill `TextField` (which drags in input internals and RTL overrides), also avoiding the global `[dir='rtl'] .trade-params__option .input` rule.

#### Scenario: Pill renders chips and Buy over the chart

- **WHEN** the landscape surface is shown with chrome visible
- **THEN** the pill shows the Take profit chip, the Stake chip and the Buy button

#### Scenario: Pill collapses with chrome and restores on tap

- **WHEN** `is_landscape_chrome_hidden` becomes true
- **THEN** the take-profit chip animates out and the pill shows only Stake + Buy; a subsequent tap restores the full row

### Requirement: [LTP-002] The glass panel is a sibling of the pill, not a descendant

The frosted-glass value panel SHALL be a **sibling** of the pill under a shared `position: relative` wrapper, never a child of the pill. The pill needs `overflow: hidden` so the chips' dimmed neighbour values clip against its 999px radius as the mockups show; nesting the panel inside would clip it out of existence. The wrapper carries no background and no overflow; the panel is absolutely positioned above the pill.

#### Scenario: Panel is not clipped by the pill

- **WHEN** the value panel is open above the active chip
- **THEN** the panel is a DOM sibling of the pill (not a descendant), so the pill's `overflow: hidden` does not clip it

### Requirement: [LTP-003] The value ladder is a pure function over integer tenths with no float drift

Both stake and take profit SHALL use a uniform `0.10` step. The ladder SHALL be a pure function computed in integer tenths — **no materialised array, no `Map`** — so float drift (`0.1 * 3 === 0.30000000000000004`) can never reach a displayed or committed value. `AppV2/Utils/landscape-wheel-utils.ts` SHALL implement:

- `floor_t = Math.ceil(min * 10)` (a fractional `min` like `0.35` floors up to `0.40`, always ≥ the server minimum),
- `ceil_t = Math.floor(max * 10)` (always ≤ max),
- `valueAt(i) = (floor_t + i) / 10`,
- `indexOf(v) = Math.round(v * 10) - floor_t`, clamped to `[0, ceil_t - floor_t]`.

Bounds come from `validation_params[ACCUMULATOR].{stake,take_profit}.{min,max}`.

#### Scenario: valueAt and indexOf are exact inverses with no drift

- **WHEN** any index `i` in range is passed to `valueAt` and back through `indexOf`
- **THEN** the round-trip returns `i`, and `valueAt(i) * 10` is always an integer (no float drift)

#### Scenario: Fractional bounds clamp inward to the server range

- **WHEN** `min` is `0.35`
- **THEN** the lowest ladder value is `0.40` (never below the server minimum), and `max` is floored to a whole tenth ≤ max

#### Scenario: indexOf clamps at both ends

- **WHEN** a value below `min` or above `max` is passed to `indexOf`
- **THEN** the result is clamped to the first or last valid index

### Requirement: [LTP-004] A drag gesture on the chip steps the ladder, and a tap opens the panel

A new `Landscape/use-param-drag.ts` hook SHALL, on the chip: `pointerdown` capture the pointer and mark the param active; `pointermove` convert vertical travel to steps as `steps = trunc(dy / STEP_PX)`, subtracting consumed travel so the sub-step remainder carries into the next move; `pointerup`/`pointercancel` release the capture and begin the settle. The chip SHALL set `touch-action: none` so the browser never claims the drag for panning. A press that moves less than ~4px is a tap and SHALL still open the panel — so tap and scroll are the same gesture. `STEP_PX` starts at 24. Because the step is a uniform `0.10`, velocity-based acceleration of `STEP_PX` SHALL be applied so a flick covers larger ranges while a slow drag resolves single tenths.

#### Scenario: A drag emits the expected number of steps

- **WHEN** the pointer is dragged 48px vertically with `STEP_PX = 24`
- **THEN** exactly 2 steps are emitted

#### Scenario: A tiny move is a tap that still opens the panel

- **WHEN** the pointer moves less than 4px between down and up
- **THEN** no step is emitted, the gesture counts as a tap, and the panel opens

#### Scenario: Sub-step remainder carries across moves

- **WHEN** consecutive `pointermove` events each move less than `STEP_PX` but together exceed it
- **THEN** the accumulated remainder produces a step on the move that crosses the threshold

#### Scenario: pointercancel releases the capture

- **WHEN** a `pointercancel` fires mid-drag
- **THEN** the pointer capture is released and the settle begins

### Requirement: [LTP-005] The glass panel is a passive readout of exactly three rows

The panel SHALL never be a scroll container. It renders exactly three entries — `valueAt(i-1)` dimmed, `valueAt(i)` large, `valueAt(i+1)` dimmed — via a shared `Landscape/landscape-value-rows.tsx` renderer also used at small scale inside the chip (the faint neighbour values in the mockups). Only three values are ever in the DOM regardless of ladder length (no virtualisation needed). At the ends of the ladder the neighbour rows SHALL clamp/blank correctly. Formatting is unchanged (`$10.00`). The panel follows whichever chip is active (stake vs take profit).

#### Scenario: Panel shows three values and clamps at the ends

- **WHEN** the active index is in the middle of the ladder
- **THEN** the panel renders `valueAt(i-1)`, `valueAt(i)`, `valueAt(i+1)`; at index 0 or the last index the out-of-range neighbour is blanked, not a wrong value

#### Scenario: Only three rows exist however long the ladder is

- **WHEN** the ladder spans tens of thousands of tenths
- **THEN** the panel still renders exactly three value rows

### Requirement: [LTP-006] Commit happens on settle, is idempotent, and never fires merely on open

A commit SHALL occur only on settle — a 120ms debounce after the last step, or immediately on `pointerup` — guarded by a `last_committed_ref` so re-settling on the same value is a no-op. Opening the panel on a value that is off the ladder (e.g. `10.55` typed in portrait, then rotate) SHALL position the index at the nearest tenth but **must not commit** — only a settled drag writes to the store, so the user's `10.55` survives until they actually change it. Stake commits `onChange({ target: { name: 'amount', value } })`; take profit commits `onChangeMultiple({ has_take_profit, take_profit, …(enabled ? { has_cancellation: false } : {}) })`, mirroring `RiskManagement/take-profit-and-stop-loss-input.tsx`. If the store clamps a committed value, the index SHALL be re-derived from the store value after settle. Panel dismissal (idle timeout or tap outside) is purely visual because the value is already committed. The landscape editors SHALL NOT fire `useProposal` — the streaming proposal already validates every committed value.

#### Scenario: Settle commits once

- **WHEN** a drag settles on a new value
- **THEN** the adapter's `commit` is called exactly once with that value

#### Scenario: Re-settling on the same value is a no-op

- **WHEN** a drag settles on the value already committed
- **THEN** `commit` is not called again

#### Scenario: Opening on a fractional stored value does not commit

- **WHEN** the panel opens with a stored stake of `10.55`
- **THEN** the index is positioned at the nearest tenth but `commit` is not called, and `10.55` remains the stake until a drag settles

### Requirement: [LTP-007] Take profit is switched on and off in its panel

Take profit SHALL be turned on and off by a switch in its value panel's header (Figma `363-2711`), not by a position on the ladder. Tapping the take-profit chip opens the panel whether take profit is on or off, as stake does. While off, the chip shows `-` (matching portrait) and the ladder is faded and inert: dragging, the wheel and arrow keys do not step it, so only the switch turns take profit on. Switching on commits the value the panel shows — the last value set before it was switched off, else the lowest rung. Switching off commits `has_take_profit: false`. The switch renders in its real state on first paint, without animating from off.

A sentinel "Off" rung was rejected: it would make "off" reachable by scrolling, contradicting the inert-while-off behaviour.

#### Scenario: Switching on commits the displayed value

- **WHEN** the panel is open with take profit off and the switch is turned on
- **THEN** take profit is committed at the value shown and the chip displays it

#### Scenario: Scrolling while off does nothing

- **WHEN** take profit is off and the panel is dragged, scrolled or arrow-keyed
- **THEN** the value does not change and nothing is committed

#### Scenario: Switching off keeps the last value

- **WHEN** take profit is set to 10, switched off, and the panel reopened
- **THEN** the ladder shows 10

### Requirement: [LTP-008] The insufficient-balance contract is honoured without capping or disabling Buy

Landscape SHALL honour the balance contract: insufficient balance has exactly one authority — the server-reported path; Buy stays pressable; the stake is never capped; the hint belongs to the stake editor. Because landscape has no Save button, the analogue is: while the balance hint shows, the drag still steps and the panel still displays the value, the hint renders inside the glass and the selected row takes the error colour, but the **commit is suppressed**. Stepping back to an affordable value commits immediately. The hint logic SHALL be extracted from `stake-input.tsx` into a shared `AppV2/Hooks/useStakeBalanceHint.ts` used by all three editors (so the contract has one implementation), preserving portrait behaviour.

Invariants: `landscape-trade-params.tsx` and `landscape-param-chip.tsx` MUST NOT import `client.balance`, `getInsufficientBalanceMessage`, or the hint hook — only `use-landscape-stake.ts` may. The stake chip takes no error/status prop, so no code path can make it red. `PurchaseButton` is rendered unmodified, so "Buy is never disabled by a client-side balance check" holds by construction. Clamping the ladder maximum to the balance is explicitly rejected.

#### Scenario: Unaffordable stake shows a hint but does not commit or disable Buy

- **WHEN** the balance is 5 and the stake drag reaches 50
- **THEN** the hint renders in the glass, the stake `onChange` is **not** called, Buy is present and **not** disabled, and the stake chip carries no error class

#### Scenario: Stepping back to an affordable value commits

- **WHEN** the drag steps from an unaffordable value back to an affordable one
- **THEN** the affordable value commits immediately

#### Scenario: Portrait balance-hint behaviour is unchanged after extraction

- **WHEN** the shared `useStakeBalanceHint` is used by the portrait stake editors
- **THEN** the portrait hint, input error status and Save gating behave exactly as before the extraction

### Requirement: [LTP-009] The Buy button is reused verbatim and shows no payout caption in landscape

`<PurchaseButton/>` SHALL be reused verbatim — no extraction, no new behavioural prop — fitted only with CSS (`__wrapper { width: 100% }` overridden to the spec's 120px, and the skeleton width with it). Its accumulator Close-contract swap, `is_accu_settling`, risk-disclosure, skeletons and the server-reported insufficient-balance path are internal and store-driven. In landscape `isMobile` is false (width > 600), so for a fresh accumulator `has_no_button_content` is true and the `Max. payout` caption is not rendered — matching the spec's `showDetails=false` for free. The `isMobile` read at `purchase-button.tsx:137` SHALL NOT be swapped for `useIsPhoneViewport()` (that would restore the caption and break the 120×56 spec); a comment SHALL mark this.

#### Scenario: Payout caption is absent for a fresh accumulator in landscape

- **WHEN** the purchase button renders in landscape (`isMobile: false`, Accumulators, no open contract)
- **THEN** the `Max. payout` caption is not rendered and the button is label-only

### Requirement: [LTP-010] The error snackbar clears the landscape pill

`getErrorSnackbarBottomOffset` in `packages/trader/src/AppV2/Utils/layout-utils.tsx` SHALL gain an `is_landscape` argument that returns the pill height + inset + gap, so a landscape error toast never covers the pill or Buy. The offset number SHALL stay inside the helper (no hard-coded offset at any call site). Every existing (portrait) case SHALL be unchanged.

#### Scenario: Landscape snackbar clears the pill

- **WHEN** `getErrorSnackbarBottomOffset` is called with `is_landscape: true`
- **THEN** it returns an offset that clears the pill (its height + inset + gap)

#### Scenario: Existing offsets unchanged

- **WHEN** `getErrorSnackbarBottomOffset` is called without the landscape flag
- **THEN** it returns exactly today's value for every existing case

### Requirement: [LTP-011] Colours map to existing theme-aware tokens with a backdrop-filter fallback

No new colour token SHALL be introduced and `scripts/generate-colors.js` SHALL be untouched. Each Figma spec colour maps onto an existing theme-aware token (panel bg → `--semantic-color-monochrome-surface-normal-lowest`; panel inset shadows and pill border → `--semantic-color-monochrome-surface-normal-low` / `--semantic-color-monochrome-border-normal-mid`; chip bg → `--semantic-color-slate-solid-surface-frame-low`; chip border → `--semantic-color-monochrome-border-normal-high`) rather than the light-only hex from Figma. The panel is 4% tint with `blur(4px)`; the pill is `blur(4px)` + a 1px border with no background. The panel's four inset shadows SHALL be one `box-shadow` declaration of four layers (four separate declarations would override each other). An `@supports not (backdrop-filter: …)` opaque fallback SHALL be provided for **both** surfaces (not optional — the pill has no background, so without it the controls would float on bare chart). Logical properties (`inset-inline-end`, `padding-inline`) SHALL be used for RTL.

#### Scenario: Surfaces use tokens, not hardcoded hex

- **WHEN** the panel and pill render in dark and light themes
- **THEN** their colours come from the existing semantic tokens and are correct in both themes (no glaring white chips over a dark chart)

#### Scenario: Opaque fallback when backdrop-filter is unsupported

- **WHEN** the browser does not support `backdrop-filter`
- **THEN** both the panel and the pill fall back to an opaque background so the controls are readable

### Requirement: [LTP-012] The value picker is accessible and honours reduced motion

The chip SHALL be a `role="spinbutton"` with `aria-valuenow`/`aria-valuetext` and arrow-key stepping. When `prefers-reduced-motion` is set, the rows SHALL cross-fade rather than slide (the repo already reads that query in `market-tab.tsx`).

#### Scenario: Chip exposes spinbutton semantics and keyboard stepping

- **WHEN** assistive technology inspects the chip, or the user presses arrow keys with it focused
- **THEN** the chip reports `role="spinbutton"` with the current value, and arrow keys step the ladder

#### Scenario: Reduced motion cross-fades instead of sliding

- **WHEN** `prefers-reduced-motion` is set
- **THEN** value transitions cross-fade rather than animate position
