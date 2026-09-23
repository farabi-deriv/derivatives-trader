## ADDED Requirements

### Requirement: [DCR-053] The unreachable account-verification modal is removed from the services-error path

The `PleaseAuthenticate` branch of the services-error surface SHALL be removed in full, because the trading API service is unaware of POI/POA status and therefore cannot return `PleaseAuthenticate` from any of the four endpoints (`buy`, `sell`, `cancel`, `contract_update`) that feed `setServicesError`. The removal SHALL cover the modal component and its co-located spec, the `PleaseAuthenticate` switch arm and its spec case in the services-error modal, the `PleaseAuthenticate` clause in the core common store's mobile services-error gate, and the modal's now-orphaned SCSS block. The sibling branches — `AuthorizationRequired`, `InsufficientBalance`, `CompanyWideLimitExceeded` and the generic default modal — SHALL be unaffected, and `CompanyWideLimitExceeded` SHALL still open the modal on mobile rather than raise a toast.

#### Scenario: No PleaseAuthenticate handling survives

- **WHEN** the tree is grepped for `PleaseAuthenticate` and for the account-verification modal's file, class names and spec
- **THEN** no occurrence remains in any package

#### Scenario: The remaining services-error branches are untouched

- **WHEN** the services-error modal is rendered with each of `AuthorizationRequired`, `InsufficientBalance`, `CompanyWideLimitExceeded` and an unrecognised code
- **THEN** each renders exactly the component it rendered before, and an unrecognised code still renders the generic error modal

#### Scenario: The mobile services-error gate still opens for the company-wide limit

- **WHEN** a services error with code `CompanyWideLimitExceeded` is set on a mobile viewport
- **THEN** the services-error modal is opened rather than a toast being added, and every other code on mobile still produces a toast unless the toast is suppressed

### Requirement: [DCR-054] The Traders-Hub and appstore cosmetic naming is confirmed absent and its last residue removed

The cosmetic naming Workstream C set out to rename — `dt_traders_hub_*` test ids, `traders-hub-header__*` CSS and the `--pre-appstore` CSS modifier — SHALL be re-verified at HEAD across `packages/` and `playwright/` before anything is renamed. Where a pattern has no occurrence, no rename SHALL be invented for it and the absence SHALL be recorded. The one surviving residue — the consumer-less `tradershub` modifier on the shared page-overlay header — SHALL be deleted as dead CSS. Because this discharges the bullet without touching a single selector, the change SHALL NOT edit any Playwright or RTL assertion under this requirement; an assertion SHALL never be adjusted to make a rename pass.

#### Scenario: The three named patterns have no occurrence

- **WHEN** `packages/` and `playwright/` are grepped for `dt_traders_hub`, `traders-hub-header` and `pre-appstore`
- **THEN** every pattern returns zero occurrences and no rename is performed for it

#### Scenario: The dead tradershub SCSS modifier is removed

- **WHEN** the page-overlay stylesheet is checked for the `tradershub` header modifier
- **THEN** the modifier is gone, no selector in any package emits or consumes that class, and stylelint passes

#### Scenario: No test selector is changed

- **WHEN** the change's diff is inspected
- **THEN** it contains no edit to a Playwright locator, a `data-testid` value or an RTL query under this requirement

### Requirement: [DCR-055] The reader-less cashier fields are removed from the shared currency config

The cashier-era fields `min_withdrawal`, `pa_min_withdrawal` and `pa_max_withdrawal` SHALL be removed from every entry of the shared crypto currency configuration, but only after a grep across all packages and `playwright/` proves no reader exists. If any live reader is found, the fields SHALL be left in place and the discrepancy reported instead of deleted. The surrounding file is live and SHALL keep working: `display_code`, `name` and `fractional_digits` stay, and the statement/transaction-history path — the deposit, withdrawal and transfer action-type handling that users see as their history — SHALL be unaffected.

#### Scenario: The grep gate is clean before deletion

- **WHEN** all packages and `playwright/` are grepped for `min_withdrawal`, `pa_min_withdrawal` and `pa_max_withdrawal`
- **THEN** the only occurrences are the currency configuration's own declarations, and deletion proceeds

#### Scenario: A live reader blocks the deletion

- **WHEN** the grep finds any reader outside the currency configuration itself
- **THEN** the fields are left in place and the finding is reported rather than the deletion forced

#### Scenario: Currency display behaviour is unchanged

- **WHEN** currency display codes, names and decimal places are resolved after the removal
- **THEN** every value matches the value resolved before it, and the statement action-type rendering is untouched

### Requirement: [DCR-056] The filtered trade types keep their icons permanently

The `tradeTypeIcons` entries and the `icon-trade-types` switch arms for the 10 filtered trade types SHALL be KEPT permanently and SHALL NOT be removed by this or any later cleanup change: they render HISTORICAL positions for users who traded those types before the filter. The display names returned by the supported-contracts helper and the `isAsiansContract` / `isLookBacksContract` / `isTicksContract` / `isResetContract` predicates SHALL likewise be kept for the same reason. This requirement records a settled decision so it is not re-raised.

#### Scenario: The icon entries and predicates survive the sweep

- **WHEN** the trade-type icon map, the icon switch arms, the supported-contracts display names and the four historical-contract predicates are checked after this change
- **THEN** all of them are present and unchanged
