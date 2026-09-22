## ADDED Requirements

### Requirement: [DCR-053] Dead trader helper files are removed

The two fully-dead trader helper files SHALL be deleted with their co-located tests, each re-verified to have zero importers (static, dynamic, or barrel) at HEAD first:

- `packages/trader/src/Stores/Modules/Trading/Helpers/multiplier.ts` (`onToggleCancellation`, `onChangeCancellationDuration`) + `__tests__/multiplier.spec.ts`. The same-named `./multiplier` under `AppV2/Components/TradeParameters/Multiplier/` is a different module and SHALL NOT be touched.
- `packages/trader/src/Stores/Modules/Trading/Helpers/preview-proposal.ts` (`previewProposal`, `requestPreviewProposal`) + `__tests__/preview-proposal.spec.ts`. Its live sibling `proposal.ts` (which it imported `createProposalRequests` from) SHALL be kept. The `preview-proposal` entry in `docs/baselines/knip-baseline.json` SHALL drop when the baseline is regenerated.

Neither file is re-exported from a barrel, so no `index.ts` edit is required.

#### Scenario: Dead helper files deleted, live siblings kept

- **WHEN** the trader-helper deletion phase lands
- **THEN** `multiplier.ts` and `preview-proposal.ts` and their specs are gone, `proposal.ts` and the `AppV2` Multiplier module remain, and `check-imports`/`knip:check` (against the regenerated baseline) pass with no dangling importer

### Requirement: [DCR-054] Forward-starting/session dead logic is collapsed in the trade helpers

Because forward-starting contracts and per-session trading windows are no longer supported (every contract defaults to spot; `store.sessions` is never populated), the dead session/start-date logic SHALL be collapsed:

- In `packages/trader/src/Stores/Modules/Trading/Helpers/contract-type.ts`: the `getSessions` stub (returns `{ sessions: undefined }`), the unreachable `getValidTime` and its `hours`/`minutes` consts, the always-false `is_end_of_session` session branch inside `getExpiryTime`, and the `getStartDates`/`start_dates_list`/`contract_start_type` scaffolding that only ever yields "Now" SHALL be removed or collapsed. The live `getExpiryTime`/`getExpiryDate` (used by `Actions/start-date.ts`) SHALL be preserved. The paired dead trade-store outputs (`sessions`, `start_dates_list`) SHALL be removed with any `mockStore.ts`/`types.ts` mirror.
- In `packages/trader/src/Stores/Modules/Trading/Constants/validation-rules.ts`: the neutered `start_time` rule block, the always-`true` last `expiry_time` rule and the dead `isSessionAvailable` import SHALL be removed. The live `getValidationRules`/`getMultiplierValidationRules` exports and the format-validation portions of `expiry_time`/`expiry_date` SHALL be kept.

Each collapse SHALL be re-verified against the current readers before removal; any branch found still reachable SHALL be left in place and the discrepancy surfaced.

#### Scenario: Session/start-date dead logic collapsed, expiry logic intact

- **WHEN** the trade-helper collapse phase lands
- **THEN** `getSessions`/`getValidTime`/the `getExpiryTime` session branch/`start_dates_list`/`contract_start_type` and the neutered `start_time`/`expiry_time` rules and dead `isSessionAvailable` import are gone, `getExpiryTime`/`getExpiryDate` and `getValidationRules` remain live, and duration/expiry selection still works with tests green
