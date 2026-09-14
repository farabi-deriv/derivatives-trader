## Purpose

Ensures the Automate Trading strategy-parameter editor for Stake multiplier / Stake increment communicates the allowed value range and enforces it consistently across desktop and mobile, so traders know the valid bounds before saving on any breakpoint.

Bounds are a property of the **parameter**, not of the selected strategy: the editor is rendered once per parameter key (`multiplier`, `unit`) with the same selected strategy, so every requirement below is phrased per parameter.

## ADDED Requirements

### Requirement: [ASMR-001] The Stake multiplier editor shows the allowed range hint

The Stake multiplier / Stake increment editor SHALL display a helper hint under the input, identically on desktop and mobile, whenever no validation error is active.

For the `multiplier` parameter the hint SHALL state the bounds resolved for that parameter from the `auto_list_strategies` schema, phrased to match the lower bound's inclusivity. With the bounds the schema currently sends (`exclusiveMinimum: 1`, `maximum: 10`) the hint SHALL read "The value must be greater than 1 and no more than 10."

For the `unit` (increment) parameter the hint SHALL read "Minimum 1". The schema supplies no bounds for `unit`, so it keeps a fixed floor and does not consume resolved bounds.

When a validation error is active, the error message SHALL replace the hint.

#### Scenario: Multiplier range hint shown

- **WHEN** a user opens the Stake multiplier editor for the `multiplier` parameter and no validation error is present
- **THEN** the helper text under the input reads "The value must be greater than 1 and no more than 10."

#### Scenario: Increment minimum hint shown

- **WHEN** a user opens the Stake increment editor for the `unit` parameter and no validation error is present
- **THEN** the helper text under the input reads "Minimum 1"

#### Scenario: Error message replaces the hint

- **WHEN** a validation error is active on the editor input
- **THEN** the input shows the error message instead of the range hint

### Requirement: [ASMR-002] Multiplier validation matches the shown range

The editor SHALL accept a `multiplier` value only when it satisfies the bounds resolved for that parameter, and SHALL otherwise show the same sentence the hint uses.

The lower bound is exclusive when the schema sends `exclusiveMinimum`; the upper bound arrives as `maximum` and is **inclusive**. With the bounds the schema currently sends the enforced rule is therefore `> 1 and <= 10`, matching what `auto_start` itself enforces (`InvalidArgument: must be > 1 and <= 10`). A blank or non-numeric draft SHALL be rejected with the same message.

The `unit` parameter SHALL keep its own floor of 1 with the message "Increment must be at least 1", and SHALL NOT inherit the multiplier's bounds.

#### Scenario: Value at or below the exclusive minimum is rejected

- **WHEN** a user enters a multiplier of `1` or lower and saves
- **THEN** the value is not committed and the input shows "The value must be greater than 1 and no more than 10."

#### Scenario: Value at the inclusive maximum is accepted

- **WHEN** a user enters a multiplier of exactly `10` and saves
- **THEN** the value is committed and the editor closes

#### Scenario: Value above the maximum is rejected

- **WHEN** a user enters a multiplier above `10` and saves
- **THEN** the value is not committed and the input shows "The value must be greater than 1 and no more than 10."

#### Scenario: The increment keeps its own floor

- **WHEN** a user enters an increment of `1` for the `unit` parameter and saves
- **THEN** the value is committed, because the multiplier's bounds do not apply to the increment

### Requirement: [ASMR-003] Breakpoint parity for the range hint

The editor SHALL present the same range guidance and enforce the same bounds on desktop and mobile, so the guidance a trader sees does not depend on breakpoint.

Both breakpoints SHALL derive the hint from the same bounds, resolved once per parameter by `getParamBounds(key)` from the `auto_list_strategies` schema and rendered through the same localized string, falling back per end to the client defaults only until the schema resolves or where it omits a bound. Neither breakpoint reads a hardcoded bound.

#### Scenario: Same multiplier hint on both breakpoints

- **WHEN** the Stake multiplier editor is opened on desktop and on mobile
- **THEN** both show "The value must be greater than 1 and no more than 10." under the input, derived from the same resolved bounds and localized string, so the two cannot drift

#### Scenario: Same multiplier bounds enforced on both breakpoints

- **WHEN** a multiplier outside the resolved range is saved on either breakpoint
- **THEN** the value is rejected with the same message on both, and the `unit` increment keeps its floor of 1 on both

### Requirement: [ASMR-004] Preset chips stay inside the resolved bounds

Preset chips commit directly without passing through the input's validation, so the editor SHALL offer only presets that satisfy the bounds resolved for the parameter being edited. Where no preset qualifies, the chip row SHALL be empty and the Custom tab SHALL remain available so a value can still be typed.

#### Scenario: Presets outside the range are not offered

- **WHEN** the resolved bounds for the multiplier are `> 1` and `<= 5`
- **THEN** the editor offers the presets 2, 3, 4 and 5, and does not offer 6 or 7
