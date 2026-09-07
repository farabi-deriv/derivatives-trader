# derived-market-ordering Specification

## Purpose
TBD - created by archiving change 994-derived-market-ordering. Update Purpose after archive.
## Requirements
### Requirement: [DMO-001] Derived submarket sections render in the curated order

When the market selector lists the **Derived** market (`market: 'synthetic_index'`), its submarket sections SHALL appear in exactly this order:

1. Volatility indices (`random_index`)
2. Step indices (`step_indices` / `step_index`)
3. Jump indices (`jump_indices` / `jump_index`)
4. Crash/Boom (`crash_boom` / `crash_index`)
5. Daily reset indices (`random_daily`)
6. Forex basket (`basket_forex` / `forex_basket`)
7. Gold basket — the commodities basket (`basket_commodities` / `commodity_basket`)

Entries 1-5 belong to the `synthetics` subgroup and entries 6-7 to the `baskets` subgroup, so the `synthetics` section SHALL render before the `baskets` section. Sections whose submarket is absent from the account's tradeable set for the selected trade type SHALL simply be omitted; the remaining sections SHALL keep this relative order.

#### Scenario: A Derived list containing all seven submarkets

- **WHEN** the Derived category is shown for a trade type whose tradeable set covers all seven submarkets above
- **THEN** the section headings read, top to bottom: Volatility indices, Step indices, Jump indices, Crash/Boom, Daily reset indices, Forex basket, Commodities basket — under a `Synthetics` heading for the first five and a `Baskets` heading for the last two, in that order

#### Scenario: Baskets never precede synthetics

- **WHEN** a Derived list contains at least one `baskets` symbol and at least one `synthetics` symbol
- **THEN** every `synthetics` submarket section appears above every `baskets` submarket section

#### Scenario: A subset of the curated submarkets

- **WHEN** a trade type's Derived set contains only Volatility indices, Crash/Boom and Forex basket
- **THEN** the sections read Volatility indices, Crash/Boom, Forex basket — no gap, no reordering

#### Scenario: Incoming symbol order does not influence the result

- **WHEN** the same Derived symbols are supplied in a different order (for example baskets first, or Crash/Boom before Volatility)
- **THEN** the rendered section order is identical to the curated order above

### Requirement: [DMO-002] Derived section order does not depend on the display language

The Derived section order SHALL be determined solely by submarket **keys**, never by localized display names. Changing the UI language SHALL re-label the sections without moving any of them.

#### Scenario: Switching language keeps sections in place

- **WHEN** the user switches the UI language to a non-English locale and the Derived list is shown again
- **THEN** the sections appear in the same order as in English — Volatility, Step, Jump, Crash/Boom, Daily reset, Forex basket, Commodities basket — with translated headings

#### Scenario: A locale with different collation rules

- **WHEN** the active locale would sort the translated section names differently from their English names
- **THEN** the section order is unchanged, because the ordering never consults the translated names

### Requirement: [DMO-003] Submarket key aliases denote the same section

Each curated submarket may arrive under either of its known keys — `step_indices`/`step_index`, `jump_indices`/`jump_index`, `crash_boom`/`crash_index`, `basket_forex`/`forex_basket`, `basket_commodities`/`commodity_basket`. Both spellings of a pair SHALL be ranked identically, so which key the API sends SHALL NOT change the rendered order.

#### Scenario: Legacy alias keys order identically

- **WHEN** the symbol set uses `step_index`, `jump_index`, `crash_index`, `forex_basket` and `commodity_basket`
- **THEN** the sections render in the same positions as when the set uses `step_indices`, `jump_indices`, `crash_boom`, `basket_forex` and `basket_commodities`

#### Scenario: Mixed aliases within one list

- **WHEN** one Derived list contains symbols keyed `crash_boom` and others keyed `crash_index`
- **THEN** both spellings are ranked at position 4 and neither is pushed to the end of the list as an unknown submarket

### Requirement: [DMO-004] Uncurated Derived submarkets are kept and placed after the curated ones

A Derived submarket absent from the curated list — `range_index` ("Range break indices") today, and any submarket the API introduces later — SHALL still render. It SHALL be placed after every curated submarket section within its own subgroup, and uncurated submarkets SHALL keep their existing relative order among themselves. No symbol SHALL disappear from the selector as a result of the ordering.

#### Scenario: Range break indices falls to the end rather than vanishing

- **WHEN** the Derived set contains `range_index` alongside the curated submarkets
- **THEN** a Range break indices section is present, positioned after every curated submarket section that shares its subgroup — after Daily reset indices if `range_index` is a `synthetics` symbol, after Commodities basket if it is a `baskets` one

#### Scenario: Every supplied symbol survives the ordering

- **WHEN** any Derived symbol set is ordered for display
- **THEN** the set of symbols rendered is exactly the set supplied — none dropped, none duplicated

### Requirement: [DMO-005] The order is identical on every trade type and both breakpoints

The Derived section order SHALL be the same regardless of the selected trade-type tab, and SHALL be the same on the desktop (Web) selector and the mobile (Responsive) selector.

#### Scenario: Same order across trade types

- **WHEN** the user switches between trade-type tabs (for example Rise/Fall, then Multipliers, then Touch/No Touch) and views the Derived category in each
- **THEN** the Derived sections present in each tab appear in the curated relative order in every one of them

#### Scenario: Same order across breakpoints

- **WHEN** the same account views the Derived category in the desktop selector and in the mobile selector
- **THEN** both show the Derived sections in the same order

### Requirement: [DMO-006] Ordering outside the Derived sections is unchanged

This ordering SHALL be confined to the Derived market's sections. The market-level order, the market category chips, the relative order of symbols **within** a submarket section, and the section order of every non-Derived market SHALL be unaffected.

#### Scenario: Market order and chips untouched

- **WHEN** the selector renders its market category chips and its market-level ordering
- **THEN** the markets appear in their existing curated order (Derived, Forex, Stock indices, and the rest), unchanged by this capability

#### Scenario: Symbols inside a section keep their order

- **WHEN** a submarket section such as Volatility indices is rendered
- **THEN** the symbols inside it appear in the same relative order as before this change

#### Scenario: Non-Derived markets keep their existing section order

- **WHEN** the Forex, Stock indices, Cryptocurrencies or Commodities category is rendered
- **THEN** its submarket sections appear in the same order as before this change

### Requirement: [DMO-007] Subgroup section order and submarket order come from one definition

The order of the Derived **subgroup** sections and the order of the **submarket** sections SHALL be derived from a single ordering definition, so the two cannot disagree. The subgroup sequence obtained by reading the curated submarket order top to bottom SHALL equal the subgroup sequence used to render the sections.

#### Scenario: The two orderings agree

- **WHEN** the subgroup sequence implied by the curated submarket order is compared with the subgroup order used to render the Derived sections
- **THEN** the two sequences are equal (`synthetics`, then `baskets`)

#### Scenario: Adding a submarket to the definition moves both

- **WHEN** a submarket is added to, removed from, or repositioned in the ordering definition
- **THEN** both the submarket section order and the subgroup section order reflect it, with no second place to edit

