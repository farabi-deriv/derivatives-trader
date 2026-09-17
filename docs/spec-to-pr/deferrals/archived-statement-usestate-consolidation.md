# Deferral: `archived-statement.tsx` parallel `useState` consolidation

## What was deferred

`packages/reports/src/Containers/archived-statement.tsx` reimplements the whole fetch / paginate / filter machine with **10 local `useState` hooks** (lines 49–58: `date_from`, `date_to`, `has_selected_date`, `selected_loginid`, `account_options`, `raw_data`, `is_loading`, `has_loaded_all`, `error`, plus a `useRef` mount-guard at 59) and ~150 LOC of effects/handlers (lines ~49–201) that duplicate logic already centralized in the MobX `StatementStore`:

- filter-driven reset + first-page fetch effect (~92–126) mirrors `StatementStore.handleDateChange` + `clearTable` + `fetchNextBatch`
- account-list bootstrap effect (~71–90)
- `fetchNextBatch` offset/guard logic (~128–151) mirrors `StatementStore.fetchNextBatch`
- debounced scroll pagination (~153–179) mirrors `StatementStore.handleScroll`
- local `handleDateChange` (~189–201) near-identical to `StatementStore.handleDateChange`
- `data`/`is_empty` derivations (~182–187) mirror the `is_empty` computed

Issue #1270 (C5e) explicitly flags this "for later consolidation — do not block on it," so it is **not** changed in this change.

## Why

The nine interdependent fetch-state `useState`s always transition as a unit (a fetch flips `is_loading`/`raw_data`/`has_loaded_all`/`error` together; a filter change resets the same cluster), and the container reproduces a machine the statement store already owns. Consolidating it is a refactor of **live** code with regression surface, out of scope for a dead-code-removal pass whose principle is "no product-behavior change." The reports package also protects statement rendering (C8d), which raises the bar for touching this container.

## Follow-up required

A future change should either:

1. Collapse the fetch state into a single `useReducer` (one state object with `{ data, is_loading, has_loaded_all, error }` transitions), reducing the 10 `useState`s to a small, testable reducer; **or**
2. Fold `archived-statement.tsx` onto the existing `StatementStore` by adding an `archived`/`loginid` mode to the store, deleting the duplicated fetch/paginate/scroll logic entirely.

Either path must preserve current archived-statement behavior (multi-account selection via `selected_loginid`/`account_options`, the end-of-today `date_to` seed, empty-state copy driven by `has_selected_date`) and keep statement rendering green (guard tests / Playwright reports flow). Scope: ~150 LOC in one container; no API change.
