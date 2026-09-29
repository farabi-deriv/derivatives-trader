## ADDED Requirements

### Requirement: [DLM-001] The processed contract-type list records the market it was built for

The store's processed V2 contract-type list (`contract_types_list_v2`) SHALL be accompanied by the symbol whose `contracts_for` response produced it. The setter that assigns the list SHALL be the only writer of that symbol, and SHALL require it as an argument, so a list can never be in the store without an identity. Consumers that decide "does market X offer trade type T" SHALL treat a list whose recorded symbol is not X as carrying no answer for X.

#### Scenario: Setting the list records its market

- **WHEN** the contracts_for processing pushes a processed list to the store for symbol `1HZ25V`
- **THEN** the store reports `1HZ25V` as the market the current contract-type list describes

#### Scenario: A list from another market answers for nothing

- **WHEN** the store holds a non-empty contract-type list recorded for `CRASH500` and the active symbol is `1HZ25V`
- **THEN** availability of any trade type on `1HZ25V` is treated as not yet known, rather than read off the `CRASH500` list

### Requirement: [DLM-002] Boot-time deep-link trade-type resolution waits for the resolved symbol's own contract list

When a deep link supplies a trade type, the initial-market resolver SHALL evaluate that trade type only against the contract-type list recorded for the symbol it has just resolved. It SHALL NOT evaluate against a list that is merely non-empty. The wait SHALL be bounded by the same timeout the resolver already applies to its other waits.

#### Scenario: A stale list from the outgoing market is not consulted

- **WHEN** a deep link `?trade_type=rise_fall&symbol=1HZ25V` is resolved in a browser tab whose inherited session restored `CRASH500` + `accumulator`, and the store still holds the `CRASH500` contract-type list at the moment phase 2 runs
- **THEN** the resolver waits for the `1HZ25V` list before deciding whether `rise_fall` is offered, and does not act on the `CRASH500` list

#### Scenario: The resolved symbol's list settles and offers the trade type

- **WHEN** the `1HZ25V` contract-type list arrives and offers `rise_fall`
- **THEN** the resolver commits `rise_fall` on `1HZ25V`, records it as the URL landing trade type, and shows no URL-unavailable modal

#### Scenario: A later list from another market lands before the resolver reads

- **WHEN** the `1HZ25V` list arrives and, before the resolver acts on it, a late `CRASH500` response replaces the recorded list
- **THEN** the resolver treats the trade type as not yet known: it keeps `1HZ25V`, commits no symbol change, and shows no URL-unavailable modal

### Requirement: [DLM-003] A deep link whose symbol offers the trade type loads that symbol unchanged

When the deep-linked symbol's own contract list offers the deep-linked trade type, the system SHALL load exactly that pair. It SHALL NOT substitute another symbol, SHALL NOT show the URL-unavailable modal, and the URL SHALL end up naming the deep-linked symbol.

#### Scenario: Non-default market card is not replaced by the account default

- **WHEN** a deep link `?trade_type=rise_fall&symbol=1HZ25V` is opened from a tab whose session restored `CRASH500` + `accumulator`
- **THEN** the loaded market is `1HZ25V` with `rise_fall`, and no symbol change to `1HZ100V` is committed

#### Scenario: Default market card shows no "Invalid trade type" popup

- **WHEN** a deep link `?trade_type=rise_fall&symbol=1HZ100V` is opened from a tab whose session restored `CRASH500` + `accumulator`
- **THEN** the loaded market is `1HZ100V` with `rise_fall`, and the URL-unavailable modal is not opened

### Requirement: [DLM-004] The compatible-market reconcile decides against the compatible market's own list

When the deep-linked trade type genuinely is not offered by the resolved symbol, the system SHALL find a symbol that offers it and switch to it, and SHALL decide whether that symbol offers the trade type using the contract-type list recorded for **that** symbol. This SHALL apply whether or not the compatible symbol differs from the current one: a compatible symbol that is already current SHALL also wait for its own recorded list before being judged.

