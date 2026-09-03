## ADDED Requirements

### Requirement: [MT-005] Entering Automate with no automate tabs seeds one supported default market

When the user enters Automate and the automation tab collection is empty (no persisted `open_markets_automation` and no automate tab created by other means), the system SHALL seed exactly one supported default market as the active tab: `Rise/Fall` on the app default symbol when `rise_fall` is supported, otherwise the first supported trade type on the app default symbol. The market strip SHALL never be left with zero tabs on a first Automate entry.

#### Scenario: First Automate entry with an empty persisted automate collection

- **WHEN** the automation tab collection is empty and the user enters Automate carrying over a manual `(symbol, contract_type)` pair (supported or not)
- **THEN** the strip seeds one supported default tab (`Rise/Fall` on the app default symbol when available, else the first supported trade type) and shows it as the active tab — the strip is never left blank

#### Scenario: Remembered automate pair equals the carried-over pair

- **WHEN** the remembered automate market equals the currently active `(symbol, contract_type)` pair, so the mode-flip reconciler makes no tab-creating call
- **THEN** the seed effect still runs and seeds a supported default tab, rather than relying on the reconciler — the strip is not left blank

#### Scenario: A supported market is already the active tab

- **WHEN** entering Automate with a supported market already open and active in the automation collection
- **THEN** no seed occurs and no duplicate tab is added — the existing supported tab stays active

### Requirement: [MT-006] The seed survives a concurrent supported-trade-types write

The seed of the first supported default market SHALL complete even when the automation-supported trade-type set is handed to the store on the same strip mount. A no-op or benign reallocation of the automation tab collection observable (from applying the supported-set guard) SHALL NOT permanently cancel the pending seed; the seed SHALL commit its resolved default symbol rather than latch "already seeded" and discard it.

#### Scenario: Supported set applied while the async default-symbol pick is in flight

- **WHEN** the strip mounts, hands the store a new supported-trade-types set (routing through the open-markets writer), and the asynchronous `pickDefaultSymbol` resolves after that write's re-render has run the effect's cleanup
- **THEN** the resolved default symbol is still committed and the seeded tab appears active — the commit is not discarded because a cleanup ran, and the "one seed at a time" latch does not block it forever

### Requirement: [MT-007] A failed seed commit does not permanently block seeding

If the asynchronous seed commit fails (e.g. a WebSocket drop mid-commit), the system SHALL NOT leave an unhandled promise rejection and SHALL release the "seed in flight" latch so a subsequent effect run (e.g. re-entering Automate) can retry the seed. Retries SHALL be bounded per Automate visit, so a persistently failing commit cannot retry on every dependency change; the budget SHALL be reset whenever the latch is (a supported market becomes active, or the supported set is cleared on leaving Automate).

#### Scenario: Seed commit rejects

- **WHEN** the async seed's `selectMarketAndTradeType` commit rejects
- **THEN** the rejection is caught (no unhandled rejection) and the seed latch is reset, so a later run can seed a supported default tab rather than the strip staying permanently blank

#### Scenario: Commit keeps failing

- **WHEN** the seed commit rejects repeatedly and observable churn re-runs the effect more times than the retry budget allows
- **THEN** no further seed attempt is made once the budget is spent — the strip stays blank for that visit rather than retrying on every dependency change (a persistently failing commit means the connection is down, which the app surfaces separately)

#### Scenario: Leaving and re-entering Automate after the budget is spent

- **WHEN** the retry budget has been spent and the user leaves Automate (the supported set is cleared, or the strip unmounts) and returns
- **THEN** the latch and the retry budget are both reset, so the seed is attempted again on the new visit

### Requirement: [MT-009] A seed commit never lands after Automate is left

The asynchronous seed SHALL NOT commit once the app is no longer in Automate. The check SHALL read the live mode at commit time, not a value captured (or mirrored into a ref) during render: `setActiveOpenMarkets` selects its collection from the live `is_automation_mode`, and on mobile leaving Automate unmounts the strip so no later render can refresh a captured value. A commit that lands after the mode flip would append the automation default to the **manual** collection and overwrite the user's manual market.

#### Scenario: The user returns to Manual while the default-symbol pick is in flight

- **WHEN** the seed's `pickDefaultSymbol` is still awaiting and the user leaves Automate (mobile: the `/automate` route unmounts the strip; desktop: the Automation panel tab is switched away)
- **THEN** the resolved symbol is not committed — the manual collection, its persisted value, and the active `(symbol, contract_type)` are all unchanged

#### Scenario: Re-entering Automate after a blocked commit

- **WHEN** a seed was blocked because Automate had been left, and the user enters Automate again
- **THEN** the seed runs afresh on the new visit and seeds a supported default tab

### Requirement: [MT-008] A no-op tab-collection write is elided

The active open-markets writer SHALL skip reassigning and persisting the tab collection when the next list is element-wise identical to the current one, so a no-op write does not reallocate the observable array or invalidate observers that depend on it.

#### Scenario: Re-applying the automation supported-set guard filters nothing out

- **WHEN** the automation-supported trade-type set is applied and every currently open automation tab is already supported (nothing is filtered out)
- **THEN** the writer leaves the automation tab collection observable unchanged (no reassignment, no re-persist) rather than allocating a new equal array and notifying every observer

#### Scenario: A genuine change still writes

- **WHEN** an add, remove, or replace produces a tab collection that differs from the current one
- **THEN** the writer reassigns and persists the new collection as before
