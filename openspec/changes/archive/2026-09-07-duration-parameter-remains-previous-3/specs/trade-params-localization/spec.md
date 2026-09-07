## Purpose

Defines how the trade page's Parameters panel keeps its rendered parameter text in sync with the language the user has chosen: which parameter values and option labels must re-translate without a page refresh, and at which point in a language switch they are allowed to change.

## ADDED Requirements

### Requirement: [TPL-001] Duration parameter text follows the active language

The Duration parameter in the desktop trade Parameters panel SHALL show its value and its duration-unit option labels in the currently active language. When the user changes the app language, that text MUST be re-derived in place and MUST NOT be left showing the previous language's wording. A manual page refresh MUST NOT be required.

This covers the words the app itself supplies — the unit wording in the collapsed value (`tick`/`ticks`, `sec`, `min`, `hour`/`hours`, `minute`/`minutes`) and the unit options offered when the parameter is opened. It does not govern numerals, calendar dates or clock times, which are covered by TPL-003.

#### Scenario: Tick duration re-translates after a language switch

- **WHEN** the Duration parameter reads `10 ticks` in English and the user selects a different language from the language menu
- **THEN** the parameter's value re-renders with that language's wording for `ticks`, keeping the value `10`
- **AND** the user did not refresh the page

#### Scenario: Second, minute and hour durations re-translate after a language switch

- **WHEN** the committed duration is expressed in seconds, minutes or hours (including a value stored in minutes that displays as whole hours, or as hours plus minutes) and the user changes the language
- **THEN** every unit word in the displayed value is shown in the new language
- **AND** the singular/plural form still matches the numeric value in that language

#### Scenario: Duration unit options re-translate after a language switch

- **WHEN** the user changes the language and then opens the Duration parameter
- **THEN** the duration-unit options (ticks, seconds, minutes, hours, end time) are labelled in the new language

#### Scenario: Duration parameter label re-translates after a language switch

- **WHEN** the user changes the language
- **THEN** the parameter's own field label reads `Duration` translated into the new language, in the same update as its value — the label and the value are never shown in two different languages at once

#### Scenario: Language switch does not disturb the committed duration

- **WHEN** the user changes the language while a duration is committed
- **THEN** the committed duration, its unit and its expiry type are unchanged, no new price proposal is requested on account of the language change, and the parameter is not reset to a default

### Requirement: [TPL-002] Risk management parameter text follows the active language

The Risk management parameter in the desktop trade Parameters panel SHALL show the unit wording in its deal-cancellation value in the currently active language, re-derived in place when the language changes, with no page refresh required.

#### Scenario: Deal cancellation value re-translates after a language switch

- **WHEN** the Risk management parameter reads `DC: 5 minutes` in English and the user changes the language
- **THEN** the value re-renders with that language's wording for `minutes`, keeping `DC:` and the value `5`

#### Scenario: Take profit and stop loss values are unaffected

- **WHEN** the Risk management parameter is showing take-profit and/or stop-loss amounts and the user changes the language
- **THEN** those values continue to read as a currency symbol plus amount, unchanged by the language switch

### Requirement: [TPL-003] Parameter text changes only once the new translations are available

Parameter text SHALL be re-derived at the point the new language's translations become available, not at the point the user picks a language. Selecting a language MUST NOT cause a parameter to display untranslated or partially translated text, and MUST NOT leave a parameter permanently stale once the translations do arrive.

Formatting that is not translated copy — numerals, calendar dates and clock times shown by the Duration parameter — SHALL be unaffected by a language change.

#### Scenario: Translations still loading when the switch starts

- **WHEN** the user selects a new language and its translations have not finished loading
- **THEN** the parameter is not left stale after loading completes: once the translations become available the parameter shows the new language's text

#### Scenario: A re-render before the translations load does not settle the text

- **WHEN** something re-renders the Parameters panel between the user picking a language and the translations arriving
- **THEN** the parameter still updates to the new language afterwards, rather than keeping the text produced by that earlier re-render

#### Scenario: End time value is not re-worded

- **WHEN** the Duration parameter is showing an end-time value such as a date and a clock time, and the user changes the language
- **THEN** the date and time continue to be displayed in the same format, and the switch neither blanks nor garbles them

### Requirement: [TPL-004] Duration parameter text is not cached across a language change

No text rendered by the Duration parameter SHALL be computed once and reused for the lifetime of the component. Every string it displays MUST be derivable from the language active at the time it renders, so that a parameter which stays on screen across a language change is still able to show the new language.

#### Scenario: Duration unit options survive a language change without remounting

- **WHEN** the Duration parameter's unit options are on screen and the active language changes while they remain mounted
- **THEN** the option labels are shown in the new language
- **AND** the currently selected unit is still selected

> **Coverage note.** This scenario is covered at two levels, because one assertion alone cannot
> pin it. Through the full `DurationDesktop` tree (`duration.spec.tsx`) the assertion exercises the
> user-visible outcome but does **not** discriminate implementations: `VerticalTabSelector` renders
> each label through `<Localize i18n_default_text={item.label} />`, so the label re-translates
> whether or not the selector computed it from the hook — the mock's `translate()` leaves an
> already-prefixed string alone, so both paths converge on the same text. The property that does
> discriminate is the selector holding its **own** `useTranslations()` subscription instead of
> relying on an ancestor's re-render, which is what stops #960 returning when the component or a
> parent is wrapped in `React.memo`. `duration-unit-selector.spec.tsx` pins exactly that: it renders
> the selector under a `React.memo` parent with stable props, severing the cascade, so only a
> self-subscribed component still re-translates. That spec fails against the pre-fix selector.

#### Scenario: Two consecutive language changes

- **WHEN** the user changes the language twice in a row without refreshing
- **THEN** the Duration parameter shows the second language's text, not the first language's or the original one's
