# Display both Commission and Stop out level in Multipliers trade parameters

## Why

Commission was deleted from the Multipliers trade parameters in #1107 and **replaced** by Stop out
level: `MultipliersInformation` and `StakeDetails` now render `Stop out` + `Stop out level` and no
commission at all (`packages/trader/src/AppV2/Components/TradeParameters/MultipliersInformation/multipliers-information.tsx:1`,
`packages/trader/src/AppV2/Components/TradeParameters/Stake/stake-details.tsx:113`). A Multipliers
trade charges a fixed commission on open — it is part of the sum the Buy button quotes
(`purchase-button-content.tsx:50` sums "base stake + commission + DC fee") — but a trader can no
longer see that number anywhere before purchase; it only appears afterwards, on the contract details
page (`Modules/Contract/Components/ContractAudit/contract-details.tsx:192`). Issue #1413 reverses the
product decision: both values must be visible.

## What Changes

- Add a **Commission** row to the Multipliers information rows shown under the desktop trade
  parameters (`MultipliersInformation`), next to the existing Stop out and Stop out level rows.
- Add a **Commission** row to the stake editor details (`StakeDetails`), which back both the mobile
  Stake action sheet and the desktop Stake popover.
- Source the value from the priced proposal's `commission` field, which `getProposalInfo` already
  returns (`Stores/Modules/Trading/Helpers/proposal.ts:136`) and which is identical for `MULTUP` and
  `MULTDOWN`. No new store observable and no new proposal request.
- In the stake editor the value rides on the editor's own `details` state, exactly as `stop_out`
  does, so it re-prices with the stake being drafted rather than freezing at the committed stake.
- Restore the three commission-explanation components #1107 deleted — `commission-formula.tsx`,
  `commission-tooltip.tsx` and `commission-description.tsx` — so the label reveals the live
  `<percentage>% of (<stake> × <multiplier>)` breakdown: a hover tooltip on desktop, and a tap reveal
  or explanation page on mobile. When the percentage cannot be derived the label stays plain and
  non-interactive, while the value row keeps its placeholder.
- While no commission has been priced the row stays rendered with the surface's existing placeholder
  (a skeleton in the information rows, `-` in the stake editor) — it is never removed.
- Update the two stale in-repo notes that assert commission is absent from the trade panel
  (`AppV2/Components/TradeParameters/trade-parameters.tsx:111`, `playwright/flows/trade/flow.md`,
  `playwright/pages/TradeMultipliersPage.ts`).

Not part of this change: the commission line inside the multiplier wheel-picker, also deleted by
#1107. It stays deleted, and the test asserting its absence
(`Multiplier/__tests__/multiplier.spec.tsx:173`) must keep passing unchanged.

## Capabilities

### New Capabilities

- `multipliers-commission-display`: the Commission figure shown before purchase on the Multipliers
  trade parameters and stake editor — where it appears, where its value comes from, how it is
  formatted, what it shows while unpriced, and how its label explains itself.

### Modified Capabilities

None. `multipliers-stop-out-info` keeps every requirement it has: the Stop out and Stop out level
rows are unchanged in source, format, placeholder behaviour, position and visibility rules. This
change only adds a third row beside them.

## Impact

Affected code (all in `packages/trader`):

- `src/AppV2/Components/TradeParameters/Multiplier/commission-formula.tsx`,
  `commission-tooltip.tsx` (+ `.scss`), `commission-description.tsx` (+ `.scss`) — restored from
  `c2c9fd19a6^`, together with their three specs
- `src/AppV2/Components/TradeParameters/MultipliersInformation/multipliers-information.tsx` (+ spec)
- `src/AppV2/Components/TradeParameters/Stake/stake-details.tsx` (+ spec)
- `src/AppV2/Components/TradeParameters/Stake/stake-input.tsx` (mobile sheet state)
- `src/AppV2/Components/TradeParameters/Stake/stake-input-desktop.tsx` (popover state)
- `src/AppV2/Components/TradeParameters/Stake/stake-mobile.tsx` (carousel explanation page, + spec)
- `src/AppV2/Components/TradeParameters/trade-parameters.tsx` (comment only)

Affected docs: `playwright/flows/trade/flow.md`, `playwright/pages/TradeMultipliersPage.ts` (doc
comment only — no locator or test-step change; the existing Stop out locators match their label
exactly, so a third row cannot collide with them).

No API, store, dependency or routing change. No translation keys are invented: the Commission label
reuses a string already in the codebase, and the formula strings come back with the restored
components.
