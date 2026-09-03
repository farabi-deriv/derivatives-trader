## Purpose

Defines the behaviour of the Trade page chart's Time interval (granularity) selector: which intervals are selectable in which chart mode, and what a selection may change — the chart's rendered interval, the persisted chart granularity, and the `interval` query parameter in the Trade page URL.

## ADDED Requirements

### Requirement: Disabled time intervals are inert

An interval shown as disabled in the Trade page chart's Time interval list SHALL NOT be interactive. Activating a disabled interval — by click, tap, keyboard, or any other means — SHALL have no observable effect: the chart's rendered interval, the persisted chart granularity, and the `interval` URL query parameter all SHALL remain unchanged.

#### Scenario: Clicking a disabled non-tick interval in tick-only mode leaves the URL untouched

- **WHEN** the Trade page is showing a trade type that allows only the tick chart (Digits or Accumulators) and every non-tick interval in the Time interval list is therefore disabled
- **AND** the user clicks a disabled interval such as "1 minute"
- **THEN** the `interval` query parameter in the Trade page URL is unchanged (it still reads `1t`, or stays absent if it was absent)
- **AND** the chart continues to render the tick interval
- **AND** the persisted chart granularity is unchanged

#### Scenario: Repeatedly clicking disabled intervals never leaks state

- **WHEN** the user clicks several different disabled intervals in succession while only the tick chart is allowed
- **THEN** no browser history entry or URL query change is produced by those clicks
- **AND** the selected interval indicator in the list still marks the tick interval as active

#### Scenario: Disabled tick interval on a candle chart type leaves the URL untouched

- **WHEN** a non-area chart type (candles, hollow, or OHLC) is selected, which disables the tick interval
- **AND** the user clicks the disabled tick interval
- **THEN** the `interval` query parameter is unchanged
- **AND** the chart keeps its current candle interval

### Requirement: Enabled time intervals still apply

Selecting an **enabled** interval in the Trade page chart's Time interval list SHALL continue to change the chart's rendered interval, persist the new granularity across reloads, and update the `interval` query parameter of the Trade page URL to the text form of that interval.

#### Scenario: Selecting an enabled interval updates chart and URL

- **WHEN** the Trade page is showing a trade type that allows candle chart types and the user selects the enabled "1 minute" interval
- **THEN** the chart renders 1-minute candles
- **AND** the Trade page URL's `interval` query parameter reads `1m`
- **AND** the granularity is persisted so a page reload restores the 1-minute interval

#### Scenario: Selecting the tick interval on an area chart updates chart and URL

- **WHEN** the area chart type is selected, so the tick interval is enabled, and the user selects it
- **THEN** the chart renders ticks
- **AND** the Trade page URL's `interval` query parameter reads `1t`

### Requirement: Persisted granularity and URL stay consistent with the rendered chart

The persisted chart granularity and the `interval` URL query parameter SHALL only ever reflect an interval the chart is actually allowed to render for the current trade type. A user interaction that the chart refuses to honour SHALL NOT be written to either.

#### Scenario: Leaving tick-only mode does not resurrect a rejected interval

- **WHEN** the user clicks disabled non-tick intervals while Digits or Accumulators is selected
- **AND** then switches to a trade type that allows candle chart types
- **THEN** the chart shows the interval that was in use before Digits/Accumulators was selected, not any interval clicked while it was disabled
- **AND** the `interval` URL query parameter matches the interval the chart is rendering

#### Scenario: Reload after clicking disabled intervals restores the tick interval

- **WHEN** the user clicks disabled non-tick intervals while only the tick chart is allowed
- **AND** then reloads the Trade page
- **THEN** the chart is restored to the tick interval
- **AND** the `interval` URL query parameter reads `1t`

### Requirement: Programmatic interval changes are unaffected

Interval changes the application makes on the user's behalf SHALL continue to work: forcing the tick interval when a tick-only trade type (Digits or Accumulators) is selected, restoring the previously used interval when the user leaves such a trade type, and applying a valid `interval` value present in the URL when the Trade page loads.

#### Scenario: Selecting Accumulators forces the tick interval

- **WHEN** the user selects Accumulators (or a Digits trade type) while a candle interval is in use
- **THEN** the chart switches to the tick interval and the area chart type
- **AND** the `interval` URL query parameter reads `1t`

#### Scenario: Leaving a tick-only trade type restores the previous interval

- **WHEN** the user had a candle interval in use, selected Accumulators or Digits, and then selects a trade type that allows candle chart types
- **THEN** the previously used interval and chart type are restored
- **AND** the `interval` URL query parameter is updated to that restored interval

#### Scenario: Interval from the URL is applied on load

- **WHEN** the Trade page is opened with a valid `interval` query parameter (for example `interval=5m`) for a trade type that allows candle chart types
- **THEN** the chart renders that interval
- **AND** the `interval` query parameter is left as given