#### Scenario: Reconcile still switches markets for a genuinely unsupported pair

- **WHEN** a deep link supplies `trade_type=rise_fall`, the resolved symbol is a Multipliers-only market whose own recorded list lacks `rise_fall`, and a compatible symbol exists
- **THEN** the system switches to the compatible symbol and applies `rise_fall` once that symbol's own recorded list arrives offering it

#### Scenario: Switched-to compatible symbol's own list arrives without the trade type

- **WHEN** the reconcile has switched to a compatible symbol and that symbol's own recorded list arrives without exposing the requested trade type
- **THEN** the URL-unavailable modal is shown with reason `trade_type`, the trade type is not applied, and the in-progress reconcile flag is released

#### Scenario: A later list from another market lands after the switched-to symbol answers

- **WHEN** the switched-to symbol's own recorded list arrives and, before the reconcile acts on it, a late response for the outgoing market replaces the recorded list
- **THEN** the reconcile shows no URL-unavailable modal, applies no trade type, and releases the in-progress reconcile flag

#### Scenario: Already-current compatible symbol fails fast only on its own list

- **WHEN** the compatible symbol equals the current symbol and that symbol's own recorded contract list does not expose the requested trade type
- **THEN** the URL-unavailable modal is shown with reason `trade_type` without waiting out the full timeout

### Requirement: [DLM-005] An unavailable contract list degrades without substituting a market

When the resolved symbol's contract-type list does not arrive within the bounded wait, the system SHALL keep the resolved symbol and SHALL NOT switch markets on the strength of an unverified list. It SHALL NOT show the URL-unavailable modal in this case, because a list that never arrived is a loading failure, not an unsupported trade type. The trade type SHALL be left for the ordinary availability resolution that runs when the market's response eventually lands.

#### Scenario: Contract list never settles for the deep-linked symbol

- **WHEN** a deep link supplies a symbol and trade type and the symbol's `contracts_for` never produces a recorded list within the wait
- **THEN** the resolver keeps the deep-linked symbol, commits no symbol change to another market, and opens no URL-unavailable modal

#### Scenario: Reconcile wait times out after a market switch

- **WHEN** the reconcile has switched to a compatible symbol and that symbol's own recorded list never arrives within the wait
- **THEN** the store is left as-is with no modal, and the in-progress reconcile flag is released so the page is not held on a loader

### Requirement: [DLM-006] A deep link resolving over a restored session never shows or stamps the restored pair

When a deep link is opened in a browser tab whose inherited session restores another (symbol, trade type) pair, the initial-market resolver SHALL keep the trade page's full-screen loader up from the moment it starts until the deep link has resolved (or degraded), and SHALL defer the ordinary trade-type availability resolution for that whole window. The restored pair SHALL NOT be rendered as the selected market and trade type, and SHALL NOT be written into the URL, even when its own `contracts_for` response settles first. The hold SHALL end on every exit path of the resolver, including a timeout or a thrown error. A deep link into a tab with nothing to restore SHALL NOT hold the loader.

#### Scenario: The inherited market answers before the deep link resolves

- **WHEN** a deep link `?symbol=1HZ100V&trade_type=rise_fall` is opened in a tab whose session restored `CRASH500` + `accumulator`, and the `CRASH500` `contracts_for` response settles before `active_symbols` arrive
- **THEN** the loader stays up, the URL still reads `symbol=1HZ100V&trade_type=rise_fall`, and no `CRASH500` + `accumulator` pair is stamped into it

#### Scenario: The deep link settles

- **WHEN** `active_symbols` arrive and the `1HZ100V` list offers `rise_fall`
- **THEN** the loaded pair is `1HZ100V` + `rise_fall`, the URL names that pair, the loader is released, and no URL-unavailable modal is opened

#### Scenario: Fresh tab with nothing to restore

- **WHEN** a deep link is opened in a tab whose session holds no stored pair
- **THEN** the resolver does not hold the loader beyond the existing reconcile behaviour
