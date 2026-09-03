## Purpose

Defines the deterministic, locale-aware ordering of the market symbol list shown in the market selector, and bounds the redundant localization work performed while producing that order, so the ordering stays stable while the sort stops re-resolving localized names inside its comparator.

## ADDED Requirements

### Requirement: Symbol list ordering is deterministic and locale-aware

The symbol-sorting utility SHALL order a list of active symbols first by market, using a fixed curated market order — `synthetic_index`, `forex`, `indices`, `cryptocurrency`, `commodities` — and then, within the same market, alphabetically by the localized submarket display name using locale-aware comparison. Symbols whose market is not in the curated order SHALL sort after every symbol whose market is in the curated order, and SHALL tie-break among themselves by localized submarket display name. A submarket with no known localized display name SHALL fall back to its raw submarket key as its comparison value.

The produced order MUST be identical to the order produced before this change for every input; the existing ordering specifications SHALL pass unmodified.

#### Scenario: Symbols ordered by curated market order then submarket name

- **WHEN** a mixed list containing `synthetic_index`, `forex`, `indices`, `cryptocurrency`, and `commodities` symbols is sorted
- **THEN** the result is ordered `synthetic_index`, `forex`, `indices`, `cryptocurrency`, `commodities`, matching the curated market order

#### Scenario: Same-market symbols keep a stable submarket-name ordering

- **WHEN** two or more symbols share the same market
- **THEN** they are ordered alphabetically by their localized submarket display name using locale-aware comparison, preserving the existing relative order

#### Scenario: Unknown markets sort after curated markets

- **WHEN** a symbol's market is not present in the curated market order
- **THEN** it sorts after every symbol whose market is in the curated order

#### Scenario: Empty or single-element lists are returned unchanged

- **WHEN** the input list has fewer than two elements
- **THEN** a list with the same element(s) in the same order is returned

### Requirement: Localized submarket names resolve against the runtime-active language

The localized submarket display names used for ordering SHALL be resolved against the language active at the time the sort runs, not the language present when the module was first loaded. Switching language at runtime and re-sorting SHALL order symbols by the newly active language's display names.

#### Scenario: Language switched at runtime affects ordering

- **WHEN** the user switches the active language and the symbol list is sorted again
- **THEN** ordering reflects the submarket display names of the newly active language, not the language loaded at import time

### Requirement: Localization work is bounded per sort

Sorting a symbol list SHALL resolve each localized submarket display name at most once per sort call, rather than once (or more) per pairwise comparison. For a single sort of a list of roughly 200 symbols, the number of localization lookups SHALL NOT exceed the fixed size of the submarket display-name map (28).

#### Scenario: Localization lookups do not scale with comparison count

- **WHEN** a list of roughly 200 symbols is sorted once
- **THEN** the localization function is invoked at most 28 times, independent of the O(n log n) number of comparisons performed
